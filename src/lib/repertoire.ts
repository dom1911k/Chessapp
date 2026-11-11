// Your opening repertoire: ready-made systems for White and Black, plus lines you record
// yourself. The trainer plays the other side's moves and you answer from memory.
import { Chess } from 'chess.js';
import { kvGet, kvSet, today } from './db';

export interface RepLine {
  id: string;
  name: string;
  /** The side you play in this line. */
  color: 'w' | 'b';
  /** SAN moves from the starting position, space separated. */
  moves: string;
  /** The idea in a sentence. */
  idea?: string;
  custom?: boolean;
}

export interface RepSystem {
  id: string;
  name: string;
  /** Which slot of a repertoire it fills. */
  slot: 'white' | 'e4' | 'd4';
  blurb: string;
  lines: RepLine[];
}

export const SLOTS: { id: RepSystem['slot']; label: string; sub: string }[] = [
  { id: 'white', label: 'With White', sub: 'Your first move and the setup behind it' },
  { id: 'e4', label: 'With Black against 1.e4', sub: 'Your answer to the king’s pawn' },
  { id: 'd4', label: 'With Black against 1.d4', sub: 'Your answer to the queen’s pawn' },
];

const L = (id: string, name: string, color: 'w' | 'b', moves: string, idea: string): RepLine => ({ id, name, color, moves, idea });

