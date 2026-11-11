// Stage 7 — Calculation and practical play: thinking like a 1800 player.
import { ask, lesson, mate, play, pos, say } from '../build';

const LASKER = 'd4 e6 Nf3 f5 Nc3 Nf6 Bg5 Be7 Bxf6 Bxf6 e4 fxe4 Nxe4 b6 Ne5 O-O Bd3 Bb7 Qh5 Qe7';
const ITALIAN = 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O Re1 a6 Bb3 Ba7 h3 h6 Nbd2 Re8';

export const S7 = [
  lesson('s7-candidates', 'Candidate moves', 'brain', 'Choose from a list, not from the first idea.', [
    say(pos(ITALIAN), 'Weak players calculate one move deeply and play it. Strong players first make a short list of **candidate moves** — usually two to four — and only then calculate each. The best move is often the one you would not have looked at.'),
    ask(pos(ITALIAN), 'How do you build the list?', ['All forcing moves (checks, captures, threats) plus the moves my plan suggests', 'The first move I see', 'Every legal move'], 0, 'Forcing moves first, then one or two positional moves. Thirty legal moves shrink to a handful of serious ones.'),
    ask(pos(ITALIAN), 'You found a good move. What now?', ['Look for a better one', 'Play it instantly', 'Offer a draw'], 0, '"When you see a good move, look for a better one" (Lasker). At least glance at the other candidates before you commit.'),
    ask(pos(ITALIAN), 'How far should you calculate a line?', ['Until the position is quiet: no more checks or captures', 'Exactly three moves', 'Until move 40'], 0, 'Stop when the forcing moves end, then judge the position: material, king safety, activity. Stopping in the middle of an exchange is the classic calculation error.'),
  ]),
  lesson('s7-forcing', 'Calculating a forcing line', 'zap', 'A king hunt, one check at a time.', [
    say(pos(LASKER), 'Edward Lasker – Thomas, London 1912. White’s pieces all point at the black king. Calculate the checks: there is a queen sacrifice that forces mate in eight.', { arrows: ['h5h7'] }),
    play(pos(LASKER), 'Find the first move.', 'Qxh7+', 'The most forcing move on the board.', 'Qxh7+!! The king must take.'),
    play(pos(LASKER + ' Qxh7+ Kxh7'), 'Now a double check, so the king has to walk.', 'Nxf6+', 'A knight capture that also opens the bishop on d3.', 'Nxf6++! Check from knight and bishop. …Kh8 allows Ng6 mate, so the king goes to h6.'),
    play(pos(LASKER + ' Qxh7+ Kxh7 Nxf6+ Kh6'), 'Keep checking; drive him forward.', 'Neg4+', 'The other knight.', 'Neg4+! Kg5. Then h4+ Kf4, g3+ Kf3, Be2+ Kg2, Rh2+ Kg1 …'),
    mate(pos(LASKER + ' Qxh7+ Kxh7 Nxf6+ Kh6 Neg4+ Kg5 h4+ Kf4 g3+ Kf3 Be2+ Kg2 Rh2+ Kg1'), 'The king has been marched across the whole board. Mate him — with a king move!', 'Moving your king opens the rook on a1.', 'Kd2# (castling long also mates). Every move was a check, so every move was easy to calculate. That is why you look at checks first.'),
  ]),
  lesson('s7-blunder', 'The blunder check', 'eye', 'Five seconds that are worth 200 rating points.', [
    say(pos(ITALIAN), 'Most games below 1800 are still decided by a one-move oversight. The cure is a fixed habit before you release the piece: the **blunder check**.'),
    ask(pos(ITALIAN), 'What do you look at in the blunder check?', ['After my move: his checks, his captures, and what my piece stopped defending', 'My attacking chances', 'The clock only'], 0, 'Picture the position AFTER your move, from his side. Checks, captures, threats — and which square or piece you just abandoned.'),
    ask(pos(ITALIAN), 'When is the risk of a blunder highest?', ['Right after I win something, or when I am sure I am winning', 'In the opening', 'When I am worse'], 0, 'Relaxing is the enemy. Also dangerous: the move right after your opponent’s surprise, and any "obvious" recapture.'),
    ask(pos(ITALIAN), 'How should you use your time?', ['Quick on forced or obvious moves, slow at the critical moments', 'The same time on every move', 'As fast as possible'], 0, 'Critical moments: a possible tactic, a pawn break, a trade that changes the structure, leaving your preparation. Spend time there, not on recaptures.'),
  ]),
  lesson('s7-sacs', 'Clearance and interference', 'flame', 'Advanced tactical ideas.', [
    say('3q2k1/5pp1/8/6N1/8/8/8/2K4R w - - 0 1', 'You know attraction and deflection. Two more ideas complete the set. **Clearance**: you sacrifice a piece only to empty the square or line it stands on. **Interference**: you drop a piece on a line between two enemy pieces so one no longer protects the other.'),
    ask('3q2k1/5pp1/8/6N1/8/8/8/2K4R w - - 0 1', 'Your own knight stands on the square where your queen would give mate. What is the idea called when you fling the knight away with a check?', ['Clearance', 'Interference', 'Prophylaxis'], 0, 'Clearance. The piece that moves away must do it with tempo — a check or a big threat — so the opponent has no time to react.'),
    ask('3q2k1/5pp1/8/6N1/8/8/8/2K4R w - - 0 1', 'A black rook defends a black queen along a rank. You put a protected piece between them. What have you done?', ['Interference: the queen is now undefended', 'A fork', 'A pin'], 0, 'Interference cuts a line of defence. Look for it when a key piece is defended from far away along one line.'),
    ask('3q2k1/5pp1/8/6N1/8/8/8/2K4R w - - 0 1', 'How do you find such ideas at the board?', ['Notice the "if only": if only that square were free, if only that line were cut', 'Sacrifice at random', 'Wait for a hint'], 0, 'Wishful thinking, then forcing moves to make the wish true. Practise the themes in Puzzles → Custom: Clearance, Interference, Attraction.'),
  ]),
  lesson('s7-quiet', 'Quiet moves', 'coffee', 'The strongest move is not always a check.', [
    say(pos('Bxh7+ Kxh7 Ng5+ Kg8', 'rnbq1rk1/pppn1ppp/4p3/3pP3/1b1P4/2NB1N2/PPP2PPP/R1BQK2R w KQ - 0 1'), 'In the Greek gift, after the bishop sacrifice and the knight check, the winning move was Qh5 — not a check, not a capture. A **quiet move** in the middle of a combination: it simply creates a threat that cannot be met.', { arrows: ['d1h5'] }),
    ask(pos(ITALIAN), 'Why are quiet moves hard to find?', ['We stop calculating when the checks run out', 'They are illegal', 'They are always bad'], 0, 'At the end of a forcing line, ask one more question: "Is there a calm move that threatens something he cannot stop?"'),
    ask(pos(ITALIAN), 'A typical quiet killer move is one that…', ['brings the last piece into the attack or takes away the king’s escape square', 'trades queens', 'wins a pawn far away'], 0, '"Invite everyone to the party." Before the final blow, check whether one more piece can join — the attack then works with certainty.'),
  ]),
  lesson('s7-convert', 'Converting a winning position', 'trophy', 'Ahead in material? Here is the technique.', [
    say('r5k1/pp3ppp/8/8/8/8/PP3PPP/R2R2K1 w - - 0 1', 'Winning a piece is not winning the game. Between the two lies **technique** — and it is mostly discipline.'),
    ask('r5k1/pp3ppp/8/8/8/8/PP3PPP/R2R2K1 w - - 0 1', 'First priority when you are clearly ahead?', ['Safety: remove his counterplay and secure my king', 'Win more material quickly', 'Attack'], 0, 'The only way to lose a won game is to allow counterplay. Kill it first — even at the cost of a little time.'),
    ask('r5k1/pp3ppp/8/8/8/8/PP3PPP/R2R2K1 w - - 0 1', 'Second?', ['Trade pieces (not pawns) and head for a simple endgame', 'Keep everything on the board', 'Sacrifice'], 0, 'Each piece trade increases the value of your extra material. Offer exchanges, and accept slightly "ugly" ones if they simplify.'),
    ask('r5k1/pp3ppp/8/8/8/8/PP3PPP/R2R2K1 w - - 0 1', 'Third?', ['Give material back if it leads to a trivially won ending', 'Never give anything back', 'Stall'], 0, 'Returning a pawn or the exchange to reach a clearly winning ending is the mark of a strong player. Simple is better than brilliant.'),
  ]),
  lesson('s7-defend', 'Defending bad positions', 'shield', 'How to make winning hard for them.', [
    say('7k/5Q2/6K1/8/8/8/8/1r6 b - - 0 1', 'Half of chess is played from worse positions. Good defenders collect many half and full points that others throw away by collapsing. Black looks lost here — but look at his king: it has no legal move.', { flip: true }),
    ask('7k/5Q2/6K1/8/8/8/8/1r6 b - - 0 1', 'Black’s king cannot move. What does that suggest?', ['Give the rook away with check: if it is taken, it is stalemate', 'Resign', 'Move the rook to safety'], 0, 'A "desperado" rook: …Rg1+ and it keeps checking. Whenever White captures it, Black has no legal move — draw. When your king is boxed in, look for stalemate.', { flip: true }),
    ask('7k/5Q2/6K1/8/8/8/8/1r6 b - - 0 1', 'What are the defender’s main weapons?', ['Activity, counter-threats, trades of attackers, and traps', 'Passive waiting', 'Offering a draw every move'], 0, 'Passive defence loses slowly. Look for the most active set-up, trade their best attacker, and set problems: every move should give them a chance to go wrong.', { flip: true }),
    ask('7k/5Q2/6K1/8/8/8/8/1r6 b - - 0 1', 'When should you resign?', ['When there is truly no counterplay and the opponent clearly knows the technique', 'After losing a pawn', 'Never under any circumstances'], 0, 'Below 1800, opponents blunder back often. Fight on while there are tricks left; resign when it is only a matter of technique you would be sure to manage yourself.', { flip: true }),
  ]),
  lesson('s7-study', 'How to keep improving', 'cap', 'A weekly plan from here to 1800.', [
    say(pos('e4'), 'Reaching 1800 is less about knowing more and more about **doing the basics every game**. Here is how to turn this course into a routine.'),
    ask(pos('e4'), 'What gives the most rating per hour up to about 1500?', ['Tactics puzzles and the blunder check', 'Opening theory', 'Rare endgames'], 0, 'Tactics decide most games. A daily dose of puzzles — accuracy before speed — is the base of everything.'),
    ask(pos('e4'), 'What should you do after every serious game?', ['Review it: find the moment the evaluation changed and why', 'Start the next one', 'Delete it'], 0, 'Your own mistakes are the best lessons. Use Game Review, read the cause of each mistake, and follow the link to the matching lesson.'),
    ask(pos('e4'), 'A good weekly mix?', ['Daily puzzles, a few longer games with review, one lesson or model game, some endgame drills', 'Only blitz', 'Only reading'], 0, 'Play, review, study, repeat. The Daily training brings lessons back just before you would forget them.'),
  ]),
];
