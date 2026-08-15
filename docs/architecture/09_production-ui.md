# Production UI contract

PitForge is an instrument, not a document wrapped around a chart. The App route therefore gives its remaining
viewport height to one workbench scroll owner, `.page-body.pf-layout`. Documentation routes retain one page-level
scroll owner. No route may hide vertical content behind the fixed shell, and no viewport may acquire horizontal
document overflow.

## Responsive navigation and focus mode

At desktop widths the workbench exposes six compact view groups with keyboard-operable menus. At phone widths a
native grouped selector replaces those menus and keeps every analysis view reachable with a 44 px touch target.
The focus route deliberately omits the shared shell, preserves the 3-D stage, and gives its control rail the only
vertical scroll on narrow or short screens. Its return link and all exact-solve controls remain visible or
scroll-reachable.

The validated viewport matrix is 390x844 phone, 768x1024 tablet, 1280x720 laptop, 640x360 as the responsive
equivalent of a 1280x720 viewport at 200% browser zoom, 932x430 short landscape, and 1600x900 desktop. A separate
390x667 check covers the focus route, and a keyboard contract covers the grouped desktop menus.

## Accessible visualization

Interactive charts are keyboard focusable and publish a localized text summary. Arrow keys pan, plus and minus
zoom, Home resets, the mouse wheel zooms, and double-click resets. Dense bar views expose an expandable data
table, so exact values do not depend on color, pointer precision, or canvas inspection. The application updates
the document language and title when the visible locale changes. Both light and dark themes are checked for
serious or critical automated accessibility violations.

Automated accessibility is a regression floor, not a claim of complete conformance. Release review still includes
keyboard traversal, focus visibility, zoom, and screen-reader spot checks.

## Degraded capabilities

Optional rendering and data lanes must fail inside their panel instead of blanking the product:

- absent or lost WebGL produces an explicit 3-D fallback and a Retry control;
- artifact fetch or contract failure names the invalid state and offers a bounded retry;
- empty result sets render an empty-state explanation;
- lazy 3-D and learned-model panels render localized loading status;
- ONNX JavaScript and WASM are copied from the pinned npm package and served from the app origin. Runtime model
  loading never depends on a third-party CDN.

The exact optimizer and the surrounding controls remain usable when an optional visualization fails.

## Verification

`npm test` validates the numerical engines and artifact contracts. `npm run build` performs TypeScript checking
and creates the production bundle. `npm run test:e2e` starts the real Vite application and uses Playwright with
Chromium plus axe-core to validate the viewport matrix, navigation reachability, one-scroll-owner rule,
localization, both themes, accessible output, keyboard navigation, WebGL degradation, artifact failure, focus mode,
200% responsive zoom equivalence, and long prose routes. CI installs a pinned Playwright browser before running
the same suite.

The ONNX runtime files and Playwright reports are generated locally or in CI and are ignored; only source,
lockfile, and deterministic scientific artifacts belong in the public repository.
