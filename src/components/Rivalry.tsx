// Badges with one opponent: the one track per opponent. Eight feats to earn once each; five open
// their special challenge.
import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { opponentById } from '../lib/people';
import { badgeCount, challengeOpen, type OpponentRecord } from '../lib/people/record';
import { BADGES, CHALLENGE_BADGES, nextBadge } from '../lib/people/rivalry';
import { challengeFor } from '../lib/people/challenges';
import { BadgeIcon } from './BadgeIcon';

/** The eight badge icons in a row, earned ones in colour, with "3/8 badges" beside them. */
export function BadgeStrip({ rec, size = 12, className = '' }: { rec?: OpponentRecord; size?: number; className?: string }) {
  const held = new Set(rec?.badges ?? []);
  const n = badgeCount(rec);
  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 ${className}`} data-testid="badge-strip" data-held={n}>
      <span className="inline-flex shrink-0 gap-[2px]">
        {BADGES.map((b) => (
          <BadgeIcon key={b.id} id={b.id} size={size} on={held.has(b.id)} />
        ))}
      </span>
      <span className="shrink-0 text-[12px] font-semibold text-stone-500 tabular-nums dark:text-stone-400">
        {n}/8<span className="max-[380px]:hidden"> badges</span>
      </span>
    </span>
  );
}

/**
 * Your badges with the opponent on Home: one row ("Grandpa Tom · 3/8 badges · Next: With Black",
 * with the next badge's icon) that opens to the eight badges and their hints.
 */
export function RivalryCard({ opponentId, rec }: { opponentId: string; rec?: OpponentRecord }) {
  const [open, setOpen] = useState(false);
  const o = opponentById(opponentId);
  if (!o) return null;
  const held = new Set(rec?.badges ?? []);
  const n = badgeCount(rec);
  const next = nextBadge(rec?.badges);
  const ch = challengeFor(opponentId);
  const chOpen = challengeOpen(rec);
  return (
    <div className="card !p-0">
      <button className="flex w-full items-center gap-3 px-3.5 py-3 text-left active:brightness-95" onClick={() => setOpen(!open)} aria-expanded={open} data-testid="rivalry">
        <BadgeIcon id={next?.id ?? 'streak'} size={36} on={!next} />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[14px] font-bold">
            {o.name} · <span className="tabular-nums">{n}/8</span> badges
          </span>
          <span className="mt-0.5 block truncate text-[12px] text-stone-500 dark:text-stone-400">{next ? `Next: ${next.label}` : 'All eight badges'}</span>
        </span>
        <ChevronDown size={18} className={`shrink-0 text-stone-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="animate-fade-in px-3.5 pb-3.5">
          {/* Two columns so each hint is readable at the app's 12px. */}
          <div className="grid grid-cols-2 gap-1.5">
            {BADGES.map((b) => {
              const on = held.has(b.id);
              return (
                <span key={b.id} className={`flex items-start gap-2 rounded-[8px] px-2 py-1.5 ${on ? 'bg-hue-rose-50 dark:bg-hue-rose-500/10' : 'bg-stone-100 dark:bg-white/[0.04]'}`} data-badge-tile={b.id} data-on={on ? '' : undefined}>
                  <span className="relative mt-px shrink-0">
                    <BadgeIcon id={b.id} size={22} on={on} />
                    {on && <Check size={11} strokeWidth={4} className="absolute -right-1 -bottom-0.5 rounded-full bg-white text-hue-rose-600 dark:bg-stone-900" />}
                  </span>
                  <span className="min-w-0 leading-tight">
                    <span className={`block text-[13px] font-semibold ${on ? 'text-hue-rose-700 dark:text-hue-rose-300' : ''}`}>{b.label}</span>
                    <span className="block text-[12px] text-stone-500 dark:text-stone-400">{b.hint}</span>
                  </span>
                </span>
              );
            })}
          </div>
          {ch && (
            <p className="mt-2 text-[12px] text-stone-500 dark:text-stone-400">
              {rec?.challengeDone ? `Special challenge done: ${ch.title}.` : chOpen ? `Special challenge open: ${ch.title} — ${ch.description}` : `${CHALLENGE_BADGES} badges open ${o.name}'s special challenge (${Math.max(0, CHALLENGE_BADGES - n)} to go).`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
