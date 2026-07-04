# Framework, the visualisation stack

PitForge uses one library per data type (per the CAOS interactive-visualisation rubric), all theme-aware and
interactive.

| Library | Where | What it draws |
|---|---|---|
| **three.js** (`viz/PitView3D.tsx`) | the App’s 3-D tab | the orebody as voxels (InstancedMesh, one draw call for ~7 000 blocks), coloured by grade (viridis); the extracted pit / orebody / shell modes; orbit controls; z increases downward so the pit opens from the surface. Lazy-chunked off the main bundle. |
| **µPlot** (`viz/UPlotChart.tsx`, `WhittleChart.tsx`) | Whittle curves | value + ore tonnage vs revenue factor, with the current RF marked; wheel/drag zoom + a crosshair value readout; click to set RF. |
| **canvas** (`viz/SectionView.tsx`) | the cross-section + the live surrogate | a vertical section of the model; cells coloured by grade / shell / P(in-pit); the pit outlined; hover reads the block out. |
| **`@fasl-work/caos-app-shell`** | the whole app | the shared header/nav/theme/language chrome + the doc-kit (Tabs, Callout, Equation/KaTeX, Figure, Cite). This is what makes every Faena app a visual sibling. |

Every panel **reacts to the case selector** and the live solve; aggregate/cross-case views (the case comparison
table, the economic/slope sensitivity) live in **Benchmark/Experiments**, never in the App (per the design rule).
Colours follow the theme tokens (light + dark), the 3-D background, the section colours and the chart strokes are
all read from the CSS palette so they flip with the theme.
