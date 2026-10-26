// Career statistics: the tactics you actually played in your games. Counted per
// game (shown on the results screen) and over your whole "chess career".
import { Chess } from 'chess.js';
import { parseUci } from '../chess/game';
import { attackersOf, fileOf, hangingPieces, kingSquare, other, parseFen, rankOf, see, sqIndex, VALUE, type Color } from '../chess/pos';
import type { AnalysisResult } from '../engine/types';
import { povScore, winPct } from '../chess/evaluation';
import { isBackRankMate, moveMotifs } from '../coach/tactics';
import { kvGet, kvSet } from '../db';

export const TACTIC_KEYS = [
  'forks',
  'royalForks',
  'pins',
  'skewers',
  'discovered',
  'checkmates',
  'backRankMates',
  'smotheredMates',
  'promotions',
  'queenCaptures',
  'brilliant',
  'great',
] as const;
export type TacticKey = (typeof TACTIC_KEYS)[number];
export type TacticCounts = Partial<Record<TacticKey, number>>;

export const TACTIC_LABEL: Record<TacticKey, { one: string; many: string; icon: string }> = {
  forks: { one: 'Fork', many: 'Forks', icon: 'fork' },
  royalForks: { one: 'Royal fork', many: 'Royal forks', icon: 'crown' },
  pins: { one: 'Pin', many: 'Pins', icon: 'pin' },
  skewers: { one: 'Skewer', many: 'Skewers', icon: 'skewer' },
  discovered: { one: 'Discovered attack', many: 'Discovered attacks', icon: 'eye' },
  checkmates: { one: 'Checkmate', many: 'Checkmates', icon: 'king' },
  backRankMates: { one: 'Back-rank mate', many: 'Back-rank mates', icon: 'castle' },
  smotheredMates: { one: 'Smothered mate', many: 'Smothered mates', icon: 'knight' },
  promotions: { one: 'Promotion', many: 'Promotions', icon: 'crown' },
  queenCaptures: { one: 'Queen captured', many: 'Queens captured', icon: 'queen' },
  brilliant: { one: 'Brilliant move', many: 'Brilliant moves', icon: 'sparkles' },
  great: { one: 'Great move', many: 'Great moves', icon: 'zap' },
};

export type Special = 'brilliant' | 'great';

/**
 * The tactics in one of your moves. Only counted for sound moves (the caller
 * passes the classification), so a "fork" that loses the queen doesn't count.
 */
export function tacticsOfMove(fenBefore: string, uci: string): TacticCounts {
  const out: TacticCounts = {};
  const add = (k: TacticKey) => (out[k] = (out[k] ?? 0) + 1);
  const c = new Chess(fenBefore);
  let m;
  try {
    m = c.move(parseUci(uci));
  } catch {
    return out;
  }
  const after = parseFen(c.fen()).board;
  for (const mo of moveMotifs(fenBefore, uci)) {
    if (mo.kind === 'fork') {
      add('forks');
      const types = mo.fork.targets.map((t) => after[t]?.type);
      if (types.includes('k') && types.includes('q')) add('royalForks');
    } else if (mo.kind === 'pin') add('pins');
    else if (mo.kind === 'skewer') add('skewers');
    else if (mo.kind === 'discovered') add('discovered');
    else if (mo.kind === 'promotion') add('promotions');
  }
  if (m.captured === 'q') add('queenCaptures');
  if (c.isCheckmate()) {
    add('checkmates');
    if (isBackRankMate(c.fen())) add('backRankMates');
    else if (isSmothered(c.fen(), m.to)) add('smotheredMates');
  }
  return out;
}

/** Checkmate by a knight against a king boxed in by its own pieces. */
function isSmothered(fen: string, to: string): boolean {
  const { board, turn } = parseFen(fen);
  if (board[sqIndex(to)]?.type !== 'n') return false;
  const k = kingSquare(board, turn);
  for (let df = -1; df <= 1; df++)
    for (let dr = -1; dr <= 1; dr++) {
      if (!df && !dr) continue;
      const f = fileOf(k) + df;
      const r = rankOf(k) + dr;
      if (f < 0 || f > 7 || r < 0 || r > 7) continue;
      const p = board[r * 8 + f];
      if (!p || p.color !== turn) return false;
    }
  return true;
}

/**
 * Brilliant: the best move, and it gives something up (the moved piece, or
 * another piece left hanging) — yet the position stays good.
 * Great: the best move when it was the only good one.
 */
export function specialMove(fenBefore: string, uci: string, before: AnalysisResult | null, after: AnalysisResult | null, isBest: boolean, prevUci?: string): Special | null {
  if (!isBest || !before?.lines.length) return null;
  const me = fenBefore.split(' ')[1] as Color;
  const wp = (s: AnalysisResult['lines'][number]['score'] | undefined) => (s ? winPct(povScore(s, me)) : null);
  const wpBefore = wp(before.lines[0]?.score);
  const afterScore = after?.lines[0]?.score;
  const wpAfter = afterScore ? wp(afterScore) : wpBefore;
  if (wpBefore === null || wpAfter === null) return null;
  // Already completely winning or lost: nothing special about finding a good move.
  if (wpBefore > 97 || wpBefore < 8) return null;

  const c = new Chess(fenBefore);
  let m;
  try {
    m = c.move(parseUci(uci));
  } catch {
    return null;
  }
  const boardBefore = parseFen(fenBefore).board;
  const boardAfter = parseFen(c.fen()).board;
  const to = sqIndex(m.to);
  const gained = m.captured ? VALUE[m.captured] : 0;
  const movedLoss = m.piece === 'p' || m.piece === 'k' ? 0 : see(boardAfter, to, other(me)) - gained;
  const wasHanging = new Set(hangingPieces(boardBefore, me).map((h) => h.sq));
  const leftHanging = hangingPieces(boardAfter, me).filter((h) => h.sq !== to && !wasHanging.has(h.sq) && VALUE[boardAfter[h.sq]!.type] >= 3);
  const sacrifice = movedLoss >= 2 || leftHanging.length > 0;
  if (sacrifice && wpAfter >= 50 && !c.isCheckmate()) return 'brilliant';

  // Only move: the second-best line is much worse.
  const second = before.lines[1]?.score;
  const wp2 = wp(second);
  if (wp2 === null) return null;
  const recapture = prevUci && prevUci.slice(2, 4) === m.to && m.captured;
  const obvious = recapture || c.isCheckmate() || (m.captured && attackersOf(boardBefore, to, other(me)).length === 0);
  if (!obvious && wpBefore - wp2 >= 20 && wpAfter >= 40) return 'great';
  return null;
}

export const add = (a: TacticCounts, b: TacticCounts): TacticCounts => {
  const out: TacticCounts = { ...a };
  for (const k of TACTIC_KEYS) if (b[k]) out[k] = (out[k] ?? 0) + b[k]!;
  return out;
};

export const maxOf = (a: TacticCounts, b: TacticCounts): TacticCounts => {
  const out: TacticCounts = { ...a };
  for (const k of TACTIC_KEYS) if ((b[k] ?? 0) > (out[k] ?? 0)) out[k] = b[k];
  return out;
};

const CAREER = 'careerTactics';
export const BEST_GAME = 'careerBestGame';
export const getCareer = () => kvGet<TacticCounts>(CAREER, {});
/** Adds a finished game's tactics to your career totals and single-game bests. */
export async function addToCareer(t: TacticCounts) {
  if (!Object.keys(t).length) return;
  await kvSet(CAREER, add(await getCareer(), t));
  await kvSet(BEST_GAME, maxOf(await kvGet<TacticCounts>(BEST_GAME, {}), t));
}
