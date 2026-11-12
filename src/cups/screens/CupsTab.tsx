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
import '../ui/cups.css';

export function CupsTab() {
  const rs = useRunSettings();
  const meta = useCupsMeta();
  const [notice, setNotice] = useState<string[]>([]);
  const [dev, setDev] = useState(false);
  const shaker = useRef<HTMLDivElement>(null);
  const longPress = useLongPress(() => setDev(true));
  useEffect(() => {
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
  return (
    <div className={`run-root relative h-full overflow-hidden ${rs.reduceMotion ? 'run-calm' : ''}`}>
      <div ref={shaker} className="safe-top flex h-full flex-col items-center overflow-y-auto px-5 pt-6 pb-6 text-center">
        <div {...longPress}>
          <PixelText text="Cups" size={5} />
        </div>
        <div className="run-label mt-1">Knockout tournaments of real games</div>
        {notice.map((n) => (
          <div key={n} className="run-sans mt-3 max-w-xs rounded bg-[var(--blood)]/20 px-2 py-1 text-xs text-[#ffd0d6]">{n}</div>
        ))}
        <div className="mt-6 flex items-center gap-2">
          <Sprite name="crown" size={28} px={14} />
          <span className="run-title text-xl font-black">{meta.laurels} Laurels</span>
        </div>
      </div>
      <div className={`run-crt crt-${rs.crt}`} />
      {dev && <DevPanel onClose={() => setDev(false)} />}
    </div>
  );
}
