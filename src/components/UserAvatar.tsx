// You: your chosen avatar with its frame. Used wherever the player appears (home, player bar,
// game-over sheet, reviews, profile).
import { useEffect, useState } from 'react';
import { Check, Lock, X } from 'lucide-react';
import { AVATARS, FRAMES, TITLES, avatarId, avatarUrl, frameById, type Frame } from '../lib/avatars';
import { getXp, levelFor } from '../lib/progress/xp';
import { meets, unlockContext, unlockText, type UnlockContext } from '../lib/rewards/cosmetics';
import { useSettings } from '../lib/settings';

/** The name shown for the player. */
export const useMyName = () => useSettings((s) => s.ccUsername) || 'You';

/** The player's title: the chosen one, or the current level's. */
export function useMyTitle(): string {
  const chosen = useSettings((s) => s.avatarTitle);
  const [lvl, setLvl] = useState('');
  useEffect(() => void getXp().then((x) => setLvl(levelFor(x).title)), []);
  return TITLES.find((t) => t.id === chosen)?.label ?? lvl;
}

export function AvatarImg({ id, frame, size = 44, className = '' }: { id: string; frame?: Frame; size?: number; className?: string }) {
  const pad = frame?.ring ? Math.max(2, Math.round(size * 0.065)) : 0;
  return (
    <span
      className={`inline-flex shrink-0 rounded-[30%] shadow-[0_2px_8px_rgba(60,35,15,0.18)] ${className}`}
      style={{ width: size, height: size, padding: pad, background: frame?.ring || undefined }}
    >
      <img src={avatarUrl(id)} alt="" draggable={false} className="h-full w-full rounded-[30%] ring-1 ring-black/5" />
    </span>
  );
}

export function UserAvatar({ size = 44, className = '' }: { size?: number; className?: string }) {
  const id = useSettings((s) => s.avatar);
  const frame = useSettings((s) => s.avatarFrame);
  return <AvatarImg id={id} frame={frameById(frame)} size={size} className={className} />;
}

/** Bottom sheet: pick your avatar, frame and title. */
export function AvatarPicker({ onClose }: { onClose: () => void }) {
  const s = useSettings();
  const [ctx, setCtx] = useState<UnlockContext | null>(null);
  useEffect(() => void unlockContext().then(setCtx), []);
  const open = (u: Parameters<typeof meets>[0]) => !ctx || meets(u, ctx);
  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/55 sm:items-center" onClick={onClose}>
      <div className="safe-bottom animate-pop max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-[#fffdf9] px-5 pt-4 pb-5 shadow-2xl sm:rounded-[28px] dark:bg-stone-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Your look</h2>
          <button className="rounded-full p-1.5 text-stone-400" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="mt-3 flex items-center justify-center">
          <UserAvatar size={96} />
        </div>
        <h3 className="section-title mt-4">Avatar</h3>
        <div className="mt-2 grid grid-cols-4 gap-3">
          {AVATARS.map((a) => (
            <button key={a.id} aria-label={`Avatar ${a.id}`} aria-pressed={avatarId(s.avatar) === a.id} className={`relative justify-self-center rounded-[30%] transition-transform active:scale-95 ${avatarId(s.avatar) === a.id ? 'ring-[3px] ring-brand-600 ring-offset-2 ring-offset-[#fffdf9] dark:ring-offset-stone-900' : ''}`} onClick={() => s.set({ avatar: a.id })}>
              <AvatarImg id={a.id} size={68} />
            </button>
          ))}
        </div>
        <h3 className="section-title mt-5">Frame</h3>
        <div className="mt-2 grid grid-cols-4 gap-3">
          {FRAMES.map((f) => {
            const ok = open(f.unlock);
            return (
              <button key={f.id} disabled={!ok} aria-pressed={s.avatarFrame === f.id} className="flex flex-col items-center gap-1 text-center active:scale-95 disabled:active:scale-100" onClick={() => s.set({ avatarFrame: f.id })}>
                <span className={`relative rounded-[30%] ${s.avatarFrame === f.id ? 'ring-[3px] ring-brand-600 ring-offset-2 ring-offset-[#fffdf9] dark:ring-offset-stone-900' : ''} ${ok ? '' : 'opacity-60'}`}>
                  <AvatarImg id={s.avatar} frame={f} size={56} />
                  {!ok && <Lock size={16} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white drop-shadow" />}
                </span>
                <span className="text-[11px] leading-tight font-semibold">{f.name}</span>
                {!ok && <span className="text-[10px] leading-tight text-stone-400">{unlockText(f.unlock)}</span>}
              </button>
            );
          })}
        </div>
        <h3 className="section-title mt-5">Title</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          <button className={`chip !px-3 !py-1.5 ${s.avatarTitle === '' ? 'bg-brand-600 text-white' : 'bg-stone-100 dark:bg-stone-800'}`} onClick={() => s.set({ avatarTitle: '' })}>
            {s.avatarTitle === '' && <Check size={13} />} My level
          </button>
          {TITLES.map((t) => {
            const ok = open(t.unlock);
            const on = s.avatarTitle === t.id;
            return (
              <button key={t.id} disabled={!ok} title={ok ? '' : unlockText(t.unlock)} className={`chip !px-3 !py-1.5 ${on ? 'bg-brand-600 text-white' : 'bg-stone-100 dark:bg-stone-800'} ${ok ? '' : 'opacity-50'}`} onClick={() => s.set({ avatarTitle: t.id })}>
                {!ok && <Lock size={11} />} {t.label}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-stone-400">Frames and titles unlock as you level up and climb your rating journey.</p>
        <button className="btn-primary mt-4 w-full" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}
