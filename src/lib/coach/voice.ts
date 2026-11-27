// Play Coach: the opponent is Sam, and Sam is the one talking. The coach's feedback is written for
// any opponent ("they win it for free", "Their pawn on d3 had no defender", "Your opponent
// threatens checkmate!"); in Play Coach it's told in his own voice ("I win it for free", "My pawn
// on d3 had no defender", "I threaten checkmate!"). Pure.
//
// "they", "their" and "your opponent" in the feedback always mean the opponent. "them" sometimes
// means pieces ("bring them out", "keep an eye on them"), so it only changes after the verbs that
// take the opponent ("lets them", "gives them", "than them").

const RULES: [RegExp, string][] = [
  // Sam's own name (the opening line, the game-over line, notes after his move).
  [/\bYou beat Coach Sam\b/g, 'You beat me'],
  [/\bCoach Sam got you\b/g, 'I got you'],
  [/\bCoach Sam threatens\b/g, 'I threaten'],
  [/\bAfter Coach Sam's\b/g, 'After my'],
  [/\bCoach Sam's\b/g, 'My'],
  [/\bSam moves first\b/g, 'I move first'],
  // "your opponent", with the verb after it.
  [/\b[Yy]our opponent's\b/g, 'my'],
  [/\b[Yy]our opponent is\b/g, "I'm"],
  [/\b[Yy]our opponent was\b/g, 'I was'],
  [/\b[Yy]our opponent has\b/g, 'I have'],
  [/\b[Yy]our opponent threatens\b/g, 'I threaten'],
  [/\b[Yy]our opponent\b/g, 'I'],
  // they / their / them.
  [/\b[Tt]hey're\b/g, "I'm"],
  [/\b[Tt]hey've\b/g, "I've"],
  [/\b[Tt]hey are\b/g, "I'm"],
  [/\b[Tt]hey were\b/g, 'I was'],
  [/\b[Tt]hey\b/g, 'I'],
  [/\btheirs\b/g, 'mine'],
  [/\bTheir\b/g, 'My'],
  [/\btheir\b/g, 'my'],
  [/\b(lets|let|gives|give|leaves|leave|allows|allow|than) them\b/g, '$1 me'],
];

/** One line of coach feedback in Sam's own voice. */
export function samVoice(text: string): string {
  let out = text;
  for (const [re, to] of RULES) out = out.replace(re, to);
  // A sentence that now starts with "my" (from "your opponent's …").
  return out.replace(/(^|[.!?]\s+)my\b/g, (_m, pre: string) => `${pre}My`);
}
