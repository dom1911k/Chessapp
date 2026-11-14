"""Converts a Maia-3 checkpoint to ONNX for the app (onnxruntime-web) and checks it.

Maia-3 (CSSLab, "Chessformer", ICLR 2026) predicts the move a human of a given
rating would play. Code: https://github.com/CSSLab/maia3 (AGPL-3.0); weights on
Hugging Face (UofTCSSLab/Maia3-5M, UofTCSSLab/Maia3-23M).

This script imports the model code from a local clone of that repo (it is not
copied here), loads the checkpoint with weights_only=True, and exports:

  inputs   tokens    float32 [B, 64, 96]  8 positions x 12 piece planes per square,
                                          oldest first; each position is seen from its
                                          own side to move (black to move: mirrored),
                                          padded with the oldest when the game is short
           self_elo  float32 [B]          rating of the player to move
           oppo_elo  float32 [B]          rating of the opponent
  outputs  move      float32 [B, 4352]    logits: 64x64 from-to (side-to-move view)
                                          + 256 promotions (a7a8q ... h7h8n)
           value     float32 [B, 3]       loss/draw/win logits for the player to move
           ponder    float32 [B]          predicted think time (model units)

With --fp16 the weights are stored as float16 and cast back to float32 when the
model loads (half the download; the maths stays float32, which is what the wasm
backend runs fastest anyway).
--check N compares ONNX against PyTorch on N positions from sampled games.

Usage:
  python scripts/maia3/convert.py --repo <maia3 clone> --checkpoint maia3-5m.pt \\
      --size maia3-5m --out public/maia3/maia3-5m.onnx [--fp16] [--check 200]
"""
import argparse, math, os, random, sys, time
from types import SimpleNamespace

import numpy as np
import torch
import torch.nn as nn


def load(repo, size, checkpoint):
    sys.path.insert(0, repo)
    from maia3.models import MAIA3Model  # noqa: E402
    from maia3.model_registry import MODEL_SPECS  # noqa: E402

    spec = next(s for s in MODEL_SPECS if s.name == size)
    cfg = SimpleNamespace(**spec.config)
    model = MAIA3Model(cfg)
    ckpt = torch.load(checkpoint, map_location="cpu", weights_only=True)
    sd = ckpt["model_state_dict"] if isinstance(ckpt, dict) and "model_state_dict" in ckpt else ckpt
    sd = {k.replace("smolgen", "gab"): v for k, v in sd.items()}
    missing, unexpected = model.load_state_dict(sd, strict=False)
    # The rpe buffer is rebuilt by the code; anything else missing is a real problem.
    missing = [k for k in missing if "rpe_factorizer" not in k]
    if missing or unexpected:
        raise SystemExit(f"checkpoint mismatch: missing={missing[:5]} unexpected={unexpected[:5]}")
    model.eval()
    return model, cfg


class SimpleRMSNorm(nn.Module):
    """RMSNorm written out with basic ops (exports to any opset)."""

    def __init__(self, src):
        super().__init__()
        self.weight = src.weight
        self.eps = src.eps if src.eps is not None else torch.finfo(torch.float32).eps

    def forward(self, x):
        return x * torch.rsqrt(x.pow(2).mean(-1, keepdim=True) + self.eps) * self.weight


def patch_rmsnorm(module):
    for name, child in module.named_children():
        if isinstance(child, nn.RMSNorm):
            setattr(module, name, SimpleRMSNorm(child))
        else:
            patch_rmsnorm(child)


class Wrapper(nn.Module):
    def __init__(self, model):
        super().__init__()
        self.model = model

    def forward(self, tokens, self_elo, oppo_elo):
        return self.model(tokens, self_elo, oppo_elo)


def export(model, out, fp16):
    w = Wrapper(model)
    tokens = torch.zeros(1, 64, 96)
    elo = torch.tensor([1500.0])
    tmp = out + ".fp32.onnx" if fp16 else out
    torch.onnx.export(
        w, (tokens, elo, elo), tmp,
        input_names=["tokens", "self_elo", "oppo_elo"],
        output_names=["move", "value", "ponder"],
        dynamic_axes={"tokens": {0: "b"}, "self_elo": {0: "b"}, "oppo_elo": {0: "b"}, "move": {0: "b"}, "value": {0: "b"}, "ponder": {0: "b"}},
        opset_version=17,
        dynamo=False,
    )
    import onnx
    m = onnx.load(tmp)
    if fp16:
        weights_to_fp16(m)
        onnx.save(m, out)
        os.remove(tmp)
    else:
        onnx.save(m, out)
    return out


def weights_to_fp16(m, min_size=256):
    """Store large float32 initializers as float16, each followed by a Cast back to float32."""
    import onnx
    from onnx import helper, numpy_helper, TensorProto
    g = m.graph
    casts = []
    for init in list(g.initializer):
        if init.data_type != TensorProto.FLOAT:
            continue
        arr = numpy_helper.to_array(init)
        if arr.size < min_size:
            continue
        half = numpy_helper.from_array(arr.astype(np.float16), init.name + "__fp16")
        g.initializer.remove(init)
        g.initializer.append(half)
        casts.append(helper.make_node("Cast", [half.name], [init.name], to=TensorProto.FLOAT, name=init.name + "__cast"))
    for i, c in enumerate(casts):
        g.node.insert(i, c)
    onnx.checker.check_model(m)


# ---- positions and encoding (mirrors maia3/dataset.py) -------------------------------------

