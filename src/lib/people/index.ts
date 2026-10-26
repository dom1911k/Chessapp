// The coach and the opponents: portraits, personalities and chat lines.

export type Mood = 'neutral' | 'happy' | 'worried';
export type PlayStyle = 'balanced' | 'aggressive' | 'solid' | 'wild';

export type ChatEvent =
  | 'greet'
  /** Greeting when you won the last game against them. */
  | 'greetRevenge'
  /** Greeting when they won the last game. */
  | 'greetRematch'
  /** Your move gives check. */
  | 'userCheck'
  /** You take one of their pieces ({piece}). */
  | 'userCapture'
  /** Your move attacks one of their pieces ({piece}). */
  | 'userThreat'
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
    bio: 'Lily is eight and LOVES moving her queen everywhere. She forgets her pieces can be taken sometimes — just like all of us did once!',
    lines: {
      greet: ["Hi! I'm Lily! I know how the horsey moves now 🐴", "Yay, a game! I'm gonna use my queen a LOT."],
      greetRevenge: ["You beat me last time! This time I'm gonna win. I practised! 😤", "Rematch! I've been practising my horsey moves!"],
      greetRematch: ["I won last time! Wanna play again? 😄", "Yay, you're back! I'm still the winner though!"],
      userCheck: ["Eek! My king!", "Hey! Leave my king alone!"],
      userCapture: ["Nooo, my {piece}! 😢", "Hey! That was my favourite {piece}!"],
      userThreat: ["Wait, are you attacking my {piece}?", "Uh oh… my {piece} is scared."],
      userGoodMove: ['Whoa! How did you see that?', 'Hey, that was sneaky!'],
      userBlunder: ['Wait… can I take that? Really?? Yay!', 'Ooh, free piece! Thank youuu 😄'],
      botCapture: ['Gotcha!', 'Mine now! 😁', 'Chomp!'],
      botCheck: ['Check! I think? Yes! Check!', 'Check check check!'],
      botWinning: ['Am I… winning?? 😮', "I'm doing so good!"],
      botLosing: ['Uh oh… my pieces keep disappearing.', "This is hard! You're really good."],
      takeback: ['Sure, take it back! I do that all the time.', 'Okay, do-over!'],
      botWins: ['I WON! Can we play again? 🎉', "Yesss! I'm telling my mom!"],
      botLoses: ["Aww. You're really good! Good game!", 'You win! Can you teach me that trick?'],
      draw: ["A draw! That means we BOTH win, right?"],
      userResigned: ["You're giving up? Okay! Good game!"],
      summaryGood: ['You played super well! I want to be as good as you.'],
      summaryMistake: ['I think {move} was an oopsie. But I make oopsies too! 😄'],
    },
  },
  {
    id: 'tom',
    name: 'Grandpa Tom',
    elo: 600,
    style: 'solid',
    tagline: 'Retired, plays at the park',
    bio: 'Tom plays with his grandkids and at the park on sunny days. Patient, kind, and always ready with a little story.',
    lines: {
      greet: ["Ah, hello there! Let's have a nice, friendly game.", 'Pull up a chair, kiddo. No rush.'],
      greetRevenge: ["Ah, you again! You got me last time — not today, kiddo.", "Back for more? I've been practising at the park."],
      greetRematch: ["Back for another go? Good — that's the spirit!", "You'll get me this time, I can feel it."],
      userCheck: ["Oh! Check, is it? Let me see…", "My, my — check. You're keeping me on my toes."],
      userCapture: ["Ah, there goes my {piece}. Well taken.", "Oh dear, my {piece}! I didn't see that one."],
      userThreat: ["Hmm, you're after my {piece}, aren't you?", "My {piece} is in trouble. Let me think…"],
      userGoodMove: ['Oh, very nice! My grandson does that too.', 'Well, look at you! I didn\'t see that one coming.'],
      userBlunder: ['Hmm, you sure about that one? Well… I\'ll take it, thank you.', 'Oh dear. I left a piece like that once — lost the whole game.'],
      botCapture: ["Don't mind if I do.", "I'll just pop that in my pocket."],
      botCheck: ['Check, my friend.', 'Mind your king now — check!'],
      botWinning: ['Not bad for an old man, eh?', 'Careful, kiddo, I\'m warming up.'],
      botLosing: ["You're teaching me a lesson today!", 'Oh dear, oh dear…'],
      takeback: ['Go ahead, take it back. We all slip sometimes.', 'Of course! No rush at the park.'],
      botWins: ["Good game! You'll get me next time, I'm sure of it.", 'Thank you kindly — that was fun.'],
      botLoses: ['Well played! You earned that one.', 'Beaten fair and square. Bravo, kiddo!'],
      draw: ['A draw — nobody loses! Lovely game.'],
      userResigned: ['Thanks for the game. Come back anytime!'],
      summaryGood: ['A nice, careful game from you. I enjoyed that.'],
      summaryMistake: ['If I may — {move}, that\'s where it slipped. Happens to the best of us.'],
    },
  },
  {
    id: 'maya',
    name: 'Maya',
    elo: 800,
    style: 'balanced',
    tagline: 'Plays between lectures',
    bio: 'Maya is a student who plays quick games on her phone between classes. Relaxed, funny, and a little chaotic.',
    lines: {
      greet: ['Hey! One quick game before my next class?', "Okay let's go. No pressure 😎"],
      greetRevenge: ["You again! Okay, revenge time. I had coffee this time ☕", "Last time was a fluke. Probably."],
      greetRematch: ["Back for more? Respect.", "Oh hey! Ready for round two?"],
      userCheck: ["Check?! Rude.", "Okay okay, check. I see you."],
      userCapture: ["My {piece}! Noooo.", "Wow, okay, bye {piece} 👋"],
      userThreat: ["Wait, my {piece}… hold on.", "You're coming for my {piece}? Bold."],
      userGoodMove: ['Okay wait, that was actually smart.', 'Rude. But clever.'],
      userBlunder: ['Free piece?? Don\'t mind if I do 🍕', 'Ha! Thanks, I\'ll take that!'],
      botCapture: ['Snack time.', 'Yoink!'],
      botCheck: ['Check! Your turn, buddy.', 'Check 👀'],
      botWinning: ["Is this going well for me? Nobody jinx it.", 'I could get used to this.'],
      botLosing: ["Okay, I'm officially stressed.", 'This is fine. Everything is fine. 🔥'],
      takeback: ["Take it back, I won't tell anyone.", 'Undo? Sure, go for it.'],
      botWins: ['GG! That was fun!', 'Yesss. Rematch after class?'],
      botLoses: ['GG, you got me. Respect.', 'Okay you win. I blame the coffee ☕'],
      draw: ["A draw! Honestly, I'll take it."],
      userResigned: ['GG! Good luck next time!'],
      summaryGood: ["Honestly? That was a clean game. I'm impressed."],
      summaryMistake: ['Not gonna lie, {move} is where it went wrong. Happens!'],
    },
  },
  {
    id: 'jonas',
    name: 'Jonas',
    elo: 1000,
    style: 'aggressive',
    tagline: 'Café champion (says Jonas)',
    bio: 'Jonas plays at the café every Sunday and loves to brag about his attacks before they happen. Loud, cheerful, a bit too sure of himself.',
    lines: {
      greet: ['Ready to lose? Just kidding. Mostly.', 'Café rules: we play fast and we ATTACK!'],
      greetRevenge: ["You beat me last time. That was a warm-up. Today's the real game!", "Rematch! The café champion never loses twice."],
      greetRematch: ["Back for another lesson from the champ?", "Couldn't stay away, huh? I get it."],
      userCheck: ["Check? Pfff. I meant to let that happen.", "Okay, check. No big deal. Totally fine."],
      userCapture: ["Hey! My {piece}! That was… part of the plan.", "My {piece}?! Lucky shot."],
      userThreat: ["You think you can scare my {piece}? …Okay, maybe a little.", "Attacking my {piece}? Cute."],
      userGoodMove: ['Hey, not bad! I was just about to do that.', 'Okay, okay, I see you.'],
      userBlunder: ['Ha! Saw that coming from a mile away.', 'Thank you very much!'],
      botCapture: ['Boom!', "That's mine now."],
      botCheck: ['Check! Here comes the attack!', 'Check! Feeling the heat?'],
      botWinning: ['Told you. Café champion.', 'All going according to plan!'],
      botLosing: ['That was… on purpose. Probably.', "Okay, my attack didn't quite work."],
      takeback: ['A take-back? Fine, but that costs you a coffee.', 'Go on then, try again.'],
      botWins: ['And the café champion wins AGAIN!', 'GG! Bring your best game next time.'],
      botLoses: ['What?! Okay, rematch. Right now.', 'Fine, you got me. THIS time.'],
      draw: ["A draw? I'm calling that a win for me."],
      userResigned: ['Smart choice! GG.'],
      summaryGood: ["Fine, that was a strong game. Don't let it go to your head."],
      summaryMistake: ['Tip from the champ: {move} — yeah, that was not it.'],
    },
  },
  {
    id: 'priya',
    name: 'Priya',
    elo: 1200,
    style: 'solid',
    tagline: 'Club player, loves puzzles',
    bio: 'Priya plays at the local club and loves puzzles and patterns. Careful and friendly — she always counts twice before she takes anything.',
    lines: {
      greet: ["Hi! Let's play a careful game. Good luck!", "Hello! I've been doing puzzles all morning — let's see if it helps."],
      greetRevenge: ["You won last time! I looked at the game afterwards — I know what I did wrong.", "Hello again! I've been doing extra puzzles since last time."],
      greetRematch: ["Hi again! Let's see if you spotted your mistake from last time.", "Welcome back! Ready for another careful game?"],
      userCheck: ["Check — good move. Let me count my options…", "Hmm, check. I didn't expect that."],
      userCapture: ["Oh — I miscounted. There goes my {piece}.", "Nice, you won my {piece}. I should've checked twice."],
      userThreat: ["My {piece} is attacked… let me think.", "Hmm, you're after my {piece}. Clever."],
      userGoodMove: ['Ooh, nice! That was the move I was scared of.', 'Clever! I like that.'],
      userBlunder: ['Hmm, I think that piece isn\'t protected… I counted twice!', "Oh! That one's free, I think. Sorry!"],
      botCapture: ['I counted — that one was safe to take.', 'Thank you!'],
      botCheck: ['Check.', 'Check — your king looks a little lonely.'],
      botWinning: ["I think I'm ahead now. Careful!", 'Things are looking good on my side.'],
      botLosing: ["You're playing really well!", 'Hmm, I need to find something here…'],
      takeback: ["Of course! Learning is the whole point.", 'Sure — take another look.'],
      botWins: ['Good game! Want to see where it turned? The report is great.', 'Thanks for the game! You were close.'],
      botLoses: ['Well played — you deserved that.', 'Very nice. You outplayed me!'],
      draw: ['A draw — fair result, I think. Good game!'],
      userResigned: ['Thanks for the game! Knowing when to stop is a skill too.'],
      summaryGood: ['Barely any slip-ups — that was a really good game.'],
      summaryMistake: ['If you look back at {move} — that was the big moment.'],
    },
  },
  {
    id: 'marcus',
    name: 'Marcus',
    elo: 1400,
    style: 'aggressive',
    tagline: 'All attack, all the time',
    bio: 'Marcus streams fast games online and never says no to a wild attack. He trash-talks a little, but always with a smile.',
    lines: {
      greet: ["Let's gooo! Hope your king likes fresh air.", "Buckle up, chat. We're attacking today."],
      greetRevenge: ["Chat, they beat me last time. Today we get REVENGE.", "You again! I've been waiting for this rematch 🏹"],
      greetRematch: ["They're back, chat! Let's give them another show.", "Round two! Hope your king's ready."],
      userCheck: ["Whoa, check?! Okay chat, we're fine. We're FINE.", "Check on ME? Bold move."],
      userCapture: ["Chat, they took my {piece}. Not cool.", "My {piece}! Okay, that hurt."],
      userThreat: ["They're going after my {piece}, chat!", "Hmm, my {piece} is in danger. Spicy."],
      userGoodMove: ["Ooh, that's a good one, I'll admit it.", 'Okay chat, they found it.'],
      userBlunder: ['No way! Did that just happen?', 'Clip it! Free piece!'],
      botCapture: ['Taking that!', 'Easy.'],
      botCheck: ['CHECK! Run, king, run!', 'Check! The attack is ON.'],
      botWinning: ['Your king looks real nervous right now.', 'This is MY kind of game!'],
      botLosing: ['Okay, maybe that attack was a little too spicy.', 'Respect. You defended well.'],
      takeback: ['A take-back? Bold. Fine, go.', 'Rewind! Okay, okay.'],
      botWins: ['GG! That attack was beautiful, admit it.', 'Another king hunt complete 🏹'],
      botLoses: ['GG — you earned that. Rematch?', 'Wow. You stopped my attack. Big respect.'],
      draw: ['A draw?! I wanted a win. Good game though.'],
      userResigned: ['GG! Come back stronger!'],
      summaryGood: ['Clean game, chat. No big mistakes. Respect.'],
      summaryMistake: ['Chat, did you see {move}? That\'s where I smelled blood. 🏹'],
    },
  },
  {
    id: 'sofia',
    name: 'Sofia',
    elo: 1600,
    style: 'balanced',
    tagline: 'Tournament player',
    bio: "Sofia plays weekend tournaments and doesn't talk much at the board. Cool, focused and quietly competitive.",
    lines: {
      greet: ['Good luck.', "Let's play."],
      greetRevenge: ["You won last time. Not again.", "Rematch. Good."],
      greetRematch: ["Again? Good.", "Let's play."],
      userCheck: ["Hm. Check.", "Noted."],
      userCapture: ["My {piece}. Hm.", "Careless of me."],
      userThreat: ["I see it.", "Hm."],
      userGoodMove: ['Good move.', 'Hm. Nice.'],
      userBlunder: ['Thanks.', 'That was a mistake.'],
      botCapture: ['…', 'Taken.'],
      botCheck: ['Check.'],
      botWinning: ["I'm winning.", 'This should be enough.'],
      botLosing: ['Hm.', 'Not my day.'],
      takeback: ['Go ahead.'],
      botWins: ['Good game.', 'GG. Look at the report.'],
      botLoses: ['Well played.', 'GG. You deserved it.'],
      draw: ['Draw. Fair.'],
      userResigned: ['Good game.'],
      summaryGood: ['Solid game.'],
      summaryMistake: ['{move}. That was the mistake.'],
    },
  },
  {
    id: 'viktor',
    name: 'Viktor',
    elo: 1800,
    style: 'solid',
    tagline: 'Strict old chess teacher',
    bio: 'Viktor taught chess at a strict club for forty years. Gruff and demanding, but he respects anyone who tries hard.',
    lines: {
      greet: ['Good day. Sit up straight. We begin.', 'Knights out. Bishops out. Castle. Then we talk.'],
      greetRevenge: ["You beat me last time. I have not forgotten. Begin.", "Last time you were lucky. Today we find out if it was skill."],
      greetRematch: ["You return. Good — persistence is how players grow.", "Again? Did you study your mistakes?"],
      userCheck: ["Check. Hm. Not bad.", "A check. I will deal with it."],
      userCapture: ["My {piece}. A fair capture.", "Hm. I left my {piece} unguarded. Unacceptable."],
      userThreat: ["You attack my {piece}. I see it.", "My {piece} is under fire. Correct play from you."],
      userGoodMove: ['Correct.', 'Good. My students rarely find that.'],
      userBlunder: ['In my club, that move would cost you a week of homework.', 'Careless. I will take it.'],
      botCapture: ['As expected.', 'A pawn is a pawn.'],
      botCheck: ['Check.', 'Your king, please.'],
      botWinning: ['You see? Slowly, slowly.', 'Now I just finish the job.'],
      botLosing: ['Hm. You have practised.', 'I was too sure of myself.'],
      takeback: ['A take-back. In my day… very well.', 'Once more, then. Think first this time.'],
      botWins: ['A good effort. Now practise your endgames.', 'Thank you for the game. Look at your mistakes — that is how you grow.'],
      botLoses: ['Well played. Truly.', 'You have earned my respect.'],
      draw: ['A draw. Fair.'],
      userResigned: ['A wise choice. Thank you for the game.'],
      summaryGood: ['A careful game. Good. Very good, even.'],
      summaryMistake: ['Remember {move}. That is where the game was lost.'],
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
      greet: ["Welcome. Let's enjoy the game together.", 'Take your time. Every move is a chance to learn.'],
      greetRevenge: ["Welcome back. You played beautifully last time — show me again.", "I enjoyed our last game. Let's play another."],
      greetRematch: ["Welcome back. Every game teaches something new.", "Good to see you again. Take your time."],
      userCheck: ["A good check.", "Check. Well played."],
      userCapture: ["You won my {piece}. Well seen.", "My {piece}… nicely done."],
      userThreat: ["You are pressing my {piece}. Good.", "I see the threat to my {piece}."],
      userGoodMove: ['Beautiful. You found the best move.', 'Very well seen.'],
      userBlunder: ['Breathe. Look at the whole board before you move.', 'A small slip — it happens to everyone.'],
      botCapture: ['Thank you.', "I'll take this one."],
      botCheck: ['Check.', 'Check — look carefully.'],
      botWinning: ["I'm ahead now, but keep fighting.", "Don't give up — chess is full of surprises."],
      botLosing: ['You are playing wonderfully.', 'Impressive. I have to think hard now.'],
      takeback: ['Of course. Learning matters more than winning.', 'Try again.'],
      botWins: ["Thank you for the game. You're getting better.", 'Good game. Every loss teaches something.'],
      botLoses: ['Congratulations. You have truly grown.', 'A wonderful game. I am happy I played it.'],
      draw: ['A draw against the champion is a fine result.'],
      userResigned: ['Thank you. Rest, and come back stronger.'],
      summaryGood: ['You played with a calm, clear mind today. Well done.'],
      summaryMistake: ['Later, look again at {move} — there is a lesson waiting there.'],
    },
  },
];

export const opponentById = (id: string | undefined) => OPPONENTS.find((o) => o.id === id);

/** Closest opponent for a custom strength. */
export function nearestOpponent(elo: number): Opponent {
  return OPPONENTS.reduce((a, b) => (Math.abs(b.elo - elo) < Math.abs(a.elo - elo) ? b : a));
}

export function pickLine(o: Opponent, e: ChatEvent, seed = Math.random(), vars: Record<string, string> = {}): string {
  const l = o.lines[e];
  return l[Math.floor(seed * l.length) % l.length].replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);
}
