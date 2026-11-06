// Game Review (chess.com style, pure): every move of both players classified (brilliant … blunder,
// plus book and miss), accuracy per player and per game phase, the key moments, and Coach Sam's
// summary of the game.
import { Chess } from 'chess.js';
import { moveAccuracy, povScore, winPct, type Score } from './chess/evaluation';
import { lineToSan, START_FEN } from './chess/game';
import type { Color } from './chess/pos';
import { ECO } from './openings';
import { phaseOf, PHASES, type Phase } from './games/mistakes';
import { THEMES } from './themes';
import type { AnyGame, PlyRecord } from './store/types';

export type ReviewClass = 'brilliant' | 'great' | 'best' | 'excellent' | 'good' | 'book' | 'inaccuracy' | 'mistake' | 'miss' | 'blunder';
export const REVIEW_ORDER: ReviewClass[] = ['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'miss', 'blunder'];

/** Label, symbol and colour per class (the colours chess.com players know). */
export const RC: Record<ReviewClass, { label: string; symbol: string; color: string; verdict: string }> = {
  brilliant: { label: 'Brilliant', symbol: '!!', color: '#1baca6', verdict: 'is brilliant' },
  great: { label: 'Great', symbol: '!', color: '#5c8bb0', verdict: 'is a great move' },
  best: { label: 'Best', symbol: '★', color: '#81b64c', verdict: 'is best' },
  excellent: { label: 'Excellent', symbol: '👍', color: '#96bc4b', verdict: 'is excellent' },
  good: { label: 'Good', symbol: '✓', color: '#95b776', verdict: 'is good' },
  book: { label: 'Book', symbol: '📖', color: '#a88865', verdict: 'is a book move' },
  inaccuracy: { label: 'Inaccuracy', symbol: '?!', color: '#f7c045', verdict: 'is an inaccuracy' },
  mistake: { label: 'Mistake', symbol: '?', color: '#ffa459', verdict: 'is a mistake' },
  miss: { label: 'Miss', symbol: '✕', color: '#ff7769', verdict: 'is a miss' },
  blunder: { label: 'Blunder', symbol: '??', color: '#fa412d', verdict: 'is a blunder' },
};
export const isBad = (c: ReviewClass) => c === 'inaccuracy' || c === 'mistake' || c === 'miss' || c === 'blunder';

export interface ReviewPly {
  cls: ReviewClass;
  /** Mover's win% before and after (0..100). */
  wpBefore: number;
  wpAfter: number;
  accuracy: number;
  phase: Phase;
}
export interface SideStats {
  accuracy: number;
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
  g.plies.forEach((p) => {
    const s = p.evalAfter ?? terminal(p.fenAfter);
    if (s) last = winPct(povScore(s, 'w'));
    curve.push(last);
  });
  const pov = (wpWhite: number, c: Color) => (c === 'w' ? wpWhite : 100 - wpWhite);
  const plies: ReviewPly[] = g.plies.map((p, i) => {
    const wpBefore = pov(curve[i], p.color);
    const wpAfter = pov(curve[i + 1], p.color);
    const loss = Math.max(0, wpBefore - wpAfter);
    let cls: ReviewClass;
    if (fromStart && isBook(sans, i) && loss < 5) cls = 'book';
    else if (p.isUser && p.special) cls = p.special;
    else if (p.isUser && p.classification) {
      cls = p.classification === 'good' ? (loss <= 2.5 ? 'excellent' : 'good') : p.classification;
      // A miss: the opponent had just slipped and this move let the chance go.
      const prev = i > 0 ? Math.max(0, pov(curve[i - 1], g.plies[i - 1].color) - pov(curve[i], g.plies[i - 1].color)) : 0;
      if ((cls === 'inaccuracy' || cls === 'mistake' || cls === 'blunder') && prev >= 10 && wpBefore >= 65 && wpAfter >= 40) cls = 'miss';
    } else cls = classByLoss(loss);
    return { cls, wpBefore, wpAfter, accuracy: moveAccuracy(wpBefore, wpAfter), phase: phaseOf(p.fenBefore, i) };
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
    return { accuracy: blend(idx.map(({ r }) => r.accuracy)), counts, phases };
  };
  const me = side(true);
  const them = side(false);
  const moments = keyMoments(g.plies, plies);
  return { plies, me, them, moments, summary: gameSummary(g, plies, curve, moments), curve };
}

/** The biggest swings of the game (at most 4, 15+ win% each), in move order. */
export function keyMoments(ps: PlyRecord[], rs: ReviewPly[]): KeyMoment[] {
  const swings = rs
    .map((r, i) => ({ i, swing: r.wpAfter - r.wpBefore, r }))
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
        ? `${no} ${p.san} was a ${verdict}${p.comment?.bestSan ? ` — ${p.comment.bestSan} was the move` : ''}${reply ? `; they could answer ${reply}` : ''}.`
        : `${no} ${p.san} — your opponent's ${verdict}${rs[i + 1] && !isBad(rs[i + 1].cls) ? ', and you punished it' : rs[i + 1] ? ', but you let it go' : ''}.`;
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
    const why = p.comment?.text.find((t) => t.length <= 110);
    const verdict = RC[rs[m.ply].cls].label.toLowerCase();
    out.push(`The game turned on ${moveNo(g.plies, m.ply)} ${p.san}, a ${verdict}${p.comment?.bestSan ? ` (${p.comment.bestSan} was the move)` : ''}${why ? `: ${lower(why)}` : '.'}`);
  } else if (theirs.length && g.userResult === 'win') out.push('Your opponent slipped and you made the most of it — clean work.');
  else if (g.userResult === 'win') out.push('No big mistakes — you won it steadily.');
  // 3. Missed chances and the lesson.
  const misses = rs.filter((r, i) => g.plies[i].isUser && r.cls === 'miss').length;
  if (misses) out.push(`You missed ${misses === 1 ? 'a chance' : `${misses} chances`} to punish your opponent's mistakes — after every opponent move, ask "what did that just leave unprotected?"`);
  else if (g.summary.lessonTheme) out.push(THEMES[g.summary.lessonTheme].lesson);
  if (!out.length) out.push(g.userResult === 'loss' ? "A tough one. Let's step through it to see where it went wrong." : 'Let’s step through the game.');
  return out.slice(0, 3);
}

const lower = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s).replace(/\.$/, '') + '.';
