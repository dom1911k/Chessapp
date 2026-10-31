// A room in play: HUD, relic rail (pulses when a relic fires, tap for info), eval gauge, pixel
// board, move recap, cards (tap to read, then use), end banner.
import { useEffect, useMemo, useState } from 'react';
import { toUci, uciToSan } from '../../lib/chess/game';
import { opponentById, pickLine } from '../../lib/people';
import { useSettings } from '../../lib/settings';
import type { CoachArrow } from '../../lib/coach/types';
import type { Classification } from '../../lib/chess/evaluation';
import { CONSUMABLES, MODIFIERS, RELICS, ROOM_NAME, bossMod, bossModText } from '../content';
import { chipTarget, fmtCp, gaugeLines, maxConsumables, progress, roomScore } from '../rules';
import { arrowOf, bossOf, lensMarks, liveEval, useRun } from '../store';
import { TUNING as T } from '../tuning';
import type { ConsumableId, RelicId, RoomKind } from '../types';
import { RunBoard } from '../pixel/RunBoard';
import { PixelPortrait, Sprite } from '../pixel/sprites';
import { BLOOD, EMBER, GOLD } from '../pixel/pixelize';
import { Composure, PixelNum } from './bits';
import { VsIntro } from './scenes';
import { useLongPress } from './useLongPress';

const CLS_COLOR: Record<Classification, string> = { best: '#5ee59a', good: '#9fd8b5', inaccuracy: '#ffd36b', mistake: '#ffb454', blunder: '#e2475a' };

