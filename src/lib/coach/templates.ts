// Friendly, varied phrasing. Each key has several variants; one is picked
// deterministically from a seed so the same position always reads the same.
// Placeholders: {name} → vars.name.

export const TEMPLATES = {
  // ---- What goes wrong ----
  allowsMate: [
    'This allows checkmate: {line}.',
    'Now they have a forced mate: {line}.',
    'This walks right into a checkmate: {line}.',
  ],
  allowsBackRankMate: [
    'Now they can {oppMove}. Your king is stuck behind its own pawns.',
    'Your king has no way out — they can {oppMove}.',
  ],
  allowsBackRankMateLine: [
    'This lets them checkmate you on your back row: {line}. Your king is stuck behind its own pawns.',
    'Your back rank is weak: after this, {line}. Your king has nowhere to run.',
  ],
  hangsMovedFree: [
    'Nothing defends your {piece} on {sq}, so they can simply take it.',
    'Your {piece} on {sq} is undefended — they win it for free.',
    'Your {piece} on {sq} can be taken for free.',
  ],
  hangsMovedDefended: [
    'Their {attacker} can take your {piece} on {sq}. You can take back, but your {piece} is worth more, so you still lose out.',
    'A {attacker} can grab your {piece} on {sq}, and taking back doesn\'t make up for it.',
  ],
  ignoredThreat: [
    'Your {piece} on {sq} was already attacked, and this does nothing about it. Check their threats first.',
    'Before you move, ask "what do they want?" Your {piece} on {sq} was attacked and still is.',
  ],
  removedDefender: [
    'Your {moved} was guarding your {piece} on {sq}. Now that it moved away, they can {oppMove}.',
    'Moving your {moved} took away the only defender of your {piece} on {sq}.',
  ],
  leavesHanging: [
    'This leaves your {piece} on {sq} unprotected, so they can {oppMove}.',
    'After this, your {piece} on {sq} is an easy target.',
  ],
  allowsFork: [
    'Now they can {oppMove}, forking your {t1} and {t2} — you can only save one.',
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
    'Now they can {oppMove}, uncovering an attack from their {slider} on your {target}.',
  ],
  badTrade: [
    'You took a {captured} with your {piece}, but they can take back. Your {piece} is worth more, so that swap costs you.',
    'Taking the {captured} costs your {piece} — they take back, and it\'s worth more.',
  ],
  weakensKing: [
    'This opens up the pawns around your king. Now they can {oppMove} and start an attack.',
    'This loosens the cover around your king — they can {oppMove}.',
  ],
  losesMaterialLong: [
    "Here's the problem: {line} — and a few moves later that costs you {victim}.",
    'After this, {line}, and the line ends with you losing {victim}.',
  ],
  losesMaterial: [
    'Here\'s the problem: {line}. That costs you {victim}.',
    'After this, {line} — and you lose {victim}.',
  ],
  strongReply: [
    'This gives them a strong answer: they can {oppMove}.',
    'Now they can {oppMove}, and they are better.',
  ],
  strongReplyPawn: [
    'This lets them {oppMove} — after {line} you are a pawn down.',
    'Now they can {oppMove}: {line}, and a pawn is gone.',
  ],
  strongReplyEdge: [
    'You were doing well, but this lets them {oppMove} ({line}) and your advantage is gone.',
    'This throws away your edge: they can {oppMove} ({line}).',
  ],
  strongReplyWorse: [
    'After this they can {oppMove} ({line}), and your position becomes clearly worse.',
    'This lets them {oppMove} ({line}) — from there they are much better.',
  ],

  allowsTrap: [
    'Now they can {oppMove}, and your {piece} on {sq} gets trapped — it has nowhere safe to go.',
    'Careful: your {piece} on {sq} can get trapped if they {oppMove}.',
  ],

  // ---- The better idea ----
  missedMate: [
    'You had checkmate here: {line}.',
    'There was a forced mate: {line}.',
  ],
  missedMate1: ['{move} was checkmate.', 'Checkmate was on the board — you could {doMove}.'],
  missedBackRank: ['You could {doMove} — their king was stuck behind its own pawns.'],
  missedFree: [
    'Their {piece} on {sq} was free — you could just take it.',
    'Their {piece} on {sq} had no defender — it was yours to take.',
  ],
  missedWinningCapture: [
    'You could have won their {piece} on {sq} by {move}. It wasn\'t protected well enough.',
    'Their {piece} on {sq} was up for grabs — try {move}.',
  ],
  missedFork: [
    'You could {doMove}, forking their {t1} and {t2}.',
    'Look for double attacks: {move} would hit their {t1} and {t2} together.',
  ],
  missedPin: ['You could {doMove} to pin their {pinned} — it can\'t move without exposing the {behind}.'],
  missedSkewer: ['You could {doMove}: their {front} has to step aside, and then you win the {behind}.'],
  missedDiscovered: ['You could {doMove}. That opens a hidden attack from your {slider} on their {target}.'],
  missedTrap: [
    'You could {doMove} and trap their {piece} on {sq} — it would have nowhere to go.',
  ],
  missedDefender: [
    'You could {doMove} — that {captured} was the only guard of their {guarded}.',
  ],
  missedOverload: [
    'Their {piece} on {sq} has two jobs: guarding the {a} and the {b}. You could {doMove} and it can\'t do both.',
  ],
  missedPromotion: [
    'If you {doMove}, nothing can stop that pawn from queening.',
  ],
  savePiece: [
    'Your {piece} on {sq} needed help. You could {doMove} to keep it safe.',
    '{move} would have kept your {piece} on {sq} safe.',
  ],
  fallbackMaterial: [
    '{move} was better: {line}, and you come out ahead.',
    'A better idea was {move}. Then {line}, and you win something.',
  ],
  fallbackMate: [
    '{move} was much stronger — it leads to checkmate: {line}.',
    '{move} started a forced mate: {line}.',
  ],
  fallbackIdea: [
    '{move} was better: {idea} ({line}).',
    'Better was {move} — {idea}: {line}.',
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
    'Out this early, your queen becomes a target. Develop knights and bishops first.',
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
  praiseMate: ['Checkmate — well played.', 'And that\'s mate.'],
  praiseFree: ['A free {piece} — well spotted.', 'That {piece} had no defender, and you took it.'],
  praiseWin: ['Good capture — you won something there.', 'Well spotted — that wins material.'],
  praiseFork: ['A fork: your {attacker} hits two pieces at once.', 'A clean fork.'],
  praisePin: ['Nice pin on their {pinned}.'],
  praiseSkewer: ['A skewer — the piece behind falls.'],
  praiseDiscovered: ['A discovered attack — well played.'],
  praiseCastle: ['Castled: your king is safe and your rook joins the game.', 'Good — king safety first.'],
  praiseEscape: ['Good — you got your {piece} out of danger.', 'You saw the threat to your {piece} and dealt with it.'],
  praiseDefend: ['Good — you protected your {piece} on {sq}.'],
  praiseTradeAhead: [
    'Good trade — when you\'re ahead, swapping pieces makes your lead count even more.',
  ],
  praiseBest: ['The best move.', 'Exactly right.', 'The engine\'s choice too.'],
  praiseGood: ['Good move.', 'That works.', 'Solid choice.'],

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
