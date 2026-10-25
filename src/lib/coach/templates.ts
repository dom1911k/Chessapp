// Friendly, varied phrasing. Each key has several variants; one is picked
// deterministically from a seed so the same position always reads the same.
// Placeholders: {name} → vars.name.

export const TEMPLATES = {
  // ---- What goes wrong ----
  allowsMate: [
    'This allows checkmate: {line}.',
    'Careful — {opp} can now force mate: {line}.',
    'This walks into a mating attack: {line}.',
  ],
  allowsBackRankMate: [
    'This allows {oppMove} — a back-rank checkmate! Your king is trapped behind its own pawns.',
    'Watch your back rank: {oppMove} is checkmate because your king has no escape square.',
  ],
  allowsBackRankMateLine: [
    'This allows a back-rank checkmate: {line}. Your king has no escape square behind its pawns.',
    'Watch your back rank! After {line} your king is trapped behind its own pawns.',
  ],
  hangsMovedFree: [
    'Your {piece} on {sq} can be taken for free.',
    'On {sq} your {piece} is undefended — {opp} can just take it.',
    'Your {piece} has no protection on {sq}, so {oppMove} wins it.',
  ],
  hangsMovedDefended: [
    'Your {piece} on {sq} is attacked by a {attacker}. Even though it is defended, the trade costs you material.',
    'A {attacker} can capture your {piece} on {sq}, and taking back does not make up for it.',
  ],
  ignoredThreat: [
    'Your {piece} on {sq} was already under attack, and this move did not deal with it.',
    'Before moving, check what your opponent threatens: your {piece} on {sq} was attacked and still is.',
  ],
  removedDefender: [
    'Your {moved} was protecting the {piece} on {sq}. After it moved, {oppMove} wins the {piece}.',
    'Moving the {moved} left your {piece} on {sq} without a defender.',
  ],
  leavesHanging: [
    'This leaves your {piece} on {sq} unprotected, and {oppMove} takes it.',
    'Your {piece} on {sq} becomes a free target after this move.',
  ],
  allowsFork: [
    'This allows {oppMove}, a fork: the {attacker} attacks your {t1} and {t2} at the same time.',
    'After {oppMove} the {attacker} hits your {t1} and your {t2} at once — you can only save one.',
  ],
  allowsPin: [
    'This allows {oppMove}, pinning your {pinned} to your {behind}.',
    'After {oppMove} your {pinned} is pinned — if it moves, your {behind} is exposed.',
  ],
  allowsSkewer: [
    'This allows {oppMove}, a skewer: your {front} must move and the {behind} behind it is lost.',
    'After {oppMove} your {front} is attacked, and when it steps aside the {behind} falls.',
  ],
  allowsDiscovered: [
    'This allows a discovered attack: {oppMove} opens a line so the {slider} attacks your {target}.',
    'After {oppMove} a hidden attack appears — the {slider} suddenly hits your {target}.',
  ],
  badTrade: [
    'You took a {captured} with your {piece}, but {opp} can take back. That trade gives away material.',
    'Capturing the {captured} looks tempting, but your {piece} is worth more and it gets taken back.',
  ],
  weakensKing: [
    'This loosens the pawns in front of your king, and {oppMove} starts an attack.',
    'Your king gets a bit drafty after this move — {oppMove} takes advantage.',
  ],
  losesMaterial: [
    'After {line}, you lose {victim}.',
    'The problem is {line} — this costs you {victim}.',
    '{opp} answers {oppMove}, and you end up {victim} down.',
  ],
  strongReply: [
    '{opp} has a strong answer: {line}.',
    'This gives {opp} the chance to play {oppMove}.',
  ],

  allowsTrap: [
    'After {oppMove} your {piece} on {sq} is trapped — it has no safe square to escape to.',
    'This lets your {piece} get trapped: after {oppMove} it has nowhere safe to go.',
  ],

  // ---- The better idea ----
  missedMate: [
    'You had checkmate in {n}: {line}!',
    'There was a forced checkmate: {line}.',
  ],
  missedMate1: ['{move} was checkmate!', 'You had mate in one with {move}!'],
  missedBackRank: ['{move} was a back-rank checkmate — the king was stuck behind its own pawns.'],
  missedFree: [
    'You could have taken the {piece} on {sq} for free with {move}.',
    'The {piece} on {sq} was undefended — {move} wins it.',
  ],
  missedWinningCapture: [
    '{move} wins material: the {piece} on {sq} is not defended well enough.',
    'Capturing with {move} would have won the {piece}.',
  ],
  missedFork: [
    '{move} was a fork — it attacks the {t1} and the {t2} at once.',
    'Look for double attacks: {move} hits the {t1} and {t2} together.',
  ],
  missedPin: ['{move} pins the {pinned} to the {behind}.', 'With {move} you could have pinned the {pinned}.'],
  missedSkewer: ['{move} is a skewer — the {front} has to move and the {behind} falls.'],
  missedDiscovered: ['{move} uncovers an attack from your {slider} on the {target}.'],
  missedTrap: [
    '{move} traps the {piece} on {sq} — it has nowhere safe to go.',
    'With {move} the enemy {piece} on {sq} would be trapped.',
  ],
  missedDefender: [
    '{move} removes the defender: that {captured} was guarding the {guarded}.',
    'Capture the guard! {move} takes the {captured} that protects the {guarded}.',
  ],
  missedOverload: [
    'The {piece} on {sq} is overloaded — it can\'t guard both the {a} and the {b}. {move} exploits that.',
  ],
  missedPromotion: [
    'Push your pawn! After {move} it can\'t be stopped from becoming a queen.',
    '{move} — your pawn is too fast to be caught.',
  ],
  savePiece: [
    '{move} would have kept your {piece} on {sq} safe.',
    'Your {piece} on {sq} needed help — {move} was the way to save it.',
  ],
  fallbackMaterial: [
    'The engine prefers {move} — it wins material because of {line}.',
    '{move} was stronger: after {line} you come out ahead in material.',
  ],
  fallbackShort: ['{move} was a better choice.', 'Instead, {move} was the move.', '{move} would have been safer.'],
  fallbackKeep: [
    'The engine prefers {move} — it keeps your position {state}. A likely line: {line}.',
    '{move} was the better idea; it keeps things {state}: {line}.',
  ],

  // ---- Opening principles ----
  samePieceTwice: [
    'In the opening, try not to move the same piece twice — bring out a new piece instead.',
    'Each opening move is precious. Moving the {piece} again leaves your other pieces at home.',
  ],
  earlyQueen: [
    'Bringing the queen out this early lets your opponent chase it while developing.',
    'The queen is powerful, but out early she becomes a target. Knights and bishops first!',
  ],
  noCastle: [
    'Your king is still in the center. Castling soon keeps it safe and brings a rook into play.',
    'Think about castling — a king in the middle can get into trouble quickly.',
  ],
  flankPawn: [
    'Moves like {move} do not fight for the center. Pawns on e4/d4 (or e5/d5) give your pieces room.',
    'Early on, aim for the center: {move} on the edge does little there.',
  ],
  knightRim: [
    'A knight on the rim is dim — from {sq} it controls only a few squares.',
    'Knights are strongest near the center; on {sq} it does much less.',
  ],
  kingWalk: [
    'Moving your king now gives up the right to castle.',
    'Try to keep your king home until you can castle.',
  ],

  // ---- Praise ----
  praiseMate: ['Checkmate! Beautifully done.', 'That is checkmate — well played!'],
  praiseFree: ['Nice — you picked up a free {piece}.', 'Good eye! That {piece} was undefended.'],
  praiseWin: ['Good capture — that wins material.', 'Well spotted, that capture wins material.'],
  praiseFork: ['Great fork! Your {attacker} attacks two pieces at once.', 'A fork — nicely done!'],
  praisePin: ['Nice pin on the {pinned}.'],
  praiseSkewer: ['A skewer — excellent!'],
  praiseDiscovered: ['A discovered attack — well played!'],
  praiseCastle: ['Castling — your king is safe and your rook joins the game.', 'Good, you castled. King safety first!'],
  praiseEscape: ['Good — you moved your {piece} out of danger.', 'You spotted the threat to your {piece}. Well done!'],
  praiseDefend: ['Good — you protected your {piece} on {sq}.'],
  praiseTradeAhead: [
    'Good trade — when you\'re ahead in material, swapping pieces makes your extra material count even more.',
  ],
  praiseBest: ['That is the best move.', 'Excellent — the engine agrees.', 'Spot on!'],
  praiseGood: ['Good move.', 'Solid.', 'Nice, that works well.'],

  // ---- Take-backs ----
  takebackGood: [
    'Good call taking that back. {reason}',
    'Smart take-back! {reason}',
  ],
  takebackFine: [
    'That move was actually fine — but trying a different idea is OK!',
    'No harm in taking it back, though your move was reasonable.',
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
  return text.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

export function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
