// Ultimate pit limit (UPL), assemble the min-cut graph from block values + the slope-precedence cone, solve it, and
// read the optimal pit off the source side of the cut. This is the exact Lerchs–Grossmann result via max-flow.
//
// Graph (Picard's max-closure → min-cut reduction):
//   source s → block i  with cap v_i        for every block with v_i > 0
//   block i → sink t     with cap −v_i       for every block with v_i < 0
//   block i → block j    with cap INF        for every precedence arc (j is above i, must be mined first)
// After max-flow, the blocks reachable from s in the residual graph form the optimal pit, and
//   pitValue = (Σ positive v_i) − maxflow.

import { blockValue, isOre, recoverableRevenue } from './econ.ts';
import { MaxFlow } from './maxflow.ts';
import { solveClosurePseudoflow } from './pseudoflow.ts';
import { forEachPrecedenceArc, slopeTemplate, slopeTemplateVariable } from './precedence.ts';
import { type BlockModel, type EconParams, type ExactSolver, nBlocks, type PitResult } from './types.ts';

export function solveUltimatePit(model: BlockModel, econ: EconParams, solver: ExactSolver = 'dinic'): PitResult {
  const N = nBlocks(model.dims);
  const S = N;
  const T = N + 1;

  // block values + INF (must exceed the total positive value so no precedence arc is ever cut).
  const value = new Float64Array(N);
  let sumPositive = 0;
  for (let i = 0; i < N; i++) {
    const v = blockValue(model, i, econ);
    value[i] = v;
    if (v > 0) sumPositive += v;
  }
  const INF = sumPositive + 1;

  const tmpl = econ.slopeAngles ? slopeTemplateVariable(model, econ.slopeAngles) : slopeTemplate(model, econ.slopeAngleDeg);
  let maxflow: number;
  let reachable: Uint8Array;
  if (solver === 'pseudoflow') {
    const from: number[] = [];
    const to: number[] = [];
    forEachPrecedenceArc(model, tmpl, (i, j) => { from.push(i); to.push(j); });
    const result = solveClosurePseudoflow(value, Int32Array.from(from), Int32Array.from(to), INF);
    maxflow = result.minCut;
    reachable = result.selected;
  } else {
    const mf = new MaxFlow(N + 2);
    for (let i = 0; i < N; i++) {
      if (value[i] > 0) mf.addEdge(S, i, value[i]);
      else if (value[i] < 0) mf.addEdge(i, T, -value[i]);
    }
    forEachPrecedenceArc(model, tmpl, (i, j) => mf.addEdge(i, j, INF));
    maxflow = mf.maxflow(S, T);
    reachable = mf.minCutReachable(S);
  }

  const inPit = new Uint8Array(N);
  let pitValue = 0;
  let oreTonnes = 0;
  let wasteTonnes = 0;
  let metalTonnes = 0;
  for (let i = 0; i < N; i++) {
    if (!reachable[i]) continue;
    inPit[i] = 1;
    pitValue += value[i];
    if (isOre(model, i, econ)) {
      oreTonnes += model.tonnage[i];
      metalTonnes += (recoverableRevenue(model, i, econ) / econ.price); // = tonnage·grade·recovery
    } else {
      wasteTonnes += model.tonnage[i];
    }
  }

  // Self-checks, on EVERY solve of this lane (not only the explicit-precedence MineLib lane).
  //
  // Both checks below are O(1), so they run unconditionally, including while a slider is being
  // dragged. That matters: an earlier version of this block walked every precedence arc, which
  // cost +19% per solve on a shipped 6912-block case and +48% on a 32000-block one, and the
  // bring-your-own-model path accepts arbitrary user models.
  //
  // 1) The DUALITY IDENTITY, pitValue = sumPositive - maxflow. This is the strong check: pitValue
  //    is summed over the source-reachable set, while (sumPositive - maxflow) comes from the flow
  //    alone, so any error in the min-cut reachable set breaks the equality. The tolerance is
  //    RELATIVE to the instance scale with no absolute floor, because an absolute floor makes the
  //    check vacuous on an instance whose whole optimum is smaller than the floor.
  // 2) The CLOSURE GUARANTEE. Precedence arcs carry INF = sumPositive + 1, and the trivial cut
  //    that severs every source arc costs sumPositive, so a minimum cut can never include a
  //    precedence arc and the pit is closed by construction. Asserting maxflow <= sumPositive is
  //    exactly that argument, in O(1): if it ever fails, an INF arc was cut and the pit is not a
  //    closure. The exhaustive arc-by-arc walk is kept in the test suite (test/opt.test.ts), where
  //    its cost does not reach a user.
  const identityGap = Math.abs(pitValue - (sumPositive - maxflow));
  if (identityGap > 1e-6 * Math.max(1, Math.abs(sumPositive))) {
    throw new Error(
      `value identity violated: |pitValue - (sumPositive - maxflow)| = ${identityGap} ` +
        `(pitValue ${pitValue}, sumPositive ${sumPositive}, maxflow ${maxflow}, solver ${solver})`,
    );
  }
  if (maxflow > sumPositive * (1 + 1e-9) + 1e-9) {
    throw new Error(
      `closure violated: maxflow ${maxflow} exceeds sumPositive ${sumPositive}, which means a ` +
        'precedence arc was cut and the pit is not a closed set',
    );
  }

  return {
    inPit,
    pitValue,
    oreTonnes,
    wasteTonnes,
    metalTonnes,
    stripRatio: oreTonnes > 0 ? wasteTonnes / oreTonnes : 0,
    nBlocks: inPit.reduce((a, b) => a + b, 0),
    maxflow,
    sumPositive,
    solver,
  };
}
