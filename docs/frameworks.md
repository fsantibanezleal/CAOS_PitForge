# Frameworks

The research-chosen methods + libraries PitForge actually uses (each one is used by the code, not aspirational).

- [01, the optimiser](frameworks/01_optimiser.md), max-closure → min-cut/max-flow (Lerchs–Grossmann / pseudoflow /
  Dinic) + the Whittle nested-shell parameterisation.
- [02, the visualisation stack](frameworks/02_viz.md), three.js (the 3-D voxel pit) + µPlot (the Whittle curves) +
  the shared `@fasl-work/caos-app-shell`.
- [03, the learned models](frameworks/03_torch-onnx.md), torch training → ONNX → onnxruntime-web live inference.
