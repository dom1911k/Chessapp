import { useId, useState } from 'react';
import { povScore, winPct } from '../lib/chess/evaluation';
import type { PlyRecord } from '../lib/store/types';

const MARK: Record<string, string> = { blunder: '#dc2626', mistake: '#ea580c', inaccuracy: '#d97706' };

/**
 * White's winning chances over the game; tap a point to jump to that move. With `times`, a strip
 * underneath shows how long each move took (yours in green, theirs in grey; a mistake played in
 * under 5 s in red, your longest thinks in amber).
 */
export function EvalGraph({ plies, current, onSelect, height = 110, times }: { plies: PlyRecord[]; current?: number; onSelect?: (i: number) => void; height?: number; times?: (number | null)[] }) {
  const W = 320;
  const H = height;
  const STRIP = times ? Math.max(18, Math.round(height * 0.32)) : 0;
  const n = Math.max(plies.length, 2);
  const pts: [number, number][] = [[0, 50]];
  let lastWp = 50;
  plies.forEach((p, i) => {
    if (p.evalAfter) lastWp = winPct(povScore(p.evalAfter, 'w'));
    pts.push([i + 1, lastWp]);
  });
  const x = (i: number) => (i / n) * W;
  const y = (wp: number) => H - (wp / 100) * H;
  const line = pts.map(([i, wp], k) => `${k ? 'L' : 'M'}${x(i).toFixed(1)},${y(wp).toFixed(1)}`).join(' ');
  const area = `${line} L${x(pts[pts.length - 1][0]).toFixed(1)},${H} L0,${H} Z`;
  // Time strip: bar height ~ sqrt(seconds), so one long think doesn't flatten everything else.
  const known = (times ?? []).filter((t): t is number => t !== null);
  const scale = Math.sqrt(Math.max(5, ...known));
  const longest = new Set(
    (times ?? [])
      .map((t, i) => ({ t, i }))
      .filter(({ t, i }) => t !== null && plies[i]?.isUser)
      .sort((a, b) => b.t! - a.t!)
      .slice(0, 3)
      .map(({ i }) => i),
  );
  const bw = Math.max(1.5, (W / n) * 0.62);
  return (
    <svg
      viewBox={`0 0 ${W} ${H + STRIP}`}
      className="w-full touch-none rounded-xl bg-stone-700"
      onClick={(e) => {
        if (!onSelect || !plies.length) return;
        const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
        const i = Math.round(((e.clientX - r.left) / r.width) * n) - 1;
        onSelect(Math.max(0, Math.min(plies.length - 1, i)));
      }}
    >
      <path d={area} fill="#f5f5f4" />
      {times && (
        <g>
          <rect x="0" y={H} width={W} height={STRIP} className="fill-[#fbf8f2] dark:fill-[#221d18]" />
          {times.map((t, i) => {
            if (t === null || !plies[i]) return null;
            const h = Math.max(1.5, (Math.sqrt(t) / scale) * (STRIP - 3));
            const p = plies[i];
            const bad = p.isUser && (p.classification === 'mistake' || p.classification === 'blunder');
            const fill = bad && t < 5 ? '#dc2626' : p.isUser ? (longest.has(i) ? '#f59e0b' : '#2f9e63') : '#a8a29e';
            return <rect key={i} x={x(i + 1) - bw / 2} y={H + STRIP - h} width={bw} height={h} rx="0.8" fill={fill} opacity={p.isUser ? 1 : 0.6} />;
          })}
        </g>
      )}
      <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="#a8a29e" strokeDasharray="3 3" strokeWidth="0.8" />
      {current !== undefined && <line x1={x(current + 1)} x2={x(current + 1)} y1="0" y2={H + STRIP} stroke="#2f9e63" strokeWidth="2" />}
      {plies.map((p, i) =>
        p.isUser && p.classification && MARK[p.classification] ? (
          <circle key={i} cx={x(i + 1)} cy={y(pts[i + 1][1])} r="4" fill={MARK[p.classification]} stroke="#fff" strokeWidth="1.2" />
        ) : null,
      )}
    </svg>
  );
}

