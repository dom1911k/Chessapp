// The act as a drawn map: rooms as seals on dark vellum, gold-ink paths between them (one or two
// per room, so routes branch and merge), landmarks, fog over far rows. Tap a room to preview it.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { opponentById } from '../../lib/people';
import { EVENTS, MODIFIERS, ROOM_NAME, ROOM_SPRITE, bossMod, bossModText, objective } from '../content';
import { isFinalCamp, reachable, rivalElo } from '../rules';
import { useRun } from '../store';
import { TUNING as T } from '../tuning';
import type { MapNode } from '../types';
import { PixelPortrait, Sprite, usePromise } from '../pixel/sprites';
import { BLOOD, GOLD, SPIRIT, textureTile } from '../pixel/pixelize';
import { sfx } from '../sfx';
import { PixelText } from './PixelText';

const ROW = 128;
const PAD = 70;
const W = 360;

const jitter = (l: number, i: number) => (((l * 7 + i * 13) % 9) - 4) * 3;

function nodeXY(layers: MapNode[][], l: number, i: number) {
  const n = layers[l].length;
  const x = n === 1 ? W / 2 : 52 + (i * (W - 104)) / (n - 1) + jitter(l, i);
  const y = PAD + (layers.length - 1 - l) * ROW + (n === 1 ? 0 : (i % 2) * 14 - 7);
  return { x, y };
}

const title = (n: MapNode, boss?: string) =>
  n.kind === 'boss' ? (boss ?? 'The Rival') : n.kind === 'event' ? EVENTS[n.event!].name : n.kind === 'camp' ? 'Campfire' : ROOM_NAME[n.kind];
const spriteOf = (n: MapNode) => (n.kind === 'event' ? EVENTS[n.event!].sprite : ROOM_SPRITE[n.kind as keyof typeof ROOM_SPRITE]);

// Little landmarks drawn on the vellum.
const MARKS: { x: number; y: number; s: string; size: number }[] = [
  { x: 14, y: 40, s: 'skull', size: 22 },
  { x: 320, y: 210, s: 'candle', size: 20 },
  { x: 22, y: 330, s: 'tower', size: 26 },
  { x: 318, y: 460, s: 'skull', size: 18 },
  { x: 16, y: 560, s: 'flame', size: 20 },
  { x: 300, y: 640, s: 'star', size: 18 },
];

