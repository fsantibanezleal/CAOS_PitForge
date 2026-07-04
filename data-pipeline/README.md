# data-pipeline/, the offline engine (`pflab`)

The two data contracts + the staged pipeline + the lane gate. **The optimiser itself is NOT here**, it is the
TypeScript engine in [`frontend/src/opt/`](../frontend/src/opt/), run live in the browser and from Node in the bake
(no Python re-port). `pflab` orchestrates the bake, applies the contracts, and reshapes the committed outputs into
replay traces.

## Two venvs

- **`.venv-pipeline`** (`requirements.txt`, numpy-only), the default light lane + CI + the contract checks.
- **`.venv-precompute`** (`requirements-precompute.txt`, + torch + onnx), the heavy `--retrain` lane (local only).

## Layout (the package lives directly under `data-pipeline/`)

- `pflab/pipeline.py`, orchestrator + CLI (`python -m pflab.pipeline [all|<case>] [--retrain]`)
- `pflab/registry.py`, cases grouped by CATEGORY · `pflab/live.py`, dormant (the live lane is TypeScript)
- `pflab/io/`, `contract.py` (**CONTRACT 1**: scenario + block-model ingestion) · `formats.py` · `schema.py`
- `pflab/core/`, `rng.py` · `trace.py` · `manifest.py` (**CONTRACT 2**) · `gate.py` (live/precompute gate)
- `pflab/model/`, `learned.py` (the 2 learned models' feature contracts, the source of truth the SPA reproduces)
- `pflab/stages/`, `preprocess → feature_extraction → train → infer → evaluate → export` (thin over the science)
- `pflab/science/`, `bake_cases.mjs` · `gen_train.mjs` (Node + tsx, the SAME TS engine) · `train_pit.py` (torch → ONNX)

## The default lane is light

`python -m pflab.pipeline all` reshapes the committed `data/derived/case-results.json` + `pit-learned.json` into
per-case traces + manifests, numpy only, no torch, no Node. `--retrain` regenerates the heavy artifacts (bake →
gen_train → train_pit). See [the precompute guide](../docs/guides/01_precompute-pipeline.md).