/** A smooth path through points (monotone cubic, so it never overshoots between values). */
function smoothPath(pts: [number, number][]): string {
  if (pts.length < 3) return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const n = pts.length;
  const d = pts.slice(1).map(([x, y], i) => (y - pts[i][1]) / (x - pts[i][0]));
  const m = pts.map((_, i) => (i === 0 ? d[0] : i === n - 1 ? d[n - 2] : d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2));
  let out = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const h = (x1 - x0) / 3;
    out += ` C${(x0 + h).toFixed(1)},${(y0 + m[i] * h).toFixed(1)} ${(x1 - h).toFixed(1)},${(y1 - m[i + 1] * h).toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
  }
  return out;
}

/**
 * Line chart for progress stats: a smooth line with a soft fill underneath. Press and drag on it
 * to read an exact value (and its date, when `dates` are given).
 */
export function LineChart({ values, labels, height = 120, color = '#2f9e63', dates, suffix = '' }: { values: number[]; labels?: [string, string]; height?: number; color?: string; dates?: number[]; suffix?: string }) {
  const id = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);
  const W = 320;
  const H = height;
  if (values.length < 2) return <div className="flex h-24 items-center justify-center text-sm text-stone-400">Not enough data yet</div>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max(4, (max - min) * 0.12);
  const lo = min - pad;
  const hi = max + pad;
  const x = (i: number) => (i / (values.length - 1)) * (W - 12) + 6;
  const y = (v: number) => H - 16 - ((v - lo) / (hi - lo)) * (H - 28);
  const pts = values.map((v, i) => [x(i), y(v)] as [number, number]);
  const line = smoothPath(pts);
  const area = `${line} L${x(values.length - 1).toFixed(1)},${H - 14} L${x(0).toFixed(1)},${H - 14} Z`;
  const pick = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const fx = ((e.clientX - r.left) / r.width) * W;
    setHover(Math.max(0, Math.min(values.length - 1, Math.round(((fx - 6) / (W - 12)) * (values.length - 1)))));
  };
  const hi_ = hover ?? values.length - 1;
  const tipX = Math.max(30, Math.min(W - 30, x(hi_)));
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full touch-none select-none"
      onPointerDown={(e) => (e.currentTarget.setPointerCapture(e.pointerId), pick(e))}
      onPointerMove={(e) => hover !== null && pick(e)}
      onPointerUp={() => setHover(null)}
      onPointerCancel={() => setHover(null)}
      onPointerLeave={() => setHover(null)}
    >
      <defs>
        <linearGradient id={`fill${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.28" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1="6" x2={W - 6} y1={6 + f * (H - 22)} y2={6 + f * (H - 22)} stroke="currentColor" strokeOpacity="0.07" strokeDasharray="2 4" />
      ))}
      <path d={area} fill={`url(#fill${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {hover !== null && <line x1={x(hover)} x2={x(hover)} y1="4" y2={H - 14} stroke="currentColor" strokeOpacity="0.25" strokeDasharray="3 3" />}
      <circle cx={x(hi_)} cy={y(values[hi_])} r={hover !== null ? 5 : 4} fill={color} stroke="var(--chart-dot, #fff)" strokeWidth="2" className="[--chart-dot:#fffdf9] dark:[--chart-dot:#1d1915]" />
      {hover !== null ? (
        <g>
          <rect x={tipX - 28} y="0" width="56" height={dates ? 26 : 16} rx="6" fill="currentColor" opacity="0.9" />
          <text x={tipX} y="11.5" fontSize="10.5" fontWeight="700" textAnchor="middle" className="fill-white dark:fill-stone-900">{Math.round(values[hover])}{suffix}</text>
          {dates && <text x={tipX} y="22" fontSize="8.5" textAnchor="middle" className="fill-white/80 dark:fill-stone-900/80">{new Date(dates[hover]).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</text>}
        </g>
      ) : (
        <>
          <text x="6" y="10" fontSize="10" fill="currentColor" opacity="0.5">{Math.round(max)}{suffix}</text>
          <text x="6" y={H - 2} fontSize="10" fill="currentColor" opacity="0.5">{Math.round(min)}{suffix}</text>
          {labels && <text x={W / 2} y={H - 2} fontSize="10" fill="currentColor" opacity="0.5" textAnchor="middle">{labels[0]} → {labels[1]}</text>}
        </>
      )}
    </svg>
  );
}

/** Bar chart (e.g. blunders per game). */
export function BarChart({ values, height = 90, color = '#ea580c' }: { values: number[]; height?: number; color?: string }) {
  const W = 320;
  const H = height;
  if (!values.length) return <div className="flex h-20 items-center justify-center text-sm text-stone-400">Not enough data yet</div>;
  const max = Math.max(1, ...values);
  const bw = W / values.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {values.map((v, i) => {
        const h = (v / max) * (H - 16);
        return (
          <g key={i}>
            <rect x={i * bw + bw * 0.15} y={H - h - 12} width={bw * 0.7} height={Math.max(h, 1)} rx="2" fill={color} opacity={0.85} />
            {values.length <= 20 && (
              <text x={i * bw + bw / 2} y={H - 2} fontSize="9" textAnchor="middle" fill="currentColor" opacity="0.6">{v}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
