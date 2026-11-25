// The icon of an opponent badge: a small disc with what the badge is for (a king for the colour
// you won with, a rising line for "Comeback", a crosshair for "Sharp"…). Earned ones in the
// achievement gold (gold disc, dark icon), the rest dim.
import { Crosshair, Crown, Flame, Timer, TrendingUp, Zap, type LucideIcon } from 'lucide-react';
import { PieceIcon } from './PieceIcon';

const ICON: Record<string, LucideIcon | 'wK' | 'bK'> = {
  white: 'wK',
  black: 'bK',
  // Kept ids: `clean` is Comeback, `match` is With a clock (round 7).
  clean: TrendingUp,
  sharp: Crosshair,
  quick: Zap,
  mate: Crown,
  match: Timer,
  streak: Flame,
};

export function BadgeIcon({ id, size = 20, on = true, className = '' }: { id: string; size?: number; on?: boolean; className?: string }) {
  const I = ICON[id] ?? Crown;
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${on ? 'bg-gold-400 text-[#4a3500] shadow-[inset_0_-1px_0_rgba(0,0,0,0.18)]' : 'bg-stone-200 text-stone-400 dark:bg-white/[0.08] dark:text-stone-500'} ${className}`}
      style={{ width: size, height: size }}
      data-badge={id}
      data-on={on ? '' : undefined}
    >
      {typeof I === 'string' ? <span className={on ? '' : 'opacity-40 grayscale'}><PieceIcon code={I} size={Math.round(size * 0.78)} /></span> : <I size={Math.round(size * 0.55)} strokeWidth={2.6} />}
    </span>
  );
}
