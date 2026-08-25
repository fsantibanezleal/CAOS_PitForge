"""pipeline, PitForge's offline+light engine (ADR-0057). Open-pit mine design: an exact ultimate-pit limit
(Lerchs-Grossmann via min-cut/max-flow) + Whittle nested pit shells. The OPTIMISER itself is the TypeScript engine in
frontend/src/opt/ (it runs live in the browser AND in the offline Node bake, no Python re-port); this package is the
two data contracts, the staged pipeline, the lane gate, the manifest/trace, and the cases-by-category registry. The
default pipeline is numpy-light: it reshapes the committed case-results.json (baked by the TS solver) into per-case
replay traces + manifests. `--retrain` regenerates the learned models (torch to ONNX), see data-pipeline/pipeline/science/.
"""

# Read from the repo's VERSION file rather than restating it here. A second copy of a version is a
# second thing to forget, and this one stamps `engine_version` onto every baked artifact: measured
# before this change, the copy read '0.13.001' while the product was at '0.14.000'. PhaseFlow hit the
# same defect first and its note records the cost, a stale version "stamped 0.01.000 onto every
# artifact of the 0.02.000 bake, including the cache-busting query the frontend appends to each fetch".
import pathlib

__version__ = (
    (pathlib.Path(__file__).resolve().parents[2] / "VERSION").read_text(encoding="utf-8").strip()
)
