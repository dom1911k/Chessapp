// "What you face": from my imported games, my most common openings by colour, my score in each,
// the line people at my level usually play against me (up to where my games tend to leave it),
// and the position where I most often go wrong (pure).
import { START_FEN } from './chess/game';
import type { Color } from './chess/pos';
import { detectOpening } from './openings';
import type { AnyGame, ImportedGame } from './store/types';

export interface FacedOpening {
  name: string;
  color: Color;
  games: number;
  /** Score in % (win 1, draw ½). */
  score: number;
  w: number;
  d: number;
  l: number;
  /** The usual line (SAN from the start) until my games split up. */
  line: string[];
  /** Where I most often go wrong in this opening (first 15 moves), if it happened at least twice. */
  trouble?: { fenBefore: string; ply: number; played: string; better?: string; times: number; gameId: string | number };
}

/** Moves considered "the opening" when looking for trouble spots. */
export const OPENING_PLIES = 30;
/** A continuation counts as "usual" while at least this share of games reaching it follow it… */
export const LINE_SHARE = 0.5;
/** …and at least this many games. */
export const LINE_MIN = 2;

const scoreOf = (gs: AnyGame[]) => {
  const w = gs.filter((g) => g.userResult === 'win').length;
  const d = gs.filter((g) => g.userResult === 'draw').length;
  return { w, d, l: gs.length - w - d, score: gs.length ? Math.round((100 * (w + d / 2)) / gs.length) : 0 };
};

/** The most common move sequence, followed while it stays common. */
export function usualLine(games: { plies: { san: string }[] }[], share = LINE_SHARE, min = LINE_MIN, max = 24): string[] {
  const line: string[] = [];
  let pool = games;
  while (line.length < max) {
    const tally = new Map<string, number>();
    for (const g of pool) {
      const san = g.plies[line.length]?.san;
      if (san) tally.set(san, (tally.get(san) ?? 0) + 1);
    }
    const [san, n] = [...tally.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
    if (!san || n! < min || n! < pool.length * share) break;
    line.push(san);
    pool = pool.filter((g) => g.plies[line.length - 1]?.san === san);
  }
  return line;
}

/** My most frequent opening mistake: the same position where I erred, most often. */
export function troubleSpot(games: AnyGame[]): FacedOpening['trouble'] {
  const tally = new Map<string, NonNullable<FacedOpening['trouble']>>();
  for (const g of games) {
    if (g.source === 'chess.com' && !(g as ImportedGame).analyzed) continue;
    g.plies.slice(0, OPENING_PLIES).forEach((p, i) => {
      if (!p.isUser || !(p.classification === 'mistake' || p.classification === 'blunder' || p.classification === 'inaccuracy')) return;
      const k = p.fenBefore.split(' ').slice(0, 4).join(' ');
      const t = tally.get(k);
      if (t) t.times++;
      else tally.set(k, { fenBefore: p.fenBefore, ply: i, played: p.san, better: p.comment?.bestSan, times: 1, gameId: g.id! });
    });
  }
  const best = [...tally.values()].sort((a, b) => b.times - a.times || a.ply - b.ply)[0];
  return best && best.times >= 2 ? best : undefined;
}

/** My openings from imported games, most played first, per colour. */
export function whatYouFace(games: AnyGame[], minGames = 2): FacedOpening[] {
  const groups = new Map<string, AnyGame[]>();
  for (const g of games) {
    if (g.source !== 'chess.com' || g.startFen !== START_FEN) continue;
    const name = g.opening ?? detectOpening(g.plies.map((p) => p.san))?.name;
    if (!name) continue;
    const k = `${g.userColor}|${name}`;
    groups.set(k, [...(groups.get(k) ?? []), g]);
  }
  const out: FacedOpening[] = [];
  for (const [k, gs] of groups) {
    if (gs.length < minGames) continue;
    const [color, name] = k.split('|') as [Color, string];
    out.push({ name, color, games: gs.length, ...scoreOf(gs), line: usualLine(gs), trouble: troubleSpot(gs) });
  }
  return out.sort((a, b) => b.games - a.games);
}
