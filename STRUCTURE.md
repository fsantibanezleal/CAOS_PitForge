# PitForge — repository structure

Instantiated from the CAOS product-repo archetype ([ADR-0057](docs/architecture/01_overview.md)). The **frozen base**
(layout, the two contracts, the staged pipeline, the lane gate, the manifest/trace, CI guards) is never re-litigated;
the **per-product surface** is the optimiser + the visualisations + the cases + content.

```
CAOS_PitForge/
├─ README.md · CHANGELOG.md · STRUCTURE.md · LICENSE · LICENSES.md · ATTRIBUTION.md
├─ pyproject.toml · .env.example · .gitignore · .gitattributes
├─ requirements.txt (dormant API) · requirements-dev.txt · data-pipeline/requirements*.txt
├─ scripts/            setup · precompute · smoke · dev (.sh + .ps1)
├─ data-pipeline/
│  └─ pflab/                          # the two contracts + the staged pipeline (the optimiser itself is TS, below)
│     ├─ __init__.py (version) · pipeline.py (orchestrator+CLI, numpy-light + --retrain) · registry.py
│     ├─ io/     contract.py (CONTRACT 1: scenario + block-model ingestion + outliers) · schema.py · formats.py
│     ├─ core/   gate.py (live/precompute gate) · trace.py + manifest.py (CONTRACT 2) · rng.py
│     ├─ model/  learned.py (the 2 learned models' feature contracts — the SOURCE OF TRUTH the SPA reproduces)
│     ├─ stages/ preprocess · feature_extraction · train · infer · evaluate · export (thin over the science)
│     ├─ science/  bake_cases.mjs · gen_train.mjs (Node+tsx, the SAME TS engine) · train_pit.py (torch → ONNX)
│     └─ live.py  (dormant — the live lane is TypeScript, not Pyodide)
├─ data/
│  ├─ examples/  scenarios.csv · blockmodel.csv (tiny committed CONTRACT-1 samples)
│  ├─ derived/   case-results.json + per-case <case>/trace.json + manifests/ + the ONNX + pit-learned.json  (committed)
│  └─ raw/       (git-ignored — regenerable training tables)
├─ frontend/
│  ├─ src/opt/    THE SCIENCE: maxflow · precedence · econ · ultimatepit · whittle · blockmodel · cases · index
│  ├─ src/pages/  Tool (App) · Introduction · Methodology · Implementation · Experiments · Benchmark
│  ├─ src/viz/    PitView3D (three.js) · SectionView · WhittleChart · LearnedPanel · Gauge · UPlotChart · colormap
│  ├─ src/lib/    contract.types.ts (CONTRACT 2 mirror) · artifacts.ts · ort.ts (onnxruntime-web)
│  ├─ test/       opt.test.ts (engine oracle) · contract.test.ts   (node:test + tsx)
│  └─ copy-data.mjs · vite.config.ts · package.json
├─ app/           (dormant FastAPI — activate only on an ADR-0002 trigger)
├─ deploy/        VPS/pages notes
├─ docs/          the navigable wiki (architecture · frameworks · cases · guides)
└─ .github/workflows/  ci.yml (python + frontend) · deploy-pages.yml
```

## The lanes

| Lane | Where | Deps |
|---|---|---|
| **Live (client)** | `frontend/src/opt/` (the exact optimiser) + onnxruntime-web | web npm |
| **Offline (precompute)** | `pflab/science/` (Node bake of the TS engine + torch training) | `requirements-precompute.txt` |
| **Replay (light)** | `pflab.pipeline` reshapes the committed bake → traces/manifests | `data-pipeline/requirements.txt` (numpy) |
| **API** | `app/` | dormant |
