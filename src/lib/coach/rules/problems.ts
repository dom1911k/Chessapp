// "What goes wrong": rules that read the opponent's best reply after your move.
import type { CoachContext } from '../context';
import { applyUci, attackersOf, fileOf, hangingPieces, kingSquare, rankOf, see, sqIndex, VALUE } from '../../chess/pos';
import { t } from '../templates';
import type { Rule } from './rule';

const victimText = (v: string | null, gain: number) => {
  if (v === 'q') return 'your queen';
  if (v === 'r' && gain <= 3) return 'the exchange';
  if (v === 'r') return 'a rook';
  if (v === 'b') return 'a bishop';
  if (v === 'n') return 'a knight';
  if (gain >= 2) return `${gain} pawns`;
  return 'a pawn';
};

export const problemRules: Rule[] = [
  {
    id: 'allows-mate',
    kind: 'problem',
    theme: 'mate',
    detect(c) {
      const s = c.scoreAfter();
      if (!s || s.type !== 'mate' || s.value >= 0 || -s.value > 5) return null;
      const info = c.refInfo();
      const opp = c.refSan ?? '';
      const arrows = c.refLine[0] ? [{ from: c.refLine[0].slice(0, 2), to: c.refLine[0].slice(2, 4), tone: 'bad' as const }] : [];
      if (info?.endsInBackRankMate)
        return {
          theme: 'backRankMate',
          text:
            info.matesIn === 1
              ? t('allowsBackRankMate', { oppMove: opp }, c.seed)
              : t('allowsBackRankMateLine', { line: c.line(c.fenAfter, c.refLine, info.plies) }, c.seed),
          arrows,
        };
      return {
        theme: -s.value === 1 ? 'mateIn1' : -s.value === 2 ? 'mateIn2' : 'mate',
        text: t('allowsMate', { opp: c.oppName, line: c.line(c.fenAfter, c.refLine, -s.value * 2 - 1) }, c.seed),
        arrows,
      };
    },
  },
  {
    id: 'bad-trade',
    kind: 'problem',
    theme: 'trade',
    detect(c) {
      const cap = c.move.captured;
      if (!cap || c.move.isEnPassant()) return null;
      const lost = see(c.boardAfter, c.to, c.opp);
      const net = VALUE[cap] - lost;
      if (net >= 0 || lost === 0) return null;
      if (c.refLine[0]?.slice(2, 4) !== c.move.to) return null;
      return {
        text: t('badTrade', { captured: c.name(cap), piece: c.name(c.move.piece), opp: c.oppName }, c.seed),
        arrows: [{ from: c.refLine[0].slice(0, 2), to: c.move.to, tone: 'bad' }],
        highlights: [{ sq: c.move.to, tone: 'bad' }],
      };
    },
  },
  {
    id: 'hangs-moved-piece',
    kind: 'problem',
    theme: 'hangingPiece',
    detect(c) {
      const reply = c.refLine[0];
      if (!reply || reply.slice(2, 4) !== c.move.to) return null;
      const piece = c.boardAfter[c.to];
      if (!piece || piece.type === 'k' || see(c.boardAfter, c.to, c.opp) <= 0) return null;
      const attackerType = c.boardAfter[sqIndex(reply.slice(0, 2))]?.type;
      const defended = attackersOf(c.boardAfter, c.to, c.mover).length > 0;
      const vars = { piece: c.name(piece.type), sq: c.move.to, opp: c.oppName, oppMove: c.refSan ?? '', attacker: c.name(attackerType) };
      return {
        text: t(defended ? 'hangsMovedDefended' : 'hangsMovedFree', vars, c.seed),
        arrows: [{ from: reply.slice(0, 2), to: reply.slice(2, 4), tone: 'bad' }],
        highlights: [{ sq: c.move.to, tone: 'bad' }],
      };
    },
  },
  {
    id: 'allows-fork',
    kind: 'problem',
    theme: 'fork',
    detect(c) {
      const f = c.refMotifs().find((m) => m.kind === 'fork');
      if (!f || f.kind !== 'fork' || (c.refInfo()?.materialGain ?? 0) < 2) return null;
      const reply = c.refLine[0];
      const after = applyReply(c);
      const [a, b] = f.fork.targets.map((s) => c.name(after[s]?.type)).sort(byKingFirst);
      return {
        text: t('allowsFork', { oppMove: c.refSan ?? '', attacker: c.name(after[f.fork.attacker]?.type), t1: a, t2: b }, c.seed),
        arrows: [
          { from: reply.slice(0, 2), to: reply.slice(2, 4), tone: 'bad' },
          ...f.fork.targets.map((s) => ({ from: reply.slice(2, 4), to: c.sq(s), tone: 'bad' as const })),
        ],
      };
    },
  },
  {
    id: 'allows-pin',
    kind: 'problem',
    theme: 'pin',
    detect(c) {
      const m = c.refMotifs().find((x) => x.kind === 'pin');
      if (!m || m.kind !== 'pin' || (c.refInfo()?.materialGain ?? 0) < 2) return null;
      const after = applyReply(c);
      return {
        text: t('allowsPin', { oppMove: c.refSan ?? '', pinned: c.name(after[m.motif.first]?.type), behind: c.name(after[m.motif.behind]?.type) }, c.seed),
        arrows: [{ from: c.sq(m.motif.pinner), to: c.sq(m.motif.behind), tone: 'bad' }],
        highlights: [{ sq: c.sq(m.motif.first), tone: 'bad' }],
      };
    },
  },
  {
    id: 'allows-skewer',
    kind: 'problem',
    theme: 'skewer',
    detect(c) {
      const m = c.refMotifs().find((x) => x.kind === 'skewer');
      if (!m || m.kind !== 'skewer' || (c.refInfo()?.materialGain ?? 0) < 2) return null;
      const after = applyReply(c);
      return {
        text: t('allowsSkewer', { oppMove: c.refSan ?? '', front: c.name(after[m.motif.first]?.type), behind: c.name(after[m.motif.behind]?.type) }, c.seed),
        arrows: [{ from: c.sq(m.motif.pinner), to: c.sq(m.motif.behind), tone: 'bad' }],
      };
    },
  },
  {
    id: 'allows-discovered',
    kind: 'problem',
    theme: 'discoveredAttack',
    detect(c) {
      const m = c.refMotifs().find((x) => x.kind === 'discovered');
      if (!m || m.kind !== 'discovered' || (c.refInfo()?.materialGain ?? 0) < 2) return null;
      const after = applyReply(c);
      return {
        text: t('allowsDiscovered', { oppMove: c.refSan ?? '', slider: c.name(after[m.d.slider]?.type), target: c.name(after[m.d.target]?.type) }, c.seed),
        arrows: [{ from: c.sq(m.d.slider), to: c.sq(m.d.target), tone: 'bad' }],
      };
    },
  },
  {
    id: 'hangs-other-piece',
    kind: 'problem',
    theme: 'hangingPiece',
    detect(c) {
      const reply = c.refLine[0];
      if (!reply) return null;
      const target = sqIndex(reply.slice(2, 4));
      const piece = c.boardAfter[target];
      if (!piece || piece.color !== c.mover || target === c.to || piece.type === 'k') return null;
      if (see(c.boardAfter, target, c.opp) <= 0) return null;
      const info = c.refInfo();
      if (info && info.materialGain < 1) return null;
      const vars = { piece: c.name(piece.type), sq: c.sq(target), moved: c.name(c.move.piece), oppMove: c.refSan ?? '' };
      const wasHanging = see(c.boardBefore, target, c.opp) > 0;
      const wasDefender = attackersOf(c.boardBefore, target, c.mover).includes(c.from);
      const key = wasHanging ? 'ignoredThreat' : wasDefender ? 'removedDefender' : 'leavesHanging';
      return {
        theme: wasHanging ? 'defense' : 'hangingPiece',
        text: t(key, vars, c.seed),
        arrows: [{ from: reply.slice(0, 2), to: reply.slice(2, 4), tone: 'bad' }],
        highlights: [{ sq: c.sq(target), tone: 'bad' }],
      };
    },
  },
  {
    id: 'weakens-king',
    kind: 'problem',
    theme: 'kingSafety',
    detect(c) {
      if (c.move.piece !== 'p') return null;
      const k = kingSquare(c.boardBefore, c.mover);
      const homeRank = c.mover === 'w' ? 0 : 7;
      if (rankOf(k) !== homeRank || Math.abs(fileOf(k) - 4) < 2) return null; // only castled-ish kings
      if (Math.abs(fileOf(c.from) - fileOf(k)) > 1) return null;
      if (Math.abs(rankOf(c.from) - homeRank) > 2) return null;
      const reply = c.refMotifs();
      if (!reply.some((m) => m.kind === 'check' || m.kind === 'mate') && (c.scoreAfter()?.type !== 'mate')) {
        // Require that the reply line contains a check somewhere.
        if (!(c.refInfo()?.san ?? []).some((s) => s.includes('+'))) return null;
      }
      return { text: t('weakensKing', { oppMove: c.refSan ?? '' }, c.seed) };
    },
  },
  {
    id: 'loses-material',
    kind: 'problem',
    theme: 'material',
    detect(c) {
      const info = c.refInfo();
      if (!info || info.materialGain < 2) return null;
      // Is anything of ours hanging right away? Point at it.
      const hang = hangingPieces(c.boardAfter, c.mover)[0];
      return {
        text: t('losesMaterial', {
          line: c.line(c.fenAfter, c.refLine, Math.min(info.plies, 5)),
          victim: victimText(info.victim, info.materialGain),
          opp: c.oppName,
          oppMove: c.refSan ?? '',
        }, c.seed).replace('you end up your queen down', 'you lose your queen'),
        highlights: hang ? [{ sq: c.sq(hang.sq), tone: 'bad' }] : [],
      };
    },
  },
  {
    id: 'strong-reply',
    kind: 'problem',
    theme: 'material',
    detect(c) {
      if (!c.refLine.length) return null;
      return {
        text: t('strongReply', { opp: c.oppName, line: c.line(c.fenAfter, c.refLine, 3), oppMove: c.refSan ?? '' }, c.seed),
        arrows: [{ from: c.refLine[0].slice(0, 2), to: c.refLine[0].slice(2, 4), tone: 'bad' }],
      };
    },
  },
];

const ORDER = ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn'];
function byKingFirst(a: string, b: string) {
  return ORDER.indexOf(a) - ORDER.indexOf(b);
}

function applyReply(c: CoachContext) {
  return applyUci(c.boardAfter, c.refLine[0]);
}
