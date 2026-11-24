// Game Review (chess.com style, pure): every move of both players classified (brilliant … blunder,
// plus book and miss), accuracy per player and per game phase, the key moments, and Coach Sam's
// summary of the game.
import { Chess } from 'chess.js';
import { floorClass, floorLoss, moveAccuracy, povScore, winPct, type Score } from './chess/evaluation';
import { lineToSan, START_FEN } from './chess/game';
import { hangingPieces, parseFen, sqName, type Color } from './chess/pos';
import { ECO } from './openings';
import { phaseOf, PHASES, type Phase } from './games/mistakes';
import { THEMES } from './themes';
import type { AnyGame, PlyRecord } from './store/types';

export type ReviewClass = 'brilliant' | 'great' | 'best' | 'excellent' | 'good' | 'book' | 'inaccuracy' | 'mistake' | 'miss' | 'blunder';
export const REVIEW_ORDER: ReviewClass[] = ['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'miss', 'blunder'];

/**
 * Label, symbol and colours per class (the colours chess.com players know). `color` fills icons
 * and is the text colour on dark surfaces; `ink` is the text colour on light surfaces (each passes
 * 4.5:1 on white); `inkDark` lightens the two that are borderline as text on charcoal.
 */
export const RC: Record<ReviewClass, { label: string; symbol: string; color: string; ink: string; inkDark: string; verdict: string }> = {
  brilliant: { label: 'Brilliant', symbol: '!!', color: '#1baca6', ink: '#14827e', inkDark: '#1baca6', verdict: 'is brilliant' },
  great: { label: 'Great', symbol: '!', color: '#5c8bb0', ink: '#4c799c', inkDark: '#6d9cc2', verdict: 'is a great move' },
  best: { label: 'Best', symbol: '★', color: '#81b64c', ink: '#597f34', inkDark: '#81b64c', verdict: 'is best' },
  excellent: { label: 'Excellent', symbol: '👍', color: '#96bc4b', ink: '#627d2e', inkDark: '#96bc4b', verdict: 'is excellent' },
  good: { label: 'Good', symbol: '✓', color: '#95b776', ink: '#5e7d42', inkDark: '#95b776', verdict: 'is good' },
  book: { label: 'Book', symbol: '📖', color: '#a88865', ink: '#8b6e4f', inkDark: '#a88865', verdict: 'is a book move' },
  inaccuracy: { label: 'Inaccuracy', symbol: '?!', color: '#f7c045', ink: '#9a6c07', inkDark: '#f7c045', verdict: 'is an inaccuracy' },
  mistake: { label: 'Mistake', symbol: '?', color: '#ffa459', ink: '#bf5600', inkDark: '#ffa459', verdict: 'is a mistake' },
  miss: { label: 'Miss', symbol: '✕', color: '#ff7769', ink: '#c8374a', inkDark: '#ff7769', verdict: 'is a miss' },
  blunder: { label: 'Blunder', symbol: '??', color: '#fa412d', ink: '#d1321f', inkDark: '#ff5a45', verdict: 'is a blunder' },
};
/** How bad a class is (higher = worse), for "at least a mistake" comparisons. */
const SEVERITY: Record<ReviewClass, number> = { brilliant: 0, great: 0, best: 0, excellent: 0, book: 0, good: 1, inaccuracy: 2, mistake: 3, miss: 3, blunder: 4 };
export const isBad = (c: ReviewClass) => c === 'inaccuracy' || c === 'mistake' || c === 'miss' || c === 'blunder';

export interface ReviewPly {
  cls: ReviewClass;
  /** Mover's win% before and after (0..100). */
  wpBefore: number;
  wpAfter: number;
  accuracy: number;
  phase: Phase;
  /** Win% the move effectively cost, with the material floor applied (≥ wpBefore − wpAfter). */
  effLoss?: number;
}
export interface SideStats {
  accuracy: number;
  /** Moves of this side that were analysed (0: no accuracy to show, "—"). */
  moves: number;
  counts: Record<ReviewClass, number>;
  /** Average accuracy per phase (null = no moves in that phase), and its class icon. */
  phases: Record<Phase, { accuracy: number; cls: ReviewClass } | null>;
}
export interface KeyMoment {
  ply: number;
  by: 'you' | 'them';
  /** Win% swing for the side that moved (negative = it hurt them). */
  swing: number;
  text: string;
}
export interface Review {
  plies: ReviewPly[];
  me: SideStats;
  them: SideStats;
  moments: KeyMoment[];
  /** Coach Sam's take on the whole game: 2–3 sentences. */
  summary: string[];
  /** White-POV win% after each ply (index 0 = start). */
  curve: number[];
}

const BOOK_PLIES = 20;
let bookLines: string[][] | null = null;
/** Still in a known opening line (bundled ECO table). */
export function isBook(sans: string[], i: number): boolean {
  if (i >= BOOK_PLIES) return false;
  bookLines ??= ECO.map((e) => e.moves.split(' '));
  const pre = sans.slice(0, i + 1);
  return bookLines.some((l) => l.length >= pre.length && pre.every((s, k) => l[k] === s));
}

/** The class for a move from its win% drop (no engine "best move" known). */
export function classByLoss(loss: number): ReviewClass {
  if (loss <= 1) return 'best';
  if (loss <= 2.5) return 'excellent';
  if (loss < 5) return 'good';
  if (loss < 10) return 'inaccuracy';
  if (loss < 20) return 'mistake';
  return 'blunder';
}

/** Phase grade from its accuracy, shown as a class icon. */
export function gradeOf(acc: number): ReviewClass {
  if (acc >= 90) return 'best';
  if (acc >= 80) return 'excellent';
  if (acc >= 70) return 'good';
  if (acc >= 60) return 'inaccuracy';
  if (acc >= 45) return 'mistake';
  return 'blunder';
}

/** Lichess-style game accuracy: the mean blended with the harmonic mean. */
function blend(accs: number[]): number {
  if (!accs.length) return 0;
  const a = accs.map((x) => Math.max(1, x));
  const mean = a.reduce((s, x) => s + x, 0) / a.length;
  const harm = a.length / a.reduce((s, x) => s + 1 / x, 0);
  return Math.round(((mean + harm) / 2) * 10) / 10;
}

function terminal(fen: string): Score | undefined {
  const c = new Chess(fen);
  if (c.isCheckmate()) return { type: 'mate', value: c.turn() === 'w' ? -1 : 1 } as Score;
  if (c.isGameOver()) return { type: 'cp', value: 0 };
  return undefined;
}

export function reviewGame(g: Pick<AnyGame, 'plies' | 'userColor' | 'startFen' | 'summary' | 'userResult' | 'reason'>): Review {
  const sans = g.plies.map((p) => p.san);
  const fromStart = g.startFen === START_FEN;
  // White-POV win% after each ply; a missing eval keeps the last one.
  const curve = [50];
  let last = 50;
  // The raw evaluation after each ply too (White's view): win% saturates, the floor needs these.
  const raw: (Score | undefined)[] = [{ type: 'cp', value: 0 }];
  let lastRaw: Score | undefined = raw[0];
  g.plies.forEach((p) => {
    const s = p.evalAfter ?? terminal(p.fenAfter);
    if (s) { last = winPct(povScore(s, 'w')); lastRaw = s; }
    curve.push(last);
    raw.push(lastRaw);
  });
  const pov = (wpWhite: number, c: Color) => (c === 'w' ? wpWhite : 100 - wpWhite);
  const plies: ReviewPly[] = g.plies.map((p, i) => {
    const wpBefore = pov(curve[i], p.color);
    const wpAfter = pov(curve[i + 1], p.color);
    const loss = Math.max(0, wpBefore - wpAfter);
    let cls: ReviewClass;
    if (fromStart && isBook(sans, i) && loss < 10) cls = 'book';
    else if (p.isUser && p.special) cls = p.special;
    else if (p.isUser && p.classification) {
      cls = p.classification === 'good' ? (loss <= 2.5 ? 'excellent' : 'good') : p.classification;
      // A miss: the opponent had just slipped and this move let the chance go.
      const prev = i > 0 ? Math.max(0, pov(curve[i - 1], g.plies[i - 1].color) - pov(curve[i], g.plies[i - 1].color)) : 0;
      if ((cls === 'inaccuracy' || cls === 'mistake' || cls === 'blunder') && prev >= 10 && wpBefore >= 65 && wpAfter >= 40) cls = 'miss';
    } else cls = classByLoss(loss);
    // Material floor: a big material loss, or walking into mate, counts even when win% has
    // saturated (one side already lost or winning).
    const sB = raw[i] && povScore(raw[i]!, p.color);
    const sA = raw[i + 1] && povScore(raw[i + 1]!, p.color);
    const floor = cls === 'book' ? null : floorClass(sB, sA);
    if (floor && SEVERITY[floor] > SEVERITY[cls]) cls = floor;
    const effLoss = Math.max(loss, floorLoss(floor));
    return { cls, wpBefore, wpAfter, accuracy: moveAccuracy(wpBefore, wpBefore - effLoss), phase: phaseOf(p.fenBefore, i), effLoss };
  });
  const side = (mine: boolean): SideStats => {
    const idx = plies.map((r, i) => ({ r, i })).filter(({ i }) => g.plies[i].isUser === mine);
    const counts = Object.fromEntries(REVIEW_ORDER.map((c) => [c, 0])) as Record<ReviewClass, number>;
    for (const { r } of idx) counts[r.cls]++;
    const phases = Object.fromEntries(
      PHASES.map((ph) => {
        const a = idx.filter(({ r }) => r.phase === ph && r.cls !== 'book').map(({ r }) => r.accuracy);
        const acc = a.length ? Math.round(a.reduce((s, x) => s + x, 0) / a.length) : null;
        return [ph, acc === null ? null : { accuracy: acc, cls: gradeOf(acc) }];
      }),
    ) as SideStats['phases'];
    return { accuracy: blend(idx.map(({ r }) => r.accuracy)), moves: idx.length, counts, phases };
  };
  const me = side(true);
  const them = side(false);
  const moments = keyMoments(g.plies, plies);
  return { plies, me, them, moments, summary: gameSummary(g, plies, curve, moments), curve };
}

/** The key moments of yours worth fixing in a game ("Fix 2 moments"): the ones where you slipped
 *  and the better move is known (at most 3), in move order. */
export const fixMoments = (g: Pick<AnyGame, 'plies'>, r: Pick<Review, 'moments'>) =>
  r.moments
    .filter((m) => {
      const p = g.plies[m.ply];
      return m.by === 'you' && !!p?.comment?.bestUci && p.comment.bestUci !== p.uci;
    })
    .slice(0, 3);

/** The biggest swings of the game (at most 4, 15+ win% each), in move order. */
export function keyMoments(ps: PlyRecord[], rs: ReviewPly[]): KeyMoment[] {
  const swings = rs
    .map((r, i) => ({ i, swing: Math.min(r.wpAfter - r.wpBefore, -(r.effLoss ?? 0)), r }))
    .filter((x) => x.swing <= -15 && isBad(x.r.cls))
    .sort((a, b) => a.swing - b.swing)
    .slice(0, 4)
    .sort((a, b) => a.i - b.i);
  return swings.map(({ i, swing, r }) => {
    const p = ps[i];
    const by = p.isUser ? 'you' : 'them';
    const no = moveNo(ps, i);
    const verdict = RC[r.cls].label.toLowerCase();
    const reply = p.comment?.replyLine?.[0] ? lineToSan(p.fenAfter, p.comment.replyLine.slice(0, 1))[0] : undefined;
    const text =
      by === 'you'
        ? `${no} ${p.san} was ${article(verdict)} ${verdict}${reply ? ` — it allowed ${reply}` : ''}${p.comment?.bestSan ? `. ${p.comment.bestSan} was the move.` : '.'}`
        : theirSlipLine(ps, i, verdict, rs[i + 1] ? !isBad(rs[i + 1].cls) : undefined);
    return { ply: i, by, swing: Math.round(swing), text };
  });
}

/** "12." / "12…" for the move at ply i. */
export function moveNo(ps: Pick<PlyRecord, 'fenBefore'>[], i: number): string {
  const f = ps[i].fenBefore.split(' ');
  return `${f[5] ?? Math.floor(i / 2) + 1}${f[1] === 'w' ? '.' : '…'}`;
}

/** Coach Sam's take on the game in 2–3 plain sentences. */
export function gameSummary(g: Pick<AnyGame, 'plies' | 'userColor' | 'summary' | 'userResult' | 'reason'>, rs: ReviewPly[], curve: number[], moments: KeyMoment[]): string[] {
  const out: string[] = [];
  const me = g.userColor;
  const mine = (wpWhite: number) => (me === 'w' ? wpWhite : 100 - wpWhite);
  // 1. How the opening went (after move 10, or the end if earlier).
  const k = Math.min(curve.length - 1, BOOK_PLIES);
  const op = mine(curve[k]);
  if (g.plies.length >= 12) out.push(op >= 65 ? 'You came out of the opening clearly better.' : op >= 55 ? 'You came out of the opening with a small edge.' : op > 45 ? 'The opening went fine — about level.' : op > 35 ? 'The opening left you a little worse.' : 'The opening went wrong: you were clearly worse by move 10.');
  // 2. The turning point.
  const mineBad = moments.filter((m) => m.by === 'you');
  const theirs = moments.filter((m) => m.by === 'them');
  if (mineBad.length) {
    const m = mineBad.sort((a, b) => a.swing - b.swing)[0];
    const p = g.plies[m.ply];
    // The concrete problem (not a general tip or a long worded line) as its own sentence.
    const ids = p.comment?.ruleIds ?? [];
    const why = p.comment?.text.find((t, k) => t.length <= 120 && !t.includes('(') && (!ids[k] || PROBLEM_RULE.test(ids[k])));
    const verdict = RC[rs[m.ply].cls].label.toLowerCase();
    out.push(`The game turned on ${moveNo(g.plies, m.ply)} ${p.san}, ${article(verdict)} ${verdict}${p.comment?.bestSan ? ` — ${p.comment.bestSan} was the move` : ''}.${why ? ` ${sentence(why)}` : ''}`);
  } else if (theirs.length && g.userResult === 'win') out.push('Your opponent slipped and you made the most of it — clean work.');
  else if (g.userResult === 'win') out.push('No big mistakes — you won it steadily.');
  // 3. Missed chances and the lesson.
  const misses = rs.filter((r, i) => g.plies[i].isUser && r.cls === 'miss').length;
  if (misses) out.push(`You missed ${misses === 1 ? 'a chance' : `${misses} chances`} to punish your opponent's mistakes — after every opponent move, ask "what did that just leave unprotected?"`);
  else if (g.summary.lessonTheme) out.push(THEMES[g.summary.lessonTheme].lesson);
  if (!out.length) out.push(g.userResult === 'loss' ? 'A tough one — step through it to see where it slipped.' : g.userResult === 'draw' ? 'A balanced game with no big swings from you — well held.' : 'A steady game — step through it for the details.');
  return out.slice(0, 3);
}

/** Rules that say what concretely goes wrong (vs ideas, principles, praise). */
const PROBLEM_RULE = /^(allows-|bad-trade|hangs-|weakens-king|loses-material|strong-reply)/;
const sentence = (t: string) => (/[.!?]$/.test(t) ? t : `${t}.`);

const NAME: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };

