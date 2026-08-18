#!/usr/bin/env python3
"""Gate the artifacts that carry PitForge's headline public claims.

Why this exists
---------------
An 11-dimension audit (2026-08-18) found that every externally published headline number for
this product was a generation stale: the app never drifted, because the app loads its numbers
from JSON, while the README, docs, manuscript and the external surfaces drifted, because they
type them. Two artifacts carry those numbers and were covered by NO gate at all:

  data/derived/cpit-schedule.json   the 3.81% published-scenario gap and the 11.29% twin
  data/derived/minelib-results.json the three reproduced MineLib optima and their rel errors

Deleting both left `check_artifacts.py` printing "CONTRACT 2 OK ... closed inventory verified"
and exiting 0. This script closes that hole, and additionally reconciles the prose figures in
README.md against the artifact values, so a number cannot drift from its source with a green
build. It needs no MineLib data on disk: it reads only committed artifacts.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DERIVED = ROOT / "data" / "derived"

# The oracle tolerance the public surfaces claim.
REL_ERROR_CLAIM = 2e-9

errors: list[str] = []
notes: list[str] = []


def load(name: str) -> dict:
    p = DERIVED / name
    if not p.exists():
        errors.append(f"MISSING headline artifact: {p.relative_to(ROOT)}")
        return {}
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        errors.append(f"UNPARSEABLE {p.relative_to(ROOT)}: {exc}")
        return {}


def check_cpit(doc: dict) -> None:
    if not doc:
        return
    cases = doc.get("cases") or {}
    if "newman1" not in cases:
        errors.append(
            "cpit-schedule.json has no `newman1` case. The published-scenario result (3.81%) is "
            "the figure the README, the app and the technical report lead with; a twin-only "
            "artifact must never be published."
        )
        return
    nm = cases["newman1"]
    scenario = nm.get("scenario") or {}
    if scenario.get("kind") != "minelib-published":
        errors.append(
            f"newman1.scenario.kind is {scenario.get('kind')!r}, expected 'minelib-published'. "
            "A self-authored scenario must not be presented as the published one."
        )
    if not scenario.get("comparableToPublishedMineLibCpit"):
        errors.append("newman1 is not flagged comparableToPublishedMineLibCpit.")
    gap = nm.get("boundToFeasibleGapPct")
    if gap is None:
        errors.append("newman1 has no boundToFeasibleGapPct.")
    else:
        notes.append(f"newman1 published-scenario gap = {gap:.4f}%")

    twin = cases.get("twin-porphyry-s") or {}
    tsc = twin.get("scenario") or {}
    if twin and tsc.get("comparableToPublishedMineLibCpit") is not False:
        errors.append(
            "twin-porphyry-s must be explicitly flagged comparableToPublishedMineLibCpit=false; "
            "mixing it with the published scenario is the exact error this gate exists to stop."
        )
    if twin.get("boundToFeasibleGapPct") is not None:
        notes.append(f"twin gap = {twin['boundToFeasibleGapPct']:.4f}% (non-comparable)")


def check_minelib(doc: dict) -> None:
    if not doc:
        return
    results = doc.get("results") or []
    if not results:
        errors.append("minelib-results.json has no results.")
        return
    for r in results:
        rid = r.get("id", "?")
        if not r.get("match"):
            errors.append(f"minelib {rid}: match is not true.")
        rel = r.get("relError")
        if rel is None:
            errors.append(f"minelib {rid}: no relError recorded.")
        elif rel > REL_ERROR_CLAIM:
            errors.append(
                f"minelib {rid}: relError {rel:.3e} exceeds the {REL_ERROR_CLAIM:.0e} the public "
                "surfaces claim. Either the engine regressed or the claim must change."
            )
        else:
            notes.append(f"minelib {rid}: relError {rel:.3e} <= {REL_ERROR_CLAIM:.0e}")
    excluded = doc.get("excluded") or []
    notes.append(f"excluded instances declared: {len(excluded)} ({', '.join(e.get('id','?') for e in excluded)})")


def check_readme_matches_artifacts(cpit: dict, minelib: dict) -> None:
    """The prose must not drift from the artifact it quotes."""
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    cases = cpit.get("cases") or {}
    for case_id, label in (("newman1", "published"), ("twin-porphyry-s", "twin")):
        c = cases.get(case_id) or {}
        gap = c.get("boundToFeasibleGapPct")
        if gap is None:
            continue
        expected = f"{gap:.2f}%"
        if expected not in readme:
            errors.append(
                f"README.md does not contain the {label} gap {expected} from cpit-schedule.json "
                f"({case_id}). A published figure must be derivable from its artifact."
            )
        else:
            notes.append(f"README quotes {label} gap {expected}: OK")
    # excluded-instance count must match
    n_excl = len(minelib.get("excluded") or [])
    if n_excl:
        m = re.search(r"(\d+)\s+instances?\s+excluded", readme)
        if m and int(m.group(1)) != n_excl:
            errors.append(
                f"README says {m.group(1)} instances excluded; the artifact declares {n_excl}."
            )


def main() -> int:
    cpit = load("cpit-schedule.json")
    minelib = load("minelib-results.json")
    check_cpit(cpit)
    check_minelib(minelib)
    if cpit and minelib:
        check_readme_matches_artifacts(cpit, minelib)

    for n in notes:
        print(f"  . {n}")
    if errors:
        print("\nHEADLINE ARTIFACT GATE: FAIL")
        for e in errors:
            print(f"  - {e}")
        return 1
    print("\nHEADLINE ARTIFACT GATE OK: both artifacts present, internally consistent, "
          "and the README figures match them.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
