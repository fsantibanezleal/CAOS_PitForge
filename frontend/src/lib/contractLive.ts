// CONTRACT 1 (ingestion), LIVE browser port of data-pipeline/pflab/io/contract.py::validate_blocks.
// The rule set is mirrored 1:1 and guarded against drift by test/contract-live.test.ts (same
// fixtures as the Python suite): a row is ACCEPTED iff it passes; ill-formed rows are REJECTED
// with a reason (never silently coerced); plausible-but-extreme rows are FLAGGED (accepted, the
// flag travels with the report). Schema: ix,iy,iz,tonnage,density,grade, data/README.md.

import { type BlockModel, type GridDims, idx } from '../opt/types.ts';

export const BLOCK_COLUMNS = ['ix', 'iy', 'iz', 'tonnage', 'density', 'grade'] as const;
export const GRADE_PHYSICAL_MAX = 1.0; // grade is a mass fraction; above this is unphysical → REJECT
export const GRADE_FLAG_MAX = 0.5;     // >50 % grade is implausible for a bulk metal → FLAG

export interface BlockRow { ix: number; iy: number; iz: number; tonnage: number; density: number; grade: number }
export interface ContractLiveReport {
  accepted: BlockRow[];
  rejected: { row: number; reason: string }[];
  flagged: { index: [number, number, number]; flags: string[] }[];
}

/** Parse a CSV text (header + rows) into raw records keyed by the header names. */
export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((l) => {
    const cells = l.split(',').map((c) => c.trim());
    const row: Record<string, string> = {};
    header.forEach((h, k) => { row[h] = cells[k] ?? ''; });
    return row;
  });
}

const bad = (v: number) => Number.isNaN(v) || !Number.isFinite(v);

/** validate_blocks, mirrored. `dims` bounds the index box when given (same optionality as Python). */
export function validateBlocksLive(rawRows: Record<string, string>[], dims?: [number, number, number]): ContractLiveReport {
  const accepted: BlockRow[] = [];
  const rejected: { row: number; reason: string }[] = [];
  const flagged: { index: [number, number, number]; flags: string[] }[] = [];
  const seen = new Set<string>();

  rawRows.forEach((row, i) => {
    const missing = BLOCK_COLUMNS.filter((c) => !(c in row) || row[c] === '' || row[c] === null || row[c] === undefined);
    if (missing.length) { rejected.push({ row: i, reason: `missing/empty columns: [${missing.join(', ')}]` }); return; }

    // mirror Python float(): literal nan/inf parse (and hit the NaN/Inf rule); other text REJECTS.
    const nums: number[] = [];
    let nonNumeric = false;
    for (const c of BLOCK_COLUMNS) {
      const s = row[c];
      const v = Number(s);
      if (Number.isNaN(v) && !/^[+-]?(nan|inf(inity)?)$/i.test(s)) { nonNumeric = true; break; }
      nums.push(/^[+-]?inf(inity)?$/i.test(s) ? (s.trim().startsWith('-') ? -Infinity : Infinity) : v);
    }
    if (nonNumeric) { rejected.push({ row: i, reason: 'non-numeric ix/iy/iz/tonnage/density/grade' }); return; }
    const [ixF, iyF, izF, tonnage, density, grade] = nums;
    const ix = Math.trunc(ixF);
    const iy = Math.trunc(iyF);
    const iz = Math.trunc(izF);

    const reasons: string[] = [];
    if ([tonnage, density, grade].some(bad)) reasons.push('NaN/Inf value');
    else {
      if (tonnage <= 0) reasons.push(`tonnage=${tonnage} ≤ 0`);
      if (density <= 0) reasons.push(`density=${density} ≤ 0`);
      if (!(grade >= 0 && grade <= GRADE_PHYSICAL_MAX)) reasons.push(`grade=${grade} out of [0,${GRADE_PHYSICAL_MAX}] (mass fraction)`);
    }
    if (dims && !(ix >= 0 && ix < dims[0] && iy >= 0 && iy < dims[1] && iz >= 0 && iz < dims[2])) {
      reasons.push(`index (${ix},${iy},${iz}) outside the (${dims.join(',')}) model box`);
    }
    if (reasons.length) { rejected.push({ row: i, reason: reasons.join('; ') }); return; }

    const flags: string[] = [];
    const key = `${ix},${iy},${iz}`;
    if (seen.has(key)) flags.push(`duplicate block index (${ix},${iy},${iz})`);
    seen.add(key);
    if (grade > GRADE_FLAG_MAX) flags.push(`grade ${grade} > ${GRADE_FLAG_MAX}, implausibly rich for a bulk metal`);
    if (flags.length) flagged.push({ index: [ix, iy, iz], flags });
    accepted.push({ ix, iy, iz, tonnage, density, grade });
  });

  return { accepted, rejected, flagged };
}

export interface UserModel {
  model: BlockModel;
  /** 1 where the upload provided a block; absent cells are zero-tonnage (mining nothing costs nothing). */
  present: Uint8Array;
  dims: GridDims;
  nRows: number;
}

/** Build the dense BlockModel the exact engine solves from the ACCEPTED rows.
 *  Indices must start ≥ 0 (the contract's model box); dims = the index bounding box. */
export function buildUserModel(rows: BlockRow[], name: string): UserModel {
  if (rows.length === 0) throw new Error('no accepted blocks');
  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (const r of rows) {
    if (r.ix >= nx) nx = r.ix + 1;
    if (r.iy >= ny) ny = r.iy + 1;
    if (r.iz >= nz) nz = r.iz + 1;
  }
  const dims: GridDims = { nx, ny, nz };
  const N = nx * ny * nz;
  if (N > 1_000_000) throw new Error(`model box ${nx}×${ny}×${nz} too large for the live solver (>1e6 cells)`);
  const tonnage = new Float64Array(N);
  const density = new Float64Array(N);
  const grade = new Float64Array(N);
  const present = new Uint8Array(N);
  for (const r of rows) {
    const d = idx(dims, r.ix, r.iy, r.iz);
    tonnage[d] = r.tonnage; // duplicates: last row wins (flagged upstream)
    density[d] = r.density;
    grade[d] = r.grade;
    present[d] = 1;
  }
  const model: BlockModel = {
    dims, block: { dx: 10, dy: 10, dz: 10 },
    tonnage, density, grade,
    meta: { name, archetype: 'user-uploaded', gradeUnit: 'mass fraction' },
  };
  return { model, present, dims, nRows: rows.length };
}
