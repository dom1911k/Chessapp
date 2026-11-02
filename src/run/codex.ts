// The Codex: chess techniques as cards you learn (lesson + learning check), equip before a run
// (up to codexSlots) and fire by executing them with a sound move. Detectors are pure.
import { Chess, type Square } from 'chess.js';
import { moveMotifs } from '../lib/coach/tactics';
import { TUNING as T } from './tuning';
import type { MapNode, RoomKind } from './types';

export type TechId = 'fork' | 'pin' | 'skewer' | 'discovered' | 'backrank' | 'smothered' | 'promotion' | 'opposition';
export type TechLevel = 'novice' | 'adept' | 'master';

/** Where a move was played (some techniques only count in certain rooms). */
export interface TechCtx {
  kind: RoomKind | 'event';
  goal?: MapNode['goal'];
}

export interface Technique {
  id: TechId;
  name: string;
  /** 3–5 sentences. */
  lesson: string[];
  /** Example: a position and the move that shows the idea. */
  example: { fen: string; uci: string };
  /** Lichess puzzle theme for the learning check. */
  theme: string;
  glyph: string;
  /** Rooms where it tends to come up (map weighting): riddle themes and/or vault/harvest. */
  affinity: { riddle?: string; vault?: boolean; gain?: boolean; kpVault?: boolean };
  detect: (fenBefore: string, uci: string, ctx: TechCtx) => boolean;
}

const play = (fen: string, uci: string) => {
  const c = new Chess(fen);
  try {
    const m = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    return { c, m };
  } catch {
    return null;
  }
};
const motif = (kind: 'fork' | 'pin' | 'skewer' | 'discovered') => (fen: string, uci: string) => {
  try {
    return moveMotifs(fen, uci).some((x) => x.kind === kind);
  } catch {
    return false;
  }
};
const kingSq = (c: Chess, color: 'w' | 'b') => c.board().flat().find((p) => p && p.type === 'k' && p.color === color)?.square;
const around = (sq: string) => {
  const f = sq.charCodeAt(0) - 97;
  const r = Number(sq[1]);
  const out: string[] = [];
  for (let df = -1; df <= 1; df++)
    for (let dr = -1; dr <= 1; dr++) {
      if (!df && !dr) continue;
      const ff = f + df;
      const rr = r + dr;
      if (ff >= 0 && ff < 8 && rr >= 1 && rr <= 8) out.push(`${String.fromCharCode(97 + ff)}${rr}`);
    }
  return out;
};

/** Back-rank mate: checkmate by a rook or queen along the mated king's back rank. */
export function isBackRankMate(fen: string, uci: string): boolean {
  const r = play(fen, uci);
  if (!r || !r.c.isCheckmate()) return false;
  const loser = r.c.turn();
  const k = kingSq(r.c, loser);
  const back = loser === 'w' ? '1' : '8';
  if (!k || k[1] !== back) return false;
  const checkers = r.c.attackers(k as Square, loser === 'w' ? 'b' : 'w');
  return checkers.some((sq) => {
    const p = r.c.get(sq as Square);
    return !!p && (p.type === 'r' || p.type === 'q') && sq[1] === back;
  });
}

/** Smothered mate: a knight mates a king boxed in by its own pieces. */
export function isSmotheredMate(fen: string, uci: string): boolean {
  const r = play(fen, uci);
  if (!r || !r.c.isCheckmate()) return false;
  const loser = r.c.turn();
  const k = kingSq(r.c, loser);
  if (!k) return false;
  const checkers = r.c.attackers(k as Square, loser === 'w' ? 'b' : 'w');
  if (!checkers.length || !checkers.every((sq) => r.c.get(sq as Square)?.type === 'n')) return false;
  return around(k).every((sq) => r.c.get(sq as Square)?.color === loser);
}

/** Promotion race: promoting in a Vault or a Harvest: Gain room. */
export function isPromotionRace(fen: string, uci: string, ctx: TechCtx): boolean {
  if (!(ctx.kind === 'vault' || (ctx.kind === 'convert' && ctx.goal === 'gain'))) return false;
  const r = play(fen, uci);
  return !!r?.m.promotion;
}

/** Opposition: in a king-and-pawn Vault, a king move that faces the enemy king with one square between. */
export function isOpposition(fen: string, uci: string, ctx: TechCtx): boolean {
  if (ctx.kind !== 'vault') return false;
  const r = play(fen, uci);
  if (!r || r.m.piece !== 'k') return false;
  if (r.c.board().flat().some((p) => p && p.type !== 'k' && p.type !== 'p')) return false;
  const me = r.m.color;
  const a = kingSq(r.c, me)!;
  const b = kingSq(r.c, me === 'w' ? 'b' : 'w')!;
  const df = Math.abs(a.charCodeAt(0) - b.charCodeAt(0));
  const dr = Math.abs(Number(a[1]) - Number(b[1]));
  return (df === 0 && dr === 2) || (dr === 0 && df === 2);
}

