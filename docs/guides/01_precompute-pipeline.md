# Guide, run the precompute / retrain lane

The committed artifacts (`data/derived/`) are everything the site needs, so most of the time you only run the **light**
lane. You run the **heavy** lane when you change the engine, the cases, or want to retrain the learned models.

## Light lane (numpy only, no torch, no Node)

```bash
python -m venv .venv-pipeline
.venv-pipeline/Scripts/pip install -r data-pipeline/requirements.txt -r requirements-dev.txt -e .
.venv-pipeline/Scripts/python -m pflab.pipeline all        # reshape case-results.json → traces + manifests
.venv-pipeline/Scripts/python scripts/check_artifacts.py   # CONTRACT 2 OK
```

This is what CI and `deploy-pages` run, it is fast and deterministic (a re-run is byte-identical).

## Heavy lane (`--retrain`, re-bake the solver + train the learned models)

```bash
python -m venv .venv-precompute
.venv-precompute/Scripts/pip install -r data-pipeline/requirements-precompute.txt   # numpy + torch + onnx
# Node + tsx must be available (cd frontend && npm ci) for the bake/gen_train steps
.venv-pipeline/Scripts/python -m pflab.pipeline all --retrain
```

`--retrain` runs, in order: `bake_cases.mjs` (the exact UPL + Whittle shells over every case → `case-results.json`),
`gen_train.mjs` (the training tables → `data/raw/`, git-ignored), `train_pit.py` (torch → `grade-nn.onnx` +
`pit-surrogate.onnx` + `pit-learned.json`), then the light reshape. Commit only the small ONNX + JSON, never the
`.venv-precompute` or `data/raw/` (both git-ignored; CI guards reject venvs/heavy data).
