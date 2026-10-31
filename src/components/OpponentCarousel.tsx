// Swipeable opponent cards on the Play tab: big portrait, stars, record and style.
import { useEffect, useRef, useState } from 'react';
import { BookOpen, Lock, Star } from 'lucide-react';
import { OPPONENTS, type Opponent } from '../lib/people';
import { isUnlocked, MAX_STARS, starsOf, type OpponentRecord } from '../lib/people/record';
import { REPERTOIRES } from '../lib/people/openings';
import { Portrait } from './Coach';

const CARD = 236;
const GAP = 12;

/** A soft backdrop colour per opponent, from warm (easy) to deep (hard). */
const TINT = ['#f8c8d4', '#cfe3c4', '#f2d2a6', '#bcd7ec', '#d9c8ef', '#f3c19b', '#b9d8cf', '#c7c3e6', '#e7b9b9'];

function Card({ o, i, rec, open, active, onTap }: { o: Opponent; i: number; rec?: OpponentRecord; open: boolean; active: boolean; onTap: () => void }) {
  const stars = starsOf(rec);
  const games = rec ? rec.w + rec.d + rec.l : 0;
  return (
    <button
      onClick={onTap}
      className={`card relative flex shrink-0 snap-center flex-col items-center overflow-hidden !p-0 text-center transition duration-300 ${
        active ? 'scale-100 !ring-2 !ring-brand-500 shadow-[0_18px_40px_-18px_rgba(30,60,40,0.55)]' : 'scale-[0.93] opacity-60'
      }`}
      style={{ width: CARD }}
      aria-label={open ? `${o.name}, ${o.elo}` : `${o.name}, locked`}
    >
      <div className="relative flex h-[132px] w-full items-end justify-center">
        <div className="absolute inset-0 dark:opacity-35" style={{ background: `linear-gradient(180deg, ${TINT[i % TINT.length]}, transparent)` }} />
        <span className="absolute top-2.5 left-3 rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-bold text-stone-700 dark:bg-black/30 dark:text-stone-100">~{o.elo}</span>
        {open && (
          <span className="absolute top-2.5 right-3 flex gap-px">
            {Array.from({ length: MAX_STARS }, (_, k) => (
              <Star key={k} size={12} className={k < stars ? 'fill-gold-400 text-gold-500' : 'text-stone-400/70'} />
            ))}
          </span>
        )}
        <Portrait id={o.id} size={108} mood={active && open ? 'happy' : 'neutral'} className={`mb-[-14px] ${open ? '' : 'opacity-40 grayscale'}`} />
        {!open && (
          <span className="absolute top-[52px] flex h-10 w-10 items-center justify-center rounded-full bg-stone-900/75 text-white shadow-lg">
            <Lock size={18} />
          </span>
        )}
      </div>
      <div className={`w-full px-4 pt-5 pb-4 transition-opacity duration-300 ${active ? "" : "opacity-0"}`}>
        <div className="font-display text-xl font-semibold">{o.name}</div>
        <div className="text-xs font-semibold text-brand-700 dark:text-brand-500">{open ? o.tagline : `Beat ${OPPONENTS[i - 1].name} to unlock`}</div>
        <p className="mt-2 line-clamp-3 min-h-[3.75em] text-[13px] leading-[1.25em] text-stone-600 dark:text-stone-300">{o.bio}</p>
        <div className="mt-2 flex items-center justify-center gap-3 text-[11px] text-stone-500">
          {REPERTOIRES[o.id] && (
            <span className="inline-flex min-w-0 items-center gap-1 truncate">
              <BookOpen size={12} /> {REPERTOIRES[o.id].favourite}
            </span>
          )}
        </div>
        {games > 0 && (
          <div className="mt-1.5 text-[11px] font-semibold text-stone-500">
            {rec!.w}W · {rec!.d}D · {rec!.l}L
          </div>
        )}
      </div>
    </button>
  );
}

export function OpponentCarousel({ records, selected, onSelect }: { records: Record<string, OpponentRecord>; selected: string | null; onSelect: (id: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const start = Math.max(0, OPPONENTS.findIndex((o) => o.id === selected));
  const [centered, setCentered] = useState(start);
  const raf = useRef(0);

  // Start on the chosen opponent.
  useEffect(() => {
    ref.current?.scrollTo({ left: start * (CARD + GAP) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onScroll = () => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      const i = Math.max(0, Math.min(OPPONENTS.length - 1, Math.round(el.scrollLeft / (CARD + GAP))));
      if (i === centered) return;
      setCentered(i);
      onSelect(OPPONENTS[i].id);
    });
  };
  const goTo = (i: number) => ref.current?.scrollTo({ left: i * (CARD + GAP), behavior: 'smooth' });

  return (
    <div>
      <div
        ref={ref}
        onScroll={onScroll}
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory overflow-x-auto py-3"
        style={{ gap: GAP, paddingInline: `calc(50% - ${CARD / 2}px)` }}
      >
        {OPPONENTS.map((o, i) => (
          <Card key={o.id} o={o} i={i} rec={records[o.id]} open={isUnlocked(o.id, records)} active={i === centered && selected !== 'custom'} onTap={() => goTo(i)} />
        ))}
      </div>
      <div className="flex justify-center gap-1.5">
        {OPPONENTS.map((o, i) => (
          <button
            key={o.id}
            aria-label={o.name}
            onClick={() => goTo(i)}
            className={`h-1.5 rounded-full transition-all ${i === centered ? 'w-5 bg-brand-600' : isUnlocked(o.id, records) ? 'w-1.5 bg-stone-300 dark:bg-stone-600' : 'w-1.5 bg-stone-200 dark:bg-stone-800'}`}
          />
        ))}
      </div>
    </div>
  );
}
