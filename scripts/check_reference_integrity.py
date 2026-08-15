#!/usr/bin/env python3
"""Fail-closed scientific reference, licensing, and CPIT artifact guard.

This check is network-free by design. Primary-source facts are encoded once as explicit constants and checked
against every committed product surface that must carry them. It complements numerical unit tests by preventing
license wording, scenario definitions, gap denominators, citation metadata, and artifact controls from drifting.
"""
from __future__ import annotations

import json
import math
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOI = "10.5281/zenodo.21519687"
MINE_LIB_LICENSE = "https://creativecommons.org/licenses/by-sa/3.0/"
PUBLISHED_BOUND = 24_486_184.0
PUBLISHED_FEASIBLE = 23_483_671.0


def read(relative: str) -> str:
    """Read a required UTF-8 repository file."""
    return (ROOT / relative).read_text(encoding="utf-8")


def tracked_files() -> list[str]:
    """Return tracked and non-ignored candidate paths using Git's null-delimited format."""
    result = subprocess.run(
        ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
        cwd=ROOT, check=True, capture_output=True,
    )
    return [item.decode("utf-8") for item in result.stdout.split(b"\0") if item]


def require(condition: bool, message: str, errors: list[str]) -> None:
    """Collect a readable guard error without stopping the remaining audit."""
    if not condition:
        errors.append(message)


def close(actual: float, expected: float, relative: float = 1e-9) -> bool:
    """Compare published numeric facts at a stated relative tolerance."""
    return math.isclose(actual, expected, rel_tol=relative, abs_tol=1e-6)


def check() -> list[str]:
    """Return every detected reference-integrity error."""
    errors: list[str] = []
    paths = tracked_files()
    texts: dict[str, str] = {}
    text_suffixes = {".md", ".py", ".ts", ".tsx", ".js", ".mjs", ".json", ".tex", ".html", ".cff"}
    for path in paths:
        if path == "scripts/check_reference_integrity.py":
            continue
        if Path(path).suffix.lower() in text_suffixes:
            try:
                texts[path] = read(path)
            except UnicodeDecodeError:
                continue

    false_claims = {
        "academic-download grant": "MineLib is CC BY-SA; an academic-download-only grant is false",
        "academic-only": "MineLib is not academic-only",
        "academic purpose only": "MineLib is not limited to academic purposes",
        "the same cut Hochbaum": "tied exact optima need not return identical cuts",
        "same one Hochbaum": "tied exact optima need not return identical cuts",
        "Transactions of the Canadian Institute of Mining and Metallurgy": "use the verified CIM Bulletin venue",
    }
    for path, content in texts.items():
        folded = content.casefold()
        for phrase, reason in false_claims.items():
            if phrase.casefold() in folded:
                errors.append(f"{path}: forbidden claim {phrase!r}; {reason}")

    require(not any(".minelib-cache" in path for path in paths),
            "MineLib source cache is tracked; it must remain a local project-policy cache", errors)

    for path in ("README.md", "CITATION.cff", "frontend/index.html", "frontend/src/pages/Introduction.tsx"):
        require(DOI in texts.get(path, ""), f"{path}: missing canonical concept DOI {DOI}", errors)
    for path in ("ATTRIBUTION.md", "LICENSES.md", "frontend/src/main.tsx"):
        require("CC BY-SA 3.0 Unported" in texts.get(path, ""),
                f"{path}: missing exact MineLib license name", errors)
    for path in ("ATTRIBUTION.md", "LICENSES.md"):
        require(MINE_LIB_LICENSE in texts.get(path, ""),
                f"{path}: missing canonical CC BY-SA license URL", errors)
        require("https://github.com/fsantibanezleal/CAOS_OreBlocks" in texts.get(path, ""),
                f"{path}: missing oreblocks generator attribution", errors)
        require("0.1.0" in texts.get(path, "") and "MIT" in texts.get(path, ""),
                f"{path}: missing oreblocks version or license", errors)

    citations = texts.get("frontend/src/data/citations.ts", "")
    for citation_id in ("hochbaum2000", "chiles2012", "virtanen2020"):
        require(f"id: '{citation_id}'" in citations, f"citations.ts: missing {citation_id}", errors)
    for path in ("ATTRIBUTION.md", "frontend/src/data/citations.ts", "manuscripts/ultimate-pit/tex/main.tex"):
        require("CIM Bulletin" in texts.get(path, ""), f"{path}: Lerchs-Grossmann venue is not canonical", errors)

    minelib = json.loads(read("data/derived/minelib-results.json"))
    require("CC BY-SA 3.0 Unported" in minelib.get("license", ""),
            "minelib-results.json: stale or incorrect license", errors)

    artifact = json.loads(read("data/derived/cpit-schedule.json"))
    require(artifact.get("schema") == "pitforge.cpit-schedule/v2", "CPIT artifact must use schema v2", errors)
    cases = artifact.get("cases", {})
    require(set(cases) == {"twin-porphyry-s", "newman1"}, "CPIT artifact must contain exactly twin and newman1", errors)
    if "newman1" in cases:
        newman = cases["newman1"]
        scenario = newman.get("scenario", {})
        require(scenario.get("kind") == "minelib-published", "newman1 must be labeled published MineLib", errors)
        require(scenario.get("comparableToPublishedMineLibCpit") is True,
                "newman1 must be comparable to the published CPIT scenario", errors)
        require(newman.get("periods") == 6, "newman1 must use 6 published periods", errors)
        require(close(float(newman.get("discountRatePerPeriod", -1)), 0.08),
                "newman1 must use the published 8% discount rate", errors)
        require(len(newman.get("resourceConstraints", [])) == 2,
                "newman1 must preserve both published resource constraints", errors)
        require("periodOfBlock" not in newman, "newman1 must not commit a per-block MineLib schedule", errors)
        provenance = newman.get("provenance", {})
        require(provenance.get("kind") == "minelib" and provenance.get("licenseUrl") == MINE_LIB_LICENSE,
                "newman1 artifact must carry complete MineLib licensing provenance", errors)
        require(provenance.get("citationDoi") == "10.1007/s10479-012-1258-3",
                "newman1 artifact must carry the MineLib citation DOI", errors)
        require(str(provenance.get("scenarioUrl", "")).endswith("/newman1/newman1.cpit"),
                "newman1 artifact must link the published scenario bytes", errors)
        comparison = newman.get("publishedComparison", {})
        require(close(float(comparison.get("mineLibLpUpperBoundNpv", -1)), PUBLISHED_BOUND),
                "newman1 published LP bound drift", errors)
        require(close(float(comparison.get("mineLibPublishedFeasibleNpv", -1)), PUBLISHED_FEASIBLE),
                "newman1 published feasible reference drift", errors)
        require(float(comparison.get("ourBoundRelativeError", 1)) <= 1e-6,
                "newman1 reproduced bound exceeds tolerance", errors)
        require(close(float(newman.get("certifiedBoundNpv", -1)), PUBLISHED_BOUND, relative=1e-6),
                "newman1 certified bound does not reproduce the published value", errors)
        _check_case_controls("newman1", newman, errors)
    if "twin-porphyry-s" in cases:
        twin = cases["twin-porphyry-s"]
        scenario = twin.get("scenario", {})
        require(scenario.get("kind") == "pitforge-authored", "twin scenario must be PitForge-authored", errors)
        require(scenario.get("comparableToPublishedMineLibCpit") is False,
                "twin must be explicitly non-comparable to published MineLib CPIT", errors)
        require(twin.get("periods") == 8 and close(float(twin.get("discountRatePerPeriod", -1)), 0.10),
                "twin scenario must remain 8 periods at 10% discount", errors)
        require(len(twin.get("resourceConstraints", [])) == 1,
                "twin scenario must retain its single authored movement constraint", errors)
        provenance = twin.get("provenance", {})
        require(provenance.get("generator") == "oreblocks" and provenance.get("generatorVersion") == "0.1.0",
                "twin artifact must carry oreblocks generator provenance", errors)
        require(provenance.get("license") == "MIT",
                "twin artifact must carry its MIT license", errors)
        _check_case_controls("twin-porphyry-s", twin, errors)

    scheduling = texts.get("docs/frameworks/04_scheduling.md", "")
    readme = texts.get("README.md", "")
    for expected in ("3.81%", "11.29%", "non-comparable"):
        require(expected in scheduling and expected in readme,
                f"README and scheduling framework must name {expected!r}", errors)
    return errors


