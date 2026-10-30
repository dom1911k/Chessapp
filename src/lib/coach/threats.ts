// "What is my opponent threatening?" — imagine the opponent could move again
// right now (a null move) and describe their best idea.
import { Chess } from 'chess.js';
import { povScore } from '../chess/evaluation';
import { lineWords, moveWords } from '../chess/words';
import { applyUci, attackersOf, hangingPieces, other, parseFen, PIECE_NAME, sqIndex, sqName, type Color } from '../chess/pos';
import type { AnalysisResult } from '../engine/types';
import { describeLine, mateThreats, moveMotifs } from './tactics';
import type { CoachArrow, CoachHighlight } from './types';

export interface ThreatInfo {
  text: string;
  arrows: CoachArrow[];
  highlights: CoachHighlight[];
  /** What the note is about (bot-move notes only), so a gentle coach can skip the small stuff. */
  level?: 'check' | 'mate' | 'pawn' | 'piece';
}

/** FEN with the other side to move, or null if that's impossible (you're in check). */
export function nullMoveFen(fen: string): string | null {
  if (new Chess(fen).inCheck()) return null;
  const p = fen.split(' ');
  p[1] = p[1] === 'w' ? 'b' : 'w';
  p[3] = '-';
  return p.join(' ');
}

export function describeThreat(fen: string, analysis: AnalysisResult | null): ThreatInfo {
  const me = fen.split(' ')[1] as Color;
  if (new Chess(fen).inCheck()) return { text: "You're in check — first get your king to safety.", arrows: [], highlights: [] };
  const nf = nullMoveFen(fen)!;
  const pv = analysis?.lines[0]?.pv ?? [];
  const uci = pv[0];
  if (!uci) return { text: "Your opponent has no real threat right now.", arrows: [], highlights: [] };
  const want = moveWords(nf, uci, 'they', 'inf', false);
  const arrows: CoachArrow[] = [{ from: uci.slice(0, 2), to: uci.slice(2, 4), tone: 'bad' }];
  const info = describeLine(nf, pv);
  const s = analysis?.lines[0] ? povScore(analysis.lines[0].score, other(me)) : null;
  const before = parseFen(nf).board;
  const after = applyUci(before, uci);
  const name = (sq: number, b = after) => PIECE_NAME[b[sq]?.type ?? 'p'];

  if (info.matesIn || (s?.type === 'mate' && s.value > 0 && s.value <= 3)) {
    const n = info.matesIn ?? (s as { value: number }).value;
    return {
      text: n === 1 ? `They want to ${want} — that would be checkmate! You have to stop it.` : `Danger! They're setting up a checkmate, starting with: they ${want}.`,
      arrows,
      highlights: [],
    };
  }
  const gain = info.materialGain;
  if (gain >= 1) {
    for (const m of moveMotifs(nf, uci)) {
      if (m.kind === 'fork') {
        const [a, b] = m.fork.targets.map((t) => name(t));
        return { text: `They want to ${want} and attack your ${a} and ${b} at the same time.`, arrows: [...arrows, ...m.fork.targets.map((t) => ({ from: uci.slice(2, 4), to: sqName(t), tone: 'bad' as const }))], highlights: [] };
      }
      if (m.kind === 'freeCapture' || m.kind === 'winningCapture')
        return {
          text: `Your ${PIECE_NAME[m.piece]} on ${sqName(m.sq)} is in danger — they could win it${m.kind === 'freeCapture' ? ' for free' : ''}.`,
          arrows,
          highlights: [{ sq: sqName(m.sq), tone: 'bad' }],
        };
      if (m.kind === 'pin') return { text: `They want to ${want} and pin your ${name(m.motif.first)}.`, arrows, highlights: [] };
      if (m.kind === 'skewer') return { text: `They want to ${want} and attack your ${name(m.motif.first)} with something behind it.`, arrows, highlights: [] };
      if (m.kind === 'discovered') return { text: `Watch out: they could ${want} and open up a hidden attack on your ${name(m.d.target)}.`, arrows, highlights: [] };
    }
    const line = lineWords(nf, pv, Math.min(info.plies, 3), 'they');
    return { text: `They have a plan to win something: ${line}.`, arrows, highlights: [] };
  }
  // Nothing concrete: mention any of our pieces that are simply under attack.
  const attacked = hangingPieces(parseFen(fen).board, me)[0];
  if (attacked)
    return { text: `Your ${name(attacked.sq, before)} on ${sqName(attacked.sq)} is under attack.`, arrows, highlights: [{ sq: sqName(attacked.sq), tone: 'bad' }] };
  return {
    text: `No real danger right now. Their best idea is to ${want} — but you're free to make your own plan!`,
    arrows: [{ ...arrows[0], tone: 'info' }],
    highlights: [],
  };
}

/** A short note when the bot's last move creates a threat against you (static, no engine). */
export function botMoveNote(fenBefore: string, fenAfter: string, botUci: string, me: Color, who = 'the bot'): ThreatInfo | null {
  const Who = who[0].toUpperCase() + who.slice(1);
  const whose = who === 'the bot' ? "the bot's" : `${who}'s`;
  const c = new Chess(fenAfter);
  if (c.isGameOver()) return null;
  const to = botUci.slice(2, 4);
  if (c.inCheck()) return { text: 'Check! Your king is attacked — you have to deal with that first.', arrows: [], highlights: [], level: 'check' };
  const bot = other(me);
  const mates = mateThreats(fenAfter, bot);
  if (mates.length)
    return {
      text: `${Who} threatens checkmate! Find a way to defend.`,
      arrows: mates.slice(0, 1).map((u) => ({ from: u.slice(0, 2), to: u.slice(2, 4), tone: 'bad' as const })),
      highlights: [],
      level: 'mate',
    };
  const before = parseFen(fenBefore).board;
  const after = parseFen(fenAfter).board;
  const wasHanging = new Set(hangingPieces(before, me).map((h) => h.sq));
  const fresh = hangingPieces(after, me).filter((h) => !wasHanging.has(h.sq));
  if (fresh.length) {
    const h = fresh[0];
    const attackerFromMove = attackersOf(after, h.sq, bot).includes(sqIndex(to));
    const piece = PIECE_NAME[after[h.sq]!.type];
    return {
      text: attackerFromMove
        ? `${whose[0].toUpperCase() + whose.slice(1)} ${PIECE_NAME[after[sqIndex(to)]!.type]} now attacks your ${piece} on ${sqName(h.sq)}. What will you do?`
        : `After ${whose} move, your ${piece} on ${sqName(h.sq)} is under attack. What will you do?`,
      arrows: attackersOf(after, h.sq, bot).slice(0, 2).map((a) => ({ from: sqName(a), to: sqName(h.sq), tone: 'bad' as const })),
      highlights: [{ sq: sqName(h.sq), tone: 'bad' }],
      level: after[h.sq]!.type === 'p' ? 'pawn' : 'piece',
    };
  }
  return null;
}
