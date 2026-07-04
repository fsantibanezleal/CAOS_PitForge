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
import { forEachPrecedenceArc, slopeTemplate } from './precedence.ts';
import { type BlockModel, type EconParams, nBlocks, type PitResult } from './types.ts';

export function solveUltimatePit(model: BlockModel, econ: EconParams): PitResult {
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

  const mf = new MaxFlow(N + 2);
  for (let i = 0; i < N; i++) {
    if (value[i] > 0) mf.addEdge(S, i, value[i]);
    else if (value[i] < 0) mf.addEdge(i, T, -value[i]);
  }
  forEachPrecedenceArc(model, slopeTemplate(model, econ.slopeAngleDeg), (i, j) => mf.addEdge(i, j, INF));

  const maxflow = mf.maxflow(S, T);
  const reachable = mf.minCutReachable(S);

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
  };
}
