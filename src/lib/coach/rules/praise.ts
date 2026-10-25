// Short positive notes for good moves.
import { applyUci, materialBalance, VALUE } from '../../chess/pos';
import { t } from '../templates';
import type { Rule } from './rule';

export const praiseRules: Rule[] = [
  {
    id: 'praise-mate',
    kind: 'praise',
    theme: 'mate',
    detect: (c) => (c.playedMotifs().some((m) => m.kind === 'mate') ? { text: t('praiseMate', {}, c.seed) } : null),
  },
  {
    id: 'praise-tactic',
    kind: 'praise',
    theme: 'fork',
    detect(c) {
      const after = applyUci(c.boardBefore, c.input.uci);
      const gainsSomething = (c.refInfo()?.materialGain ?? 0) <= -2 || (c.bestInfo()?.materialGain ?? 0) >= 2;
      if (!gainsSomething) return null;
      for (const m of c.playedMotifs()) {
        if (m.kind === 'fork') return { theme: 'fork', text: t('praiseFork', { attacker: c.name(after[m.fork.attacker]?.type) }, c.seed) };
        if (m.kind === 'skewer') return { theme: 'skewer', text: t('praiseSkewer', {}, c.seed) };
        if (m.kind === 'discovered') return { theme: 'discoveredAttack', text: t('praiseDiscovered', {}, c.seed) };
        if (m.kind === 'pin') return { theme: 'pin', text: t('praisePin', { pinned: c.name(after[m.motif.first]?.type) }, c.seed) };
      }
      return null;
    },
  },
  {
    id: 'praise-capture',
    kind: 'praise',
    theme: 'hangingPiece',
    detect(c) {
      const m = c.playedMotifs().find((x) => x.kind === 'freeCapture' || x.kind === 'winningCapture');
      if (!m || (m.kind !== 'freeCapture' && m.kind !== 'winningCapture')) return null;
      if (m.kind === 'freeCapture' && m.piece === 'p') return null;
      return { text: t(m.kind === 'freeCapture' ? 'praiseFree' : 'praiseWin', { piece: c.name(m.piece) }, c.seed) };
    },
  },
  {
    id: 'praise-escape',
    kind: 'praise',
    theme: 'defense',
    detect(c) {
      const m = c.playedMotifs().find((x) => x.kind === 'escape' || x.kind === 'defend');
      if (!m || (m.kind !== 'escape' && m.kind !== 'defend')) return null;
      if (m.piece === 'p') return null;
      return { text: t(m.kind === 'escape' ? 'praiseEscape' : 'praiseDefend', { piece: c.name(m.piece), sq: c.sq(m.sq) }, c.seed) };
    },
  },
  {
    id: 'praise-trade-ahead',
    kind: 'praise',
    theme: 'material',
    detect(c) {
      const cap = c.move.captured;
      if (!cap || c.move.piece === 'p' || c.move.piece === 'k' || VALUE[cap] !== VALUE[c.move.piece]) return null;
      if (materialBalance(c.boardBefore, c.mover) < 3) return null;
      return { text: t('praiseTradeAhead', {}, c.seed) };
    },
  },
  {
    id: 'praise-castle',
    kind: 'praise',
    theme: 'kingSafety',
    detect: (c) => (c.playedMotifs().some((m) => m.kind === 'castle') ? { text: t('praiseCastle', {}, c.seed) } : null),
  },
];
