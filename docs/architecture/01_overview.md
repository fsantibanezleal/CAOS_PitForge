# Architecture, overview

PitForge is an instance of the **CAOS product-repo archetype** ([ADR-0057]): an offline-pipeline-heavy, backend-
optional product that deploys as a static, deterministic-replay viewer. The base is **frozen** (instantiated, never
re-litigated); per-product rework lives only in the **core**, the algorithm, the visualisations, the cases, content.

The distinctive thing about PitForge is that the **core algorithm is the live lane**: the exact ultimate-pit solver
is TypeScript that runs in the browser, so the App re-solves the pit exactly as you drag the sliders. There is no
"reduced" live model, the live optimiser IS the exact optimiser.

## The lanes (and what runs where)

| Lane | Where | Deps | Notes |
|---|---|---|---|
| **Live (client-side)** | `frontend/src/opt/` (the exact min-cut/Whittle solver) + onnxruntime-web | web npm | the interactive core; re-solves on every slider move |
| **Offline (precompute)** | `pflab/science/`, Node bake of the SAME TS engine + torch training | `data-pipeline/requirements-precompute.txt` | bakes `case-results.json` + the ONNX |
| **Replay (light)** | `pflab.pipeline` (numpy) | `data-pipeline/requirements.txt` | reshapes the committed bake → per-case traces + manifests |
| **API (backend)** | `app/` (FastAPI) | `requirements-api.txt` | DORMANT; activate only on an ADR-0002 trigger |

A measured **[gate](03_the-gate.md)** records the live-vs-replay verdict per case (at teaching scale every case is
LIVE).

## The flow

`block model (synthetic or yours)` → **[CONTRACT 1](08_data-contracts.md)** (`io/contract.py`) → the TS optimiser
(bake) → `case-results.json` → **[CONTRACT 2](08_data-contracts.md)** (`core/manifest.py` + `core/trace.py`, the
compact per-case trace) → `data/derived/` (committed) → the `frontend/` App replays it **and** re-solves it live.

## Frozen base vs rework

- **Frozen:** the folder layout, the two contracts, the staged pipeline names, the gate, the manifest/trace, the
  two-venv split, the cases-by-category mechanism, CI guards.
- **Rework (the only per-product surface):** the optimiser + science (`frontend/src/opt/` + the stage bodies), the
  `frontend/` visualisations, and the cases + content.

## What PitForge is and is NOT

- **Is:** an exact ultimate-pit + nested-shell teaching/analysis tool over synthetic block models, published MineLib
  instances (fetched at runtime, published optima reproduced) and user-uploaded block models (CONTRACT 1, in-app
  drag & drop), with two honest learned baselines.
- **Is NOT:** a production mine-planning package (no scheduling/haulage, no geotechnical wall-stability beyond the
  discrete slope cone). The synthetic deposits are seeded generated fields; the optimiser is exact.

[ADR-0057]: ../../../conventions/architecture/0-archetype/ADR-0057-product-repo-archetype.md