export const SYSTEMS: RepSystem[] = [
  {
    id: 'italian', name: 'Italian Game', slot: 'white', blurb: '1.e4 with fast development and a slow build-up. The best first opening.',
    lines: [
      L('it-main', 'Giuoco Pianissimo', 'w', 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O Re1 a6 Bb3 Ba7 h3', 'c3 and d3 first, castle, Re1 — then Nbd2–f1–g3 and d4.'),
      L('it-two', 'Against the Two Knights', 'w', 'e4 e5 Nf3 Nc6 Bc4 Nf6 d3 Bc5 c3 d6 O-O O-O Re1', 'd3 keeps e4 safe and avoids the sharp Ng5 lines.'),
      L('it-hung', 'Against …Be7', 'w', 'e4 e5 Nf3 Nc6 Bc4 Be7 d4 exd4 Nxd4', 'When Black is passive, open the centre with d4.'),
      L('it-sic', 'Against the Sicilian: Alapin', 'w', 'e4 c5 c3 Nf6 e5 Nd5 d4 cxd4 Nf3 Nc6 cxd4 d6 Bc4', 'c3 prepares d4 and keeps the game in your kind of position.'),
      L('it-fr', 'Against the French: Advance', 'w', 'e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6 a3', 'Hold the d4 pawn with c3 and Nf3; a3 prepares b4.'),
      L('it-ck', 'Against the Caro-Kann: Advance', 'w', 'e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2 c5 Be3', 'Simple development; your space advantage lasts.'),
    ],
  },
  {
    id: 'london', name: 'London System', slot: 'white', blurb: '1.d4 and Bf4: one setup against almost everything.',
    lines: [
      L('lo-main', 'Main setup', 'w', 'd4 d5 Bf4 Nf6 e3 e6 Nf3 c5 c3 Nc6 Nbd2 Bd6 Bg3 O-O Bd3', 'Bishop out before e3; meet …Bd6 with Bg3.'),
      L('lo-qb6', 'Against …c5 and …Qb6', 'w', 'd4 d5 Bf4 c5 e3 Nc6 c3 Qb6 Qb3', 'Qb3 answers the attack on b2.'),
      L('lo-kid', 'Against the King’s Indian setup', 'w', 'd4 Nf6 Bf4 g6 e3 Bg7 Nf3 O-O Be2 d6 h3', 'h3 gives the bishop a retreat on h2.'),
    ],
  },
  {
    id: 'qg', name: 'Queen’s Gambit', slot: 'white', blurb: '1.d4 and 2.c4: classical pressure on the centre.',
    lines: [
      L('qg-qgd', 'Queen’s Gambit Declined', 'w', 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 h6 Bh4 b6 cxd5', 'Develop, pin the knight, then fix the centre with cxd5.'),
      L('qg-qga', 'Queen’s Gambit Accepted', 'w', 'd4 d5 c4 dxc4 e3 Nf6 Bxc4 e6 Nf3 c5 O-O', 'e3 wins the pawn back at once.'),
      L('qg-slav', 'Slav Defence', 'w', 'd4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4 Bf5 e3', 'a4 stops …b5; e3 and Bxc4 regain the pawn.'),
    ],
  },
  {
    id: 'e5', name: '1…e5: the open games', slot: 'e4', blurb: 'Meet 1.e4 with 1…e5. Principled, and the best school.',
    lines: [
      L('e5-it', 'Against the Italian', 'b', 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O', 'Mirror White’s development; …a6 and …Ba7 keep the bishop.'),
      L('e5-ng5', 'Against Ng5 (Two Knights)', 'b', 'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Na5 Bb5+ c6 dxc6 bxc6', '…d5 and …Na5! — never …Nxd5, which allows the Fried Liver.'),
      L('e5-ruy', 'Against the Ruy Lopez', 'b', 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O', 'The Closed Ruy: …a6, …Nf6, …Be7, …b5, …d6, castle.'),
      L('e5-sc', 'Against the Scotch', 'b', 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nxc6 bxc6 e5 Qe7 Qe2 Nd5', '…Nf6 hits e4; after e5 the queen pins the pawn.'),
    ],
  },
  {
    id: 'caro', name: 'Caro-Kann', slot: 'e4', blurb: '…c6 and …d5: a solid centre with a good bishop.',
    lines: [
      L('ck-adv', 'Advance Variation', 'b', 'e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2 c5', 'Bishop out to f5 first, then …e6 and …c5.'),
      L('ck-cl', 'Classical', 'b', 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6 Nf3 Nd7', '…Bf5–g6, …h6 to keep the bishop, …Nd7 against Ne5.'),
      L('ck-ex', 'Exchange', 'b', 'e4 c6 d4 d5 exd5 cxd5 Bd3 Nc6 c3 Nf6 Bf4 Bg4', 'Natural development; the bishop goes to g4.'),
    ],
  },
  {
    id: 'french', name: 'French Defence', slot: 'e4', blurb: '…e6 and …d5: a wall in the centre and counterplay with …c5.',
    lines: [
      L('fr-adv', 'Advance Variation', 'b', 'e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6', 'Attack the base of the chain: …c5, …Nc6, …Qb6.'),
      L('fr-ex', 'Exchange', 'b', 'e4 e6 d4 d5 exd5 exd5 Nf3 Nf6 Bd3 Bd6 O-O O-O', 'Symmetrical and safe: just develop.'),
      L('fr-st', 'Steinitz (3.Nc3)', 'b', 'e4 e6 d4 d5 Nc3 Nf6 e5 Nfd7 f4 c5 Nf3 Nc6', '…Nfd7 and …c5 against White’s big centre.'),
    ],
  },
  {
    id: 'qgd', name: 'Queen’s Gambit Declined', slot: 'd4', blurb: '…d5 and …e6: the most reliable answer to 1.d4.',
    lines: [
      L('qgd-main', 'Main line', 'b', 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 h6 Bh4 b6', '…Be7, castle, …h6 and …b6 to free the c8 bishop.'),
      L('qgd-lon', 'Against the London', 'b', 'd4 d5 Bf4 Nf6 e3 c5 c3 Nc6 Nd2 Qb6', '…c5 and …Qb6 hit b2 and d4.'),
      L('qgd-ex', 'Exchange Variation', 'b', 'd4 d5 c4 e6 Nc3 Nf6 cxd5 exd5 Bg5 Be7 e3 O-O Bd3 c6', '…c6 supports d5; later …Nbd7, …Re8 and …Ne4.'),
    ],
  },
  {
    id: 'kid', name: 'King’s Indian Defence', slot: 'd4', blurb: 'Let White build a centre, then strike with …e5.',
    lines: [
      L('kid-main', 'Classical', 'b', 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6 d5 Ne7', 'After d5 the plan is …Nd7, …f5 and a kingside attack.'),
      L('kid-lon', 'Against the London', 'b', 'd4 Nf6 Bf4 g6 e3 Bg7 Nf3 O-O Be2 d6 h3 Nbd7', 'The same setup; …Nbd7 and …e5 next.'),
    ],
  },
];

export const systemById = (id: string) => SYSTEMS.find((s) => s.id === id);

/** A line as moves with positions; throws on an illegal move. */
export function linePlies(moves: string): { san: string; uci: string; fenBefore: string; fenAfter: string; from: string; to: string }[] {
  const c = new Chess();
  return moves.split(/\s+/).filter(Boolean).map((san) => {
    const fenBefore = c.fen();
    const m = c.move(san);
    return { san: m.san, uci: m.lan, fenBefore, fenAfter: c.fen(), from: m.from, to: m.to };
  });
}

/** Plies (0-based) at which it is your turn in the line. */
export const yourPlies = (line: RepLine): number[] => linePlies(line.moves).map((_, i) => i).filter((i) => (i % 2 === 0) === (line.color === 'w'));

export interface LineStat {
  /** Clean runs in a row. */
  streak: number;
  runs: number;
  /** Day of the last run. */
  last: string;
}
export type RepStats = Record<string, LineStat>;

/** Stats after a run through a line: a clean run grows the streak, a slip resets it. */
export function afterRun(stats: RepStats, lineId: string, clean: boolean, day: string): RepStats {
  const s = stats[lineId] ?? { streak: 0, runs: 0, last: '' };
  return { ...stats, [lineId]: { streak: clean ? s.streak + 1 : 0, runs: s.runs + 1, last: day } };
}

/** 0 = new, 1 = learning, 2 = known, 3 = mastered. */
export const lineLevel = (s: LineStat | undefined) => (!s || s.runs === 0 ? 0 : s.streak >= 3 ? 3 : s.streak >= 1 ? 2 : 1);
export const LEVEL_NAME = ['New', 'Learning', 'Known', 'Mastered'];

/** Which line to train next: the weakest, and among equals the one practised longest ago. */
export function nextLine(lines: RepLine[], stats: RepStats): RepLine | null {
  if (!lines.length) return null;
  return [...lines].sort((a, b) => lineLevel(stats[a.id]) - lineLevel(stats[b.id]) || (stats[a.id]?.last ?? '').localeCompare(stats[b.id]?.last ?? ''))[0];
}

export interface Repertoire {
  /** Chosen system per slot. */
  picks: Partial<Record<RepSystem['slot'], string>>;
  custom: RepLine[];
}

const KEY = 'repertoire';
const STATS_KEY = 'repertoireStats';
export const getRepertoire = () => kvGet<Repertoire>(KEY, { picks: {}, custom: [] });
export const saveRepertoire = (r: Repertoire) => kvSet(KEY, r);
export const getRepStats = () => kvGet<RepStats>(STATS_KEY, {});
export async function recordRun(lineId: string, clean: boolean) {
  await kvSet(STATS_KEY, afterRun(await getRepStats(), lineId, clean, today()));
}

/** All lines of a repertoire: the picked systems' lines and your own. */
export function repertoireLines(r: Repertoire): RepLine[] {
  return [...SLOTS.flatMap((s) => systemById(r.picks[s.id] ?? '')?.lines ?? []), ...r.custom];
}

export const lineById = (r: Repertoire, id: string) => repertoireLines(r).find((l) => l.id === id) ?? SYSTEMS.flatMap((s) => s.lines).find((l) => l.id === id);

/** Checks a recorded line before saving: at least four plies, all legal. */
export function validLine(moves: string): boolean {
  try {
    return linePlies(moves).length >= 4;
  } catch {
    return false;
  }
}
