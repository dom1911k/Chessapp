// Stage 1 — First steps: the rules people skip, what the pieces are worth, and staying safe.
import { ask, lesson, mate, play, pos, say, START } from '../build';

export const S1 = [
  lesson('s1-values', 'What the pieces are worth', 'gem', 'Count points before every trade.', [
    say(START, 'Every piece has a value in **points**: pawn 1, knight 3, bishop 3, rook 5, queen 9. The king is priceless — lose him and the game is over.'),
    say(START, 'Use the points to judge **trades**. Giving a knight (3) for a rook (5) wins 2 points — players call that "winning the exchange". Giving a rook for a bishop loses 2.', { info: ['a1', 'b1', 'c1', 'd1'] }),
    ask(START, 'You can trade your bishop and knight for a rook and a pawn. In points, who comes out ahead?', ['It is equal: 6 for 6', 'I win a point', 'I lose a point'], 0, 'Equal on paper: 3 + 3 = 6 and 5 + 1 = 6. In practice two pieces usually beat a rook and pawn in the middlegame, so be careful with this trade.'),
    play('4k3/8/8/2n1q3/3P4/8/8/6K1 w - - 0 1', 'Your pawn attacks two pieces. Take the one worth more.', 'dxe5', 'Queen 9, knight 3.', 'The queen! Always take the bigger piece unless there is a very good reason not to.'),
    ask(START, 'You are a rook up. Your opponent offers to trade queens. Good idea?', ['Yes — trade pieces when ahead', 'No — keep the queens on', 'It makes no difference'], 0, 'When you are ahead in material, **trade pieces** (not pawns). The fewer pieces left, the more your extra rook matters and the less counterplay they have.'),
  ]),
  lesson('s1-castling', 'Castling', 'castle', 'Tuck the king away and wake up a rook — in one move.', [
    say(pos('e4 e5 Nf3 Nc6 Bc4 Bc5'), '**Castling** is the only move where two pieces move at once: the king jumps two squares toward a rook, and the rook hops over him. It makes the king safe and brings the rook into play.', { arrows: ['e1g1', '?h1f1'] }),
    play(pos('e4 e5 Nf3 Nc6 Bc4 Bc5'), 'The squares between king and rook are empty. Castle!', 'O-O', 'Move the king two squares to the right.', 'Castled. Your king sits behind three pawns and the rook is ready for the centre.'),
    ask(pos('e4 e5 Nf3 Nc6 Bc4 Bc5'), 'When are you NOT allowed to castle?', ['When the king has already moved', 'When the king is in check or would pass through an attacked square', 'Both of these'], 2, 'You cannot castle if the king or that rook has moved, if you are in check, or if the king would cross or land on an attacked square. (The rook may be attacked — that is fine.)'),
    ask(pos('e4 e5 Nf3 Nc6 Bc4 Bc5 O-O Nf6 d3 d6'), 'How soon should you usually castle?', ['Only when the king is attacked', 'In the first ten moves or so', 'Never — the king is a fighter'], 1, 'Castle early. A king stuck in the middle gets hit when the centre opens. A good target: both knights and a bishop out, then castle.'),
  ]),
  lesson('s1-special', 'En passant and promotion', 'crown', 'The two pawn rules that surprise beginners.', [
    say(pos('e4 a6 e5 d5'), 'Black just pushed a pawn **two squares**, landing right beside your pawn. For one move only you may capture it as if it had moved one square. This is **en passant** ("in passing").', { arrows: ['e5d6'], info: ['d5'] }),
    play(pos('e4 a6 e5 d5'), 'Capture en passant. Your pawn goes to the square the black pawn skipped.', 'exd6', 'Your e-pawn moves diagonally to d6.', 'Right — your pawn lands on d6 and the d5 pawn disappears. Wait a move and the chance is gone.'),
    say('8/4P1k1/8/8/8/8/8/4K3 w - - 0 1', 'A pawn that reaches the last rank **promotes**: it becomes a queen, rook, bishop or knight — your choice. That is why a single extra pawn can win a game.', { arrows: ['e7e8'] }),
    play('8/4P1k1/8/8/8/8/8/4K3 w - - 0 1', 'Promote your pawn to the strongest piece.', 'e8=Q', 'Push to e8 and pick the queen.', 'A new queen. You can even have two or three queens at once.'),
    ask('8/4P1k1/8/8/8/8/8/4K3 w - - 0 1', 'Which piece do you choose almost every time?', ['Queen', 'Rook', 'Knight'], 0, 'The queen — except in rare cases: a knight when it gives a winning check or fork, or a rook when a queen would stalemate the enemy king.'),
  ]),
  lesson('s1-counting', 'Attackers and defenders', 'shield', 'Is that capture safe? Count first.', [
    say(pos('e4 e5 Nf3 Nc6'), 'Your knight attacks the e5 pawn. But the pawn is **defended** by the knight on c6. If you take, they take back: you lose 3 and win 1.', { arrows: ['f3e5', '!c6e5'] }),
    ask(pos('e4 e5 Nf3 Nc6'), 'The rule for one square: you win material only if…', ['you have MORE attackers than they have defenders', 'you have the same number', 'your piece is bigger'], 0, 'Count attackers and defenders. With more attackers than defenders you come out ahead — as long as you capture with the **cheapest piece first**.'),
    say(pos('e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5'), 'Now look at f7. White attacks it **twice** (knight and bishop). Black defends it **once** (the king). Two against one: f7 is about to fall.', { arrows: ['g5f7', 'c4f7'], bad: ['f7'] }),
    play(pos('e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5'), 'You are Black. You cannot add a defender to f7 — so block one of the attackers.', 'd5', 'Put a pawn in the bishop’s way.', 'd5! The pawn blocks the bishop and attacks it too. One attacker fewer.', { flip: true }),
    ask(pos('e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5'), 'A piece of yours is attacked once and defended once. Is it safe?', ['Always', 'Only if the attacker is worth at least as much as my piece', 'Never'], 1, 'Equal numbers are fine only when the trade is fair. A queen "defended" by a pawn is not safe from a knight: they happily give 3 to win 9.'),
  ]),
  lesson('s1-ladder', 'The ladder mate', 'rook', 'Two rooks walk the king to the edge.', [
    say('8/8/8/4k3/R7/8/8/1R4K1 w - - 0 1', 'Two rooks mate a lone king with no help from your own king. One rook **guards a rank** like a fence; the other gives check on the next rank. The king must step back.', { arrows: ['?a4h4', 'b1b5'] }),
    play('8/8/8/4k3/R7/8/8/1R4K1 w - - 0 1', 'The a-rook fences off the 4th rank. Give check on the 5th.', 'Rb5+', 'The b-rook slides up to b5.', 'Check! The king has to retreat to the 6th rank. Now the other rook climbs past: Ra6+, then Rb7+ …'),
    say('4k3/1R6/R7/8/8/8/8/6K1 w - - 0 1', 'The rooks have climbed like feet on a ladder. The king is on the last rank and the b-rook fences off the 7th.', { arrows: ['?b7h7'] }),
    mate('4k3/1R6/R7/8/8/8/8/6K1 w - - 0 1', 'Finish the ladder.', 'The a-rook gives check on the last rank.', 'Ra8# — checkmate. If the king ever walks up to a rook, just swing the rook to the far side of the board and carry on.'),
  ]),
  lesson('s1-scholar', 'Stopping the four-move mate', 'swords', 'Every beginner meets Qh5 and Bc4. Here is the cure.', [
    say(pos('e4 e5 Qh5 Nc6 Bc4'), 'White aims queen and bishop at **f7** and threatens Qxf7 checkmate — "Scholar’s mate". Do not panic: one calm move stops it.', { arrows: ['!h5f7', '!c4f7'], bad: ['f7'], flip: true }),
    play(pos('e4 e5 Qh5 Nc6 Bc4'), 'You are Black. Block the queen’s path to f7.', ['g6', 'Qe7', 'Qf6'], 'A pawn move attacks the queen and blocks the diagonal.', 'Mate is stopped. g6 is the most useful: it hits the queen and prepares …Bg7.', { flip: true }),
    play(pos('e4 e5 Qh5 Nc6 Bc4 g6 Qf3'), 'The queen tries again from f3. Defend f7 and develop a piece at the same time.', ['Nf6'], 'A knight can stand in the queen’s way.', 'Nf6! The threat is over and you have gained time: White moved the queen three times, you developed three pieces.', { flip: true }),
    ask(pos('e4 e5 Qh5 Nc6 Bc4 g6 Qf3 Nf6'), 'What is the lesson for your own openings?', ['Bring the queen out early to scare them', 'Develop knights and bishops first; the queen comes later', 'Always play g6'], 1, 'An early queen gets chased around while the opponent develops with tempo. Knights and bishops first.'),
  ]),
  lesson('s1-threats', 'What does that move threaten?', 'eye', 'The one question that prevents most blunders.', [
    say(pos('e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5'), 'After **every** move by your opponent, ask: "What does it threaten? What changed?" A piece that just moved attacks new squares — and has stopped guarding old ones.', { arrows: ['!g5f7'], flip: true }),
    ask(pos('e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5'), 'White just played Ng5. What is the threat?', ['Nothing special', 'Nxf7, forking the queen and the rook', 'Qh5 checkmate'], 1, 'Nxf7 would attack the queen on d8 and the rook on h8 at once, and the king cannot take because the bishop guards f7.', { flip: true }),
    say(pos('e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5'), 'Then, before **your own** move, the blunder check: "After I play this, what can they capture, and what checks do they have?" It takes five seconds and saves pieces.', { flip: true }),
    ask(pos('e4 e5 Nf3 Nc6 Bc4 Bc5 d3'), 'Black wants to play …Nd4 here. What must Black check first?', ['Whether the knight can be captured for free on d4', 'Nothing — knights belong in the centre', 'Whether it is a check'], 0, 'If White takes with Nxd4, Black takes back with the bishop or the pawn — a fair trade, so the move is fine. The habit is what matters: look at every capture before you let go of the piece.', { flip: true }),
  ]),
  lesson('s1-draws', 'How games are drawn', 'repeat', 'Stalemate, repetition and when there is not enough to win.', [
    say('7k/8/5K2/6Q1/8/8/8/8 w - - 0 1', 'A game is **drawn** by stalemate (no legal move, not in check), by repeating the same position three times, by 50 moves without a capture or pawn move, or when neither side has enough to mate.'),
    ask('7k/8/5K2/6Q1/8/8/8/8 w - - 0 1', 'You have only a king and a bishop against a lone king. Can you win?', ['Yes, with care', 'No — it is an automatic draw'], 1, 'King and bishop, or king and knight, can never checkmate. King and rook, or king and queen, always can. Keep that in mind before trading your last pawn.'),
    mate('7k/8/5K2/6Q1/8/8/8/8 w - - 0 1', 'You are a queen up. Find the checkmate — a careless move here is stalemate.', 'The queen goes next to the king, protected by your own king.', 'Qg7#. Compare with Kf7 or Qg6: the black king would have no move and no check — stalemate, half a point thrown away.'),
    ask('7k/8/5K2/6Q1/8/8/8/8 w - - 0 1', 'You are losing badly but can check the enemy king forever. What do you do?', ['Resign', 'Keep checking — it is a draw by repetition', 'Stop checking and hope'], 1, '**Perpetual check** saves lost games. When you are behind, look for checks that cannot be stopped; when you are ahead, make sure your king has a hiding place.'),
  ]),
];
