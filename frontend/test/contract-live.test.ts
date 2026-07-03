// Drift guard for the LIVE CONTRACT-1 port (lib/contractLive.ts) against the Python rule set
// (data-pipeline/pflab/io/contract.py::validate_blocks + tests/test_contract.py). Same fixtures,
// same expected accept/reject/flag outcomes, plus the committed example file itself.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildUserModel, parseCsv, validateBlocksLive } from '../src/lib/contractLive.ts';

const HERE = dirname(fileURLToPath(import.meta.url));

const R = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, String(v)]));

test('mirror: rejects unphysical, flags rich (tests/test_contract.py::test_block_contract...)', () => {
  const rows = [
    R({ ix: 0, iy: 0, iz: 0, tonnage: 2700, density: 2.7, grade: 0.01 }),  // good
    R({ ix: 1, iy: 0, iz: 0, tonnage: -5, density: 2.7, grade: 0.01 }),    // neg tonnage → reject
    R({ ix: 2, iy: 0, iz: 0, tonnage: 2700, density: 2.7, grade: 1.5 }),   // grade > 1 → reject
    R({ ix: 3, iy: 0, iz: 0, tonnage: 2700, density: 2.7, grade: 0.7 }),   // rich grade → flag (accepted)
  ];
  const rep = validateBlocksLive(rows, [24, 24, 12]);
  assert.equal(rep.accepted.length, 2);
  assert.equal(rep.rejected.length, 2);
  assert.ok(rep.flagged.length > 0);
});

test('mirror: never coerces — non-numeric, NaN/Inf, missing, out-of-box, density', () => {
  const rep = validateBlocksLive([
    R({ ix: 0, iy: 0, iz: 0, tonnage: 'lots', density: 2.7, grade: 0.01 }), // non-numeric → reject
    R({ ix: 0, iy: 0, iz: 1, tonnage: 'NaN', density: 2.7, grade: 0.01 }),  // literal NaN → NaN/Inf reject
    R({ ix: 0, iy: 0, iz: 2, tonnage: 2700, density: 0, grade: 0.01 }),     // density ≤ 0 → reject
    R({ ix: 0, iy: 0, iz: 3, tonnage: 2700, density: 2.7 }),                // missing grade → reject
    R({ ix: 99, iy: 0, iz: 0, tonnage: 2700, density: 2.7, grade: 0.01 }),  // out of box → reject
    R({ ix: 0, iy: 0, iz: 4, tonnage: 'Infinity', density: 2.7, grade: 0.01 }), // Inf → reject
  ], [24, 24, 12]);
  assert.equal(rep.accepted.length, 0);
  assert.equal(rep.rejected.length, 6);
  assert.match(rep.rejected[0].reason, /non-numeric/);
  assert.match(rep.rejected[1].reason, /NaN\/Inf/);
  assert.match(rep.rejected[2].reason, /density/);
  assert.match(rep.rejected[3].reason, /missing/);
  assert.match(rep.rejected[4].reason, /outside/);
  assert.match(rep.rejected[5].reason, /NaN\/Inf/);
});

test('mirror: duplicates flagged but accepted', () => {
  const rep = validateBlocksLive([
    R({ ix: 1, iy: 1, iz: 1, tonnage: 2700, density: 2.7, grade: 0.01 }),
    R({ ix: 1, iy: 1, iz: 1, tonnage: 2800, density: 2.7, grade: 0.02 }),
  ]);
  assert.equal(rep.accepted.length, 2);
  assert.equal(rep.flagged.length, 1);
  assert.match(rep.flagged[0].flags[0], /duplicate/);
});

test('mirror: the committed example passes (tests/test_contract.py::test_committed_examples...)', () => {
  const csv = readFileSync(join(HERE, '..', '..', 'data', 'examples', 'blockmodel.csv'), 'utf8');
  const rep = validateBlocksLive(parseCsv(csv));
  assert.ok(rep.accepted.length > 0);
  assert.equal(rep.rejected.length, 0);

  const um = buildUserModel(rep.accepted, 'example');
  assert.deepEqual(um.dims, { nx: 3, ny: 1, nz: 3 });
  assert.equal([...um.present].reduce((a: number, b: number) => a + b, 0), rep.accepted.length);
});

test('buildUserModel guards: empty input and oversized boxes throw', () => {
  assert.throws(() => buildUserModel([], 'x'), /no accepted blocks/);
  assert.throws(() => buildUserModel([{ ix: 200, iy: 200, iz: 100, tonnage: 1, density: 1, grade: 0 }].map((r) => ({ ...r })), 'x'), /too large/);
});
