// Plain-language lines for Game Review (pure): the one-line verdict on the game, the threat you
// missed, why a piece was loose, and why a good move worked.
import { Chess } from 'chess.js';
import { attackersOf, other, parseFen, sqIndex, sqName, VALUE, type Color, type PieceType } from './chess/pos';
import { mateThreats, moveMotifs } from './coach/tactics';
import { isBad, moveNo, type Review, type ReviewClass } from './review';
import type { MistakeCause } from './games/causes';
import type { AnyGame, PlyRecord } from './store/types';

const NAME: Record<PieceType, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const times = (n: number) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);
const PHASE_WORD = { opening: 'the opening', middlegame: 'the middlegame', endgame: 'the endgame' } as const;

/**
 * One headline for the whole game, e.g. "You were winning until 18. Nxe5 — one slip in the
 * endgame cost it." Built from the win% curve, the result and the biggest swing of yours.
 */
export function verdictLine(g: Pick<AnyGame, 'plies' | 'userColor' | 'userResult' | 'reason'>, r: Review): string {
  const mine = (wpWhite: number) => (g.userColor === 'w' ? wpWhite : 100 - wpWhite);
  const curve = r.curve.map(mine);
  // Your worst move: the biggest (floored) loss among your bad moves.
  let worst = -1;
  r.plies.forEach((p, i) => {
    if (g.plies[i].isUser && isBad(p.cls) && (worst < 0 || (p.effLoss ?? 0) > (r.plies[worst].effLoss ?? 0))) worst = i;
  });
  const at = (i: number) => `${moveNo(g.plies, i)} ${g.plies[i].san}`;
  const before = worst >= 0 ? curve[worst] : 50;
  const phase = worst >= 0 ? PHASE_WORD[r.plies[worst].phase] : '';
  const peak = Math.max(...curve);
  const low = Math.min(...curve);
  if (g.userResult === 'win') {
    if (low <= 25) return 'You were in trouble but turned it around — a fighting win.';
    if (worst < 0 || (r.plies[worst].effLoss ?? 0) < 10) return 'A clean win — no real slips from you.';
    return `A win, though ${at(worst)} let them back in for a while.`;
  }
  if (g.userResult === 'draw') {
    if (peak >= 75 && worst >= 0) return `You were winning until ${at(worst)} — it slipped to a draw.`;
    if (low <= 25) return 'You were in trouble and saved a draw — well held.';
    return 'Level most of the way — a fair draw.';
  }
  // A loss.
  // Your other real slips after that one (a game rarely turns on exactly one move at club level).
  // Only those made while the game was still alive count — once it is lost, everything looks bad.
  const more = worst < 0 ? 0 : r.plies.filter((p, i) => i > worst && g.plies[i].isUser && (p.cls === 'mistake' || p.cls === 'blunder') && p.wpBefore >= 25).length;
  const tail = more === 0 ? '' : more === 1 ? ', and one more mistake followed' : more === 2 ? ', and two more mistakes followed' : ', and it went downhill from there';
  if (worst >= 0 && before >= 65) return more ? `You were winning until ${at(worst)} — that slip in ${phase} let them back${tail}.` : `You were winning until ${at(worst)} — one slip in ${phase} cost it.`;
  if (worst >= 0 && before >= 40) return more ? `It was level until ${at(worst)} — that slip in ${phase} turned it${tail}.` : `It was level until ${at(worst)} — that slip in ${phase} decided it.`;
  if (g.reason === 'time') return 'You ran out of time — the position was still a fight.';
  if (peak < 40) return 'They were better from early on — no single big slip, just steady pressure.';
  return worst >= 0 ? `It went wrong at ${at(worst)}, in ${phase}.` : 'A tough game — step through it to see where it slipped.';
}

/** Their threat you missed: the move they were threatening before your move, and what it does. */
export function missedThreat(p: Pick<PlyRecord, 'fenBefore' | 'uci' | 'color'>): { uci: string; san: string; text: string } | null {
  const me = p.color as Color;
  const them = other(me);
  // Mate first.
  const mates = mateThreats(p.fenBefore, them);
  if (mates.length) {
    const san = sanFor(p.fenBefore, mates[0], them);
    return san ? { uci: mates[0], san, text: `They were threatening ${san} — checkmate.` } : null;
  }
  // Else something of yours attacked more times than it is defended (or worth more than its attacker).
  const board = parseFen(p.fenBefore).board;
  let pick: { sq: number; from: number; gain: number } | null = null;
  board.forEach((pc, sq) => {
    if (!pc || pc.color !== me || pc.type === 'k') return;
    const att = attackersOf(board, sq, them);
    if (!att.length) return;
    const def = attackersOf(board, sq, me);
    const cheapest = att.reduce((a, b) => (VALUE[board[a]!.type] <= VALUE[board[b]!.type] ? a : b));
    const loose = !def.length || VALUE[board[cheapest]!.type] < VALUE[pc.type] || att.length > def.length;
    if (loose && (!pick || VALUE[pc.type] > pick.gain)) pick = { sq, from: cheapest, gain: VALUE[pc.type] };
  });
  if (!pick) return null;
  const pk: { sq: number; from: number } = pick;
  const uci = sqName(pk.from) + sqName(pk.sq);
  const san = sanFor(p.fenBefore, uci, them);
  if (!san) return null;
  return { uci, san, text: `They were threatening ${san}, winning your ${NAME[board[pk.sq]!.type]} on ${sqName(pk.sq)}.` };
}