/**
 * What punishes an opponent's move, from the engine's best reply (stored as the best move on your
 * next ply): "Allows Qd8#.", "Allows a forced mate in 3, starting with Qd8+.", "This hangs the
 * queen — Rxb4 wins it.", or "Nf5 punishes it." Null when no reply is known.
 */
export interface Punish {
  san: string;
  uci: string;
  kind: 'mate' | 'mateIn' | 'hang' | 'other';
  piece?: string;
  n?: number;
}

/** The engine's best answer to an opponent's move (stored as the best move on your next ply). */
export function punishInfo(ps: Pick<PlyRecord, 'fenAfter' | 'evalAfter' | 'color' | 'isUser' | 'comment'>[], i: number): Punish | null {
  const p = ps[i];
  const next = ps[i + 1];
  const uci = next?.isUser ? next.comment?.bestUci : undefined;
  if (!uci || p.isUser) return null;
  const c = new Chess(p.fenAfter);
  let m;
  try { m = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }); } catch { return null; }
  if (m.san.includes('#')) return { san: m.san, uci, kind: 'mate' };
  const me = p.color === 'w' ? 'b' : 'w';
  const s = p.evalAfter ? povScore(p.evalAfter, me) : undefined;
  if (s?.type === 'mate' && s.value > 0) return { san: m.san, uci, kind: 'mateIn', n: s.value };
  // A pawn grab is rarely the whole story behind a blunder; "hangs" is for pieces.
  if (m.captured && m.captured !== 'p') {
    // Only when the capture really wins it (not an even trade the mover can take back).
    const loose = hangingPieces(parseFen(p.fenAfter).board, p.color as Color).some((h) => sqName(h.sq) === m.to && h.loss >= 2);
    if (loose) return { san: m.san, uci, kind: 'hang', piece: NAME[m.captured] };
  }
  return { san: m.san, uci, kind: 'other' };
}

