// The result markers chess.com puts on the kings once a game is over: a crown for the winner,
// what lost it for the loser (checkmate, time, or resigning and anything else), ½ for a draw.
export type KingBadge = 'win' | 'mate' | 'time' | 'resign' | 'draw';
export type KingBadges = { w: KingBadge; b: KingBadge };

export function kingBadges(result: string | undefined, reason: string | undefined): KingBadges | null {
  if (result === '1/2-1/2') return { w: 'draw', b: 'draw' };
  if (result !== '1-0' && result !== '0-1') return null;
  const lost: KingBadge = reason === 'checkmate' ? 'mate' : reason === 'time' ? 'time' : 'resign';
  return result === '1-0' ? { w: 'win', b: lost } : { w: lost, b: 'win' };
}

/** Where each king stands in a FEN. */
export function kingSquares(fen: string): { w?: string; b?: string } {
  const out: { w?: string; b?: string } = {};
  fen.split(' ')[0].split('/').forEach((row, r) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) f += Number(ch);
      else {
        if (ch === 'K') out.w = String.fromCharCode(97 + f) + (8 - r);
        if (ch === 'k') out.b = String.fromCharCode(97 + f) + (8 - r);
        f++;
      }
    }
  });
  return out;
}

/**
 * The top-right corner of a square for a round badge of `size` px, kept fully inside the board
 * on the right-hand file and the top rank (like chess.com's move icons).
 */
export function cornerPos(sq: string, orientation: 'white' | 'black', size: number): { left: string; top: string } {
  const f = sq.charCodeAt(0) - 97;
  const rk = Number(sq[1]) - 1;
  const col = orientation === 'white' ? f : 7 - f;
  const row = orientation === 'white' ? 7 - rk : rk;
  return {
    left: col === 7 ? `calc(100% - ${size + 1}px)` : `calc(${((col + 1) / 8) * 100}% - ${size * 0.62}px)`,
    top: row === 0 ? '1px' : `calc(${(row / 8) * 100}% - ${size * 0.38}px)`,
  };
}
