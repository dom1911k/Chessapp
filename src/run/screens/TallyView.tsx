// Score tally after a room: chips count up, each relic that fired flashes and adds its mult,
// then the total slams in with a screen shake and a buzz.
import { useEffect, useRef, useState } from 'react';
import { MODIFIERS, RELICS, ROOM_NAME } from '../content';
import { useRun } from '../store';
import { TUNING as T } from '../tuning';
import type { Fire } from '../types';
import { sfx, buzz } from '../sfx';
import { Glyph, PixelNum } from './bits';

export function TallyView({ onShake }: { onShake: () => void }) {
  const s = useRun();
  const run = s.run!;
  const res = run.results[run.results.length - 1];
  const multFires = res.fires.filter((f) => f.mult);
  const otherFires = res.fires.filter((f) => !f.mult);
  const baseMult = T.score.baseMult + (res.modifier === 'focused' ? T.modifiers.focused.mult : 0);
  // Stages: 0 = chips counting, 1..n = mult fires, n+1 = total, n+2 = done.
  const [stage, setStage] = useState(0);
  const [chips, setChips] = useState(0);
  const [mult, setMult] = useState(baseMult);
  const [flash, setFlash] = useState<Fire | null>(null);
  const skip = useRef(false);
  const final = multFires.length + 1;

  useEffect(() => {
    let alive = true;
    const wait = (ms: number) => new Promise((r) => setTimeout(r, skip.current ? 0 : ms));
    void (async () => {
      // Chips count up.
      const steps = 18;
      for (let i = 1; i <= steps && alive; i++) {
        setChips(Math.round((res.chips * i) / steps));
        if (!skip.current && i % 2 === 0) sfx('chip', i);
        await wait(45);
      }
      await wait(250);
      let m = baseMult;
      for (let i = 0; i < multFires.length && alive; i++) {
        const f = multFires[i];
        m = Math.round((m + (f.mult ?? 0)) * 100) / 100;
        setFlash(f);
        setMult(m);
        setStage(i + 1);
        if (!skip.current) {
          sfx('relic', i);
          buzz(12);
        }
        await wait(380);
      }
      setFlash(null);
      if (!alive) return;
      setMult(res.mult);
      setStage(final);
      sfx('slam');
      buzz([30, 20, 90]);
      onShake();
      await wait(500);
      if (alive) setStage(final + 1);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-full flex-col items-center px-4 pt-6 pb-6 text-center" onClick={() => (skip.current = true)}>
      <div className="run-label">{res.won ? 'Room cleared' : 'Room failed'} · {MODIFIERS[res.modifier].name}</div>
      <div className="run-title mt-1 text-3xl font-black">{ROOM_NAME[res.kind]}</div>
      <div className="run-sans mt-1 text-sm text-[var(--ink-dim)]">{res.reason}</div>

      <div className="mt-8 flex items-center gap-3">
        <div className="run-panel flex min-w-28 flex-col items-center gap-1 px-3 py-3" style={{ boxShadow: '0 0 30px rgba(79,179,255,.25)' }}>
          <span className="run-label text-[var(--chip)]!">Chips</span>
          <PixelNum value={chips} size={5} color="var(--chip)" />
        </div>
        <PixelNum value="×" size={4} color="var(--ink-dim)" glow={false} />
        <div key={stage} className={`run-panel flex min-w-24 flex-col items-center gap-1 px-3 py-3 ${stage > 0 && stage < final ? 'run-pulse' : ''}`} style={{ boxShadow: '0 0 30px rgba(255,93,108,.25)' }}>
          <span className="run-label text-[var(--mult)]!">Mult</span>
          <PixelNum value={mult} size={5} color="var(--mult)" />
        </div>
      </div>

      <div className="mt-4 flex h-12 items-center justify-center">
        {flash && (
          <div key={stage} className="run-slam flex items-center gap-2 rounded-xl bg-black/40 px-3 py-1.5 ring-1 ring-[var(--gold-dim)]">
            <span className="text-[var(--gold-2)]"><Glyph name={RELICS[flash.relic].glyph} size={26} /></span>
            <span className="run-title font-bold">{RELICS[flash.relic].name}</span>
            <span className="run-sans font-black text-[var(--mult)]">+{flash.mult}×</span>
          </div>
        )}
      </div>

      <div className="mt-2 h-24">
        {stage >= final && (
          <div className="run-slam flex flex-col items-center">
            <span className="run-label">Score</span>
            <PixelNum value={res.score} size={9} />
          </div>
        )}
      </div>

      {stage > final && (
        <div className="run-fadeup mt-4 flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-2 text-[var(--gold)]">
            <Glyph name="coin" size={22} />
            <span className="run-sans font-bold">+{res.gold} gold</span>
          </div>
          {otherFires.map((f, i) => (
            <div key={i} className="run-sans text-sm text-[var(--ink-dim)]">
              {RELICS[f.relic].name}: {f.composure ? `+${f.composure} Composure` : f.gold ? `+${f.gold} gold` : ''}
            </div>
          ))}
          {!res.won && res.kind !== 'boss' && <div className="run-sans text-sm text-[var(--blood)]">−{T.composure.failRoom} Composure for failing the room</div>}
        </div>
      )}

      <button className="run-btn mt-auto w-full max-w-xs" disabled={stage <= final} onClick={() => s.afterTally()}>
        {res.kind === 'boss' ? 'Debrief' : 'Continue'}
      </button>
    </div>
  );
}
