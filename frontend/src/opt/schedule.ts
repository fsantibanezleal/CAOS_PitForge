// Didactic CPIT pushback schedule, the LIVE in-browser scheduling lane (the certified LP bound is computed
// offline, see data-pipeline/pflab/science/cpit.py + data/derived/cpit-schedule.json).
//
// The static ultimate pit the browser solves exactly is the UNDISCOUNTED, UNCAPACITATED limit of a schedule.
// This adds the scheduling dimension: a time index, a per-period tonnage capacity, and discounting -> a
// discounted NPV. It is a greedy heuristic (mine the highest-value available block first, respecting slope
// precedence, until the period capacity is reached), NOT an optimal schedule. The certified upper bound + the
// integrality gap come from the offline LP relaxation; here we produce a feasible, glass-box schedule to animate.
//
// Duality tie-in (asserted in test/schedule.test.ts): at discount rate 0 and infinite capacity the mined set
// equals the exact solveUltimatePit set block-for-block. That is the negative control tying this lane to the
// proven optimum. Never mine a block outside the ultimate pit (it can only lower the total value).

import { forEachPrecedenceArc, slopeTemplate } from './precedence.ts';
import { solveUltimatePit } from './ultimatepit.ts';
import { blockValue } from './econ.ts';
import { type BlockModel, type EconParams, nBlocks } from './types.ts';

export interface ScheduleOpts {
  /** number of scheduling periods. */
  periods: number;
  /** discount rate per period; period 1 is undiscounted, d[t] = 1/(1+rate)^t (t 0-based). */
  discountRatePerPeriod: number;
  /** per-period tonnage capacity = capacityFraction * (total UPL tonnage / periods). Infinity = uncapacitated. */
  capacityFraction: number;
}

export interface ScheduleResult {
  /** per block: the period index it is mined in (0-based), or -1 if never mined. */
  periodOfBlock: Int32Array;
  periods: number;
  perPeriodTonnes: number[];
  perPeriodNpv: number[];
  perPeriodCumNpv: number[];
  /** discounted NPV of the rounded schedule. */
  npv: number;
  /** the undiscounted ultimate-pit value (the schedule's degenerate upper reference). */
  uplValue: number;
  uplBlocks: number;
  capacityPerPeriod: number;
  minedBlocks: number;
}

/** A minimal binary max-heap keyed by a numeric priority (block value). */
class MaxHeap {
  private ids: number[] = [];
  private keys: number[] = [];
  get size(): number { return this.ids.length; }
  push(id: number, key: number): void {
    this.ids.push(id); this.keys.push(key);
    let i = this.ids.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.keys[p] >= this.keys[i]) break;
      this.swap(i, p); i = p;
    }
  }
  pop(): number {
    const top = this.ids[0];
    const lastId = this.ids.pop()!;
    const lastKey = this.keys.pop()!;
    if (this.ids.length > 0) {
      this.ids[0] = lastId; this.keys[0] = lastKey;
      let i = 0;
      const n = this.ids.length;
      for (;;) {
        const l = 2 * i + 1, r = 2 * i + 2;
        let m = i;
        if (l < n && this.keys[l] > this.keys[m]) m = l;
        if (r < n && this.keys[r] > this.keys[m]) m = r;
        if (m === i) break;
        this.swap(i, m); i = m;
      }
    }
    return top;
  }
  private swap(a: number, b: number): void {
    [this.ids[a], this.ids[b]] = [this.ids[b], this.ids[a]];
    [this.keys[a], this.keys[b]] = [this.keys[b], this.keys[a]];
  }
}

/** Build predecessor + successor adjacency for the slope-precedence graph of this model/econ. */
function precedenceGraph(model: BlockModel, econ: EconParams): { predCount: Int32Array; succ: number[][] } {
  const N = nBlocks(model.dims);
  const predCount = new Int32Array(N);
  const succ: number[][] = Array.from({ length: N }, () => []);
  // forEachPrecedenceArc emits (i, j): block i depends on the overlying block j (j mined before i).
  forEachPrecedenceArc(model, slopeTemplate(model, econ.slopeAngleDeg), (i, j) => {
    predCount[i]++;
    succ[j].push(i);
  });
  return { predCount, succ };
}

export function greedySchedule(model: BlockModel, econ: EconParams, opts: ScheduleOpts): ScheduleResult {
  const N = nBlocks(model.dims);
  const rf = econ.revenueFactor ?? 1;
  const upl = solveUltimatePit(model, { ...econ, revenueFactor: rf });
  const value = new Float64Array(N);
  for (let i = 0; i < N; i++) value[i] = blockValue(model, i, { ...econ, revenueFactor: rf });

  // extraction tonnage per block; the capacity constraint is on mined tonnes per period.
  let uplTonnage = 0;
  for (let i = 0; i < N; i++) if (upl.inPit[i]) uplTonnage += model.tonnage[i];
  const T = Math.max(1, opts.periods);
  const capacity = Number.isFinite(opts.capacityFraction)
    ? opts.capacityFraction * (uplTonnage / T)
    : Infinity;

  const { predCount, succ } = precedenceGraph(model, econ);
  // remaining unmined predecessors, restricted to the UPL closure (all preds of a UPL block are UPL).
  const remaining = new Int32Array(N);
  for (let i = 0; i < N; i++) if (upl.inPit[i]) remaining[i] = predCount[i];

  const periodOf = new Int32Array(N).fill(-1);
  const mined = new Uint8Array(N);
  const heap = new MaxHeap();
  for (let i = 0; i < N; i++) if (upl.inPit[i] && remaining[i] === 0) heap.push(i, value[i]);

  const perTonnes = new Array(T).fill(0);
  const perNpv = new Array(T).fill(0);
  for (let t = 0; t < T; t++) {
    let used = 0;
    const d = 1 / Math.pow(1 + opts.discountRatePerPeriod, t);
    const deferred: number[] = [];
    while (heap.size > 0) {
      const b = heap.pop();
      if (used + model.tonnage[b] > capacity + 1e-6) {
        deferred.push(b);
        break; // close the period once the best-available block no longer fits
      }
      mined[b] = 1;
      periodOf[b] = t;
      used += model.tonnage[b];
      perTonnes[t] += model.tonnage[b];
      perNpv[t] += d * value[b];
      for (const c of succ[b]) {
        if (!upl.inPit[c] || mined[c]) continue;
        remaining[c]--;
        if (remaining[c] === 0) heap.push(c, value[c]);
      }
    }
    for (const b of deferred) heap.push(b, value[b]);
  }

  const cum: number[] = [];
  let running = 0;
  for (let t = 0; t < T; t++) { running += perNpv[t]; cum.push(running); }
  let minedBlocks = 0;
  for (let i = 0; i < N; i++) if (mined[i]) minedBlocks++;

  return {
    periodOfBlock: periodOf, periods: T,
    perPeriodTonnes: perTonnes, perPeriodNpv: perNpv, perPeriodCumNpv: cum,
    npv: running, uplValue: upl.pitValue, uplBlocks: upl.nBlocks,
    capacityPerPeriod: capacity, minedBlocks,
  };
}
