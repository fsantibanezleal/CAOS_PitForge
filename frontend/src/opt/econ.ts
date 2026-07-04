// Block economic value, the floating-cutoff model that turns grade + prices into the per-block value v_i the
// optimiser maximises.
//
// Every block pays the mining cost (you must dig it to move it). A block is sent to the MILL only if milling it is
// worth more than dumping it as waste, i.e. its recovered revenue beats the processing cost, this is the floating
// cutoff, decided per block:
//
//   revenue_i = price · tonnage_i · grade_i · recovery                 (recoverable metal value)
//   ore value   = RF·revenue_i − processingCost · tonnage_i − miningCost · tonnage_i
//   waste value =                                            − miningCost · tonnage_i
//   v_i = max( RF·revenue_i − processingCost·tonnage_i , 0 ) − miningCost·tonnage_i
//
// The Whittle revenue factor RF scales revenue only; RF<1 shrinks the pit (used to build nested shells).

import { type BlockModel, type EconParams } from './types.ts';

export function recoverableRevenue(model: BlockModel, i: number, econ: EconParams): number {
  return econ.price * model.tonnage[i] * model.grade[i] * econ.recovery;
}

/** True if, at this RF, milling the block beats dumping it (the floating-cutoff decision). */
export function isOre(model: BlockModel, i: number, econ: EconParams): boolean {
  const rf = econ.revenueFactor ?? 1;
  return rf * recoverableRevenue(model, i, econ) - econ.processingCost * model.tonnage[i] > 0;
}

/** Economic value of block i (may be negative for waste / low-grade). */
export function blockValue(model: BlockModel, i: number, econ: EconParams): number {
  const rf = econ.revenueFactor ?? 1;
  const rev = rf * recoverableRevenue(model, i, econ);
  const milled = Math.max(rev - econ.processingCost * model.tonnage[i], 0);
  return milled - econ.miningCost * model.tonnage[i];
}
