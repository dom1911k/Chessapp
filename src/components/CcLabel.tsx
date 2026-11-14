// "≈ 600 chess.com" next to a bot's rating, with the one-line explanation of where it comes from.
import { useEffect, useState } from 'react';
import { allGames } from '../lib/games';
import { ccMap, ccMapLine, toChessCom, CCMAP, type CcMap } from '../lib/games/ccmap';

let cached: Promise<CcMap> | null = null;
let cachedAt = 0;
/** The app → chess.com mapping, worked out once a minute at most. */
export function useCcMap(): CcMap {
  const [m, setM] = useState<CcMap>({ offset: CCMAP.priorOffset, appGames: 0, ccGames: 0 });
  useEffect(() => {
    if (!cached || Date.now() - cachedAt > 60_000) {
      cachedAt = Date.now();
      cached = allGames({ includeUnanalyzed: true }).then((gs) => ccMap(gs as never));
    }
    let live = true;
    void cached.then((x) => live && setM(x));
    return () => void (live = false);
  }, []);
  return m;
}

/** "≈ 600 chess.com" for an app rating. */
export function CcLabel({ elo, className = '' }: { elo: number; className?: string }) {
  const m = useCcMap();
  return <span className={`whitespace-nowrap ${className}`}>≈ {toChessCom(elo, m)} chess.com</span>;
}

/** The one-line explanation. */
export function CcLine({ className = '' }: { className?: string }) {
  const m = useCcMap();
  return <p className={`text-xs text-stone-500 ${className}`}>{ccMapLine(m)}</p>;
}
