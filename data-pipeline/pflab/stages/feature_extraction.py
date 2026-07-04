"""Stage 2, feature_extraction (heavy lane): assemble the learned-model training tables, the inverse-distance grade
stencils (grade-nn) and the per-block pit-inclusion features (pit-surrogate). The feature contracts are the SINGLE
SOURCE OF TRUTH in pflab/model/learned.py, reproduced byte-for-byte by the in-browser inference. Built during
`pipeline.retrain` from the baked block models + the exact-solver labels."""
