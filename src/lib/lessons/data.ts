// Guided lessons: short steps, each with a position. Some steps ask you to play a move.
import type { CoachArrow, CoachHighlight } from '../coach/types';

export type Task =
  | { kind: 'moves'; solutions: string[] } // any of these UCI moves
  | { kind: 'mate' } // any checkmating move
  | { kind: 'safe' }; // any move after which none of your pieces hangs

export interface LessonStep {
  fen: string;
  /** Text; **bold** is rendered bold. */
  text: string;
  task?: Task;
  success?: string;
  hint?: string;
  arrows?: CoachArrow[];
  highlights?: CoachHighlight[];
}

export interface Lesson {
  id: string;
  title: string;
  icon: string;
  summary: string;
  steps: LessonStep[];
}

export const LESSONS: Lesson[] = [
  {
    id: 'checkmate',
    title: 'Check, checkmate & stalemate',
    icon: 'king',
    summary: 'How games are won — and how not to throw a win away.',
    steps: [
      {
        fen: '4k3/8/4K3/8/8/8/8/R7 w - - 0 1',
        text: "A king is in **check** when it is attacked. The side in check must get out of it at once. **Checkmate** means it can't — and the game is over.",
      },
      {
        fen: '4k3/8/4K3/8/8/8/8/R7 w - - 0 1',
        text: 'Your turn: give checkmate in one move. Your king already guards the squares in front of the black king.',
        task: { kind: 'mate' },
        hint: 'Your rook can attack the king along the 8th rank.',
        success: 'Checkmate! The rook checks along the back rank and your king covers d7, e7 and f7.',
      },
      {
        fen: 'k7/2Q5/1K6/8/8/8/8/8 b - - 0 1',
        text: "Careful! Here Black is **not** in check but has no legal move. That's **stalemate** — a draw, even though White is a queen up.",
        highlights: [{ sq: 'a8', tone: 'info' }],
      },
      {
        fen: 'k7/8/1K6/8/8/8/8/2Q5 w - - 0 1',
        text: "Find the checkmate — and don't stalemate the king!",
        task: { kind: 'mate' },
        hint: "Check the king along the 8th rank, from a square the king can't reach.",
        success: 'Checkmate! Notice that Qc7 would have been stalemate. Always ask: "Does the king still have a move?"',
      },
    ],
  },
  {
    id: 'hanging',
    title: 'Free pieces',
    icon: 'gift',
    summary: 'Count attackers and defenders before you capture.',
    steps: [
      {
        fen: '6k1/5ppp/4p3/1b1n4/8/2N5/5PPP/3R2K1 w - - 0 1',
        text: 'Before capturing, **count**: who attacks the piece, and who defends it? A piece with no defender is **hanging** — you can take it for free.',
      },
      {
        fen: '6k1/5ppp/4p3/1b1n4/8/2N5/5PPP/3R2K1 w - - 0 1',
        text: 'One black piece is free. Take it!',
        task: { kind: 'moves', solutions: ['c3b5'] },
        hint: 'The knight on d5 is defended by the e6 pawn. What about the bishop?',
        success: 'A free bishop. Rxd5 would have been a mistake: exd5 and you lose your rook (5) for a knight (3).',
      },
      {
        fen: 'rnbqkb1r/ppp2ppp/3p4/4N3/8/8/PPPP1PPP/RNBQKB1R w KQkq - 0 1',
        text: 'Now the other side of the coin: after every opponent move, check whether **your** pieces are safe. Your knight on e5 is attacked by a pawn — move it to a safe square!',
        task: { kind: 'safe' },
        hint: 'Look for a square where no black piece or pawn can capture it.',
        success: 'Safe! Every move, ask: "What is attacked?" before you make your own plan.',
      },
    ],
  },
  {
    id: 'forks',
    title: 'Forks',
    icon: 'fork',
    summary: 'Attack two things at once — your opponent can save only one.',
    steps: [
      {
        fen: 'r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1',
        text: 'A **fork** is one piece attacking two targets at the same time. Knights are especially good at it. Find the knight fork!',
        task: { kind: 'moves', solutions: ['d5c7'] },
        hint: 'Which square attacks both the king on e8 and the rook on a8?',
        success: 'Nc7+ attacks the king and the rook. The king must move…',
      },
      {
        fen: 'r7/2Nk4/8/8/8/8/8/4K3 w - - 0 1',
        text: '…and now collect your prize.',
        task: { kind: 'moves', solutions: ['c7a8'] },
        success: 'The rook is yours. Forks with check are the strongest, because your opponent has no time to save both.',
      },
      {
        fen: '4k3/8/8/2n1b3/8/3PP3/8/4K3 w - - 0 1',
        text: 'Even a pawn can fork! Attack both black pieces with one pawn move.',
        task: { kind: 'moves', solutions: ['d3d4'] },
        hint: 'A pawn attacks diagonally forward. Which square hits c5 and e5?',
        success: 'd4 forks the knight and bishop — and it is protected by the e3 pawn.',
      },
    ],
  },
  {
    id: 'pins',
    title: 'Pins & skewers',
    icon: 'pin',
    summary: 'Attack along a line through one piece to another.',
    steps: [
      {
        fen: '4k3/8/2n5/8/8/8/8/4KB2 w - - 0 1',
        text: "A **pin**: a piece can't (or shouldn't) move because a more valuable piece stands behind it. Pin the knight to the king!",
        task: { kind: 'moves', solutions: ['f1b5'] },
        hint: 'Put your bishop on the diagonal that runs through c6 to e8.',
        success: 'The knight on c6 is pinned: moving it would expose the king to check, so it may not move at all.',
      },
      {
        fen: '8/4q3/8/4k3/8/8/8/K6R w - - 0 1',
        text: 'A **skewer** is a pin in reverse: attack the valuable piece first and win the one behind it. Skewer the king and queen!',
        task: { kind: 'moves', solutions: ['h1e1'] },
        hint: 'The king and queen stand on the same file.',
        success: 'Re1+ checks the king. When it steps aside, you take the queen.',
      },
    ],
  },
  {
    id: 'backrank',
    title: 'Back-rank mates',
    icon: 'castle',
    summary: 'A castled king can get trapped behind its own pawns.',
    steps: [
      {
        fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1',
        text: 'The black king is boxed in by its own pawns. Deliver a **back-rank mate**!',
        task: { kind: 'mate' },
        success: 'Ra8#. The pawns on f7, g7 and h7 take away every escape square.',
      },
      {
        fen: '3r2k1/5ppp/8/8/8/8/2R2PPP/6K1 w - - 0 1',
        text: "Now you're the one in danger: Black threatens …Rd1+. Make sure that can't end in mate.",
        task: { kind: 'moves', solutions: ['h2h3', 'g2g3', 'h2h4', 'c2c1', 'g1f1'] },
        hint: 'Give your king an escape square ("luft"), or guard your back rank.',
        success: 'Well done. A little pawn move like h3 early on often prevents back-rank disasters.',
      },
    ],
  },
  {
    id: 'opening',
    title: 'Opening principles',
    icon: 'book',
    summary: 'Center, development, castling — the three golden rules.',
    steps: [
      {
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        text: 'Rule 1: **take the center**. Play a pawn to the middle of the board.',
        task: { kind: 'moves', solutions: ['e2e4', 'd2d4'] },
        success: 'A central pawn controls key squares and opens lines for your bishop and queen.',
      },
      {
        fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
        text: 'Rule 2: **develop your pieces**. Bring a knight out toward the center.',
        task: { kind: 'moves', solutions: ['g1f3', 'b1c3'] },
        hint: 'Knights belong on f3 and c3 early on.',
        success: 'Knights first, then bishops — and try not to move the same piece twice.',
      },
      {
        fen: 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
        text: 'Rule 3: **castle early** to keep your king safe and connect your rooks.',
        task: { kind: 'moves', solutions: ['e1g1'] },
        hint: 'Move your king two squares toward the rook on h1.',
        success: 'Castled! Your king is tucked away and the rook joins the game.',
      },
      {
        fen: 'rnbqkbnr/pppp1ppp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 2',
        text: 'And one warning: bringing the **queen out early** lets your opponent attack it while developing (for example …Nf6 or …g6 here).',
        arrows: [{ from: 'g8', to: 'f6', tone: 'info' }],
      },
    ],
  },
  {
    id: 'defender',
    title: 'Remove the defender',
    icon: 'shield',
    summary: 'Take away the guard, then take what it guarded.',
    steps: [
      {
        fen: '4k3/1p6/2n5/4r3/8/8/8/2R1R1K1 w - - 0 1',
        text: 'The black rook on e5 looks safe because the **knight on c6 guards it**. But what if that guard disappears?',
        arrows: [{ from: 'c6', to: 'e5', tone: 'info' }],
      },
      {
        fen: '4k3/1p6/2n5/4r3/8/8/8/2R1R1K1 w - - 0 1',
        text: 'Capture the defender!',
        task: { kind: 'moves', solutions: ['c1c6'] },
        hint: 'Which black piece is protecting the rook on e5?',
        success: 'Rxc6! Black will take back with the pawn…',
      },
      {
        fen: '4k3/8/2p5/4r3/8/8/8/4R1K1 w - - 0 2',
        text: '…and now the rook on e5 has no defender. Take it!',
        task: { kind: 'moves', solutions: ['e1e5'] },
        success: 'You gave a rook for a knight, then won a rook back: a whole piece up. Always ask "what is that piece guarding?"',
      },
    ],
  },
  {
    id: 'pawns',
    title: 'Pawn endings',
    icon: 'pawn',
    summary: 'The square rule and the opposition.',
    steps: [
      {
        fen: '8/8/8/P4k2/8/8/8/7K w - - 0 1',
        text: 'The **square rule**: draw a square from your pawn to its promotion square (a5–d5–d8–a8 here). If the enemy king can\'t step into that square, it can\'t catch the pawn.',
        highlights: [{ sq: 'a5', tone: 'info' }, { sq: 'd5', tone: 'info' }, { sq: 'd8', tone: 'info' }, { sq: 'a8', tone: 'info' }],
      },
      {
        fen: '8/8/8/P4k2/8/8/8/7K w - - 0 1',
        text: 'The black king is outside the square. Should you run? Make the move!',
        task: { kind: 'moves', solutions: ['a5a6'] },
        hint: 'Your king is far away — the pawn has to go on its own.',
        success: 'Right! Each push shrinks the square, and the king is always one step too slow.',
      },
      {
        fen: '8/8/4k3/8/4K3/8/4P3/8 w - - 0 1',
        text: 'The **opposition**: the kings face each other with one square between them. Whoever has to move must give way. Here you can pass the move to Black with a little pawn step — find it!',
        task: { kind: 'moves', solutions: ['e2e3'] },
        hint: 'A pawn move that changes nothing — except whose turn it is.',
        success: 'e3! Now Black must step aside, and your king walks forward. Spare pawn moves win many endings.',
      },
    ],
  },
  {
    id: 'mate2',
    title: 'Mate in two',
    icon: 'queen',
    summary: 'Sometimes you give something to deliver checkmate.',
    steps: [
      {
        fen: '2R2rk1/5p1b/3p1P1p/p5p1/P1R3P1/7P/1PP3K1/2r5 w - - 0 42',
        text: 'Look for **forcing moves**: checks first. Here a rook sacrifice forces the king forward… Play the first move!',
        task: { kind: 'moves', solutions: ['c8f8'] },
        hint: 'Take the rook on f8 with check.',
        success: 'Rxf8+! The king has to take back.',
      },
      {
        fen: '5k2/5p1b/3p1P1p/p5p1/P1R3P1/7P/1PP3K1/2r5 w - - 0 43',
        text: 'Now finish it: checkmate in one.',
        task: { kind: 'mate' },
        hint: 'Your other rook can reach the back rank.',
        success: 'Rc8#! The king is trapped by its own pieces and your pawn on f6. Giving material to checkmate is always worth it.',
      },
    ],
  },
];

export const lessonById = (id: string) => LESSONS.find((l) => l.id === id);
