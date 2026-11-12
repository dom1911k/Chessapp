// The Cups tab: a roguelike tournament of full games (built up over the next stages).
import { useEffect, useRef, useState } from 'react';
import { kvGet, kvSet } from '../../lib/db';
import { NOTICE_KEY } from '../legacy';
import { useCupsMeta } from '../meta';
import { useRunSettings } from '../settings';
import { runMusic } from '../sfx';
import { PixelText } from '../ui/PixelText';
import { DevPanel } from '../ui/DevPanel';
import { useLongPress } from '../ui/useLongPress';
import { Sprite } from '../pixel/sprites';
import { useCup } from '../store';
import { useCupGame } from '../game';
import { CupGameScreen } from './CupGameScreen';
import { CupHub } from './CupHub';
import { TierList } from './TierList';
import '../ui/cups.css';

export function CupsTab() {
  const rs = useRunSettings();
  const meta = useCupsMeta();
  const [notice, setNotice] = useState<string[]>([]);
  const [dev, setDev] = useState(false);
  const shaker = useRef<HTMLDivElement>(null);
  const longPress = useLongPress(() => setDev(true));
  const cups = useCup();
  const game = useCupGame((x) => x.game);
  useEffect(() => {
    void cups.load();
    void meta.load().then(async () => {
      const n = await kvGet<string[]>(NOTICE_KEY, []);
      if (n.length) {
        setNotice(n);
        await kvSet(NOTICE_KEY, []);
      }
    });
    runMusic('map');
    return () => runMusic(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  let body;
  if (!cups.loaded) body = null;
  else if (game) body = <CupGameScreen />;
  else if (cups.cup) body = <CupHub c={cups.cup} />;
  else
    body = (
      <div className="flex h-full flex-col items-center overflow-y-auto px-5 pt-6 pb-6 text-center">
        <div {...longPress}>
          <PixelText text="Cups" size={5} />
        </div>
        <div className="run-label mt-1">Knockout tournaments of real games</div>
        {notice.map((n) => (
          <div key={n} className="run-sans mt-3 max-w-xs rounded bg-[var(--blood)]/20 px-2 py-1 text-xs text-[#ffd0d6]">{n}</div>
        ))}
        <div className="mt-4 flex items-center gap-2">
          <Sprite name="crown" size={24} px={14} />
          <span className="run-title text-lg font-black">{meta.laurels} Laurels</span>
        </div>
        <TierList />
        <p className="run-sans mt-4 max-w-xs text-xs leading-relaxed text-[var(--ink-dim)]">
          Eight players, three rounds. Your games are real games under Match conditions; the other matches are decided by rating. With Black, a draw sends you through.
        </p>
      </div>
    );
  return (
    // During a game the board gets the whole screen (no tab bar), like the Play tab.
    <div className={`run-root ${game ? 'fixed inset-0 z-40' : 'relative h-full'} overflow-hidden ${rs.reduceMotion ? 'run-calm' : ''}`}>
      <div ref={shaker} className={`safe-top h-full ${game ? 'safe-bottom' : ''}`}>{body}</div>
      <div className={`run-crt crt-${rs.crt}`} />
      {dev && <DevPanel onClose={() => setDev(false)} />}
    </div>
  );
}
