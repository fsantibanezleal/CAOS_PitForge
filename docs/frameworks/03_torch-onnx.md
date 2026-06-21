# Framework — the learned models (torch → ONNX → onnxruntime-web)

Two honest learned models, trained offline and run live. The exact optimiser is always the authority; these compete
with a **classical baseline**, never with the exact result.

## Training (`science/train_pit.py`, torch, `.venv-precompute`)

| Model | Architecture | Trained on | Baseline | Export |
|---|---|---|---|---|
| `grade-nn` | MLP 27→64→32→1 (input SCALE baked in) | masked 3×3×3 grade stencils (`gen_train.mjs`) | IDW + Ordinary Kriging (spherical variogram) | `grade-nn.onnx` (x → y) |
| `pit-surrogate` | MLP 4→32→16→1 + sigmoid (standardisation baked in) | per-block features + the EXACT in-pit labels | the exact min-cut (AUC/acc vs the labels) | `pit-surrogate.onnx` (x → p) |

The standardisation / scaling is **baked into the ONNX graph** as a fixed first layer, so the browser feeds RAW
features and the model normalises internally — no scaler-drift between Python and JS.

## Inference (`frontend/src/lib/ort.ts`, onnxruntime-web)

WASM execution provider, single-threaded (GitHub Pages has no COOP/COEP for threads); the npm package and the CDN
`wasmPaths` are pinned to the SAME version. The loader is **graceful** — if a model file is absent (not yet trained)
it resolves to `null` and the UI shows the honest "pending training" state instead of throwing. The pit-surrogate runs
**batched** over the current section in one `run()` call; the App reports its agreement with the exact pit.

## Honesty

Held-out numbers are reported next to the baseline (see [model evaluation](../architecture/06_model-evaluation.md)).
On the smooth synthetic fields the grade is highly predictable so all methods score high; the surrogate is a strong
fast approximation (AUC ≈ 0.98) but not the exact answer. No metric is computed on training data.
