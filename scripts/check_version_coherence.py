"""Fail when any release or Contract-2 version source diverges from the frontend package version."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    product = json.loads((ROOT / "frontend" / "package.json").read_text(encoding="utf-8"))["version"]
    errors: list[str] = []
    init_text = (ROOT / "data-pipeline" / "pipeline" / "__init__.py").read_text(encoding="utf-8")
    match = re.search(r'^__version__\s*=\s*"([^"]+)"', init_text, re.MULTILINE)
    if not match or match.group(1) != product:
        errors.append(f"pipeline version={match.group(1) if match else None!r}, product={product!r}")
    shell_text = (ROOT / "frontend" / "src" / "main.tsx").read_text(encoding="utf-8")
    shell_match = re.search(r"\bversion:\s*'([^']+)'", shell_text)
    if not shell_match or shell_match.group(1) != product:
        errors.append(f"shell version={shell_match.group(1) if shell_match else None!r}, product={product!r}")
    changelog = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
    if not re.search(rf"^## \[{re.escape(product)}\]", changelog, re.MULTILINE):
        errors.append(f"CHANGELOG has no release heading for {product}")
    manifests = ROOT / "data" / "derived" / "manifests"
    index = json.loads((manifests / "index.json").read_text(encoding="utf-8"))
    if index.get("engine_version") != product:
        errors.append(f"index engine_version={index.get('engine_version')!r}, product={product!r}")
    for path in manifests.glob("*.json"):
        if path.name == "index.json":
            continue
        manifest = json.loads(path.read_text(encoding="utf-8"))
        if manifest.get("engine", {}).get("version") != product:
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
