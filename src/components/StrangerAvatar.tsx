// A Quick match opponent's avatar: like chess.com's default, a pawn silhouette on one of eight
// muted colours (picked from the username). No portraits; those are the characters'.
import { STRANGER_COLORS } from '../lib/people/stranger';

export function StrangerAvatar({ avatar, size = 40, grey = false, className = '' }: { avatar: number; size?: number; grey?: boolean; className?: string }) {
  const bg = grey ? undefined : STRANGER_COLORS[avatar % STRANGER_COLORS.length];
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[6px] ${grey ? 'bg-stone-300 dark:bg-stone-700' : ''} ${className}`}
      style={{ width: size, height: size, background: bg }}
      data-testid="stranger-avatar"
      aria-hidden
    >
      <svg viewBox="0 0 40 40" width={size * 0.72} height={size * 0.72}>
        <g fill={grey ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.88)'}>
          <circle cx="20" cy="11" r="5.5" />
          <path d="M14.5 18.5h11l-1.6 3.2c2.4 2.2 3.6 5.6 3.9 9.3h-15.6c.3-3.7 1.5-7.1 3.9-9.3z" />
          <rect x="10.5" y="31" width="19" height="4.5" rx="1.6" />
        </g>
      </svg>
    </span>
  );
}