/** "Your bishop on c4 was defended once but attacked twice." for a piece your move left loose. */
export function looseWhy(p: Pick<PlyRecord, 'fenAfter' | 'color'>, square: string): string | null {
  const me = p.color as Color;
  const board = parseFen(p.fenAfter).board;
  const sq = sqIndex(square);
  const pc = board[sq];
  if (!pc) return null;
  const att = attackersOf(board, sq, other(me));
  const def = attackersOf(board, sq, me);
  if (!att.length) return null;
  const who = `Your ${NAME[pc.type]} on ${square}`;
  if (!def.length) return `${who} had no defender, and they attack it with the ${NAME[board[att[0]]!.type]}.`;
  if (att.length > def.length) return `${who} was defended ${times(def.length)} but attacked ${times(att.length)}.`;
  const cheapest = att.reduce((a, b) => (VALUE[board[a]!.type] <= VALUE[board[b]!.type] ? a : b));
  return `${who} is worth more than the ${NAME[board[cheapest]!.type]} attacking it — being defended doesn't save it.`;
}

/** Why a good move worked, from its motifs (null when there is nothing special to say). */
export function goodWhy(p: Pick<PlyRecord, 'fenBefore' | 'uci'>): string | null {
  const board = parseFen(p.fenBefore).board;
  const ms = moveMotifs(p.fenBefore, p.uci);
  const name = (sq: number) => NAME[board[sq]?.type ?? 'p'];
  for (const m of ms) {
    if (m.kind === 'mate') return 'It’s checkmate.';
  }
  for (const m of ms) {
    switch (m.kind) {
      case 'fork': return `It forks the ${m.fork.targets.map(name).join(' and ')}.`;
      case 'skewer': return `It skewers the ${name(m.motif.first)} — the ${name(m.motif.behind)} behind it falls.`;
      case 'pin': return m.motif.absolute ? `It pins the ${name(m.motif.first)} to the king.` : `It pins the ${name(m.motif.first)} to the ${name(m.motif.behind)}.`;
      case 'discovered': return `It uncovers an attack on the ${name(m.d.target)}${m.d.check ? ' — with check' : ''}.`;
      case 'winningCapture':
      case 'freeCapture': return `It wins the ${NAME[m.piece]}.`;
      case 'promotion': return 'It promotes to a queen.';
      default:
    }
  }
  for (const m of ms) if (m.kind === 'escape' || m.kind === 'defend') return `It saves your ${NAME[m.piece]}.`;
  return null;
}

function sanFor(fen: string, uci: string, side: Color): string | null {
  const parts = fen.split(' ');
  parts[1] = side;
  parts[3] = '-';
  try {
    const c = new Chess(parts.join(' '), { skipValidation: true });
    return c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] ?? 'q' }).san;
  } catch {
    return null;
  }
}

/** Coach rule ids by what they say (see coach/rules). */
const IDEA = /^(missed-|save-piece|engine-prefers)/;
const PRINCIPLE = /^(king-walk|early-queen|same-piece-twice|flank-pawn|knight-rim|no-castle)$/;
/** Problem rules that repeat what each cause's "Why:" line already says. */
const SAME_AS_WHY: Record<string, RegExp> = {
  hungPiece: /^(hangs-|loses-material|strong-reply)/,
  missedThreat: /^(hangs-other-piece|allows-mate|loses-material|strong-reply)/,
  missedTactic: /^(strong-reply)/,
  calculation: /^(strong-reply|loses-material)/,
  plan: /^(strong-reply)/,
};

/**
 * The coach sentences worth showing under a move in Game Review, after the verdict, the "Why:"
 * line and the Best / What-it-allows rows: no repeats of those, no filler praise on quiet moves,
 * no opening tips on a best move, and long worded lines cut (the SAN line is shown below).
 */
