// Why a mistake happened, and the chances you let slip (pure). For each of your mistakes:
// - missedThreat: their last move attacked something (or threatened mate) and your move ignored it;
// - hungPiece:    your move left one of your own pieces loose;
// - missedTactic: there was a winning shot (mate, fork, free piece…) and you played something else;
// - calculation:  no single blunder-check miss — the trouble came a move or two later in a line you
//                 didn't see through;
// - plan:         a quieter positional slip (better plan available, no tactic).
// Plus two timing flags from the clock: played too fast, or in time trouble.
import { parseFen, hangingPieces, other, PIECE_NAME, sqName, type Color } from '../chess/pos';
import { lineToSan, formatLine } from '../chess/game';
import { describeLine, mateThreats, moveMotifs } from '../coach/tactics';
import { parseTc } from '../clock';
import { moveTimes } from '../timestats';
import type { AnyGame, PlyRecord } from '../store/types';

export type Cause = 'missedThreat' | 'hungPiece' | 'missedTactic' | 'calculation' | 'plan';
export const CAUSES: Cause[] = ['missedThreat', 'hungPiece', 'missedTactic', 'calculation', 'plan'];

export const CAUSE_INFO: Record<Cause | 'fast' | 'timeTrouble', { label: string; tip: string }> = {
  missedThreat: { label: 'Missed their threat', tip: 'After every opponent move, ask first: "What does that move attack or threaten?"' },
  hungPiece: { label: 'Left a piece loose', tip: 'Before you let go of a piece, check every piece of yours: is it attacked, and is it defended enough?' },
  missedTactic: { label: 'Missed a winning shot', tip: 'Start each move by looking at checks, captures and attacks — for you as well as for them.' },
  calculation: { label: 'Didn’t see far enough', tip: 'When pieces can be captured, play the line out in your head to the end: who takes last, and what is left?' },
  plan: { label: 'Weaker plan', tip: 'In quiet positions, improve your worst piece and keep your king safe before you go for action.' },
  fast: { label: 'Played too fast', tip: 'Mistakes made in a few seconds are the cheapest to fix: take a short safety check before critical moves.' },
  timeTrouble: { label: 'In time trouble', tip: 'Spend less on the early moves so you aren’t short of time when the position gets sharp.' },
};

export interface MistakeCause {
  ply: number;
  cause: Cause;
  /** Seconds spent on the move, when the game had a clock. */
  secs?: number;
  fast: boolean;
  timeTrouble: boolean;
  /** One sentence for this mistake. */
  text: string;
}

const BAD = new Set(['mistake', 'blunder', 'miss']);
const pname = (t: string | undefined) => (t ? PIECE_NAME[t as keyof typeof PIECE_NAME] : 'piece');

function sanOf(fen: string, uci?: string): string | null {
  if (!uci) return null;
  return lineToSan(fen, [uci], 1)[0] ?? null;
}

/** A winning shot available with the best move: mate, or material won (≥ a minor piece's worth). */
export function winningShot(fen: string, bestLine: string[] | undefined): { what: string; gain: number; mate: number | null } | null {
  if (!bestLine?.length) return null;
  const info = describeLine(fen, bestLine, 10);
  if (info.matesIn) return { what: `mate in ${info.matesIn}`, gain: 99, mate: info.matesIn };
  if (info.materialGain >= 2) {
    const what = info.victim && info.victim !== 'p' ? `win their ${PIECE_NAME[info.victim]}` : `win ${info.materialGain >= 3 ? 'material' : 'two pawns'}`;
    return { what, gain: info.materialGain, mate: null };
  }
  return null;
}

/**
 * The cause of each of your mistakes in a game. `cls[i]` is the review class of ply i
 * ('mistake', 'blunder', 'miss', …).
 */
