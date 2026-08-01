"""Stage 5, evaluate (the TEST stage, heavy lane): the held-out metrics of the two learned models against their
classical baselines, grade-nn's cross-validated R² vs Ordinary Kriging / IDW, and pit-surrogate's AUC/accuracy vs the
EXACT solver labels (the surrogate is a fast approximation, never beats the exact min-cut). Leakage-safe by a by-block
spatial split. Metrics land in pit-learned.json; invoked by `pipeline.retrain`."""
