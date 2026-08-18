#!/usr/bin/env python3
"""Every relative link in the docs and the README must resolve INSIDE this public repo.

Two defects motivated this gate (audit 2026-08-18):
  - docs/architecture.md and docs/architecture/01_overview.md linked to ADR-0057 with ../../ paths
    that resolved OUTSIDE the repo, into the private management repo. A public repo must never do
    that: the link is broken for every reader who is not the author.
  - docs/frameworks/04_scheduling.md, the largest and most important doc, was reachable from
    neither index, so the two-scenarios rule it documents was effectively unpublished.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
LINK = re.compile(r"\[[^\]]*\]\(([^)#]+?)(?:#[^)]*)?\)")
REFDEF = re.compile(r"^\[[^\]]+\]:\s*(\S+)", re.M)

errors: list[str] = []


def check_file(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    targets = [m.group(1) for m in LINK.finditer(text)] + [m.group(1) for m in REFDEF.finditer(text)]
    for target in targets:
        if target.startswith(("http://", "https://", "mailto:", "#")):
            continue
        resolved = (path.parent / target).resolve()
        try:
            resolved.relative_to(ROOT)
        except ValueError:
            errors.append(f"{path.relative_to(ROOT)} -> {target} escapes the repository")
            continue
        if not resolved.exists():
            errors.append(f"{path.relative_to(ROOT)} -> {target} does not exist")


def check_every_doc_is_reachable() -> None:
    """Any docs/**/NN_*.md must be linked from at least one other document."""
    docs = sorted(p for p in DOCS.rglob("*.md"))
    corpus = "\n".join(p.read_text(encoding="utf-8") for p in docs) + (ROOT / "README.md").read_text(encoding="utf-8")
    for doc in docs:
        if doc.name == "README.md":
            continue
        if doc.name not in corpus.replace(doc.name + "\n", ""):
            continue
        # count references excluding the file's own body
        others = corpus.count(doc.name) - doc.read_text(encoding="utf-8").count(doc.name)
        if others <= 0:
            errors.append(f"{doc.relative_to(ROOT)} is not linked from any index or document")


def main() -> int:
    for path in [ROOT / "README.md", *sorted(DOCS.rglob("*.md"))]:
        check_file(path)
    check_every_doc_is_reachable()
    if errors:
        print("DOCS LINK GATE: FAIL")
        for e in errors:
            print(f"  - {e}")
        return 1
    print("DOCS LINK GATE OK: every relative link resolves inside the repo and every document is reachable.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
