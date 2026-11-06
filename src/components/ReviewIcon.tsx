// The move-classification badge used everywhere (review, move strip, coach): a coloured circle
// with the class symbol, like the icons chess.com players know.
import { RC, type ReviewClass } from '../lib/review';

export function ReviewIcon({ cls, size = 18, className = '' }: { cls: ReviewClass; size?: number; className?: string }) {
  const m = RC[cls];
  const emoji = cls === 'excellent' || cls === 'book';
  return (
    <span
      title={m.label}
      aria-label={m.label}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-black leading-none text-white shadow-[0_1px_2px_rgba(0,0,0,.25)] ${className}`}
      style={{ width: size, height: size, background: m.color, fontSize: emoji ? size * 0.55 : m.symbol.length > 1 ? size * 0.5 : size * 0.62, letterSpacing: m.symbol.length > 1 ? '-0.06em' : undefined }}
    >
      {m.symbol}
    </span>
  );
}
