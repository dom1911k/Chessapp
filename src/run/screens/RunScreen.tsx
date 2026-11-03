// Run mode tab (experimental). Everything here lives in src/run and can be deleted as a folder.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Chess } from 'chess.js';
import { opponentById } from '../../lib/people';
import { uciToSan } from '../../lib/chess/game';
import { CONSUMABLES, EVENTS, HEAT_TEXT, MODIFIERS, RELICS, objective, rivalRule, bossModText } from '../content';
import { heatAllowed, heatFor, playStrength, isFinalCamp, cardSlots, cleansePrice, maxComposure, nextRestCost, pouchPrice, rerollPrice, shopPrice, stallPrice, stallExtraPrice } from '../rules';
import { bossFen, useRun } from '../store';
import { TUNING as T, type DiffId } from '../tuning';
import type { ConsumableId, RelicId } from '../types';
import { PixelPortrait, Sprite } from '../pixel/sprites';
import { BLOOD, EMBER, GOLD, JADE, SPIRIT, type SpritePalette } from '../pixel/pixelize';
import { RunBoard } from '../pixel/RunBoard';
import { runMusic, sfx } from '../sfx';
import { useRunSettings } from '../settings';
import { useMeta } from '../meta';
import { techById } from '../codex';
import { allRuns } from '../db';
import { getRating } from '../../lib/puzzles/rating';
import { getOpponentRecords } from '../../lib/people/record';
import { MapView } from './MapView';
import { HistoryScreen, SettingsSheet } from './Sanctum';
import { OrderScreen } from './Order';
import { PixelText } from './PixelText';
import { Composure, MaterialRow, PixelNum, TarotCard } from './bits';
import { Debrief } from './Debrief';
import { DevPanel } from './DevPanel';
import { RoomView } from './RoomView';
import { Finale } from './Finale';
import { Fire, Transition, Tutorial, tutorialSeen } from './scenes';
import { TallyView } from './TallyView';
import { useLongPress } from './useLongPress';
import './run.css';

