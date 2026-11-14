// A move-quality and think-time profile, measured the same way for bots and for people (pure).
//
// Every move made while the game is still undecided (|best| < 600 cp, after the 12th ply) is scored
// against a Stockfish MultiPV search (depth 10, 8 lines):
//   inaccuracy 50–149 cp, mistake 150–299 cp, blunder 300+ cp.
// Blunders are sorted by kind:
//   hung     left a piece en prise that wasn't before (or moved it to an attacked square)
//   threat   ignored a threat: an attacked piece stays lost, or walked into mate
//   other    no simple motif (deeper tactics, positional collapse)
// and "random-looking" when Maia-3 gave the move under 5%.
// Think time is split by phase (opening = first 10 moves, endgame = little material left).
import { hangingPieces, parseFen } from '../chess/pos';
import { preMoveCheck } from '../coach/precheck';

export const PROFILE = { decidedCp: 600, fromPly: 12, depth: 10, multipv: 8, randomProb: 0.05, fastSecs: 2 };

export type Phase = 'opening' | 'middlegame' | 'endgame';
const VALUE: Record<string, number> = { n: 3, b: 3, r: 5, q: 9 };

/** Opening = first 10 moves; endgame = both sides together have at most 26 points of pieces. */
export function phaseOf(fen: string, moveNo: number): Phase {
  if (moveNo <= 10) return 'opening';
  const board = fen.split(' ')[0];
  let m = 0;
  for (const ch of board) m += VALUE[ch.toLowerCase()] ?? 0;
  return m <= 26 ? 'endgame' : 'middlegame';
}

export type BlunderKind = 'hung' | 'threat' | 'other';
/** What kind of blunder `uci` was in `fen` (`fenAfter` = the position after it). */
export function blunderKind(fen: string, uci: string, fenAfter: string): BlunderKind {
  const turn = fen.split(' ')[1] as 'w' | 'b';
  const pre = preMoveCheck(fen, uci);
  const before = new Set(hangingPieces(parseFen(fen).board, turn).filter((h) => h.loss >= 2).map((h) => h.sq));
  const stillHanging = hangingPieces(parseFen(fenAfter).board, turn).some((h) => h.loss >= 2 && before.has(h.sq));
  if (pre?.kind === 'mate' || (stillHanging && pre?.kind !== 'hang')) return 'threat';
  if (pre?.kind === 'hang') return 'hung';
  return 'other';
}

export interface ProfileSummary {
  games: number;
  moves: number;
  avgLoss: number;
  inacc: number;
  mistake: number;
  blunder: number;
  ofBlunders: { hung: number; threat: number; other: number; randomLooking: number };
  /** Average seconds per move by phase, and the share of moves under 2 s (all phases). */
  think?: { opening: number; middlegame: number; endgame: number; fast: number; moves: number };
}

const pct = (x: number, of: number) => Math.round((x / Math.max(1, of)) * 1000) / 10;

/** Collects moves and think times; `summary()` gives the percentages. */
export class Profile {
  games = 0;
  private losses: number[] = [];
  private kinds = { hung: 0, threat: 0, other: 0 };
  private tail = 0;
  private blunders = 0;
  private think: Record<Phase, number[]> = { opening: [], middlegame: [], endgame: [] };

  /**
   * One move: `best` and `score` are cp for the mover (best line, and the move played), `ply` the
   * number of plies before it, `prob` Maia-3's probability of the move (if known).
   */
  addMove(o: { fen: string; uci: string; fenAfter: string; best: number; score: number; ply: number; prob?: number }): void {
    if (Math.abs(o.best) >= PROFILE.decidedCp || o.ply < PROFILE.fromPly) return;
    const loss = Math.max(0, Math.min(1000, o.best - o.score));
    this.losses.push(loss);
    if (loss < 300) return;
    this.blunders++;
    if (o.prob !== undefined && o.prob < PROFILE.randomProb) this.tail++;
    this.kinds[blunderKind(o.fen, o.uci, o.fenAfter)]++;
  }

  addThink(phase: Phase, secs: number): void {
    if (secs >= 0 && Number.isFinite(secs)) this.think[phase].push(secs);
  }

  summary(): ProfileSummary {
    const n = this.losses.length;
    const all = [...this.think.opening, ...this.think.middlegame, ...this.think.endgame];
    const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : 0);
    return {
      games: this.games,
      moves: n,
      avgLoss: n ? Math.round(this.losses.reduce((a, b) => a + b, 0) / n) : 0,
      inacc: pct(this.losses.filter((x) => x >= 50 && x < 150).length, n),
      mistake: pct(this.losses.filter((x) => x >= 150 && x < 300).length, n),
      blunder: pct(this.blunders, n),
      ofBlunders: { hung: pct(this.kinds.hung, this.blunders), threat: pct(this.kinds.threat, this.blunders), other: pct(this.kinds.other, this.blunders), randomLooking: pct(this.tail, this.blunders) },
      think: all.length ? { opening: avg(this.think.opening), middlegame: avg(this.think.middlegame), endgame: avg(this.think.endgame), fast: pct(all.filter((s) => s < PROFILE.fastSecs).length, all.length), moves: all.length } : undefined,
    };
  }
}

/** Seconds spent on each ply from the clock after each ply (`clocks`, seconds) and the time control. */
export function thinkTimes(clocks: number[], tc: string): number[] {
  const [base, inc] = tc.split('+').map(Number);
  const last = [base, base];
  return clocks.map((c, i) => {
    const side = i % 2;
    const spent = last[side] - c + (inc || 0);
    last[side] = c;
    return Math.max(0, spent);
  });
}
