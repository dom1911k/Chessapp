// The knockout bracket in pixel style: one column per round, winners carried forward.
import { opponentById } from '../../lib/people';
import { YOU, ROUND_NAMES } from '../ladder';
import type { CupState } from '../cup';
import { PixelPortrait } from '../pixel/sprites';
import { PixelAvatar } from '../pixel/sprites';
import { useSettings } from '../../lib/settings';
import { avatarUrl } from '../../lib/avatars';

export function Face({ id, size = 26, out = false }: { id: string; size?: number; out?: boolean }) {
  const avatar = useSettings((s) => s.avatar);
  return (
    <span className={out ? 'opacity-35 grayscale' : ''}>
      {id === YOU ? <PixelAvatar avatarId={avatar} url={avatarUrl(avatar)} size={size} px={32} /> : <PixelPortrait id={id} size={size} px={32} />}
    </span>
  );
}

export function Bracket({ c, myName }: { c: CupState; myName: string }) {
  const name = (id: string) => (id === YOU ? myName : opponentById(id)?.name ?? id);
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
      <div className="flex min-w-max gap-2.5">
        {[0, 1, 2].map((r) => {
          const alive = c.rounds[r];
          const winners = c.rounds[r + 1];
          return (
            <div key={r} className="flex w-[150px] shrink-0 flex-col justify-around gap-2">
              <div className="run-label text-left">{ROUND_NAMES[r]}</div>
              {Array.from({ length: 4 >> r }, (_, m) => {
                const pair: (string | null)[] = alive ? [alive[m * 2], alive[m * 2 + 1]] : [null, null];
                const won = winners?.[m];
                const mine = pair.includes(YOU) && !won;
                return (
                  <div key={m} className={`run-panel px-2 py-1.5 ${mine ? 'ring-2 ring-[var(--gold)]' : ''}`}>
                    {pair.map((id, k) => (
                      <div key={k} className={`flex items-center gap-1.5 py-0.5 text-left ${won && id !== won ? 'opacity-45' : ''}`}>
                        {id ? <Face id={id} size={22} out={!!won && id !== won} /> : <span className="h-[22px] w-[22px] bg-white/10" />}
                        <span className={`run-sans min-w-0 flex-1 truncate text-xs ${won === id ? 'font-black text-[var(--gold-2)]' : 'font-semibold'}`}>{id ? name(id) : '—'}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