export function RunScreen() {
  const s = useRun();
  const rs = useRunSettings();
  const [dev, setDev] = useState(false);
  const [tut, setTut] = useState(false);
  const [settings, setSettings] = useState(false);
  const [view, setView] = useState<'main' | 'sanctum' | 'history' | 'codex'>('main');
  const shaker = useRef<HTMLDivElement>(null);
  useEffect(() => void s.load(), [s]);
  useEffect(() => void useMeta.getState().load(), []);
  const run = s.run;
  // Music: the ambient drone on the map and menus; in a room its battle theme (the rival's own
  // theme in the boss room, a quieter one for puzzle rooms).
  const kind = run?.phase === 'room' ? run.room?.node.kind : undefined;
  const theme = run?.phase === 'battlefield' ? 'rival' : !kind ? 'map' : kind === 'boss' ? 'rival' : kind === 'puzzle' || kind === 'ward' || run?.room?.gamble ? 'riddle' : 'battle';
  useEffect(() => {
    const want = rs.music > 0 ? theme : null;
    runMusic(want);
    const vis = () => runMusic(document.visibilityState === 'visible' ? want : null);
    document.addEventListener('visibilitychange', vis);
    return () => document.removeEventListener('visibilitychange', vis);
  }, [rs.music, theme]);
  useEffect(() => () => runMusic(null), []);
  // First run: explain the basics once.
  useEffect(() => {
    if (run?.phase === 'start' && !tutorialSeen()) setTut(true);
  }, [run?.phase]);
  // Pixel transition between screens (a stone door when entering a room).
  const key = run ? `${run.phase}:${run.layer}:${view}` : `home:${view}`;
  const prevKey = useRef(key);
  const [trans, setTrans] = useState<{ id: number; kind: 'wipe' | 'door' } | null>(null);
  useEffect(() => {
    if (prevKey.current === key) return;
    const door = key.startsWith('room:') && prevKey.current.startsWith('map:');
    prevKey.current = key;
    if (!rs.reduceMotion) setTrans({ id: Date.now(), kind: door ? 'door' : 'wipe' });
  }, [key, rs.reduceMotion]);
  const inRoom = run?.phase === 'room' && !!run.room;
  const openDev = () => setDev(true);
  const tools: Tools = { onDev: openDev, onHelp: () => setTut(true), onSettings: () => setSettings(true) };
  // Screen shake without remounting anything.
  // `px` = the strongest offset (the old default was 9 px).
  const shake = (px = 9) => {
    if (rs.reduceMotion || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const k = px / 9;
    shaker.current?.animate(
      [
        { transform: 'translate(0,0)' },
        { transform: `translate(${-9 * k}px,${5 * k}px) rotate(${-0.6 * k}deg)` },
        { transform: `translate(${8 * k}px,${-6 * k}px) rotate(${0.5 * k}deg)` },
        { transform: `translate(${-6 * k}px,${3 * k}px)` },
        { transform: `translate(${5 * k}px,${-2 * k}px)` },
        { transform: 'translate(0,0)' },
      ],
      { duration: Math.round(200 + 250 * Math.min(1, k)), easing: 'ease-out' },
    );
  };

  let body;
  if (!s.loaded) body = null;
  else if (view === 'sanctum') body = <OrderScreen onBack={() => setView('main')} />;
  else if (view === 'codex') body = <OrderScreen start="codex" onBack={() => setView('main')} />;
  else if (view === 'history') body = <HistoryScreen onBack={() => setView('main')} />;
  else if (!run) body = <Home tools={tools} onSanctum={() => setView('sanctum')} onHistory={() => setView('history')} onCodex={() => setView('codex')} />;
  else if (run.phase === 'start') body = <Pick title="Choose your first relic" tools={tools} />;
  else if (run.phase === 'reward') body = <Pick title={run.offer?.title ?? 'Spoils'} tools={tools} skip />;
  else if (run.phase === 'map') body = <MapView top={<TopBar tools={tools} />} />;
  else if (inRoom) body = <RoomView onDev={openDev} onSettings={() => setSettings(true)} onShake={shake} />;
  else if (run.phase === 'event') body = <EventView tools={tools} />;
  else if (run.phase === 'tally') body = <TallyView onShake={shake} />;
  else if (run.phase === 'curse') body = <Curse />;
  else if (run.phase === 'battlefield') body = <Battlefield tools={tools} />;
  else if (run.phase === 'camp') body = <Camp tools={tools} />;
  else if (run.phase === 'debrief') body = !run.finaleSeen && !run.abandoned && run.finalScore !== undefined ? <Finale onShake={shake} /> : <Debrief onShake={shake} onSanctum={() => setView('sanctum')} />;

  // In a room (and its tally/debrief) the run takes the whole screen, over the tab bar.
  const full = view === 'main' && (inRoom || run?.phase === 'tally' || run?.phase === 'debrief');
  const viewEl = (
    <div className={`run-root ${full ? 'fixed inset-0 z-40' : 'relative h-full'} overflow-hidden ${rs.reduceMotion ? 'run-calm' : ''}`}>
      <div ref={shaker} className={`h-full ${inRoom && view === 'main' ? '' : 'safe-top'} ${full ? 'safe-bottom' : ''}`}>
        {body}
      </div>
      <div className={`run-crt crt-${rs.crt}`} />
      {trans && <Transition key={trans.id} kind={trans.kind} />}
      {/* Overlays go above the whole app (and its tab bar). */}
      {(tut || settings || dev) &&
        createPortal(
          <div className={`run-portal ${rs.reduceMotion ? 'run-calm' : ''}`}>
            {tut && <Tutorial onClose={() => setTut(false)} />}
            {settings && <SettingsSheet onClose={() => setSettings(false)} />}
            {dev && <DevPanel onClose={() => setDev(false)} />}
          </div>,
          document.body,
        )}
    </div>
  );
  return full ? createPortal(viewEl, document.body) : viewEl;
}

interface Tools {
  onDev: () => void;
  onHelp: () => void;
  onSettings: () => void;
}

function Logo({ onDev }: { onDev: () => void }) {
  const lp = useLongPress(onDev);
  return (
    <div {...lp} className="select-none text-center">
      <div className="run-label">Experimental · Act I</div>
      <PixelText text="The Gambit" size={5} className="mx-auto mt-1" />
    </div>
  );
}

function IconBtn({ sprite, label, onClick, pal = GOLD }: { sprite: string; label: string; onClick: () => void; pal?: SpritePalette }) {
  return (
    <button onClick={onClick} aria-label={label} className="flex h-9 w-9 items-center justify-center bg-black/40" style={{ boxShadow: '0 0 0 2px #1b0f22, inset 0 0 0 1px var(--gold-dim)' }}>
      <Sprite name={sprite} size={24} px={14} pal={pal} />
    </button>
  );
}

function Home({ tools, onSanctum, onHistory, onCodex }: { tools: Tools; onSanctum: () => void; onHistory: () => void; onCodex: () => void }) {
  const s = useRun();
  const mats = useMeta((m) => m.materials ?? {});
  return (
    <div className="flex h-full flex-col items-center px-6 pt-6 pb-6 text-center">
      <div className="flex w-full justify-end gap-2">
        <IconBtn sprite="help" label="How it works" onClick={tools.onHelp} />
        <IconBtn sprite="gear" label="Settings" onClick={tools.onSettings} />
      </div>
      <Logo onDev={tools.onDev} />
      <div className="relative mt-6 flex items-end justify-center gap-3">
        <PixelPortrait id="coach" size={84} />
        <Fire w={22} h={26} scale={4} logs />
        <PixelPortrait id="viktor" size={84} boss className="run-boss-glow" />
      </div>
      {s.notice && <div className="run-sans mt-3 max-w-xs rounded bg-[var(--blood)]/20 px-2 py-1 text-xs text-[#ffd0d6]">{s.notice}</div>}
      <p className="run-sans mt-5 max-w-xs text-sm leading-relaxed text-[var(--ink-dim)]">
        Short rooms, strange events and a rival at the end. Mistakes snuff out your candles; good moves earn chips. Relics multiply. Normal chess, always.
      </p>
      <div className="mt-auto flex w-full max-w-xs flex-col gap-2">
        <DifficultyPicker />
        <HeatPicker />
        <StrengthLine />
        <EquippedRow onCodex={onCodex} />
        <button className="run-btn w-full text-lg" onClick={() => void s.newRun()}>
          Begin a run
        </button>
        <div className="flex gap-2">
          <button className="run-btn ghost flex flex-1 items-center justify-center gap-1.5" onClick={onSanctum}>
            <Sprite name="tower" size={18} px={12} pal={GOLD} /> The Order
          </button>
          <button className="run-btn ghost flex flex-1 items-center justify-center gap-1.5" onClick={onHistory}>
            <Sprite name="scroll" size={18} px={12} /> History
          </button>
        </div>
        <MaterialRow m={mats} all size={13} className="justify-center" />
        
      </div>
    </div>
  );
}

const DIFFS: DiffId[] = ['apprentice', 'adept', 'master'];

/** Heat for the next run (Adept and Master; beat the rival to unlock the next level). */
function HeatPicker() {
  const diff = useRunSettings((x) => x.difficulty);
  const chosen = useRunSettings((x) => x.heat ?? 0);
  const setS = useRunSettings((x) => x.set);
  const unlocked = useMeta((m) => m.heatUnlocked ?? 0);
  if (!heatAllowed(diff)) return null;
  if (unlocked <= 0) return <div className="run-sans -mt-1 mb-1 text-left text-[11px] text-[var(--ink-dim)]">Beat the rival on {T.difficulty[diff].name} to unlock Heat.</div>;
  const h = heatFor(diff, chosen, unlocked);
  return (
    <div className="mb-1 text-left">
      <div className="run-label mb-1">Heat</div>
      <div className="flex gap-1">
        {Array.from({ length: unlocked + 1 }, (_, i) => (
          <button
            key={i}
            onClick={() => (setS({ heat: i }), sfx('card'))}
            className={`run-sans flex-1 py-1 text-sm font-black ${i === h ? 'text-[#ffb454]' : 'text-[var(--ink-dim)]'}`}
            style={{ background: i === h ? 'rgba(255,120,40,.16)' : 'rgba(0,0,0,.35)', boxShadow: `0 0 0 2px #1b0f22, inset 0 0 0 1px ${i === h ? '#ffb454' : 'var(--gold-dim)'}` }}
          >
            {i === 0 ? 'Off' : i}
          </button>
        ))}
      </div>
      <p className="run-sans mt-1 text-[11px] leading-snug text-[var(--ink-dim)]">
        {h === 0 ? 'No extra constraints.' : <>{HEAT_TEXT.slice(0, h).map((t, i) => <span key={i} className="block">{i + 1}. {t}</span>)}<span className="text-[#ff6bd5]">Win: +{T.order.seals.rivalWin + h * T.order.seals.perHeat} Seals.</span></>}
      </p>
    </div>
  );
}

/** Codex techniques equipped for the next run (tap to change). */
function EquippedRow({ onCodex }: { onCodex: () => void }) {
  const eq = useMeta((m) => m.equipped ?? []);
  const any = useMeta((m) => Object.values(m.codex ?? {}).some((x) => x?.learned));
  return (
    <button onClick={onCodex} className="run-sans -mt-0.5 mb-1 flex items-center justify-center gap-1.5 text-xs text-[var(--ink-dim)]">
      <Sprite name="scroll" size={14} px={10} pal={EMBER} />
      {!any ? 'Codex: learn your first technique →' : eq.length ? <>Techniques: <b className="text-[var(--gold-2)]">{eq.map((id) => techById(id).name).join(' · ')}</b> (change)</> : 'No techniques equipped (tap to choose)'}
    </button>
  );
}

/** "Run strength 1180 · +90 since Oct 31": how strong your opponents are now, against your first run. */
function StrengthLine() {
  const [line, setLine] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const [{ rating }, records, runs] = await Promise.all([getRating(), getOpponentRecords(), allRuns()]);
        const now = playStrength(rating, records);
        const first = runs.find((r) => r.strength !== undefined);
        let text = `Run strength ${now}`;
        if (first) {
          const d = now - first.strength!;
          const when = new Date(first.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
          text += ` · ${d >= 0 ? '+' : '−'}${Math.abs(d)} since ${when}`;
        }
        if (live) setLine(text);
      } catch {
        /* no data yet */
      }
    })();
    return () => void (live = false);
  }, []);
  if (!line) return null;
  return <div className="run-sans -mt-0.5 mb-1 text-center text-xs font-bold text-[var(--gold-2)]">{line}</div>;
}

