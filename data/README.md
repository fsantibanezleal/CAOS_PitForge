# data/, the data contract + layout

Governed by the **two data contracts** of ADR-0057 (see [docs/architecture/08_data-contracts.md](../docs/architecture/08_data-contracts.md)).

## Layout

| Path | What | Git |
|---|---|---|
| `raw/` | regenerable training tables (`gen_train.mjs`) | **git-ignored** |
| `examples/` | tiny standard-format samples that PASS Contract 1 (`scenarios.csv`, `blockmodel.csv`) | committed |
| `derived/<case>/trace.json` | the compact per-case replay artifact (Contract 2) | committed |
| `derived/manifests/` | per-case `<case>.json` + the flat `index.json` inventory | committed |
| `derived/case-results.json` | the exact pits + Whittle curves, baked by the TS solver | committed |
| `derived/{grade-nn,pit-surrogate}.onnx`, `pit-learned.json` | the trained learned models + metrics | committed |

## CONTRACT 1, ingestion (the *bring-your-own-orebody* gate)

Defined in `data-pipeline/pflab/io/contract.py`; full schema in
[the data-contracts doc](../docs/architecture/08_data-contracts.md) and the
[bring-your-own guide](../docs/guides/02_bring-your-own-data.md).

- **Scenario rows** (`validate_records`): `archetype, nx, ny, nz, price, recovery, mining_cost, processing_cost,
  slope_angle_deg`. Ranges enforced; an unusual slope is flagged.
- **Block rows** (`validate_blocks`): `ix, iy, iz, tonnage, density, grade` (grade is a **mass fraction**). Negative
  tonnage/density, out-of-box indices and unphysical grades are **rejected** with a reason; rich grades + duplicate
  indices are **flagged**.

A record is accepted iff it passes; bad records are rejected (never silently coerced); plausible-but-suspicious ones
are flagged (accepted; the flag travels into the manifest). The committed `examples/*.csv` must pass (a CI test asserts it).

## CONTRACT 2, artifact (pipeline → web)

`data-pipeline/pflab/core/{trace.py, manifest.py}` (`pitforge.trace/v1` + `pitforge.manifest/v2`). The web loads only
manifests + traces + the shared artifacts; `frontend/src/lib/contract.types.ts` mirrors the shapes so a drift fails
`tsc`. **No raw/heavy data is committed**, only the compact derived artifacts (the CI guards reject
`.parquet/.h5/.mat/.npy`, venvs, and native binaries).
