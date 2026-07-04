"""Generate the synthetic MineLib-format twins committed under frontend/public/twins/ (#34).

These are OUR data (the oreblocks package generates a seeded deposit, solves the EXACT ultimate
pit, and writes .blocks/.prec/.upit with the optimum STAMPED in the meta sidecar). No MineLib
license applies, so unlike the published instances they are committed and served locally. Run:

    pip install oreblocks
    python frontend/scripts/gen-twins.py frontend/public/twins

The registry (src/opt/realCases.ts) pins each twin's nBlocks/nPrecs/stampedOptimum; the TS engine
reproduces the stamped optimum to rel ~3e-11 (guarded by test/minelib.test.ts + realcases.test.ts).
"""

import sys, json
from pathlib import Path
from oreblocks import make_twin
OUT = Path(sys.argv[1])
OUT.mkdir(parents=True, exist_ok=True)
# a small varied set of synthetic MineLib-format twins with stamped exact optima (license-free)
TWINS = [
    ("twin-porphyry-s", "porphyry", (16, 16, 8), 7),
    ("twin-vein-m",     "vein",     (20, 20, 10), 3),
    ("twin-corehalo-m", "core_halo",(22, 22, 10), 11),
]
manifest = []
for name, arch, dims, seed in TWINS:
    t = make_twin(arch, dims, seed=seed, name=name)
    t.write(OUT)
    manifest.append({
        "id": name, "name": f"{arch} twin {dims[0]}x{dims[1]}x{dims[2]}",
        "archetype": arch, "nBlocks": t.deposit.grid.n_blocks, "nPrecs": t.precedence.n_arcs,
        "stampedOptimum": round(t.upit.pit_value, 3), "nInPit": t.upit.n_in_pit,
        "blocksLayout": {"grade": 4, "tonnage": 5, "density": 6},
    })
    print(f"  {name}: {t.deposit.grid.n_blocks} blocks, {t.precedence.n_arcs} arcs, optimum {t.upit.pit_value:.3f} ({t.upit.n_in_pit} in pit)")
(OUT / "twins-manifest.json").write_text(json.dumps({"schema":"pitforge.twins/v1","twins":manifest}, indent=2)+"\n", encoding="utf-8")
print(f"wrote {len(TWINS)} twins + manifest -> {OUT}")
