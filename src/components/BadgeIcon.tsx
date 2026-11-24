// The icon of a rivalry badge: a small rose disc with what the badge is for (a king for the colour
// you won with, a shield for "On your own", a crosshair for "Sharp"…). Earned ones in colour, the
// rest dim.
import { Crosshair, Crown, Flame, ShieldCheck, Timer, Zap, type LucideIcon } from 'lucide-react';
import { PieceIcon } from './PieceIcon';

const ICON: Record<string, LucideIcon | 'wK' | 'bK'> = {
  white: 'wK',
  black: 'bK',
  clean: ShieldCheck,
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
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${on ? 'bg-hue-rose-600 text-white' : 'bg-stone-200 text-stone-400 dark:bg-white/[0.08] dark:text-stone-500'} ${className}`}
      style={{ width: size, height: size }}
      data-badge={id}
      data-on={on ? '' : undefined}
    >
      {typeof I === 'string' ? <span className={on ? '' : 'opacity-40 grayscale'}><PieceIcon code={I} size={Math.round(size * 0.78)} /></span> : <I size={Math.round(size * 0.55)} strokeWidth={2.6} />}
    </span>
  );
}
