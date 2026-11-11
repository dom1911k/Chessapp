// Annotated model games: famous games played through move by move. At the marked moments you
// guess the hero's move before it is shown.
import { Chess } from 'chess.js';

export interface ModelGame {
  id: string;
  title: string;
  /** "Morphy – Duke of Brunswick & Count Isouard, Paris 1858" */
  players: string;
  /** The side you guess for. */
  hero: 'w' | 'b';
  icon: string;
  /** What the game teaches. */
  theme: string;
  intro: string;
  /** The whole game in SAN, space separated. */
  moves: string;
  /** Comment shown after ply n (1 = White's first move). */
  notes: Record<number, string>;
  /** Plies you are asked to guess (all moves of the hero). */
  guess: number[];
}

export const MODEL_GAMES: ModelGame[] = [
  {
    id: 'opera',
    title: 'The Opera Game',
    players: 'Paul Morphy – Duke of Brunswick & Count Isouard, Paris 1858',
    hero: 'w',
    icon: 'sparkles',
    theme: 'Development and open lines',
    intro: 'The most famous teaching game ever played — in a box at the Paris opera. Morphy develops a piece with every move; his opponents do not. Watch how fast it ends.',
    moves: 'e4 e5 Nf3 d6 d4 Bg4 dxe5 Bxf3 Qxf3 dxe5 Bc4 Nf6 Qb3 Qe7 Nc3 c6 Bg5 b5 Nxb5 cxb5 Bxb5+ Nbd7 O-O-O Rd8 Rxd7 Rxd7 Rd1 Qe6 Bxd7+ Nxd7 Qb8+ Nxb8 Rd8#',
    notes: {
      6: '…Bg4 pins the knight, but Black will have to give up this bishop — and with it the light squares.',
      9: 'White has traded a knight for a bishop and brought the queen out with a threat. Black has no piece developed.',
      13: 'Qb3! A double attack on f7 and b7. Morphy moves a piece twice only because it wins something.',
      14: '…Qe7 defends f7 but blocks the bishop on f8. Black’s kingside will never get out.',
      15: 'Nc3. Morphy could win a pawn on b7; he prefers development. Every white piece is coming out.',
      18: '…b5? tries to chase the bishop, but Black is far too undeveloped to open the position.',
      19: 'Nxb5! A sacrifice to open lines against a king stuck in the middle.',
      23: 'Castling queenside puts the rook on the open d-file with tempo. All of White’s pieces are playing; half of Black’s are still at home.',
      25: 'Rxd7! Removing a defender. The other rook takes its place on d1 at once.',
      31: 'Qb8+!! The queen gives herself up to pull the knight away from d8.',
      33: 'Checkmate. White ends with just a rook and bishop — every one of them took part.',
    },
    guess: [13, 15, 19, 23, 25, 27, 31, 33],
  },
  {
    id: 'greco',
    title: 'Greco’s attack',
    players: 'Gioachino Greco – NN, about 1620',
    hero: 'w',
    icon: 'swords',
    theme: 'The centre, f7 and the initiative',
    intro: 'A four-hundred-year-old lesson in the Italian Game. Black wins material; White wins time — and time is what counts when a king is still in the centre.',
    moves: 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4 exd4 cxd4 Bb4+ Nc3 Nxe4 O-O Nxc3 bxc3 Bxc3 Qb3 Bxa1 Bxf7+ Kf8 Bg5 Ne7 Ne5 Bxd4 Bg6 d5 Qf3+ Bf5 Bxf5 Bxe5 Be6+ Bf6 Bxf6 gxf6 Qxf6+ Ke8 Qf7#',
    notes: {
      7: 'c3 prepares d4: White wants a full pawn centre.',
      9: 'd4! The centre is opened while Black’s king is still on e8.',
      15: 'Castling instead of saving the pawn. White offers material to finish development.',
      18: '…Bxc3 Black keeps eating. He is two pawns up and about to win a rook — and totally undeveloped.',
      19: 'Qb3! Queen and bishop line up on f7.',
      20: '…Bxa1 takes the rook. Now it is White’s turn.',
      21: 'Bxf7+ The king loses the right to castle and the attack plays itself.',
      27: 'Bg6! A quiet move: it opens the f-file for the queen and threatens Qf7 mate.',
      39: 'Checkmate. Black’s rooks and bishop on the queenside never moved.',
    },
    guess: [9, 15, 19, 21, 23, 25, 27, 29, 39],
  },
  {
    id: 'reti',
    title: 'Mate in eleven moves',
    players: 'Richard Réti – Savielly Tartakower, Vienna 1910',
    hero: 'w',
    icon: 'zap',
    theme: 'Double check',
    intro: 'A casual game between two great masters. Black grabs a knight in the centre and walks into one of the prettiest finishes in chess.',
    moves: 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Nf6 Qd3 e5 dxe5 Qa5+ Bd2 Qxe5 O-O-O Nxe4 Qd8+ Kxd8 Bg5+ Kc7 Bd8#',
    notes: {
      9: 'Qd3 An unusual move that keeps the knight on e4 defended and prepares to castle long.',
      12: '…Qa5+ wins the pawn back with a check — but brings the queen out early.',
      15: 'Castling queenside: the rook lands on the d-file, opposite the black king. The knight on e4 is now "hanging"…',
      16: '…Nxe4?? Black takes it. What is on the d-file?',
      17: 'Qd8+!! Attraction: the king is pulled onto d8, in front of the rook.',
      19: 'Bg5++ Double check from bishop and rook. The king must move; nothing else is legal.',
      21: 'Checkmate. After …Ke8 it would have been Rd8 mate instead.',
    },
    guess: [15, 17, 19, 21],
  },
  {
    id: 'lasker',
    title: 'The king hunt',
    players: 'Edward Lasker – Sir George Thomas, London 1912',
    hero: 'w',
    icon: 'crosshair',
    theme: 'Calculating forcing moves',
    intro: 'A five-minute game in a London club. A queen sacrifice, then seven checks in a row drag the black king from g8 all the way to g1.',
    moves: 'd4 e6 Nf3 f5 Nc3 Nf6 Bg5 Be7 Bxf6 Bxf6 e4 fxe4 Nxe4 b6 Ne5 O-O Bd3 Bb7 Qh5 Qe7 Qxh7+ Kxh7 Nxf6+ Kh6 Neg4+ Kg5 h4+ Kf4 g3+ Kf3 Be2+ Kg2 Rh2+ Kg1 Kd2#',
    notes: {
      9: 'Bxf6 White gives up the bishop pair to play e4 and open the centre quickly.',
      15: 'Ne5 Two knights and a bishop are aimed at the kingside. Black’s only defender is the bishop on f6.',
      19: 'Qh5 Threatening mate on h7. Black defends along the seventh rank with …Qe7. It is not enough.',
      21: 'Qxh7+!! Every reply is forced from here on.',
      23: 'Nxf6++ Double check: knight and bishop. …Kh8 would allow Ng6 mate.',
      27: 'h4+ Even the pawns give check. The king cannot go back.',
      33: 'Rh2+ The king has been driven to the first rank.',
      35: 'Checkmate — with a king move that opens the rook. Castling queenside would also have been mate.',
    },
    guess: [19, 21, 23, 25, 27, 29, 31, 33, 35],
  },
  {
    id: 'immortal',
    title: 'The Immortal Game',
    players: 'Adolf Anderssen – Lionel Kieseritzky, London 1851',
    hero: 'w',
    icon: 'flame',
    theme: 'Initiative over material',
    intro: 'The romantic age of chess in one game. Anderssen gives up a bishop, both rooks and the queen — and mates with three minor pieces.',
    moves: 'e4 e5 f4 exf4 Bc4 Qh4+ Kf1 b5 Bxb5 Nf6 Nf3 Qh6 d3 Nh5 Nh4 Qg5 Nf5 c6 g4 Nf6 Rg1 cxb5 h4 Qg6 h5 Qg5 Qf3 Ng8 Bxf4 Qf6 Nc3 Bc5 Nd5 Qxb2 Bd6 Bxg1 e5 Qxa1+ Ke2 Na6 Nxg7+ Kd8 Qf6+ Nxf6 Be7#',
    notes: {
      3: 'The King’s Gambit: a pawn for open lines and a fast attack.',
      6: '…Qh4+ forces the king to move, but the queen will be chased around and lose time.',
      21: 'Rg1! Anderssen leaves the bishop on b5 to be taken. He wants to trap the black queen instead.',
      28: '…Ng8 The knight has to go home to make room for the queen. Black has played ten queen and knight moves and developed nothing.',
      33: 'Nd5 Every white piece is in the attack. The queen can take on b2 with a threat to the rook…',
      35: 'Bd6!! Both rooks are left hanging. The bishop cuts the black queen off from the defence.',
      37: 'e5! A quiet pawn move in the middle of the storm: it shuts the queen out of g7 for good.',
      41: 'Nxg7+ The net closes.',
      43: 'Qf6+!! The final sacrifice, to deflect the knight from e7.',
      45: 'Checkmate. Black still has his queen, both rooks and a bishop — all of them spectators.',
    },
    guess: [21, 33, 35, 37, 39, 41, 43, 45],
  },
  {
    id: 'rubinstein',
    title: 'Rubinstein’s Immortal',
    players: 'Georg Rotlewi – Akiba Rubinstein, Łódź 1907',
    hero: 'b',
    icon: 'gem',
    theme: 'Piece activity',
    intro: 'A symmetrical, quiet opening. White wastes two moves; Rubinstein puts every piece on its best square — and then the tactics appear as if by magic.',
    moves: 'd4 d5 Nf3 e6 e3 c5 c4 Nc6 Nc3 Nf6 dxc5 Bxc5 a3 a6 b4 Bd6 Bb2 O-O Qd2 Qe7 Bd3 dxc4 Bxc4 b5 Bd3 Rd8 Qe2 Bb7 O-O Ne5 Nxe5 Bxe5 f4 Bc7 e4 Rac8 e5 Bb6+ Kh1 Ng4 Be4 Qh4 g3 Rxc3 gxh4 Rd2 Qxd2 Bxe4+ Qg2 Rh3',
    notes: {
      19: 'Qd2 The queen will have to move again; White is drifting.',
      25: 'Bd3 The bishop took two moves to reach d3 (Bd3, Bxc4, Bd3). Black has gained time.',
      28: '…Bb7 Count the pieces: Black’s rooks and bishops all have open lines. This is what "good development" looks like.',
      33: 'f4? and e4–e5 look active but open the diagonals to White’s own king.',
      36: '…Rac8 The last piece joins. Now every black piece is better than its white counterpart.',
      40: '…Ng4! Threatening …Qh4 and mate on h2.',
      42: '…Qh4! The queen comes anyway; g3 is forced.',
      44: '…Rxc3!! Removing the knight that guards e4. The queen on h4 is left hanging.',
      46: '…Rd2!! A second rook offered, to deflect the white queen from e4.',
      50: '…Rh3! and White resigned: mate on h2 cannot be stopped. A queen and a rook sacrificed in four moves.',
    },
    guess: [28, 36, 38, 40, 42, 44, 46, 48, 50],
  },
  {
    id: 'century',
    title: 'The Game of the Century',
    players: 'Donald Byrne – Bobby Fischer (age 13), New York 1956',
    hero: 'b',
    icon: 'trophy',
    theme: 'Everything together',
    intro: 'A thirteen-year-old sacrifices his queen against one of America’s best players — and wins by perfect coordination of his minor pieces. A fitting final exam.',
    moves: 'Nf3 Nf6 c4 g6 Nc3 Bg7 d4 O-O Bf4 d5 Qb3 dxc4 Qxc4 c6 e4 Nbd7 Rd1 Nb6 Qc5 Bg4 Bg5 Na4 Qa3 Nxc3 bxc3 Nxe4 Bxe7 Qb6 Bc4 Nxc3 Bc5 Rfe8+ Kf1 Be6 Bxb6 Bxc4+ Kg1 Ne2+ Kf1 Nxd4+ Kg1 Ne2+ Kf1 Nc3+ Kg1 axb6 Qb4 Ra4 Qxb6 Nxd1 h3 Rxa2 Kh2 Nxf2 Re1 Rxe1 Qd8+ Bf8 Nxe1 Bd5 Nf3 Ne4 Qb8 b5 h4 h5 Ne5 Kg7 Kg1 Bc5+ Kf1 Ng3+ Ke1 Bb4+ Kd1 Bb3+ Kc1 Ne2+ Kb1 Nc3+ Kc1 Rc2#',
    notes: {
      21: 'Bg5? A second move with the same bishop while the king is still on e1. Fischer punishes it at once.',
      22: '…Na4!! If White takes the knight, …Nxe4 wins: the queen and the bishop on g5 are both hit and the king is stuck in the centre.',
      26: '…Nxe4! The centre is ripped open. White’s king has not castled.',
      32: '…Rfe8+ The king loses the right to castle. All of Black’s pieces are developed with gain of time.',
      34: '…Be6!! The move that made the game famous. Black lets his queen be taken.',
      36: '…Bxc4+ Now a "windmill": the knight checks again and again, collecting material each time.',
      46: '…axb6 The dust settles. Black has a rook, two bishops and a pawn for the queen — and every piece works together.',
      57: 'Fischer’s technique is as instructive as the combination: he takes no risks, brings every piece closer and weaves a mating net.',
      82: 'Checkmate. Rook, two bishops and knight against a lone queen that could only watch.',
    },
    guess: [22, 26, 32, 34, 36, 38, 46, 82],
  },
];

export const modelGameById = (id: string) => MODEL_GAMES.find((g) => g.id === id);

export interface ModelPly {
  san: string;
  uci: string;
  fenBefore: string;
  fenAfter: string;
  from: string;
  to: string;
}

/** The game as positions, one per ply. */
export function modelPlies(g: ModelGame): ModelPly[] {
  const c = new Chess();
  return g.moves.split(/\s+/).map((san) => {
    const fenBefore = c.fen();
    const m = c.move(san);
    return { san: m.san, uci: m.lan, fenBefore, fenAfter: c.fen(), from: m.from, to: m.to };
  });
}

const DONE_KEY = 'modelGamesDone';
export { DONE_KEY as MODEL_DONE_KEY };

/** Stars for a guess run: share of the hero's moves found on the first try. */
export function guessStars(right: number, total: number): number {
  if (total <= 0) return 0;
  const k = right / total;
  return k >= 0.85 ? 3 : k >= 0.6 ? 2 : k >= 0.3 ? 1 : 0;
}
