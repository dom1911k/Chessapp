// "What is my opponent threatening?" — imagine the opponent could move again
// right now (a null move) and describe their best idea.
import { Chess } from 'chess.js';
import { povScore } from '../chess/evaluation';
import { formatLine, lineToSan } from '../chess/game';
import { applyUci, attackersOf, hangingPieces, other, parseFen, PIECE_NAME, sqIndex, sqName, type Color } from '../chess/pos';
import type { AnalysisResult } from '../engine/types';
import { describeLine, mateThreats, moveMotifs } from './tactics';
import type { CoachArrow, CoachHighlight } from './types';

export interface ThreatInfo {
  text: string;
  arrows: CoachArrow[];
  highlights: CoachHighlight[];
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
  const san = lineToSan(nf, [uci])[0] ?? uci;
  const arrows: CoachArrow[] = [{ from: uci.slice(0, 2), to: uci.slice(2, 4), tone: 'bad' }];
  const info = describeLine(nf, pv);
  const s = analysis?.lines[0] ? povScore(analysis.lines[0].score, other(me)) : null;
  const before = parseFen(nf).board;
  const after = applyUci(before, uci);
  const name = (sq: number, b = after) => PIECE_NAME[b[sq]?.type ?? 'p'];

  if (info.matesIn || (s?.type === 'mate' && s.value > 0 && s.value <= 3)) {
    const n = info.matesIn ?? (s as { value: number }).value;
    return {
      text: n === 1 ? `Your opponent threatens ${san} — checkmate! You must stop it.` : `Danger: your opponent threatens a checkmate starting with ${san}.`,
      arrows,
      highlights: [],
    };
  }
  const gain = info.materialGain;
  if (gain >= 1) {
    for (const m of moveMotifs(nf, uci)) {
      if (m.kind === 'fork') {
        const [a, b] = m.fork.targets.map((t) => name(t));
        return { text: `Your opponent threatens ${san}, forking your ${a} and ${b}.`, arrows: [...arrows, ...m.fork.targets.map((t) => ({ from: uci.slice(2, 4), to: sqName(t), tone: 'bad' as const }))], highlights: [] };
      }
      if (m.kind === 'freeCapture' || m.kind === 'winningCapture')
        return {
          text: `Your ${PIECE_NAME[m.piece]} on ${sqName(m.sq)} is in danger — ${san} would win it${m.kind === 'freeCapture' ? ' for free' : ''}.`,
          arrows,
          highlights: [{ sq: sqName(m.sq), tone: 'bad' }],
        };
      if (m.kind === 'pin') return { text: `Your opponent threatens ${san}, pinning your ${name(m.motif.first)}.`, arrows, highlights: [] };
      if (m.kind === 'skewer') return { text: `Your opponent threatens ${san}, a skewer against your ${name(m.motif.first)}.`, arrows, highlights: [] };
      if (m.kind === 'discovered') return { text: `Watch out for ${san}: it uncovers an attack on your ${name(m.d.target)}.`, arrows, highlights: [] };
    }
    const line = formatLine(nf, info.san.slice(0, Math.min(info.plies, 4)));
    return { text: `Your opponent threatens ${line}, winning material.`, arrows, highlights: [] };
  }
  // Nothing concrete: mention any of our pieces that are simply under attack.
  const attacked = hangingPieces(parseFen(fen).board, me)[0];
  if (attacked)
    return { text: `Your ${name(attacked.sq, before)} on ${sqName(attacked.sq)} is under attack.`, arrows, highlights: [{ sq: sqName(attacked.sq), tone: 'bad' }] };
  return {
    text: `No direct threat right now — your opponent's best idea is ${san}. You're free to make your own plan!`,
    arrows: [{ ...arrows[0], tone: 'info' }],
    highlights: [],
  };
}

/** A short note when the bot's last move creates a threat against you (static, no engine). */
export function botMoveNote(fenBefore: string, fenAfter: string, botUci: string, me: Color): ThreatInfo | null {
  const c = new Chess(fenAfter);
  if (c.isGameOver()) return null;
  const to = botUci.slice(2, 4);
  if (c.inCheck()) return { text: 'Check! Your king is attacked — you have to deal with that first.', arrows: [], highlights: [] };
  const bot = other(me);
  const mates = mateThreats(fenAfter, bot);
  if (mates.length)
    return {
      text: 'The bot threatens checkmate! Find a way to defend.',
      arrows: mates.slice(0, 1).map((u) => ({ from: u.slice(0, 2), to: u.slice(2, 4), tone: 'bad' as const })),
      highlights: [],
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
        ? `The bot's ${PIECE_NAME[after[sqIndex(to)]!.type]} now attacks your ${piece} on ${sqName(h.sq)}. What will you do?`
        : `After the bot's move, your ${piece} on ${sqName(h.sq)} is under attack. What will you do?`,
      arrows: attackersOf(after, h.sq, bot).slice(0, 2).map((a) => ({ from: sqName(a), to: sqName(h.sq), tone: 'bad' as const })),
      highlights: [{ sq: sqName(h.sq), tone: 'bad' }],
    };
  }
  return null;
}