export function MapView({ top }: { top: ReactNode }) {
  const s = useRun();
  const run = s.run!;
  const boss = opponentById(run.bossId);
  const options = reachable(run);
  const [sel, setSel] = useState<number | null>(options.length === 1 ? options[0] : null);
  const scroller = useRef<HTMLDivElement>(null);
  const vellum = usePromise(() => textureTile('vellum', 16, ['#140e1f', '#181125', '#1c142b', '#221a33'], 23), 'vellum', 'tx:vellum');
  const height = PAD * 2 + (run.layers.length - 1) * ROW;

  // Scroll so the current row is in view.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const { y } = nodeXY(run.layers, run.layer, 0);
    el.scrollTo({ top: Math.max(0, y - el.clientHeight * 0.55), behavior: 'smooth' });
  }, [run.layer, run.layers]);

  const edges = useMemo(() => {
    const out: { x1: number; y1: number; x2: number; y2: number; state: 'done' | 'open' | 'idle' }[] = [];
    run.layers.forEach((row, l) => {
      if (l === run.layers.length - 1) return;
      row.forEach((n, i) => {
        for (const j of n.next ?? run.layers[l + 1].map((_, k) => k)) {
          const a = nodeXY(run.layers, l, i);
          const b = nodeXY(run.layers, l + 1, j);
          const done = run.path[l] === i && run.path[l + 1] === j && l + 1 < run.layer;
          const open = l === run.layer - 1 && run.path[l] === i;
          out.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, state: done ? 'done' : open ? 'open' : 'idle' });
        }
      });
    });
    return out;
  }, [run.layers, run.path, run.layer]);

  const node = sel !== null ? run.layers[run.layer][sel] : null;
  return (
    <div className="flex h-full flex-col">
      {top}
      <div ref={scroller} className="relative mx-3 mt-2 min-h-0 flex-1 overflow-y-auto" style={{ boxShadow: 'inset 0 0 0 2px #1b0f22, inset 0 0 0 4px #5a3a12, inset 0 0 50px rgba(0,0,0,.85)' }}>
        <div className="relative mx-auto" style={{ width: W, height, backgroundImage: vellum ? `url(${vellum})` : undefined, backgroundSize: '64px 64px', imageRendering: 'pixelated' }}>
          {/* Landmarks */}
          {MARKS.filter((m) => m.y < height).map((m, i) => (
            <span key={i} className="absolute opacity-35" style={{ left: m.x, top: m.y }}>
              <Sprite name={m.s} size={m.size} px={12} pal={GOLD} />
            </span>
          ))}
          <div className="absolute top-2 right-2 opacity-60">
            <PixelText text="Act I" size={2} color="#c9a6ff" glow={false} />
          </div>
          {/* Paths */}
          <svg className="absolute inset-0" width={W} height={height} shapeRendering="crispEdges">
            {edges.map((e, i) => (
              <line
                key={i}
                x1={e.x1}
                y1={e.y1}
                x2={e.x2}
                y2={e.y2}
                stroke={e.state === 'idle' ? 'rgba(224,169,58,.28)' : '#f2c75c'}
                strokeWidth={e.state === 'idle' ? 2 : 3}
                strokeDasharray={e.state === 'done' ? undefined : '4 5'}
                className={e.state === 'open' ? 'run-march' : undefined}
                style={e.state !== 'idle' ? { filter: 'drop-shadow(0 0 4px rgba(242,199,92,.8))' } : undefined}
              />
            ))}
          </svg>
          {/* Fog over rows beyond the next one */}
          {run.layers.map((row, l) =>
            l > run.layer + (run.meta?.boosts.cartographer ? 2 : 1) && row[0].kind !== 'boss' ? (
              <div key={`f${l}`} className="run-fog pointer-events-none absolute inset-x-0" style={{ top: nodeXY(run.layers, l, 0).y - ROW / 2, height: ROW, opacity: 0.85 }} />
            ) : null,
          )}
          {/* Rooms */}
          {run.layers.map((row, l) =>
            row.map((n, i) => {
              const { x, y } = nodeXY(run.layers, l, i);
              const current = l === run.layer;
              const can = current && options.includes(i);
              const chosen = run.path[l] === i && l < run.layer;
              const res = chosen ? run.results.find((r) => r.layer === l) : undefined;
              const isBoss = n.kind === 'boss';
              const ring = isBoss || n.elite ? '#e2475a' : n.kind === 'event' ? '#6fd3ff' : n.kind === 'camp' ? '#5ee59a' : '#e0a93a';
              const size = isBoss ? 72 : 54;
              return (
                <button
                  key={`${l}-${i}`}
                  disabled={!can}
                  onClick={() => {
                    setSel(i);
                    sfx('card');
                  }}
                  className={`absolute flex flex-col items-center ${can ? 'run-node-open' : ''} ${current && !can ? 'opacity-30' : ''} ${l < run.layer && !chosen ? 'opacity-25' : ''}`}
                  style={{ left: x - 50, top: y - size / 2, width: 100 }}
                >
                  <span
                    className="flex items-center justify-center rounded-full"
                    style={{
                      width: size,
                      height: size,
                      background: isBoss ? 'radial-gradient(#4a1020, #1f0812)' : 'radial-gradient(#2e1d4a, #140d20)',
                      boxShadow: `0 0 0 2px #1b0f22, 0 0 0 4px ${ring}, 0 0 0 6px #1b0f22${sel === i && current ? `, 0 0 22px 4px ${ring}` : can ? `, 0 0 14px ${ring}` : ''}`,
                    }}
                  >
                    {isBoss && boss ? (
                      <PixelPortrait id={boss.id} size={58} px={32} boss className="run-boss-glow" />
                    ) : (
                      <Sprite name={spriteOf(n)} size={34} px={16} pal={n.elite ? BLOOD : n.kind === 'event' ? SPIRIT : GOLD} />
                    )}
                  </span>
                  <span className="run-sans mt-1.5 rounded bg-black/55 px-1 text-[10px] leading-tight font-bold whitespace-nowrap text-[var(--ink)]">
                    {n.elite ? '☠ ' : ''}
                    {title(n, boss?.name)}
                  </span>
                  {chosen && (
                    <span className={`run-sans text-[10px] font-black ${res ? (res.won ? 'text-[#5ee59a]' : 'text-[var(--blood)]') : 'text-[#6fd3ff]'}`}>{res ? (res.won ? `✓ ${res.score}` : '✕') : '✓'}</span>
                  )}
                  {chosen && <span className="absolute -top-1 right-5 h-3 w-3" style={{ background: '#5ee59a', boxShadow: '0 0 0 2px #1b0f22' }} />}
                </button>
              );
            }),
          )}
        </div>
      </div>
      {/* Preview of the selected node: everything the old intro screen said, plus Enter */}
      <div className="px-3 pt-2 pb-3">
        {node ? <Preview key={sel} node={node} onEnter={() => s.chooseNode(sel!)} busy={s.busy} /> : (
          <div className="run-sans py-3 text-center text-xs text-[var(--ink-dim)]">
            Choose where to go next — {options.length} path{options.length === 1 ? '' : 's'} open. Tap a glowing room.
            {run.layer === 0 ? ` You have ${T.composure.start} candles.` : ''}
          </div>
        )}
      </div>
    </div>
  );
}

