# Changelog

All notable changes to CAOS PitForge. Versions follow `X.XX.XXX` (display) — see `pflab.__version__` and
`frontend/package.json`. The project stays in `0.x` while the deposits are synthetic.

## [0.06.000] — 2026-06-21

First complete build of PitForge on the CAOS product-repo archetype (ADR-0057).

### Added
- **The exact ultimate-pit engine** (`frontend/src/opt/`) — a dependency-free TypeScript min-cut/max-flow solver
  (Dinic) implementing the Lerchs–Grossmann ultimate pit via Picard’s max-closure reduction, the slope-precedence
  cone, the floating-cutoff block-value model, and the Whittle nested-shell parameterisation. Runs **live in the
  browser** and in the offline Node bake (no Python re-port). Verified by a hand-computed inverted-pyramid oracle.
- **Two data contracts** — CONTRACT 1 (`io/contract.py`: scenario + real block-model ingestion with an outlier
  policy) and CONTRACT 2 (`core/manifest.py` `pitforge.manifest/v2` + `core/trace.py` `pitforge.trace/v1`), with a
  TS mirror (`frontend/src/lib/contract.types.ts`) that fails `tsc` on drift.
- **9 cases by category** (`cases/pit_cases.py`): 4 deposit archetypes, 2 economic scenarios, 2 slope scenarios,
  and the `CTRL` closed-form oracle, mirroring `frontend/src/opt/cases.ts`.
- **numpy-light pipeline** (`pflab.pipeline`) that reshapes the committed `case-results.json` (baked by the TS solver)
  into per-case replay traces + manifests; a two-language `--retrain` lane (Node bake → torch train → ONNX).
- **The frontend SPA** — the 6 standard pages (App · Introduction · Methodology · Implementation · Experiments ·
  Benchmark) on the shared `@fasl-work/caos-app-shell`. The App re-solves the exact pit live as you drag RF / price /
  slope, with 11 reacting tabs (3-D voxel pit via three.js, vertical section, Whittle curves via uPlot, pushbacks,
  grade–tonnage, block-value histogram, the live learned-model panel, contract·gate, bring-your-own, raw trace).
- **Two honest learned models** (torch → ONNX, live via onnxruntime-web): a grade-NN estimator (vs IDW + Ordinary
  Kriging, held-out R²) and a pit-inclusion surrogate (vs the exact solver, AUC/accuracy). Held-out: grade-NN
  R² 0.999 (vs IDW 0.936 / OK 0.991); pit-surrogate AUC 0.984 / acc 0.919 (vs majority 0.757).
- The `docs/` wiki (ADR-0056), CI (`ci.yml` Python + frontend) + `deploy-pages.yml`, the cross-platform `scripts/`,
  the two-venv split, and the root `README` / `STRUCTURE` / `LICENSES` / `ATTRIBUTION`.

### Verified running
ruff clean · pytest 9/9 · `pflab.pipeline all` (9 cases) · CONTRACT 2 OK · byte-identical re-run · npm test 9/9
(engine 5 + contract 4) · `npm run build` green.
