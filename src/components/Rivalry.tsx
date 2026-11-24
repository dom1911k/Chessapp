// Badges with one opponent: the one track per opponent. Eight feats to earn once each; seven open
// their special challenge. On Home they live in one place: a line in the opponent card that opens
// the badge sheet.
import { useState } from 'react';
import { Check, ChevronRight, Lock, Trophy, X } from 'lucide-react';
import { opponentById } from '../lib/people';
import { badgeCount, challengeOpen, type OpponentRecord } from '../lib/people/record';
import { BADGES, CHALLENGE_BADGES, nextBadge } from '../lib/people/rivalry';
import { challengeFor } from '../lib/people/challenges';
import { BadgeIcon } from './BadgeIcon';
import { Dialog } from './ui';

/** The eight badge icons in a row (3px apart), earned ones in gold, with "3/8 badges" beside them (or under them, `stacked`). */
export function BadgeStrip({ rec, size = 16, stacked = false, className = '' }: { rec?: OpponentRecord; size?: number; stacked?: boolean; className?: string }) {
  const held = new Set(rec?.badges ?? []);
  const n = badgeCount(rec);
  return (
    <span className={`inline-flex min-w-0 items-center ${stacked ? 'flex-col gap-1' : 'gap-1.5'} ${className}`} data-testid="badge-strip" data-held={n}>
      <BadgeIcons held={held} size={size} />
      <span className="shrink-0 text-[12px] font-semibold text-stone-500 tabular-nums dark:text-stone-400">
        {n}/8<span className={stacked ? '' : 'max-[380px]:hidden'}> badges</span>
      </span>
    </span>
  );
}

function BadgeIcons({ held, size }: { held: Set<string>; size: number }) {
  return (
    <span className="inline-flex shrink-0 gap-[3px]">
      {BADGES.map((b) => (
        <BadgeIcon key={b.id} id={b.id} size={size} on={held.has(b.id)} />
      ))}
    </span>
  );
}

/**
 * Home's opponent card: the badges as one tappable 12px line (strip, "5/8 · Next: With Black", a
 * chevron) that opens the badge sheet.
 */
export function BadgeLine({ opponentId, rec }: { opponentId: string; rec?: OpponentRecord }) {
  const [open, setOpen] = useState(false);
  const held = new Set(rec?.badges ?? []);
  const n = badgeCount(rec);
  const next = nextBadge(rec?.badges);
  return (
    <>
      <button
        className="press flex w-full min-w-0 items-center gap-2 rounded-[8px] bg-stone-100 px-2.5 py-2 text-left text-[12px] dark:bg-white/[0.05]"
        onClick={() => setOpen(true)}
        data-testid="badge-line"
        data-held={n}
        aria-label={`Badges: ${n} of 8`}
      >
        <BadgeIcons held={held} size={16} />
        <span className="min-w-0 flex-1 truncate text-stone-500 dark:text-stone-400">
          <b className="font-bold text-stone-800 tabular-nums dark:text-stone-100">{n}/8</b>
          {/* A small phone drops "Next:" so the badge's name fits. */}
          {next ? <> · <span className="max-[380px]:hidden">Next: </span>{next.label}</> : ' · all eight'}
        </span>
        <ChevronRight size={16} className="shrink-0 text-stone-400" />
      </button>
      <BadgeSheet open={open} onClose={() => setOpen(false)} opponentId={opponentId} rec={rec} />
    </>
  );
}

/** The badge sheet: the eight tiles with their hints, and the special challenge with its progress. */
export function BadgeSheet({ open, onClose, opponentId, rec }: { open: boolean; onClose: () => void; opponentId: string; rec?: OpponentRecord }) {
  const o = opponentById(opponentId);
  if (!o) return null;
  const n = badgeCount(rec);
  const next = nextBadge(rec?.badges);
  const ch = challengeFor(opponentId);
  const chOpen = challengeOpen(rec);
  return (
    <Dialog open={open} onClose={onClose}>
      <div data-testid="badge-sheet">
        <div className="mb-3 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl leading-tight font-extrabold tracking-[-0.01em]">Badges with {o.name}</h2>
            <p className="mt-0.5 text-[13px] text-stone-500 dark:text-stone-400">
              {n} of 8{next ? ` · Next: ${next.label}` : ' · all eight'}
            </p>
          </div>
          <button className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-600 dark:bg-white/[0.08] dark:text-stone-300" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <BadgeTiles rec={rec} />
        {ch && (
          <div className="mt-3 flex gap-3 rounded-[10px] bg-stone-100 p-3 dark:bg-white/[0.05]" data-testid="badge-challenge">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-gold-300/45 text-[#8a6416] dark:bg-gold-500/20 dark:text-gold-300">
              {chOpen || rec?.challengeDone ? <Trophy size={18} /> : <Lock size={17} />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold tracking-[0.08em] text-[#8a6416] uppercase dark:text-gold-300">Special challenge</div>
              {rec?.challengeDone ? (
                <>
                  <div className="font-bold">{ch.title}</div>
                  <div className="text-[12px] text-stone-500 dark:text-stone-400">Done!</div>
                </>
              ) : chOpen ? (
                <>
                  <div className="font-bold">{ch.title}</div>
                  <div className="text-[12px] text-stone-500 dark:text-stone-400">{ch.description}</div>
                </>
              ) : (
                <>
                  <div className="font-bold tabular-nums">
                    {Math.min(n, CHALLENGE_BADGES)} of {CHALLENGE_BADGES} badges
                  </div>
                  <div className="text-[12px] text-stone-500 dark:text-stone-400">Earn {CHALLENGE_BADGES} of the 8 badges against them and a special challenge opens.</div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-200 dark:bg-white/10">
                    <div className="h-full rounded-full bg-gold-400" style={{ width: `${(Math.min(n, CHALLENGE_BADGES) / CHALLENGE_BADGES) * 100}%` }} />
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}

/** The eight tiles in two columns, each with its hint at 12px: earned ones gold-tinted with a gold check. */
export function BadgeTiles({ rec }: { rec?: OpponentRecord }) {
  const held = new Set(rec?.badges ?? []);
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {BADGES.map((b) => {
        const on = held.has(b.id);
        return (
          <span key={b.id} className={`flex items-start gap-2 rounded-[8px] px-2 py-1.5 ${on ? 'bg-hue-amber-50 dark:bg-hue-amber-500/10' : 'bg-stone-100 dark:bg-white/[0.04]'}`} data-badge-tile={b.id} data-on={on ? '' : undefined}>
            <span className="relative mt-px shrink-0">
              <BadgeIcon id={b.id} size={22} on={on} />
              {on && <Check size={11} strokeWidth={4} className="absolute -right-1 -bottom-0.5 rounded-full bg-gold-400 p-px text-[#4a3500] ring-2 ring-hue-amber-50 dark:ring-[#3b3020]" />}
            </span>
            <span className="min-w-0 leading-tight">
              <span className={`block text-[13px] font-semibold ${on ? 'text-[#8a6416] dark:text-gold-300' : ''}`}>{b.label}</span>
              <span className="block text-[12px] text-stone-500 dark:text-stone-400">{b.hint}</span>
            </span>
          </span>
        );
      })}
    </div>
  );
}
