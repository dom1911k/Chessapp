// Run mode tab (experimental). Everything here lives in src/run and can be deleted as a folder.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Chess } from 'chess.js';
import { opponentById } from '../../lib/people';
import { uciToSan } from '../../lib/chess/game';
import { CONSUMABLES, EVENTS, MODIFIERS, RELICS, ROOM_NAME, ROOM_SPRITE, bossMod, bossModText, objective } from '../content';
import { maxConsumables, price, restPrice } from '../rules';
import { useRun } from '../store';
import { TUNING as T } from '../tuning';
import type { ConsumableId, MapNode, RelicId, RoomKind } from '../types';
import { PixelPortrait, Sprite, usePromise } from '../pixel/sprites';
import { BLOOD, EMBER, GOLD, JADE, SPIRIT, textureTile, type SpritePalette } from '../pixel/pixelize';
import { RunBoard } from '../pixel/RunBoard';
import { ambient, musicPref, setMusicPref, sfx } from '../sfx';
import { Composure, PixelNum, TarotCard } from './bits';
import { Debrief } from './Debrief';
import { DevPanel } from './DevPanel';
import { RoomView } from './RoomView';
import { Fire, Tutorial, tutorialSeen } from './scenes';
import { TallyView } from './TallyView';
import { useLongPress } from './useLongPress';
import './run.css';

