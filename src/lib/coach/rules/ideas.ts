// "What was the better idea": rules that read the engine's best line before your move.
import { applyUci, hangingPieces } from '../../chess/pos';
import { t } from '../templates';
import type { CoachContext } from '../context';
import type { Rule, RuleResult } from './rule';
import type { Motif } from '../tactics';

const bestArrow = (c: CoachContext) =>
  c.bestUci ? [{ from: c.bestUci.slice(0, 2), to: c.bestUci.slice(2, 4), tone: 'good' as const }] : [];

function motifIdea(c: CoachContext, m: Motif): RuleResult | null {
  const after = applyUci(c.boardBefore, c.bestUci!);
  const move = c.bestSan ?? '';
  switch (m.kind) {
    case 'fork': {
      const [a, b] = m.fork.targets.map((s) => c.name(after[s]?.type));
      return {
        theme: 'fork',
        text: t('missedFork', { move, t1: a, t2: b }, c.seed),
        arrows: [...bestArrow(c), ...m.fork.targets.map((s) => ({ from: c.bestUci!.slice(2, 4), to: c.sq(s), tone: 'info' as const }))],
      };
    }
    case 'pin':
      return {
        theme: 'pin',
        text: t('missedPin', { move, pinned: c.name(after[m.motif.first]?.type), behind: c.name(after[m.motif.behind]?.type) }, c.seed),
        arrows: bestArrow(c),
      };
    case 'skewer':
      return {
        theme: 'skewer',
        text: t('missedSkewer', { move, front: c.name(after[m.motif.first]?.type), behind: c.name(after[m.motif.behind]?.type) }, c.seed),
        arrows: bestArrow(c),
      };
    case 'discovered':
      return {
        theme: 'discoveredAttack',
        text: t('missedDiscovered', { move, slider: c.name(after[m.d.slider]?.type), target: c.name(after[m.d.target]?.type) }, c.seed),
        arrows: [...bestArrow(c), { from: c.sq(m.d.slider), to: c.sq(m.d.target), tone: 'info' }],
      };
    default:
      return null;
  }
}

export const ideaRules: Rule[] = [
  {
    id: 'missed-mate',
    kind: 'idea',
    theme: 'mate',
    detect(c) {
      const s = c.scoreBefore();
      const info = c.bestInfo();
      const n = info?.matesIn ?? (s?.type === 'mate' && s.value > 0 ? s.value : null);
      if (!n || n > 3) return null;
      // Still mating after the played move? Then it isn't really "missed".
      const a = c.scoreAfter();
      if (a?.type === 'mate' && a.value > 0 && a.value <= n) return null;
      const move = c.bestSan ?? '';
      if (n === 1)
        return {
          theme: info?.endsInBackRankMate ? 'backRankMate' : 'mateIn1',
          text: t(info?.endsInBackRankMate ? 'missedBackRank' : 'missedMate1', { move }, c.seed),
          arrows: bestArrow(c),
        };
      return {
        theme: n === 2 ? 'mateIn2' : 'mate',
        text: t('missedMate', { n, line: c.line(c.input.fenBefore, c.bestLine, n * 2 - 1) }, c.seed),
        arrows: bestArrow(c),
      };
    },
  },
  {
    id: 'save-piece',
    kind: 'idea',
    theme: 'defense',
    detect(c) {
      const saves = c.bestMotifs().find((m) => m.kind === 'escape' || m.kind === 'defend');
      if (!saves || (saves.kind !== 'escape' && saves.kind !== 'defend')) return null;
      // Only if the played move left that piece hanging.
      const stillHanging = hangingPieces(c.boardAfter, c.mover).some((h) => h.sq === saves.sq || (saves.kind === 'escape' && h.sq === c.to && c.from === saves.sq));
      if (!stillHanging) return null;
      return {
        text: t('savePiece', { move: c.bestSan ?? '', piece: c.name(saves.piece), sq: c.sq(saves.sq) }, c.seed),
        arrows: bestArrow(c),
        highlights: [{ sq: c.sq(saves.sq), tone: 'info' }],
      };
    },
  },
  {
    id: 'missed-free-capture',
    kind: 'idea',
    theme: 'hangingPiece',
    detect(c) {
      const m = c.bestMotifs().find((x) => x.kind === 'freeCapture' || x.kind === 'winningCapture');
      if (!m || (m.kind !== 'freeCapture' && m.kind !== 'winningCapture') || (m.piece === 'p' && m.kind === 'winningCapture')) return null;
      if (c.input.uci === c.bestUci) return null;
      return {
        text: t(m.kind === 'freeCapture' ? 'missedFree' : 'missedWinningCapture', { move: c.bestSan ?? '', piece: c.name(m.piece), sq: c.sq(m.sq) }, c.seed),
        arrows: bestArrow(c),
      };
    },
  },
  {
    id: 'missed-tactic',
    kind: 'idea',
    theme: 'fork',
    detect(c) {
      if ((c.bestInfo()?.materialGain ?? 0) < 2) return null;
      for (const kind of ['fork', 'skewer', 'discovered', 'pin'] as const) {
        const m = c.bestMotifs().find((x) => x.kind === kind);
        if (m) return motifIdea(c, m);
      }
      return null;
    },
  },
  {
    id: 'engine-prefers',
    kind: 'idea',
    theme: 'material',
    detect(c) {
      if (!c.bestUci || c.bestUci === c.input.uci) return null;
      const info = c.bestInfo();
      const line = c.line(c.input.fenBefore, c.bestLine, 4);
      if (info && info.materialGain >= 1 && (c.refInfo()?.materialGain ?? 0) <= 0)
        return { text: t('fallbackMaterial', { move: c.bestSan ?? '', line }, c.seed), arrows: bestArrow(c) };
      const wp = c.wpBefore ?? 50;
      const state = wp > 70 ? 'clearly better' : wp > 55 ? 'a bit better' : wp >= 45 ? 'balanced' : 'as solid as possible';
      return { text: t('fallbackKeep', { move: c.bestSan ?? '', state, line }, c.seed), arrows: bestArrow(c) };
    },
  },
];

export { motifIdea };
