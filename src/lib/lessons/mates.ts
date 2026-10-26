// Checkmate patterns: ten classic mates every beginner should recognise.
// Each pattern opens with the finished mate on the board, then asks you to
// deliver it yourself in one or two fresh positions.
import { Chess } from 'chess.js';
import { parseUci } from '../chess/game';
import { kingSquare, parseFen, sqName } from '../chess/pos';
import type { Lesson, LessonStep } from './data';

interface Practice {
  fen: string;
  text?: string;
  hint: string;
  success: string;
}

function pattern(id: string, title: string, icon: string, summary: string, demo: { fen: string; uci: string; text: string }, practice: Practice[]): Lesson {
  const c = new Chess(demo.fen);
  c.move(parseUci(demo.uci));
  const mated = c.turn();
  const king = sqName(kingSquare(parseFen(c.fen()).board, mated));
  const intro: LessonStep = {
    fen: c.fen(),
    text: demo.text,
    arrows: [{ from: demo.uci.slice(0, 2), to: demo.uci.slice(2, 4), tone: 'good' }],
    highlights: [{ sq: king, tone: 'bad' }],
  };
  const steps: LessonStep[] = practice.map((p, i) => ({
    fen: p.fen,
    text: p.text ?? (i === 0 ? 'Your turn: find the checkmate.' : 'One more — find the checkmate.'),
    task: { kind: 'mate' },
    hint: p.hint,
    success: p.success,
  }));
  return { id: `mate-${id}`, title, icon, summary, steps: [intro, ...steps] };
}