export function RunScreen() {
  const s = useRun();
  const [dev, setDev] = useState(false);
  const [tut, setTut] = useState(false);
  const [music, setMusic] = useState(musicPref);
  const shaker = useRef<HTMLDivElement>(null);
  useEffect(() => void s.load(), [s]);
  // Ambient music while the tab is open (and the app's sound is on).
  useEffect(() => {
    ambient(music);
    const vis = () => ambient(music && document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', vis);
    return () => {
      document.removeEventListener('visibilitychange', vis);
      ambient(false);
    };
  }, [music]);
  const run = s.run;
  // First run: explain the basics once.
  useEffect(() => {
    if (run?.phase === 'start' && !tutorialSeen()) setTut(true);
  }, [run?.phase]);
  const inRoom = run?.phase === 'room' && !!run.room;
  const openDev = () => setDev(true);
  const toggleMusic = () => {
    setMusicPref(!music);
    setMusic(!music);
  };
  const tools: Tools = { onDev: openDev, onHelp: () => setTut(true), music, onMusic: toggleMusic };
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
  else if (!run) body = <Home {...tools} />;
  else if (run.phase === 'start') body = <Pick title="Choose your first relic" tools={tools} />;
  else if (run.phase === 'reward') body = <Pick title={run.offer?.title ?? 'Spoils'} tools={tools} skip />;
  else if (run.phase === 'map') body = <MapView tools={tools} />;
  else if (run.phase === 'intro') body = <Intro />;
  else if (inRoom) body = <RoomView onDev={openDev} />;
  else if (run.phase === 'event') body = <EventView tools={tools} />;
  else if (run.phase === 'tally') body = <TallyView onShake={shake} />;
  else if (run.phase === 'curse') body = <Curse />;
  else if (run.phase === 'camp') body = <Camp tools={tools} />;
  else if (run.phase === 'debrief') body = <Debrief onShake={shake} />;

  // In a room (and its tally/debrief) the run takes the whole screen, over the tab bar.
  const full = inRoom || run?.phase === 'tally' || run?.phase === 'debrief';
  const view = (
    <div className={`run-root ${full ? 'fixed inset-0 z-40' : 'relative h-full'} overflow-hidden`}>
      <div ref={shaker} className={`h-full ${inRoom ? '' : 'safe-top'} ${full ? 'safe-bottom' : ''}`}>
        {body}
      </div>
      <div className="run-crt" />
      {tut && <Tutorial onClose={() => setTut(false)} />}
      {dev && <DevPanel onClose={() => setDev(false)} />}
    </div>
  );
  return full ? createPortal(view, document.body) : view;
}

interface Tools {
  onDev: () => void;
  onHelp: () => void;
  music: boolean;
  onMusic: () => void;
}

function Logo({ onDev }: { onDev: () => void }) {
  const lp = useLongPress(onDev);
  return (
    <div {...lp} className="select-none text-center">
      <div className="run-label">Experimental · Act I</div>
      <div className="run-title text-4xl font-black tracking-wide">The Gambit</div>
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

function Home(tools: Tools) {
  const s = useRun();
  return (
    <div className="flex h-full flex-col items-center px-6 pt-6 pb-6 text-center">
      <div className="flex w-full justify-end gap-2">
        <IconBtn sprite="help" label="How it works" onClick={tools.onHelp} />
        <IconBtn sprite={tools.music ? 'music' : 'mute'} label="Music" onClick={tools.onMusic} />
      </div>
      <Logo onDev={tools.onDev} />
      <div className="relative mt-6 flex items-end justify-center gap-3">
        <PixelPortrait id="coach" size={84} />
        <Fire w={22} h={26} scale={4} logs />
        <PixelPortrait id="viktor" size={84} boss className="run-boss-glow" />
      </div>
      <p className="run-sans mt-6 max-w-xs text-sm leading-relaxed text-[var(--ink-dim)]">
        Short rooms, strange events and a rival at the end. Mistakes snuff out your candles; good moves earn chips. Relics multiply. Normal chess, always.
      </p>
      <p className="run-sans mt-2 max-w-xs text-xs text-[var(--ink-dim)]/80">Pause any time — your run waits for you. Nothing here affects your rating, XP or reviews.</p>
      <button className="run-btn mt-auto w-full max-w-xs text-lg" onClick={() => void s.newRun()}>
        Begin a run
      </button>
    </div>
  );
}

function TopBar({ tools }: { tools: Tools }) {
  const run = useRun((x) => x.run!);
  const lp = useLongPress(tools.onDev);
  return (
    <div className="flex items-center justify-between gap-2 px-4 pt-2">
      <div {...lp} className="select-none">
        <div className="run-label">Act I{run.curses.length ? ' · Brittle' : ''}</div>
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
        <IconBtn sprite={tools.music ? 'music' : 'mute'} label="Music" onClick={tools.onMusic} />
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
      <div className="run-label mt-2 mb-1">Cards ({run.consumables.length}/{maxConsumables(run.relics)})</div>
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

/** 1-of-3 choice: the starting relic, or spoils after a cleared room. */
function Pick({ title, tools, skip }: { title: string; tools: Tools; skip?: boolean }) {
  const s = useRun();
  const run = s.run!;
  const offer = run.offer!;
  const [sel, setSel] = useState<string | null>(null);
  const full = offer.type === 'consumable' && run.consumables.length >= maxConsumables(run.relics);
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
      <div className="run-title mt-6 text-center text-2xl font-bold">{title}</div>
      {full && <div className="run-sans mt-1 text-center text-xs text-[var(--blood)]">Your hands are full — skip, or use a card first.</div>}
      <div className="mt-6 flex justify-center gap-2 px-2">
        {offer.ids.map((id, i) => (
          <TarotCard
            key={id + i}
            info={offer.type === 'relic' ? RELICS[id as RelicId] : CONSUMABLES[id as ConsumableId]}
            kind={offer.type}
            selected={sel === id}
            onClick={full ? undefined : () => (setSel(id), sfx('card'))}
            className="run-deal"
            style={{ animationDelay: `${i * 110}ms`, ['--r' as string]: `${(i - 1) * 5}deg` }}
          />
        ))}
      </div>
      {offer.type === 'relic' && (
        <div className="run-sans mt-4 flex justify-center gap-3 text-[10px] text-[var(--ink-dim)]">
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

function nodeTitle(n: MapNode, bossName?: string) {
  if (n.kind === 'boss') return bossName ?? 'The Rival';
  if (n.kind === 'event') return EVENTS[n.event!].name;
  return ROOM_NAME[n.kind];
}
function nodeBlurb(n: MapNode, bossId: string) {
  switch (n.kind) {
    case 'puzzle':
      return `${T.rooms.puzzle.count} puzzles`;
    case 'convert':
      return n.goal === 'keep' ? 'Winning: keep it' : 'Winning: cash in';
    case 'hold':
      return 'Worse: survive';
    case 'ward':
      return 'Find the defence';
    case 'vault':
      return 'Won endgame';
    case 'duel':
      return 'From the book';
    case 'event':
      return EVENTS[n.event!].blurb;
    case 'boss':
      return bossMod(bossId).name;
  }
}
const nodeSprite = (n: MapNode) => (n.kind === 'event' ? EVENTS[n.event!].sprite : ROOM_SPRITE[n.kind]);
const nodePal = (n: MapNode) => (n.elite ? BLOOD : n.kind === 'event' ? SPIRIT : GOLD);

function MapView({ tools }: { tools: Tools }) {
  const s = useRun();
  const run = s.run!;
  const boss = opponentById(run.bossId);
  const wall = usePromise(() => textureTile('wall', 16, ['#120b1e', '#1a1129', '#211634', '#2a1c40'], 11, true), 'wall', 'tx:wall');
  return (
    <div className="flex h-full flex-col pb-4">
      <TopBar tools={tools} />
      <div className="run-dungeon relative mx-3 mt-2 flex-1 overflow-y-auto" style={{ backgroundImage: wall ? `url(${wall})` : undefined, boxShadow: 'inset 0 0 0 2px #1b0f22, inset 0 0 40px rgba(0,0,0,.8)' }}>
        <div className="flex flex-col-reverse items-center py-3">
          {run.layers.map((layer, li) => {
            const current = li === run.layer;
            const past = li < run.layer;
            const fog = li > run.layer + 1 && layer[0].kind !== 'boss';
            return (
              <div key={li} className="relative flex w-full flex-col items-center">
                <div className="relative flex w-full items-center justify-center gap-2 px-2">
                  {current && (
                    <>
                      <span className="absolute bottom-1 left-0">
                        <Fire w={6} h={11} scale={3} />
                      </span>
                      <span className="absolute right-0 bottom-1">
                        <Fire w={6} h={11} scale={3} />
                      </span>
                    </>
                  )}
                  {layer.map((node, ni) => {
                    const chosen = run.path[li] === ni;
                    const res = past && chosen ? run.results.find((r) => r.layer === li) : undefined;
                    const isBoss = node.kind === 'boss';
                    const danger = isBoss || node.elite;
                    return (
                      <button
                        key={ni}
                        disabled={!current}
                        onClick={() => (s.chooseNode(ni), sfx('card'))}
                        className={`relative flex items-center gap-2 p-1.5 text-left ${current ? 'run-deal' : ''} ${past && !chosen ? 'opacity-25' : ''}`}
                        style={{
                          width: layer.length > 1 ? 146 : 176,
                          minHeight: 70,
                          animationDelay: `${ni * 100}ms`,
                          background: isBoss ? 'linear-gradient(#3c0c1c,#1f0812)' : node.kind === 'event' ? 'linear-gradient(#1f3a4a,#10202a)' : 'linear-gradient(#2a1846,#16101f)',
                          boxShadow: `0 0 0 2px #1b0f22, inset 0 0 0 2px ${danger ? '#a8203a' : current ? 'var(--gold)' : 'var(--gold-dim)'}${current ? ', 0 0 18px rgba(242,199,92,.35)' : ''}`,
                        }}
                      >
                        {isBoss && boss ? <PixelPortrait id={boss.id} size={48} px={32} boss className="run-boss-glow" /> : <Sprite name={nodeSprite(node)} size={40} px={16} pal={nodePal(node)} />}
                        <span className="min-w-0">
                          <span className="run-title block text-[14px] leading-tight font-bold">{nodeTitle(node, boss?.name)}</span>
                          <span className="run-sans block text-[10px] leading-tight text-[var(--ink-dim)]">{nodeBlurb(node, run.bossId)}</span>
                          {node.kind !== 'event' && node.kind !== 'boss' && (
                            <span className="run-sans block text-[10px] font-bold" style={{ color: node.elite ? '#ff8c9a' : 'var(--gold)' }}>
                              {node.elite ? '☠ Elite · ' : ''}
                              {MODIFIERS[node.modifier].name}
                            </span>
                          )}
                          {res && <span className={`run-sans block text-[10px] font-bold ${res.won ? 'text-[#5ee59a]' : 'text-[var(--blood)]'}`}>{res.won ? `✓ ${res.score}` : '✕ failed'}</span>}
                          {past && chosen && !res && <span className="run-sans block text-[10px] font-bold text-[#6fd3ff]">visited</span>}
                        </span>
                        {fog && <span className="run-fog absolute inset-0" />}
                      </button>
                    );
                  })}
                </div>
                {li > 0 && (
                  <div className="my-1 flex flex-col items-center gap-[3px]">
                    {[0, 1, 2].map((k) => (
                      <span key={k} className="h-[3px] w-[3px]" style={{ background: li <= run.layer ? 'var(--gold)' : 'rgba(242,199,92,.3)' }} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-2">
        <Inventory />
      </div>
      <div className="run-sans mt-1 px-4 text-center text-xs text-[var(--ink-dim)]">{run.layers[run.layer]?.length > 1 ? 'Choose your path.' : 'Tap the room to enter.'}</div>
    </div>
  );
}

function Intro() {
  const s = useRun();
  const run = s.run!;
  const node = run.layers[run.layer][run.path[run.layer] ?? 0];
  const isBoss = node.kind === 'boss';
  const boss = isBoss ? opponentById(run.bossId) : undefined;
  const mod = bossMod(run.bossId);
  const elo = boss ? boss.elo + (run.cursed ? T.curse.ratingBoost : 0) : undefined;
  const title = node.kind === 'event' ? EVENTS[node.event!].name : isBoss ? boss?.name : ROOM_NAME[node.kind as RoomKind];
  return (
    <div className="flex h-full flex-col items-center px-6 pt-8 pb-6 text-center">
      <div className="run-label">
        Room {run.layer + 1} of {run.layers.length}
        {node.elite ? ' · Elite' : ''}
      </div>
      {boss ? (
        <>
          <PixelPortrait id={boss.id} size={128} boss className="run-slam run-boss-glow mt-4" />
          <div className="run-title mt-3 text-3xl font-black">{title}</div>
          <div className="run-sans text-sm text-[var(--ink-dim)]">
            {boss.tagline} · plays like ~{elo}
          </div>
        </>
      ) : (
        <>
          <div className="run-slam mt-6">
            <Sprite name={nodeSprite(node)} size={104} px={20} pal={nodePal(node)} />
          </div>
          <div className="run-title mt-2 text-3xl font-black">{title}</div>
        </>
      )}
      <div className="run-panel run-fadeup mt-6 w-full max-w-sm p-4 text-left">
        <div className="run-label">{node.kind === 'event' ? 'What waits inside' : 'Objective'}</div>
        <div className="run-sans mt-1 text-[15px] font-semibold">{objective(node, isBoss ? mod : undefined)}</div>
        {node.kind !== 'event' && (
          <>
            <div className="run-label mt-3">{isBoss ? `Rival's rule · ${mod.name}` : `Modifier · ${MODIFIERS[node.modifier].name}`}</div>
            <div className="run-sans mt-1 text-sm text-[var(--ink-dim)]">{isBoss ? bossModText(mod) : MODIFIERS[node.modifier].text}</div>
            {node.elite && <div className="run-sans mt-1 text-sm text-[#ff8c9a]">Elite: harder goal and opponent. Clear it for a guaranteed relic, often rare.</div>}
            <div className="run-label mt-3">Composure</div>
            <div className="run-sans mt-1 text-sm text-[var(--ink-dim)]">
              Mistake −{T.composure.cost.mistake}, blunder −{T.composure.cost.blunder}, inaccuracy free.
              {!isBoss ? ` Failing the room: −${T.composure.failRoom}.` : ' Losing to the rival ends the run.'}
            </div>
          </>
        )}
      </div>
      <button className="run-btn mt-auto w-full max-w-xs text-lg" disabled={s.busy} onClick={() => void s.enterRoom()}>
        {s.busy ? 'Shuffling…' : node.kind === 'event' ? 'Step inside' : 'Enter'}
      </button>
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
        <div className="run-title mt-1 text-3xl font-black">{meta.name}</div>
      </div>
      <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-4">
        {ev.kind === 'shrine' && <Shrine />}
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
            <button className="run-btn ghost mt-5 w-full" onClick={() => s.leaveEvent()}>
              Leave it be
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Shrine() {
  const s = useRun();
  const ev = s.run!.event;
  if (ev?.kind !== 'shrine') return null;
  const me = new Chess(ev.fen).turn();
  const right = ev.picked ? ev.answer.includes(ev.picked) : null;
  return (
    <div className="run-fadeup">
      <div className="flex items-center gap-2">
        <PixelPortrait id="coach" size={48} />
        <p className="run-sans text-sm">
          “They're threatening something. Which move holds?” <span className="text-[var(--ink-dim)]">Right answer: a relic.</span>
        </p>
      </div>
      <div className="mx-auto mt-3 w-64">
        <RunBoard
          fen={ev.fen}
          orientation={me === 'w' ? 'white' : 'black'}
          movable={null}
          showCoordinates={false}
          arrows={
            ev.picked
              ? [{ from: ev.picked.slice(0, 2), to: ev.picked.slice(2, 4), tone: right ? 'good' : 'bad' }, ...(right ? [] : [{ from: ev.answer[0].slice(0, 2), to: ev.answer[0].slice(2, 4), tone: 'good' as const }])]
              : []
          }
        />
      </div>
      <div className="mt-3 flex gap-2">
        {ev.choices.map((u) => (
          <button key={u} disabled={!!ev.picked} onClick={() => s.shrinePick(u)} className={`run-btn flex-1 ${ev.picked === u ? (right ? '' : 'danger') : 'ghost'}`}>
            {uciToSan(ev.fen, u)}
          </button>
        ))}
      </div>
      {ev.picked && (
        <div className="run-fadeup mt-3 text-center">
          <div className="run-title text-xl font-bold" style={{ color: right ? 'var(--gold-2)' : 'var(--blood)' }}>
            {right ? 'Sam nods. A gift awaits.' : `Not quite — ${uciToSan(ev.fen, ev.answer[0])} was the move.`}
          </div>
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
      <div className="run-title mt-1 text-3xl font-black">A Deal Is Offered</div>
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
  const full = run.consumables.length >= maxConsumables(run.relics);
  const rp = restPrice(run.relics);
  const bossNext = run.layer === run.layers.length - 1;
  return (
    <div className="flex h-full flex-col pb-4">
      <TopBar tools={tools} />
      <div className="mt-1 flex flex-col items-center">
        <div className="flex items-end gap-3">
          <PixelPortrait id="coach" size={56} />
          <Fire w={24} h={26} scale={3} logs />
          <Sprite name="bag" size={44} px={16} pal={JADE} />
        </div>
        <div className="run-title text-2xl font-bold">The Campfire</div>
        <div className="run-sans text-xs text-[var(--ink-dim)]">{bossNext ? 'The rival waits beyond the fire.' : 'Rest a moment. Buy a card or two.'}</div>
      </div>
      <div className="mt-3 flex justify-center gap-2 overflow-x-auto px-2">
        {run.shopStock.map((id, i) => {
          const p = price(id, run.relics);
          const afford = run.gold >= p && !full;
          return (
            <TarotCard
              key={id + i}
              info={CONSUMABLES[id]}
              kind="consumable"
              w={run.shopStock.length > 3 ? 88 : 110}
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
      {full && <div className="run-sans mt-2 text-center text-xs text-[var(--ink-dim)]">Hands full ({maxConsumables(run.relics)} cards max).</div>}
      <div className="mt-3 px-4">
        <button className="run-btn ghost w-full" disabled={run.restBought || run.gold < rp || run.composure >= T.composure.max} onClick={() => s.rest()}>
          Rest: +{T.shop.restComposure} candle · {rp}g{run.restBought ? ' (done)' : ''}
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
