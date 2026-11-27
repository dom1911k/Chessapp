// The Puzzle Path world as a component: a small static window onto it around your pawn (the hub
// card), drawn once from the path state with the same renderer as the Path screen.
import { useEffect, useId, useRef } from 'react';
import { levelAt } from '../../lib/puzzles/path';
import { pathTag, type WPos } from '../../lib/puzzles/walk';
import { ISO } from '../../lib/puzzles/world';
import { useSettings } from '../../lib/settings';

/** Where the pawn stands for a points total (0-based level; past Legend it stays on Legend's last tile). */
export const wposOf = (points: number): WPos => {
  const p = levelAt(points);
  return p.board > 7 ? { i: 7, l: 19 } : { i: p.board, l: p.level - 1 };
};

/** A static window onto the world, centred on the pawn. Drawn at `scale` × a phone-width world. */
export function PathWindow({ points, width, height, className = '', world = 300 }: { points: number; width: number; height: number; className?: string; world?: number }) {
  const inner = useRef<HTMLDivElement>(null);
  const uid = `hw${useId().replace(/[^a-z0-9]/gi, '')}`;
  const p = wposOf(points);
  // Your avatar and frame on the pawn's tag: a change in Profile redraws it.
  const tag = useSettings((s) => `${s.avatar}|${s.avatarFrame}`);
  useEffect(() => {
    const el = inner.current;
    if (!el) return;
    const r = ISO.build(world, { b: p.i, lvl: p.l, w0: p.i, w1: Math.min(7, p.i + 1), mt: 40, uid, ...pathTag() });
    el.innerHTML = r.svg;
    const c = ISO.cell(p.i, p.l);
    const pt = ISO.sp(r.G, c.gx, c.gy) as { x: number; y: number };
    // (Low enough that your tag over the pawn's head stays in the window.)
    el.style.transform = `translate(${(width / 2 - pt.x).toFixed(1)}px,${(height * 0.7 - pt.y).toFixed(1)}px)`;
  }, [p.i, p.l, width, height, world, uid, tag]);
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ width, height, background: ISO.TH[p.i].g[0] }} aria-hidden data-testid="path-window">
      <div ref={inner} className="absolute top-0 left-0" />
      <div className="wlight" />
    </div>
  );
}
