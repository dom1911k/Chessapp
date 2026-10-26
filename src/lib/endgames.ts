// Endgame drills against Stockfish (playing the best defence).
export interface Drill {
  id: string;
  title: string;
  group: 'Basic checkmates' | 'Pawn endings' | 'Rook & queen endings';
  icon: string;
  description: string;
  /** mate; promote a pawn safely; win the enemy pawn; or hold the draw for maxMoves moves. */
  goal: 'mate' | 'promote' | 'capture' | 'hold';
  /** Maximum number of your moves. */
  maxMoves: number;
  goalText: string;
  /** Starting positions; one is picked at random. Side to move = you. */
  fens: string[];
  /** Tips shown when you are not making progress. */
  tips: string[];
  /** False when the engine's evaluation is too unreliable for "you're not making progress" tips. */
  engineTips?: boolean;
}

export const DRILLS: Drill[] = [
  {
    id: 'kqk',
    title: 'Queen mate',
    group: 'Basic checkmates',
    icon: 'queen',
    description: 'King and queen against a lone king.',
    goal: 'mate',
    maxMoves: 20,
    goalText: 'Checkmate in under 20 moves',
    fens: ['8/8/8/4k3/8/8/8/3QK3 w - - 0 1', '8/8/3k4/8/8/8/1Q6/6K1 w - - 0 1', '8/2k5/8/8/8/8/5Q2/2K5 w - - 0 1', '8/8/8/8/2k5/8/8/4K2Q w - - 0 1'],
    tips: [
      'Use the queen to shrink the king\'s box: stay a knight\'s move away from the king.',
      'Once the king is on the edge, bring your own king closer — the queen can\'t mate alone.',
      'Watch out for stalemate: always leave the enemy king at least one square until you give mate.',
    ],
  },
  {
    id: 'krk',
    title: 'Rook mate',
    group: 'Basic checkmates',
    icon: 'rook',
    description: 'King and rook against a lone king.',
    goal: 'mate',
    maxMoves: 30,
    goalText: 'Checkmate in under 30 moves',
    fens: ['8/8/8/4k3/8/8/8/R3K3 w - - 0 1', '8/8/8/8/3k4/8/8/4K2R w - - 0 1', '8/8/2k5/8/8/8/8/2K2R2 w - - 0 1'],
    tips: [
      'Use the rook to cut the king off along a rank or file, making its box smaller.',
      'Bring your king up — the rook needs its king to push the enemy king back.',
      'When the kings face each other (opposition), a rook check along the edge drives the king back.',
      'If the enemy king attacks your rook, move the rook far away along the same line.',
    ],
  },
  {
    id: 'kbbk',
    title: 'Two bishops mate',
    group: 'Basic checkmates',
    icon: 'bishop',
    description: 'King and two bishops against a lone king. Advanced — the coach gives fewer tips here.',
    engineTips: false,
    goal: 'mate',
    maxMoves: 40,
    goalText: 'Checkmate in under 40 moves',
    fens: ['8/8/8/4k3/8/8/8/2B1KB2 w - - 0 1', '8/8/8/3k4/8/8/2BB4/4K3 w - - 0 1'],
    tips: [
      'Place the bishops side by side: together they form a wall the king cannot cross.',
      'Your king must help — bring it close to the enemy king.',
      'The mate happens in a corner. Drive the king there step by step.',
    ],
  },
  {
    id: 'kpk-front',
    title: 'King in front',
    group: 'Pawn endings',
    icon: 'pawn',
    description: 'Your king leads the pawn to promotion.',
    goal: 'promote',
    maxMoves: 20,
    goalText: 'Promote the pawn',
    fens: ['4k3/8/4K3/4P3/8/8/8/8 w - - 0 1', '8/8/4k3/8/4K3/8/4P3/8 w - - 0 1', '8/8/2k5/8/2K5/8/2P5/8 w - - 0 1', '8/8/3k4/8/3K4/8/3P4/8 w - - 0 1'],
    tips: [
      'Put your king in front of the pawn, not behind it.',
      'Opposition: when the kings stand face to face with one square between them, the side that does NOT have to move wins the battle.',
      'Don\'t rush the pawn — first win the key squares with your king.',
      'A spare pawn move can hand the move to your opponent and win the opposition.',
    ],
  },
  {
    id: 'kpk-square',
    title: 'The square rule',
    group: 'Pawn endings',
    icon: 'square',
    description: 'Can the king catch the pawn? Draw the square to find out.',
    goal: 'promote',
    maxMoves: 8,
    goalText: 'Promote the pawn',
    fens: ['8/8/8/P4k2/8/8/8/7K w - - 0 1', '8/8/8/8/1P6/8/6k1/K7 w - - 0 1', '8/8/8/6p1/1K6/8/8/k7 b - - 0 1'],
    tips: [
      'Imagine a square from the pawn to its promotion square. If the enemy king can\'t step into it, just run!',
      'Every king move toward the pawn matters — but here the pawn is faster. Push it!',
    ],
  },
];

