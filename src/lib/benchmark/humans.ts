// Human benchmark from imported chess.com games: your opponents' moves, grouped by their rating,
// profiled exactly like the bots (see profile.ts). The engine and Maia-3 come in as functions so
// the same code runs in the app (dev panel) and in Node scripts.
import { BANDS, bandOf } from './bands';
import { phaseOf, Profile, PROFILE, thinkTimes, type ProfileSummary } from './profile';
import { CCMAP } from '../games/ccmap';

export interface BenchDeps {
  /** Stockfish MultiPV: move → cp for the side to move. */
  candidates(fen: string, depth: number, multipv: number): Promise<Map<string, number>>;
  /** Score (cp, for `turn`) of the position after a move the candidates did not list. */
  scoreAfter(fenAfter: string, turn: 'w' | 'b'): Promise<number>;
  /** Maia-3's probability of `uci` in the last position of `fens` for a player rated `self`. */
  prob(fens: string[], uci: string, self: number, oppo: number): Promise<number>;
}

export interface BenchPly {
  fen: string;
  uci: string;
  fenAfter: string;
  /** chess.com ratings of the mover and the other player. */
  mover: number;
  other: number;
  /** Count this ply (e.g. only your opponents' moves). */
  count: boolean;
}

/** Adds one game's counted plies to `prof` (moves after ply 12 that are still undecided, and think times). */
export async function addGame(prof: Profile, plies: BenchPly[], clocks: number[] | undefined, tc: string, deps: BenchDeps): Promise<void> {
  const think = clocks && clocks.length === plies.length ? thinkTimes(clocks, tc) : null;
  const fens = [plies[0]?.fen];
  prof.games++;
  for (let i = 0; i < plies.length; i++) {
    const p = plies[i];
    if (p.count) {
      const moveNo = Math.floor(i / 2) + 1;
      if (think) prof.addThink(phaseOf(p.fen, moveNo), think[i]);
      if (i >= PROFILE.fromPly) {
        const turn = p.fen.split(' ')[1] as 'w' | 'b';
        const cand = await deps.candidates(p.fen, PROFILE.depth, PROFILE.multipv);
        const best = cand.size ? Math.max(...cand.values()) : 0;
        if (cand.size && Math.abs(best) < PROFILE.decidedCp) {
          const score = cand.get(p.uci) ?? (await deps.scoreAfter(p.fenAfter, turn));
          // Maia-3 at the player's own rating on its Lichess-like scale (chess.com + the typical gap).
          const prob = await deps.prob(fens.slice(-8), p.uci, Math.max(0, p.mover - CCMAP.priorOffset), Math.max(0, p.other - CCMAP.priorOffset));
          prof.addMove({ fen: p.fen, uci: p.uci, fenAfter: p.fenAfter, best, score, ply: i, prob });
        }
      }
    }
    fens.push(p.fenAfter);
  }
}

export interface BandResult extends ProfileSummary {
  band: string;
}

/** A game imported from chess.com, reduced to what the benchmark needs. */
export interface BenchGame {
  plies: { fenBefore: string; fenAfter: string; uci: string; isUser: boolean }[];
  clocks?: number[];
  timeControl?: string;
  /** Opponent's rating and yours. */
  elo: number;
  myRating: number;
}

/** Profiles your opponents' moves per rating band. `onProgress(done, total)` after each game. */
export async function benchmarkOpponents(games: BenchGame[], deps: BenchDeps, onProgress?: (done: number, total: number) => void, shouldStop?: () => boolean): Promise<BandResult[]> {
  const profs = new Map(BANDS.map((b) => [b.label, new Profile()]));
  let done = 0;
  for (const g of games) {
    if (shouldStop?.()) break;
    const band = bandOf(g.elo);
    if (band && g.timeControl && g.timeControl !== 'daily') {
      const plies = g.plies.map((p) => ({ fen: p.fenBefore, fenAfter: p.fenAfter, uci: p.uci, mover: p.isUser ? g.myRating : g.elo, other: p.isUser ? g.elo : g.myRating, count: !p.isUser }));
      await addGame(profs.get(band.label)!, plies, g.clocks, g.timeControl, deps);
    }
    onProgress?.(++done, games.length);
  }
  return BANDS.map((b) => ({ band: b.label, ...profs.get(b.label)!.summary() })).filter((r) => r.games > 0);
}
