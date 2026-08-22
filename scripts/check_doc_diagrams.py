#!/usr/bin/env python3
"""Every diagram under docs/ must survive a dark background, and must be referenced.

Why this gate exists. An SVG embedded through `<img src="x.svg">`, which is how GitHub renders a
diagram in markdown, is an ISOLATED document. `currentColor` inside it does not inherit the host
page's colour: it resolves against the SVG document's own `color`, whose initial value does not
follow the reader's colour scheme. So the common idiom

    <svg style="color:currentColor"> ... <text fill="currentColor">

resolves to pure black in BOTH schemes. Measured, not assumed: rendering such a file under an
emulated dark scheme reports `textFill=rgb(0, 0, 0)`, which on GitHub's #0d1117 README background
is very nearly invisible. A sibling repo's diagrams have this defect today.

Two mechanisms actually work, and this gate accepts either:

  * `color-scheme: light dark` on the root, which makes the initial colour follow the scheme;
  * a `@media (prefers-color-scheme: dark)` block that sets the ink explicitly.

The second is preferred here because it fixes the exact palette rather than accepting the
browser's black and white.
"""
from __future__ import annotations

import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

    svgs = sorted(DOCS.rglob("*.svg"))
    if not svgs:
        print("no diagrams under docs/ yet; nothing to check")
        return 0

    md_text = {p: p.read_text(encoding="utf-8", errors="replace") for p in DOCS.rglob("*.md")}
    errors: list[str] = []

    for svg in svgs:
        rel = svg.relative_to(ROOT).as_posix()
        text = svg.read_text(encoding="utf-8", errors="replace")

        adapts = "color-scheme" in text or "prefers-color-scheme" in text
        if not adapts:
            errors.append(
                f"{rel}: declares neither `color-scheme` nor a `prefers-color-scheme` block, so its "
                f"text resolves to black in BOTH schemes and disappears on a dark background"
            )

        if 'role="img"' not in text or "aria-label" not in text:
            errors.append(f"{rel}: missing role=\"img\" and/or aria-label, so it is unreadable to a screen reader")

        referenced = [md.relative_to(ROOT).as_posix()
                      for md, body in md_text.items() if svg.name in body]
        if not referenced:
            errors.append(f"{rel}: is not referenced from any document under docs/")

    if errors:
        print("DOC DIAGRAM CHECK FAILED:")
        for e in errors:
            print(f"  - {e}")
        return 1

    print(f"doc diagrams OK: {len(svgs)} checked, all theme-adaptive, labelled and referenced")
    return 0


if __name__ == "__main__":
    sys.exit(main())
