// "Explain this move" for the Game Review: a deep, concrete explanation of one move, built from two
// engine searches (the position before the move with several candidate lines, and the position after
// it). It answers: what happened, why it was good or bad (the exact tactic, the material it costs,
// the mate it allows), what was better and why, other good options, and what to remember. It also
// returns the lines so the screen can play them out on a board. Pure: no engine calls in here.
import { Chess } from 'chess.js';
import { parseUci } from '../chess/game';
import { applyUci, hangingPieces, materialBalance, other, parseFen, PIECE_NAME, sqName, VALUE, type Color, type PieceType } from '../chess/pos';
import { formatScore, povScore, scoreToCp, winPct, type Score } from '../chess/evaluation';
import { moveWords } from '../chess/words';
import type { AnalysisResult } from '../engine/types';
import { THEMES } from '../themes';
import { describeLine, moveMotifs, type Motif } from './tactics';
import type { Theme } from './types';

export interface ExplainLine {
  id: string;
  /** Short label for the line picker ("After Ng5", "Best: Nf3"). */
  label: string;
  /** The position the line starts from. */
  fen: string;
  uci: string[];
  san: string[];
  /** Engine score at the end of the search, from the mover's side ("+0.6"). */
  score?: string;
  tone: 'bad' | 'good' | 'info';
}

export interface ExplainSection {
  title: string;
  points: string[];
}

export interface DeepExplanation {
  /** One line: "Ng5 is a blunder — it loses your knight." */
  headline: string;
  /** Winning chances of the mover before → after, and the evals as text. */
  swing: { wpBefore: number; wpAfter: number; before: string; after: string };
  sections: ExplainSection[];
  lines: ExplainLine[];
  themes: Theme[];
  /** A general rule to take away, when one fits. */
  lesson?: { theme: Theme; text: string };
}