def tokens_for(history_boards):
    import chess
    planes = []
    for b in history_boards:
        # Like maia3/dataset.py: every position is seen from its own side to move.
        bb = b.mirror() if b.turn == chess.BLACK else b
        t = np.zeros((64, 12), np.float32)
        for sq, p in bb.piece_map().items():
            t[sq][p.piece_type - 1 + (6 if p.color == chess.BLACK else 0)] = 1
        planes.append(t)
    while len(planes) < 8:
        planes.insert(0, planes[0])
    return np.concatenate(planes[-8:], axis=1)


def move_index():
    names = []
    for r in range(8):
        for f in range(8):
            for tr in range(8):
                for tf in range(8):
                    names.append("abcdefgh"[f] + str(r + 1) + "abcdefgh"[tf] + str(tr + 1))
    for ff in "abcdefgh":
        for tf in "abcdefgh":
            for p in "qrbn":
                names.append(f"{ff}7{tf}8{p}")
    return {n: i for i, n in enumerate(names)}


def mirror_uci(u):
    return u[0] + str(9 - int(u[1])) + u[2] + str(9 - int(u[3])) + u[4:]


def legal_idx(board, idx):
    import chess
    out = []
    for m in board.legal_moves:
        u = m.uci() if board.turn == chess.WHITE else mirror_uci(m.uci())
        out.append(idx[u])
    return out


def sample_positions(model, n, seed=1):
    """Positions from games the model plays against itself at assorted ratings."""
    import chess
    rnd = random.Random(seed)
    idx = move_index()
    inv = {v: k for k, v in idx.items()}
    out = []
    while len(out) < n:
        board = chess.Board()
        hist = [board.copy()]
        elo_w, elo_b = rnd.choice([600, 900, 1200, 1500, 1900]), rnd.choice([600, 900, 1200, 1500, 1900])
        for ply in range(rnd.randint(10, 90)):
            if board.is_game_over():
                break
            se, oe = (elo_w, elo_b) if board.turn == chess.WHITE else (elo_b, elo_w)
            tok = tokens_for(hist)
            with torch.no_grad():
                logits = model(torch.from_numpy(tok)[None], torch.tensor([float(se)]), torch.tensor([float(oe)]))[0][0].numpy()
            li = legal_idx(board, idx)
            if ply % 7 == 3:
                out.append((tok, float(se), float(oe), li))
            p = np.exp(logits[li] - logits[li].max())
            p /= p.sum()
            u = inv[li[int(np.searchsorted(np.cumsum(p), rnd.random()))]]
            if board.turn == chess.BLACK:
                u = mirror_uci(u)
            board.push(chess.Move.from_uci(u))
            hist.append(board.copy())
            hist = hist[-8:]
    return out[:n]


def check(model, onnx_path, n):
    import onnxruntime as ort
    sess = ort.InferenceSession(onnx_path, providers=["CPUExecutionProvider"])
    pos = sample_positions(model, n)
    top1 = 0
    kls, maxd, vd = [], 0.0, 0.0
    for tok, se, oe, li in pos:
        with torch.no_grad():
            tm, tv, _ = model(torch.from_numpy(tok)[None], torch.tensor([se]), torch.tensor([oe]))
        om, ov, _ = sess.run(None, {"tokens": tok[None], "self_elo": np.array([se], np.float32), "oppo_elo": np.array([oe], np.float32)})
        a = tm[0].numpy()[li]
        b = om[0][li]
        pa = np.exp(a - a.max()); pa /= pa.sum()
        pb = np.exp(b - b.max()); pb /= pb.sum()
        kls.append(float(np.sum(pa * (np.log(pa + 1e-12) - np.log(pb + 1e-12)))))
        top1 += int(np.argmax(a) == np.argmax(b))
        maxd = max(maxd, float(np.max(np.abs(pa - pb))))
        vd = max(vd, float(np.max(np.abs(torch.softmax(tv[0], -1).numpy() - np.exp(ov[0]) / np.exp(ov[0]).sum()))))
    print(f"check {os.path.basename(onnx_path)} on {len(pos)} positions: top-1 agreement {top1}/{len(pos)}, "
          f"mean KL {np.mean(kls):.2e}, max KL {np.max(kls):.2e}, max |dp| {maxd:.4f}, max |d wdl| {vd:.4f}")
    return top1 / len(pos), float(np.max(kls))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", required=True, help="local clone of github.com/CSSLab/maia3")
    ap.add_argument("--checkpoint", required=True)
    ap.add_argument("--size", default="maia3-5m", choices=["maia3-5m", "maia3-23m"])
    ap.add_argument("--out", required=True)
    ap.add_argument("--fp16", action="store_true")
    ap.add_argument("--check", type=int, default=0)
    a = ap.parse_args()
    model, cfg = load(a.repo, a.size, a.checkpoint)
    print(f"{a.size}: {sum(p.numel() for p in model.parameters()) / 1e6:.1f}M parameters, history {cfg.history}")
    reference = load(a.repo, a.size, a.checkpoint)[0]  # unpatched, for the check
    patch_rmsnorm(model)
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    t = time.time()
    export(model, a.out, a.fp16)
    print(f"wrote {a.out} ({os.path.getsize(a.out) / 1e6:.1f} MB) in {time.time() - t:.0f}s")
    if a.check:
        check(reference, a.out, a.check)


if __name__ == "__main__":
    main()
