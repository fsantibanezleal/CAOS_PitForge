"""Fail when any release or Contract-2 version source diverges from the frontend package version."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def norm(value: str | None) -> str | None:
    """Normalise a version for COMPARISON across the padded and semver spellings.

    conventions/versioning.md splits the two deliberately: the manifest holds the semver form with
    leading zeros dropped (0.13.1, because semver forbids leading zeros in a numeric identifier),
    while the CHANGELOG, the git tag, the VERSION file and the in-app string hold the padded display
    form (0.13.001). They are the same version. This gate previously compared them as raw strings,
    which made the two rules mutually unsatisfiable: it could only pass with an INVALID semver in
    package.json. Compare them normalised instead, so both spellings are accepted and a genuine
    divergence (0.13.1 vs 0.14.0) still fails.
    """
    if value is None:
        return None
    parts = value.strip().lstrip("v").split(".")
    try:
        return ".".join(str(int(part)) for part in parts)
    except ValueError:
        return value.strip()


def main() -> int:
    product = json.loads((ROOT / "frontend" / "package.json").read_text(encoding="utf-8"))["version"]
    errors: list[str] = []
    version_file = ROOT / "VERSION"
    if not version_file.is_file():
        errors.append("VERSION file missing (conventions/versioning.md: no repo may be silently un-versioned)")
    elif norm(version_file.read_text(encoding="utf-8")) != norm(product):
        errors.append(f"VERSION={version_file.read_text(encoding='utf-8').strip()!r}, product={product!r}")
    init_text = (ROOT / "data-pipeline" / "pipeline" / "__init__.py").read_text(encoding="utf-8")
    match = re.search(r'^__version__\s*=\s*"([^"]+)"', init_text, re.MULTILINE)
    if not match or norm(match.group(1)) != norm(product):
        errors.append(f"pipeline version={match.group(1) if match else None!r}, product={product!r}")
    shell_text = (ROOT / "frontend" / "src" / "main.tsx").read_text(encoding="utf-8")
    shell_match = re.search(r"\bversion:\s*'([^']+)'", shell_text)
    if not shell_match or norm(shell_match.group(1)) != norm(product):
        errors.append(f"shell version={shell_match.group(1) if shell_match else None!r}, product={product!r}")
    changelog = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
    headings = re.findall(r"^## \[([^\]]+)\]", changelog, re.MULTILINE)
    if not any(norm(heading) == norm(product) for heading in headings):
        errors.append(f"CHANGELOG has no release heading matching {product} (padded or semver)")
    manifests = ROOT / "data" / "derived" / "manifests"
    index = json.loads((manifests / "index.json").read_text(encoding="utf-8"))
    if norm(index.get("engine_version")) != norm(product):
        errors.append(f"index engine_version={index.get('engine_version')!r}, product={product!r}")
    for path in manifests.glob("*.json"):
        if path.name == "index.json":
            continue
        manifest = json.loads(path.read_text(encoding="utf-8"))
        if norm(manifest.get("engine", {}).get("version")) != norm(product):
            errors.append(f"{path.name}: engine version={manifest.get('engine', {}).get('version')!r}")
    if errors:
        print("VERSION DRIFT:")
        for error in errors:
            print("  -", error)
        return 1
    print(f"VERSION OK: {product} across package, shell, pipeline, changelog, index, and manifests")
    return 0


if __name__ == "__main__":
    sys.exit(main())
