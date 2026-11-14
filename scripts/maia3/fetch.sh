#!/usr/bin/env bash
# Builds the Maia-3 ONNX models the app loads (public/maia3/maia3-<size>.onnx, not committed).
# Downloads the pinned checkpoints from Hugging Face (checked by SHA-256), the pinned model code
# from github.com/CSSLab/maia3 (AGPL-3.0, used only to load the weights), and converts them
# with scripts/maia3/convert.py (float16 weights, checked against PyTorch).
#
# Usage: bash scripts/maia3/fetch.sh            (sizes: MAIA3_SIZES, default "23m"; "5m" also works)
# Needs python3 with venv; installs CPU PyTorch and onnx into .cache/maia3/venv.
set -euo pipefail
cd "$(dirname "$0")/../.."
SIZES="${MAIA3_SIZES:-23m}"
CACHE=.cache/maia3
OUT=public/maia3
CODE_REV=1e13597c42d4858b7cfd7cfdae01e297263364b2
declare -A HF_REPO=([5m]=UofTCSSLab/Maia3-5M [23m]=UofTCSSLab/Maia3-23M)
declare -A HF_REV=([5m]=b6559de2398d7140b985f28fd2c19fb5e47ddabe [23m]=51a0145a8178046f7de23119160b136672deeb2b)
declare -A SHA=([5m]=ba14208b2992d85502f5fb501934abf6aaaeb355e9f3fdf90e326911f562524f [23m]=bce6cd1af5f0399ac7eed33fabb7a6a2ef6193662c2740f262bf93af7bfb3569)
mkdir -p "$CACHE" "$OUT"

need=0
for s in $SIZES; do [ -f "$OUT/maia3-$s.onnx" ] || need=1; done
[ "$need" = 0 ] && { echo "[maia3] models already built ($SIZES)"; exit 0; }

if [ ! -x "$CACHE/venv/bin/python" ]; then
  python3 -m venv "$CACHE/venv"
  "$CACHE/venv/bin/pip" install -q --index-url https://download.pytorch.org/whl/cpu torch
  "$CACHE/venv/bin/pip" install -q onnx onnxruntime onnxscript python-chess numpy
fi
if [ ! -d "$CACHE/maia3/.git" ]; then
  git init -q "$CACHE/maia3"
  git -C "$CACHE/maia3" remote add origin https://github.com/CSSLab/maia3.git
fi
git -C "$CACHE/maia3" fetch -q --depth 1 origin "$CODE_REV"
git -C "$CACHE/maia3" checkout -q FETCH_HEAD

for s in $SIZES; do
  [ -f "$OUT/maia3-$s.onnx" ] && continue
  ckpt="$CACHE/maia3-$s.pt"
  if [ ! -f "$ckpt" ] || ! echo "${SHA[$s]}  $ckpt" | sha256sum -c --status; then
    curl -sSfL -o "$ckpt" "https://huggingface.co/${HF_REPO[$s]}/resolve/${HF_REV[$s]}/maia3-$s.pt"
  fi
  echo "${SHA[$s]}  $ckpt" | sha256sum -c --status || { echo "[maia3] checksum mismatch for $s" >&2; exit 1; }
  "$CACHE/venv/bin/python" scripts/maia3/convert.py --repo "$CACHE/maia3" --checkpoint "$ckpt" \
    --size "maia3-$s" --out "$OUT/maia3-$s.onnx" --fp16 --check "${MAIA3_CHECK:-50}"
done
