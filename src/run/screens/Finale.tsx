// The run finale, before the debrief: each room's score as a column of slabs, the Fervor peak,
// then the total counting up with accelerating ticks and slamming in; a new personal best gets
// its fanfare and a gold frame; the run's material bonus streams into the Order pouch.
import { useEffect, useRef, useState } from 'react';
import { useRun } from '../store';
import { TUNING as T } from '../tuning';
import { fmtBig } from '../rules';
import { finaleTicks, slabsFor, slamShake } from '../crunch';
import { MATERIALS, MATERIAL_INFO, type Material, type Materials } from '../order';
import { buzz, sfx } from '../sfx';
import { reducedMotion } from '../settings';
import { FervorFlame, MaterialRow, PixelNum } from './bits';
import { PixelText } from './PixelText';
import { Stream, usePace } from './Crunch';
import { ROOM_NAME } from '../content';

export function Finale({ onShake }: { onShake: (px?: number) => void }) {
  const s = useRun();
  const run = s.run!;
  const F = T.crunch.finale;
  const rows = run.results;
  const total = run.finalScore ?? 0;
  const peak = run.fervorPeak ?? 1;
  const best = run.prevBest !== undefined && total > run.prevBest && total > 0;
  const bonus: Materials = run.materialBonus ?? {};
  const bonusMats = MATERIALS.filter((m) => (bonus[m] ?? 0) >= 1);
  const won = run.ended === 'won';
  const candles = won ? run.composure * T.score.composureLeftChips : 0;

  const pace = usePace();
  const [slabs, setSlabs] = useState<number[]>(() => rows.map(() => 0));
  const [step, setStep] = useState<'slabs' | 'fervor' | 'count' | 'slam' | 'stream' | 'done'>('slabs');
  const [shown, setShown] = useState(0);
  const [landed, setLanded] = useState<Partial<Record<Material, number>>>({});
  const [streaming, setStreaming] = useState(false);
  const totalRef = useRef<HTMLDivElement>(null);
  const pouchRef = useRef<HTMLSpanElement>(null);
  const streamsLeft = useRef(0);
  const streamDone = useRef<(() => void) | null>(null);
  const order = ['slabs', 'fervor', 'count', 'slam', 'stream', 'done'];
  const at = (x: string) => order.indexOf(step) >= order.indexOf(x);

  useEffect(() => {
    let alive = true;
    void (async () => {
      pace.begin();
      // Columns of slabs, one room at a time.
      for (let i = 0; i < rows.length && alive; i++) {
        const k = slabsFor(rows[i].score);
        for (let j = 0; j < k && alive; j++) {
          setSlabs((x) => x.map((v, c) => (c === i ? j + 1 : v)));
          if (!pace.ctl.current.instant) sfx('tick', 0, false, Math.min(T.crunch.semitoneMax, j));
          await pace.wait(F.slabMs);
        }
        await pace.wait(F.slabMs);
      }
      if (!alive) return;
      setSlabs(rows.map((r) => slabsFor(r.score)));
      // The Fervor peak.
      setStep('fervor');
      if (peak > 1) {
        sfx('beatX');
        buzz(T.crunch.haptic.xmult);
        await pace.wait(500);
      }
      // The total counts up with accelerating ticks.
      setStep('count');
      const ticks = finaleTicks();
      for (let i = 0; i < ticks.length && alive; i++) {
        if (pace.ctl.current.instant) break;
        const k = (i + 1) / ticks.length;
        setShown(Math.round(total * (1 - (1 - k) ** 3)));
        sfx('tick', 0, false, Math.min(T.crunch.semitoneMax, Math.floor(i / 3)));
        await pace.wait(ticks[i]);
      }
      if (!alive) return;
      setShown(total);
      setStep('slam');
      const px = slamShake(total);
      sfx('collide', px);
      buzz(Math.round(T.crunch.haptic.slam * px));
      if (!reducedMotion()) onShake(px + 2);
      await pace.wait(450);
      if (best) {
        sfx('fanfare');
        buzz([30, 40, 30, 40, 90]);
        await pace.wait(1300);
      }
      // The material bonus streams into the Order pouch.
      setStep('stream');
      if (bonusMats.length && !pace.ctl.current.instant && !reducedMotion()) {
        await new Promise<void>((done) => {
          streamDone.current = done;
          streamsLeft.current = bonusMats.length;
          setStreaming(true);
          void pace.wait(F.streamMs * 4).then(done);
        });
      }
      if (!alive) return;
      setLanded(Object.fromEntries(bonusMats.map((m) => [m, Math.floor(bonus[m] ?? 0)])));
      setStreaming(false);
      pace.end();
      setStep('done');
    })();
    return () => {
      alive = false;
      pace.finish();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Columns share one log scale: the tallest one fills the space.
  const maxSlabs = Math.max(1, ...rows.map((r) => slabsFor(r.score)));
  const share = (m: Material) => {
    const amount = Math.floor(bonus[m] ?? 0);
    const sum = bonusMats.reduce((a, x) => a + Math.floor(bonus[x] ?? 0), 0);
    return Math.max(1, Math.round((F.streamMax * amount) / Math.max(1, sum)));
  };

  return (
    <div className="flex h-full flex-col items-center overflow-y-auto px-4 pt-6 pb-6 text-center">
      <div className="run-label">{won ? 'The rival falls' : 'The run ends'}</div>
      <PixelText text="The Count" size={4} className="mt-1" color="#ffe7a3" />

      {/* A column of slabs per room (log scale) */}
      <div className="mt-5 flex h-44 w-full items-end justify-center gap-1.5">
        {rows.map((r, i) => (
          <div key={i} className="flex min-w-0 flex-1 flex-col items-center justify-end" style={{ maxWidth: 34 }}>
            {slabs[i] >= slabsFor(r.score) && <span className="run-sans mb-0.5 text-[9px] font-black text-[var(--gold-2)]">{fmtBig(r.score)}</span>}
            <div className="flex w-full flex-col-reverse gap-[2px]">
              {Array.from({ length: slabs[i] }, (_, j) => (
                <span
                  key={j}
                  className="run-slab block w-full"
                  style={{ height: Math.max(4, Math.floor(128 / maxSlabs) - 2), background: r.won ? (r.score >= r.target && r.target > 0 ? '#5ee59a' : 'var(--chip)') : '#6a5a7a', boxShadow: '0 0 0 1px #1b0f22, inset 0 1px 0 rgba(255,255,255,.35)' }}
                />
              ))}
            </div>
            <span className="run-sans mt-1 w-full truncate text-[8px] text-[var(--ink-dim)]">{ROOM_NAME[r.kind]?.split(' ').pop()}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex h-10 items-center justify-center">
        {at('fervor') && peak > 1 && (
          <span className="run-slam flex items-center gap-2">
            <span className="run-label">Fervor peak</span>
            <FervorFlame value={peak} size={1.2} />
          </span>
        )}
      </div>

      <div ref={totalRef} className={`relative mt-2 flex min-w-48 flex-col items-center px-4 py-3 ${at('slam') && best ? 'run-best-frame' : 'run-panel'}`}>
        <span className="run-label">Run total</span>
        <div key={at('slam') ? 'slam' : 'count'} className={at('slam') ? 'run-slam' : ''}>
          <PixelNum value={at('count') ? shown : 0} big size={7} color={at('slam') && best ? '#ffe7a3' : undefined} />
        </div>
        {candles > 0 && <span className="run-sans text-[10px] text-[var(--ink-dim)]">incl. +{fmtBig(candles)} for candles left</span>}
        {at('slam') && best && (
          <span className="run-stamp run-sans absolute -top-3 -right-3 rotate-[8deg] px-1.5 py-0.5 text-[11px] font-black text-[var(--gold-2)] uppercase" style={{ boxShadow: '0 0 0 2px #f2c75c, 0 0 14px rgba(242,199,92,.6)' }}>
            New best!
          </span>
        )}
        {at('slam') && !best && run.prevBest !== undefined && run.prevBest > 0 && <span className="run-sans text-[10px] text-[var(--ink-dim)]">Best {fmtBig(run.prevBest)}</span>}
      </div>

      {bonusMats.length > 0 && (
        <div className="mt-4 flex flex-col items-center gap-1">
          <span className="run-label">Run bonus · √ of your total</span>
          <span ref={pouchRef} className="run-panel flex min-h-9 items-center gap-2 px-3 py-1.5">
            {at('stream') ? <MaterialRow m={landed as Materials} all={false} size={16} /> : <span className="run-sans text-xs text-[var(--ink-dim)]">Order pouch</span>}
          </span>
        </div>
      )}
      {streaming &&
        bonusMats.map((m) => (
          <Stream
            key={m}
            from={totalRef}
            to={pouchRef}
            n={share(m)}
            color={MATERIAL_INFO[m].color}
            ms={F.streamMs}
            stagger={Math.max(12, F.streamMs / F.streamMax)}
            onLand={(i) => {
              const n = share(m);
              setLanded((x) => ({ ...x, [m]: Math.floor(((bonus[m] ?? 0) * (i + 1)) / n) }));
              if (i % 2 === 0) sfx('drip', i);
            }}
            onDone={() => {
              streamsLeft.current--;
              if (streamsLeft.current <= 0) streamDone.current?.();
            }}
          />
        ))}

      <div className="mt-auto w-full max-w-xs pt-4">
        <button className="run-btn w-full" disabled={step !== 'done'} onClick={() => s.seeFinale()}>
          {step === 'done' ? 'Debrief' : 'Tap: faster · hold: skip'}
        </button>
      </div>
    </div>
  );
}
