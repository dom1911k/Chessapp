// Tells open screens that stored progress changed elsewhere (e.g. a reset in Settings), so they
// reload instead of showing what they read when they first appeared.
export type ChangeKind = 'records' | 'rating' | 'colour';
const EVENT = 'cc:changed';

export function announceChange(kind: ChangeKind): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENT, { detail: kind }));
}

/** Calls `cb` when `kind` changes; returns the unsubscribe function. */
export function onChange(kind: ChangeKind, cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const h = (e: Event) => { if ((e as CustomEvent).detail === kind) cb(); };
  window.addEventListener(EVENT, h);
  return () => window.removeEventListener(EVENT, h);
}
