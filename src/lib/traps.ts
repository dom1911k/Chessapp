// Traps and cheap tricks people at 400–900 often try, explained by Coach Sam, played out, and
// drilled. Also: which traps came up in my imported games, and which short losses they explain.
import { Chess } from 'chess.js';
import { START_FEN } from './chess/game';
import type { Color } from './chess/pos';
import type { AnyGame, ImportedGame } from './store/types';
import { newCardDue, type Card } from './srs';

export interface Trap {
  id: string;
  name: string;
  /** The opening it lives in. */
  opening: string;
  /** Who falls for it. */
  victim: Color;
  /** The trap played out (SAN from the start), including the losing move and its punishment. */
  line: string[];
  /** Index in `line` of the move people fall for; the drill starts in the position before it. */
  critical: number;
  /** Moves that stay safe at the critical moment (the first is the one to remember). */
  good: string[];
  /** Coach Sam's explanation, in plain words. */
  text: string[];
  /** The warning sign to look for. */
  sign: string;
}

const L = (s: string) => s.split(' ');

export const TRAPS: Trap[] = [
  {
    id: 'scholar',
    name: "Scholar's Mate",
    opening: "King's Pawn",
    victim: 'b',
    line: L('e4 e5 Bc4 Nc6 Qh5 Nf6 Qxf7#'),
    critical: 5,
    good: ['g6', 'Qe7'],
    text: [
      "The most common trick at every club: the queen and bishop both aim at f7, the square only your king protects.",
      'Natural-looking 3...Nf6 attacks the queen — and walks into Qxf7, checkmate.',
      'Block the queen with ...g6 (or guard f7 with ...Qe7). Then chase the queen with your knights and gain time.',
    ],
    sign: 'A queen and a bishop both pointing at f7.',
  },
  {
    id: 'qf3-attack',
    name: 'The early Qf3 attack',
    opening: "Bishop's Opening",
    victim: 'b',
    line: L('e4 e5 Bc4 Nc6 Qf3 Nd4 Qxf7#'),
    critical: 5,
    good: ['Nf6', 'Qf6', 'Qe7'],
    text: [
      "Same idea as Scholar's Mate, with the queen on f3 instead of h5. f7 is attacked twice and defended once.",
      'Jumping ...Nd4 to hit the queen and c2 looks active, but it ignores the threat: Qxf7 is mate.',
      'Before any attacking move, ask: "what is my opponent threatening?" Here ...Nf6 blocks the queen and develops.',
    ],
    sign: 'Queen on f3 plus bishop on c4: f7 is attacked twice.',
  },
  {
    id: 'fried-liver',
    name: 'The Fried Liver Attack',
    opening: 'Two Knights Defense',
    victim: 'b',
    line: L('e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Nxd5 Nxf7 Kxf7 Qf3+ Ke6 Nc3'),
    critical: 9,
    good: ['Na5', 'b5', 'Nd4'],
    text: [
      'White attacks f7 with the knight on g5. After 4...d5 5.exd5 it feels natural to take back with the knight.',
      'But 5...Nxd5 lets White sacrifice: 6.Nxf7! Kxf7 7.Qf3+ and your king has to walk to e6, into the middle of the board.',
      "Play 5...Na5 instead: it hits the bishop and Black gets quick development for the pawn. That's what strong players do.",
    ],
    sign: 'A white knight on g5 and a bishop on c4 both hitting f7.',
  },
  {
    id: 'traxler',
    name: 'The Traxler counter-attack',
    opening: 'Two Knights Defense',
    victim: 'w',
    line: L('e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 Bc5 Nxf7 Bxf2+ Kxf2 Nxe4+ Ke1 Qh4+ g3 Nxg3'),
    critical: 12,
    good: ['Kg1', 'Ke3'],
    text: [
      "Black ignores the threat to f7 and plays 4...Bc5. After 5.Nxf7 Bxf2+ 6.Kxf2 Nxe4+ White's king is in the open.",
      "Running back home with 7.Ke1?? is the losing move: 7...Qh4+ and Black's queen and knight tear the king's cover apart.",
      "Go to g1 (7.Kg1!) — the king hides behind its pawns and White keeps the extra piece. When the king is checked, compare every square it can go to.",
    ],
    sign: 'A sacrifice on f2 with check, and a knight ready to take on e4 with check.',
  },
  {
    id: 'englund',
    name: 'The Englund Gambit trap',
    opening: 'Englund Gambit',
    victim: 'w',
    line: L('d4 e5 dxe5 Nc6 Nf3 Qe7 Bf4 Qb4+ Bd2 Qxb2 Bc3 Bb4 Qd2 Bxc3 Qxc3 Qc1#'),
    critical: 10,
    good: ['Nc3'],
    text: [
      'Black gives a pawn with 1...e5, then the queen checks on b4 and grabs your b2 pawn.',
      "Chasing the queen with 6.Bc3? walks into 6...Bb4!, and the natural 7.Qd2?? Bxc3 8.Qxc3 Qc1 is checkmate. Your king has no squares.",
      "6.Nc3! protects everything: the queen on b2 is now short of squares and Black has nothing for the pawn. Count the checks before you chase a queen.",
    ],
    sign: "An enemy queen on your 2nd rank and your queen about to leave d1.",
  },
  {
    id: 'legal',
    name: "Légal's Mate",
    opening: 'Philidor Defense',
    victim: 'b',
    line: L('e4 e5 Nf3 d6 Bc4 Bg4 Nc3 g6 Nxe5 Bxd1 Bxf7+ Ke7 Nd5#'),
    critical: 9,
    good: ['dxe5'],
    text: [
      "White's knight takes on e5 and seems to leave the queen hanging to your bishop on g4.",
      "Grabbing the queen (5...Bxd1) loses on the spot: 6.Bxf7+ Ke7 7.Nd5 is checkmate by three minor pieces.",
      'When a stronger piece is offered for free, look for checks first. Take back on e5 with the pawn — you lose only a pawn.',
    ],
    sign: 'Your opponent "blunders" their queen while their minor pieces surround your king.',
  },
  {
    id: 'blackburne',
    name: 'The Blackburne Shilling Gambit',
    opening: 'Italian Game',
    victim: 'w',
    line: L('e4 e5 Nf3 Nc6 Bc4 Nd4 Nxe5 Qg5 Nxf7 Qxg2 Rf1 Qxe4+ Be2 Nf3#'),
    critical: 6,
    good: ['Nxd4', 'O-O', 'c3', 'd3'],
    text: [
      "Black plays the odd-looking 3...Nd4, seemingly leaving the e5 pawn for free.",
      "Taking it (4.Nxe5?) is exactly what Black wants: 4...Qg5! attacks your knight and g2, and greed after that ends in a smothered mate.",
      "Don't take the bait: 4.Nxd4 exd4 5.O-O, or simply castle. You're better without touching e5.",
    ],
    sign: 'A free central pawn after a strange knight jump to d4.',
  },
  {
    id: 'stafford',
    name: 'The Stafford Gambit',
    opening: 'Petrov Defense',
    victim: 'w',
    line: L('e4 e5 Nf3 Nf6 Nxe5 Nc6 Nxc6 dxc6 d3 Bc5 Bg5 Nxe4 Bxd8 Bxf2+ Ke2 Bg4#'),
    critical: 10,
    good: ['Be2', 'Be3'],
    text: [
      "Black gives a pawn for open lines and fast pieces. The tricks all aim at f2 and your king.",
      "Pinning the knight with 6.Bg5?? walks into 6...Nxe4! — if you take the queen, 7...Bxf2+ 8.Ke2 Bg4 is mate.",
      'Develop calmly (Be2, Nc3, castle) and keep f2 covered. A pawn up and a safe king wins.',
    ],
    sign: 'A black bishop on c5 aiming at f2, with your king still in the middle.',
  },
  {
    id: 'fishing-pole',
    name: 'The Fishing Pole',
    opening: 'Ruy Lopez (Berlin)',
    victim: 'w',
    line: L('e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Ng4 h3 h5 hxg4 hxg4 Nxe5 Qh4 f3 g3'),
    critical: 10,
    good: ['d4', 'c3', 'Bxc6', 'd3'],
    text: [
      "Black puts a knight on g4 next to your castled king — the bait — and backs it up with ...h5.",
      'Taking the knight (6.hxg4?) opens the h-file for Black\'s rook: after ...hxg4 and ...Qh4 the mate on h2 or h1 cannot be stopped.',
      "Leave the knight alone and play in the centre (6.d4 or 6.c3). The knight on g4 is doing nothing by itself.",
    ],
    sign: 'A "free" knight next to your castled king with a rook behind its h-pawn.',
  },
  {
    id: 'elephant',
    name: 'The Elephant Trap',
    opening: "Queen's Gambit Declined",
    victim: 'w',
    line: L('d4 d5 c4 e6 Nc3 Nf6 Bg5 Nbd7 cxd5 exd5 Nxd5 Nxd5 Bxd8 Bb4+ Qd2 Bxd2+ Kxd2 Kxd8'),
    critical: 10,
    good: ['e3', 'Nf3'],
    text: [
      "The knight on f6 is pinned to the queen — or so it seems. After 5.cxd5 exd5 the d5 pawn looks free.",
      "6.Nxd5?? Nxd5! 7.Bxd8 Bb4+ forces your queen to block and Black ends up a whole piece ahead.",
      'The pin is not real when the defender can answer with a check. Keep developing: 6.e3 or 6.Nf3.',
    ],
    sign: 'A pinned piece whose side can give check right after the pin is "won".',
  },
  {
    id: 'noahs-ark',
    name: "Noah's Ark Trap",
    opening: 'Ruy Lopez',
    victim: 'w',
    line: L('e4 e5 Nf3 Nc6 Bb5 a6 Ba4 d6 d4 b5 Bb3 Nxd4 Nxd4 exd4 Qxd4 c5 Qd5 Be6 Qc6+ Bd7 Qd5 c4'),
    critical: 14,
    good: ['Bd5', 'c3'],
    text: [
      "Black's queenside pawns march forward: ...a6, ...b5, and later ...c5 and ...c4 can trap your bishop on b3.",
      "Taking back with the queen (8.Qxd4?) runs into 8...c5! — the queen has to move and ...c4 traps the bishop like animals in Noah's ark.",
      "Give the bishop room first: 8.Bd5 or 8.c3. Watch for pawns that can lock a bishop in.",
    ],
    sign: 'Your bishop on b3 with black pawns on a6, b5 and one ready for ...c5–c4.',
  },
  {
    id: 'lasker',
    name: 'The Lasker Trap',
    opening: 'Albin Countergambit',
    victim: 'w',
    line: L('d4 d5 c4 e5 dxe5 d4 e3 Bb4+ Bd2 dxe3 Bxb4 exf2+ Ke2 fxg1=N+'),
    critical: 10,
    good: ['fxe3'],
    text: [
      "Black's pawn on d4 is a thorn. After 4.e3 Bb4+ 5.Bd2 dxe3 the bishop on b4 looks free.",
      "6.Bxb4?? exf2+ 7.Ke2 fxg1=N+! — the pawn becomes a knight with check, and Black wins material back with interest.",
      'Take the pawn first: 6.fxe3. Every pawn that reaches your 2nd rank deserves attention.',
    ],
    sign: 'An enemy pawn on your third rank that can capture toward your back rank.',
  },
  {
    id: 'kieninger',
    name: 'The Kieninger Trap',
    opening: 'Budapest Gambit',
    victim: 'w',
    line: L('d4 Nf6 c4 e5 dxe5 Ng4 Bf4 Nc6 Nf3 Bb4+ Nbd2 Qe7 a3 Ngxe5 axb4 Nd3#'),
    critical: 14,
    good: ['Nxe5', 'e3'],
    text: [
      'In the Budapest Gambit Black hits e5 again and again, and the bishop on b4 pins your knight on d2.',
      'After 7.a3 Ngxe5! the bishop is offered — but 8.axb4?? Nd3 is a smothered mate: your own pieces box in the king.',
      "Take the knight instead (8.Nxe5) or develop with 8.e3. When a piece is offered, ask what the reply would be.",
    ],
    sign: 'A black queen on e7 lined up with your king on the e-file.',
  },
  {
    id: 'petrov-copycat',
    name: 'The Petrov copycat',
    opening: 'Petrov Defense',
    victim: 'b',
    line: L('e4 e5 Nf3 Nf6 Nxe5 Nxe4 Qe2 Nf6 Nc6+'),
    critical: 7,
    good: ['Qe7'],
    text: [
      "In the Petrov copying White with 3...Nxe4 is already risky. After 4.Qe2 your knight on e4 is pinned against the king.",
      'Moving it away (4...Nf6??) allows 5.Nc6+, a discovered check that wins your queen.',
      "Play 4...Qe7: block the file and keep the material balanced. Never step off a file your king and their queen share.",
    ],
    sign: "Your king and the opponent's queen on the same open file.",
  },
  {
    id: 'caro-smothered',
    name: 'The Caro-Kann smothered mate',
    opening: 'Caro-Kann Defense',
    victim: 'b',
    line: L('e4 c6 d4 d5 Nc3 dxe4 Nxe4 Nd7 Qe2 Ngf6 Nd6#'),
    critical: 9,
    good: ['e6', 'Ndf6'],
    text: [
      "White's queen on e2 stares down the e-file at your king, and the knight on e4 is ready to jump.",
      "Natural 5...Ngf6?? blocks your own king in: 6.Nd6 is a smothered mate — the e7 pawn can't take because it's pinned.",
      'Play 5...Ndf6 or ...e6 first. When your king and their queen share a file, the pawn in front of your king is pinned.',
    ],
    sign: 'A queen on e2 against your king on e8, with their knight on e4.',
  },
];

