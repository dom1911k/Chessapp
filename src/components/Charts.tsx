import { povScore, winPct } from '../lib/chess/evaluation';
import type { PlyRecord } from '../lib/store/types';

const MARK: Record<string, string> = { blunder: '#dc2626', mistake: '#ea580c', inaccuracy: '#d97706' };

/** White's winning chances over the game; tap a point to jump to that move. */
export function EvalGraph({ plies, current, onSelect }: { plies: PlyRecord[]; current?: number; onSelect?: (i: number) => void }) {
  const W = 320;
  const H = 110;
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
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full touch-none rounded-xl bg-stone-700"
      onClick={(e) => {
        if (!onSelect || !plies.length) return;
        const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
        const i = Math.round(((e.clientX - r.left) / r.width) * n) - 1;
        onSelect(Math.max(0, Math.min(plies.length - 1, i)));
      }}
    >
      <path d={area} fill="#f5f5f4" />
      <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="#a8a29e" strokeDasharray="3 3" strokeWidth="0.8" />
      {current !== undefined && <line x1={x(current + 1)} x2={x(current + 1)} y1="0" y2={H} stroke="#2f9e63" strokeWidth="2" />}
      {plies.map((p, i) =>
        p.isUser && p.classification && MARK[p.classification] ? (
          <circle key={i} cx={x(i + 1)} cy={y(pts[i + 1][1])} r="4" fill={MARK[p.classification]} stroke="#fff" strokeWidth="1.2" />
        ) : null,
      )}
    </svg>
  );
}

/** Minimal line chart for progress stats. */
export function LineChart({ values, labels, height = 120, color = '#2f9e63' }: { values: number[]; labels?: [string, string]; height?: number; color?: string }) {
  const W = 320;
  const H = height;
  if (values.length < 2) return <div className="flex h-24 items-center justify-center text-sm text-stone-400">Not enough data yet</div>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max(10, (max - min) * 0.1);
  const lo = min - pad;
  const hi = max + pad;
  const x = (i: number) => (i / (values.length - 1)) * (W - 8) + 4;
  const y = (v: number) => H - 14 - ((v - lo) / (hi - lo)) * (H - 24);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r="4" fill={color} />
      <text x="4" y="10" fontSize="10" fill="currentColor" opacity="0.6">{Math.round(max)}</text>
      <text x="4" y={H - 2} fontSize="10" fill="currentColor" opacity="0.6">{Math.round(min)}</text>
      {labels && (
        <>
          <text x={W / 2} y={H - 2} fontSize="10" fill="currentColor" opacity="0.6" textAnchor="middle">{labels[0]} → {labels[1]}</text>
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
