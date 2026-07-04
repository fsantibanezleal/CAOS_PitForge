// Nested pit shells, the Whittle parameterisation. Solving the UPL for an increasing sequence of revenue factors
// RF ∈ (0,1] yields a family of NESTED pits (lower RF ⊂ higher RF): the pit-by-pit graph used for pushback / phase
// design and the classic value-vs-RF, tonnage-vs-RF and strip-ratio-vs-RF curves.
//
// Nesting is guaranteed analytically (a lower RF only lowers block values, so its optimal pit cannot contain a block
// the higher-RF pit excludes); we additionally UNION each shell with the previous one to absorb any float-tie
// flicker, so `shellOf` is always monotone.

import { solveUltimatePit } from './ultimatepit.ts';
import { type BlockModel, type EconParams, nBlocks, type ShellResult, type WhittlePoint } from './types.ts';

/** A reasonable default RF schedule (Whittle-style), ascending. */
export function defaultRevenueFactors(n = 12): number[] {
  const rfs: number[] = [];
  for (let k = 1; k <= n; k++) rfs.push(Math.round((k / n) * 1000) / 1000);
  return rfs;
}

export function nestedPitShells(model: BlockModel, econBase: EconParams, rfs: number[]): ShellResult {
  const N = nBlocks(model.dims);
  const schedule = [...rfs].sort((a, b) => a - b);
  const shellOf = new Int32Array(N).fill(-1);
  const curve: WhittlePoint[] = [];
  const inAny = new Uint8Array(N); // running union → enforces nesting

  schedule.forEach((rf, s) => {
    const pit = solveUltimatePit(model, { ...econBase, revenueFactor: rf });
    for (let i = 0; i < N; i++) {
      if (pit.inPit[i]) inAny[i] = 1;
      if (inAny[i] && shellOf[i] < 0) shellOf[i] = s;
    }
    curve.push({
      rf,
      pitValue: pit.pitValue,
      oreTonnes: pit.oreTonnes,
      wasteTonnes: pit.wasteTonnes,
      metalTonnes: pit.metalTonnes,
      stripRatio: pit.stripRatio,
      nBlocks: pit.nBlocks,
    });
  });

  return { rfs: schedule, shellOf, curve };
}