export function mistakeCauses(g: Pick<AnyGame, 'plies' | 'userColor' | 'timeControl' | 'clocks'>, cls: string[]): MistakeCause[] {
  const out: MistakeCause[] = [];
  const times = new Map<number, number>();
  const clockLeft = new Map<number, number>();
  let baseSecs = 0;
  if (g.clocks?.length && g.timeControl && /^\d+(\+\d+)?$/.test(g.timeControl)) {
    baseSecs = parseTc(g.timeControl).base / 1000;
    for (const t of moveTimes(g.plies, g.clocks, g.timeControl, g.userColor)) times.set(t.ply, t.secs);
    // Time left when the move was started = your clock after your previous move.
    let prev = baseSecs;
    g.plies.forEach((p, i) => {
      if (p.color !== g.userColor) return;
      clockLeft.set(i, prev);
      if (g.clocks![i] !== undefined) prev = g.clocks![i];
    });
  }
  g.plies.forEach((p, i) => {
    if (!p.isUser || !BAD.has(cls[i])) return;
    const me = p.color as Color;
    const them = other(me);
    const before = parseFen(p.fenBefore).board;
    const after = parseFen(p.fenAfter).board;
    const c = p.comment;
    const bestSan = c?.bestSan ?? sanOf(p.fenBefore, c?.bestUci);
    const from = p.uci.slice(0, 2);

    let cause: Cause | null = null;
    let text = '';
    // 1. Their threat, ignored: something of yours was already attacked (or mate was threatened)…
    const threatened = hangingPieces(before, me).filter((h) => h.loss >= 2 && sqName(h.sq) !== from);
    const stillLoose = threatened.find((h) => hangingPieces(after, me).some((x) => x.sq === h.sq));
    const mateThreat = mateThreats(p.fenBefore, them).length > 0 && (c?.replyLine?.length ? describeLine(p.fenAfter, c.replyLine, 8).matesIn !== null : false);
    if (mateThreat) {
      cause = 'missedThreat';
      text = 'They were threatening checkmate — your move didn’t stop it.';
    } else if (stillLoose) {
      cause = 'missedThreat';
      text = `Their last move attacked your ${pname(before[stillLoose.sq]?.type)} on ${sqName(stillLoose.sq)} — your move didn’t deal with it.`;
    }
    // 2. A piece of yours left loose by this move.
    if (!cause) {
      const was = new Set(hangingPieces(before, me).map((h) => h.sq));
      const loose = hangingPieces(after, me).find((h) => h.loss >= 2 && !was.has(h.sq));
      if (loose) {
        cause = 'hungPiece';
        text = `${p.san} left your ${pname(after[loose.sq]?.type)} on ${sqName(loose.sq)} unprotected.`;
      }
    }
    // 3. A winning shot missed.
    if (!cause) {
      const shot = winningShot(p.fenBefore, c?.bestLine);
      const motif = c?.bestUci ? moveMotifs(p.fenBefore, c.bestUci).find((m) => ['mate', 'fork', 'freeCapture', 'winningCapture', 'skewer', 'discovered'].includes(m.kind)) : undefined;
      if ((shot || motif || cls[i] === 'miss') && bestSan) {
        cause = 'missedTactic';
        text = shot ? `${bestSan} would have ${shot.mate ? `forced ${shot.what}` : shot.what.replace(/^win/, 'won')} — you played ${p.san}.` : `${bestSan} was the punishing move — you played ${p.san}.`;
      }
    }
    // 4. A line not seen through: the reply wins material or mates a few moves later.
    if (!cause && c?.replyLine?.length) {
      const info = describeLine(p.fenAfter, c.replyLine, 8);
      if (info.matesIn || info.materialGain >= 2) {
        cause = 'calculation';
        text = `The problem shows a few moves later: ${formatLine(p.fenAfter, info.san.slice(0, 4))}.`;
      }
    }
    if (!cause) {
      cause = 'plan';
      text = bestSan ? `No single trick — ${bestSan} was the better plan here.` : 'A positional slip rather than a tactic.';
    }

    const secs = times.get(i);
    const left = clockLeft.get(i);
    const timeTrouble = left !== undefined && baseSecs > 0 && left < Math.min(30, baseSecs * 0.1);
    const fast = secs !== undefined && !timeTrouble && secs < Math.max(3, baseSecs * 0.005) && cls[i] !== 'miss';
    out.push({ ply: i, cause, secs, fast, timeTrouble, text });
  });
  return out;
}

/** How often each cause (and the two timing flags) came up. */
export function causeTotals(list: MistakeCause[]): Record<Cause | 'fast' | 'timeTrouble', number> {
  const t = { missedThreat: 0, hungPiece: 0, missedTactic: 0, calculation: 0, plan: 0, fast: 0, timeTrouble: 0 };
  for (const m of list) {
    t[m.cause]++;
    if (m.fast) t.fast++;
    if (m.timeTrouble) t.timeTrouble++;
  }
  return t;
}

export interface MissedChance {
  ply: number;
  bestSan: string;
  played: string;
  /** "mate in 2", "win their knight"… */
  what: string;
  gain: number;
}

/**
 * Moments you could have won material or mated but didn't (your move wasn't the winning one,
 * and the chance was gone). Biggest first, at most `max`.
 */
export function missedChances(g: Pick<AnyGame, 'plies'>, cls: string[], max = 6): MissedChance[] {
  const out: MissedChance[] = [];
  g.plies.forEach((p: PlyRecord, i) => {
    if (!p.isUser || !p.comment?.bestUci || p.comment.bestUci === p.uci) return;
    if (!BAD.has(cls[i]) && cls[i] !== 'inaccuracy') return;
    const shot = winningShot(p.fenBefore, p.comment.bestLine);
    if (!shot) return;
    const bestSan = p.comment.bestSan ?? sanOf(p.fenBefore, p.comment.bestUci);
    if (!bestSan) return;
    out.push({ ply: i, bestSan, played: p.san, what: shot.what, gain: shot.gain });
  });
  return out.sort((a, b) => b.gain - a.gain || a.ply - b.ply).slice(0, max).sort((a, b) => a.ply - b.ply);
}

export interface CauseReport {
  mistakes: number;
  totals: Record<Cause | 'fast' | 'timeTrouble', number>;
  /** The cause behind most mistakes, and its share. */
  top: { cause: Cause; share: number } | null;
}

/** Causes across many games (newest first; `classesOf` gives each game's review classes). */
export function causeReport(games: AnyGame[], classesOf: (g: AnyGame) => string[]): CauseReport {
  const all: MistakeCause[] = [];
  for (const g of games) all.push(...mistakeCauses(g, classesOf(g)));
  const totals = causeTotals(all);
  const best = CAUSES.reduce<Cause | null>((a, c) => (totals[c] > (a ? totals[a] : 0) ? c : a), null);
  return { mistakes: all.length, totals, top: best && all.length ? { cause: best, share: totals[best] / all.length } : null };
}
