// Stage 5 — Strategy: what to do when there is no tactic.
import { ask, lesson, play, pos, say } from '../build';

const ITALIAN = 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O Re1 a6 Bb3 Ba7 h3 h6 Nbd2 Re8';
const IQP = 'e4 c6 d4 d5 exd5 cxd5 c4 Nf6 Nc3 e6 Nf3 Be7 cxd5 Nxd5 Bd3 O-O O-O Nc6';
const CARLSBAD = 'd4 d5 c4 e6 Nc3 Nf6 cxd5 exd5 Bg5 Be7 e3 O-O Bd3 c6 Qc2 Nbd7 Nf3 Re8 O-O';
const FRENCH = 'e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3';
const KALASH = 'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 e5 Nb5 d6';
const DRAGON = 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 Be3 Bg7 f3 O-O Qd2 Nc6 O-O-O';
const KID = 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 d5';
const EXCH = 'e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6';

export const S5 = [
  lesson('s5-activity', 'Piece activity', 'sparkles', 'The player with the more active pieces usually wins.', [
    say(pos(ITALIAN), 'Material is only half the story. A piece is worth what it **does**: how many squares it controls, what it attacks, whether it takes part in the game. Strategy is mostly the art of making your pieces better than theirs.'),
    ask(pos(ITALIAN), 'Which white piece is doing the least here?', ['The knight on d2', 'The bishop on b3', 'The rook on e1'], 0, 'The knight on d2 controls little and blocks the bishop on c1. Its route is Nf1–g3 (or e3), heading for f5 or d5.', { info: ['d2'], arrows: ['?d2f1', '?f1g3'] }),
    ask(pos(ITALIAN), 'A simple rule for quiet positions?', ['Find your worst piece and improve it', 'Push the pawns in front of your king', 'Trade a pair of pieces every move'], 0, 'One better piece per move, and the position improves by itself. It is the most reliable plan in chess.'),
    ask(pos(ITALIAN), 'Where are knights, bishops and rooks happiest?', ['Knights on protected central squares, bishops on long open diagonals, rooks on open files', 'All of them on the back rank', 'On the edge of the board'], 0, 'Knights need outposts, bishops need open diagonals, rooks need open files and the seventh rank. Queens like to stay flexible behind them.'),
  ]),
  lesson('s5-outposts', 'Outposts and weak squares', 'knight', 'A square no enemy pawn can ever attack.', [
    say(pos(KALASH), 'Black has played …e5. The square **d5** can no longer be attacked by a black pawn: the c- and e-pawns are gone or have passed it. A square like that is a **hole**; when your piece sits there, protected, it is an **outpost**.', { info: ['d5'] }),
    ask(pos(KALASH), 'Which piece benefits most from an outpost on d5?', ['A knight', 'A rook', 'The king'], 0, 'A knight on a protected central outpost attacks eight squares deep in the enemy camp and cannot be chased by pawns. It is often worth as much as a rook.', { arrows: ['?b1c3', '?c3d5'] }),
    ask(pos(KALASH), 'How does the defender fight for the square?', ['Trade the pieces that can occupy it, or cover it with pieces', 'Ignore it', 'Push the h-pawn'], 0, 'Black wants to exchange White’s knights (…Be6, …Nf6) so nothing good can land on d5. Fights for one square decide whole openings.'),
    ask(pos(KALASH), 'Before you push a pawn, what should you check?', ['Which squares it stops guarding — pawns never move back', 'Whether it looks aggressive', 'Nothing'], 0, 'Every pawn move leaves a hole behind. …e5 gained space but gave up d5 for good. Push pawns for a reason.'),
  ]),
  lesson('s5-files', 'Open files and the seventh rank', 'rook', 'Rooks need roads.', [
    say('r5k1/pp3ppp/8/8/8/8/PP3PPP/3R2K1 w - - 0 1', 'A file with no pawns on it is **open**. The side whose rook gets there first controls it — and the usual destination is the **seventh rank**, where the rook attacks pawns from the side and cages the king.', { arrows: ['d1d7'] }),
    play('r5k1/pp3ppp/8/8/8/8/PP3PPP/3R2K1 w - - 0 1', 'You control the open d-file. Invade!', 'Rd7', 'Go to the seventh rank.', 'Rd7! The rook attacks b7 and ties Black’s rook to defence. A rook on the seventh is often worth a pawn.'),
    ask('r5k1/pp3ppp/8/8/8/8/PP3PPP/3R2K1 w - - 0 1', 'Both sides want the only open file. How do you fight for it?', ['Double rooks on it (or rooks and queen)', 'Avoid it', 'Block it with a pawn'], 0, 'Double your heavy pieces. If the opponent has the file, cover the entry squares on your second rank or trade one pair of rooks.'),
    ask(pos(EXCH), 'A file with only ENEMY pawns on it is half-open. What is it good for?', ['Pressing on that pawn with rooks', 'Nothing', 'Hiding the king'], 0, 'A half-open file is an attack lane against the pawn at the end of it — especially if that pawn is backward or isolated.'),
  ]),
  lesson('s5-pawns', 'Pawn weaknesses', 'pawn', 'Isolated, doubled, backward.', [
    say(pos(EXCH), 'Pawns are strongest side by side. Black’s c-pawns are **doubled**: they cannot protect each other and move clumsily. In return Black got the bishop pair and open lines — weaknesses are usually bought with something.', { bad: ['c7', 'c6'] }),
    ask(pos(EXCH), 'Thanks to the doubled pawns, White has a healthy 4-against-3 pawn majority on the kingside. Why does that matter?', ['A healthy majority can create a passed pawn in the endgame; a crippled one cannot', 'It does not', 'It attacks the king'], 0, 'This is White’s whole plan in the Exchange Ruy Lopez: trade pieces, reach an endgame, make a passed pawn with f4–f5 and e5.'),
    say(pos(IQP), 'White’s d-pawn is **isolated**: no white pawn on the c- or e-file can protect it. It must be defended by pieces — and the square in front of it, d5, is a perfect blockade square for a black knight.', { bad: ['d4'], info: ['d5'] }),
    ask(pos(IQP), 'How should the side WITH the isolated pawn play?', ['Keep pieces on and attack: the pawn gives space and open lines', 'Trade everything', 'Push the a-pawn'], 0, 'The isolated queen’s pawn is strong in the middlegame (space, e5 and c5 outposts, open lines to the king) and weak in the endgame. So: attack with pieces — and the side against it trades pieces and blockades.'),
    ask(pos(IQP), 'A **backward** pawn is one that…', ['is behind its neighbours and cannot safely advance', 'moves backwards', 'is on the back rank'], 0, 'It sits on a half-open file and the square in front of it is a hole. Pile up on the pawn, plant a piece in front of it.'),
  ]),
  lesson('s5-passed', 'Passed pawns', 'crown', 'A pawn with no enemy pawn in its way.', [
    say('6k1/5ppp/8/3P4/8/8/5PPP/3R2K1 w - - 0 1', 'A **passed pawn** has no enemy pawn in front of it or on the neighbouring files. Nothing but pieces can stop it. The closer it gets to promotion, the more of the enemy army it ties down.', { arrows: ['d5d8'] }),
    ask('6k1/5ppp/8/3P4/8/8/5PPP/3R2K1 w - - 0 1', 'Where does the rook belong?', ['BEHIND the passed pawn', 'In front of it', 'Far away'], 0, 'Behind the pawn the rook gains space with every push. This is true for your own passed pawns and — as the defender — for the enemy’s too.'),
    ask('6k1/5ppp/8/3P4/8/8/5PPP/3R2K1 w - - 0 1', 'How do you stop an enemy passed pawn?', ['Blockade it: put a piece, ideally a knight, on the square in front of it', 'Attack it from the side', 'Ignore it'], 0, '"Passed pawns must be pushed" — so the defender blocks the square in front. A knight is the best blockader because it still attacks from there.'),
    ask('6k1/5ppp/8/3P4/8/8/5PPP/3R2K1 w - - 0 1', 'You are a pawn up in an endgame. What is the plan?', ['Create a passed pawn and escort it with king and pieces', 'Attack the king', 'Keep all pawns at home'], 0, 'An extra pawn wins by becoming a queen — or by forcing the enemy to give up a piece for it.'),
  ]),
  lesson('s5-bishops', 'Good bishop, bad bishop', 'bishop', 'Your pawns decide how good your bishops are.', [
    say(pos(FRENCH), 'Black’s centre pawns stand on light squares (d5, e6). The light-squared bishop on c8 is hemmed in by its own pawns: a **bad bishop**. The dark-squared bishop on f8 moves freely: a **good bishop**.', { bad: ['c8'], good: ['f8'], flip: true }),
    ask(pos(FRENCH), 'What can you do with a bad bishop?', ['Trade it, or get it outside the pawn chain before closing the chain', 'Keep it forever', 'Put more pawns on its colour'], 0, 'Exchange it for an enemy piece (…b6 and …Ba6 in the French) or develop it outside the chain first (as in the Caro-Kann). And put your pawns on the opposite colour of the bishop you keep.', { flip: true }),
    ask(pos(KID), 'Closed centre, locked pawns. Bishops or knights?', ['Knights — they jump over the pawns', 'Bishops — always', 'No difference'], 0, 'Bishops need open lines; knights love closed positions and outposts. In open positions with pawns on both wings, bishops are better.'),
    ask(pos(EXCH), 'Black has both bishops against bishop and knight. What does the "bishop pair" want?', ['An open position', 'A closed position', 'A queen trade'], 0, 'Two bishops cover both colours and dominate open boards. With the pair, open the game; against it, keep things closed and find outposts for your knights.', { flip: true }),
  ]),
  lesson('s5-space', 'Space', 'map', 'More room means more options.', [
    say(pos('e4 e6 d4 d5 e5'), 'White’s pawn on e5 takes squares away from Black: no knight on f6, little room on the kingside. The side with more **space** can move pieces from wing to wing faster.', { info: ['e5', 'd4'] }),
    ask(pos('e4 e6 d4 d5 e5'), 'You have more space. Should you trade pieces?', ['No — keep pieces on; the cramped side suffers with many pieces', 'Yes, as many as possible', 'Only queens'], 0, 'A cramped army gets in its own way. With space: avoid trades. Without space: trade a pair or two of minor pieces and the cramp disappears.'),
    ask(pos('e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6'), 'How does the cramped side fight back?', ['With pawn breaks against the enemy pawn chain', 'By waiting', 'By moving the king'], 0, 'Black hits the chain with …c5 and …f6. A pawn break trades the pawn that cramps you and opens lines for your pieces.', { arrows: ['c5d4', '?f7f6'], flip: true }),
  ]),
  lesson('s5-breaks', 'Pawn breaks and the centre', 'bridge', 'The structure tells you where to play.', [
    say(pos(KID), 'The centre is **closed**: pawns are locked on d5/e5 and d6/e4. Pieces cannot get through the middle, so both sides play on the wings — and they open lines with **pawn breaks**.', { arrows: ['?f7f5', '?c4c5'] }),
    ask(pos(KID), 'Rule of thumb: on which side do you play?', ['Where my pawn chain points', 'Where my king is', 'On the a-file'], 0, 'White’s chain e4–d5 points to the queenside: c4–c5. Black’s chain d6–e5 points to the kingside: …f5. Attack in the direction your pawns point.'),
    ask(pos('e4 e5 Nf3 Nc6 d4 exd4 Nxd4'), 'The centre is OPEN (few centre pawns). What matters most?', ['Development, piece activity and king safety', 'Slow pawn manoeuvres on the wing', 'Keeping the king in the middle'], 0, 'In open positions every tempo counts and a king in the centre is in danger. Wing pawn attacks are too slow — the answer to a wing attack is a blow in the centre.'),
    ask(pos(ITALIAN), 'When is a wing attack justified?', ['When the centre is closed or firmly under control', 'Always', 'When you are behind in development'], 0, 'If the centre can be blown open, your wing attack collapses. Secure or close the centre first.'),
  ]),
  lesson('s5-castling', 'Opposite-side castling', 'swords', 'A race: pawns forward, no time to lose.', [
    say(pos(DRAGON), 'The kings have castled on **opposite sides**. Now each side can throw the pawns in front of the ENEMY king forward without weakening its own. The game becomes a race.', { arrows: ['?h2h4', '?h4h5', '?g2g4'] }),
    ask(pos(DRAGON), 'What is White’s standard attacking plan here?', ['h4–h5 to open the h-file, Bh6 to trade the defending bishop, then mate on h7', 'Trade queens', 'Castle again'], 0, 'Open the h-file, exchange the bishop on g7 (the king’s best defender), bring queen and rook to the h-file. Black meanwhile attacks down the c-file.'),
    ask(pos(DRAGON), 'What decides a race like this?', ['Speed: every move must further the attack or stop theirs', 'Material', 'Pawn structure'], 0, 'Tempo is everything. Do not stop to win a pawn on the other wing. Sacrificing a pawn — or the exchange — to open a file a move sooner is normal.'),
    ask(pos(DRAGON), 'With kings castled on the SAME side, should you push the pawns in front of your king?', ['Rarely — it exposes my own king', 'Always', 'Only the h-pawn, every game'], 0, 'With same-side castling you attack with pieces, and use pawns only when the centre is closed.'),
  ]),
  lesson('s5-minority', 'Plans from the pawn structure', 'scroll', 'The Carlsbad structure and the minority attack.', [
    say(pos(CARLSBAD), 'This **Carlsbad structure** arises from the Queen’s Gambit. White has a half-open c-file, Black a half-open e-file. Black has four queenside pawns against White’s two — and still it is White who attacks there.', { info: ['c6', 'd5'] }),
    ask(pos(CARLSBAD), 'White plays b4–b5: the "minority attack". What is the point?', ['After bxc6 Black is left with a weak pawn on c6 (or on d5)', 'To win the a-pawn', 'To promote the b-pawn'], 0, 'Two pawns attack four in order to break them up. Whatever Black does, a weak pawn remains on the half-open file for White’s rooks to attack.', { arrows: ['?b2b4', '?b4b5'] }),
    ask(pos(CARLSBAD), 'What is Black’s counter-plan?', ['Play on the kingside and in the centre: …Ne4, …f5, pieces toward the white king', 'Copy White', 'Push the a-pawn'], 0, 'Black uses the e-file and the e4 square. Every pawn structure hands both players a plan — learning the typical ones is how you stop "having no idea what to do".'),
    ask(pos(IQP), 'How do you learn the plans for YOUR openings?', ['Look at model games in that structure and notice where the pieces go', 'Memorise 30 moves', 'Guess'], 0, 'Structures repeat; move orders do not. The model games in this course are chosen for exactly that.'),
  ]),
  lesson('s5-trades', 'When to trade', 'shuffle', 'Every exchange changes who is better.', [
    say(pos(ITALIAN), 'A trade is never "just equal". Ask what stays on the board. Good players win quiet positions by making the right exchanges and avoiding the wrong ones.'),
    ask(pos(ITALIAN), 'You are a piece ahead. Which trades do you want?', ['Pieces, but not pawns', 'Pawns, but not pieces', 'None'], 0, 'Ahead: trade pieces to reduce counterplay and reach a winning endgame — keep pawns, because you need them to promote. Behind: trade pawns, keep pieces, hope for a draw or a swindle.'),
    ask(pos(ITALIAN), 'Your opponent has one very strong piece. What do you do?', ['Offer to trade it off', 'Leave it alone', 'Attack on the other side'], 0, 'Trade your bad pieces for their good ones. Exchanging their best attacker or their outpost knight often solves all your problems.'),
    ask(pos(ITALIAN), 'You are attacking the king. Do you trade queens?', ['Usually not — the attack needs the queen', 'Yes, always', 'Only on Fridays'], 0, 'Keep attackers on; the defender wants trades. And when you are under attack, trading queens is often the simplest defence.'),
    ask(pos(ITALIAN), 'Who should release the tension when pawns face each other?', ['Usually nobody in a hurry — the side that captures often helps the opponent', 'Always me', 'Always capture first'], 0, 'Capturing gives the opponent a recapture that develops or opens a file for him. Keep the tension until taking brings something concrete.'),
  ]),
  lesson('s5-prophylaxis', 'Prophylaxis', 'shield', 'Ask what your opponent wants — and stop it.', [
    say(pos('e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O'), '**Prophylaxis** means preventing the opponent’s idea before it happens. Before choosing your move, ask: "If it were his turn, what would he play?" Often the best move is the one that takes that away.'),
    play(pos('e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O'), 'Black would like to pin your knight with …Bg4. Prevent it with a useful little move.', 'h3', 'A pawn can guard g4.', 'h3. It stops …Bg4 and …Ng4, and later gives your king an escape square against back-rank tricks.'),
    ask(pos('e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O h3'), 'When is a quiet "luft" move like h3 a good idea?', ['When nothing more urgent is going on', 'On move two', 'When I am being mated'], 0, 'Prophylactic moves are for calm moments. If there is a tactic or a development move to make, do that first.'),
    ask(pos(CARLSBAD), 'The strongest form of prophylaxis?', ['A move that improves my position AND stops his plan', 'Any waiting move', 'Offering a draw'], 0, 'The ideal move does both. Great positional players seem to give the opponent "nothing to do" — that is prophylaxis.'),
  ]),
  lesson('s5-plan', 'Making a plan', 'brain', 'Imbalances tell you what to do.', [
    say(pos(CARLSBAD), 'A plan is not a 20-move prophecy. It is the answer to: "What are the differences between the two positions, and how do I use mine?" Those differences are called **imbalances**.'),
    ask(pos(CARLSBAD), 'Which of these is NOT an imbalance?', ['Both sides have castled', 'A better minor piece', 'More space or an open file', 'A weak pawn or weak king'], 0, 'Imbalances are differences: material, piece quality, pawn structure, space, files, king safety, development. What is the same for both sides gives no plan.'),
    ask(pos(IQP), 'You found your advantage: better pieces on the kingside. What follows?', ['Play there: bring more pieces to that side', 'Play on the other side for variety', 'Wait'], 0, 'Play where you are stronger. And judge every candidate move by one question: does it help my plan or stop his?'),
    ask(pos(ITALIAN), 'Your plan is being stopped. Now what?', ['Change the plan — a weakness elsewhere has probably appeared', 'Insist on it', 'Resign'], 0, 'Defending one side creates problems on the other. Switching targets — the "principle of two weaknesses" — is how most winning positions are converted.'),
  ]),
];