export function reviewNotes(p: Pick<PlyRecord, 'comment' | 'isUser'>, cls: ReviewClass, cause?: Pick<MistakeCause, 'cause' | 'sq'> | null, why?: string | null, opts: { nice?: boolean; repeatTip?: boolean } = {}): string[] {
  const c = p.comment;
  if (!c || !p.isUser || cls === 'book') return [];
  const ids = c.ruleIds ?? [];
  const items = c.text.map((t, k) => ({ t: tidy(t), id: ids[k] ?? '' })).filter((x) => x.t && x.t !== why);
  if (isBad(cls)) {
    let keep = items;
    if (cause) keep = keep.filter((x) => !SAME_AS_WHY[cause.cause]?.test(x.id));
    // Same square as the loose piece / their threat: already said.
    if (cause?.sq) keep = keep.filter((x) => !x.t.includes(` ${cause.sq}`) || IDEA.test(x.id));
    // The better idea is shown as "Best was:"; its sentence only when nothing else explains.
    const noIdea = keep.filter((x) => !IDEA.test(x.id));
    if (c.bestSan && (why || noIdea.length)) keep = noIdea;
    // "Try Nf3 next time" says nothing the Best row doesn't.
    if (c.bestSan) keep = keep.filter((x) => x.id !== 'engine-prefers');
    if (opts.repeatTip) keep = keep.filter((x) => !PRINCIPLE.test(x.id));
    return keep.slice(0, why ? 1 : 2).map((x) => x.t);
  }
  // Good moves: real praise (a tactic, a capture, castling) only — unless "Why it works" says it.
  // (Moving a piece out of an attack is routine — not worth a pat on the back every time.)
  const praise = items.filter((x) => x.id.startsWith('praise-') && !QUIET_PRAISE.has(x.id));
  if (praise.length) return opts.nice ? [] : [praise[0].t];
  // A gentle principle only on a merely good move, never on the best one, and once per game.
  if (cls === 'good' && !opts.repeatTip) return items.filter((x) => PRINCIPLE.test(x.id)).slice(0, 1).map((x) => x.t);
  return [];
}

const QUIET_PRAISE = new Set(['praise-generic', 'praise-escape', 'praise-defend']);

/** Cut a worded multi-move line "(they push…, you…, then they…)" — the SAN line says it better. */
export function tidy(t: string): string {
  return t
    .replace(/\s*\([^)]*\bthen\b[^)]*\)/g, '')
    .replace(/:\s[^:.]*,[^:.]*\bthen (they|you)\b[^:.]*\./, '.')
    .replace(/^Here's the problem\.\s+/, '')
    .replace(/\s+([,.;])/g, '$1')
    .trim();
}

/**
 * Plies whose opening tip ("castle soon", "don't bring the queen out early") already came up
 * earlier in the game: the review says each tip once.
 */
export function repeatedTips(plies: Pick<PlyRecord, 'comment' | 'isUser'>[]): Set<number> {
  const seen = new Set<string>();
  const out = new Set<number>();
  plies.forEach((p, i) => {
    if (!p.isUser) return;
    const tips = (p.comment?.ruleIds ?? []).slice(0, p.comment?.text.length ?? 0).filter((id) => PRINCIPLE.test(id));
    if (tips.length && tips.every((id) => seen.has(id))) out.add(i);
    tips.forEach((id) => seen.add(id));
  });
  return out;
}

/** "Why:" for a positional slip (no single tactic): what it cost, in plain words. */
export function planWhy(wpBefore: number, wpAfter: number): string {
  if (wpBefore < 30) return 'It was already difficult, and this made it worse — no single trick, just a weaker move.';
  if (wpBefore >= 65) return wpAfter >= 40 ? 'No quick tactic — but it lets much of your advantage slip.' : 'No quick tactic — but it throws your advantage away.';
  return wpAfter < 35 ? 'No quick tactic — it just hands them a clearly better game.' : 'No quick tactic — it just gives them the easier game.';
}

/**
 * Rough playing strength shown in one game, from the average centipawn loss against the same
 * benchmark of human games used for the bots (≥ 15 counted moves, else null). Capped at 2000:
 * the benchmark has no stronger games to compare with.
 */
const RATING_CURVE: [number, number][] = [[178, 200], [132, 400], [115, 600], [92, 800], [82, 1000], [72, 1200], [66, 1400], [60, 1600], [52, 1800], [42, 2000]];
export function gameRating(losses: number[]): number | null {
  if (losses.length < 15) return null;
  const avg = losses.reduce((a, b) => a + Math.min(b, 1000), 0) / losses.length;
  if (avg >= RATING_CURVE[0][0]) return 100 * Math.round(Math.max(100, 200 - (avg - 178)) / 100);
  for (let k = 1; k < RATING_CURVE.length; k++) {
    const [l0, r0] = RATING_CURVE[k - 1];
    const [l1, r1] = RATING_CURVE[k];
    if (avg >= l1) return 50 * Math.round((r0 + ((l0 - avg) / (l0 - l1)) * (r1 - r0)) / 50);
  }
  return 2000;
}

/** Centipawn loss of each counted move by one side (book and forced-mate positions skipped). */
export function cpLosses(g: Pick<AnyGame, 'plies'>, r: Review, mine: boolean): number[] {
  const out: number[] = [];
  let prev: PlyRecord['evalAfter'] | undefined = { type: 'cp', value: 0 };
  g.plies.forEach((p, i) => {
    const e = p.evalAfter;
    if (p.isUser === mine && r.plies[i].cls !== 'book' && prev?.type === 'cp' && e?.type === 'cp' && Math.abs(prev.value) < 1000) {
      const sign = p.color === 'w' ? 1 : -1;
      out.push(Math.max(0, sign * (prev.value - e.value)));
    }
    if (e) prev = e;
  });
  return out;
}
