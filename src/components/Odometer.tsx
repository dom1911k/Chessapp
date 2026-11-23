// Numbers that change in front of you. <Odometer> rolls its digits whenever the value changes.
// useLastSeen / <SeenNumber> remember the value you last saw: when a screen opens and it has moved,
// the old value shows, then after 450ms it rolls to the new one (900ms) and a "+14" chip pops beside
// it, fading after 2.2s, with a soft marimba step. The new value is saved first, so it rolls once.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { kvGet, kvSet } from '../lib/db';
import { POP, animate, eo3, reduced, sleep, token, tween } from '../lib/motion';
import { odoStr, fmtNum } from '../lib/numbers';
import { sfx } from '../lib/sfx';

export function Odometer({ value, decimals = 0, suffix = '', className = '', testId }: { value: number; decimals?: number; suffix?: string; className?: string; testId?: string }) {
  const el = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => odoStr(el.current, fmtNum(value, decimals) + suffix), [value, decimals, suffix]);
  return <span ref={el} className={`odo inline-block tabular-nums ${className}`} data-testid={testId} aria-label={fmtNum(value, decimals) + suffix} />;
}

const SEEN = (key: string) => `lastSeen:${key}`;

/** The value to show now, rolling from the last seen one; and the delta chip once it lands. */
export function useLastSeen(key: string, value: number | null | undefined) {
  const [shown, setShown] = useState<number | null>(null);
  const [delta, setDelta] = useState<{ d: number; id: number } | null>(null);
  useEffect(() => {
    if (value == null) return;
    let alive = true;
    const tk = token();
    void kvGet<number | null>(SEEN(key), null).then(async (prev) => {
      if (!alive) return;
      await kvSet(SEEN(key), value);
      if (prev == null || prev === value || reduced()) return setShown(value);
      setShown(prev);
      await sleep(450, tk);
      if (!alive) return;
      await tween(900, (k) => alive && setShown(prev + (value - prev) * eo3(k)), tk);
      if (!alive) return;
      setShown(value);
      setDelta({ d: Math.round(value - prev), id: Date.now() });
      sfx('land', 5);
    });
    return () => {
      alive = false;
      tk.skip = true;
    };
  }, [key, value]);
  return { shown: shown ?? value ?? null, delta };
}

/** A number that rolls from the value you last saw, with its "+14" / "−14" chip. */
export function SeenNumber({ k, value, className = '', chipClass = '', odometer = true }: { k: string; value: number | null | undefined; className?: string; chipClass?: string; odometer?: boolean }) {
  const { shown, delta } = useLastSeen(k, value);
  if (shown == null) return null;
  return (
    <span className="relative inline-flex items-baseline">
      {odometer ? <Odometer value={Math.round(shown)} className={className} /> : <span className={`tabular-nums ${className}`}>{Math.round(shown)}</span>}
      {delta && delta.d !== 0 && <DeltaChip key={delta.id} d={delta.d} className={chipClass} />}
    </span>
  );
}

/** "+14" in green or "−14" in muted red: pops in, fades after 2.2s. */
export function DeltaChip({ d, className = '', stay = false }: { d: number; className?: string; stay?: boolean }) {
  const el = useRef<HTMLSpanElement>(null);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    void animate(el.current, [{ opacity: 0, transform: 'translateY(6px) scale(.6)' }, { opacity: 1, transform: 'none' }], POP);
    if (stay) return;
    const t = setTimeout(() => void animate(el.current, [{ opacity: 1 }, { opacity: 0 }], { d: 400 }).then(() => setGone(true)), 2200);
    return () => clearTimeout(t);
  }, [stay]);
  if (gone) return null;
  return (
    <span ref={el} className={`ml-1 text-[0.72em] font-extrabold tabular-nums ${className}`} style={{ color: d >= 0 ? '#8fd14f' : '#e07b6c' }} data-testid="delta-chip">
      {d >= 0 ? '+' : '−'}
      {Math.abs(d)}
    </span>
  );
}
