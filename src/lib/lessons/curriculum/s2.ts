// Stage 2 — Tactics: the short forcing tricks that decide most games below 1400.
import { ask, lesson, mate, play, pos, say } from '../build';

const RETI = 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Nf6 Qd3 e5 dxe5 Qa5+ Bd2 Qxe5 O-O-O Nxe4';

export const S2 = [
  lesson('s2-cct', 'Checks, captures, threats', 'brain', 'A three-word routine that finds tactics for you.', [
    say(pos('e4 e5 Nf3 Nf6 Nxe5 Nxe4 Qe2 Nf6'), 'Tactics are found, not guessed. On every move look at the **forcing moves** in this order: **checks**, then **captures**, then **threats**. Forcing moves leave the opponent few replies, so you can calculate them.'),
    ask(pos('e4 e5 Nf3 Nf6 Nxe5 Nxe4 Qe2 Nf6'), 'Why look at checks first?', ['They look impressive', 'The opponent MUST answer a check, so the line is easy to calculate', 'Checks always win'], 1, 'A check has at most three kinds of answer: move the king, block, or capture the checker. That keeps the tree small. Most checks are useless — but the winning move is very often one of them.'),
    play(pos('e4 e5 Nf3 Nf6 Nxe5 Nxe4 Qe2 Nf6'), 'Try it. List your checks here — one of them wins the queen.', 'Nc6+', 'Move the knight away with check from the queen behind it.', 'Nc6+! The queen on e2 gives check and the knight takes the black queen next move. You found it by looking at every check.'),
    ask(pos('e4 e5 Nf3 Nc6 Bc4 Bc5'), 'No checks or captures work. What is next on the list?', ['Threats: a move that attacks something or sets up a tactic', 'A random developing move', 'Resign'], 0, 'Threats come third. And if there is no good forcing move at all, improve your worst-placed piece — that comes later in the course.'),
  ]),
  lesson('s2-loose', 'Loose pieces drop off', 'gift', 'Undefended pieces are what tactics feed on.', [
    say(pos('d4 Nf6 Bg5 c6 e3'), 'A piece with **no defender** is "loose". Loose pieces are targets: a double attack on a loose piece and the king wins it. Before each move, notice which pieces — on both sides — are loose.', { bad: ['g5'], flip: true }),
    play(pos('d4 Nf6 Bg5 c6 e3'), 'You are Black. White’s bishop on g5 is loose. Attack it and the king at once.', 'Qa5+', 'A queen check on the diagonal a5–e1 also looks along the fifth rank.', 'Qa5+! Check, and the queen hits the bishop on g5 along the rank. White must answer the check; you take the bishop.', { flip: true }),
    ask(pos('e4 e5 Nf3 Nc6 Bc4 Bc5 O-O Nf6 d3 d6'), 'How do you make your own position tactic-proof?', ['Keep the queen at home', 'Keep pieces defended by each other, especially before the position opens', 'Push all the pawns'], 1, 'Pieces that protect each other cannot be forked for profit. When you see two of your pieces undefended, fix one of them before attacking.'),
  ]),
  lesson('s2-discovered', 'Discovered attacks', 'eye', 'Move one piece, unleash the one behind it.', [
    say(pos('e4 e5 Nf3 Nf6 Nxe5 Nxe4 Qe2 Nf6'), 'A **discovered attack**: a piece moves out of the way and the piece behind it attacks. The piece that moves gets a free move — it can go anywhere, even where it could be captured, because the opponent is busy.', { arrows: ['?e2e8', 'e5c6'] }),
    play(pos('e4 e5 Nf3 Nf6 Nxe5 Nxe4 Qe2 Nf6'), 'The knight on e5 hides your queen’s attack on the king. Move the knight where it wins the most.', 'Nc6+', 'With check from the queen, the knight may attack anything.', 'Discovered check! Black has to deal with the queen’s check; the knight then captures the queen on d8.'),
    ask(pos('e4 e5 Nf3 Nf6 Nxe5 Nxe4 Qe2 Nf6'), 'What makes a discovered check so strong?', ['It is two moves in one: the check, plus whatever the moving piece attacks', 'It is illegal to answer', 'It uses the queen'], 0, 'The opponent has one move to answer two problems. Whenever two of your pieces stand on the same line as an enemy piece, look for the discovery.'),
    ask(pos('e4 e5 Nf3 Nf6 Nxe5 Nxe4 Qe2'), 'From the other side: Black’s knight on e4 is attacked and stands on the same file as Black’s king. What should Black NOT do?', ['Move the knight away from e4', 'Defend the knight with …d5 or …Qe7'], 0, 'Moving the knight allows Nc6+ and the queen is lost. …Qe7 keeps everything together. Pieces lined up with your king are a warning sign.', { flip: true }),
  ]),
  lesson('s2-doublecheck', 'Double check', 'zap', 'Two checks at once: the king must move.', [
    say(pos(RETI), 'In a **double check** two pieces give check at the same time. You cannot block two checks or capture two checkers — the king has to run. This position is from Réti–Tartakower, 1910. White is a knight down and plays a stunning move.', { arrows: ['d3d8'] }),
    play(pos(RETI), 'Sacrifice the queen to drag the king onto the d-file.', 'Qd8+', 'The queen gives check on d8 — the king must take.', 'Qd8+!! The king takes, and now the rook on d1 and bishop on d2 are lined up against him.'),
    play(pos(RETI + ' Qd8+ Kxd8'), 'Now the double check: move the bishop so that BOTH bishop and rook give check.', 'Bg5+', 'The bishop leaves the d-file with check.', 'Bg5++! Check from the bishop and from the rook. Capturing or blocking is impossible; the king must move.'),
    mate(pos(RETI + ' Qd8+ Kxd8 Bg5+ Kc7'), 'The king ran to c7. Finish the game.', 'The bishop returns to the back rank.', 'Bd8#. (After …Ke8 it would be Rd8#.) A queen sacrifice, a double check, and mate — in three moves.'),
  ]),
  lesson('s2-deflection', 'Deflection', 'shuffle', 'Drag a defender away from its job.', [
    say('r1bqk1nr/4pppp/8/8/2B5/2N2N2/5PPP/R1BQ2K1 w - - 0 1', 'A piece that **guards** something can be forced away. Here the black queen is defended only by the king. If the king has to leave, the queen falls.', { arrows: ['?e8d8', 'd1d8'] }),
    play('r1bqk1nr/4pppp/8/8/2B5/2N2N2/5PPP/R1BQ2K1 w - - 0 1', 'Deflect the king from the queen.', 'Bxf7+', 'A bishop sacrifice with check.', 'Bxf7+! If the king takes, Qxd8 wins the queen for a bishop. If he steps aside to f8, the queen falls anyway.'),
    say('3r2k1/5ppp/8/3q4/8/8/5PPP/3QR1K1 w - - 0 1', 'A close cousin: the **overloaded** piece. The black rook has two jobs — it guards the queen and it guards the back rank. It cannot do both.', { arrows: ['?d8d5', '?d8e8'] }),
    play('3r2k1/5ppp/8/3q4/8/8/5PPP/3QR1K1 w - - 0 1', 'Punish the overloaded rook.', 'Qxd5', 'Take what it guards and see what it has to give up.', 'Qxd5! If the rook recaptures, Re8 is checkmate on the back rank. Black is simply a queen down.'),
    ask('3r2k1/5ppp/8/3q4/8/8/5PPP/3QR1K1 w - - 0 1', 'How do you spot these tricks in your own games?', ['Ask of each defender: "What else is it guarding?"', 'Wait for the opponent to blunder', 'Trade queens early'], 0, 'Find the important target, find its defender, then ask what else that defender is doing or whether it can be chased, captured or lured away.'),
  ]),
  lesson('s2-attraction', 'Attraction', 'target', 'Lure a piece — usually the king — onto a fatal square.', [
    say('3q2k1/5pp1/8/6N1/8/8/8/2K4R w - - 0 1', '**Attraction** (or decoy) is a sacrifice that pulls an enemy piece onto a square where something bad happens to it. Here the knight would love to fork king and queen from f7 — but the king is on the wrong square.', { arrows: ['?g5f7'], info: ['h8'] }),
    play('3q2k1/5pp1/8/6N1/8/8/8/2K4R w - - 0 1', 'Lure the king onto h8.', 'Rh8+', 'Give up the rook with check.', 'Rh8+! The king must take.'),
    play(pos('Rh8+ Kxh8', '3q2k1/5pp1/8/6N1/8/8/8/2K4R w - - 0 1'), 'Now the fork is there.', 'Nxf7+', 'The knight checks the king and attacks the queen.', 'Nxf7+ and the queen is won. You gave a rook (5) and collected a queen and a pawn (10).'),
    ask('3q2k1/5pp1/8/6N1/8/8/8/2K4R w - - 0 1', 'What is the thinking trick behind attraction?', ['"If only that piece stood THERE…" — then force it there', 'Sacrifice whenever possible', 'Always check with a rook'], 0, 'Imagine the dream position first, then look for a forcing move — a check or capture — that makes it real.'),
  ]),
  lesson('s2-trapped', 'Trapped pieces', 'trap', 'A piece with no safe square is as good as lost.', [
    say(pos('e4 e5 Nf3 Nc6 Bb5 a6 Ba4 d6 d4 b5 Bb3 Nxd4 Nxd4 exd4 Qxd4 c5 Qd5 Be6 Qc6+ Bd7 Qd5'), 'A piece is **trapped** when it is attacked and has no safe square. This is the "Noah’s Ark" trap from the Ruy Lopez: White grabbed a pawn with the queen, and the bishop on b3 is running out of air.', { bad: ['b3'], flip: true }),
    play(pos('e4 e5 Nf3 Nc6 Bb5 a6 Ba4 d6 d4 b5 Bb3 Nxd4 Nxd4 exd4 Qxd4 c5 Qd5 Be6 Qc6+ Bd7 Qd5'), 'You are Black. Shut the door on the bishop.', ['c4', 'Be6'], 'A pawn move attacks the bishop and takes its last squares.', 'c4! The bishop is attacked and every square it could go to is covered by pawns. Black wins a piece.', { flip: true }),
    ask(pos('e4 e5 Nf3 Nc6 Bb5 a6 Ba4 d6 d4 b5 Bb3'), 'Which pieces get trapped most often?', ['Bishops and knights on the edge, and queens that grab pawns far from home', 'Rooks in the corner', 'Kings'], 0, 'Before you send a piece into enemy territory — especially a queen taking the b2 or b7 pawn — count its escape squares.'),
    ask(pos('e4 e5 Nf3 Nc6 Bb5 a6 Ba4 d6 d4 b5 Bb3'), '"A knight on the rim is dim." Why?', ['It controls far fewer squares and has fewer ways out', 'It is against the rules', 'It blocks the rook'], 0, 'A knight in the centre reaches eight squares, on the edge four, in the corner two. Fewer squares means easier to trap and less useful.'),
  ]),
  lesson('s2-intermezzo', 'The in-between move', 'zap', 'You do not have to recapture straight away.', [
    say('r2r2k1/pp3ppp/8/8/8/2b1BN1P/PP3PPK/3R4 w - - 0 1', 'Black has just captured a knight on c3. The automatic reply is to take back with the pawn. But look first: after bxc3, Black plays …Rxd1 and wins a whole rook.', { arrows: ['?b2c3', '!d8d1'] }),
    play('r2r2k1/pp3ppp/8/8/8/2b1BN1P/PP3PPK/3R4 w - - 0 1', 'Find the **in-between move**: a forcing move first, the recapture after.', 'Rxd8+', 'Trade the rooks with check before you take the bishop.', 'Rxd8+! Black must recapture, and only then do you play bxc3. The German name is *Zwischenzug*.'),
    ask('r2r2k1/pp3ppp/8/8/8/2b1BN1P/PP3PPK/3R4 w - - 0 1', 'When should you look for an in-between move?', ['Whenever a recapture looks automatic — yours or theirs', 'Only in the endgame', 'Never; always recapture'], 0, 'Before any "obvious" recapture, check for a check or a bigger threat first. And when you calculate a trade, ask whether THEY have an in-between check.'),
  ]),
  lesson('s2-defence', 'Five ways to meet a threat', 'shield', 'Being attacked is not the same as being lost.', [
    say(pos('e4 e5 Nf3 Nc6 Bb5'), 'When something of yours is attacked you have five kinds of answer: **move** it, **block** the line, **capture** the attacker, **defend** it, or make a **bigger threat** yourself. Run through all five before you choose.', { flip: true }),
    ask(pos('e4 e5 Nf3 Nc6 Bb5'), 'White’s bishop attacks the knight that defends e5. Is Bxc6 followed by Nxe5 a real threat right now?', ['Yes, a pawn is lost', 'Not yet: after Bxc6 dxc6 Nxe5, …Qd4 wins the pawn back'], 1, 'After Bxc6 dxc6 Nxe5 Qd4 the queen forks knight and e4 pawn. So Black can calmly play …a6 or …Nf6. Checking whether a threat is REAL saves you from passive moves.', { flip: true }),
    ask(pos('e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5'), 'Which kind of answer is …d5 against the attack on f7?', ['Block', 'Capture', 'Move away'], 0, 'It blocks the bishop’s line. Blocking only works against bishops, rooks and queens — a knight’s attack cannot be blocked.', { flip: true }),
    ask(pos('e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5'), 'Your queen is attacked, but you can give checkmate in two. What do you do?', ['Save the queen', 'Play the mate — a bigger threat beats a smaller one'], 1, 'The counter-threat is the answer people forget. If your threat is bigger and comes first, their attack does not matter.', { flip: true }),
  ]),
];
