"""Converts Maia (lc0) weight files to the small format the app loads.

Usage: python3 scripts/maia/convert.py <maia-XXXX.pb.gz>... <out-dir>
Weights: https://github.com/CSSLab/maia-chess (GPL-3.0). The network is an
lc0 SE-ResNet (6 blocks x 64 filters, convolutional policy head). Batch norm
is folded into the convolutions; everything is stored as little-endian
float16 in this order:

  input conv  W[64][112][3][3], b[64]
  6 x residual: conv1 W[64][64][3][3], b[64]; conv2 W, b;
                SE w1[8][64], b1[8], w2[128][8], b2[128]
  policy1     W[64][64][3][3], b[64]
  policy      W[80][64][3][3], b[80]
"""
import os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lc0pb import fields, layer, load


def conv_block(b):
    f = fields(b)
    W = layer(f[1][0])
    bias = layer(f[2][0]) if 2 in f else None
    means = layer(f[3][0]) if 3 in f else None
    var = layer(f[4][0]) if 4 in f else None
    gam = layer(f[5][0]) if 5 in f else None
    bet = layer(f[6][0]) if 6 in f else None
    out = len(means) if means is not None else len(bias)
    W = W.reshape(out, -1)
    if bias is None:
        bias = np.zeros(out, np.float32)
    if means is not None:
        g = (gam if gam is not None else np.ones(out)) / np.sqrt(var + 1e-5)
        W = W * g[:, None]
        bias = -g * (means - bias) + (bet if bet is not None else 0)
    return [W.astype(np.float32).ravel(), bias.astype(np.float32)]


def convert(src, dst):
    w = fields(load(src)[10][0])
    arrays = conv_block(w[1][0])
    assert len(w[2]) == 6
    for r in w[2]:
        rf = fields(r)
        se = fields(rf[3][0])
        arrays += conv_block(rf[1][0]) + conv_block(rf[2][0]) + [layer(se[k][0]) for k in (1, 2, 3, 4)]
    arrays += conv_block(w[11][0]) + conv_block(w[3][0])
    data = np.concatenate([a.ravel() for a in arrays]).astype('<f2')
    with open(dst, 'wb') as fh:
        fh.write(b'MAIA')
        fh.write(data.tobytes())
    return data.size


if __name__ == '__main__':
    *srcs, out = sys.argv[1:]
    for s in srcs:
        name = os.path.basename(s).replace('.pb.gz', '.bin')
        n = convert(s, os.path.join(out, name))
        print(name, n, 'weights')
