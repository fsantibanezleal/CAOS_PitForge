// PitForge optimisation engine, the live client-side core (also run from Node by the offline bake via tsx).
//
//   solveUltimatePit , exact Lerchs–Grossmann ultimate pit via min-cut / max-flow
//   nestedPitShells  , the Whittle revenue-factor nested shells + value/tonnage/strip curves
//   makeDeposit      , seeded synthetic deposit archetypes (block models)
//
// Everything is deterministic and dependency-free (no DOM, no npm runtime deps) so the same engine runs in the
// browser and in the offline Node bake.

export * from './types.ts';
export { blockValue, isOre, recoverableRevenue } from './econ.ts';
export { MaxFlow } from './maxflow.ts';
export { forEachPrecedenceArc, slopeTemplate, type PrecedenceTemplate } from './precedence.ts';
export { solveUltimatePit } from './ultimatepit.ts';
export { defaultRevenueFactors, nestedPitShells } from './whittle.ts';
export { greedySchedule, type ScheduleOpts, type ScheduleResult } from './schedule.ts';
export { type Archetype, type DepositSpec, makeDeposit } from './blockmodel.ts';