export const TECHNIQUES: Technique[] = [
  {
    id: 'fork',
    name: 'Fork',
    glyph: 'fork',
    theme: 'fork',
    affinity: { riddle: 'fork' },
    lesson: [
      'A fork is one piece attacking two (or more) enemy pieces at once.',
      'Your opponent can only save one of them, so you win the other.',
      'Knights are the classic forkers because they jump and attack in an odd pattern.',
      'Look for checks first: a fork that also gives check is almost always winning.',
    ],
    example: { fen: 'r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1', uci: 'b5c7' },
    detect: (f, u) => motif('fork')(f, u),
  },
  {
    id: 'pin',
    name: 'Pin',
    glyph: 'pin',
    theme: 'pin',
    affinity: { riddle: 'pin' },
    lesson: [
      'A pin attacks a piece that cannot move without exposing something more valuable behind it.',
      'If the piece behind is the king, the pinned piece may not move at all.',
      'Bishops, rooks and queens pin along lines and diagonals.',
      'Once a piece is pinned, attack it again: it cannot run away.',
    ],
    example: { fen: '4k3/8/2n5/8/8/8/8/4KB2 w - - 0 1', uci: 'f1b5' },
    detect: (f, u) => motif('pin')(f, u),
  },
  {
    id: 'skewer',
    name: 'Skewer',
    glyph: 'bow',
    theme: 'skewer',
    affinity: { riddle: 'skewer' },
    lesson: [
      'A skewer is a pin turned around: the valuable piece is in front.',
      'When it moves out of the way, you take the piece behind it.',
      'Checks along a file or diagonal are the strongest skewers — the king must move.',
    ],
    example: { fen: '3q4/8/8/3k4/8/8/8/R5K1 w - - 0 1', uci: 'a1d1' },
    detect: (f, u) => motif('skewer')(f, u),
  },
  {
    id: 'discovered',
    name: 'Discovered Attack',
    glyph: 'eye',
    theme: 'discoveredAttack',
    affinity: { riddle: 'discoveredAttack' },
    lesson: [
      'A discovered attack happens when one piece moves out of the way and uncovers an attack by another.',
      'The moving piece can make its own threat at the same time — two threats in one move.',
      'If the uncovered attack is a check, the opponent must deal with it first and loses the other piece.',
    ],
    example: { fen: 'q3k3/8/8/8/8/8/4B3/4R1K1 w - - 0 1', uci: 'e2f3' },
    detect: (f, u) => motif('discovered')(f, u),
  },
  {
    id: 'backrank',
    name: 'Back-Rank Mate',
    glyph: 'tower',
    theme: 'backRankMate',
    affinity: { riddle: 'backRankMate' },
    lesson: [
      'A king behind its own pawns on the back rank has no escape squares.',
      'A rook or queen landing on that rank with check is mate.',
      'Before attacking, check that nothing can block or capture on the back rank.',
      'And for your own king: a little "luft" (one pawn moved) prevents this.',
    ],
    example: { fen: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', uci: 'a1a8' },
    detect: (f, u) => isBackRankMate(f, u),
  },
  {
    id: 'smothered',
    name: 'Smothered Mate',
    glyph: 'crystal',
    theme: 'smotheredMate',
    affinity: { riddle: 'smotheredMate' },
    lesson: [
      'A smothered mate is delivered by a knight against a king surrounded by its own pieces.',
      'The king cannot move because its own pieces block every square.',
      'Knight checks cannot be blocked, so if the knight cannot be taken it is mate.',
    ],
    example: { fen: '6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1', uci: 'g5f7' },
    detect: (f, u) => isSmotheredMate(f, u),
  },
  {
    id: 'promotion',
    name: 'Promotion Race',
    glyph: 'crown',
    theme: 'promotion',
    affinity: { vault: true, gain: true },
    lesson: [
      'In the endgame, a pawn that reaches the last rank becomes a queen.',
      'Count the moves: your pawn to its promotion square against their king (or pawn) to stop it.',
      'Push a passed pawn whenever the enemy king is out of its "square".',
      'Fires when you promote in a Vault or a Harvest: Gain room.',
    ],
    example: { fen: '8/1P4k1/8/8/8/8/8/K7 w - - 0 1', uci: 'b7b8q' },
    detect: (f, u, ctx) => isPromotionRace(f, u, ctx),
  },
  {
    id: 'opposition',
    name: 'Opposition',
    glyph: 'king',
    theme: 'pawnEndgame',
    affinity: { kpVault: true },
    lesson: [
      'In king-and-pawn endings, kings face each other with one square between them.',
      'Whoever has to move then must give way — so you want the other side to move.',
      'Stepping into that position is "taking the opposition".',
      'It decides whether a pawn promotes or the game is a draw. Fires in king-and-pawn Vaults.',
    ],
    example: { fen: '8/8/4k3/8/3K4/4P3/8/8 w - - 0 1', uci: 'd4e4' },
    detect: (f, u, ctx) => isOpposition(f, u, ctx),
  },
];
export const techById = (id: TechId) => TECHNIQUES.find((t) => t.id === id)!;

/** Mastery: uses → level. */
export const techLevel = (uses = 0): TechLevel => (uses >= T.codex.masterUses ? 'master' : uses >= T.codex.adeptUses ? 'adept' : 'novice');
/** The ×mult a technique fires with at its level. */
export const techMult = (uses = 0) => T.codex.mult[techLevel(uses)];

/** Equipped techniques this (sound) move executes. */
export function techniquesIn(equipped: TechId[], fenBefore: string, uci: string, ctx: TechCtx): TechId[] {
  return equipped.filter((id) => techById(id).detect(fenBefore, uci, ctx));
}

/** Map bias from equipped techniques: rooms where they can occur are a little likelier. */
export function techAffinity(equipped: TechId[], key: string): number {
  const w = T.codex.mapWeight;
  const ts = equipped.map(techById);
  if (key === 'riddle' || key.startsWith('riddle:')) return ts.some((t) => t.affinity.riddle && (key === 'riddle' || key === `riddle:${t.affinity.riddle}`)) ? w : 1;
  if (key.startsWith('vault:')) return ts.some((t) => t.affinity.vault || (t.affinity.kpVault && key.startsWith('vault:kpk'))) ? w : 1;
  if (key === 'gain') return ts.some((t) => t.affinity.gain) ? w : 1;
  return 1;
}

/** Relics that a learned technique replaces (so the systems don't double-count). */
export const REPLACES: Partial<Record<TechId, 'forkmaster' | 'pins'>> = { fork: 'forkmaster', pin: 'pins' };
