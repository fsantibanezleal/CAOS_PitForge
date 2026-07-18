# The two data contracts

## Contract 1, ingestion (`io/contract.py`)

The *bring-your-own-orebody* gate. Two entry points, one policy: a record is **accepted** iff it passes; ill-formed
records are **rejected** with a reason (never silently coerced); plausible-but-extreme records are **flagged**
(accepted; the flag travels into the manifest).

### Scenario rows (`validate_records`), one row per case

| column | unit / range | on violation |
|---|---|---|
| `archetype` | ∈ {porphyry, vein, layered, coreHalo, oracle} | reject |
| `nx, ny, nz` | 1–200 blocks | reject |
| `price` | 1 – 1e6 $/t metal | reject |
| `recovery` | 0.01 – 1.0 | reject |
| `mining_cost`, `processing_cost` | 0 – 1e5 $/t | reject |
| `slope_angle_deg` | 10 – 89° (flag outside 25–75°) | reject / flag |

### Block rows (`validate_blocks`), one row per block (a real block model)

| column | rule |
|---|---|
| `ix, iy, iz` | integer; inside the model box (if dims given) else reject; duplicate → flag |
| `tonnage`, `density` | `> 0` else reject |
| `grade` | mass fraction in `[0, 1]` else reject; `> 0.5` (implausibly rich for a bulk metal) → flag; NaN/Inf → reject |

Committed samples that must pass: `data/examples/{scenarios.csv, blockmodel.csv}` (a CI test asserts it).

## Contract 2, artifact (`core/{trace,manifest}.py`)

The pipeline-to-web contract. The web loads only manifests + traces + the shared artifacts.

- **`pitforge.trace/v1`** (per case): the case spec (archetype, dims, block size, econ), the ultimate-pit summary,
  the Whittle curve (per RF: value / ore / waste / strip / nBlocks), a vertical cross-section (shell index per block),
  the grade stats, and the learned-model metrics (`status: trained | pending-training`).
- **`pitforge.manifest/v2`** (per case): category, seed, engine + version, the **shared artifacts** (the two ONNX +
  `pit-learned.json` + `case-results.json`), the trace pointer + byte size, the lane/gate verdict, the Contract-1
  flags, the metrics, and an honesty note.
- **`pitforge.index/v1`**: the flat inventory of all 9 cases.

A TS mirror, `frontend/src/lib/contract.types.ts`, declares these shapes so a drift **fails `tsc`** (the web cannot
ship reading a shape the pipeline does not produce). `scripts/check_artifacts.py` enforces manifest ↔ artifact
consistency (existence, byte size, lane == gate verdict) on disk.
