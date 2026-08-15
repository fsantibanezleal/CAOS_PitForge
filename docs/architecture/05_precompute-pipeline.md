# The precompute pipeline (two-language)

PitForge’s offline lane is **two-language** (like ChancaDEM / DispatchLab): the heavy science is the same TypeScript
engine the browser runs, driven from Node via `tsx`; Python only orchestrates + reshapes. This avoids ever
re-implementing the optimiser in Python.

## The executable programs

| Program | What |
|---|---|
| `science/bake_cases.mjs` | generate deposits and bake exact UPL + Whittle shells into `case-results.json` |
| `science/gen_train.mjs` | assemble grouped learned-model training tables |
| `science/train_pit.py` | leave-one-geology-out evaluation, fit both models, and export ONNX + metrics |
| `frontend/scripts/benchmark-cases.mjs` | refresh reviewed per-case runtime evidence for the lane gate |
| `pipeline/stages/export.py` | build each compact trace, measured gate verdict, and manifest |
| `pipeline/pipeline.py` | validate all cases, stage the complete tree, publish it, and remove orphans |

## The two lanes of `pipeline.pipeline`

```bash
python data-pipeline/run.py all              # light (numpy): reshape the committed case-results.json → traces + manifests
python data-pipeline/run.py all --retrain    # heavy: bake → gen_train → train_pit, then reshape
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