function Preview({ node, onEnter, busy }: { node: MapNode; onEnter: () => void; busy: boolean }) {
  const run = useRun((x) => x.run!);
  const isBoss = node.kind === 'boss';
  const boss = isBoss ? opponentById(run.bossId) : undefined;
  const mod = bossMod(run.bossId);
  const room = node.kind !== 'event' && node.kind !== 'camp';
  const focused = room && !isBoss && run.springDebt;
  const modifier = focused ? 'focused' : node.modifier;
  const d = T.difficulty[run.difficulty ?? 'adept'];
  const c = (n: number) => (n ? `−${n}` : 'free');
  const lastCamp = node.kind === 'camp' && isFinalCamp({ layers: run.layers, layer: run.layer }) && !run.curseDecided;
  return (
    <div className="run-panel run-fadeup max-h-[42vh] overflow-y-auto p-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="run-label">
            {node.kind === 'event' ? 'Event' : node.kind === 'camp' ? 'Rest stop' : isBoss ? `Rival's rule · ${mod.name}` : `${node.elite ? 'Elite · ' : ''}${MODIFIERS[modifier].name}`}
          </div>
          <div className="run-title text-lg leading-tight font-bold">
            {title(node, boss?.name)}
            {boss && <span className="run-sans ml-1.5 text-xs font-semibold text-[var(--ink-dim)]">plays like ~{rivalElo(run)}</span>}
          </div>
        </div>
        <button className="run-btn shrink-0" disabled={busy} onClick={onEnter}>
          {busy ? '…' : node.kind === 'camp' ? 'Rest' : node.kind === 'event' ? 'Step in' : 'Enter'}
        </button>
      </div>
      <div className="run-sans mt-1 text-[13px] leading-snug">{objective(node, isBoss ? mod : undefined, run.difficulty)}</div>
      {room && (
        <div className="run-sans mt-1.5 space-y-1 text-xs leading-snug text-[var(--ink-dim)]">
          <div>{isBoss ? bossModText(mod) : MODIFIERS[modifier].text}{focused ? ' (the Healing Spring’s price)' : ''}</div>
          {node.elite && <div className="text-[#ff8c9a]">Elite: harder goal and opponent; clearing it always gives a relic pick.</div>}
          <div>
            {d.name}: mistake {c(d.cost.mistake)}, blunder {c(d.cost.blunder)}.{d.takebacks ? ` ${d.takebacks} free take-back.` : ''}{' '}
            {isBoss ? 'Losing to the rival ends the run.' : `At most ${T.composure.roomCap} candles here.`}
          </div>
        </div>
      )}
      {lastCamp && <div className="run-sans mt-1.5 text-xs text-[#ff8c9a]">The rival's envoy waits by this fire with an offer…</div>}
    </div>
  );
}
