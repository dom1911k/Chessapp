// Stage 6 — Endgames: the positions every 1800 player knows by heart.
import { ask, lesson, play, say } from '../build';

export const S6 = [
  lesson('s6-king', 'The king is a fighter', 'king', 'In the endgame the king comes out.', [
    say('8/pp3kpp/8/8/8/8/PP3KPP/8 w - - 0 1', 'With the queens gone there is no mating attack to fear. The king turns into a strong piece — worth about four points — and the first rule of the endgame is: **bring your king to the centre**.', { arrows: ['f2e3', '?e3d4'] }),
    play('8/pp3kpp/8/8/8/8/PP3KPP/8 w - - 0 1', 'Start marching.', ['Ke3', 'Kf3'], 'Toward the middle of the board.', 'Right. A centralised king reaches either wing in time, attacks enemy pawns and shepherds its own.'),
    ask('8/pp3kpp/8/8/8/8/PP3KPP/8 w - - 0 1', 'When does the endgame "start" for your king?', ['When the queens are off, or so little is left that he cannot be mated', 'After move 40', 'Never'], 0, 'Judge by danger, not by move number. Many endings are lost simply because one king stayed at home three moves too long.'),
  ]),
  lesson('s6-keysquares', 'Key squares and the opposition', 'square', 'King and pawn against king: win or draw?', [
    say('4k3/8/4K3/4P3/8/8/8/8 w - - 0 1', 'King and pawn against king is the root of all endgames. The winning method: get your **king in front of the pawn**. A king on the sixth rank in front of his pawn wins no matter who is to move.', { info: ['d6', 'e6', 'f6'] }),
    play('4k3/8/4K3/4P3/8/8/8/8 w - - 0 1', 'Step aside so the pawn can advance and your king controls the queening square.', ['Kd6', 'Kf6'], 'Sidestep diagonally forward-ish: stay on the sixth rank.', 'Yes. After …Kd8 you push e6, e7 and your king covers the queening square. Rule: king first, pawn second.'),
    say('8/4k3/8/3KP3/8/8/8/8 b - - 0 1', 'Now defend. The kings face each other with one square between: whoever does NOT have to move has the **opposition**. Black to play must choose the one square that keeps White’s king out.', { flip: true }),
    play('8/4k3/8/3KP3/8/8/8/8 b - - 0 1', 'Take the opposition and hold the draw.', 'Kd7', 'Stand directly in front of the white king.', '…Kd7! Now the white king cannot advance. After e6+ Ke7, Ke5 Ke8!, Kd6 Kd8, e7+ Ke8, Ke6 it is stalemate.', { flip: true }),
    ask('8/4k3/8/3KP3/8/8/8/8 b - - 0 1', 'The defender’s rule when the pawn comes forward?', ['Step straight back, so you can take the opposition when the king advances', 'Step diagonally back', 'Attack the pawn from behind'], 0, 'Straight back, then face the king. Step back diagonally and the attacker gets the opposition and wins.', { flip: true }),
  ]),
  lesson('s6-zugzwang', 'Zugzwang', 'repeat', 'When having to move is the problem.', [
    say('8/8/8/3p1K2/1k1P4/8/8/8 w - - 0 1', '**Zugzwang**: any move you make worsens your position — you would like to pass, but chess does not allow it. Here each king wants to attack the enemy pawn. Whoever gets there FIRST loses!', { info: ['e5', 'c4'] }),
    play('8/8/8/3p1K2/1k1P4/8/8/8 w - - 0 1', 'Do not attack the pawn at once. Find the move that puts Black in zugzwang.', 'Ke6', 'Approach so that you attack d5 only AFTER his king has reached c4.', 'Ke6! After …Kc4, Ke5 it is Black who must move away from his pawn. (Ke5? Kc4! and you would be the one in zugzwang.)'),
    ask('8/8/8/3p1K2/1k1P4/8/8/8 w - - 0 1', 'Where does zugzwang show up most?', ['In endgames with few pieces, especially pawn endings', 'In the opening', 'Only in puzzles'], 0, 'With few pieces there are few harmless moves. Spare pawn moves ("tempo moves") and triangulation with the king are the tools to hand the move to your opponent.'),
  ]),
  lesson('s6-breakthrough', 'The pawn breakthrough', 'zap', 'Three pawns against three — and one gets through.', [
    say('8/ppp5/8/PPP5/8/8/7k/4K3 w - - 0 1', 'The kings are far away. The pawns face each other and it looks blocked. But White has a sacrificial **breakthrough** that every player should know.', { arrows: ['b5b6'] }),
    play('8/ppp5/8/PPP5/8/8/7k/4K3 w - - 0 1', 'Start with the middle pawn.', 'b6', 'Push the b-pawn.', 'b6! If …axb6 then c6! and after …bxc6, a6 the a-pawn runs through. If …cxb6 then a6! and after …bxa6, c6.'),
    ask('8/ppp5/8/PPP5/8/8/7k/4K3 w - - 0 1', 'What made the breakthrough possible?', ['My pawns were further advanced and his king too far away', 'I had more pawns', 'Luck'], 0, 'Advanced pawns are dangerous even when "blocked". As the defender, never leave such a pawn trio facing yours without your king nearby.'),
  ]),
  lesson('s6-outside', 'The outside passed pawn', 'flag', 'A decoy that wins the other wing.', [
    say('8/5pk1/6p1/8/P7/6P1/5PK1/8 w - - 0 1', 'Material is nearly equal, but White has a passed pawn far from the other pawns — an **outside passed pawn**. Black’s king must run to stop it, and while he is away White’s king eats the kingside.', { arrows: ['a4a8'] }),
    ask('8/5pk1/6p1/8/P7/6P1/5PK1/8 w - - 0 1', 'What is the outside pawn’s real job?', ['To lure the enemy king away', 'To promote by itself', 'To defend my king'], 0, 'It is a decoy. You often give it up at the right moment — your king gains several moves on the other wing.'),
    ask('8/5pk1/6p1/8/P7/6P1/5PK1/8 w - - 0 1', 'So which trades favour the side with the outside passed pawn?', ['Trading all the pieces to reach a pure pawn ending', 'Trading pawns', 'No trades'], 0, 'In a pawn ending the decoy works perfectly. When you have a distant passed pawn, simplify.'),
  ]),
  lesson('s6-rooks', 'Rook endgames: the big rules', 'rook', 'Half of all endgames are rook endgames.', [
    say('8/5pk1/R5p1/P7/8/6P1/r4PK1/8 w - - 0 1', 'Rook endings are won by **activity**, not by counting pawns. An active rook that attacks is worth more than a pawn; a passive rook that only defends usually loses.'),
    ask('8/5pk1/R5p1/P7/8/6P1/r4PK1/8 w - - 0 1', 'Where does a rook belong in relation to a passed pawn?', ['Behind it — your own or the enemy’s', 'In front of it', 'Beside it'], 0, 'Tarrasch’s rule. Behind the pawn the rook’s range grows as the pawn advances; in front of it the rook gets more and more cramped.'),
    ask('8/5pk1/R5p1/P7/8/6P1/r4PK1/8 w - - 0 1', 'You are a pawn down in a rook ending. Defend passively or actively?', ['Actively — give a pawn if needed to make the rook active', 'Passively, guarding everything', 'Resign'], 0, '"All rook endings are drawn" is a joke with a core of truth: active defence saves a great many of them.'),
    ask('8/5pk1/R5p1/P7/8/6P1/r4PK1/8 w - - 0 1', 'What else can a rook do to the enemy king?', ['Cut him off along a rank or file so he cannot reach the pawns', 'Nothing', 'Check him forever in every position'], 0, 'A king cut off by one file or rank from the action is often the whole difference between a win and a draw.'),
  ]),
  lesson('s6-lucena', 'Lucena: building the bridge', 'bridge', 'The winning position in rook and pawn against rook.', [
    say('6K1/4k1P1/8/8/8/8/7r/5R2 w - - 0 1', 'The **Lucena position**: your pawn is on the seventh, your king in front of it, the enemy king cut off. But your own king is stuck — if he steps out, the rook checks him back. The solution is called "building a bridge".'),
    play('6K1/4k1P1/8/8/8/8/7r/5R2 w - - 0 1', 'First, push the enemy king one more file away with a check.', 'Re1+', 'Check on the e-file.', 'Re1+! The king must go to the d-file.'),
    play('6K1/3k2P1/8/8/8/8/7r/4R3 w - - 0 1', 'Now the key move: bring your rook to the fourth rank.', 'Re4', 'Four ranks up — it will block checks later.', 'Re4! This is the bridge. Next your king walks out via f7; the black rook checks from f2, g2, f2… and when your king reaches g5 or f5, the rook blocks on g4 or f4 and the pawn queens.'),
    ask('6K1/3k2P1/8/8/8/8/7r/4R3 w - - 0 1', 'What is the bridge for?', ['To block the rook’s checks so my king can leave the pawn', 'To attack the king', 'To defend the pawn'], 0, 'The rook on the fourth rank gives shelter. Practise it in the Lucena drill until it is automatic.'),
  ]),
  lesson('s6-philidor', 'Philidor: holding the draw', 'wall', 'The defence in rook and pawn against rook.', [
    say('4k3/7R/r7/4PK2/8/8/8/8 b - - 0 1', 'You are a pawn down. The **Philidor position** draws: your king stands on the queening square, and your rook waits on the **sixth rank** (your third), so the enemy king cannot come forward.', { arrows: ['?a6h6'], flip: true }),
    ask('4k3/7R/r7/4PK2/8/8/8/8 b - - 0 1', 'White cannot make progress with the king. So he pushes the pawn to e6. What now?', ['Rook to the far end (a1) and check the king from behind', 'Keep the rook on the sixth', 'Trade rooks'], 0, 'Once the pawn stands on the sixth rank, the white king has no shelter from checks along the files. Rook to the first rank, then check, check, check.', { flip: true }),
    ask('4k3/7R/r7/4PK2/8/8/8/8 b - - 0 1', 'Two-step summary of Philidor?', ['Rook on the sixth until the pawn comes there, then checks from behind', 'Checks from the start', 'King runs away'], 0, 'Wait on the sixth, then check from the rear. Practise it against the engine in the Philidor drill.', { flip: true }),
  ]),
  lesson('s6-minor', 'Bishops, knights and wrong corners', 'bishop', 'Minor-piece endings in four rules.', [
    say('7k/8/8/8/8/8/7P/5B1K w - - 0 1', 'A bishop and a rook’s pawn cannot win if the bishop does not control the **queening corner** and the defending king gets there. h8 is a dark square; this bishop lives on light squares. Draw.', { bad: ['h8'] }),
    ask('7k/8/8/8/8/8/7P/5B1K w - - 0 1', 'You defend against bishop and h-pawn. What is your plan?', ['Run the king to the corner the bishop cannot attack', 'Attack the bishop', 'Give up'], 0, 'The "wrong bishop" draw has saved countless games — players even sacrifice their last piece to reach it.'),
    ask('8/5k2/8/3b4/8/2B5/4K3/8 w - - 0 1', 'Each side has one bishop, on opposite colours. What does that usually mean in the endgame?', ['Strong drawing tendency, even a pawn or two down', 'An easy win for the stronger side', 'Nothing'], 0, 'The bishops can never meet, so the defender builds a blockade on his bishop’s colour. (In the MIDDLEGAME opposite bishops favour the attacker.)'),
    ask('8/5k2/8/3b4/8/2B5/4K3/8 w - - 0 1', 'Bishop against knight with pawns on both wings — who is usually better?', ['The bishop: it works on both sides at once', 'The knight', 'Equal'], 0, 'The long-range bishop handles play on two wings. The knight prefers pawns on one side only, or a blocked position.'),
    ask('8/5k2/8/3b4/8/2B5/4K3/8 w - - 0 1', 'Can two knights force mate against a lone king?', ['No', 'Yes'], 0, 'Two knights cannot force checkmate. Bishop and knight can, but it is hard; two bishops can. Do not trade your last pawn carelessly.'),
  ]),
  lesson('s6-queen', 'Queen against pawn', 'queen', 'A pawn on the seventh: which ones draw?', [
    say('8/8/8/8/1K6/8/3pk3/7Q w - - 0 1', 'Queen against a pawn on the seventh rank. Against a **centre or knight’s pawn** the queen wins: she checks until the king is forced to step in front of his own pawn, then your king takes a step closer. Repeat.', { arrows: ['?b4c3'] }),
    ask('8/8/8/8/1K6/8/3pk3/7Q w - - 0 1', 'Against which pawns on the seventh is it usually only a draw (if your king is far away)?', ['Rook’s pawn and bishop’s pawn', 'Centre pawns', 'Knight’s pawn'], 0, 'With a rook’s pawn the defender hides in the corner and is stalemated. With a bishop’s pawn he steps into the corner and taking the pawn is stalemate. The a-, c-, f- and h-pawns draw.'),
    ask('8/8/8/8/1K6/8/3pk3/7Q w - - 0 1', 'What is the practical lesson for pawn races?', ['Count the race AND know which queen-vs-pawn endings win', 'Always race', 'Never race'], 0, 'If you queen one move ahead of a rook’s or bishop’s pawn reaching the seventh, check first whether you can actually win it.'),
  ]),
  lesson('s6-twoweak', 'The principle of two weaknesses', 'scroll', 'How won positions are actually won.', [
    say('8/5pk1/R5p1/P7/8/6P1/r4PK1/8 w - - 0 1', 'One weakness can usually be defended. So the technique of converting an advantage is to create a **second** target on the other side of the board and switch between them faster than the defender can.'),
    ask('8/5pk1/R5p1/P7/8/6P1/r4PK1/8 w - - 0 1', 'Black’s pieces are tied to stopping your passed a-pawn. What next?', ['Open a second front on the kingside with king and pawns', 'Push the a-pawn at once', 'Trade rooks at any price'], 0, 'The a-pawn is weakness number one. While it ties the rook down, your king goes after the kingside pawns. The defender cannot be in two places.'),
    ask('8/5pk1/R5p1/P7/8/6P1/r4PK1/8 w - - 0 1', 'What is the right mindset when you are clearly better?', ['"Do not hurry": improve everything first, deny counterplay', 'Win as fast as possible', 'Offer a draw'], 0, 'Strong players win slowly. Stop every bit of counterplay, put each piece on its best square, and only then break through.'),
  ]),
];
