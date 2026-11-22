// Does a coach sentence already name a move? Used so the better move is said once, not twice
// ("Moving your queen to e2 would have…" and then "Better: Qe2").
import { lineToSan } from '../chess/game';
import { moveWords } from '../chess/words';

export function namesMove(text: string, fen: string, uci: string | undefined): boolean {
  if (!uci) return false;
  const t = text.toLowerCase();
  let words: string[] = [];
  try {
    words = [moveWords(fen, uci, 'you', 'ger', false), moveWords(fen, uci, 'you', 'inf', false)].filter(Boolean).map((w) => w.toLowerCase());
  } catch {
    /* an unreadable position: fall back to the SAN */
  }
  if (words.some((w) => t.includes(w))) return true;
  const san = lineToSan(fen, [uci])[0];
  return !!san && new RegExp(`(^|[^\\w])${san.replace(/[+#]/g, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w])`).test(text);
}
