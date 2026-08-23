#!/usr/bin/env python3
"""Every architecture diagram must be bilingual, and say so deliberately.

ADR-0058 diagrams are inlined into the Architecture modal, which is fully bilingual. The diagrams
were not: a Spanish UI opened onto English pictures. ONE file now carries both languages, tagged
`l-en` and `l-es` at the same coordinates, and the shell stylesheet shows exactly one.

Two files per diagram was the obvious alternative and is the wrong one. It makes two things to keep
in step, and the one that is not on screen is the one that goes stale. This repository spent a whole
session fixing exactly that failure in its published numbers.

What this gate enforces:

  1. every `<text>` carries `l-en`, `l-es`, or `l-neutral`. Silence is not allowed: a label that
     needs no translation must SAY it needs none, so that forgetting to translate cannot look the
     same as deciding not to;
  2. every `l-en` has an `l-es` at the same (x, y), and the other way round, so a pair cannot be
     half-added or land in the wrong place;
  3. the Spanish string differs from the English one. A copy-paste that never got translated is the
     most likely way this rots, and it is invisible on screen unless you read both.

What it CANNOT check is whether the Spanish text still fits inside its box. Spanish runs longer than
English, so that is measured in a real browser by the architecture bounds gate.
"""
from __future__ import annotations

import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
SVG_DIR = ROOT / "frontend" / "public" / "svg" / "tech"

TEXT_RE = re.compile(r"<text\b([^>]*)>(.*?)</text>", re.S)
CLASS_RE = re.compile(r'class="([^"]*)"')
X_RE = re.compile(r'\bx="([^"]*)"')
Y_RE = re.compile(r'\by="([^"]*)"')


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

    svgs = sorted(SVG_DIR.glob("*.svg"))
    if not svgs:
        print(f"no architecture diagrams found under {SVG_DIR.relative_to(ROOT)}")
        return 1

    errors: list[str] = []
    pairs = neutral = 0

    for svg in svgs:
        rel = svg.relative_to(ROOT).as_posix()
        body = svg.read_text(encoding="utf-8")
        en: dict[tuple[str, str], str] = {}
        es: dict[tuple[str, str], str] = {}

        for attrs, inner in TEXT_RE.findall(body):
            classes = (CLASS_RE.search(attrs).group(1).split() if CLASS_RE.search(attrs) else [])
            xm, ym = X_RE.search(attrs), Y_RE.search(attrs)
            pos = (xm.group(1) if xm else "?", ym.group(1) if ym else "?")
            label = " ".join(inner.split())[:60]

            tags = [c for c in classes if c in ("l-en", "l-es", "l-neutral")]
            if len(tags) != 1:
                errors.append(
                    f"{rel}: <text> at {pos} carries {tags or 'no language tag'}; it needs exactly "
                    f"one of l-en / l-es / l-neutral  ({label!r})"
                )
                continue
            if tags[0] == "l-neutral":
                neutral += 1
            elif tags[0] == "l-en":
                en[pos] = inner
            else:
                es[pos] = inner

        for pos, text in en.items():
            if pos not in es:
                errors.append(f"{rel}: English text at {pos} has no Spanish counterpart at the same point"
                              f"  ({' '.join(text.split())[:60]!r})")
            elif " ".join(es[pos].split()) == " ".join(text.split()):
                errors.append(f"{rel}: the Spanish text at {pos} is identical to the English; if that is "
                              f"intentional the node is l-neutral  ({' '.join(text.split())[:60]!r})")
            else:
                pairs += 1
        for pos, text in es.items():
            if pos not in en:
                errors.append(f"{rel}: Spanish text at {pos} has no English counterpart at the same point"
                              f"  ({' '.join(text.split())[:60]!r})")

    if errors:
        print("ARCHITECTURE DIAGRAM i18n FAILED:")
        for e in errors[:60]:
            print(f"  - {e}")
        if len(errors) > 60:
            print(f"  ... and {len(errors) - 60} more")
        return 1

    print(f"architecture diagrams bilingual: {len(svgs)} files, {pairs} translated pairs, "
          f"{neutral} deliberately language-neutral")
    return 0


if __name__ == "__main__":
    sys.exit(main())