export const MATE_PATTERNS: Lesson[] = [
  pattern(
    'backrank',
    'Back-rank mate',
    'castle',
    'A rook or queen mates a king stuck behind its own pawns.',
    { fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', uci: 'a1a8', text: "This is a **back-rank mate**. The black king is stuck behind its own pawns, so a rook on the back row is checkmate. It's the most common mate in beginner games!" },
    [
      { fen: '1k6/ppp5/8/8/8/8/5PPP/4R1K1 w - - 0 1', hint: 'The king is boxed in by its own pawns. Which row can your rook reach?', success: 'Back-rank mate! The pawns that were meant to protect the king trap it instead.' },
      { fen: '6k1/5ppp/8/8/8/8/5PPP/3Q2K1 w - - 0 1', hint: 'A queen works just like a rook here.', success: 'Checkmate! Tip: give your own king an escape square (like h3) so this never happens to you.' },
    ],
  ),
  pattern(
    'ladder',
    'Ladder mate',
    'rook',
    'Two rooks take turns pushing the king to the edge.',
    { fen: 'k7/7R/8/8/8/8/8/6RK w - - 0 1', uci: 'g1g8', text: 'The **ladder**: one rook blocks a row, the other gives check on the next row. The king is pushed to the edge and mated. Your king isn\'t even needed!' },
    [
      { fen: '7k/R7/8/8/8/8/8/1R4K1 w - - 0 1', hint: 'One rook already guards the 7th row. Use the other one on the 8th.', success: 'Ladder mate! One rook guards the 7th row, the other checks on the 8th.' },
      { fen: '8/8/8/8/k7/6K1/1R6/7R w - - 0 1', hint: 'The rook on b2 guards the b-file. Give check along the a-file.', success: 'Checkmate! The ladder works on any edge of the board.' },
    ],
  ),
  pattern(
    'kingrook',
    'King and rook mate',
    'crown',
    'With just a rook, your king has to help.',
    { fen: 'k7/8/1K6/8/8/8/8/7R w - - 0 1', uci: 'h1h8', text: 'With only one rook, your **king must help**. The kings stand face to face, and the rook checks along the edge. The king has nowhere to go.' },
    [
      { fen: '6k1/8/6K1/8/8/8/8/R7 w - - 0 1', hint: 'Your king already covers the squares in front of the black king.', success: 'Checkmate! King and rook working together.' },
      { fen: '8/8/8/8/8/3R2K1/8/7k w - - 0 1', hint: 'Your king guards the squares next to the black king. Check along the bottom row.', success: 'Checkmate! Your king guards the squares the black king would need.' },
    ],
  ),
  pattern(
    'kiss',
    'Queen kiss',
    'queen',
    'The queen goes right next to the king, protected by your king.',
    { fen: '1k6/8/K7/8/8/8/8/1Q6 w - - 0 1', uci: 'b1b7', text: 'The **queen kiss**: your queen stands right next to the enemy king, and your own king protects her. The enemy king can\'t take the queen and has nowhere to run.' },
    [
      { fen: '2k5/7Q/2K5/8/8/8/8/8 w - - 0 1', hint: 'Put the queen next to the black king where your king protects her.', success: 'Checkmate! The queen is protected by your king, so it can\'t be taken.' },
      { fen: '8/8/8/4Q3/8/6K1/8/7k w - - 0 1', hint: 'Your king guards the squares above the black king. Check it along the bottom row.', success: 'Checkmate! Always make sure it isn\'t stalemate first.' },
    ],
  ),
  pattern(
    'smothered',
    'Smothered mate',
    'knight',
    'A knight mates a king surrounded by its own pieces.',
    { fen: '6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1', uci: 'g5f7', text: 'The **smothered mate**: the king is completely surrounded by its own pieces. A knight jumps in and gives check — and nothing can block a knight!' },
    [
      { fen: 'kr6/pp6/8/1N6/8/8/8/6K1 w - - 0 1', hint: 'The king can\'t move at all. Which square lets your knight check it?', success: 'Smothered mate! The king is trapped by its own rook and pawns.' },
    ],
  ),
  pattern(
    'arabian',
    'Arabian mate',
    'knight',
    'Rook and knight team up in the corner.',
    { fen: '7k/R7/5N2/8/8/8/8/6K1 w - - 0 1', uci: 'a7h7', text: 'The **Arabian mate** is over 1,000 years old! The knight protects the rook and also guards the square next to the king.' },
    [
      { fen: 'k7/7R/2N5/8/8/8/8/6K1 w - - 0 1', hint: 'Your knight can protect a rook right next to the king.', success: 'Arabian mate! The knight protects the rook and covers b8.' },
    ],
  ),
  pattern(
    'scholar',
    "Scholar's mate",
    'target',
    'The quick attack on f7 — learn to use it and to stop it.',
    { fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', uci: 'h5f7', text: "**Scholar's mate**: the queen and bishop both aim at f7, the weakest square near Black's king. If Black doesn't defend it, the queen takes on f7 — checkmate!" },
    [
      { fen: 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 4', hint: 'Queen and bishop are both aiming at the same weak square.', success: "Checkmate! Remember it from the other side too: if you see a queen and bishop aiming at your f7, defend it (for example with a knight on f6 or the queen on e7)." },
      { fen: 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2', text: "This one is the **fool's mate**, the fastest checkmate there is. White opened up the king too early — punish it!", hint: 'The diagonal from the black queen to the white king is wide open.', success: "Fool's mate in two moves! Don't open the pawns in front of your own king early." },
    ],
  ),
  pattern(
    'helper',
    'Queen with a helper',
    'sparkles',
    'The queen mates next to the king, protected by a bishop or pawn.',
    { fen: '5rk1/5pp1/8/7Q/8/3B4/5PPP/6K1 w - - 0 1', uci: 'h5h7', text: 'A queen next to the king is checkmate when **something protects her**. Here the bishop on d3 protects the queen on h7 — the king can\'t take her.' },
    [
      { fen: '5rk1/5p2/6P1/8/8/8/8/6KQ w - - 0 1', hint: 'Which square next to the king is protected by your pawn?', success: 'Checkmate! The little pawn on g6 protects the queen.' },
      { fen: '1kr5/1pp5/8/Q7/8/4B3/PPP5/1K6 w - - 0 1', hint: 'Your bishop aims at a square right next to the king.', success: 'Checkmate — the bishop protects the queen on a7.' },
    ],
  ),
  pattern(
    'opera',
    'Opera mate',
    'bishop',
    'A rook checks on the back row, protected by a bishop from far away.',
    { fen: '4kb1r/5ppp/8/6B1/8/8/8/3R2K1 w - - 0 1', uci: 'd1d8', text: 'The **Opera mate** (Morphy played it at the opera in 1858!): the rook checks on the back row, and a bishop from far away protects it and guards the escape square.' },
    [
      { fen: 'r1bk4/ppp5/8/1B6/8/8/8/1K2R3 w - - 0 1', hint: 'Your bishop covers a square next to the king. Now check with the rook.', success: 'Checkmate! The rook checks and the bishop covers the escape square.' },
    ],
  ),
  pattern(
    'corner',
    'Corner mate',
    'flag',
    'Rook and knight trap a king in the corner.',
    { fen: '7k/7p/5N2/8/8/8/8/6RK w - - 0 1', uci: 'g1g8', text: 'In the **corner mate** the knight guards g8, so the rook can check there safely. The king is stuck in its corner behind its own pawn.' },
    [
      { fen: 'k7/p7/2N5/8/8/8/8/1R4K1 w - - 0 1', hint: 'The knight guards one square next to the king. Put your rook there.', success: 'Corner mate! The knight protects the rook, and the king is stuck behind its pawn.' },
    ],
  ),
];
