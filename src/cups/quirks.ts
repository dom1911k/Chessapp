// Cup opponents' player types: every cup opponent has one you can see; the finalist also has a
// hidden one. The types themselves live in src/lib/playerTypes.ts (shared with the characters and
// Quick match since round 7); this module re-exports them and picks them for a cup.
import { QUIRK_IDS } from '../lib/playerTypes';
export * from '../lib/playerTypes';

/**
 * Quirks for a cup: one visible quirk per character (no repeats in a cup), avoiding the ones
 * you faced most recently while the pool allows.
 */
export function assignQuirks(field: string[], recent: string[], rand: () => number): Record<string, string> {
  const fresh = QUIRK_IDS.filter((q) => !recent.includes(q));
  const stale = QUIRK_IDS.filter((q) => recent.includes(q));
  const order = [...shuffled(fresh, rand), ...shuffled(stale, rand)];
  const out: Record<string, string> = {};
  field.forEach((id, i) => (out[id] = order[i % order.length]));
  return out;
}

/** The finalist's hidden quirk: one not used in this cup, avoiding recent ones. */
export function hiddenQuirk(used: string[], recent: string[], rand: () => number): string {
  const left = QUIRK_IDS.filter((q) => !used.includes(q));
  const fresh = left.filter((q) => !recent.includes(q));
  const pool = fresh.length ? fresh : left.length ? left : QUIRK_IDS;
  return pool[Math.floor(rand() * pool.length)];
}

function shuffled<T>(xs: T[], r: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

