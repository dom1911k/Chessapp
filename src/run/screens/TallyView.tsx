// Score tally after a room: chips count up, relics add (+) and multiply (×) the mult, the score
// slams in, then the score turns into gold (the blind stamp when the chip target was beaten).
// When the room gives a free pick, its cards slide up underneath — one screen, not two.
import { useEffect, useRef, useState } from 'react';
import { CONSUMABLES, MODIFIERS, RELICS, ROOM_NAME, bossMod } from '../content';
import { cardSlots, goldParts } from '../rules';
import { useRun } from '../store';
import { TUNING as T } from '../tuning';
import type { ConsumableId, Fire, RelicId } from '../types';
import { sfx, buzz } from '../sfx';
import { PixelNum, TarotCard } from './bits';
import { PixelPortrait, Sprite } from '../pixel/sprites';
import { CoinRain } from './scenes';

export function TallyView({ onShake }: { onShake: () => void }) {
  const s = useRun();
  const run = s.run!;
  const res = run.results[run.results.length - 1];
  const offer = run.offer;
  const name = (f: Fire) => (f.relic === 'rival' ? bossMod(run.bossId).name : RELICS[f.relic].name);
  const icon = (f: Fire) => (f.relic === 'rival' ? <PixelPortrait id={run.bossId} size={28} px={24} boss /> : <Sprite name={RELICS[f.relic].glyph} size={28} px={14} />);
  // Adds first, then multipliers — the same order the score uses.
  const multFires = [...res.fires.filter((f) => f.mult), ...res.fires.filter((f) => f.xmult)];
  const chipFires = res.fires.reduce((a, f) => a + (f.chips ?? 0), 0);
  const otherFires = res.fires.filter((f) => !f.mult && !f.xmult && !f.chips);
  const baseMult = T.score.baseMult + (res.modifier === 'focused' ? T.modifiers.focused.mult : 0);
  const blind = res.won && res.target > 0 && res.chips >= res.target;
  const parts = goldParts(res.score, blind, !!res.clean);
  const gilded = res.won && res.modifier === 'gilded';
  // Stages: 0 = chips counting, 1..n = mult fires, n+1 = score, n+2 = gold, n+3 = cards.
  const [stage, setStage] = useState(0);
  const [chips, setChips] = useState(0);
  const [mult, setMult] = useState(baseMult);
  const [flash, setFlash] = useState<Fire | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const skip = useRef(false);
  const final = multFires.length + 1;

  useEffect(() => {
    let alive = true;
    const wait = (ms: number) => new Promise((r) => setTimeout(r, skip.current ? 0 : ms));
    void (async () => {
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
        m = Math.round((f.xmult ? m * f.xmult : m + (f.mult ?? 0)) * 100) / 100;
        setFlash(f);
        setMult(m);
        setStage(i + 1);
        if (!skip.current) {
          sfx('relic', i);
          buzz(f.xmult ? [20, 30, 20] : 12);
        }
        await wait(f.xmult ? 600 : 380);
      }
      setFlash(null);
      if (!alive) return;
      setMult(res.mult);
      setStage(final);
      sfx('slam');
      buzz([30, 20, 90]);
      onShake();
      await wait(550);
      if (!alive) return;
      setStage(final + 1);
      if (res.gold > 0) sfx('coin');
      await wait(650);
      if (alive) setStage(final + 2);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const full = offer?.type === 'consumable' && run.consumables.length >= cardSlots(run);
  const done = stage > final + 1;
  return (
    <div className="flex h-full flex-col items-center px-4 pt-5 pb-5 text-center" onClick={() => (skip.current = true)}>
      <div className="run-label">
        {res.won ? 'Room cleared' : 'Room failed'} · {res.kind === 'boss' ? bossMod(run.bossId).name : MODIFIERS[res.modifier].name}
        {res.elite ? ' · Elite' : ''}
      </div>
      <div className="run-title mt-0.5 text-2xl font-black">{res.gamble ? 'The Gamble' : ROOM_NAME[res.kind]}</div>
      <div className="run-sans text-xs text-[var(--ink-dim)]">{res.reason}</div>

      <div className="mt-4 flex items-center gap-3">
        <div className="run-panel flex min-w-26 flex-col items-center gap-0.5 px-3 py-2" style={{ boxShadow: '0 0 30px rgba(79,179,255,.25)' }}>
          <span className="run-label text-[var(--chip)]!">Chips</span>
          <PixelNum value={chips} size={4.5} color="var(--chip)" />
          {chipFires > 0 && <span className="run-sans text-[10px] text-[var(--ink-dim)]">incl. +{chipFires} Siege Engine</span>}
        </div>
        <PixelNum value="×" size={3.5} color="var(--ink-dim)" glow={false} />
        <div key={stage} className={`run-panel flex min-w-22 flex-col items-center gap-0.5 px-3 py-2 ${stage > 0 && stage < final ? 'run-pulse' : ''}`} style={{ boxShadow: '0 0 30px rgba(255,93,108,.25)' }}>
          <span className="run-label text-[var(--mult)]!">Mult</span>
          <PixelNum value={mult} size={4.5} color="var(--mult)" />
        </div>
      </div>

      <div className="mt-2 flex h-10 items-center justify-center">
        {flash && (
          <div key={stage} className={`run-slam flex items-center gap-2 rounded-xl px-3 py-1 ring-1 ${flash.xmult ? 'bg-[var(--mult)]/25 ring-[var(--mult)]' : 'bg-black/40 ring-[var(--gold-dim)]'}`}>
            {icon(flash)}
            <span className="run-title font-bold">{name(flash)}</span>
            {flash.xmult ? (
              <span className="run-title text-xl font-black text-white" style={{ textShadow: '0 0 12px var(--mult)' }}>
                ×{flash.xmult}
              </span>
            ) : (
              <span className="run-sans font-black text-[var(--mult)]">+{flash.mult}</span>
            )}
          </div>
        )}
      </div>

      <div className="h-16">
        {stage >= final && (
          <div className="run-slam flex flex-col items-center">
            <span className="run-label">Score</span>
            <PixelNum value={res.score} size={7} />
          </div>
        )}
      </div>

      {stage > final && (
        <div className="run-fadeup mt-1 flex flex-col items-center gap-1">
          {res.won && res.gold > 0 && <CoinRain n={Math.min(res.gold, 20)} />}
          <div className="relative flex items-center gap-2 text-[var(--gold)]">
            <Sprite name="coin" size={22} px={10} stroke={5} />
            <span className="run-title text-2xl font-black">+{res.gold} gold</span>
            {blind && (
              <span className="run-stamp run-sans absolute -top-3 -right-24 rotate-[-10deg] px-1.5 py-0.5 text-[11px] font-black text-[#5ee59a] uppercase">
                Blind beaten ×{T.gold.blindGoldMult}
              </span>
            )}
          </div>
          {res.won && !res.gamble ? (
            <div className="run-sans text-[11px] text-[var(--ink-dim)]">
              {res.score} ÷ {T.gold.goldRate} = {parts.base}g{blind ? ` · blind ×${T.gold.blindGoldMult}` : ` · blind ${res.target} missed`}
              {res.clean ? ` · clean +${T.gold.cleanBonus}` : ''}
              {parts.capped ? ' · soft cap' : ''}
              {gilded ? ` · gilded ×${T.modifiers.gilded.goldMult}` : ''}
            </div>
          ) : !res.won ? (
            <div className="run-sans text-[11px] text-[var(--ink-dim)]">Failed rooms pay no gold.</div>
          ) : null}
          {otherFires.map((f, i) => (
            <div key={i} className="run-sans text-xs text-[var(--ink-dim)]">
              {name(f)}: {f.composure ? `+${f.composure} Composure` : f.gold ? `+${f.gold} gold` : ''}
            </div>
          ))}
          {!res.won && res.kind !== 'boss' && res.composureLost > 0 && (
            <div className="run-sans text-xs text-[var(--blood)]">−{res.composureLost} Composure in this room</div>
          )}
        </div>
      )}

      {done && offer && (
        <div className="run-fadeup mt-3 w-full">
          <div className="run-label">{offer.title}</div>
          {full && <div className="run-sans text-xs text-[var(--blood)]">Your hands are full — skip, or use a card first.</div>}
          <div className="mt-2 flex justify-center gap-2">
            {offer.ids.map((id, i) => (
              <TarotCard
                key={id + i}
                info={offer.type === 'relic' ? RELICS[id as RelicId] : CONSUMABLES[id as ConsumableId]}
                kind={offer.type}
                w={96}
                selected={sel === id}
                onClick={full ? undefined : () => (setSel(id), sfx('card'))}
                className="run-deal"
                style={{ animationDelay: `${i * 90}ms` }}
              />
            ))}
          </div>
        </div>
      )}

      <div className="mt-auto flex w-full max-w-xs gap-2 pt-3">
        {offer && done ? (
          <>
            <button className="run-btn ghost flex-1" onClick={() => s.pickReward(null)}>
              Skip
            </button>
            <button className="run-btn flex-1" disabled={!sel} onClick={() => s.pickReward(sel)}>
              Take it
            </button>
          </>
        ) : (
          <button className="run-btn w-full" disabled={!done} onClick={() => s.afterTally()}>
            {res.kind === 'boss' ? 'Debrief' : 'Continue'}
          </button>
        )}
      </div>
    </div>
  );
}
