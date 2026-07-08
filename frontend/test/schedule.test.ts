// CPIT scheduling controls (TypeScript side), the negative control tying the live schedule to the proven
// ultimate-pit optimum. Run with: node --import tsx --test test/schedule.test.ts
//
// The headline anchor is the exact ultimate pit. The greedy schedule must NEVER contradict it: at discount
// rate 0 with infinite capacity the mined set MUST equal solveUltimatePit block-for-block (the DUALITY control
// from the depth dossier). The offline LP relaxation (Python) certifies the NPV upper bound; here we only check
// that the feasible in-browser schedule is precedence-correct and reduces to the ultimate pit in the limit.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  type EconParams,
  greedySchedule,
  idx,
  makeDeposit,
  solveUltimatePit,
} from '../src/opt/index.ts';

const ECON: EconParams = { price: 6000, recovery: 0.88, miningCost: 2.5, processingCost: 9, slopeAngleDeg: 45 };

test('DUALITY control: rate 0 + infinite capacity mines exactly the ultimate pit, block-for-block', () => {
  const model = makeDeposit({ archetype: 'porphyry', dims: { nx: 16, ny: 16, nz: 8 }, seed: 7, peakGrade: 0.03 });
  const upl = solveUltimatePit(model, ECON);
  const sched = greedySchedule(model, ECON, { periods: 1, discountRatePerPeriod: 0, capacityFraction: Infinity });
  assert.ok(upl.nBlocks > 0, 'the porphyry should open a pit');
  assert.equal(sched.minedBlocks, upl.nBlocks, 'same count as the ultimate pit');
  for (let i = 0; i < model.dims.nx * model.dims.ny * model.dims.nz; i++) {
    assert.equal(sched.periodOfBlock[i] >= 0, !!upl.inPit[i], `block ${i} mined-status must match the UPL`);
  }
  // in the undiscounted limit the schedule NPV equals the ultimate-pit value.
  assert.ok(Math.abs(sched.npv - upl.pitValue) < 1e-3, 'undiscounted NPV == ultimate-pit value');
});

test('DUALITY holds across several periods too (all UPL blocks mined by the final period, rate 0)', () => {
  const model = makeDeposit({ archetype: 'coreHalo', dims: { nx: 14, ny: 14, nz: 7 }, seed: 3, peakGrade: 0.04 });
  const upl = solveUltimatePit(model, ECON);
  const sched = greedySchedule(model, ECON, { periods: 5, discountRatePerPeriod: 0, capacityFraction: Infinity });
  assert.equal(sched.minedBlocks, upl.nBlocks);
  assert.ok(Math.abs(sched.npv - upl.pitValue) < 1e-3);
});

test('schedule is precedence-feasible and respects the per-period capacity', () => {
  const model = makeDeposit({ archetype: 'porphyry', dims: { nx: 16, ny: 16, nz: 8 }, seed: 11, peakGrade: 0.03 });
  const econ = ECON;
  const T = 6;
  const sched = greedySchedule(model, econ, { periods: T, discountRatePerPeriod: 0.12, capacityFraction: 1.15 });
  const { nx, ny, nz } = model.dims;
  // precedence: no block is mined before any overlying block in its slope cone (checked via the 9-point cone).
  const r = 1; // 45deg cubic
  for (let iz = 1; iz < nz; iz++) {
    for (let iy = 0; iy < ny; iy++) {
      for (let ix = 0; ix < nx; ix++) {
        const b = idx(model.dims, ix, iy, iz);
        if (sched.periodOfBlock[b] < 0) continue;
        for (let dx = -r; dx <= r; dx++) {
          for (let dy = -r; dy <= r; dy++) {
            const jx = ix + dx, jy = iy + dy;
            if (jx < 0 || jx >= nx || jy < 0 || jy >= ny) continue;
            const a = idx(model.dims, jx, jy, iz - 1);
            assert.ok(sched.periodOfBlock[a] >= 0, `overlying block ${a} must be mined if ${b} is`);
            assert.ok(sched.periodOfBlock[a] <= sched.periodOfBlock[b], `${b} mined before overlying ${a}`);
          }
        }
      }
    }
  }
  // capacity: no period exceeds its tonnage cap.
  for (let t = 0; t < T; t++) assert.ok(sched.perPeriodTonnes[t] <= sched.capacityPerPeriod + 1e-3);
  // discounting can only lose value versus the undiscounted ultimate pit.
  assert.ok(sched.npv <= sched.uplValue + 1e-6, 'discounted NPV <= ultimate-pit value');
  assert.ok(sched.npv > 0, 'a profitable deposit should yield a positive NPV');
});

test('lower discount rate yields a higher (or equal) NPV, everything else fixed', () => {
  const model = makeDeposit({ archetype: 'porphyry', dims: { nx: 16, ny: 16, nz: 8 }, seed: 7, peakGrade: 0.03 });
  const lo = greedySchedule(model, ECON, { periods: 6, discountRatePerPeriod: 0.05, capacityFraction: 1.15 });
  const hi = greedySchedule(model, ECON, { periods: 6, discountRatePerPeriod: 0.20, capacityFraction: 1.15 });
  assert.ok(lo.npv >= hi.npv - 1e-6, 'a lower discount rate should not reduce NPV');
});
