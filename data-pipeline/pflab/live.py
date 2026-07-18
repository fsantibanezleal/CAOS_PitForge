"""Live-lane note (dormant). Unlike the SIR template, PitForge's live lane is not Pyodide-Python, the optimiser runs
in the browser as the TypeScript engine in frontend/src/opt/ (the same code the offline bake runs via tsx), and the
two learned models run via onnxruntime-web. There is therefore no Python live entrypoint; the offline pipeline below
(pflab.pipeline) only reshapes the committed solver outputs into replay traces. This module is kept as the documented
placeholder so the archetype's lane map stays explicit (offline / live / replay)."""
from __future__ import annotations

LIVE_LANE = "typescript"  # frontend/src/opt/ + onnxruntime-web, not Pyodide
