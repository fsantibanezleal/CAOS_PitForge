"""pflab Ã¢â‚¬â€ PitForge's offline+light engine (ADR-0057). Open-pit mine design: an exact ultimate-pit limit
(LerchsÃ¢â‚¬â€œGrossmann via min-cut/max-flow) + Whittle nested pit shells. The OPTIMISER itself is the TypeScript engine in
frontend/src/opt/ (it runs live in the browser AND in the offline Node bake Ã¢â‚¬â€ no Python re-port); this package is the
two data contracts, the staged pipeline, the lane gate, the manifest/trace, and the cases-by-category registry. The
default pipeline is numpy-light: it reshapes the committed case-results.json (baked by the TS solver) into per-case
replay traces + manifests. `--retrain` regenerates the learned models (torch Ã¢â€ â€™ ONNX) Ã¢â‚¬â€ see data-pipeline/pflab/science/.
"""

__version__ = "0.07.001"  # display X.XX.XXX; PEP 440 form in pyproject.toml (0.7.0)
