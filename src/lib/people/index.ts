// The coach and the opponents: portraits, personalities and chat lines.

export type Mood = 'neutral' | 'happy' | 'worried';
export type PlayStyle = 'balanced' | 'aggressive' | 'solid' | 'wild';

export type ChatEvent =
  | 'greet'
  | 'userGoodMove'
  | 'userBlunder'
  | 'botCapture'
  | 'botCheck'
  | 'botWinning'
  | 'botLosing'
  | 'takeback'
  | 'botWins'
  | 'botLoses'
  | 'draw'
  | 'userResigned'
  /** After the game: no real mistakes. */
  | 'summaryGood'
  /** After the game: {move} is your biggest mistake. */
  | 'summaryMistake';

export interface Opponent {
  id: string;
  name: string;
  elo: number;
  style: PlayStyle;
  /** One line under the name. */
  tagline: string;
  bio: string;
  lines: Record<ChatEvent, string[]>;
}

export const COACH = { id: 'coach', name: 'Coach Sam' };

const urls = import.meta.glob('../../assets/people/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export function portrait(id: string, mood: Mood = 'neutral'): string {
  return urls[`../../assets/people/${id}-${mood}.svg`] ?? urls[`../../assets/people/${id}-neutral.svg`] ?? '';
}

export const OPPONENTS: Opponent[] = [
  {
    id: 'lily',
    name: 'Lily',
    elo: 400,
    style: 'wild',
    tagline: 'Learned the rules last month',
    bio: 'Lily loves moving her queen around the whole board. She sometimes forgets her pieces can be taken — just like all of us did once!',
    lines: {
      greet: ["Hi! I'm Lily! I just learned how the horsey moves 🐴", 'Yay, a game! Let\'s play!'],
      userGoodMove: ['Whoa, how did you see that?', 'Ooh, sneaky!'],
      userBlunder: ['Wait, can I take that? Really? Yay!', 'Oh! Thank you! 😄'],
      botCapture: ['Gotcha!', 'Mine now! 😁'],
      botCheck: ['Check! I think? Yes, check!', 'Check check check!'],
      botWinning: ['Am I… winning?? 😮', 'This is going really well!'],
      botLosing: ['Uh oh… my pieces keep disappearing.', 'Hmm, this is hard!'],
      takeback: ['Sure, take it back! I do that all the time.', 'Okay, do-over!'],
      botWins: ['I WON! Can we play again? 🎉', 'Yesss! Good game!'],
      botLoses: ['Aww. You\'re really good! Good game!', 'You win! Teach me that trick sometime?'],
      draw: ['A draw! That\'s like both winning, right?'],
      userResigned: ['Oh, you\'re giving up? Okay! Good game!'],
      summaryGood: ["You played really well! I want to be as good as you."],
      summaryMistake: ["I think {move} was a bit oopsie. But I make oopsies too! 😄"],
    },
  },
  {
    id: 'tom',
    name: 'Grandpa Tom',
    elo: 600,
    style: 'solid',
    tagline: 'Retired, plays at the park',
    bio: 'Tom played a little chess with his grandchildren and caught the bug again. Patient, kind, and fond of a good story.',
    lines: {
      greet: ['Ah, a new opponent. Let\'s have a nice, friendly game.', 'Pull up a chair! Shall we begin?'],
      userGoodMove: ['Oh, very nicely played.', 'My, my — you saw that quicker than I did.'],
      userBlunder: ['Hm, are you sure about that one? Well, I\'ll take it.', 'That reminds me of my first games. I\'ll be taking that piece.'],
      botCapture: ['Don\'t mind if I do.', 'I\'ll just pop that in my pocket.'],
      botCheck: ['Check, my friend.', 'Mind your king — check.'],
      botWinning: ['Things are looking rather good for an old man.', 'Careful now, I\'m warming up.'],
      botLosing: ['You\'re giving me a proper lesson today.', 'Oh dear, oh dear.'],
      takeback: ['Of course, take your time. No rush at the park.', 'Go ahead, we all slip sometimes.'],
      botWins: ['Good game! You\'ll get me next time, I\'m sure.', 'A fine game. Thank you kindly.'],
      botLoses: ['Well played! You\'ve earned that one.', 'Beaten fair and square. Bravo!'],
      draw: ['A draw — honours even! Lovely game.'],
      userResigned: ['Thank you for the game. Come back anytime.'],
      summaryGood: ["A tidy game from you. I enjoyed that one."],
      summaryMistake: ["If I may — {move} was where it slipped. Happens to the best of us."],
    },
  },
  {
    id: 'maya',
    name: 'Maya',
    elo: 800,
    style: 'balanced',
    tagline: 'Plays between lectures',
    bio: 'Maya is a university student who plays quick games on her phone between classes. Relaxed, funny, and a little chaotic.',
    lines: {
      greet: ['Hey! One quick game before my next lecture?', 'Okay, let\'s do this. No pressure 😎'],
      userGoodMove: ['Okay that was actually smart.', 'Rude. But clever.'],
      userBlunder: ['Wait, free piece?? Don\'t mind if I do 🍕', 'Ha! I\'ll take that, thanks!'],
      botCapture: ['Snack time.', 'Yoink!'],
      botCheck: ['Check! Your move, buddy.', 'Check 👀'],
      botWinning: ['Is this… going well for me? Nobody jinx it.', 'I could get used to this.'],
      botLosing: ['Okay, I\'m officially stressed.', 'This is fine. Everything is fine. 🔥'],
      takeback: ['Take it back, I won\'t tell anyone.', 'Undo button, nice. Go for it.'],
      botWins: ['GG! That was fun!', 'Yesss. Okay, rematch after class?'],
      botLoses: ['GG, you got me. Respect.', 'Okay you win. I blame the coffee.'],
      draw: ['A draw! Honestly I\'ll take it.'],
      userResigned: ['GG! Good luck next time!'],
      summaryGood: ["Honestly? Clean game. I'm impressed."],
      summaryMistake: ["Ngl, {move} is where it went sideways. Happens!"],
    },
  },
  {
    id: 'jonas',
    name: 'Jonas',
    elo: 1000,
    style: 'aggressive',
    tagline: 'Café champion (self-declared)',
    bio: 'Jonas plays at the café every Sunday and likes to announce his attacks before they happen. Loud, cheerful, a bit overconfident.',
    lines: {
      greet: ['Ready to lose? Just kidding. Mostly.', 'Café rules: we play fast and we play to attack!'],
      userGoodMove: ['Hey, not bad! I was about to do that.', 'Okay, okay, I see you.'],
      userBlunder: ['Ha! I saw that coming a mile away.', 'Thank you very much!'],
      botCapture: ['Boom!', 'That\'s mine now.'],
      botCheck: ['Check! Here comes the attack!', 'Check! Feel the pressure?'],
      botWinning: ['Told you. Café champion.', 'This is going exactly according to plan.'],
      botLosing: ['That was… a sacrifice. On purpose. Probably.', 'Okay, the attack didn\'t quite work.'],
      takeback: ['A take-back? Fine, but at the café that costs you a coffee.', 'Go on then, try again.'],
      botWins: ['And the café champion does it again!', 'GG! Next time bring your A-game.'],
      botLoses: ['What?! Okay, rematch. Right now.', 'Fine, you got me. This time.'],
      draw: ['A draw? I\'ll call that a moral victory.'],
      userResigned: ['Smart move! GG.'],
      summaryGood: ["Fine, fine, that was a strong game. Don't let it go to your head."],
      summaryMistake: ["Pro tip from the café: {move} was not it."],
    },
  },
  {
    id: 'priya',
    name: 'Priya',
    elo: 1200,
    style: 'solid',
    tagline: 'Club player, loves to analyse',
    bio: 'Priya is a careful club player and a data scientist. She likes sound positions and will happily explain why your move was inaccurate.',
    lines: {
      greet: ['Hello! Let\'s play a principled game.', 'Good luck — have fun!'],
      userGoodMove: ['Precise. I like it.', 'That\'s the move I was worried about.'],
      userBlunder: ['Hmm. That leaves something undefended, I think.', 'Interesting choice. I\'ll take the material.'],
      botCapture: ['Material is material.', 'Thank you.'],
      botCheck: ['Check.', 'Check — your king looks a bit exposed.'],
      botWinning: ['The position is clearly better for me now.', 'I think I\'m comfortably ahead.'],
      botLosing: ['You\'re playing very accurately.', 'I need to find something here…'],
      takeback: ['Of course. Learning is the point.', 'Sure — think it through again.'],
      botWins: ['Good game! Want to look at where it turned?', 'Thanks for the game. Check the report — it\'s instructive!'],
      botLoses: ['Well deserved. That was a clean game.', 'Very nice. You outplayed me.'],
      draw: ['A fair result, I think. Good game.'],
      userResigned: ['Thank you for the game. Resigning at the right time is a skill too.'],
      summaryGood: ["Very few inaccuracies — that was a well-played game."],
      summaryMistake: ["If you check the report: {move} was the critical moment."],
    },
  },
  {
    id: 'marcus',
    name: 'Marcus',
    elo: 1400,
    style: 'aggressive',
    tagline: 'All attack, all the time',
    bio: 'Marcus streams blitz games and never declines a sacrifice. He trash-talks a little, but always with a smile.',
    lines: {
      greet: ['Let\'s goooo! Hope your king likes fresh air.', 'Buckle up. We\'re attacking today.'],
      userGoodMove: ['Ooh, that\'s a good one, I\'ll admit it.', 'Okay chat, they found it.'],
      userBlunder: ['No way! Did that just happen?', 'Clip it! Free piece!'],
      botCapture: ['Taking that!', 'Easy.'],
      botCheck: ['CHECK! Run, king, run!', 'Check! The attack is ON.'],
      botWinning: ['Your king is looking really nervous right now.', 'This is my kind of position!'],
      botLosing: ['Okay, the attack was maybe a little too spicy.', 'Respect. You defended well.'],
      takeback: ['A take-back? Bold. Fine, go.', 'Rewind! Okay, okay.'],
      botWins: ['GG! That attack was beautiful, admit it.', 'Another king hunt complete 🏹'],
      botLoses: ['GG — you earned that. Rematch?', 'Wow. You beat the attack. Big respect.'],
      draw: ['A draw?! I wanted blood. Good game though.'],
      userResigned: ['GG! Come back stronger!'],
      summaryGood: ["Clean game, chat. No blunders. Respect."],
      summaryMistake: ["Chat, did you see {move}? That's where I smelled blood. 🏹"],
    },
  },
  {
    id: 'sofia',
    name: 'Sofia',
    elo: 1600,
    style: 'balanced',
    tagline: 'Tournament player',
    bio: 'Sofia plays weekend tournaments and doesn\'t talk much at the board. Cool, focused and quietly competitive.',
    lines: {
      greet: ['Good luck.', 'Let\'s play.'],
      userGoodMove: ['Good move.', 'Hm. Nice.'],
      userBlunder: ['Thanks.', 'That was a mistake.'],
      botCapture: ['…', 'Taken.'],
      botCheck: ['Check.'],
      botWinning: ['Winning.', 'This should be enough.'],
      botLosing: ['Hm.', 'Not my day.'],
      takeback: ['Go ahead.'],
      botWins: ['Good game.', 'GG. Analyse it.'],
      botLoses: ['Well played.', 'GG. You deserved it.'],
      draw: ['Draw. Fair.'],
      userResigned: ['Good game.'],
      summaryGood: ["Solid game."],
      summaryMistake: ["{move}. That was the mistake."],
    },
  },
  {
    id: 'viktor',
    name: 'Viktor',
    elo: 1800,
    style: 'solid',
    tagline: 'Old-school master',
    bio: 'Viktor learned chess in a strict club decades ago. Formal and demanding, but he respects a well-fought game.',
    lines: {
      greet: ['Good day. I expect a serious game.', 'Sit up straight. Develop your pieces. Begin.'],
      userGoodMove: ['Correct.', 'A respectable move.'],
      userBlunder: ['In my club, that move would have cost you a week of homework.', 'Careless. I will take it.'],
      botCapture: ['As expected.', 'A pawn is a pawn.'],
      botCheck: ['Check.', 'Your king, please.'],
      botWinning: ['The position speaks for itself.', 'Technique will do the rest.'],
      botLosing: ['Hm. You have prepared.', 'I underestimated you.'],
      takeback: ['A take-back. In my day… very well.', 'Once more, then.'],
      botWins: ['A good effort. Study your endgames.', 'Thank you for the game. Review your mistakes carefully.'],
      botLoses: ['Well played. Truly.', 'You have earned my respect.'],
      draw: ['A draw. A correct result.'],
      userResigned: ['A wise decision. Thank you for the game.'],
      summaryGood: ["A disciplined game. Acceptable. Quite good, even."],
      summaryMistake: ["Study the move {move}. That is where the game was decided."],
    },
  },
  {
    id: 'mei',
    name: 'Mei',
    elo: 2000,
    style: 'balanced',
    tagline: 'The champion',
    bio: 'Mei is the strongest player here — calm, kind and almost impossible to rattle. Beating her is the final goal.',
    lines: {
      greet: ['Welcome. Let\'s enjoy the game together.', 'Take your time. Every move is a chance to learn.'],
      userGoodMove: ['Beautiful. You found the best move.', 'Very well seen.'],
      userBlunder: ['Breathe. Look at the whole board before moving.', 'A small slip — it happens to everyone.'],
      botCapture: ['Thank you.', 'I\'ll take this one.'],
      botCheck: ['Check.', 'Check — look carefully.'],
      botWinning: ['The position favours me now. Keep fighting.', 'Don\'t give up — chess is full of surprises.'],
      botLosing: ['You are playing wonderfully.', 'Impressive. I must think hard now.'],
      takeback: ['Of course. Learning matters more than winning.', 'Try again.'],
      botWins: ['Thank you for the game. You\'re improving.', 'Good game. Every loss is a lesson.'],
      botLoses: ['Congratulations. You have truly grown.', 'Wonderful game. I am proud to have played it.'],
      draw: ['A draw against a strong opponent is a fine result.'],
      userResigned: ['Thank you. Rest, and come back stronger.'],
      summaryGood: ["You played with a clear mind today. Well done."],
      summaryMistake: ["Look again at {move} later — there is a lesson waiting there."],
    },
  },
];

export const opponentById = (id: string | undefined) => OPPONENTS.find((o) => o.id === id);

/** Closest opponent for a custom strength. */
export function nearestOpponent(elo: number): Opponent {
  return OPPONENTS.reduce((a, b) => (Math.abs(b.elo - elo) < Math.abs(a.elo - elo) ? b : a));
}

export function pickLine(o: Opponent, e: ChatEvent, seed = Math.random()): string {
  const l = o.lines[e];
  return l[Math.floor(seed * l.length) % l.length];
}
