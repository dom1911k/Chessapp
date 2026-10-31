// A room in play: HUD, relic rail (pulses when a relic fires), board, consumables, end banner.
import { useEffect, useMemo, useState } from 'react';
import { Board } from '../../components/Board';
import { toUci, uciToSan } from '../../lib/chess/game';
import { opponentById, pickLine, portrait } from '../../lib/people';
import { useSettings } from '../../lib/settings';
import type { CoachArrow } from '../../lib/coach/types';
import { CONSUMABLES, MODIFIERS, RELICS, ROOM_NAME } from '../content';
import { maxConsumables, progress, roomScore } from '../rules';
import { arrowOf, lensMarks, useRun } from '../store';
import { TUNING as T } from '../tuning';
import type { ConsumableId, RelicId } from '../types';
import { Composure, Glyph, PixelNum } from './bits';
import { useLongPress } from './useLongPress';

export function RoomView({ onDev }: { onDev: () => void }) {
  const s = useRun();
  const run = s.run!;
  const room = run.room!;
  const showCoords = useSettings((x) => x.showCoordinates);
  const confirm = useSettings((x) => x.confirmMoves);
  const [pulse, setPulse] = useState<Record<string, { id: number; label: string }>>({});
  const [hit, setHit] = useState<{ id: number; insured?: boolean } | null>(null);
  const [used, setUsed] = useState<{ id: number; item: ConsumableId } | null>(null);
  const lp = useLongPress(onDev);

  // React to effects from the store.
  const lastFx = s.fx[s.fx.length - 1];
  useEffect(() => {
    if (!lastFx) return;
    if (lastFx.kind === 'relic') setPulse((p) => ({ ...p, [lastFx.relic]: { id: lastFx.id, label: lastFx.label } }));
    if (lastFx.kind === 'hit') setHit({ id: lastFx.id, insured: lastFx.insured });
    if (lastFx.kind === 'consumable') setUsed({ id: lastFx.id, item: lastFx.item });
  }, [lastFx]);

  const live = roomScore(room, run);
  const me = room.me;
  const lastPly = room.plies[room.plies.length - 1];
  const boss = room.node.kind === 'boss' ? opponentById(room.oppId) : undefined;
  const [bossLine, setBossLine] = useState(() => (boss ? pickLine(boss, 'greet') : ''));
  // The rival reacts to your blunders and good moves.
  useEffect(() => {
    if (!boss || !lastFx) return;
    if (lastFx.kind === 'hit' && lastFx.amount > 0) setBossLine(pickLine(boss, 'userBlunder', Math.random(), { piece: 'piece', move: '' }));
    if (lastFx.kind === 'relic') setBossLine(pickLine(boss, 'userGoodMove'));
  }, [lastFx, boss]);

  const arrows: CoachArrow[] = [];
  if (s.aids.eye) arrows.push(arrowOf(s.aids.eye, 'good'));
  if (s.aids.cards) s.aids.cards.forEach((u) => arrows.push(arrowOf(u, 'info')));
  if (s.answer) arrows.push(s.answer);
  if (s.aids.verdict) arrows.push(arrowOf(s.aids.verdict.uci, s.aids.verdict.label === 'safe' ? 'good' : 'bad'));
  const highlights = useMemo(() => (s.aids.lens ? lensMarks(room.fen, me) : []), [s.aids.lens, room.fen, me]);

  const playing = room.status === 'playing';
  const canRewind = run.consumables.includes('rewind') && room.moves.length > 0 && (!room.puzzle || room.puzzle.lost) && room.plies.some((p) => p.by === 'me');

  return (
    <div className="flex h-full flex-col">
      {hit && !hit.insured && <div key={hit.id} className="run-redflash pointer-events-none fixed inset-0 z-50" />}
      {/* HUD */}
      <div className="safe-top px-3 pt-2">
        <div className="flex items-center justify-between gap-2">
          <div {...lp} className="min-w-0 select-none">
            <div className="run-label truncate">
              {MODIFIERS[room.node.modifier].name} · Act I · {room.layer + 1}/4
            </div>
            <div className="run-title truncate text-xl font-bold">{ROOM_NAME[room.node.kind]}</div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Composure value={run.composure} max={T.composure.start} hit={hit?.insured ? undefined : hit?.id} />
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--gold)]"><Glyph name="coin" size={16} /></span>
              <PixelNum value={run.gold} size={3} />
            </div>
          </div>
        </div>
        {boss && (
          <div className="run-panel mt-2 flex items-center gap-2 p-1.5 pr-3">
            <img src={portrait(boss.id)} alt="" className="h-10 w-10 rounded-lg object-cover ring-1 ring-[var(--gold-dim)]" />
            <div className="min-w-0">
              <div className="run-sans text-sm font-bold">{boss.name}{run.cursed && <span className="ml-1.5 text-[var(--blood)]">+{T.curse.ratingBoost} cursed</span>}</div>
              <div className="run-sans truncate text-xs text-[var(--ink-dim)] italic">“{bossLine}”</div>
            </div>
          </div>
        )}
        {/* Score so far + goal */}
        <div className="mt-2 flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg bg-[var(--chip)]/20 px-2 py-1 ring-1 ring-[var(--chip)]/50">
            <PixelNum value={live.chips} size={2.5} color="var(--chip)" />
          </div>
          <PixelNum value="×" size={2.5} color="var(--ink-dim)" glow={false} />
          <div className="flex items-center gap-1 rounded-lg bg-[var(--mult)]/20 px-2 py-1 ring-1 ring-[var(--mult)]/50">
            <PixelNum value={live.mult} size={2.5} color="var(--mult)" />
          </div>
          <div className="run-sans ml-auto text-right text-xs font-semibold text-[var(--ink-dim)]">{progress(room)}</div>
        </div>
        {/* Relic rail */}
        <div className="mt-2 flex min-h-9 items-center gap-1.5">
          {run.relics.map((id) => (
            <RelicIcon key={id} id={id} pulse={pulse[id]} />
          ))}
          {s.busy && <span className="run-sans ml-auto animate-pulse text-xs text-[var(--ink-dim)]">{room.node.kind === 'puzzle' ? 'thinking…' : 'opponent thinking…'}</span>}
          {!s.busy && s.aids.opinion && <span className="run-sans ml-auto text-xs font-bold text-[var(--gold-2)]">Second Opinion ready: make your move</span>}
        </div>
      </div>

      {/* Board */}
      <div className="relative mt-1 px-1.5">
        <Board
          fen={room.fen}
          orientation={me === 'w' ? 'white' : 'black'}
          movable={playing && !s.busy && !s.aids.verdict && !room.puzzle?.lost ? me : null}
          onMove={(m) => s.userMove(toUci(m))}
          arrows={arrows}
          highlights={highlights}
          lastMove={lastPly ? { from: lastPly.uci.slice(0, 2), to: lastPly.uci.slice(2, 4) } : null}
          showCoordinates={showCoords}
          confirm={confirm}
        />
        {used && <UsedCard key={used.id} item={used.item} />}
        {s.aids.verdict && <VerdictPanel />}
        {!playing && <EndBanner canRewind={canRewind} />}
        {playing && room.puzzle?.lost && <PuzzleLost canRewind={canRewind} />}
      </div>

      {/* Consumables */}
      <div className="mt-auto px-3 pb-3">
        <div className="run-label mb-1.5 flex justify-between">
          <span>Cards ({run.consumables.length}/{maxConsumables(run.relics)})</span>
          <span>{me === 'w' ? 'You play White' : 'You play Black'}</span>
        </div>
        <div className="flex gap-2">
          {run.consumables.length === 0 && <div className="run-sans text-xs text-[var(--ink-dim)]">No cards. Buy some at the campfire.</div>}
          {run.consumables.map((id, i) => {
            const passive = id === 'insurance';
            const rewind = id === 'rewind';
            const disabled = !playing && !rewind ? true : passive || s.busy || (rewind ? !canRewind : !!room.puzzle?.lost || !playing);
            return (
              <button
                key={i}
                disabled={disabled}
                onClick={() => void s.use(id)}
                className="tarot flex-1 disabled:opacity-60"
                style={{ height: 64 }}
                aria-label={CONSUMABLES[id].name}
              >
                <div className="tarot-inner flex-row! gap-2 px-2">
                  <span className="text-[var(--gold-2)]"><Glyph name={CONSUMABLES[id].glyph} size={30} /></span>
                  <span className="text-left">
                    <span className="run-title block text-[13px] leading-tight font-bold">{CONSUMABLES[id].name}</span>
                    <span className="run-sans block text-[10px] leading-tight text-[var(--ink-dim)]">{passive ? 'Armed: works by itself' : rewind ? 'Undo your last move' : 'Tap to use'}</span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RelicIcon({ id, pulse }: { id: RelicId; pulse?: { id: number; label: string } }) {
  return (
    <div className="relative" title={RELICS[id].name}>
      <div key={pulse?.id} className={`flex h-9 w-9 items-center justify-center rounded-lg bg-black/40 text-[var(--gold)] ring-1 ring-[var(--gold-dim)] ${pulse ? 'run-pulse' : ''}`}>
        <Glyph name={RELICS[id].glyph} size={24} />
      </div>
      {pulse?.label && (
        <span key={`l${pulse.id}`} className="run-float run-sans pointer-events-none absolute -top-2 left-1/2 z-20 rounded bg-[var(--mult)] px-1 text-[11px] font-black whitespace-nowrap text-white">
          {pulse.label}
        </span>
      )}
    </div>
  );
}

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
        <span className="text-[var(--gold-2)]"><Glyph name={CONSUMABLES[item].glyph} size={28} /></span>
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
          {last?.cls && last.composureLost > 0 ? `${last.cls[0].toUpperCase()}${last.cls.slice(1)}: −${last.composureLost} Composure. ` : ''}The green arrow shows the solution.
        </div>
        <div className="mt-3 flex gap-2">
          {canRewind && (
            <button className="run-btn ghost flex-1" onClick={() => s.rewind()}>
              Rewind
            </button>
          )}
          <button className="run-btn flex-1" disabled={s.busy} onClick={() => s.nextPuzzle()}>
            Next puzzle
          </button>
        </div>
      </div>
    </div>
  );
}
