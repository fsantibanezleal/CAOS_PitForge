# data-pipeline/, the offline engine (`pipeline`)

The two data contracts + the staged pipeline + the lane gate. **The optimiser itself is NOT here**, it is the
TypeScript engine in [`frontend/src/opt/`](../frontend/src/opt/), run live in the browser and from Node in the bake
(no Python re-port). `pipeline` orchestrates the bake, applies the contracts, and reshapes the committed outputs into
replay traces.

## Two venvs

- **`.venv-pipeline`** (`requirements.txt`, numpy-only), the default light lane + CI + the contract checks.
- **`.venv-precompute`** (`requirements-precompute.txt`, + torch + onnx), the heavy `--retrain` lane (local only).

## Layout (the package lives directly under `data-pipeline/`)

- `pipeline/pipeline.py`, orchestrator + CLI (`python data-pipeline/run.py [all|<case>] [--retrain]`)
- `pipeline/registry.py`, cases grouped by CATEGORY · `pipeline/live.py`, dormant (the live lane is TypeScript)
- `pipeline/io/`, `contract.py` (**CONTRACT 1**: scenario + block-model ingestion) · `formats.py` · `schema.py`
- `pipeline/core/`, `rng.py` · `trace.py` · `manifest.py` (**CONTRACT 2**) · `gate.py` (live/precompute gate)
- `pipeline/model/`, `learned.py` (the 2 learned models' feature contracts, the source of truth the SPA reproduces)
- `pipeline/stages/export.py`, the executable light-lane trace/manifest export
- `pipeline/science/`, the explicit TypeScript bake/table generators and Python ONNX trainer
- `pipeline/science/`, `bake_cases.mjs` · `gen_train.mjs` (Node + tsx, the SAME TS engine) · `train_pit.py` (torch → ONNX)

## The default lane is light

`python data-pipeline/run.py all` reshapes the committed `data/derived/case-results.json` + `pit-learned.json` into
per-case traces + manifests, numpy only, no torch, no Node. `--retrain` regenerates the heavy artifacts (bake →
gen_train → train_pit). See [the precompute guide](../docs/guides/01_precompute-pipeline.md).
