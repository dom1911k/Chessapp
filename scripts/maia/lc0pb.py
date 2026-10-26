# Minimal protobuf wire-format reader for lc0 weight files.
import gzip, struct, numpy as np

def varint(b, i):
    r = s = 0
    while True:
        c = b[i]; i += 1
        r |= (c & 0x7f) << s; s += 7
        if c < 0x80: return r, i

def fields(b):
    i = 0; out = {}
    while i < len(b):
        key, i = varint(b, i)
        f, wt = key >> 3, key & 7
        if wt == 0: v, i = varint(b, i)
        elif wt == 1: v = b[i:i+8]; i += 8
        elif wt == 5: v = b[i:i+4]; i += 4
        elif wt == 2:
            n, i = varint(b, i); v = b[i:i+n]; i += n
        else: raise ValueError(wt)
        out.setdefault(f, []).append(v)
    return out

def layer(b, default_enc=1):
    f = fields(b)
    mn = struct.unpack('<f', f[1][0])[0] if 1 in f else 0.0
    mx = struct.unpack('<f', f[2][0])[0] if 2 in f else 0.0
    p = f.get(3, [b''])[0]
    enc = f.get(4, [default_enc])[0]
    if enc == 1:
        q = np.frombuffer(p, dtype='<u2').astype(np.float64)
        return (mn + (mx - mn) * q / 65535.0).astype(np.float32)
    if enc == 2:
        return np.frombuffer(p, dtype='<f2').astype(np.float32)
    raise ValueError(enc)

def load(path):
    net = fields(gzip.open(path).read())
    return net
