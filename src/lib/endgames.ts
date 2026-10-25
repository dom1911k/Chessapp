// Endgame drills against Stockfish (playing the best defence).
export interface Drill {
  id: string;
  title: string;
  group: 'Basic checkmates' | 'Pawn endings';
  icon: string;
  description: string;
  goal: 'mate' | 'promote';
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
    icon: '♕',
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
    icon: '♖',
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
    icon: '♗',
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
    icon: '♙',
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
    icon: '⬜',
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

export const drillById = (id: string) => DRILLS.find((d) => d.id === id);
