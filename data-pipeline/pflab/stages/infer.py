"""Stage 4, infer (heavy lane): run the exact ultimate-pit + Whittle nested shells over every case through the same
TS solver the browser runs (frontend/src/opt/, via tsx) and bake the deterministic per-case outputs to
data/derived/case-results.json. The learned models are exercised via onnxruntime in the offline mirror of the
in-browser path. Delegates to `pflab/science/bake_cases.mjs`, invoked by `pipeline.retrain`."""