/** Difficulty for the next run (remembered). */
function DifficultyPicker() {
  const diff = useRunSettings((x) => x.difficulty);
  const setS = useRunSettings((x) => x.set);
  const d = T.difficulty[diff];
  return (
    <div className="mb-1 text-left">
      <div className="run-label mb-1">Difficulty</div>
      <div className="flex gap-1.5">
        {DIFFS.map((id) => (
          <button
            key={id}
            onClick={() => {
              setS({ difficulty: id });
              sfx('card');
            }}
            className={`run-sans flex-1 py-1.5 text-sm font-bold ${id === diff ? 'text-[var(--gold-2)]' : 'text-[var(--ink-dim)]'}`}
            style={{ background: id === diff ? 'rgba(242,199,92,.14)' : 'rgba(0,0,0,.35)', boxShadow: `0 0 0 2px #1b0f22, inset 0 0 0 1px ${id === diff ? 'var(--gold-2)' : 'var(--gold-dim)'}` }}
          >
            {T.difficulty[id].name}
          </button>
        ))}
      </div>
      <p className="run-sans mt-1.5 min-h-[2.6em] text-xs leading-snug text-[var(--ink-dim)]">{d.blurb}</p>
    </div>
  );
}

function TopBar({ tools }: { tools: Tools }) {
  const run = useRun((x) => x.run!);
  const lp = useLongPress(tools.onDev);
  return (
    <div className="flex items-center justify-between gap-2 px-4 pt-2">
      <div {...lp} className="select-none">
        <div className="run-label">
          Act I · {T.difficulty[run.difficulty ?? 'adept'].name}
          {run.heat ? <span className="text-[#ffb454]"> · Heat {run.heat}</span> : null}
          {run.curses.length ? ' · Brittle' : ''}
        </div>
        <div className="run-title text-lg font-bold">The Gambit</div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex flex-col items-end gap-0.5">
          <Composure value={run.composure} max={T.composure.start} />
          <div className="flex items-center gap-1">
            <Sprite name="coin" size={16} px={10} stroke={5} />
            <PixelNum value={run.gold} size={3} />
          </div>
        </div>
        <IconBtn sprite="help" label="How it works" onClick={tools.onHelp} />
        <IconBtn sprite="gear" label="Settings" onClick={tools.onSettings} />
      </div>
    </div>
  );
}

