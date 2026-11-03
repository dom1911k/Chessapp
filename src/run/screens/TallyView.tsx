// Score tally after a room: the room-end triggers play on the live Chips and Mult boxes, the boxes
// collide and the score slams in, the blind bar fills (stamp, fire), then gold coins rain into the
// gold counter, the material burst flies into the pouch and the next-purchase bar advances.
// When the room gives a free pick, its cards slide up underneath — one screen, not two.
import { useEffect, useMemo, useRef, useState } from 'react';
import { CONSUMABLES, MODIFIERS, RELICS, ROOM_NAME, rivalRule } from '../content';
import { cardSlots, goldParts, heatRules, fmtCp, fmtBig } from '../rules';
import { RunBoard } from '../pixel/RunBoard';
import { techById } from '../codex';
import type { BattlefieldResult } from '../types';
import { useRun } from '../store';
import { TUNING as T } from '../tuning';
import type { ConsumableId, Fire, RelicId } from '../types';
import { sfx, buzz } from '../sfx';
import { MaterialIcon, MaterialRow, NextPurchaseBar, PixelNum, TarotCard } from './bits';
import { nextPurchase, addMaterials, EMPTY_ORDER, MATERIAL_INFO } from '../order';
import { MILESTONES, milestoneSeals, useMeta } from '../meta';
import { Sprite } from '../pixel/sprites';
import { endChain, fireIntensity, slamShake } from '../crunch';
import { reducedMotion } from '../settings';
import { BlindBar, ScoreBoxes, ScoreFire, Sparks, Stream, useChainPlayer, usePace } from './Crunch';

