// Stage 3 — Attacking the king: when to attack, the classic sacrifices and more mating nets.
import { ask, lesson, mate, play, pos, say } from '../build';

const GIFT = 'rnbq1rk1/pppn1ppp/4p3/3pP3/1b1P4/2NB1N2/PPP2PPP/R1BQK2R w KQ - 0 1';
const OPERA = 'e4 e5 Nf3 d6 d4 Bg4 dxe5 Bxf3 Qxf3 dxe5 Bc4 Nf6 Qb3 Qe7 Nc3 c6 Bg5 b5 Nxb5 cxb5 Bxb5+ Nbd7 O-O-O Rd8 Rxd7 Rxd7 Rd1 Qe6 Bxd7+ Nxd7';

export const S3 = [
  lesson('s3-castled', 'Attacking a castled king', 'swords', 'Count attackers against defenders — then open a line.', [
    say(GIFT, 'An attack on the king works when you can bring **more pieces to that side than the defender has**. Count them. Here White has bishop, knight and queen ready to jump in; Black’s king has only pawns for company — the f6 knight, the best defender, is missing.', { arrows: ['?d3h7', '?f3g5', '?d1h5'] }),
    ask(GIFT, 'Which black piece is usually the most important defender of a castled king?', ['The knight on f6', 'The rook on a8', 'The queen on d8'], 0, 'A knight on f6 guards h7 and stops Qh5. When it is gone — traded, chased by e5, or pinned — look for an attack straight away.'),
    ask(GIFT, 'What do attackers need besides pieces?', ['Open lines toward the king: files, diagonals, or a pawn storm to open them', 'A closed position', 'Trading queens'], 0, 'Pieces need roads. Sacrifices on h7, g7 and f7 are just a violent way to open one. Without open lines an "attack" is only pieces standing near the king.'),
    ask(GIFT, 'And when should you NOT attack?', ['When my own king is still in the centre or my pieces are undeveloped', 'When I am ahead in development', 'When their defenders are far away'], 0, 'Finish development first. An attack with three pieces while the rest sleep usually runs out of steam and leaves you worse.'),
  ]),
  lesson('s3-greekgift', 'The Greek gift: Bxh7+', 'gift', 'The most famous sacrifice in chess.', [
    say(GIFT, 'The recipe: bishop aiming at h7, knight ready for g5, queen ready for h5, a pawn on e5 that keeps a knight off f6 — and no defender able to take on g5. Then the bishop can give itself up on h7.', { arrows: ['d3h7', '?f3g5', '?d1h5'], info: ['e5'] }),
    play(GIFT, 'All the conditions are met. Sacrifice!', 'Bxh7+', 'The bishop takes the h-pawn with check.', 'Bxh7+! The king has to take, or simply be a pawn down with a wrecked shelter.'),
    play(pos('Bxh7+ Kxh7', GIFT), 'Bring the next attacker with check.', 'Ng5+', 'The knight jumps in.', 'Ng5+! The king must choose: back to g8, or forward into the open.'),
    play(pos('Bxh7+ Kxh7 Ng5+ Kg8', GIFT), 'The king went back. Now the queen arrives.', ['Qh5', 'Qd3'], 'Threaten mate on h7.', 'Qh5! Mate on h7 is threatened. Black can only make room with …Re8, and then Qxf7+ followed by Qh5+, Qh7+, Qh8+ and Qxg7 is checkmate.'),
    ask(GIFT, 'What must you check before playing Bxh7+ in your own games?', ['That after Ng5+ nothing can capture the knight for free, and no piece can defend h7 in time', 'Nothing — it always works', 'That I have castled'], 0, 'The two classic defences are a bishop on e7 that takes on g5, and …Bf5 or …Nf6 covering h7. Also look at …Kg6: you need a follow-up such as Qg4 or h4.'),
  ]),
  lesson('s3-mates2', 'Four more mating nets', 'crosshair', 'Anastasia, Boden, Greco and the epaulette.', [
    say('8/4N1pk/8/8/8/8/8/K2R4 w - - 0 1', '**Anastasia’s mate**: a knight on e7 takes g8 and g6 away, the king’s own pawn blocks g7 — and a rook or queen lands on the h-file.', { info: ['g8', 'g6'] }),
    mate('8/4N1pk/8/8/8/8/8/K2R4 w - - 0 1', 'Deliver Anastasia’s mate.', 'The rook goes to the h-file.', 'Rh1#. In games it often starts with a queen sacrifice on h7 to drag the king there.'),
    say('2kr4/p2n1ppp/2p5/8/5B2/8/4B3/4K3 w - - 0 1', '**Boden’s mate**: two bishops on crossing diagonals against a king hemmed in by his own rook and knight. It usually follows a sacrifice that removes the b-pawn.', { arrows: ['?f4b8'] }),
    mate('2kr4/p2n1ppp/2p5/8/5B2/8/4B3/4K3 w - - 0 1', 'Deliver Boden’s mate.', 'The other bishop gives check from the edge.', 'Ba6#. One bishop checks, the other cuts off the escape.'),
    mate('7k/6p1/8/8/2B5/8/8/K2R4 w - - 0 1', '**Greco’s mate**: the bishop covers g8, the g-pawn boxes the king in. Finish it.', 'The rook checks on the h-file.', 'Rh1#. Remember the picture: bishop on the long diagonal to g8 plus a heavy piece on the h-file.'),
    mate('3rkr2/8/8/8/8/7Q/8/4K3 w - - 0 1', 'The **epaulette mate**: the king’s own rooks sit on his shoulders. Find the mate.', 'The queen gives check from two squares in front of the king.', 'Qe6#. The rooks block d8 and f8, the queen covers the rest.'),
  ]),
  lesson('s3-centreking', 'The king caught in the centre', 'king', 'Open the middle before he can castle.', [
    say(pos(OPERA), 'This is the end of Morphy’s "Opera Game" (Paris 1858). Black never castled; all his pieces are tied up defending. White, a rook down, has everything aimed at the king.', { arrows: ['?d1d8', '?b3b8'] }),
    play(pos(OPERA), 'Find Morphy’s queen sacrifice.', 'Qb8+', 'The queen gives check on the back rank; only the knight can take.', 'Qb8+!! The knight must capture — and it was the only piece guarding d8.'),
    mate(pos(OPERA + ' Qb8+ Nxb8'), 'Now finish.', 'The rook has an open file to the back rank.', 'Rd8#. Rook and bishop against a king that stayed in the middle.'),
    ask(pos('e4 e5 Nf3 d6 d4 Bg4 dxe5 Bxf3 Qxf3 dxe5 Bc4 Nf6 Qb3'), 'What is the general plan against an uncastled king?', ['Open the centre files (trade or sacrifice centre pawns) and develop with threats', 'Attack on the wing with pawns', 'Trade queens'], 0, 'Every open file in the centre is a road to the king. Morphy developed a new piece with every move while his opponent kept answering threats.'),
  ]),
];