DRILLS.push(
  {
    id: 'kpk-defend',
    title: 'Defend with the king',
    group: 'Pawn endings',
    icon: 'shield',
    description: 'King against king and pawn: stop the pawn and hold the draw.',
    goal: 'hold',
    maxMoves: 15,
    goalText: 'Hold the draw for 15 moves',
    fens: ['4k3/8/8/4P3/4K3/8/8/8 b - - 0 1', '8/8/4k3/8/4PK2/8/8/8 b - - 0 1'],
    tips: [
      'Stay in front of the pawn with your king — block its path.',
      'Take the opposition: face the enemy king with one square between you, so it has to give way.',
      'When the pawn reaches your back rank\'s doorstep, keep your king on the square in front of it or right next to it.',
    ],
  },
  {
    id: 'lucena',
    title: 'Lucena: build a bridge',
    group: 'Rook & queen endings',
    icon: 'bridge',
    description: 'Rook and pawn against rook — the most important winning technique.',
    goal: 'promote',
    maxMoves: 20,
    goalText: 'Promote the pawn',
    fens: ['1K6/1P1k4/8/8/8/8/r7/2R5 w - - 0 1', '2K5/2P1k3/8/8/8/8/1r6/3R4 w - - 0 1'],
    tips: [
      'First push the enemy king away from your pawn with a rook check along the file.',
      'Then bring your rook to the 4th rank: later it will block the checks — that\'s the "bridge".',
      'Walk your king out toward your rook; when the checks come, put your rook in between.',
    ],
  },
  {
    id: 'philidor',
    title: 'Philidor: hold the draw',
    group: 'Rook & queen endings',
    icon: 'wall',
    description: 'Rook against rook and pawn — the classic defence.',
    goal: 'hold',
    maxMoves: 15,
    goalText: 'Hold the draw for 15 moves',
    fens: ['4k3/7R/r7/4PK2/8/8/8/8 b - - 0 1', '3k4/R7/3r4/3PK3/8/8/8/8 b - - 0 1'],
    tips: [
      'Keep your rook on your 6th rank (the third rank from your side) so the enemy king can\'t come forward.',
      'Once the pawn steps onto your 6th rank, swing your rook to the far side and check the king from behind.',
      'Keep your own king on the squares in front of the pawn.',
    ],
  },
  {
    id: 'qvp',
    title: 'Queen vs pawn',
    group: 'Rook & queen endings',
    icon: 'queen',
    description: 'Stop a pawn on the 7th rank with your queen, then win it.',
    goal: 'capture',
    maxMoves: 20,
    goalText: 'Win the pawn in under 20 moves',
    fens: ['8/8/8/8/1K6/8/3pk3/7Q w - - 0 1', '8/8/8/8/1K6/8/1p1k4/7Q w - - 0 1'],
    tips: [
      'Check the king or attack the promotion square to gain time.',
      'Force the enemy king in front of its own pawn — then it blocks the pawn for one move…',
      '…and use that moment to bring your own king closer.',
    ],
  },
);

export const drillById = (id: string) => DRILLS.find((d) => d.id === id);