/**
 * What punishes an opponent's move: "Allows Qd8#.", "Allows a forced mate in 3, starting with
 * Qd8+.", "This hangs the queen — Rxb4 wins it.", or "Nf5 punishes it." Null when no reply is known.
 */
export function punishment(ps: Pick<PlyRecord, 'fenAfter' | 'evalAfter' | 'color' | 'isUser' | 'comment'>[], i: number): string | null {
  const x = punishInfo(ps, i);
  if (!x) return null;
  if (x.kind === 'mate') return `Allows ${x.san}.`;
  if (x.kind === 'mateIn') return `Allows a forced mate in ${x.n}, starting with ${x.san}.`;
  if (x.kind === 'hang') return `This hangs the ${x.piece} — ${x.san} wins it.`;
  return `${x.san} punishes it.`;
}

/**
 * One line for an opponent's slip and what you did with it: "32. Qg4 hung the queen — you won it
 * with Qxg4+." / "32. Qg4 hung the queen — Qxg4+ wins it, but you played Kh1."
 */
export function theirSlipLine(ps: Pick<PlyRecord, 'fenBefore' | 'fenAfter' | 'evalAfter' | 'color' | 'isUser' | 'comment' | 'san' | 'uci'>[], i: number, verdict: string, answered?: boolean): string {
  const p = ps[i];
  const next = ps[i + 1];
  const x = punishInfo(ps, i);
  const head = `${moveNo(ps, i)} ${p.san}`;
  if (!x || !next) return `${head} was ${article(verdict)} ${verdict} by your opponent${answered === undefined || !next ? '' : answered ? ' — and you punished it' : ', but you let it go'}.`;
  const found = next.uci === x.uci;
  const what =
    x.kind === 'mate' ? `allowed ${x.san}` : x.kind === 'mateIn' ? `allowed a forced mate in ${x.n}` : x.kind === 'hang' ? `hung the ${x.piece}` : `was ${article(verdict)} ${verdict}`;
  if (found) {
    if (x.kind === 'mate') return `${head} allowed ${x.san} — and you found it.`;
    if (x.kind === 'hang') return `${head} hung the ${x.piece} — you won it with ${x.san}.`;
    return `${head} ${what} — you punished it with ${x.san}.`;
  }
  if (x.kind === 'mate') return `${head} allowed ${x.san}, but you played ${next.san}.`;
  if (x.kind === 'hang') return `${head} hung the ${x.piece} — ${x.san} wins it, but you played ${next.san}.`;
  return `${head} ${what} — ${x.san} was the answer; you played ${next.san}.`;
}

/** The short line on a key-moment card for their slip: "You won the queen with Qxg4+" / "Bd2 punishes it — missed". */
export function slipCardLine(ps: Pick<PlyRecord, 'fenAfter' | 'evalAfter' | 'color' | 'isUser' | 'comment' | 'uci'>[], i: number): string | null {
  const x = punishInfo(ps, i);
  const next = ps[i + 1];
  if (!x || !next) return null;
  if (next.uci === x.uci) return x.kind === 'hang' ? `You won the ${x.piece} with ${x.san}` : x.kind === 'mate' ? `You found ${x.san}` : `You punished it with ${x.san}`;
  return x.kind === 'hang' ? `${x.san} wins the ${x.piece} — missed` : x.kind === 'mate' ? `${x.san} was mate — missed` : `${x.san} punishes it — missed`;
}

const article = (w: string) => (/^[aeiou]/i.test(w) ? 'an' : 'a');
