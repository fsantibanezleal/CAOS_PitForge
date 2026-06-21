"""Feature contracts for the two learned models (the SINGLE SOURCE OF TRUTH shared by the offline trainer
science/train_pit.py and the in-browser inference). Both are honest, value-adding ML competing with a classical
baseline — NOT bolted-on AE/CNN. They are trained OFFLINE (torch → ONNX) and run LIVE (onnxruntime-web). The EXACT
optimiser remains the headline; these are fast approximations measured against their baselines.

1. grade-nn — a neural grade ESTIMATOR. Input: the local neighbourhood of drillhole/sample grades (an inverse-distance
   stencil) → output: the block grade. Benchmarked vs Ordinary Kriging / IDW (cross-validated R²). The honest claim is
   "ML interpolation competitive with geostatistics", never "beats kriging".

2. pit-surrogate — an ultimate-pit INCLUSION classifier. Input: per-block features {normalised depth, block value,
   mean neighbourhood value, distance-to-surface} → output: P(block ∈ optimal pit). Trained on the EXACT pseudoflow
   labels; benchmarked vs the exact solver as ground truth (AUC/accuracy). Gives an instant "likely-in-pit" heatmap
   before the exact solve; the exact min-cut is always the authority.
"""
from __future__ import annotations

# grade-nn: an (2k+1)^3 inverse-distance stencil of neighbouring sample grades, flattened. k = STENCIL_RADIUS.
STENCIL_RADIUS = 1
GRADE_NN_INPUT = (2 * STENCIL_RADIUS + 1) ** 3          # 27 neighbours
GRADE_NN_INPUT_NAME = "x"
GRADE_NN_OUTPUT_NAME = "y"

# pit-surrogate: 4 per-block features (see above), all standardised.
PIT_SURROGATE_FEATURES = ("depth_frac", "block_value_std", "neighbourhood_value_std", "dist_to_surface_frac")
PIT_SURROGATE_INPUT = len(PIT_SURROGATE_FEATURES)
PIT_SURROGATE_INPUT_NAME = "x"
PIT_SURROGATE_OUTPUT_NAME = "p"
