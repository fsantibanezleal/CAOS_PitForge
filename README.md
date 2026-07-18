# PitForge, open-pit ultimate-pit limit & nested pit shells

[![CI](https://img.shields.io/github/actions/workflow/status/fsantibanezleal/CAOS_PitForge/ci.yml?branch=main&label=CI)](https://github.com/fsantibanezleal/CAOS_PitForge/actions)
[![License](https://img.shields.io/github/license/fsantibanezleal/CAOS_PitForge)](LICENSE)
[![Live demo](https://img.shields.io/badge/demo-live-2ea44f)](https://pitforge.fasl-work.com)

[![CI](https://github.com/fsantibanezleal/CAOS_PitForge/actions/workflows/ci.yml/badge.svg)](https://github.com/fsantibanezleal/CAOS_PitForge/actions)
**Live:** https://pitforge.fasl-work.com

PitForge solves the classic open-pit mine-design problem: given a block model with a per-block economic value, find
the set of blocks to extract that **maximises total value subject to slope constraints**, the **ultimate pit limit
(UPL)**, and its family of **nested pit shells** by revenue factor (the Whittle parameterisation, used for phase /
pushback design). The exact optimiser runs **live in the browser**; drag the revenue factor, price or slope and the
pit re-solves exactly, instantly.

This is a CAOS/Faena mining web-app instantiated on the **product-repo archetype** ([ADR-0057](docs/architecture/01_overview.md)).

## What it does

- **Exact ultimate pit**, the UPL is the maximum-weight closure of the block-precedence graph, solved as a
  **minimum cut / maximum flow** (Picard’s reduction; the same cut Hochbaum’s pseudoflow computes; Dinic engine).
  Transparent and self-checking (`pitValue = Σ positiveValue − maxflow` is asserted every solve).
- **Nested pit shells (Whittle)**, solving the UPL over an ascending revenue-factor schedule gives nested pits +
  the value / tonnage / strip-ratio curves, a guide for phase / pushback design.
- **Real MineLib lane**, 3 published instances (`newman1` live; `zuck_small` and `kd` behind an explicit size-gate)
  fetched at runtime from public mirrors (no instance bytes committed). The same exact solver reproduces the
  published UPIT optimum on all 3 (rel. err ≤ 2×10⁻⁹; `data/derived/minelib-results.json`). Scenario knobs are
  locked in real mode: the instances publish net values + explicit precedence, so re-deriving them would break
  comparability with the published optimum.
- **Two honest learned models**, a NN grade estimator (vs Ordinary Kriging / IDW) and a pit-inclusion surrogate
  (vs the exact solver), trained offline (torch → ONNX) and run **live** (onnxruntime-web). The exact optimiser is
  always the authority; these are fast approximations, measured against their classical baselines.
- **Bring your own block model**, Contract 1 validates a real block table `{ix,iy,iz,tonnage,density,grade}` +
  economics, with an explicit outlier policy, in-app (drag & drop a CSV onto the App's *Bring your own* tab; every
  tab then re-solves on your model) or via the Python lane.

## Honesty

The synthetic lane uses **generated** deposits (seeded grade fields with a geological trend + spatially-correlated
noise), no real drillholes there. The real lane uses **published data**: 3 MineLib instances fetched at runtime and
solved exactly, reproducing their published UPIT optima. The **optimiser is exact**. `CTRL` is a closed-form analytic
control (a single deep ore block gives the exact 9-block inverted pyramid, value 2). Every learned-model number is
held-out and reported next to its classical baseline, no fabricated wins (the learned models are trained on the
synthetic lane).

## Quickstart

```bash
# light lane (numpy only), rebuild the replay artifacts + run the checks
python -m venv .venv-pipeline && .venv-pipeline/Scripts/pip install -r data-pipeline/requirements.txt -r requirements-dev.txt -e .
.venv-pipeline/Scripts/python -m pflab.pipeline all      # 9 cases → traces + manifests
.venv-pipeline/Scripts/python scripts/check_artifacts.py # Contract 2 OK

# the SPA (the exact optimiser runs live in the browser)
cd frontend && npm ci && npm run dev                     # http://localhost:5173
npm test                                                 # 34 tests: engine · contracts · MineLib · infill

# heavy lane (local only), re-bake + retrain the learned models (torch → ONNX)
python -m venv .venv-precompute && .venv-precompute/Scripts/pip install -r data-pipeline/requirements-precompute.txt
.venv-pipeline/Scripts/python -m pflab.pipeline all --retrain
```

## Layout

See [STRUCTURE.md](STRUCTURE.md) and the navigable wiki in [docs/](docs/README.md). The science engine is the
TypeScript optimiser in [`frontend/src/opt/`](frontend/src/opt/) (it runs in the browser **and** in the offline Node
bake, no Python re-port); `data-pipeline/pflab/` is the two contracts + the staged pipeline + the lane gate.

## License

MIT, see [LICENSE](LICENSE). Third-party components in [LICENSES.md](LICENSES.md); attributions in
[ATTRIBUTION.md](ATTRIBUTION.md).