def _check_case_controls(case_id: str, case: dict, errors: list[str]) -> None:
    """Validate fail-closed control flags and resource usage in one committed case."""
    controls = case.get("controls", {})
    for key in (
        "dualityMatch", "boundGeqFeasible", "resourceLimitsRespected",
        "precedenceRespected", "completeUltimatePit",
    ):
        require(controls.get(key) is True, f"{case_id}: control {key} did not pass", errors)
    require(abs(float(controls.get("dualityBoundVsUpl", math.inf))) <= 1e-4,
            f"{case_id}: zero-discount LP value drifted from the UPL value", errors)
    require(float(case.get("certifiedBoundNpv", -1)) >= float(case.get("feasibleHeuristicNpv", math.inf)),
            f"{case_id}: certified bound is below feasible NPV", errors)
    periods = case.get("perPeriod", [])
    for resource_index, resource in enumerate(case.get("resourceConstraints", [])):
        limits = resource.get("limits", [])
        require(len(limits) == len(periods), f"{case_id}: resource limit length drift", errors)
        for period_index, period in enumerate(periods):
            usage = period.get("resourceUsage", [])
            require(resource_index < len(usage), f"{case_id}: missing resource usage vector entry", errors)
            if resource_index < len(usage) and period_index < len(limits):
                require(float(usage[resource_index]) <= float(limits[period_index]) + 1e-6,
                        f"{case_id}: resource {resource_index} exceeds period {period_index + 1}", errors)


def main() -> int:
    """Print a concise guard result and return a CI-compatible status."""
    errors = check()
    if errors:
        print("REFERENCE INTEGRITY FAILED:")
        for error in errors:
            print(f"  - {error}")
        return 1
    print("REFERENCE INTEGRITY OK: licensing, citations, scenarios, comparisons, and controls verified.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
