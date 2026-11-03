// A room in play: HUD, relic rail (pulses when a relic fires, tap for info), eval gauge, pixel
// board, move recap, cards (tap to read, then use), end banner.
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toUci, tryMove, uciToSan } from '../../lib/chess/game';
import { opponentById, pickLine } from '../../lib/people';
import { useSettings } from '../../lib/settings';
import type { CoachArrow } from '../../lib/coach/types';
import type { Classification } from '../../lib/chess/evaluation';
import { CONSUMABLES, MODIFIERS, RELICS, ROOM_NAME, ROOM_SPRITE, rivalRule, bossModText, NEMESIS_WHY } from '../content';
import { canTakeBack, chipTarget, fmtCp, gaugeLines, cardSlots, progress, recovery, roomCap, roomLoss, roomScore, takebacksLeft, heatRules, fmtBig } from '../rules';
import { explainMove } from '../../lib/coach';
import { arrowOf, bookHint, bossOf, lensMarks, liveEval, useRun } from '../store';
import { Chess } from 'chess.js';
import { TUNING as T } from '../tuning';
import type { ConsumableId, RelicId, RoomKind, RoomState } from '../types';
import { PixelCaptured, RunBoard } from '../pixel/RunBoard';
import { material } from '../../lib/chess/material';
import { moveSound, sfx } from '../sfx';
import { PixelText } from './PixelText';
import { PixelPortrait, Sprite } from '../pixel/sprites';
import { BLOOD, EMBER, GOLD } from '../pixel/pixelize';
import { Composure, FervorFlame, MaterialIcon, PixelNum } from './bits';
import { MATERIAL_INFO, dripRate, roomMaterial, type Material } from '../order';
import { reducedMotion } from '../settings';
import { VsIntro } from './scenes';
import { useLongPress } from './useLongPress';
import { useMeta } from '../meta';
import { techById, techLevel, type TechId } from '../codex';

const CLS_COLOR: Record<Classification, string> = { best: '#5ee59a', good: '#9fd8b5', inaccuracy: '#ffd36b', mistake: '#ffb454', blunder: '#e2475a' };

