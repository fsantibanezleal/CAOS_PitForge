# The precompute pipeline (two-language)

PitForge’s offline lane is **two-language** (like ChancaDEM / DispatchLab): the heavy science is the same TypeScript
engine the browser runs, driven from Node via `tsx`; Python only orchestrates + reshapes. This avoids ever
re-implementing the optimiser in Python.

## The named stages (`pflab/stages/`)

| Stage | What (heavy lane) |
|---|---|
| `preprocess` | generate the synthetic deposit block models (the TS generator) |
| `feature_extraction` | assemble the learned-model training tables (`science/gen_train.mjs`) |
| `train` | fit the 2 learned models → ONNX (`science/train_pit.py`, torch) |
| `infer` | bake the exact UPL + Whittle shells over every case (`science/bake_cases.mjs`) → `case-results.json` |
| `evaluate` | the held-out learned-model metrics vs their classical baselines |
| `export` | build the compact per-case trace + manifest (Contract 2), the light, numpy-only step |

## The two lanes of `pflab.pipeline`

```bash
python -m pflab.pipeline all              # light (numpy): reshape the committed case-results.json → traces + manifests
python -m pflab.pipeline all --retrain    # heavy: bake → gen_train → train_pit, then reshape
```

The **default is light**: the committed `data/derived/case-results.json` + `pit-learned.json` + the two `.onnx` are
the heavy lane’s real outputs, so CI, the contract checks and the replay never need torch or Node. `--retrain`
regenerates them (it needs the `.venv-precompute` with torch + Node `tsx`).

```
bake_cases.mjs ──► data/derived/case-results.json   (the exact pits + Whittle curves, per case)
gen_train.mjs  ──► data/raw/{pit-train,grade-train}.json   (git-ignored training tables)
train_pit.py   ──► data/derived/{grade-nn.onnx, pit-surrogate.onnx, pit-learned.json}
pipeline.export──► data/derived/<case>/trace.json + manifests/<case>.json + index.json   (Contract 2)
```

Determinism: the light pipeline is a pure function of the committed artifacts, re-running it is byte-identical (the
manifest carries no wall-clock; see [02](02_determinism-and-trace.md)).
