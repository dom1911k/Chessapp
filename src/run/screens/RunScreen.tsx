// Run mode tab (experimental). Everything here lives in src/run and can be deleted as a folder.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { opponentById, portrait } from '../../lib/people';
import { CONSUMABLES, MODIFIERS, RELICS, ROOM_NAME, objective } from '../content';
import { maxConsumables, price, restPrice } from '../rules';
import { useRun } from '../store';
import { TUNING as T } from '../tuning';
import type { ConsumableId, MapNode, RelicId, RoomKind } from '../types';
import { Composure, Glyph, PixelNum, TarotCard } from './bits';
import { Debrief } from './Debrief';
import { DevPanel } from './DevPanel';
import { RoomView } from './RoomView';
import { TallyView } from './TallyView';
import { useLongPress } from './useLongPress';
import './run.css';

export function RunScreen() {
  const s = useRun();
  const [dev, setDev] = useState(false);
  const shaker = useRef<HTMLDivElement>(null);
  useEffect(() => void s.load(), [s]);
  const run = s.run;
  const inRoom = run?.phase === 'room' && !!run.room;
  const openDev = () => setDev(true);
  // Screen shake without remounting anything.
  const shake = () => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    shaker.current?.animate(
      [
        { transform: 'translate(0,0)' },
        { transform: 'translate(-9px,5px) rotate(-0.6deg)' },
        { transform: 'translate(8px,-6px) rotate(0.5deg)' },
        { transform: 'translate(-6px,3px)' },
        { transform: 'translate(5px,-2px)' },
        { transform: 'translate(0,0)' },
      ],
      { duration: 450, easing: 'ease-out' },
    );
  };

  let body;
  if (!s.loaded) body = null;
  else if (!run) body = <Home onDev={openDev} />;
  else if (run.phase === 'start') body = <Pick title="Choose your first relic" onDev={openDev} />;
  else if (run.phase === 'reward') body = <Pick title={run.offer?.title ?? 'Spoils'} onDev={openDev} skip />;
  else if (run.phase === 'map') body = <MapView onDev={openDev} />;
  else if (run.phase === 'intro') body = <Intro />;
  else if (inRoom) body = <RoomView onDev={openDev} />;
  else if (run.phase === 'tally') body = <TallyView onShake={shake} />;
  else if (run.phase === 'curse') body = <Curse />;
  else if (run.phase === 'camp') body = <Camp onDev={openDev} />;
  else if (run.phase === 'debrief') body = <Debrief onShake={shake} />;

  // In a room (and its tally/debrief) the run takes the whole screen, over the tab bar.
  const full = inRoom || run?.phase === 'tally' || run?.phase === 'debrief';
  const view = (
    <div className={`run-root ${full ? 'fixed inset-0 z-40' : 'relative h-full'} overflow-hidden`}>
      <div ref={shaker} className={`h-full ${inRoom ? '' : 'safe-top'} ${full ? 'safe-bottom' : ''}`}>
        {body}
      </div>
      <div className="run-crt" />
      {dev && <DevPanel onClose={() => setDev(false)} />}
    </div>
  );
  return full ? createPortal(view, document.body) : view;
}

function Logo({ onDev }: { onDev: () => void }) {
  const lp = useLongPress(onDev);
  return (
    <div {...lp} className="select-none text-center">
      <div className="run-label">Experimental · Act I demo</div>
      <div className="run-title text-4xl font-black tracking-wide">The Gambit</div>
    </div>
  );
}

function Home({ onDev }: { onDev: () => void }) {
  const s = useRun();
  return (
    <div className="flex h-full flex-col items-center px-6 pt-10 pb-6 text-center">
      <Logo onDev={onDev} />
      <div className="mt-8 flex gap-2">
        {(['moon', 'eye', 'fork'] as const).map((g, i) => (
          <div key={g} className="tarot run-deal" style={{ width: 82, height: 132, ['--r' as string]: `${(i - 1) * 6}deg`, animationDelay: `${i * 90}ms`, transform: `rotate(${(i - 1) * 6}deg)` }}>
            <div className="tarot-inner justify-center text-[var(--gold-2)]">
              <Glyph name={g} size={44} />
            </div>
          </div>
        ))}
      </div>
      <p className="run-sans mt-8 max-w-xs text-sm leading-relaxed text-[var(--ink-dim)]">
        Three short rooms and a rival. Mistakes cost Composure; good moves earn chips. Relics multiply your score. Normal chess, always.
      </p>
      <p className="run-sans mt-2 max-w-xs text-xs text-[var(--ink-dim)]/80">Pause any time — your run waits for you. Nothing here affects your rating, XP or reviews.</p>
      <button className="run-btn mt-auto w-full max-w-xs text-lg" onClick={() => void s.newRun()}>
        Begin a run
      </button>
    </div>
  );
}

