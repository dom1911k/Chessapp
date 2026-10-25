import { Chess } from 'chess.js';
// Opening principles. Only active in normal games during the first moves.
import { fileOf, sqIndex } from '../../chess/pos';
import { t } from '../templates';
import type { Rule } from './rule';

const inOpening = (n: number) => (c: { isStandardGame: boolean; ownMoveNumber: number }) =>
  c.isStandardGame && c.ownMoveNumber <= n;

export const principleRules: Rule[] = [
  {
    id: 'king-walk',
    kind: 'principle',
    theme: 'kingSafety',
    detect(c) {
      if (!inOpening(15)(c) || c.move.piece !== 'k' || c.move.isKingsideCastle() || c.move.isQueensideCastle()) return null;
      if (c.input.fenBefore.split(' ')[2] === '-') return null; // castling already gone
      const rights = c.input.fenBefore.split(' ')[2];
      if (!(c.mover === 'w' ? /[KQ]/ : /[kq]/).test(rights)) return null;
      if (c.move.captured || isInCheck(c.input.fenBefore)) return null;
      return { text: t('kingWalk', {}, c.seed) };
    },
  },
  {
    id: 'early-queen',
    kind: 'principle',
    theme: 'opening',
    detect(c) {
      if (!inOpening(6)(c) || c.move.piece !== 'q' || c.move.captured || c.undevelopedMinors() < 3) return null;
      return { text: t('earlyQueen', {}, c.seed) };
    },
  },
  {
    id: 'same-piece-twice',
    kind: 'principle',
    theme: 'opening',
    detect(c) {
      if (!inOpening(8)(c) || c.move.captured || c.move.piece === 'p' || c.move.piece === 'k') return null;
      if (c.undevelopedMinors() < 2) return null;
      if (!c.ownPreviousMoves.some((u) => u.slice(2, 4) === c.move.from)) return null;
      // Moving a threatened piece again is fine.
      if (c.playedMotifs().some((m) => m.kind === 'escape')) return null;
      return { text: t('samePieceTwice', { piece: c.name(c.move.piece) }, c.seed) };
    },
  },
  {
    id: 'flank-pawn',
    kind: 'principle',
    theme: 'opening',
    detect(c) {
      if (!inOpening(3)(c) || c.move.piece !== 'p' || c.move.captured) return null;
      const f = fileOf(sqIndex(c.move.from));
      if (f >= 2 && f <= 5) return null;
      if (['b3', 'g3', 'b6', 'g6'].includes(c.move.to)) return null; // fianchetto is fine
      return { text: t('flankPawn', { move: c.move.san }, c.seed) };
    },
  },
  {
    id: 'knight-rim',
    kind: 'principle',
    theme: 'opening',
    detect(c) {
      if (!inOpening(10)(c) || c.move.piece !== 'n' || c.move.captured) return null;
      if (!['a', 'h'].includes(c.move.to[0])) return null;
      return { text: t('knightRim', { sq: c.move.to }, c.seed) };
    },
  },
  {
    id: 'no-castle',
    kind: 'principle',
    theme: 'kingSafety',
    detect(c) {
      if (!c.isStandardGame || c.ownMoveNumber < 10 || c.ownMoveNumber > 16) return null;
      if (c.move.piece === 'k') return null;
      const k = c.mover === 'w' ? 'e1' : 'e8';
      const p = c.boardBefore[sqIndex(k)];
      if (!p || p.type !== 'k' || p.color !== c.mover) return null;
      const rights = c.input.fenBefore.split(' ')[2];
      if (!(c.mover === 'w' ? /[KQ]/ : /[kq]/).test(rights)) return null;
      return { text: t('noCastle', {}, c.seed) };
    },
  },
];

function isInCheck(fen: string) {
  return new Chess(fen).inCheck();
}