export function TallyView({ onShake }: { onShake: (px?: number) => void }) {
  const s = useRun();
  const run = s.run!;
  const res = run.results[run.results.length - 1];
  const offer = run.offer;
  const name = (f: Fire) => (f.relic === 'rival' ? rivalRule(run).name : f.relic === 'fervor' ? 'Fervor' : f.relic === 'tech' ? techById(f.tech!).name : RELICS[f.relic].name);
  const fervorIn = res.fervorIn ?? 1;
  const otherFires = res.fires.filter((f) => !f.mult && !f.xmult && !f.chips && !f.gold);
  const blind = res.won && res.target > 0 && res.score >= res.target;
  const parts = goldParts(res.score, blind, !!res.clean);
  const gilded = res.won && res.modifier === 'gilded';
  const meta = useMeta();
  const order = meta.order ?? EMPTY_ORDER;
  const haveNow = addMaterials(meta.materials ?? {}, run.materials ?? {});
  const burst = res.material?.burst ?? 0;
  const haveBefore = res.material && burst > 0 ? addMaterials(haveNow, { [res.material.id]: -burst }) : haveNow;
  const npBefore = nextPurchase(order, haveBefore);
  const npAfter = nextPurchase(order, haveNow);
  const goldGain = res.gold + (res.mintGold ?? 0);
  const goldBefore = run.gold - goldGain - (res.battlefield?.gold ?? 0);
  const matId = res.material?.id;
  const matBefore = matId ? Math.floor(haveBefore[matId] ?? 0) : 0;
  const fire = fireIntensity(res.score, res.target);
  const milestones = MILESTONES.filter((x) => x.id.startsWith('room-') && (res.milestones ?? []).includes(x.id));

  const chain = useMemo(() => endChain(res), [res]);
  const pace = usePace();
  const player = useChainPlayer(chain.from, pace, { onShake });
  const scoreRef = useRef<HTMLDivElement>(null);
  const goldRef = useRef<HTMLSpanElement>(null);
  const pouchRef = useRef<HTMLSpanElement>(null);
  // Steps: chain → collide → score → bar → gold → material → next purchase → milestone → done.
  const STEPS = ['chain', 'collide', 'score', 'bar', 'gold', 'mat', 'np', 'milestone', 'done'] as const;
  const [step, setStep] = useState<(typeof STEPS)[number]>('chain');
  const at = (x: (typeof STEPS)[number]) => STEPS.indexOf(step) >= STEPS.indexOf(x);
  const [barScore, setBarScore] = useState(0);
  const [goldShown, setGoldShown] = useState(goldBefore);
  const [matShown, setMatShown] = useState(matBefore);
  const [streams, setStreams] = useState<{ gold?: number; mat?: number }>({});
  const [sel, setSel] = useState<string | null>(null);
  const streamDone = useRef<(() => void) | null>(null);

  useEffect(() => {
    let alive = true;
    const R = T.crunch.roomEnd;
    const C = T.crunch;
    const go = (x: (typeof STEPS)[number]) => alive && setStep(x);
    /** Wait for a particle stream (or a skip). */
    const stream = (key: 'gold' | 'mat', n: number, ms: number) => {
      if (pace.ctl.current.instant || n <= 0) return Promise.resolve();
      return new Promise<void>((done) => {
        streamDone.current = done;
        setStreams((x) => ({ ...x, [key]: n }));
        void pace.wait(ms * 4).then(done);
      });
    };
    void (async () => {
      await player.play(chain);
      if (!alive) return;
      pace.begin();
      // The boxes slide together and collide; the product slams in.
      go('collide');
      await pace.wait(R.slideMs);
      if (!alive) return;
      go('score');
      const px = slamShake(res.score);
      sfx('collide', px);
      buzz(Math.round(C.haptic.slam * px));
      if (!reducedMotion()) onShake(px);
      await pace.wait(420);
      // The blind bar fills (and overflows).
      go('bar');
      requestAnimationFrame(() => alive && setBarScore(res.score));
      await pace.wait(R.barMs);
      if (blind) sfx('stamp');
      if (fire > 0) sfx('ignite');
      await pace.wait(blind ? 300 : 120);
      // Gold coins rain into the gold counter.
      go('gold');
      if (goldGain > 0) await stream('gold', Math.min(R.coinMax, goldGain), 520 + Math.min(R.coinMax, goldGain) * R.coinStaggerMs);
      setGoldShown(goldBefore + goldGain);
      // The material burst flies into the pouch.
      go('mat');
      if (burst > 0) await stream('mat', Math.min(R.matMax, Math.ceil(burst)), 520 + Math.min(R.matMax, Math.ceil(burst)) * R.coinStaggerMs);
      if (matId) setMatShown(Math.floor(haveNow[matId] ?? 0));
      // The next purchase bar advances.
      go('np');
      if (npAfter?.ready && !npBefore?.ready) sfx('ready');
      await pace.wait(npAfter ? 500 : 0);
      if (milestones.length) {
        go('milestone');
        sfx('milestone');
        buzz([40, 40, 80]);
        await pace.wait(1100);
      }
      pace.end();
      go('done');
    })();
    return () => {
      alive = false;
      pace.finish();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const full = offer?.type === 'consumable' && run.consumables.length >= cardSlots(run);
  const done = step === 'done';
  const slide = at('collide') && !at('score') ? 1 : 0;
  return (
    <div className="flex h-full flex-col items-center overflow-y-auto px-4 pt-4 pb-5 text-center">
      {/* Counters the rewards fly into */}
      <div className="flex w-full items-center justify-between">
        <span ref={pouchRef} className="flex items-center gap-1">
          {matId && (
            <>
              <MaterialIcon id={matId} size={16} />
              <span key={matShown} className={`run-sans text-sm font-black tabular-nums ${matShown !== matBefore ? 'run-punch' : ''}`} style={{ color: MATERIAL_INFO[matId].color }}>
                {matShown}
              </span>
            </>
          )}
        </span>
        <span ref={goldRef} className="flex items-center gap-1">
          <Sprite name="coin" size={18} px={10} stroke={5} />
          <span key={goldShown} className={goldShown !== goldBefore ? 'run-punch' : ''}>
            <PixelNum value={goldShown} size={3} />
          </span>
        </span>
      </div>
      <div className="run-label mt-1">
        {res.won ? 'Room cleared' : 'Room failed'} · {res.kind === 'boss' ? rivalRule(run).name : MODIFIERS[res.modifier].name}
        {res.elite ? ' · Elite' : ''}
      </div>
      <div className="run-title mt-0.5 text-2xl font-black">{res.gamble ? 'The Gamble' : ROOM_NAME[res.kind]}</div>
      <div className="run-sans text-xs text-[var(--ink-dim)]">{res.reason}</div>
      {heatRules(run.heat).evalWordsOnly && res.evalEnd !== undefined && (
        <div className="run-sans text-xs font-bold text-[var(--gold-2)]">Final eval {fmtCp(res.evalEnd)}</div>
      )}

      {/* Chips × Mult, then they collide into the score */}
      <div className="relative mt-4 flex h-24 w-full items-center justify-center">
        {!at('score') ? (
          <ScoreBoxes p={player} size={4} slide={slide} />
        ) : (
          <div ref={scoreRef} className="relative flex flex-col items-center">
            <Sparks colors={['#4fb3ff', '#ff5d6c', '#fff6c8', '#e040fb']} />
            {at('bar') && <ScoreFire intensity={fire} />}
            <span className="run-label relative z-10">Score</span>
            <div className="run-slam relative z-10">
              <PixelNum value={res.score} big size={7} color={fire >= 3 ? '#ffd0f4' : fire > 0 ? '#fff0c0' : undefined} />
            </div>
            <span className="run-sans relative z-10 text-[10px] text-[var(--ink-dim)]">
              {fmtBig(res.chips)} chips × {res.mult} mult
            </span>
          </div>
        )}
      </div>

      <div className="relative mt-1 h-9 w-full max-w-xs">
        {at('bar') && res.target > 0 && <BlindBar score={barScore} target={res.target} animate />}
        {at('bar') && blind && (
          <span className="run-stamp run-sans absolute -top-8 right-0 rotate-[-10deg] px-1.5 py-0.5 text-[11px] font-black text-[#5ee59a] uppercase">
            Blind beaten ×{T.gold.blindGoldMult}
          </span>
        )}
      </div>

      {at('milestone') && milestones.length > 0 && (
        <div className="run-banner run-slam my-1 w-full py-2">
          <div className="run-label text-[#f5b8ff]!">Milestone</div>
          {milestones.map((x) => (
            <div key={x.id} className="flex items-center justify-center gap-2">
              <span className="run-title text-xl font-black text-white">{x.name}</span>
              <span className="run-sans flex items-center gap-1 text-sm font-black" style={{ color: MATERIAL_INFO.seals.color }}>
                <MaterialIcon id="seals" size={14} /> +{milestoneSeals(x)} Seal{milestoneSeals(x) === 1 ? '' : 's'}
              </span>
            </div>
          ))}
        </div>
      )}

      {at('gold') && (
        <div className="run-fadeup mt-1 flex flex-col items-center gap-1">
          <div className="flex items-center gap-2 text-[var(--gold)]">
            <Sprite name="coin" size={22} px={10} stroke={5} />
            <span className="run-title text-2xl font-black">+{res.gold} gold</span>
          </div>
          {res.won && !res.gamble ? (
            <div className="run-sans text-[11px] text-[var(--ink-dim)]">
              {T.gold.goldK}·log₂(1 + {fmtBig(res.score)} ÷ {T.gold.goldRate}) = {parts.base}g{blind ? ` · blind ×${T.gold.blindGoldMult}` : res.target > 0 ? ` · blind ${fmtBig(res.target)} missed` : ''}
              {res.clean ? ` · clean +${T.gold.cleanBonus}` : ''}
              {gilded ? ` · gilded ×${T.modifiers.gilded.goldMult}` : ''}
            </div>
          ) : !res.won ? (
            <div className="run-sans text-[11px] text-[var(--ink-dim)]">Failed rooms pay no gold.</div>
          ) : null}
          {otherFires.map((f, i) => (
            <div key={i} className="run-sans text-xs text-[var(--ink-dim)]">
              {name(f)}: {f.composure ? `+${f.composure} Composure` : ''}
            </div>
          ))}
          {at('mat') && (res.material || res.mintGold) && (
            <div className="run-sans flex items-center gap-2 text-xs">
              {res.material && <MaterialRow m={{ [res.material.id]: res.material.amount }} size={18} />}
              {res.material && (
                <span className="text-[var(--ink-dim)]">
                  {res.material.drip ? `${Math.round(res.material.drip * 10) / 10} from moves` : ''}
                  {res.material.burst ? ` + ${Math.round(res.material.burst * 10) / 10} burst` : ''}
                </span>
              )}
              {res.mintGold ? <span className="text-[var(--gold)]">· Mint +{res.mintGold}g</span> : null}
            </div>
          )}
          {at('mat') && res.fervor !== undefined && res.fervor !== fervorIn && (
            <div className="run-sans flex items-center gap-1 text-xs font-bold" style={{ color: res.fervor > fervorIn ? '#ffb454' : 'var(--blood)' }}>
              Fervor {res.fervor > fervorIn ? 'rises' : 'breaks'}: ×{fervorIn} → ×{res.fervor}
            </div>
          )}
          {at('mat') && <NextPurchaseBar np={at('np') ? npAfter : npBefore} className="mt-1 max-w-xs" />}
          {done && res.battlefield && <BattlefieldReveal b={res.battlefield} />}
          {!res.won && res.kind !== 'boss' && res.composureLost > 0 && (
            <div className="run-sans text-xs text-[var(--blood)]">−{res.composureLost} Composure in this room</div>
          )}
        </div>
      )}

      {streams.gold ? (
        <Stream from={scoreRef} to={goldRef} n={streams.gold} color="#f2c75c" round onLand={(i) => (setGoldShown(goldBefore + Math.round((goldGain * (i + 1)) / streams.gold!)), sfx('coin'), buzz(T.crunch.haptic.chip))} onDone={() => (setStreams((x) => ({ ...x, gold: 0 })), streamDone.current?.())} />
      ) : null}
      {streams.mat && matId ? (
        <Stream from={scoreRef} to={pouchRef} n={streams.mat} color={MATERIAL_INFO[matId].color} onLand={(i) => (setMatShown(matBefore + Math.floor((burst * (i + 1)) / streams.mat!)), sfx('drip', i))} onDone={() => (setStreams((x) => ({ ...x, mat: 0 })), streamDone.current?.())} />
      ) : null}

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
          {sel && (
            <div className="run-sans mt-2 text-xs leading-snug">
              {(offer.type === 'relic' ? RELICS[sel as RelicId] : CONSUMABLES[sel as ConsumableId]).text}
            </div>
          )}
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
            {done ? (res.kind === 'boss' ? 'Debrief' : 'Continue') : 'Tap: faster · hold: skip'}
          </button>
        )}
      </div>
    </div>
  );
}

/** The rival's battlefield: all three evaluations revealed, and the judgement bonus. */
function BattlefieldReveal({ b }: { b: BattlefieldResult }) {
  const verdict = b.rank === 1 ? 'You picked the best battlefield!' : b.gold > 0 ? `Close — ${fmtCp(b.lossCp).replace('+', '')} behind the best.` : `The best one was ${fmtCp(b.lossCp).replace('+', '')} better for you.`;
  return (
    <div className="run-panel run-fadeup mt-2 w-full p-2">
      <div className="run-label">Your battlefield judgement</div>
      <div className="mt-1.5 grid grid-cols-3 gap-1.5">
        {b.fens.map((fen, i) => {
          const best = b.evals[i] === Math.max(...b.evals);
          return (
            <div key={i} className={`p-1 ${i === b.picked ? 'ring-2 ring-[var(--gold-2)]' : ''}`}>
              <div className="pointer-events-none">
                <RunBoard mini fen={fen} orientation={fen.split(' ')[1] === 'w' ? 'white' : 'black'} movable={null} showCoordinates={false} />
              </div>
              <div className={`run-sans mt-0.5 text-xs font-black ${best ? 'text-[#5ee59a]' : 'text-[var(--ink-dim)]'}`}>
                {fmtCp(b.evals[i])}
                {i === b.picked ? ' · yours' : ''}
              </div>
            </div>
          );
        })}
      </div>
      <div className="run-sans mt-1 text-xs">
        {verdict} {b.gold > 0 && <b className="text-[var(--gold)]">+{b.gold} gold</b>}
      </div>
    </div>
  );
}
