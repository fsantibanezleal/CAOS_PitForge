# Third-party licenses

PitForge itself is MIT ([LICENSE](LICENSE)). It builds on these components, each under its own license.

## Runtime (frontend)

| Component | License | Use |
|---|---|---|
| [`@fasl-work/caos-app-shell`](https://www.npmjs.com/package/@fasl-work/caos-app-shell) | MIT | shared header/nav/theme/lang chrome + doc-kit |
| [React](https://react.dev) + react-dom | MIT | UI |
| [react-router-dom](https://reactrouter.com) | MIT | routing |
| [three.js](https://threejs.org) | MIT | the 3-D voxel pit viewer |
| [µPlot](https://github.com/leeoniya/uPlot) | MIT | the Whittle / interactive charts |
| [onnxruntime-web](https://onnxruntime.ai) | MIT | live in-browser inference of the learned models |
| [KaTeX](https://katex.org) | MIT | equation rendering in the doc pages |
| [lucide-react](https://lucide.dev) | ISC | icons |

## Offline / build

| Component | License | Use |
|---|---|---|
| [NumPy](https://numpy.org) | BSD-3-Clause | the light pipeline |
| [SciPy](https://scipy.org) | BSD-3-Clause | offline CPIT LP relaxation through HiGHS |
| [oreblocks](https://github.com/fsantibanezleal/CAOS_OreBlocks) 0.1.0 | MIT | generated the committed fixed-seed synthetic MineLib-format twins through `make_twin` |
| [PyTorch](https://pytorch.org) | BSD-3-Clause | training the learned models (`--retrain`, local only) |
| [ONNX](https://onnx.ai) | Apache-2.0 | model export/validation |
| [Vite](https://vitejs.dev) + [tsx](https://github.com/privatenumber/tsx) + [TypeScript](https://www.typescriptlang.org) | MIT / Apache-2.0 | build + the Node bake |
| [ruff](https://docs.astral.sh/ruff/) + [pytest](https://pytest.org) | MIT | lint + test |

## Data and publications

| Asset | License | Use |
|---|---|---|
| [MineLib](https://doi.org/10.1007/s10479-012-1258-3) instances | [CC BY-SA 3.0 Unported](https://creativecommons.org/licenses/by-sa/3.0/) | real-instance exact-UPIT and published-CPIT validation; source files are fetched into a gitignored cache and only attributed aggregates are committed by project policy |
| PitForge synthetic deposits and oreblocks-generated twins | MIT | fixed-seed built-in cases and replay artifacts; generator attribution is above |
| PitForge technical report | CC BY 4.0 | published report at concept DOI 10.5281/zenodo.21519687 |

Keeping MineLib source instances out of git is an engineering policy, not a restriction imposed by the CC
BY-SA license. Attribution and share-alike obligations apply whenever the licensed data is shared or adapted.
