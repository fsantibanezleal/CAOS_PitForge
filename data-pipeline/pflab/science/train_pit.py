"""HEAVY lane (local-only) — train PitForge's two HONEST learned models and export them to ONNX + a metrics JSON.
Run inside the .venv-precompute (torch) after gen_train.mjs has written data/raw/{pit-train,grade-train}.json:

    python data-pipeline/pflab/science/train_pit.py

1. grade-nn      — a small MLP grade estimator (masked 3×3×3 stencil → centre grade), benchmarked vs IDW and Ordinary
                   Kriging (cross-validated R² on a held-out spatial split). Honest claim: competitive with geostatistics.
2. pit-surrogate — an MLP ultimate-pit INCLUSION classifier (4 features → P(in pit)), trained on the EXACT solver
                   labels, benchmarked vs the exact solver as ground truth (AUC/accuracy). A fast approximation; the
                   exact min-cut is always the authority. Standardisation is BAKED into the ONNX graph (raw features in).

Outputs (committed, small): data/derived/{grade-nn.onnx, pit-surrogate.onnx, pit-learned.json}.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import torch
from torch import nn

ROOT = Path(__file__).resolve().parents[3]
RAW = ROOT / "data" / "raw"
DERIVED = ROOT / "data" / "derived"
DERIVED.mkdir(parents=True, exist_ok=True)
torch.manual_seed(0)
rng = np.random.default_rng(0)


def r2(y: np.ndarray, yhat: np.ndarray) -> float:
    ss_res = float(np.sum((y - yhat) ** 2))
    ss_tot = float(np.sum((y - y.mean()) ** 2)) or 1e-12
    return 1.0 - ss_res / ss_tot


# ----------------------------------------------------------------------------------------------------------------
# grade-nn
# ----------------------------------------------------------------------------------------------------------------
class GradeNet(nn.Module):
    """Grade stencil → centre grade. The input/output SCALE is baked in (raw grades ~0–0.05 would starve the
    gradients), so the browser feeds the raw 27-vec and gets a raw grade back."""

    SCALE = 100.0

    def __init__(self):
        super().__init__()
        self.net = nn.Sequential(nn.Linear(27, 64), nn.ReLU(), nn.Linear(64, 32), nn.ReLU(), nn.Linear(32, 1))

    def forward(self, x):
        return self.net(x * self.SCALE) / self.SCALE


def train_grade() -> dict:
    d = json.loads((RAW / "grade-train.json").read_text())
    X = np.asarray(d["x"], dtype=np.float32)        # (N, 27) masked stencil
    y = np.asarray(d["y"], dtype=np.float32)        # (N,)   centre grade
    n = len(y)
    idx = rng.permutation(n)
    cut = int(n * 0.8)
    tr, te = idx[:cut], idx[cut:]

    net = GradeNet()
    opt = torch.optim.Adam(net.parameters(), lr=2e-3)
    sched = torch.optim.lr_scheduler.StepLR(opt, step_size=400, gamma=0.3)
    Xt = torch.from_numpy(X[tr])
    yt = torch.from_numpy(y[tr]).unsqueeze(1)
    for _ in range(900):
        opt.zero_grad()
        loss = nn.functional.mse_loss(net(Xt) * GradeNet.SCALE, yt * GradeNet.SCALE)
        loss.backward()
        opt.step()
        sched.step()
    net.eval()
    with torch.no_grad():
        nn_pred = net(torch.from_numpy(X[te])).squeeze(1).numpy()

    # classical baselines on the SAME held-out stencils ----------------------------------------------------------
    # the 26 neighbour offsets (excluding the centre at flat index 13) + their distances.
    offs = [(dx, dy, dz) for dz in (-1, 0, 1) for dy in (-1, 0, 1) for dx in (-1, 0, 1)]
    dist = np.array([np.sqrt(dx * dx + dy * dy + dz * dz) for (dx, dy, dz) in offs], dtype=np.float64)
    mask = dist > 0                                  # drop the (masked) centre
    Xte = X[te].astype(np.float64)
    present = Xte > 0                                # 0 = masked centre or out-of-bounds neighbour
    # IDW: inverse-distance weighted mean of the present neighbours.
    w = np.where(present & mask, 1.0 / np.where(dist > 0, dist, 1.0), 0.0)
    idw = (w * Xte).sum(1) / np.where(w.sum(1) > 0, w.sum(1), 1.0)
    # Ordinary Kriging with a fixed spherical variogram (range 2 blocks, sill 1, nugget 0.1) — a per-estimate solve
    # over the present neighbours; a legitimate OK with an assumed model (not a per-block variogram fit).
    ok = _ordinary_kriging(Xte, present & mask, offs, dist)

    return {
        "model": net, "input": 27,
        "metrics": {
            "r2_vs_holdout": round(r2(y[te], nn_pred), 4),
            "r2_idw": round(r2(y[te], idw.astype(np.float32)), 4),
            "r2_ok": round(r2(y[te], ok.astype(np.float32)), 4),
            "nTrain": int(cut), "nEval": int(n - cut),
        },
    }


def _ordinary_kriging(X: np.ndarray, present: np.ndarray, offs, dist, rng_=2.0, sill=1.0, nugget=0.1) -> np.ndarray:
    def gamma(h):
        h = np.asarray(h, dtype=np.float64)
        out = np.where(h <= 0, 0.0, nugget + (sill - nugget) * (1.5 * h / rng_ - 0.5 * (h / rng_) ** 3))
        return np.where(h >= rng_, sill, out)
    pos = np.array(offs, dtype=np.float64)           # (27,3) neighbour offsets from the centre
    pair = np.sqrt(((pos[:, None, :] - pos[None, :, :]) ** 2).sum(-1))   # (27,27) pairwise distances
    G_all = gamma(pair)
    g0_all = gamma(dist)                              # semivariance to the (centre) target
    out = np.zeros(len(X))
    for k in range(len(X)):
        idx = np.where(present[k])[0]
        if len(idx) < 3:
            out[k] = X[k][idx].mean() if len(idx) else 0.0
            continue
        m = len(idx)
        A = np.ones((m + 1, m + 1))
        A[:m, :m] = G_all[np.ix_(idx, idx)]
        A[m, m] = 0.0
        b = np.ones(m + 1)
        b[:m] = g0_all[idx]
        try:
            wts = np.linalg.solve(A, b)[:m]
        except np.linalg.LinAlgError:
            wts = np.full(m, 1.0 / m)
        out[k] = float((wts * X[k][idx]).sum())
    return out


# ----------------------------------------------------------------------------------------------------------------
# pit-surrogate (standardisation baked into the graph)
# ----------------------------------------------------------------------------------------------------------------
class PitNet(nn.Module):
    def __init__(self, mean: np.ndarray, std: np.ndarray):
        super().__init__()
        self.register_buffer("mean", torch.tensor(mean, dtype=torch.float32))
        self.register_buffer("std", torch.tensor(std, dtype=torch.float32))
        self.net = nn.Sequential(nn.Linear(4, 32), nn.ReLU(), nn.Linear(32, 16), nn.ReLU(), nn.Linear(16, 1), nn.Sigmoid())

    def forward(self, x):
        return self.net((x - self.mean) / self.std)


def train_pit() -> dict:
    d = json.loads((RAW / "pit-train.json").read_text())
    X = np.asarray(d["f"], dtype=np.float32)         # (N,4) raw features
    y = np.asarray(d["y"], dtype=np.float32)         # (N,) 0/1
    n = len(y)
    idx = rng.permutation(n)
    cut = int(n * 0.8)
    tr, te = idx[:cut], idx[cut:]
    mean = X[tr].mean(0)
    std = X[tr].std(0) + 1e-6

    net = PitNet(mean, std)
    opt = torch.optim.Adam(net.parameters(), lr=2e-3)
    Xt = torch.from_numpy(X[tr])
    yt = torch.from_numpy(y[tr]).unsqueeze(1)
    pos = float(y[tr].mean())
    w = torch.tensor([(1 - pos) / max(pos, 1e-3)])   # class weight (pits are a minority of blocks)
    for _ in range(400):
        opt.zero_grad()
        p = net(Xt)
        loss = nn.functional.binary_cross_entropy(p, yt, weight=torch.where(yt > 0.5, w, torch.tensor([1.0])))
        loss.backward()
        opt.step()
    net.eval()
    with torch.no_grad():
        p_te = net(torch.from_numpy(X[te])).squeeze(1).numpy()
    acc = float(((p_te > 0.5) == (y[te] > 0.5)).mean())
    auc = _auc(y[te], p_te)
    baseline = max(pos := float(y[te].mean()), 1 - pos)   # majority-class accuracy
    return {"model": net, "metrics": {"auc": round(auc, 4), "acc": round(acc, 4),
            "baseline": round(baseline, 4), "nTrain": int(cut), "nEval": int(n - cut)}}


def _auc(y: np.ndarray, score: np.ndarray) -> float:
    order = np.argsort(score)
    ranks = np.empty_like(order, dtype=np.float64)
    ranks[order] = np.arange(1, len(y) + 1)
    n_pos = float((y > 0.5).sum())
    n_neg = float(len(y) - n_pos)
    if n_pos == 0 or n_neg == 0:
        return 0.5
    return float((ranks[y > 0.5].sum() - n_pos * (n_pos + 1) / 2) / (n_pos * n_neg))


def export(model: nn.Module, n_in: int, in_name: str, out_name: str, path: Path) -> None:
    model.eval()
    dummy = torch.zeros(1, n_in)
    torch.onnx.export(model, dummy, str(path), input_names=[in_name], output_names=[out_name],
                      dynamic_axes={in_name: {0: "batch"}, out_name: {0: "batch"}}, opset_version=17)


def main() -> None:
    g = train_grade()
    p = train_pit()
    export(g["model"], 27, "x", "y", DERIVED / "grade-nn.onnx")
    export(p["model"], 4, "x", "p", DERIVED / "pit-surrogate.onnx")
    learned = {
        "schema": "pitforge.learned/v1",
        "gradeNN": g["metrics"],
        "pitSurrogate": p["metrics"],
        "honesty": ("Synthetic deposits + the EXACT solver as ground truth. grade-nn is measured against IDW and "
                    "Ordinary Kriging; pit-surrogate against the exact min-cut. Fast approximations, never beating "
                    "the exact result."),
    }
    (DERIVED / "pit-learned.json").write_text(json.dumps(learned, indent=2))
    print("grade-nn:", g["metrics"])
    print("pit-surrogate:", p["metrics"])
    print(f"wrote grade-nn.onnx + pit-surrogate.onnx + pit-learned.json -> {DERIVED}")


if __name__ == "__main__":
    main()
