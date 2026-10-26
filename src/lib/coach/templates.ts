// Friendly, varied phrasing. Each key has several variants; one is picked
// deterministically from a seed so the same position always reads the same.
// Placeholders: {name} → vars.name.

export const TEMPLATES = {
  // ---- What goes wrong ----
  allowsMate: [
    'Uh-oh — this lets them checkmate you: {line}.',
    'Careful! Now they have a checkmate: {line}.',
    'This walks right into a checkmate: {line}.',
  ],
  allowsBackRankMate: [
    'Watch out! Now they can {oppMove}. Your king is stuck behind its own pawns.',
    'Your king has no way out — they can {oppMove}.',
  ],
  allowsBackRankMateLine: [
    'This lets them checkmate you on your back row: {line}. Your king is stuck behind its own pawns.',
    'Watch your back row! After this, {line}. Your king has nowhere to run.',
  ],
  hangsMovedFree: [
    'Oops — nobody protects your {piece} on {sq}, so they can just take it.',
    'Your {piece} on {sq} is all alone. They can grab it for free.',
    'Your {piece} on {sq} can be taken for free.',
  ],
  hangsMovedDefended: [
    'Their {attacker} can take your {piece} on {sq}. You can take back, but your {piece} is worth more, so you still lose out.',
    'A {attacker} can grab your {piece} on {sq}, and taking back doesn\'t make up for it.',
  ],
  ignoredThreat: [
    'Your {piece} on {sq} was already in danger, and it still is. Always check what your opponent is up to first!',
    'Before you move, ask "what do they want?" Your {piece} on {sq} was attacked and still is.',
  ],
  removedDefender: [
    'Your {moved} was guarding your {piece} on {sq}. Now that it moved away, they can {oppMove}.',
    'Moving your {moved} left your {piece} on {sq} without a bodyguard.',
  ],
  leavesHanging: [
    'This leaves your {piece} on {sq} unprotected, so they can {oppMove}.',
    'After this, your {piece} on {sq} is an easy target.',
  ],
  allowsFork: [
    'Now they can {oppMove}. Their {attacker} would attack your {t1} and your {t2} at the same time — a fork! You can only save one.',
    'Careful: they can {oppMove}, and their {attacker} hits your {t1} and {t2} at once.',
  ],
  allowsPin: [
    'Now they can {oppMove}. Your {pinned} gets stuck — if it moves, your {behind} behind it is in trouble.',
    'This lets them {oppMove} and pin your {pinned} in front of your {behind}.',
  ],
  allowsSkewer: [
    'Now they can {oppMove}. Your {front} has to run away, and then they get your {behind} behind it.',
  ],
  allowsDiscovered: [
    'Now they can {oppMove}. That opens up a sneaky attack from their {slider} on your {target}.',
  ],
  badTrade: [
    'You took a {captured} with your {piece}, but they can take back. Your {piece} is worth more, so that swap costs you.',
    'Grabbing the {captured} looks nice, but your {piece} gets taken back — and it\'s worth more.',
  ],
  weakensKing: [
    'This opens up the pawns around your king. Now they can {oppMove} and start an attack.',
    'Your king gets a bit chilly after this — they can {oppMove}.',
  ],
  losesMaterial: [
    'Here\'s the problem: {line}. That costs you {victim}.',
    'After this, {line} — and you lose {victim}.',
  ],
  strongReply: [
    'This gives them a strong answer: they can {oppMove}.',
    'Now they can {oppMove}, and that\'s good for them.',
  ],

  allowsTrap: [
    'Now they can {oppMove}, and your {piece} on {sq} gets trapped — it has nowhere safe to go.',
    'Careful: your {piece} on {sq} can get trapped if they {oppMove}.',
  ],

  // ---- The better idea ----
  missedMate: [
    'You had a checkmate here: {line}!',
    'There was a checkmate! {line}.',
  ],
  missedMate1: ['You could have won right away by {move}!', 'Checkmate was right there — you could {doMove}!'],
  missedBackRank: ['You could {doMove}! Their king was stuck behind its own pawns.'],
  missedFree: [
    'Their {piece} on {sq} was free — you could just take it.',
    'Nobody was protecting their {piece} on {sq}. Free snack!',
  ],
  missedWinningCapture: [
    'You could have won their {piece} on {sq} by {move}. It wasn\'t protected well enough.',
    'Their {piece} on {sq} was up for grabs — try {move}.',
  ],
  missedFork: [
    'You could {doMove}. That attacks their {t1} and {t2} at the same time — a fork!',
    'Look for double attacks: {move} would hit their {t1} and {t2} together.',
  ],
  missedPin: ['You could {doMove} to pin their {pinned} — it can\'t move without exposing the {behind}.'],
  missedSkewer: ['You could {doMove}: their {front} has to step aside, and then you win the {behind}.'],
  missedDiscovered: ['You could {doMove}. That opens a hidden attack from your {slider} on their {target}.'],
  missedTrap: [
    'You could {doMove} and trap their {piece} on {sq} — it would have nowhere to go.',
  ],
  missedDefender: [
    'You could {doMove}. That {captured} was the only guard of their {guarded}!',
  ],
  missedOverload: [
    'Their {piece} on {sq} has two jobs: guarding the {a} and the {b}. You could {doMove} and it can\'t do both.',
  ],
  missedPromotion: [
    'Push that pawn! If you {doMove}, nothing can stop it from becoming a queen.',
  ],
  savePiece: [
    'Your {piece} on {sq} needed help. You could {doMove} to keep it safe.',
    '{move} would have kept your {piece} on {sq} safe.',
  ],
  fallbackMaterial: [
    '{move} was better: {line}, and you come out ahead.',
    'A better idea was {move}. Then {line}, and you win something.',
  ],
  fallbackShort: ['{move} was a better choice.', 'A better idea was {move}.', '{move} would have been safer.'],
  fallbackKeep: [
    '{move} was a better idea — it keeps your position {state}.',
    'Try {move} next time — it keeps things {state}.',
  ],

  // ---- Opening principles ----
  samePieceTwice: [
    'At the start, try not to move the same piece twice — bring out a new piece instead.',
    'Every early move counts. Moving your {piece} again leaves your other pieces sitting at home.',
  ],
  earlyQueen: [
    'Bringing your queen out this early lets them chase her around while they bring out their pieces.',
    'Your queen is strong, but out this early she becomes a target. Knights and bishops first!',
  ],
  noCastle: [
    'Your king is still in the middle. Castling soon tucks it away safely.',
    'Think about castling — a king in the middle can get into trouble fast.',
  ],
  flankPawn: [
    'Pawn moves on the edge don\'t help much at the start. Pawns in the middle (like e4 or d4) give your pieces room.',
    'Early on, fight for the middle of the board — edge pawns do very little there.',
  ],
  knightRim: [
    'Knights don\'t like the edge — from {sq} it can only reach a few squares.',
    'Knights are happiest near the middle; on {sq} it can\'t do much.',
  ],
  kingWalk: [
    'Moving your king now means you can\'t castle anymore.',
    'Try to keep your king at home until you can castle.',
  ],

  // ---- Praise ----
  praiseMate: ['Checkmate! Beautifully done.', 'That\'s checkmate — well played!'],
  praiseFree: ['Nice — a free {piece}!', 'Good eye! That {piece} wasn\'t protected.'],
  praiseWin: ['Good capture — you won something there.', 'Well spotted, that wins you some points.'],
  praiseFork: ['Great fork! Your {attacker} attacks two pieces at once.', 'A fork — nicely done!'],
  praisePin: ['Nice pin on their {pinned}.'],
  praiseSkewer: ['A skewer — excellent!'],
  praiseDiscovered: ['A sneaky hidden attack — well played!'],
  praiseCastle: ['Castled! Your king is safe and your rook joins in.', 'Good, you castled. King safety first!'],
  praiseEscape: ['Good — you got your {piece} out of danger.', 'You spotted the threat to your {piece}. Well done!'],
  praiseDefend: ['Good — you protected your {piece} on {sq}.'],
  praiseTradeAhead: [
    'Good trade — when you\'re ahead, swapping pieces makes your lead count even more.',
  ],
  praiseBest: ['That\'s the best move!', 'Perfect — exactly right.', 'Spot on!'],
  praiseGood: ['Good move.', 'Nice, that works.', 'Solid choice.'],

  // ---- Take-backs ----
  takebackGood: [
    'Good call taking that back. {reason}',
    'Smart take-back! {reason}',
  ],
  takebackFine: [
    'That move was actually fine — but trying something else is OK too!',
    'No harm in taking it back, though your move was alright.',
  ],
} as const;

export type TemplateKey = keyof typeof TEMPLATES;

export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function t(key: TemplateKey, vars: Record<string, string | number> = {}, seed = ''): string {
  const variants = TEMPLATES[key];
  const text = variants[hash(seed + key) % variants.length];
  return capitalize(text.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? '')));
}

export function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