export function RoomView({ onDev }: { onDev: () => void }) {
  const s = useRun();
  const run = s.run!;
  const room = run.room!;
  const showCoords = useSettings((x) => x.showCoordinates);
  const [pulse, setPulse] = useState<Record<string, { id: number; label: string }>>({});
  const [hit, setHit] = useState<{ id: number; insured?: boolean } | null>(null);
  const [used, setUsed] = useState<{ id: number; item: ConsumableId } | null>(null);
  const [info, setInfo] = useState<{ kind: 'relic'; id: RelicId | 'rival' } | { kind: 'card'; id: ConsumableId; index: number } | null>(null);
  const isBoss = room.node.kind === 'boss';
  const [vs, setVs] = useState(isBoss && room.moves.length === 0 && room.plies.length === 0);
  const lp = useLongPress(onDev);
  const boss = isBoss ? opponentById(room.oppId) : undefined;
  const mod = isBoss ? bossMod(run.bossId) : undefined;

  // React to effects from the store.
  const lastFx = s.fx[s.fx.length - 1];
  useEffect(() => {
    if (!lastFx) return;
    if (lastFx.kind === 'relic') setPulse((p) => ({ ...p, [lastFx.relic]: { id: lastFx.id, label: lastFx.label } }));
    if (lastFx.kind === 'hit') setHit({ id: lastFx.id, insured: lastFx.insured });
    if (lastFx.kind === 'consumable') setUsed({ id: lastFx.id, item: lastFx.item });
  }, [lastFx]);

  const [bossLine, setBossLine] = useState(() => (boss ? pickLine(boss, 'greet') : ''));
  useEffect(() => {
    if (!boss || !lastFx) return;
    if (lastFx.kind === 'hit' && lastFx.amount > 0) setBossLine(pickLine(boss, 'userBlunder', Math.random(), { piece: 'piece', move: '' }));
    if (lastFx.kind === 'relic') setBossLine(pickLine(boss, 'userGoodMove'));
  }, [lastFx, boss]);

  const live = roomScore(room);
  const target = chipTarget(room);
  const me = room.me;
  const lastPly = room.plies[room.plies.length - 1];
  const sealed = mod?.sealed ?? [];

  const arrows: CoachArrow[] = [];
  if (s.aids.eye) arrows.push(arrowOf(s.aids.eye, 'good'));
  if (s.aids.cards) s.aids.cards.forEach((u) => arrows.push(arrowOf(u, 'info')));
  if (s.answer) arrows.push(s.answer);
  if (s.aids.verdict) arrows.push(arrowOf(s.aids.verdict.uci, s.aids.verdict.label === 'safe' ? 'good' : 'bad'));
  const highlights = useMemo(() => (s.aids.lens ? lensMarks(room.fen, me) : []), [s.aids.lens, room.fen, me]);

  const playing = room.status === 'playing';
  const canRewind = run.consumables.includes('rewind') && room.moves.length > 0 && (!room.puzzle || room.puzzle.lost) && room.plies.some((p) => p.by === 'me');
  const showGauge = !room.puzzle;
  const ev = liveEval(s.cur, room.fen, me) ?? (room.moves.length ? room.moves[room.moves.length - 1].evalAfter : room.startEval);
  const relicsShown: (RelicId | 'rival')[] = [...run.relics, ...(isBoss ? (['rival'] as const) : [])];

  return (
    <div className="flex h-full flex-col">
      {vs && <VsIntro bossId={run.bossId} cursed={run.cursed} onDone={() => setVs(false)} />}
      {hit && !hit.insured && <div key={hit.id} className="run-redflash pointer-events-none fixed inset-0 z-50" />}
      {/* HUD */}
      <div className="safe-top px-3 pt-2">
        <div className="flex items-center justify-between gap-2">
          <div {...lp} className="flex min-w-0 items-center gap-2 select-none">
            <Sprite name={isBoss ? 'skull' : room.gamble ? 'dice' : spriteOf(room.node.kind as RoomKind)} size={30} px={14} pal={isBoss || room.node.elite ? BLOOD : GOLD} />
            <div className="min-w-0">
              <div className="run-label truncate">
                {isBoss ? mod?.name : room.node.elite ? 'Elite · ' + MODIFIERS[room.node.modifier].name : MODIFIERS[room.node.modifier].name} · {room.layer + 1}/{run.layers.length}
              </div>
              <div className="run-title truncate text-xl font-bold">{room.gamble ? 'The Gamble' : ROOM_NAME[room.node.kind as RoomKind]}</div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <Composure value={run.composure} max={T.composure.start} hit={hit?.insured ? undefined : hit?.id} />
            <div className="flex items-center gap-1">
              <Sprite name="coin" size={16} px={10} stroke={5} />
              <PixelNum value={run.gold} size={3} />
            </div>
          </div>
        </div>
        {boss && (
          <div className="run-panel mt-2 flex items-center gap-2 p-1.5 pr-3">
            <PixelPortrait id={boss.id} size={44} boss className="run-boss-glow" />
            <div className="min-w-0">
              <div className="run-sans text-sm font-bold">
                {boss.name}
                {run.cursed && <span className="ml-1.5 text-[var(--blood)]">+{T.curse.ratingBoost} cursed</span>}
              </div>
              <div className="run-sans truncate text-xs text-[var(--ink-dim)] italic">“{bossLine}”</div>
            </div>
          </div>
        )}
        {/* Score so far (with chip target) + goal */}
        <div className="mt-2 flex items-center gap-2">
          <div className="flex items-center gap-1 rounded bg-[var(--chip)]/20 px-2 py-1 ring-1 ring-[var(--chip)]/50">
            <PixelNum value={live.chips} size={2.5} color="var(--chip)" />
            {target > 0 && <PixelNum value={`/${target}`} size={1.6} color={live.chips >= target ? '#5ee59a' : 'var(--ink-dim)'} glow={false} />}
          </div>
          <PixelNum value="×" size={2.5} color="var(--ink-dim)" glow={false} />
          <div className="flex items-center gap-1 rounded bg-[var(--mult)]/20 px-2 py-1 ring-1 ring-[var(--mult)]/50">
            <PixelNum value={live.mult} size={2.5} color="var(--mult)" />
          </div>
          <div className="run-sans ml-auto text-right text-xs font-semibold text-[var(--ink-dim)]">{progress(room, bossOf(run))}</div>
        </div>
        {/* Relic rail (tap for info) */}
        <div className="mt-2 flex min-h-9 items-center gap-1.5">
          {relicsShown.map((id) => (
            <RelicIcon key={id} id={id} bossId={run.bossId} pulse={pulse[id]} onClick={() => setInfo({ kind: 'relic', id })} />
          ))}
          {s.busy && <span className="run-sans ml-auto animate-pulse text-xs text-[var(--ink-dim)]">{room.puzzle ? 'thinking…' : 'opponent thinking…'}</span>}
          {!s.busy && s.aids.opinion && <span className="run-sans ml-auto text-xs font-bold text-[var(--gold-2)]">Second Opinion ready</span>}
        </div>
      </div>

      {/* Board + eval gauge */}
      <div className="relative mt-1 flex gap-1.5 px-1.5">
        {showGauge && <EvalGauge cp={ev} {...gaugeLines(room, bossOf(run))} thinking={s.busy} />}
        <div className="relative min-w-0 flex-1">
          <RunBoard
            fen={room.fen}
            orientation={me === 'w' ? 'white' : 'black'}
            movable={playing && !s.busy && !s.aids.verdict && !room.puzzle?.lost ? me : null}
            onMove={(m) => s.userMove(toUci(m))}
            arrows={arrows}
            highlights={highlights}
            lastMove={lastPly ? { from: lastPly.uci.slice(0, 2), to: lastPly.uci.slice(2, 4) } : null}
            showCoordinates={showCoords}
          />
          {used && <UsedCard key={used.id} item={used.item} />}
          {s.aids.verdict && <VerdictPanel />}
          {!playing && <EndBanner canRewind={canRewind} />}
          {playing && room.puzzle?.lost && <PuzzleLost canRewind={canRewind} />}
        </div>
      </div>

      {/* Move recap */}
      <div className="mt-1.5 flex min-h-6 items-center gap-1 overflow-hidden px-3">
        {room.moves.slice(-7).map((m, i) => (
          <span key={room.moves.length - 7 + i} className="run-fadeup run-sans flex items-center gap-1 rounded bg-black/35 px-1.5 py-0.5 text-[11px] font-bold whitespace-nowrap" style={{ boxShadow: `inset 0 -2px 0 ${CLS_COLOR[m.cls]}` }}>
            <span className="h-1.5 w-1.5" style={{ background: CLS_COLOR[m.cls] }} />
            {m.san}
          </span>
        ))}
        {room.moves.length === 0 && <span className="run-sans text-[11px] text-[var(--ink-dim)]">{me === 'w' ? 'You play White.' : 'You play Black.'} Your moves will show here.</span>}
      </div>

      {/* Cards */}
      <div className="mt-auto px-3 pb-3">
        <div className="run-label mb-1.5 flex justify-between">
          <span>Cards ({run.consumables.length}/{maxConsumables(run.relics)})</span>
          {run.curses.length > 0 && <span className="text-[var(--blood)]!">Brittle: mistakes −1 more</span>}
        </div>
        <div className="flex gap-2">
          {run.consumables.length === 0 && <div className="run-sans text-xs text-[var(--ink-dim)]">No cards. Buy some at the campfire.</div>}
          {run.consumables.map((id, i) => (
            <button key={i} onClick={() => setInfo({ kind: 'card', id, index: i })} className={`tarot flex-1 ${sealed.includes(id) ? 'opacity-40 grayscale' : ''}`} style={{ height: 60 }} aria-label={CONSUMABLES[id].name}>
              <div className="tarot-inner flex-row! gap-2 px-2">
                <Sprite name={CONSUMABLES[id].glyph} size={30} px={14} pal={EMBER} />
                <span className="text-left">
                  <span className="run-title block text-[13px] leading-tight font-bold">{CONSUMABLES[id].name}</span>
                  <span className="run-sans block text-[10px] leading-tight text-[var(--ink-dim)]">{sealed.includes(id) ? 'Sealed by the rival' : id === 'insurance' ? 'Armed: works by itself' : 'Tap to read & use'}</span>
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
      {info && <InfoSheet info={info} canRewind={canRewind} sealed={sealed} onClose={() => setInfo(null)} />}
    </div>
  );
}

const SPRITE_OF: Record<RoomKind, string> = { puzzle: 'cards', convert: 'scythe', hold: 'tower', ward: 'shield', vault: 'chest', duel: 'swords', boss: 'skull' };
const spriteOf = (k: RoomKind) => SPRITE_OF[k];

/** Vertical eval meter (your POV): −5 … +5, with the room's floor and goal lines. */
function EvalGauge({ cp, floor, goal, thinking }: { cp: number; floor?: number; goal?: number; thinking: boolean }) {
  const clamp = (v: number) => Math.max(-500, Math.min(500, v));
  const pos = (v: number) => 50 - clamp(v) / 10; // % from top
  const p = pos(cp);
  return (
    <div className="relative w-4 shrink-0" title={`Eval ${fmtCp(cp)}`} style={{ background: 'linear-gradient(#1b0f22,#1b0f22)', boxShadow: '0 0 0 2px #1b0f22, inset 0 0 0 1px rgba(242,199,92,.35)' }}>
      {/* filled part = your advantage (from the bottom) */}
      <div className="absolute inset-x-0 bottom-0 transition-[height] duration-500" style={{ height: `${100 - p}%`, background: 'repeating-linear-gradient(0deg, #e0a93a 0 3px, #c48f2a 3px 4px)' }} />
      <div className="absolute inset-x-0 top-1/2 h-px bg-white/30" />
      {floor !== undefined && (
        <div className="absolute inset-x-[-3px] h-[3px]" style={{ top: `${pos(floor)}%`, background: 'var(--blood)', boxShadow: '0 0 6px var(--blood)' }} title={`Floor ${fmtCp(floor)}`} />
      )}
      {goal !== undefined && (
        <div className="absolute inset-x-[-3px] h-[3px]" style={{ top: `${pos(goal)}%`, background: '#5ee59a', boxShadow: '0 0 6px #5ee59a' }} title={`Goal ${fmtCp(goal)}`} />
      )}
      <div className={`run-sans absolute left-1/2 -translate-x-1/2 rounded bg-black/80 px-0.5 text-[8px] font-black whitespace-nowrap text-[var(--gold-2)] ${thinking ? 'opacity-60' : ''}`} style={{ top: `calc(${Math.max(4, Math.min(92, p))}% - 6px)` }}>
        {fmtCp(cp).replace('+', '')}
      </div>
    </div>
  );
}

function RelicIcon({ id, bossId, pulse, onClick }: { id: RelicId | 'rival'; bossId: string; pulse?: { id: number; label: string }; onClick: () => void }) {
  return (
    <button className="relative" onClick={onClick} aria-label={id === 'rival' ? 'Rival rule' : RELICS[id].name}>
      <div key={pulse?.id} className={`flex h-9 w-9 items-center justify-center bg-black/45 ${pulse ? 'run-pulse' : ''}`} style={{ boxShadow: `0 0 0 2px #1b0f22, inset 0 0 0 1px ${id === 'rival' ? 'var(--blood)' : 'var(--gold-dim)'}` }}>
        {id === 'rival' ? <PixelPortrait id={bossId} size={30} px={24} boss /> : <Sprite name={RELICS[id].glyph} size={28} px={14} pal={RELICS[id].rarity === 'rare' ? BLOOD : GOLD} />}
      </div>
      {pulse?.label && (
        <span key={`l${pulse.id}`} className="run-float run-sans pointer-events-none absolute -top-2 left-1/2 z-20 rounded bg-[var(--mult)] px-1 text-[11px] font-black whitespace-nowrap text-white">
          {pulse.label}
        </span>
      )}
    </button>
  );
}

function InfoSheet({ info, canRewind, sealed, onClose }: { info: { kind: 'relic'; id: RelicId | 'rival' } | { kind: 'card'; id: ConsumableId; index: number }; canRewind: boolean; sealed: ConsumableId[]; onClose: () => void }) {
  const s = useRun();
  const run = s.run!;
  const room = run.room!;
  let title = '';
  let text = '';
  let sprite = 'star';
  let action: { label: string; ok: boolean; why?: string } | null = null;
  if (info.kind === 'relic') {
    if (info.id === 'rival') {
      const m = bossMod(run.bossId);
      title = m.name;
      text = (MODIFIERS.rival.text || '') + ' ' + bossModTextSafe(run.bossId);
      sprite = 'skull';
    } else {
      title = RELICS[info.id].name;
      text = RELICS[info.id].text;
      sprite = RELICS[info.id].glyph;
    }
  } else {
    const c = CONSUMABLES[info.id];
    title = c.name;
    text = c.text;
    sprite = c.glyph;
    const playing = room.status === 'playing';
    if (info.id === 'insurance') action = { label: 'Armed', ok: false, why: 'Insurance works by itself on your next blunder.' };
    else if (sealed.includes(info.id)) action = { label: 'Sealed', ok: false, why: 'The rival has sealed this card for the fight.' };
    else if (info.id === 'rewind') action = { label: 'Rewind', ok: canRewind && !s.busy, why: canRewind ? undefined : 'Nothing to take back yet.' };
    else action = { label: 'Use', ok: playing && !s.busy && !room.puzzle?.lost, why: !playing ? 'The room is over.' : s.busy ? 'Wait for the board.' : undefined };
  }
  return (
    <div className="fixed inset-0 z-[62] flex items-end bg-black/55" onClick={onClose}>
      <div className="run-panel run-fadeup w-full rounded-b-none p-4 pb-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <Sprite name={sprite} size={56} px={16} pal={info.kind === 'card' ? EMBER : GOLD} />
          <div className="min-w-0 flex-1">
            <div className="run-title text-xl font-bold">{title}</div>
            {info.kind === 'relic' && info.id !== 'rival' && <div className="run-label">{RELICS[info.id].rarity}</div>}
            <p className="run-sans mt-1 text-sm leading-snug">{text}</p>
            {action?.why && <p className="run-sans mt-1 text-xs text-[var(--ink-dim)]">{action.why}</p>}
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button className="run-btn ghost flex-1" onClick={onClose}>
            Close
          </button>
          {action && info.kind === 'card' && (
            <button
              className="run-btn flex-1"
              disabled={!action.ok}
              onClick={() => {
                onClose();
                void s.use(info.id);
              }}
            >
              {action.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const bossModTextSafe = (id: string) => bossModText(bossMod(id));

function UsedCard({ item }: { item: ConsumableId }) {
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGone(true), 900);
    return () => clearTimeout(t);
  }, []);
  if (gone) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
      <div className="run-slam run-panel flex items-center gap-2 px-4 py-2">
        <Sprite name={CONSUMABLES[item].glyph} size={30} px={14} pal={EMBER} />
        <span className="run-title text-lg font-bold">{CONSUMABLES[item].name}</span>
      </div>
    </div>
  );
}

function VerdictPanel() {
  const s = useRun();
  const v = s.aids.verdict!;
  const room = s.run!.room!;
  const color = v.label === 'safe' ? '#5ee59a' : v.label === 'risky' ? '#ffb454' : 'var(--blood)';
  return (
    <div className="absolute inset-x-4 bottom-4 z-30">
      <div className="run-panel run-fadeup p-3 text-center">
        <div className="run-label">Second Opinion on {uciToSan(room.fen, v.uci)}</div>
        <div className="run-title mt-1 text-3xl font-black uppercase" style={{ color, textShadow: `0 0 18px ${color}` }}>
          {v.label}
        </div>
        <div className="mt-3 flex gap-2">
          <button className="run-btn ghost flex-1" onClick={() => s.confirmVerdict(false)}>
            Choose again
          </button>
          <button className="run-btn flex-1" onClick={() => s.confirmVerdict(true)}>
            Play it
          </button>
        </div>
      </div>
    </div>
  );
}

function EndBanner({ canRewind }: { canRewind: boolean }) {
  const s = useRun();
  const run = s.run!;
  const room = run.room!;
  const won = room.status === 'won';
  const broke = run.composure <= 0;
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/45 p-4" onClick={() => !canRewind && s.closeRoom()}>
      <div className="run-panel run-slam w-full max-w-xs p-4 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center">
          <Sprite name={won ? 'check' : broke ? 'candle' : 'cross'} size={44} px={14} pal={won ? GOLD : BLOOD} />
        </div>
        <div className="run-title text-3xl font-black" style={{ color: won ? 'var(--gold-2)' : 'var(--blood)' }}>
          {won ? 'Room cleared' : broke ? 'Composure broken' : 'Room failed'}
        </div>
        <div className="run-sans mt-1 text-sm text-[var(--ink-dim)]">{room.reason}</div>
        <div className="mt-4 flex gap-2">
          {!won && canRewind && (
            <button className="run-btn ghost flex-1" onClick={() => s.rewind()}>
              Rewind
            </button>
          )}
          <button className={`run-btn flex-1 ${broke ? 'danger' : ''}`} onClick={() => s.closeRoom()}>
            {broke ? 'Debrief' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PuzzleLost({ canRewind }: { canRewind: boolean }) {
  const s = useRun();
  const last = s.run!.room!.moves[s.run!.room!.moves.length - 1];
  return (
    <div className="absolute inset-x-4 bottom-4 z-30">
      <div className="run-panel run-fadeup p-3 text-center">
        <div className="run-title text-xl font-bold text-[var(--blood)]">Not the answer</div>
        <div className="run-sans mt-0.5 text-xs text-[var(--ink-dim)]">
          {last?.cls && last.composureLost > 0 ? `${last.cls[0].toUpperCase()}${last.cls.slice(1)}: −${last.composureLost} Composure. ` : ''}The green arrow shows the move.
        </div>
        <div className="mt-3 flex gap-2">
          {canRewind && (
            <button className="run-btn ghost flex-1" onClick={() => s.rewind()}>
              Rewind
            </button>
          )}
          <button className="run-btn flex-1" disabled={s.busy} onClick={() => s.nextPuzzle()}>
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
