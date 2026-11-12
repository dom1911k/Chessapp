// The slam before a cup game: you and your opponent crash together, a VS between.
import { useEffect } from 'react';
import { opponentById } from '../../lib/people';
import { avatarUrl } from '../../lib/avatars';
import { useSettings } from '../../lib/settings';
import { PixelAvatar, PixelPortrait } from '../pixel/sprites';
import { buzz, sfx } from '../sfx';
import { PixelNum } from './bits';
import { TUNING } from '../tuning';

export function VsIntro({ opponentId, line, myName, onDone }: { opponentId: string; line: string; myName: string; onDone: () => void }) {
  const o = opponentById(opponentId);
  const avatar = useSettings((s) => s.avatar);
  useEffect(() => {
    sfx('slam');
    buzz([TUNING.juice.haptic.slam, 30, 60]);
    const t = setTimeout(onDone, 2400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <button className="fixed inset-0 z-[65] flex flex-col items-center justify-center overflow-hidden bg-black/85" onClick={onDone}>
      <div className="absolute inset-0" style={{ background: 'linear-gradient(115deg, rgba(31,90,61,.55) 0 49.6%, #ffe7a3 49.6% 50.4%, rgba(110,16,32,.65) 50.4%)' }} />
      <div className="relative flex w-full items-center justify-between px-6">
        <div className="run-vs-l flex flex-col items-center">
          <PixelAvatar avatarId={avatar} url={avatarUrl(avatar)} size={112} px={40} />
          <span className="run-title mt-1 max-w-[30vw] truncate text-xl font-black">{myName}</span>
        </div>
        <div className="run-slam" style={{ animationDelay: '0.35s' }}>
          <PixelNum value="VS" size={9} color="#ffe7a3" />
        </div>
        <div className="run-vs-r flex flex-col items-center">
          <PixelPortrait id={opponentId} size={120} boss className="run-boss-glow" />
          <span className="run-title mt-1 text-xl font-black text-[var(--blood)]">{o?.name}</span>
        </div>
      </div>
      {line && (
        <div className="run-fadeup run-sans relative mt-8 max-w-xs rounded-lg bg-black/50 px-3 py-2 text-sm text-[var(--ink)]" style={{ animationDelay: '0.6s' }}>
          “{line}”
        </div>
      )}
      <span className="run-sans absolute bottom-8 text-xs text-[var(--ink-dim)]">Tap to start</span>
    </button>
  );
}
