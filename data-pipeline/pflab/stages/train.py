"""Stage 3 — train (OFFLINE, heavy lane): fit the two learned models on the baked tables — a NN grade estimator
(grade-nn) and an ultimate-pit inclusion classifier (pit-surrogate) — and export them to ONNX. Deterministic (seeded).
Delegates to `pflab/science/train_pit.py` (torch), invoked by `pipeline.retrain`; writes grade-nn.onnx,
pit-surrogate.onnx and the metrics pit-learned.json to data/derived/."""
