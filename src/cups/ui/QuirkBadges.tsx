// Quirk icons: on the opponent card (with their sentence) and next to the opponent during a game,
// where an icon pulses — with a short caption — when its quirk visibly acts.
import { useEffect, useState } from 'react';
import { quirkById } from '../quirks';
import { useCupGame } from '../game';
import { Sprite } from '../pixel/sprites';
import { BLOOD, SPIRIT } from '../pixel/pixelize';
import { Sheet } from './Sheet';
import { sfx } from '../sfx';

/** For the opponent card: icon + one plain sentence per quirk; a hidden one shows as "?". */
export function QuirkList({ quirks, hidden, scouted }: { quirks: string[]; hidden?: string; scouted: boolean }) {
  return (
    <div className="space-y-1.5">
      {quirks.map((id) => {
        const q = quirkById(id);
        return q ? (
          <div key={id} className="flex items-start gap-2 text-left">
            <Sprite name={q.glyph} size={26} px={12} pal={SPIRIT} />
            <div className="run-sans text-sm leading-snug"><b>{q.name}.</b> {q.text}</div>
          </div>
        ) : null;
      })}
      {hidden && (
        <div className="flex items-start gap-2 text-left">
          <Sprite name={scouted ? quirkById(hidden)!.glyph : 'question'} size={26} px={12} pal={BLOOD} />
          <div className="run-sans text-sm leading-snug">
            {scouted ? <><b>{quirkById(hidden)!.name}</b> <span className="text-[var(--ink-dim)]">(hidden — scouted)</span>. {quirkById(hidden)!.text}</> : <><b>A hidden quirk.</b> <span className="text-[var(--ink-dim)]">It shows itself the first time it acts.</span></>}
          </div>
        </div>
      )}
    </div>
  );
}

/** In-game: small icons beside the opponent; one pulses when its quirk acts. */
export function QuirkIcons() {
  const g = useCupGame((s) => s.game)!;
  const pulse = useCupGame((s) => s.pulse);
  const [lit, setLit] = useState<{ id: string; text: string } | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  useEffect(() => {
    if (!pulse || pulse.kind !== 'quirk') return;
    const q = quirkById(pulse.id);
    if (!q) return;
    setLit({ id: pulse.id, text: q.act });
    sfx('hit');
    const t = setTimeout(() => setLit(null), 2200);
    return () => clearTimeout(t);
  }, [pulse]);
  const ids = [...g.quirks, ...(g.hidden ? [g.hidden] : [])];
  return (
    <>
      <span className="inline-flex items-center gap-1 align-middle">
        {ids.map((id) => {
          const known = id !== g.hidden || g.revealed.includes(id);
          const q = quirkById(id);
          return (
            <button key={id} className={`inline-flex transition-transform ${lit?.id === id ? 'run-punch scale-125 drop-shadow-[0_0_8px_#ff5d6c]' : ''}`} onClick={() => known && setInfo(id)} aria-label={known ? q?.name : 'Hidden quirk'}>
              <Sprite name={known ? (q?.glyph ?? 'question') : 'question'} size={18} px={12} pal={known ? SPIRIT : BLOOD} />
            </button>
          );
        })}
      </span>
      {lit && <div className="run-fadeup run-sans pointer-events-none absolute top-12 right-2 left-2 z-20 rounded bg-black/75 px-2 py-1 text-center text-xs font-bold text-[#ffb3bd]">{lit.text}</div>}
      {info && (
        <Sheet onClose={() => setInfo(null)}>
          <div className="flex items-start gap-3 text-left">
            <Sprite name={quirkById(info)!.glyph} size={44} px={14} pal={SPIRIT} />
            <div>
              <div className="run-label">Opponent quirk</div>
              <div className="run-title text-xl font-black">{quirkById(info)!.name}</div>
              <div className="run-sans mt-1 text-sm text-[var(--ink-dim)]">{quirkById(info)!.text}</div>
            </div>
          </div>
        </Sheet>
      )}
    </>
  );
}
