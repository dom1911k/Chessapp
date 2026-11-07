#!/usr/bin/env bash
# Builds the "Standard" piece sounds from real recordings (Lichess, AGPLv3+; see
# assets/sounds/lichess/README.md), tuned toward the chess.com feel: the move loses its low thump,
# the capture gets a little brighter, the opponent's move sits slightly higher and softer, and
# castle / check / promotion / premove are layered from the same wooden knocks.
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=assets/sounds/lichess
OUT=public/sounds/standard
mkdir -p "$OUT"
R=44100
enc() { ffmpeg -loglevel error -y "$@" -ac 1 -ar $R -c:a libmp3lame -q:a 4 ; }
# pitch p (1.05 = 5% higher, a touch shorter) — like a smaller piece.
pitch() { echo "asetrate=$((R))*$1,aresample=$R"; }
MOVE="highpass=f=170:poles=2"
CAP="highpass=f=160:poles=2,equalizer=f=2300:width_type=o:width=2:g=5"

enc -i $SRC/Move.mp3 -af "$MOVE,$(pitch 0.92),volume=1.0,afade=t=out:st=0.17:d=0.03" $OUT/move.mp3
enc -i $SRC/Move.mp3 -af "$MOVE,$(pitch 0.98),volume=0.82,afade=t=out:st=0.15:d=0.03" $OUT/moveOpp.mp3
enc -i $SRC/Capture.mp3 -af "$CAP,$(pitch 1.12),volume=1.0" $OUT/capture.mp3
enc -i $SRC/Move.mp3 -i $SRC/Capture.mp3 -filter_complex \
  "[0]$MOVE,volume=1.0[a];[1]$CAP,$(pitch 1.6),highpass=f=1500,volume=1.5,adelay=6[b];[a][b]amix=inputs=2:normalize=0" $OUT/check.mp3
enc -i $SRC/Move.mp3 -i $SRC/Move.mp3 -filter_complex \
  "[0]$MOVE,$(pitch 1.04),volume=0.6[a];[1]$MOVE,volume=1.0,adelay=95[b];[a][b]amix=inputs=2:normalize=0,treble=g=13:f=1200" $OUT/castle.mp3
enc -i $SRC/Move.mp3 -i $SRC/Move.mp3 -filter_complex \
  "[0]$MOVE,$(pitch 0.95),volume=1.0[a];[1]$MOVE,$(pitch 1.1),volume=0.7,adelay=55[b];[a][b]amix=inputs=2:normalize=0,treble=g=7:f=1400" $OUT/promote.mp3
enc -i $SRC/Move.mp3 -af "$MOVE,$(pitch 1.22),highpass=f=400,volume=0.55" $OUT/premove.mp3
enc -i $SRC/Error.mp3 -af "volume=0.55" $OUT/illegal.mp3
ls -l $OUT