export const trapById = (id: string) => TRAPS.find((t) => t.id === id);

/** Board after `n` plies of a trap line (FEN). */
export function trapFen(t: Trap, n = t.critical): string {
  const c = new Chess(START_FEN);
  for (const san of t.line.slice(0, n)) c.move(san);
  return c.fen();
}
/** The position key without move counters (for transpositions). */
const key = (fen: string) => fen.split(' ').slice(0, 4).join(' ');

/** The UCI of a SAN move in a position. */
export function sanToUci(fen: string, san: string): string {
  const m = new Chess(fen).move(san);
  return m.from + m.to + (m.promotion ?? '');
}

export interface TrapSighting {
  trapId: string;
  /** I faced it (I was the victim) or set it (I was the trapper). */
  role: 'faced' | 'set';
  /** As victim: I fell for it (played the trap's losing move). */
  fell: boolean;
  gameId: string | number;
}

/** Traps whose critical position came up in a game (any move order). */
export function trapsInGame(g: Pick<AnyGame, 'plies' | 'userColor' | 'id' | 'startFen'>): TrapSighting[] {
  if (g.startFen !== START_FEN) return [];
  const out: TrapSighting[] = [];
  const keys = g.plies.map((p) => key(p.fenBefore));
  for (const t of TRAPS) {
    const k = key(trapFen(t));
    const i = keys.indexOf(k);
    if (i < 0) continue;
    const role = g.userColor === t.victim ? 'faced' : 'set';
    const wrong = t.line[t.critical];
    out.push({ trapId: t.id, role, fell: g.plies[i]?.san === wrong, gameId: g.id! });
  }
  return out;
}