export function RoomView({ onDev, onSettings }: { onDev: () => void; onSettings: () => void }) {
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
  const [view, setView] = useState<number | null>(null);
  // Piece sounds for every move on the board (yours and the opponent's).
  const plyCount = room.plies.length;
  const lastSan = room.plies[plyCount - 1]?.san;
  const lastBy = room.plies[plyCount - 1]?.by;
  const lastUci = room.plies[plyCount - 1]?.uci;
  const [burst, setBurst] = useState<{ id: number; sq: string; kind: 'shatter' | 'promote'; color: 'w' | 'b' } | null>(null);
  useEffect(() => {
    if (lastSan) sfx(moveSound(lastSan), 0, lastBy === 'opp');
    setView(null);
    // A taken piece shatters into pixels; a promotion flashes gold.
    if (lastSan && lastUci) {
      const mover = lastBy === 'me' ? room.me : room.me === 'w' ? 'b' : 'w';
      if (lastSan.includes('=')) setBurst({ id: Date.now(), sq: lastUci.slice(2, 4), kind: 'promote', color: mover });
      else if (lastSan.includes('x')) setBurst({ id: Date.now(), sq: lastUci.slice(2, 4), kind: 'shatter', color: mover === 'w' ? 'b' : 'w' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plyCount, lastSan, lastBy]);
  const boss = isBoss ? opponentById(room.oppId) : undefined;
  const mod = isBoss ? rivalRule(run) : undefined;

  // React to effects from the store.
  const lastFx = s.fx[s.fx.length - 1];
  // Every new effect since the last render (several can arrive at once: a drip, then the move).
  const seenFx = useRef(lastFx?.id ?? 0);
  useEffect(() => {
    const fresh = s.fx.filter((f) => f.id > seenFx.current);
    if (!fresh.length) return;
    seenFx.current = fresh[fresh.length - 1].id;
    for (const lastFx of fresh) {
    if (lastFx.kind === 'relic') setPulse((p) => ({ ...p, [lastFx.relic === 'tech' ? `tech:${lastFx.tech}` : lastFx.relic]: { id: lastFx.id, label: lastFx.label } }));
    if (lastFx.kind === 'drip') {
      const b = boardRef.current?.getBoundingClientRect();
      const c = matRef.current?.getBoundingClientRect();
      if (b && c && !reducedMotion()) {
        const f = 'abcdefgh'.indexOf(lastFx.sq[0]);
        const r = Number(lastFx.sq[1]) - 1;
        const col = room.me === 'w' ? f : 7 - f;
        const row = room.me === 'w' ? 7 - r : r;
        const x = b.left + ((col + 0.5) * b.width) / 8;
        const y = b.top + ((row + 0.5) * b.height) / 8;
        const coin = { id: lastFx.id, x, y, dx: c.left + c.width / 2 - x, dy: c.top + c.height / 2 - y, m: lastFx.material, go: false };
        setCoins((cs) => [...cs.slice(-5), coin]);
        requestAnimationFrame(() => requestAnimationFrame(() => setCoins((cs) => cs.map((k) => (k.id === coin.id ? { ...k, go: true } : k)))));
        setTimeout(() => {
          setCoins((cs) => cs.filter((k) => k.id !== coin.id));
          setMatPulse(lastFx.id);
          sfx('drip', Math.round(lastFx.amount * 4));
        }, 560);
      } else {
        setMatPulse(lastFx.id);
        sfx('drip');
      }
    }
    if (lastFx.kind === 'ready') {
      setSparkle(lastFx.id);
      setReadyLabel(lastFx.label);
    }
    if (lastFx.kind === 'technique') {
      setPulse((p) => ({ ...p, [`tech:${lastFx.tech}`]: { id: lastFx.id, label: lastFx.label } }));
      setTechFx({ id: lastFx.id, tech: lastFx.tech, label: lastFx.label });
      setTimeout(() => setTechFx((x) => (x?.id === lastFx.id ? null : x)), 1500);
    }
    if (lastFx.kind === 'hit') setHit({ id: lastFx.id, insured: lastFx.insured });
    if (lastFx.kind === 'consumable') setUsed({ id: lastFx.id, item: lastFx.item });
    }
  }, [lastFx]);

  const [techFx, setTechFx] = useState<{ id: number; tech: TechId; label: string } | null>(null);
  // The Order: this room's material, the counter and its flying coins.
  const roomMat = room.gamble ? null : roomMaterial(room.node.kind as RoomKind);
  const rate = dripRate(run.meta?.order, room.node.kind as RoomKind).rate;
  const metaMats = useMeta((m) => m.materials ?? {});
  const matTotal = roomMat ? (metaMats[roomMat] ?? 0) + (run.materials?.[roomMat] ?? 0) : 0;
  const matRef = useRef<HTMLSpanElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const [coins, setCoins] = useState<{ id: number; x: number; y: number; dx: number; dy: number; m: Material; go: boolean }[]>([]);
  const [matPulse, setMatPulse] = useState(0);
  const [sparkle, setSparkle] = useState(0);
  const [readyLabel, setReadyLabel] = useState<string | null>(null);
  const codex = useMeta((m) => m.codex ?? {});
  const [bossLine, setBossLine] = useState(() => (boss ? pickLine(boss, 'greet') : ''));
  useEffect(() => {
    if (!boss || !lastFx) return;
    if (lastFx.kind === 'hit' && lastFx.amount > 0) setBossLine(pickLine(boss, 'userBlunder', Math.random(), { piece: 'piece', move: '' }));
    if (lastFx.kind === 'relic') setBossLine(pickLine(boss, 'userGoodMove'));
  }, [lastFx, boss]);

  // The latest slip (mistake/blunder) in a game room, explained by the coach until you move on.
  const lastMove = room.moves[room.moves.length - 1];
  const [slipSeen, setSlipSeen] = useState(-1);
  const slipIdx = !room.puzzle && lastMove && (lastMove.cls === 'mistake' || lastMove.cls === 'blunder') ? room.moves.length - 1 : -1;
  const slip = slipIdx >= 0 && slipSeen !== slipIdx && room.status === 'playing' ? lastMove : null;
  const why = useMemo(() => {
    if (!slip) return null;
    try {
      return explainMove({ fenBefore: slip.fenBefore, uci: slip.uci, before: slip.before ?? null, after: slip.after ?? null, classification: slip.cls });
    } catch {
      return null;
    }
  }, [slip]);
  const takeBack = canTakeBack(run);
  const lines = gaugeLines(room, bossOf(run));

  const live = roomScore(room);
  const capReached = room.status === 'playing' && roomLoss(room) >= roomCap(room);
  const viewing = view !== null ? room.moves[view] : null;
  const mat = material(room.fen, room.startFen);
  const target = chipTarget(room);
  const me = room.me;
  const lastPly = room.plies[room.plies.length - 1];
  const sealed = mod?.sealed ?? [];

  const viewingNow = view !== null;
  const arrows: CoachArrow[] = [];
  if (s.aids.eye) arrows.push(arrowOf(s.aids.eye, 'good'));
  if (s.aids.cards) s.aids.cards.forEach((u) => arrows.push(arrowOf(u, 'info')));
  if (s.answer) arrows.push(s.answer);
  // Duel: the book move for the first moves (or the engine's suggestion once the book runs out).
  const myTurn = !viewingNow && room.status === 'playing' && new Chess(room.fen).turn() === room.me;
  const bookUci = myTurn ? bookHint(room) : null;
  const book = bookUci ?? (myTurn && room.node.kind === 'duel' && room.moves.length < T.rooms.duel.hintMoves && s.cur?.fen === room.fen ? s.cur.a.bestMove : null);
  if (book) arrows.push(arrowOf(book, 'info'));
  if (s.aids.verdict) arrows.push(arrowOf(s.aids.verdict.uci, s.aids.verdict.label === 'safe' ? 'good' : s.aids.verdict.label === 'shadow' ? 'info' : 'bad'));
  if (s.aids.verdict?.reply) arrows.push(arrowOf(s.aids.verdict.reply, 'bad'));
  const q = room.mirror && room.mirror.fen === room.fen && room.status === 'playing' ? room.mirror : null;
  if (q && !q.picked) q.choices.forEach((u) => arrows.push(arrowOf(u, 'info')));
  if (q?.picked) arrows.push(arrowOf(q.answer, 'bad'));
  if (why && !s.busy) arrows.push(...why.arrows.slice(0, 2));
  const highlights = useMemo(() => (s.aids.lens ? lensMarks(room.fen, me) : []), [s.aids.lens, room.fen, me]);

  const playing = room.status === 'playing';
  const canRewind = run.consumables.includes('rewind') && room.moves.length > 0 && (!room.puzzle || room.puzzle.lost) && room.plies.some((p) => p.by === 'me');
  const hr = heatRules(run.heat);
  const showGauge = !room.puzzle && !hr.evalHidden;
  const ev = liveEval(s.cur, room.fen, me) ?? (room.moves.length ? room.moves[room.moves.length - 1].evalAfter : room.startEval);
  // The warning follows the live position: if they missed your slip, you're already safe again.
  const rec0 = recovery(room, bossOf(run));
  const rec = rec0 && (rec0.overtime || lines.floor === undefined || ev < lines.floor) ? rec0 : null;
  const relicsShown: (RelicId | 'rival')[] = [...run.relics, ...(isBoss ? (['rival'] as const) : [])];

  return (
    <div className="flex h-full flex-col">
      {vs && <VsIntro bossId={run.bossId} rule={rivalRule(run)} cursed={run.cursed} onDone={() => setVs(false)} />}
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
              <PixelText text={room.gamble ? 'The Gamble' : ROOM_NAME[room.node.kind as RoomKind]} size={2.5} className="mt-0.5" />
            </div>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <Composure value={run.composure} max={T.composure.start} hit={hit?.insured ? undefined : hit?.id} />
            <div className="flex items-center gap-1">
              {roomMat && (
                <span ref={matRef} key={sparkle} className={`mr-1 flex items-center gap-0.5 ${sparkle ? 'run-sparkle' : ''}`}>
                  <MaterialIcon id={roomMat} size={14} />
                  <span key={matPulse} className={`run-sans text-xs font-black tabular-nums ${matPulse ? 'run-pulse' : ''}`} style={{ color: MATERIAL_INFO[roomMat].color }}>
                    {Math.floor(matTotal)}
                  </span>
                </span>
              )}
              <Sprite name="coin" size={16} px={10} stroke={5} />
              <PixelNum value={run.gold} size={3} />
              <button onClick={onSettings} aria-label="Settings" className="ml-1">
                <Sprite name="gear" size={20} px={12} />
              </button>
            </div>
          </div>
        </div>
        {room.echo && (
          <div className="run-sans mt-1.5 rounded bg-black/35 px-2 py-1 text-xs text-[var(--ink-dim)]">
            From your game on {new Date(room.echo.when).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}: you played <b className="text-[var(--blood)]">{room.echo.played}</b> here. Not this time.
          </div>
        )}
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
            <PixelNum value={live.chips} big size={2.5} color="var(--chip)" />
          </div>
          <PixelNum value="×" size={2.5} color="var(--ink-dim)" glow={false} />
          <div className="flex items-center gap-1 rounded bg-[var(--mult)]/20 px-2 py-1 ring-1 ring-[var(--mult)]/50">
            <PixelNum value={live.mult} size={2.5} color="var(--mult)" />
          </div>
          <FervorFlame value={room.fervor ?? 1} size={0.8} />
          {target > 0 && (
            <div className="run-sans flex flex-col text-[9px] leading-tight font-bold">
              <span className="text-[var(--ink-dim)]">BLIND</span>
              <span style={{ color: live.score >= target ? '#5ee59a' : 'var(--ink)' }}>
                {fmtBig(live.score)}/{fmtBig(target)}
              </span>
            </div>
          )}
          <div className="run-sans ml-auto text-right text-xs leading-tight font-semibold text-[var(--ink-dim)]">
            <div>{progress(room, bossOf(run))}</div>
            {showGauge && (
              <div className="font-bold" style={{ color: evalWord(ev).color }}>
                {evalWord(ev).text}
              </div>
            )}
          </div>
        </div>
        {roomMat && (
          <div className="run-sans mt-1 flex items-center gap-1.5 text-[11px] font-bold" style={{ color: MATERIAL_INFO[roomMat].color }}>
            <MaterialIcon id={roomMat} size={11} /> {MATERIAL_INFO[roomMat].name} +{rate} / good move
            {room.rateChange && room.moves.length < 3 && (
              <span className="run-fadeup ml-1 rounded bg-[#5ee59a]/15 px-1.5 text-[#9ff0c0]">
                ↑ {room.rateChange.from} → {room.rateChange.to}
              </span>
            )}
            {readyLabel && <span className="run-fadeup ml-auto rounded bg-[#5ee59a]/20 px-1.5 text-[#9ff0c0]">READY: {readyLabel}</span>}
          </div>
        )}
        {/* Codex: equipped techniques (their own row, above the relics) */}
        {(run.techniques ?? []).length > 0 && (
          <div className="mt-2 flex items-center gap-1.5">
            {run.techniques!.map((id) => {
              const lvl = techLevel(codex[id]?.uses);
              const p = pulse[`tech:${id}`];
              return (
                <span key={id} className={`tech-chip lvl-${lvl} relative flex items-center gap-1 px-1.5 py-0.5`}>
                  <span key={p?.id} className={`flex items-center gap-1 ${p ? 'run-pulse' : ''}`}>
                    <Sprite name={techById(id).glyph} size={16} px={10} pal={EMBER} />
                    <span className="run-sans text-[10px] font-black">{techById(id).name}</span>
                  </span>
                </span>
              );
            })}
          </div>
        )}
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
        {showGauge && <EvalGauge cp={ev} {...lines} thinking={s.busy} danger={!!rec} noNumber={hr.evalWordsOnly} />}
        <div className="relative min-w-0 flex-1">
          <PixelCaptured pieces={mat.lost[me === 'w' ? 'b' : 'w']} color={me === 'w' ? 'b' : 'w'} lead={me === 'w' ? mat.diff : -mat.diff} />
          <div className="relative" ref={boardRef}>
          <RunBoard
            fen={viewing ? viewing.fenAfter : room.fen}
            orientation={me === 'w' ? 'white' : 'black'}
            movable={!viewing && playing && !s.busy && !s.asking && !s.aids.verdict && !room.puzzle?.lost && !(q && !q.picked) ? me : null}
            onMove={(m) => s.userMove(toUci(m))}
            arrows={viewing ? [] : arrows}
            highlights={viewing ? [] : highlights}
            lastMove={viewing ? { from: viewing.uci.slice(0, 2), to: viewing.uci.slice(2, 4) } : lastPly ? { from: lastPly.uci.slice(0, 2), to: lastPly.uci.slice(2, 4) } : null}
            showCoordinates={showCoords}
            dimmed={!!viewing}
          />
          {burst && !viewing && <Burst key={burst.id} {...burst} orientation={me === 'w' ? 'white' : 'black'} />}
          </div>
          <PixelCaptured pieces={mat.lost[me]} color={me} lead={me === 'w' ? -mat.diff : mat.diff} />
          {viewing && (
            <button onClick={() => setView(null)} className="run-panel run-fadeup absolute inset-x-6 top-1/2 z-30 -translate-y-1/2 p-2 text-center">
              <div className="run-label">Looking back · your move {view! + 1}: {viewing.san}</div>
              <div className="run-sans text-sm font-bold text-[var(--gold-2)]">Tap to return to the game</div>
            </button>
          )}
          {used && <UsedCard key={used.id} item={used.item} />}
          {coins.length > 0 &&
            createPortal(
              coins.map((k) => (
                <span key={k.id} className="run-coin-fly" style={{ left: k.x - 7, top: k.y - 7, transform: k.go ? `translate(${k.dx}px, ${k.dy}px) scale(0.7)` : 'translate(0,0) scale(1.3)', opacity: k.go ? 0.9 : 1 }}>
                  <MaterialIcon id={k.m} size={18} />
                </span>
              )),
              document.body,
            )}
          {techFx && (
            <div key={techFx.id} className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center">
              <div className="run-slam tech-banner flex flex-col items-center px-4 py-2">
                <Sprite name={techById(techFx.tech).glyph} size={44} px={16} pal={EMBER} />
                <PixelText text={techById(techFx.tech).name} size={3} color="#ffe7a3" />
                <PixelNum value={techFx.label} size={4} color="var(--mult)" />
              </div>
            </div>
          )}
          {s.aids.verdict && <VerdictPanel />}
          {!playing && <EndBanner canRewind={canRewind} takeBack={takeBack} />}
          {playing && room.puzzle?.lost && <PuzzleLost canRewind={canRewind} takeBack={takeBack} />}
        </div>
      </div>

      {rec && (
        <div className="run-sans run-danger mx-3 mt-1.5 flex items-center gap-2 px-2 py-1 text-xs font-bold text-[#ffd0d6]">
          <Sprite name="skull" size={14} px={10} pal={BLOOD} />
          {rec.overtime
            ? `Not there yet — ${rec.left} extra move${rec.left === 1 ? '' : 's'} to reach the goal.`
            : `Below the red line! Get back above it — ${rec.left} move${rec.left === 1 ? '' : 's'} left.`}
        </div>
      )}
      {s.asking && <div className="run-sans mx-3 mt-1.5 animate-pulse text-center text-xs text-[var(--ink-dim)]">The mirror clouds over…</div>}
      {q && !viewingNow && <MirrorPanel q={q} fen={room.fen} onPick={s.mirrorPick} />}
      {slip && !viewingNow && (
        <SlipNote
          cls={slip.cls}
          lost={slip.composureLost}
          text={why?.text.slice(0, 2) ?? []}
          best={why?.bestSan}
          takeBack={takeBack && !s.busy}
          left={takebacksLeft(run)}
          onTakeBack={() => s.rewind(true)}
          onClose={() => setSlipSeen(slipIdx)}
        />
      )}
      {/* Move recap */}
      <div className="mt-1.5 flex min-h-6 items-center gap-1 overflow-hidden px-3">
        {room.moves.slice(-7).map((m, i) => {
          const idx = Math.max(0, room.moves.length - 7) + i;
          return (
            <button
              key={idx}
              onClick={() => setView(view === idx || idx === room.moves.length - 1 && !room.puzzle ? null : idx)}
              className="run-fadeup run-sans flex items-center gap-1 bg-black/35 px-1.5 py-0.5 text-[11px] font-bold whitespace-nowrap"
              style={{ boxShadow: `inset 0 -2px 0 ${CLS_COLOR[m.cls]}${view === idx ? ', 0 0 0 1px var(--gold-2)' : ''}` }}
            >
              <span className="h-1.5 w-1.5" style={{ background: CLS_COLOR[m.cls] }} />
              {m.san}
            </button>
          );
        })}
        {book && <span className="run-sans flex items-center gap-1 bg-[#6fd3ff]/15 px-1.5 py-0.5 text-[11px] font-bold whitespace-nowrap text-[#9fe0ff]">{bookUci ? 'Book' : 'Hint'}: {uciToSan(room.fen, book)}</span>}
        {capReached && (
          <span className="run-sans flex items-center gap-1 bg-[#5ee59a]/15 px-1.5 py-0.5 text-[11px] font-bold whitespace-nowrap text-[#9ff0c0]">
            <Sprite name="shield" size={12} px={10} /> No more candles lost here
          </span>
        )}
        {room.moves.length === 0 && !book && <span className="run-sans text-[11px] text-[var(--ink-dim)]">{me === 'w' ? 'You play White.' : 'You play Black.'} Your moves will show here.</span>}
      </div>

      {/* Cards */}
      <div className="mt-auto px-3 pb-3">
        <div className="run-label mb-1.5 flex justify-between">
          <span>Cards ({run.consumables.length}/{cardSlots(run)})</span>
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

const spriteOf = (k: RoomKind) => ROOM_SPRITE[k];

/** Your-POV eval in plain words. */
function evalWord(cp: number): { text: string; color: string } {
  if (cp >= 9000) return { text: 'Mate ahead!', color: '#5ee59a' };
  if (cp <= -9000) return { text: 'Mate threatened', color: 'var(--blood)' };
  if (cp >= 500) return { text: 'Winning', color: '#5ee59a' };
  if (cp >= 200) return { text: 'Clearly better', color: '#9ff0c0' };
  if (cp >= 60) return { text: 'Slightly better', color: '#cfe8a0' };
  if (cp > -60) return { text: 'About equal', color: 'var(--ink)' };
  if (cp > -200) return { text: 'Slightly worse', color: '#ffd36b' };
  if (cp > -500) return { text: 'Clearly worse', color: '#ffb454' };
  return { text: 'Losing', color: 'var(--blood)' };
}

/** 0..100 bar position on a soft win-chance curve: small slips nudge it, only big swings move it far. */
const barPct = (cp: number) => {
  const v = Math.max(-1000, Math.min(1000, cp));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * T.gauge.softness * v)) - 1);
};

/** Vertical eval meter (your POV) with the room's red line and goal. Tap to show the number. */
function EvalGauge({ cp, floor, goal, thinking, danger, noNumber }: { cp: number; floor?: number; goal?: number; thinking: boolean; danger?: boolean; noNumber?: boolean }) {
  const [num, setNum] = useState(false);
  const pos = (v: number) => 100 - barPct(v); // % from top
  const p = pos(cp);
  return (
    <button
      onClick={() => !noNumber && setNum((x) => !x)}
      aria-label={noNumber ? 'Evaluation' : `Evaluation ${fmtCp(cp)}`}
      className={`relative w-4 shrink-0 ${danger ? 'run-danger-bar' : ''}`}
      style={{ background: 'linear-gradient(#1b0f22,#1b0f22)', boxShadow: '0 0 0 2px #1b0f22, inset 0 0 0 1px rgba(242,199,92,.35)' }}
    >
      {/* filled part = your side (from the bottom) */}
      <div className="absolute inset-x-0 bottom-0 transition-[height] duration-700 ease-out" style={{ height: `${100 - p}%`, background: 'repeating-linear-gradient(0deg, #e0a93a 0 3px, #c48f2a 3px 4px)' }} />
      <div className="absolute inset-x-0 top-1/2 h-px bg-white/30" />
      {floor !== undefined && (
        <div className={`absolute inset-x-[-3px] h-[3px] ${danger ? 'animate-pulse' : ''}`} style={{ top: `${pos(floor)}%`, background: 'var(--blood)', boxShadow: '0 0 6px var(--blood)' }} />
      )}
      {goal !== undefined && <div className="absolute inset-x-[-3px] h-[3px]" style={{ top: `${pos(goal)}%`, background: '#5ee59a', boxShadow: '0 0 6px #5ee59a' }} />}
      {num && !noNumber && (
        <div className={`run-sans absolute left-1/2 z-10 -translate-x-1/2 rounded bg-black/85 px-0.5 text-[8px] font-black whitespace-nowrap text-[var(--gold-2)] ${thinking ? 'opacity-60' : ''}`} style={{ top: `calc(${Math.max(4, Math.min(92, p))}% - 6px)` }}>
          {fmtCp(cp).replace('+', '')}
        </div>
      )}
    </button>
  );
}

/** What just went wrong, in the coach's words — with the free take-back when the difficulty has one. */
function SlipNote({ cls, lost, text, best, takeBack, left, onTakeBack, onClose }: {
  cls: Classification; lost: number; text: string[]; best?: string; takeBack: boolean; left: number; onTakeBack: () => void; onClose: () => void;
}) {
  const color = CLS_COLOR[cls];
  return (
    <div className="run-panel run-fadeup mx-3 mt-1.5 p-2.5" style={{ boxShadow: `0 0 0 2px #1b0f22, inset 0 0 0 1px ${color}` }}>
      <div className="flex items-center gap-2">
        <span className="run-sans text-xs font-black uppercase" style={{ color }}>
          {cls}
        </span>
        <span className="run-sans text-xs text-[var(--ink-dim)]">{lost > 0 ? `−${lost} candle${lost === 1 ? '' : 's'}` : 'no candle lost'}</span>
        <button className="run-sans ml-auto text-xs font-bold text-[var(--ink-dim)]" onClick={onClose} aria-label="Dismiss">
          ✕
        </button>
      </div>
      <div className="run-sans mt-1 text-[13px] leading-snug">
        {text.length ? text.join(' ') : best ? `${best} was stronger.` : 'That gave your opponent a chance.'}
      </div>
      {takeBack && (
        <button className="run-btn mt-2 w-full py-1.5! text-sm" onClick={onTakeBack}>
          Take it back (free · {left} left in this room)
        </button>
      )}
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
      const m = rivalRule(run);
      title = m.name;
      text = (MODIFIERS.rival.text || '') + ' ' + bossModText(m) + (m.nemesis && run.nemesis ? ` Nemesis: ${NEMESIS_WHY[run.nemesis] ?? ''}` : '');
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

/** The Mirror: name the opponent's most dangerous idea before your move. */
function MirrorPanel({ q, fen, onPick }: { q: NonNullable<RoomState['mirror']>; fen: string; onPick: (u: string) => void }) {
  const nf = fen.split(' ');
  nf[1] = nf[1] === 'w' ? 'b' : 'w';
  nf[3] = '-';
  const san = (u: string) => {
    try {
      return uciToSan(nf.join(' '), u);
    } catch {
      return u;
    }
  };
  if (q.picked) {
    const ok = q.picked === q.answer;
    return (
      <div className={`run-sans run-fadeup mx-3 mt-1.5 px-2 py-1 text-xs font-bold ${ok ? 'text-[#9ff0c0]' : 'text-[#ffb3bd]'}`} style={{ background: ok ? 'rgba(94,229,154,.12)' : 'rgba(226,71,90,.15)' }}>
        {ok ? `✓ Right read: their threat is ${san(q.answer)}. Now play your move.` : `✕ Misread — their real idea is ${san(q.answer)} (red arrow). This move's chips are halved.`}
      </div>
    );
  }
  return (
    <div className="run-panel run-fadeup mx-3 mt-1.5 p-2">
      <div className="run-label">The Mirror · if it were their move, what would hurt most?</div>
      <div className="mt-1.5 flex gap-1.5">
        {q.choices.map((u) => (
          <button key={u} className="run-btn ghost flex-1 px-1! py-1.5! text-sm" onClick={() => onPick(u)}>
            {san(u)}
          </button>
        ))}
      </div>
    </div>
  );
}

function VerdictPanel() {
  const s = useRun();
  const v = s.aids.verdict!;
  const room = s.run!.room!;
  if (v.label === 'shadow') {
    let reply = '';
    try {
      reply = v.reply ? uciToSan(tryMove(room.fen, v.uci)!.fen, v.reply) : '';
    } catch {
      /* ignore */
    }
    return (
      <div className="absolute inset-x-4 bottom-4 z-30">
        <div className="run-panel run-fadeup p-3 text-center">
          <div className="run-label">Shadow on {uciToSan(room.fen, v.uci)}</div>
          <div className="run-sans mt-1 text-sm">{reply ? <>Their likeliest reply: <b className="text-[var(--blood)]">{reply}</b> (red arrow)</> : 'No reply — the game would end.'}</div>
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
  const color = v.label === 'safe' ? '#5ee59a' : v.label === 'risky' ? '#ffb454' : 'var(--blood)';
  return (
    <div className="absolute inset-x-4 bottom-4 z-30">
      <div className="run-panel run-fadeup p-3 text-center">
        <div className="run-label">{v.fromCheck ? 'Blunder Check' : 'Second Opinion'} on {uciToSan(room.fen, v.uci)}</div>
        <div className="run-title mt-1 text-3xl font-black uppercase" style={{ color, textShadow: `0 0 18px ${color}` }}>
          {v.label}
        </div>
        <div className="mt-3 flex gap-2">
          <button className="run-btn ghost flex-1" onClick={() => s.confirmVerdict(false)}>
            Choose again
          </button>
          <button className="run-btn flex-1" onClick={() => s.confirmVerdict(true)}>
            {v.fromCheck ? 'Play anyway' : 'Play it'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EndBanner({ canRewind, takeBack }: { canRewind: boolean; takeBack: boolean }) {
  const s = useRun();
  const run = s.run!;
  const room = run.room!;
  const won = room.status === 'won';
  const broke = run.composure <= 0;
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/45 p-4" onClick={() => !canRewind && !takeBack && s.closeRoom()}>
      <div className="run-panel run-slam w-full max-w-xs p-4 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center">
          <Sprite name={won ? 'check' : broke ? 'candle' : 'cross'} size={44} px={14} pal={won ? GOLD : BLOOD} />
        </div>
        <div className="run-title text-3xl font-black" style={{ color: won ? 'var(--gold-2)' : 'var(--blood)' }}>
          {won ? 'Room cleared' : broke ? 'Composure broken' : 'Room failed'}
        </div>
        <div className="run-sans mt-1 text-sm text-[var(--ink-dim)]">{room.reason}</div>
        <div className="mt-4 flex gap-2">
          {!won && takeBack ? (
            <button className="run-btn flex-1" onClick={() => s.rewind(true)}>
              Take back (free)
            </button>
          ) : (
            !won &&
            canRewind && (
              <button className="run-btn ghost flex-1" onClick={() => s.rewind()}>
                Rewind
              </button>
            )
          )}
          <button className={`run-btn flex-1 ${broke ? 'danger' : ''} ${!won && takeBack ? 'ghost' : ''}`} onClick={() => s.closeRoom()}>
            {broke ? 'Debrief' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PuzzleLost({ canRewind, takeBack }: { canRewind: boolean; takeBack: boolean }) {
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
          {takeBack ? (
            <button className="run-btn ghost flex-1" onClick={() => s.rewind(true)}>
              Try again (free)
            </button>
          ) : (
            canRewind && (
              <button className="run-btn ghost flex-1" onClick={() => s.rewind()}>
                Rewind
              </button>
            )
          )}
          <button className="run-btn flex-1" disabled={s.busy} onClick={() => s.nextPuzzle()}>
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

/** Pixel shards from a taken piece, or a gold flash for a promotion. */
function Burst({ sq, kind, color, orientation }: { sq: string; kind: 'shatter' | 'promote'; color: 'w' | 'b'; orientation: 'white' | 'black' }) {
  const f = sq.charCodeAt(0) - 97;
  const r = Number(sq[1]) - 1;
  const col = orientation === 'white' ? f : 7 - f;
  const row = orientation === 'white' ? 7 - r : r;
  const left = `calc(5px + (100% - 10px) * ${(col + 0.5) / 8})`;
  const top = `calc(5px + (100% - 10px) * ${(row + 0.5) / 8})`;
  const shards = kind === 'promote' ? ['#fff6d0', '#ffe08a', '#f2c75c'] : color === 'w' ? ['#f1e2b8', '#cdb47c', '#8c7448'] : ['#a888e0', '#6a46a8', '#3c2466'];
  const n = kind === 'promote' ? 16 : 12;
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {kind === 'promote' && <span className="run-promo absolute" style={{ left, top }} />}
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 + (i % 3) * 0.3;
        const d = 18 + (i % 4) * 9;
        return (
          <span
            key={i}
            className="run-shard absolute"
            style={{ left, top, background: shards[i % 3], ['--dx' as string]: `${Math.cos(a) * d}px`, ['--dy' as string]: `${Math.sin(a) * d - 8}px`, animationDelay: `${(i % 3) * 20}ms` }}
          />
        );
      })}
    </div>
  );
}