export type Verdict = 'brilliant' | 'great' | 'best' | 'excellent' | 'good' | 'book' | 'inaccuracy' | 'mistake' | 'miss' | 'blunder';
const BAD: Verdict[] = ['inaccuracy', 'mistake', 'miss', 'blunder'];
const VERDICT_WORD: Record<Verdict, string> = {
  brilliant: 'a brilliant move',
  great: 'a great move',
  best: 'the best move',
  excellent: 'an excellent move',
  good: 'a good move',
  book: 'a book move',
  inaccuracy: 'an inaccuracy',
  mistake: 'a mistake',
  miss: 'a missed chance',
  blunder: 'a blunder',
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const pname = (t: PieceType | null | undefined) => (t ? PIECE_NAME[t] : 'piece');

function sanOf(fen: string, uci: string): string {
  try {
    return new Chess(fen).move(parseUci(uci)).san;
  } catch {
    return uci;
  }
}

/** SAN of a line, stopping at the first illegal move. */
function sanLine(fen: string, line: string[], max = 99): string[] {
  const c = new Chess(fen);
  const out: string[] = [];
  for (const u of line.slice(0, max)) {
    try {
      out.push(c.move(parseUci(u)).san);
    } catch {
      break;
    }
  }
  return out;
}

/** "12. Nf3 Nc6 13. Bb5" from a FEN and SAN moves. */
export function numbered(fen: string, san: string[]): string {
  const parts = fen.split(' ');
  let no = Number(parts[5] ?? 1);
  let white = parts[1] === 'w';
  const out: string[] = [];
  san.forEach((m, i) => {
    if (white) out.push(`${no}. ${m}`);
    else out.push(i === 0 ? `${no}… ${m}` : m);
    if (!white) no++;
    white = !white;
  });
  return out.join(' ');
}

/** How a position stands for one side, in words, with the number. */
export function standing(s: Score, color: Color): string {
  const p = povScore(s, color);
  if (p.type === 'mate') return p.value > 0 ? `a forced mate in ${p.value}` : p.value < 0 ? `getting mated in ${-p.value}` : 'checkmate';
  const cp = p.value;
  const n = `${formatScore(p)}`;
  if (Math.abs(cp) < 40) return `about equal (${n})`;
  const side = cp > 0 ? 'better' : 'worse';
  if (Math.abs(cp) < 120) return `slightly ${side} (${n})`;
  if (Math.abs(cp) < 300) return `clearly ${side} (${n})`;
  return cp > 0 ? `winning (${n})` : `losing (${n})`;
}

/** A tactic created by a move, in a sentence fragment ("forks your queen and rook"). */
function motifPhrase(fen: string, uci: string, m: Motif, mover: 'you' | 'they'): { text: string; theme: Theme } | null {
  const after = applyUci(parseFen(fen).board, uci);
  const victims = mover === 'you' ? 'their' : 'your';
  const at = (sq: number) => `${victims} ${pname(after[sq]?.type)} on ${sqName(sq)}`;
  switch (m.kind) {
    case 'mate':
      return { text: 'is checkmate', theme: 'mateIn1' };
    case 'fork':
      return { text: `attacks two pieces at once — a fork of ${m.fork.targets.map(at).join(' and ')}`, theme: 'fork' };
    case 'pin':
      // Only pins that matter: against the king, or onto something worth more than the pinned piece.
      if (!m.motif.absolute && (after[m.motif.first]?.type === 'p' || VALUE[after[m.motif.first]?.type ?? 'p'] >= VALUE[after[m.motif.behind]?.type ?? 'p'])) return null;
      return { text: `pins ${at(m.motif.first)} to ${victims} ${pname(after[m.motif.behind]?.type)}${m.motif.absolute ? ' (it can’t legally move)' : ''}`, theme: 'pin' };
    case 'skewer':
      return { text: `skewers ${at(m.motif.first)}: when it moves, the ${pname(after[m.motif.behind]?.type)} behind it falls`, theme: 'skewer' };
    case 'discovered':
      return { text: `uncovers an attack by the ${pname(after[m.d.slider]?.type)} on ${at(m.d.target)}${m.d.check ? ' with check' : ''}`, theme: 'discoveredAttack' };
    case 'freeCapture':
      return { text: `takes ${victims} unprotected ${pname(m.piece)} for free`, theme: 'hangingPiece' };
    case 'winningCapture':
      return { text: `wins ${victims} ${pname(m.piece)} — it wasn’t defended enough`, theme: 'material' };
    case 'promotion':
      return { text: 'promotes a pawn', theme: 'promotion' };
    default:
      return null;
  }
}

/** The strongest tactic a move creates, if any. */
function bestMotif(fen: string, uci: string, mover: 'you' | 'they') {
  const order: Motif['kind'][] = ['mate', 'fork', 'discovered', 'skewer', 'pin', 'freeCapture', 'winningCapture', 'promotion'];
  const ms = moveMotifs(fen, uci).sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  for (const m of ms) {
    const p = motifPhrase(fen, uci, m, mover);
    if (p) return p;
  }
  return null;
}

const VALUE_WORD = (n: number) => (n >= 8 ? 'a queen’s worth' : n >= 5 ? 'a rook’s worth' : n >= 3 ? 'a piece' : n >= 2 ? 'two pawns' : 'a pawn');

export interface ExplainInput {
  fenBefore: string;
  uci: string;
  /** Was the move yours (the review's player) or the opponent's? */
  isUser: boolean;
  verdict: Verdict;
  /** Search of the position before the move, ideally with 3 lines (multipv). */
  before: AnalysisResult;
  /** Search of the position after the move (its best line is the reply). */
  after: AnalysisResult;
}

export function explainInDepth(o: ExplainInput): DeepExplanation {
  const { fenBefore, uci, isUser, verdict } = o;
  const mover: Color = fenBefore.split(' ')[1] as Color;
  const who: 'you' | 'they' = isUser ? 'you' : 'they';
  const opp: 'you' | 'they' = isUser ? 'they' : 'you';
  const yours = isUser ? 'your' : 'their';
  const san = sanOf(fenBefore, uci);
  const c = new Chess(fenBefore);
  c.move(parseUci(uci));
  const fenAfter = c.fen();
  const bad = BAD.includes(verdict);

  const beforeTop = o.before.lines[0];
  const afterTop = o.after.lines[0];
  const sBefore: Score = beforeTop?.score ?? { type: 'cp', value: 0 };
  const sAfter: Score = afterTop?.score ?? sBefore;
  const wpBefore = Math.round(winPct(povScore(sBefore, mover)));
  const wpAfter = Math.round(winPct(povScore(sAfter, mover)));
  const themes: Theme[] = [];
  const sections: ExplainSection[] = [];
  const lines: ExplainLine[] = [];

  const reply = afterTop?.pv ?? [];
  const best = beforeTop?.pv ?? [];
  const bestUci = best[0];
  const isBest = bestUci === uci;
  const bestSan = bestUci ? sanOf(fenBefore, bestUci) : null;

  // 1. What happened.
  const happened = [
    `${san}: ${moveWords(fenBefore, uci, who, 'ger')}.`,
    `Before it, ${isUser ? 'you were' : 'your opponent was'} ${standing(sBefore, mover)}; after it, ${standing(sAfter, mover)}.`,
  ];
  if (Math.abs(wpBefore - wpAfter) >= 3) happened.push(`${isUser ? 'Your' : 'Their'} winning chances went from ${wpBefore}% to ${wpAfter}%.`);
  sections.push({ title: 'What happened', points: happened });

  // 2. Why — the concrete reason.
  const why: string[] = [];
  let headlineReason = '';
  if (bad && reply.length) {
    const info = describeLine(fenAfter, reply, 10);
    const replySan = sanOf(fenAfter, reply[0]);
    const line = numbered(fenAfter, info.san.slice(0, Math.max(3, info.matesIn ? info.matesIn * 2 - 1 : 5)));
    if (info.matesIn) {
      themes.push(info.endsInBackRankMate ? 'backRankMate' : 'mate');
      why.push(`It allows a forced checkmate in ${info.matesIn}${info.endsInBackRankMate ? ' on the back rank' : ''}: ${line}.`);
      headlineReason = `it allows mate in ${info.matesIn}`;
    }
    // Pieces the move left hanging.
    const hang = hangingPieces(parseFen(fenAfter).board, mover).filter((h) => h.loss >= 2);
    if (hang.length && !info.matesIn) {
      const h = hang[0];
      const piece = parseFen(fenAfter).board[h.sq]?.type;
      themes.push('hangingPiece');
      why.push(`${cap(yours)} ${pname(piece)} on ${sqName(h.sq)} is left hanging — it’s attacked and not defended well enough.`);
      headlineReason ||= `it leaves ${yours} ${pname(piece)} hanging`;
    }
    // The reply's tactic.
    const tactic = bestMotif(fenAfter, reply[0], opp);
    if (tactic && !info.matesIn) {
      themes.push(tactic.theme);
      why.push(`${isUser ? 'Their' : 'Your'} best answer ${replySan} ${tactic.text}.`);
      headlineReason ||= tactic.theme === 'fork' ? 'it allows a fork' : tactic.theme === 'pin' ? 'it allows a pin' : tactic.theme === 'skewer' ? 'it allows a skewer' : '';
    }
    // What it costs.
    if (!info.matesIn && info.materialGain >= 1) {
      themes.push('material');
      why.push(`After ${line}, ${opp === 'you' ? 'you' : 'they'} come out ${VALUE_WORD(info.materialGain)} ahead${info.victim ? ` (${isUser ? 'you' : 'they'} lose a ${pname(info.victim)})` : ''}.`);
      headlineReason ||= info.victim ? `it loses ${yours} ${pname(info.victim)}` : `it loses ${VALUE_WORD(info.materialGain)}`;
    }
    if (!why.length) {
      why.push(`There’s no single trick — but ${replySan} leaves ${isUser ? 'them' : 'you'} much better placed. The engine’s main line: ${line}.`);
      if (verdict === 'inaccuracy') why.push('Inaccuracies are small slips: the position is still playable, just a little harder than it needed to be.');
    }
  } else if (!bad) {
    const line = [uci, ...reply];
    const info = describeLine(fenBefore, line, 10);
    const tactic = bestMotif(fenBefore, uci, who);
    if (info.matesIn) {
      themes.push('mate');
      why.push(`It forces checkmate in ${info.matesIn}: ${numbered(fenBefore, info.san.slice(0, info.matesIn * 2 - 1))}.`);
    }
    if (tactic && !info.matesIn) {
      themes.push(tactic.theme);
      why.push(`${san} ${tactic.text}.`);
    }
    if (!info.matesIn && info.materialGain >= 1) why.push(`After ${numbered(fenBefore, info.san.slice(0, 5))}, ${who === 'you' ? 'you' : 'they'} come out ${VALUE_WORD(info.materialGain)} ahead.`);
    if (verdict === 'brilliant') why.push('It gives up material on purpose — and the follow-up proves it works. That’s what makes it brilliant.');
    if (verdict === 'great') why.push('It was the only move that kept the advantage — every other move let it slip.');
    if (verdict === 'book') why.push('It’s a known opening move, played by strong players for a long time.');
    if (!why.length) why.push(isBest ? 'It’s the engine’s first choice: it keeps everything in order and improves the position.' : `A solid move — it keeps the position ${standing(sAfter, mover).split(' (')[0]}.`);
  }
  if (why.length) sections.push({ title: bad ? `Why it’s ${VERDICT_WORD[verdict]}` : 'Why it works', points: why });

  // 3. For the opponent's mistakes: how to punish them (the reply is your best move).
  if (bad && !isUser && reply.length) {
    const punish = bestMotif(fenAfter, reply[0], 'you');
    const replySan = sanOf(fenAfter, reply[0]);
    sections.push({
      title: 'How to punish it',
      points: [
        `${replySan} is the answer${punish ? ` — it ${punish.text}` : ''}.`,
        `The line: ${numbered(fenAfter, sanLine(fenAfter, reply, 5))}.`,
      ],
    });
  }

  // 4. What was better (for your moves), with the reason.
  if (!isBest && bestUci && bestSan && (bad || isUser)) {
    const info = describeLine(fenBefore, best, 10);
    const tactic = bestMotif(fenBefore, bestUci, who);
    const better: string[] = [];
    const diff = Math.abs(scoreToCp(povScore(sBefore, mover)) - scoreToCp(povScore(sAfter, mover)));
    better.push(`${bestSan} was best — ${isUser ? 'you' : 'they'} would have stayed ${standing(sBefore, mover)}${diff >= 30 && diff < 5000 ? `, about ${(diff / 100).toFixed(1)} pawns more than after ${san}` : ''}.`);
    if (info.matesIn) better.push(`It forces checkmate in ${info.matesIn}: ${numbered(fenBefore, info.san.slice(0, info.matesIn * 2 - 1))}.`);
    else if (tactic) better.push(`${bestSan} ${tactic.text}.`);
    else if (info.materialGain >= 1) better.push(`It wins material: ${numbered(fenBefore, info.san.slice(0, 5))}.`);
    else better.push(`The idea: ${numbered(fenBefore, sanLine(fenBefore, best, 5))}.`);
    if (tactic && isUser && bad) headlineReason ||= `you missed ${bestSan}`;
    sections.push({ title: isUser ? 'What was better' : 'What they should have played', points: better });
  }

  // 5. Other good moves (within a pawn of the best).
  const bestCp = scoreToCp(povScore(sBefore, mover));
  const alts = o.before.lines
    .slice(0, 4)
    .filter((l) => l.pv[0] && l.pv[0] !== bestUci && l.pv[0] !== uci && bestCp - scoreToCp(povScore(l.score, mover)) <= 100);
  if (alts.length && isUser) {
    sections.push({
      title: 'Other good moves',
      points: alts.slice(0, 2).map((l) => `${sanOf(fenBefore, l.pv[0])} (${formatScore(povScore(l.score, mover))}) — ${numbered(fenBefore, sanLine(fenBefore, l.pv, 3))}`),
    });
  }

  // Lines to play out on the board.
  if (reply.length || !bad) {
    const playedLine = [uci, ...reply].slice(0, 9);
    lines.push({
      id: 'played',
      label: bad ? (isUser ? `After ${san}` : `Punish ${san}`) : `${san} →`,
      fen: fenBefore,
      uci: playedLine,
      san: sanLine(fenBefore, playedLine),
      score: formatScore(povScore(sAfter, mover)),
      tone: bad ? 'bad' : 'good',
    });
  }
  if (!isBest && bestUci) {
    const l = best.slice(0, 9);
    lines.push({ id: 'best', label: `Best: ${bestSan}`, fen: fenBefore, uci: l, san: sanLine(fenBefore, l), score: formatScore(povScore(sBefore, mover)), tone: 'good' });
  }
  alts.slice(0, 2).forEach((a, k) => {
    const l = a.pv.slice(0, 9);
    lines.push({ id: `alt${k}`, label: sanOf(fenBefore, a.pv[0]), fen: fenBefore, uci: l, san: sanLine(fenBefore, l), score: formatScore(povScore(a.score, mover)), tone: 'info' });
  });

  const uniq = [...new Set(themes)];
  const lessonTheme = bad ? uniq.find((t) => THEMES[t]?.lesson) : undefined;
  const lesson = lessonTheme ? { theme: lessonTheme, text: THEMES[lessonTheme].lesson } : undefined;
  if (lesson) sections.push({ title: 'Remember', points: [lesson.text] });

  const headline = `${san} is ${VERDICT_WORD[verdict]}${headlineReason ? ` — ${headlineReason}` : ''}.`;
  return {
    headline,
    swing: { wpBefore, wpAfter, before: formatScore(povScore(sBefore, mover)), after: formatScore(povScore(sAfter, mover)) },
    sections,
    lines,
    themes: uniq,
    lesson,
  };
}


export interface LineNote {
  san: string;
  /** "3… Qxg5" */
  label: string;
  who: 'you' | 'they';
  /** One to three sentences on what this move does and what it means. */
  text: string;
  /** Material from your side, relative to the start of the line (in pawns; +3 = a piece up). */
  material: number;
  tags: ('check' | 'mate' | 'capture' | 'tactic' | 'threat' | 'defence')[];
}

const MATERIAL_WORD = (n: number) => {
  const a = Math.abs(n);
  const what = a >= 9 ? 'a queen' : a >= 5 ? 'a rook' : a === 4 ? 'a piece and a pawn' : a === 3 ? 'a piece' : a === 2 ? 'two pawns' : 'a pawn';
  return n > 0 ? `you’re ${what} up` : `you’re ${what} down`;
};

/**
 * Move-by-move commentary on a line (chess.com's "follow-up"): who plays what, the tactic it uses,
 * what it attacks now, whether it saves a piece, check and mate, and how material stands for you
 * after each move. `you` is the reader's colour.
 */
export function annotateLine(fen: string, line: string[], you: Color): LineNote[] {
  const c = new Chess(fen);
  const start = materialBalance(parseFen(fen).board, you);
  let lastMaterial = 0;
  const notes: LineNote[] = [];
  const parts = fen.split(' ');
  let no = Number(parts[5] ?? 1);
  for (const uci of line) {
    const fenBefore = c.fen();
    const mover = c.turn() as Color;
    const who: 'you' | 'they' = mover === you ? 'you' : 'they';
    let m;
    try {
      m = c.move(parseUci(uci));
    } catch {
      break;
    }
    const label = mover === 'w' ? `${no}. ${m.san}` : `${no}… ${m.san}`;
    if (mover === 'b') no++;
    const tags: LineNote['tags'] = [];
    const sentences: string[] = [];
    const Subj = who === 'you' ? 'You' : 'They';
    sentences.push(`${Subj} ${moveWords(fenBefore, uci, who, 'inf', false)}.`);
    if (m.captured) tags.push('capture');

    if (c.isCheckmate()) {
      tags.push('mate');
      sentences.push(who === 'you' ? 'Checkmate — you win.' : 'Checkmate.');
    } else {
      const motifs = moveMotifs(fenBefore, uci);
      const tactic = bestMotif(fenBefore, uci, who);
      if (tactic && tactic.theme !== 'material' && tactic.theme !== 'hangingPiece' && tactic.theme !== 'mateIn1') {
        tags.push('tactic');
        sentences.push(`It ${tactic.text}.`);
      } else if (motifs.some((x) => x.kind === 'freeCapture')) sentences.push('That piece was unprotected — a free win.');
      const saved = m.captured ? undefined : motifs.find((x) => x.kind === 'escape' || x.kind === 'defend');
      if (saved && (saved.kind === 'escape' || saved.kind === 'defend')) {
        tags.push('defence');
        sentences.push(saved.kind === 'escape' ? `It gets the ${pname(saved.piece)} out of danger.` : `It protects the ${pname(saved.piece)} on ${sqName(saved.sq)}.`);
      }
      // What it attacks now (a piece of the other side that can be won), unless a tactic already said so.
      if (!tags.includes('tactic')) {
        const boardBefore = parseFen(fenBefore).board;
        const already = new Set(hangingPieces(boardBefore, other(mover)).map((h) => h.sq));
        const now = hangingPieces(parseFen(c.fen()).board, other(mover)).filter((h) => !already.has(h.sq) && h.loss >= 1);
        if (now.length) {
          const h = now[0];
          const piece = parseFen(c.fen()).board[h.sq]?.type;
          tags.push('threat');
          sentences.push(`Now ${who === 'you' ? 'their' : 'your'} ${pname(piece)} on ${sqName(h.sq)} is under attack${who === 'you' ? '' : ' — it needs to move or be defended'}.`);
        }
      }
      // And what it leaves loose on its own side.
      {
        const before = new Set(hangingPieces(parseFen(fenBefore).board, mover).map((h) => h.sq));
        const loose = hangingPieces(parseFen(c.fen()).board, mover).filter((h) => !before.has(h.sq) && h.loss >= 2);
        if (loose.length) {
          const piece = parseFen(c.fen()).board[loose[0].sq]?.type;
          sentences.push(who === 'you' ? `But your ${pname(piece)} on ${sqName(loose[0].sq)} can now be taken.` : `But it leaves their ${pname(piece)} on ${sqName(loose[0].sq)} loose — you can take it.`);
        }
      }
      if (m.san.includes('+')) {
        tags.push('check');
        sentences.push(who === 'you' ? 'Check — they have to deal with it first.' : 'Check — you have to deal with it first.');
      }
    }
    const mat = materialBalance(parseFen(c.fen()).board, you) - start;
    if (mat !== lastMaterial) sentences.push(mat === 0 ? 'Material is level again.' : `Material: ${MATERIAL_WORD(mat)}.`);
    lastMaterial = mat;
    notes.push({ san: m.san, label, who, text: sentences.join(' '), material: mat, tags });
    if (c.isGameOver()) break;
  }
  return notes;
}