/** Sightings per trap over my imported games. */
export function trapStats(games: Pick<AnyGame, 'plies' | 'userColor' | 'id' | 'startFen'>[]): Record<string, { faced: number; fell: number; set: number }> {
  const out: Record<string, { faced: number; fell: number; set: number }> = {};
  for (const g of games)
    for (const s of trapsInGame(g)) {
      const r = (out[s.trapId] ??= { faced: 0, fell: 0, set: 0 });
      if (s.role === 'set') r.set++;
      else {
        r.faced++;
        if (s.fell) r.fell++;
      }
    }
  return out;
}

/** Plies of the game that follow the trap's line from the start. */
const sharedPrefix = (t: Trap, sans: string[]) => {
  let n = 0;
  while (n < t.line.length && n < sans.length && t.line[n] === sans[n]) n++;
  return n;
};

/** Lost in under 15 moves. */
export const shortLoss = (g: Pick<AnyGame, 'userResult' | 'plies'>) => g.userResult === 'loss' && g.plies.length < 30;

/**
 * The trap behind a quick loss: one whose critical position came up with me as the victim; else
 * a trap whose line the game followed almost to the critical moment (within 3 plies) and that
 * ended soon after leaving it. Losses on time or by abandoning aren't traps.
 */
export function trapForLoss(g: Pick<AnyGame, 'plies' | 'userColor' | 'id' | 'startFen' | 'userResult'> & { reason?: string }): Trap | null {
  if (!shortLoss(g) || g.startFen !== START_FEN || g.reason === 'time' || g.reason === 'abandoned') return null;
  const seen = trapsInGame(g).find((s) => s.role === 'faced');
  if (seen) return trapById(seen.trapId)!;
  const sans = g.plies.map((p) => p.san);
  const best = TRAPS.filter((t) => t.victim === g.userColor)
    .map((t) => ({ t, n: sharedPrefix(t, sans) }))
    .filter(({ t, n }) => n >= Math.max(4, t.critical - 3) && sans.length - n <= 8)
    .sort((a, b) => b.n - a.n)[0];
  return best?.t ?? null;
}

/** The review card that drills a trap: its critical position, the safe move as the answer. */
export function trapCard(t: Trap, now = Date.now(), from?: ImportedGame): Card {
  const fen = trapFen(t);
  return {
    id: `t:${t.id}`,
    kind: 'mistake',
    source: from ? 'chess.com' : undefined,
    ccGameId: from?.id,
    trapId: t.id,
    fen,
    solution: [sanToUci(fen, t.good[0])],
    playedSan: t.line[t.critical],
    playedUci: sanToUci(fen, t.line[t.critical]),
    themes: ['opening', 'trap'],
    label: `Trap: ${t.name}${from ? ` · lost to it on chess.com vs ${from.opponentName}` : ''}`,
    explanation: [t.text[t.text.length - 1]],
    createdAt: now,
    due: newCardDue(now),
    step: 0,
    reps: 0,
    lapses: 0,
  };
}
