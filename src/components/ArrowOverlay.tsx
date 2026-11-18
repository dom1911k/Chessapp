// Dotted arrows drawn over a board (react-chessboard only draws solid ones). Used in Game Review for
// "your punishing reply" and "their threat". Same colours as the board's own arrows.
import { TONE_COLOR } from './Board';

export interface OverlayArrow {
  from: string;
  to: string;
  tone: 'good' | 'bad' | 'info';
}

const centre = (sq: string, white: boolean) => {
  const f = sq.charCodeAt(0) - 97;
  const r = Number(sq[1]) - 1;
  return { x: (white ? f : 7 - f) + 0.5, y: (white ? 7 - r : r) + 0.5 };
};

export function ArrowOverlay({ arrows, orientation }: { arrows: OverlayArrow[]; orientation: 'white' | 'black' }) {
  if (!arrows.length) return null;
  const white = orientation === 'white';
  return (
    <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full" viewBox="0 0 8 8" aria-hidden data-testid="dotted-arrows">
      <defs>
        {(['good', 'bad', 'info'] as const).map((t) => (
          <marker key={t} id={`dot-head-${t}`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={TONE_COLOR[t]} />
          </marker>
        ))}
      </defs>
      {arrows.map((a, k) => {
        const s = centre(a.from, white);
        const e = centre(a.to, white);
        // Stop short of the target square's centre so the head sits on it.
        const dx = e.x - s.x;
        const dy = e.y - s.y;
        const len = Math.hypot(dx, dy) || 1;
        const ex = e.x - (dx / len) * 0.3;
        const ey = e.y - (dy / len) * 0.3;
        return <line key={k} x1={s.x} y1={s.y} x2={ex} y2={ey} stroke={TONE_COLOR[a.tone]} strokeWidth={0.15} strokeDasharray="0.22 0.16" strokeLinecap="round" markerEnd={`url(#dot-head-${a.tone})`} />;
      })}
    </svg>
  );
}