function TopBar({ onDev }: { onDev?: () => void }) {
  const run = useRun((x) => x.run!);
  const lp = useLongPress(onDev ?? (() => {}));
  return (
    <div className="flex items-center justify-between px-4 pt-2">
      <div {...lp} className="select-none">
        <div className="run-label">Act I</div>
        <div className="run-title text-lg font-bold">The Gambit</div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <Composure value={run.composure} max={T.composure.start} />
        <div className="flex items-center gap-1.5">
          <span className="text-[var(--gold)]"><Glyph name="coin" size={16} /></span>
          <PixelNum value={run.gold} size={3} />
        </div>
      </div>
    </div>
  );
}

function Inventory() {
  const run = useRun((x) => x.run!);
  return (
    <div className="px-4">
      <div className="run-label mb-1">Relics</div>
      <div className="flex flex-wrap gap-1.5">
        {run.relics.map((id) => (
          <span key={id} className="run-sans flex items-center gap-1 rounded-lg bg-black/35 py-0.5 pr-2 pl-1 text-xs ring-1 ring-[var(--gold-dim)]">
            <span className="text-[var(--gold)]"><Glyph name={RELICS[id].glyph} size={18} /></span>
            {RELICS[id].name}
          </span>
        ))}
      </div>
      <div className="run-label mt-2 mb-1">Cards ({run.consumables.length}/{maxConsumables(run.relics)})</div>
      <div className="flex flex-wrap gap-1.5">
        {run.consumables.length === 0 && <span className="run-sans text-xs text-[var(--ink-dim)]">none</span>}
        {run.consumables.map((id, i) => (
          <span key={i} className="run-sans flex items-center gap-1 rounded-lg bg-black/35 py-0.5 pr-2 pl-1 text-xs ring-1 ring-[var(--gold-dim)]">
            <span className="text-[var(--gold)]"><Glyph name={CONSUMABLES[id].glyph} size={18} /></span>
            {CONSUMABLES[id].name}
          </span>
        ))}
      </div>
    </div>
  );
}

/** 1-of-3 choice: the starting relic, or spoils after a cleared room. */
function Pick({ title, onDev, skip }: { title: string; onDev: () => void; skip?: boolean }) {
  const s = useRun();
  const run = s.run!;
  const offer = run.offer!;
  const [sel, setSel] = useState<string | null>(null);
  const full = offer.type === 'consumable' && run.consumables.length >= maxConsumables(run.relics);
  const choose = () => (run.phase === 'start' ? s.pickStartRelic(sel as RelicId) : s.pickReward(sel));
  return (
    <div className="flex h-full flex-col pb-5">
      {run.phase === 'start' ? <div className="pt-6"><Logo onDev={onDev} /></div> : <TopBar onDev={onDev} />}
      <div className="run-title mt-6 text-center text-2xl font-bold">{title}</div>
      {full && <div className="run-sans mt-1 text-center text-xs text-[var(--blood)]">Your hands are full — skip, or use a card first.</div>}
      <div className="mt-6 flex justify-center gap-2 px-2">
        {offer.ids.map((id, i) => (
          <TarotCard
            key={id + i}
            info={offer.type === 'relic' ? RELICS[id as RelicId] : CONSUMABLES[id as ConsumableId]}
            kind={offer.type}
            selected={sel === id}
            onClick={full ? undefined : () => setSel(id)}
            className="run-deal"
            style={{ animationDelay: `${i * 110}ms`, ['--r' as string]: `${(i - 1) * 5}deg` }}
          />
        ))}
      </div>
      <div className="mt-auto flex gap-2 px-4">
        {skip && (
          <button className="run-btn ghost flex-1" onClick={() => s.pickReward(null)}>
            Skip
          </button>
        )}
        <button className="run-btn flex-1" disabled={!sel} onClick={choose}>
          Take it
        </button>
      </div>
    </div>
  );
}

const KIND_GLYPH: Record<RoomKind, string> = { puzzle: 'cards', convert: 'fang', hold: 'tower', boss: 'skull' };