const rarityPal = (id: RelicId) => (RELICS[id].rarity === 'rare' ? BLOOD : RELICS[id].rarity === 'uncommon' ? SPIRIT : GOLD);

function Inventory() {
  const run = useRun((x) => x.run!);
  const chip = 'run-sans flex items-center gap-1 bg-black/40 py-0.5 pr-2 pl-1 text-xs';
  const ring = { boxShadow: '0 0 0 1px #1b0f22, inset 0 0 0 1px var(--gold-dim)' };
  return (
    <div className="px-4">
      <div className="run-label mb-1">Relics</div>
      <div className="flex flex-wrap gap-1.5">
        {run.relics.map((id) => (
          <span key={id} className={chip} style={ring}>
            <Sprite name={RELICS[id].glyph} size={18} px={12} pal={rarityPal(id)} />
            {RELICS[id].name}
          </span>
        ))}
      </div>
      <div className="run-label mt-2 mb-1">Cards ({run.consumables.length}/{cardSlots(run)})</div>
      <div className="flex flex-wrap gap-1.5">
        {run.consumables.length === 0 && <span className="run-sans text-xs text-[var(--ink-dim)]">none</span>}
        {run.consumables.map((id, i) => (
          <span key={i} className={chip} style={ring}>
            <Sprite name={CONSUMABLES[id].glyph} size={18} px={12} pal={EMBER} />
            {CONSUMABLES[id].name}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Choose your battlefield: three rival positions, evals hidden; the tally reveals them. */
function Battlefield({ tools }: { tools: Tools }) {
  const s = useRun();
  const run = s.run!;
  const [sel, setSel] = useState<number | null>(null);
  const boss = opponentById(run.bossId);
  const rule = rivalRule(run);
  const node = run.layers[run.layer][run.path[run.layer] ?? 0];
  const opts = run.battlefield ?? [];
  return (
    <div className="flex h-full flex-col pb-5">
      <TopBar tools={tools} />
      <div className="mt-4 flex items-center gap-3 px-4">
        <PixelPortrait id={run.bossId} size={64} boss className="run-boss-glow" />
        <div className="min-w-0">
          <div className="run-label text-[var(--blood)]!">{rule.nemesis ? 'Nemesis · ' : ''}{rule.name}</div>
          <div className="run-title text-xl leading-tight font-black">Choose your battlefield</div>
          <div className="run-sans text-xs text-[var(--ink-dim)]">{boss?.name} lets you pick where to fight. Which one suits you best?</div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 px-3">
        {opts.map((j, i) => {
          const fen = bossFen(j);
          const side = fen.split(' ')[1] === 'w' ? 'white' : 'black';
          return (
            <button key={j} onClick={() => (setSel(i), sfx('card'))} className={`run-panel p-1.5 text-center ${sel === i ? 'ring-2 ring-[var(--gold-2)]' : ''}`}>
              {/* Display only: the board must not swallow the tap (touch drag handling). */}
              <div className="pointer-events-none">
                <RunBoard mini fen={fen} orientation={side} movable={null} showCoordinates={false} />
              </div>
              <div className="run-sans mt-1 text-[11px] font-bold">{['I', 'II', 'III'][i] ?? i + 1} · you play {side === 'white' ? 'White' : 'Black'}</div>
            </button>
          );
        })}
      </div>
      <div className="run-panel mx-4 mt-4 p-3">
        <div className="run-label">The goal (same everywhere)</div>
        <div className="run-sans mt-0.5 text-[13px] leading-snug">{objective(node, rule, run.difficulty, run.heat)}</div>
        <div className="run-sans mt-1 text-xs text-[var(--ink-dim)]">{bossModText(rule)}</div>
        <div className="run-sans mt-2 text-xs text-[#ffb454]">
          The evaluations stay hidden. After the fight: +{T.battlefield.bestPickGold}g if you picked the best one for you, +{T.battlefield.okPickGold}g if within {T.battlefield.okPickCp / 100} of it.
        </div>
      </div>
      <div className="mt-auto px-4">
        <button className="run-btn w-full" disabled={sel === null || s.busy} onClick={() => sel !== null && s.pickBattlefield(sel)}>
          {s.busy ? '…' : 'Fight here'}
        </button>
      </div>
    </div>
  );
}

/** 1-of-3 choice: the starting relic, or spoils after a cleared room. */
function Pick({ title, tools, skip }: { title: string; tools: Tools; skip?: boolean }) {
  const s = useRun();
  const run = s.run!;
  const offer = run.offer!;
  const [sel, setSel] = useState<string | null>(null);
  const full = offer.type === 'consumable' && run.consumables.length >= cardSlots(run);
  const cursedId = offer.type === 'relic' ? offer.cursed : undefined;
  const choose = () => (run.phase === 'start' ? s.pickStartRelic(sel as RelicId) : s.pickReward(sel));
  return (
    <div className="flex h-full flex-col pb-5">
      {run.phase === 'start' ? (
        <div className="pt-6">
          <Logo onDev={tools.onDev} />
        </div>
      ) : (
        <TopBar tools={tools} />
      )}
      <div className="mt-6 flex justify-center px-4">
        <PixelText text={title} size={2.5} maxWidth={340} />
      </div>
      {full && <div className="run-sans mt-1 text-center text-xs text-[var(--blood)]">Your hands are full — skip, or use a card first.</div>}
      <div className="mt-6 flex justify-center gap-2 px-2">
        {offer.ids.map((id, i) => (
          <div key={id + i} className="flex flex-col items-center">
            <TarotCard
              info={offer.type === 'relic' ? RELICS[id as RelicId] : CONSUMABLES[id as ConsumableId]}
              kind={offer.type}
              selected={sel === id}
              w={offer.ids.length > 3 ? 86 : undefined}
              onClick={full ? undefined : () => (setSel(id), sfx('card'))}
              className="run-deal"
              style={{ animationDelay: `${i * 110}ms`, ['--r' as string]: `${(i - (offer.ids.length - 1) / 2) * 5}deg` }}
            />
            {cursedId === id && <span className="run-sans mt-1.5 rounded bg-[#4a1020] px-1.5 text-[10px] font-black text-[#ffb3bd]">☠ CURSED</span>}
          </div>
        ))}
      </div>
      <div className="run-sans mx-4 mt-4 min-h-10 text-center text-sm leading-snug">
        {sel ? (
          <>
            <b className="text-[var(--gold-2)]">{(offer.type === 'relic' ? RELICS[sel as RelicId] : CONSUMABLES[sel as ConsumableId]).name}:</b>{' '}
            {(offer.type === 'relic' ? RELICS[sel as RelicId] : CONSUMABLES[sel as ConsumableId]).text}
            {cursedId === sel && <span className="text-[#ff8c9a]"> Comes with a curse: Brittle (mistakes cost +{T.curses.brittleMistakeExtra} candle; cleanse it at a campfire).</span>}
          </>
        ) : (
          <span className="text-[var(--ink-dim)]">Tap a card to read it.</span>
        )}
      </div>
      {offer.type === 'relic' && (
        <div className="run-sans mt-2 flex justify-center gap-3 text-[10px] text-[var(--ink-dim)]">
          <span>◆ common</span>
          <span className="text-[#6fd3ff]">◆ uncommon</span>
          <span className="text-[#ff6bd5]">◆ rare</span>
        </div>
      )}
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

function EventView({ tools }: { tools: Tools }) {
  const s = useRun();
  const run = s.run!;
  const ev = run.event;
  if (!ev) return null;
  const meta = EVENTS[ev.kind];
  return (
    <div className="flex h-full flex-col pb-5">
      <TopBar tools={tools} />
      <div className="mt-3 flex flex-col items-center px-5 text-center">
        <Sprite name={meta.sprite} size={72} px={18} pal={SPIRIT} className="run-slam" />
        <PixelText text={meta.name} size={3.5} className="mt-2" maxWidth={330} />
      </div>
      <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-4">
        {(ev.kind === 'shrine' || ev.kind === 'library') && <Shrine key={ev.fen} />}
        {ev.kind === 'spring' && (
          <div className="run-panel run-fadeup p-4 text-center">
            <p className="run-sans text-sm">
              Clear water in the dark. Drink, and <b className="text-[var(--gold-2)]">{T.events.springHeal} candles</b> relight — for{' '}
              <b className="text-[var(--gold-2)]">{T.events.springPrice} gold</b>. But the water is sharp: your next room is under <b className="text-[var(--blood)]">Razor Focus</b>{' '}
              ({MODIFIERS.focused.text})
            </p>
            <div className="mt-3 flex justify-center">
              <Composure value={run.composure} max={T.composure.start} />
            </div>
            <div className="mt-4 flex gap-2">
              <button className="run-btn ghost flex-1" onClick={() => s.leaveEvent()}>
                {ev.used ? 'Move on' : 'Leave'}
              </button>
              {!ev.used && (
                <button className="run-btn flex-1" disabled={run.gold < T.events.springPrice || run.composure >= maxComposure(run)} onClick={() => s.springBuy()}>
                  Drink · {T.events.springPrice}g
                </button>
              )}
            </div>
          </div>
        )}
        {ev.kind === 'gambler' && (
          <div className="run-panel run-fadeup p-4 text-center">
            <div className="flex justify-center">
              <PixelPortrait id="marcus" size={72} />
            </div>
            <p className="run-sans mt-2 text-sm">
              “One puzzle, friend. Solve it and I pay <b className="text-[var(--gold-2)]">{T.events.gambleWin} gold</b>. Miss, and it costs you <b className="text-[var(--blood)]">{T.events.gambleStake} candle</b>.”
            </p>
            <div className="mt-4 flex gap-2">
              <button className="run-btn ghost flex-1" onClick={() => s.leaveEvent()}>
                Walk away
              </button>
              <button className="run-btn flex-1" disabled={s.busy} onClick={() => void s.gamble()}>
                {s.busy ? 'Dealing…' : 'Deal me in'}
              </button>
            </div>
          </div>
        )}
        {ev.kind === 'merchant' && (
          <div className="run-fadeup">
            <p className="run-sans text-center text-sm text-[var(--ink-dim)]">“Fine relics, fair prices. Mostly fair.”</p>
            <div className="mt-3 flex justify-center gap-2">
              {ev.stock.map((it, i) => (
                <TarotCard
                  key={it.id}
                  info={RELICS[it.id]}
                  kind="relic"
                  w={120}
                  onClick={run.gold >= it.price ? () => s.merchantBuy(it.id) : undefined}
                  className="run-deal"
                  style={{ animationDelay: `${i * 100}ms`, opacity: run.gold >= it.price ? 1 : 0.55 }}
                  footer={
                    <span className="run-sans flex items-center justify-center gap-1 text-xs font-black text-[var(--gold)]">
                      <Sprite name="coin" size={14} px={10} stroke={5} /> {it.price}
                    </span>
                  }
                />
              ))}
              {ev.stock.length === 0 && <div className="run-sans py-8 text-sm text-[var(--ink-dim)]">Sold out.</div>}
            </div>
            <FullTexts ids={ev.stock.map((x) => x.id)} />
            <button className="run-btn mt-5 w-full" onClick={() => s.leaveEvent()}>
              Leave
            </button>
          </div>
        )}
        {ev.kind === 'altar' && (
          <div className="run-fadeup">
            <p className="run-sans text-center text-sm">
              Take one <span className="text-[#ff6bd5]">rare relic</span>. The altar takes something back: <b className="text-[var(--blood)]">Brittle</b> — for the rest of the run, mistakes cost {T.curses.brittleMistakeExtra} more candle.
            </p>
            <div className="mt-3 flex justify-center gap-2">
              {ev.ids.map((id, i) => (
                <TarotCard key={id} info={RELICS[id]} kind="relic" w={112} onClick={() => s.altarTake(id)} className="run-deal" style={{ animationDelay: `${i * 100}ms` }} />
              ))}
            </div>
            <FullTexts ids={ev.ids} />
            <button className="run-btn ghost mt-5 w-full" onClick={() => s.leaveEvent()}>
              Leave it be
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** The full description of each relic on offer (the cards only show a few words). */
function FullTexts({ ids }: { ids: RelicId[] }) {
  return (
    <div className="run-sans mt-3 space-y-1 text-xs leading-snug">
      {ids.map((id) => (
        <div key={id}>
          <b className="text-[var(--gold-2)]">{RELICS[id].name}:</b> <span className="text-[var(--ink-dim)]">{RELICS[id].text}</span>
        </div>
      ))}
    </div>
  );
}

const PIECE: Record<string, string> = { p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King' };

/** A move in plain words for beginners — without giving away checks or mates. */
function plainMove(fen: string, uci: string): string {
  try {
    const m = new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    if (m.isKingsideCastle()) return 'Castle on the king side (king to the right, rook jumps over)';
    if (m.isQueensideCastle()) return 'Castle on the queen side (king to the left, rook jumps over)';
    let t = `${PIECE[m.piece]} from ${m.from} to ${m.to}`;
    if (m.isEnPassant()) t += ', taking their pawn en passant';
    else if (m.captured) t += `, taking their ${PIECE[m.captured].toLowerCase()}`;
    if (m.promotion) t += ` and becoming a ${PIECE[m.promotion].toLowerCase()}`;
    return t;
  } catch {
    return uci;
  }
}

function Shrine() {
  const s = useRun();
  const ev = s.run!.event;
  const [sel, setSel] = useState<string | null>(null);
  if (ev?.kind !== 'shrine' && ev?.kind !== 'library') return null;
  const lib = ev.kind === 'library';
  const me = new Chess(ev.fen).turn();
  const right = ev.picked ? ev.answer.includes(ev.picked) : null;
  const arrows = ev.picked
    ? [{ from: ev.picked.slice(0, 2), to: ev.picked.slice(2, 4), tone: right ? ('good' as const) : ('bad' as const) }, ...(right ? [] : [{ from: ev.answer[0].slice(0, 2), to: ev.answer[0].slice(2, 4), tone: 'good' as const }])]
    : sel
      ? [{ from: sel.slice(0, 2), to: sel.slice(2, 4), tone: 'info' as const }]
      : [];
  return (
    <div className="run-fadeup">
      <div className="flex items-center gap-2">
        <PixelPortrait id="coach" size={48} />
        <p className="run-sans text-sm">
          {lib ? '“A tactic hides in this position. Which move finds it?”' : "“They're threatening something. Which move holds?”"}{' '}
          <span className="text-[var(--ink-dim)]">
            You play {me === 'w' ? 'White' : 'Black'}. Right answer: {lib ? 'a card' : 'a relic'}.
          </span>
        </p>
      </div>
      <div className="mx-auto mt-3 w-72">
        <RunBoard fen={ev.fen} orientation={me === 'w' ? 'white' : 'black'} movable={null} showCoordinates arrows={arrows} />
      </div>
      {!ev.picked && <div className="run-sans mt-2 text-center text-[11px] text-[var(--ink-dim)]">Tap a move to see it on the board, then lock it in.</div>}
      <div className="mt-2 flex flex-col gap-1.5">
        {ev.choices.map((u) => {
          const picked = ev.picked === u;
          const isAnswer = !!ev.picked && ev.answer.includes(u);
          const on = sel === u && !ev.picked;
          return (
            <button
              key={u}
              disabled={!!ev.picked}
              onClick={() => {
                setSel(u);
                sfx('card');
              }}
              className="run-sans flex items-center gap-2.5 bg-black/35 px-2.5 py-2 text-left disabled:opacity-100"
              style={{
                boxShadow: `0 0 0 2px #1b0f22, inset 0 0 0 ${on || picked || isAnswer ? 2 : 1}px ${
                  isAnswer ? '#5ee59a' : picked ? 'var(--blood)' : on ? '#6fd3ff' : 'var(--gold-dim)'
                }`,
                opacity: ev.picked && !picked && !isAnswer ? 0.5 : 1,
              }}
            >
              <span className="run-title w-14 shrink-0 text-lg font-black text-[var(--gold-2)]">{uciToSan(ev.fen, u).replace(/[+#]/g, '')}</span>
              <span className="text-[13px] leading-snug">{plainMove(ev.fen, u)}</span>
            </button>
          );
        })}
      </div>
      {!ev.picked && (
        <button className="run-btn mt-3 w-full" disabled={!sel} onClick={() => sel && s.shrinePick(sel)}>
          {sel ? 'Lock it in' : 'Choose a move'}
        </button>
      )}
      {ev.picked && (
        <div className="run-fadeup mt-3 text-center">
          <div className="run-title text-xl font-bold" style={{ color: right ? 'var(--gold-2)' : 'var(--blood)' }}>
            {right ? (lib ? 'Well read. Take a card.' : 'Sam nods. A gift awaits.') : 'Not quite — the green arrow was the move.'}
          </div>
          {!right && <div className="run-sans mt-1 text-sm text-[var(--ink-dim)]">{plainMove(ev.fen, ev.answer[0])}.</div>}
          <button className="run-btn mt-3 w-full" onClick={() => s.leaveEvent()}>
            {right ? 'Receive the gift' : 'Move on'}
          </button>
        </div>
      )}
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
      <PixelText text="A deal is offered" size={3} color="#ff8c9a" className="mt-2" maxWidth={330} />
      <div className="tarot relic run-deal mt-8" style={{ width: 170, height: 260, boxShadow: '0 0 0 1px #e2475a, 0 0 40px rgba(226,71,90,.45)' }}>
        <div className="tarot-inner justify-center gap-3 px-3">
          <div className="numeral text-sm text-[var(--blood)]!">XV</div>
          <PixelPortrait id={run.bossId} size={84} boss className="run-boss-glow" />
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

function Camp({ tools }: { tools: Tools }) {
  const s = useRun();
  const run = s.run!;
  const full = run.consumables.length >= cardSlots(run);
  const rp = nextRestCost(run);
  const rests = run.rests ?? 0;
  const bossNext = isFinalCamp(run);
  const stall = run.stall;
  return (
    <div className="flex h-full flex-col pb-4">
      <TopBar tools={tools} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mt-1 flex flex-col items-center">
          <div className="flex items-end gap-3">
            <PixelPortrait id="coach" size={48} />
            <Fire w={22} h={24} scale={3} logs />
            <Sprite name="bag" size={40} px={16} pal={JADE} />
          </div>
          <PixelText text="The Campfire" size={3} className="mt-1" />
          <div className="run-sans text-xs text-[var(--ink-dim)]">{bossNext ? 'The rival waits beyond the fire.' : 'Rest a moment. Spend what you carry.'}</div>
        </div>

        <div className="run-label mt-3 px-4">Cards · {run.consumables.length}/{cardSlots(run)} held</div>
        <div className="mt-1 flex justify-center gap-2 overflow-x-auto px-2">
          {run.shopStock.map((id, i) => {
            const p = shopPrice(run, id);
            const afford = run.gold >= p && !full;
            return (
              <TarotCard
                key={id + i}
                info={CONSUMABLES[id]}
                kind="consumable"
                w={run.shopStock.length > 3 ? 84 : 104}
                onClick={afford ? () => s.buy(id) : undefined}
                className="run-deal"
                style={{ animationDelay: `${i * 90}ms`, opacity: afford ? 1 : 0.55 }}
                footer={
                  <span className="run-sans flex items-center justify-center gap-1 text-xs font-black text-[var(--gold)]">
                    <Sprite name="coin" size={14} px={10} stroke={5} /> {p}
                  </span>
                }
              />
            );
          })}
          {run.shopStock.length === 0 && <div className="run-sans py-10 text-sm text-[var(--ink-dim)]">Sold out.</div>}
        </div>
        {full && <div className="run-sans mt-1 text-center text-xs text-[var(--ink-dim)]">Hands full — a Bigger Pouch holds one more.</div>}
        <div className="mt-2 flex gap-2 px-4">
          {run.meta?.boosts.reroll && !run.rerollUsed ? (
            <button className="run-btn ghost flex-1 py-2! text-sm" onClick={() => s.rerollShop()}>
              Second Look (free)
            </button>
          ) : (
            <button className="run-btn ghost flex-1 py-2! text-sm" disabled={run.gold < rerollPrice(run)} onClick={() => s.paidReroll()}>
              New cards · {rerollPrice(run)}g
            </button>
          )}
        </div>

        {(stall || run.stallExtra) && <div className="run-label mt-4 px-4">Relic stall{run.stallExtra ? ' · Patron' : ''}</div>}
        {([[stall, false], [run.stallExtra ?? null, true]] as [RelicId | null, boolean][]).map(([id, extra]) =>
          id ? (
            <div key={id} className="run-panel mx-4 mt-1 flex items-center gap-3 p-2.5">
              <Sprite name={RELICS[id].glyph} size={40} px={14} pal={rarityPal(id)} />
              <div className="min-w-0 flex-1">
                <div className="run-title text-[15px] leading-tight font-bold">
                  {RELICS[id].name} <span className="run-sans text-[10px] font-bold text-[var(--ink-dim)] uppercase">{RELICS[id].rarity}{extra ? ' · half price' : ''}</span>
                </div>
                <div className="run-sans text-xs leading-snug text-[var(--ink-dim)]">{RELICS[id].text}</div>
              </div>
              <button className="run-btn shrink-0 px-3! py-2! text-sm" disabled={run.gold < (extra ? stallExtraPrice(run, id) : stallPrice(run, id))} onClick={() => s.buyStall(extra)}>
                {extra ? stallExtraPrice(run, id) : stallPrice(run, id)}g
              </button>
            </div>
          ) : null,
        )}

        <div className="run-label mt-4 px-4">Services</div>
        <div className="mt-1 flex flex-col gap-1.5 px-4">
          <Service
            sprite="candle"
            title={`Rest · +${T.shop.restComposure} candle`}
            text={rests >= T.shop.restMax ? 'Rested enough for now.' : run.composure >= maxComposure(run) ? 'Your candles are full.' : `Each rest here costs more (${rests}/${T.shop.restMax}).`}
            price={rp}
            disabled={rests >= T.shop.restMax || run.gold < rp || run.composure >= maxComposure(run)}
            onClick={() => s.rest()}
          />
          <Service
            sprite="bag"
            title="Bigger Pouch"
            text={run.pouch ? 'Bought: one extra card slot for this run.' : 'Hold one more card for the rest of the run.'}
            price={pouchPrice(run)}
            disabled={!!run.pouch || run.gold < pouchPrice(run)}
            onClick={() => s.buyPouch()}
          />
          {run.curses.length > 0 && (
            <Service sprite="flame" title="Cleansing rite" text="Lift the altar's curse (Brittle)." price={cleansePrice(run)} disabled={run.gold < cleansePrice(run)} onClick={() => s.cleanse()} />
          )}
        </div>
        <div className="mt-3">
          <Inventory />
        </div>
      </div>
      <div className="px-4 pt-2">
        <button className="run-btn w-full" onClick={() => s.leaveCamp()}>
          {bossNext ? 'Face the rival' : 'Onward'}
        </button>
      </div>
    </div>
  );
}

function Service({ sprite, title, text, price, disabled, onClick }: { sprite: string; title: string; text: string; price: number; disabled: boolean; onClick: () => void }) {
  return (
    <div className="flex items-center gap-2.5 bg-black/30 p-2" style={{ boxShadow: '0 0 0 2px #1b0f22, inset 0 0 0 1px var(--gold-dim)' }}>
      <Sprite name={sprite} size={26} px={12} pal={EMBER} />
      <div className="min-w-0 flex-1">
        <div className="run-sans text-sm leading-tight font-bold">{title}</div>
        <div className="run-sans text-[11px] leading-snug text-[var(--ink-dim)]">{text}</div>
      </div>
      <button className="run-btn ghost shrink-0 px-3! py-1.5! text-sm" disabled={disabled} onClick={onClick}>
        {price}g
      </button>
    </div>
  );
}
