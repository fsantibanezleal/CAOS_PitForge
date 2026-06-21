# data-pipeline/ — the offline engine (`pflab`)

Rename `pflab` → `<slug>lab` per product. The **single source of physics/algorithm truth**; `frontend/` and
`app/` consume it, never re-implement it. Its own venv: **`.venv-pipeline`** (heavy SOTA engines, local-only).

## Layout (the package lives directly under `data-pipeline/`)
- `pflab/pipeline.py` — orchestrator + CLI (`python -m pflab.pipeline [all|<case>] [--seed N]`)
- `pflab/registry.py` — cases grouped by CATEGORY · `pflab/live.py` — Pyodide live entrypoint
- `pflab/io/` — `contract.py` (**CONTRACT 1**) · `formats.py` (standard readers/writers) · `schema.py` (types)
- `pflab/core/` — `rng.py` (seeded determinism) · `trace.py` · `manifest.py` (**CONTRACT 2**) · `gate.py`
- `pflab/model/` — the shared pure-Python core (Pyodide-safe); EXAMPLE = SIR
- `pflab/stages/` — `preprocess → feature_extraction → train → infer → evaluate → export`
- `pflab/cases/` — documented cases

Setup + run: `scripts/setup.{sh,ps1}` then `scripts/precompute.{sh,ps1}`. See
[../docs/architecture/05_precompute-pipeline.md](../docs/architecture/05_precompute-pipeline.md).