function MapView({ onDev }: { onDev: () => void }) {
  const s = useRun();
  const run = s.run!;
  const boss = opponentById(run.bossId);
  return (
    <div className="flex h-full flex-col pb-4">
      <TopBar onDev={onDev} />
      <div className="mt-2 flex-1 overflow-y-auto px-4">
        <div className="flex flex-col-reverse items-center gap-1">
          {run.layers.map((layer, li) => {
            const current = li === run.layer;
            const past = li < run.layer;
            return (
              <div key={li} className="flex w-full flex-col items-center">
                <div className={`flex w-full justify-center gap-3 ${!current && !past ? 'opacity-55' : ''}`}>
                  {layer.map((node, ni) => {
                    const chosen = run.path[li] === ni;
                    const res = past && chosen ? run.results.find((r) => r.layer === li) : undefined;
                    return (
                      <button
                        key={ni}
                        disabled={!current}
                        onClick={() => s.chooseNode(ni)}
                        className={`tarot ${node.kind === 'boss' ? 'relic' : ''} ${current ? 'run-deal' : ''} ${past && !chosen ? 'opacity-30' : ''}`}
                        style={{ width: layer.length > 1 ? 150 : 170, height: 96, animationDelay: `${ni * 100}ms` }}
                      >
                        <div className="tarot-inner flex-row! items-center gap-2 px-2 text-left">
                          {node.kind === 'boss' && boss ? (
                            <img src={portrait(boss.id)} alt="" className="h-12 w-12 rounded-lg object-cover ring-1 ring-[var(--gold)]" />
                          ) : (
                            <span className="text-[var(--gold-2)]"><Glyph name={KIND_GLYPH[node.kind]} size={34} /></span>
                          )}
                          <span className="min-w-0">
                            <span className="run-title block text-[15px] leading-tight font-bold">{node.kind === 'boss' ? boss?.name : ROOM_NAME[node.kind]}</span>
                            <span className="run-sans block text-[10px] text-[var(--ink-dim)]">{node.kind === 'boss' ? 'The Rival · Pickpocket' : kindBlurb(node)}</span>
                            <span className="run-sans block text-[10px] font-bold text-[var(--gold)]">{MODIFIERS[node.modifier].name}</span>
                            {res && <span className={`run-sans block text-[10px] font-bold ${res.won ? 'text-[#5ee59a]' : 'text-[var(--blood)]'}`}>{res.won ? `✓ ${res.score}` : '✕ failed'}</span>}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {li > 0 && <div className="h-4 w-px bg-[var(--gold-dim)]/60" />}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-2">
        <Inventory />
      </div>
      <div className="run-sans mt-2 px-4 text-center text-xs text-[var(--ink-dim)]">{run.layers[run.layer]?.length > 1 ? 'Choose your path.' : 'Tap the room to enter.'}</div>
    </div>
  );
}

function kindBlurb(n: MapNode) {
  if (n.kind === 'puzzle') return `${T.rooms.puzzle.count} puzzles`;
  if (n.kind === 'convert') return n.goal === 'keep' ? 'Winning: keep it' : 'Winning: cash in';
  if (n.kind === 'hold') return 'Worse: survive';
  return '';
}

function Intro() {
  const s = useRun();
  const run = s.run!;
  const node = run.layers[run.layer][run.path[run.layer] ?? 0];
  const boss = node.kind === 'boss' ? opponentById(run.bossId) : undefined;
  const elo = boss ? boss.elo + (run.cursed ? T.curse.ratingBoost : 0) : undefined;
  return (
    <div className="flex h-full flex-col items-center px-6 pt-8 pb-6 text-center">
      <div className="run-label">Room {run.layer + 1} of 4</div>
      {boss ? (
        <>
          <img src={portrait(boss.id)} alt="" className="run-slam mt-4 h-28 w-28 rounded-2xl object-cover ring-2 ring-[var(--gold)]" style={{ boxShadow: '0 0 40px rgba(226,71,90,.5)' }} />
          <div className="run-title mt-3 text-3xl font-black">{boss.name}</div>
          <div className="run-sans text-sm text-[var(--ink-dim)]">
            {boss.tagline} · plays like ~{elo}
          </div>
        </>
      ) : (
        <>
          <div className="run-slam mt-6 text-[var(--gold-2)] glow-gold">
            <Glyph name={KIND_GLYPH[node.kind]} size={88} />
          </div>
          <div className="run-title mt-2 text-3xl font-black">{ROOM_NAME[node.kind]}</div>
        </>
      )}
      <div className="run-panel run-fadeup mt-6 w-full max-w-sm p-4 text-left">
        <div className="run-label">Objective</div>
        <div className="run-sans mt-1 text-[15px] font-semibold">{objective(node.kind, node.goal)}</div>
        <div className="run-label mt-3">Modifier · {MODIFIERS[node.modifier].name}</div>
        <div className="run-sans mt-1 text-sm text-[var(--ink-dim)]">{MODIFIERS[node.modifier].text}</div>
        <div className="run-label mt-3">Composure</div>
        <div className="run-sans mt-1 text-sm text-[var(--ink-dim)]">
          Mistake −{T.composure.cost.mistake}, blunder −{T.composure.cost.blunder}, inaccuracy free.{node.kind !== 'boss' ? ` Failing the room: −${T.composure.failRoom}.` : ' Losing to the rival ends the run.'}
        </div>
      </div>
      <button className="run-btn mt-auto w-full max-w-xs text-lg" disabled={s.busy} onClick={() => void s.enterRoom()}>
        {s.busy ? 'Shuffling…' : 'Enter'}
      </button>
    </div>
  );
}

function Curse() {
  const s = useRun();
  const run = s.run!;
  const boss = opponentById(run.bossId);
  return (
    <div className="flex h-full flex-col items-center px-6 pt-10 pb-6 text-center">
      <div className="run-label">Before the rival</div>
      <div className="run-title mt-1 text-3xl font-black">A Deal Is Offered</div>
      <div className="tarot relic run-deal mt-8" style={{ width: 170, height: 260, boxShadow: '0 0 0 1px #e2475a, 0 0 40px rgba(226,71,90,.45)' }}>
        <div className="tarot-inner justify-center gap-3 px-3">
          <div className="numeral text-sm text-[var(--blood)]!">XV</div>
          <span className="text-[var(--blood)]"><Glyph name="skull" size={70} /></span>
          <div className="run-title text-lg font-bold">The Devil's Bargain</div>
          <div className="run-sans text-xs text-[var(--ink-dim)]">
            {boss?.name ?? 'The rival'} plays +{T.curse.ratingBoost} stronger.
            <br />
            Your gold ×{T.curse.goldFactor} right now ({run.gold} → {Math.round(run.gold * T.curse.goldFactor)}).
          </div>
        </div>
      </div>
      <div className="run-sans mt-6 text-xs text-[var(--ink-dim)]">Entirely optional. The campfire shop is next.</div>
      <div className="mt-auto flex w-full max-w-xs gap-2">
        <button className="run-btn ghost flex-1" onClick={() => s.decideCurse(false)}>
          Refuse
        </button>
        <button className="run-btn danger flex-1" onClick={() => s.decideCurse(true)}>
          Accept
        </button>
      </div>
    </div>
  );
}

function Camp({ onDev }: { onDev: () => void }) {
  const s = useRun();
  const run = s.run!;
  const full = run.consumables.length >= maxConsumables(run.relics);
  const rp = restPrice(run.relics);
  const bossNext = run.layer === run.layers.length - 1;
  const fireRef = useRef<HTMLDivElement>(null);
  return (
    <div className="flex h-full flex-col pb-4">
      <TopBar onDev={onDev} />
      <div ref={fireRef} className="mt-2 flex flex-col items-center">
        <span className="run-flicker text-[#ffb454]" style={{ filter: 'drop-shadow(0 0 18px #ff9a3c)' }}>
          <Glyph name="flame" size={56} />
        </span>
        <div className="run-title text-2xl font-bold">The Campfire</div>
        <div className="run-sans text-xs text-[var(--ink-dim)]">{bossNext ? 'The rival waits beyond the fire.' : 'Rest a moment. Buy a card or two.'}</div>
      </div>
      <div className="mt-4 flex justify-center gap-2 px-2">
        {run.shopStock.map((id, i) => {
          const p = price(id, run.relics);
          const afford = run.gold >= p && !full;
          return (
            <TarotCard
              key={id + i}
              info={CONSUMABLES[id]}
              kind="consumable"
              w={110}
              onClick={afford ? () => s.buy(id) : undefined}
              className="run-deal"
              style={{ animationDelay: `${i * 90}ms`, opacity: afford ? 1 : 0.55 }}
              footer={
                <span className="run-sans flex items-center justify-center gap-1 text-xs font-black text-[var(--gold)]">
                  <Glyph name="coin" size={14} /> {p}
                </span>
              }
            />
          );
        })}
        {run.shopStock.length === 0 && <div className="run-sans py-10 text-sm text-[var(--ink-dim)]">Sold out.</div>}
      </div>
      {full && <div className="run-sans mt-2 text-center text-xs text-[var(--ink-dim)]">Hands full ({maxConsumables(run.relics)} cards max).</div>}
      <div className="mt-3 px-4">
        <button
          className="run-btn ghost w-full"
          disabled={run.restBought || run.gold < rp || run.composure >= T.composure.max}
          onClick={() => s.rest()}
        >
          Rest: +{T.shop.restComposure} Composure · {rp}g{run.restBought ? ' (done)' : ''}
        </button>
      </div>
      <div className="mt-3">
        <Inventory />
      </div>
      <div className="mt-auto px-4">
        <button className="run-btn w-full" onClick={() => s.leaveCamp()}>
          {bossNext ? 'Face the rival' : 'Onward'}
        </button>
      </div>
    </div>
  );
}
