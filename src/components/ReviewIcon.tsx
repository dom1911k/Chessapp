// The move-classification badge used everywhere (review, move strips, coach): a coloured circle
// with a white glyph, like the icons chess.com players know. Vector glyphs only (no emoji, no
// font-dependent symbols), so it looks the same on every phone.
import type { CSSProperties } from 'react';
import { BookOpen, Check, Star, ThumbsUp, X, type LucideIcon } from 'lucide-react';
import { RC, type ReviewClass } from '../lib/review';

const VECTOR: Partial<Record<ReviewClass, { icon: LucideIcon; fill: boolean }>> = {
  best: { icon: Star, fill: true },
  excellent: { icon: ThumbsUp, fill: true },
  good: { icon: Check, fill: false },
  book: { icon: BookOpen, fill: true },
  miss: { icon: X, fill: false },
};

export function ReviewIcon({ cls, size = 18, className = '', ring = false }: { cls: ReviewClass; size?: number; className?: string; /** A white ring, for badges sitting on the board. */ ring?: boolean }) {
  const m = RC[cls];
  const v = VECTOR[cls];
  const two = m.symbol.length > 1;
  return (
    <span
      title={m.label}
      aria-label={m.label}
      className={`inline-flex shrink-0 items-center justify-center rounded-full leading-none font-extrabold text-white shadow-[0_1px_2px_rgba(0,0,0,.3)] ${ring ? 'ring-2 ring-white/90' : ''} ${className}`}
      style={{ width: size, height: size, background: m.color, fontSize: two ? size * 0.52 : size * 0.64, letterSpacing: two ? '-0.08em' : undefined }}
    >
      {v ? (
        <v.icon size={Math.round(size * 0.6)} strokeWidth={v.fill ? 1.5 : 3.2} color="#fff" fill={v.fill ? '#fff' : 'none'} />
      ) : (
        // Optically centred: the glyphs sit a touch high and two-character ones lean right.
        <span style={{ transform: `translate(${two ? '-0.04em' : '0'}, 0.02em)` }}>{m.symbol}</span>
      )}
    </span>
  );
}

/**
 * A class name written as text: the `ink` colour on light surfaces, the lighter `inkDark` on
 * charcoal (the white coach bubble counts as light). Spread onto an element.
 */
export function classInk(cls: ReviewClass): { className: string; style: CSSProperties } {
  return {
    className: 'text-[var(--ink)] dark:text-[var(--ink-dark)]',
    style: { '--ink': RC[cls].ink, '--ink-dark': RC[cls].inkDark } as CSSProperties,
  };
}
