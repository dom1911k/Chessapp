// The solve moment's orchestration, shared by PuzzleScreen and DailyScreen: the chip tally on the
// solved square, then the moments, then the final numbers and the level-up panel (a banner when
// animations are reduced) and the new-board card. A miss gets the red ✗ and the flame goes out.
// The points are saved before any of this runs; it only shows them.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { today } from '../../lib/db';
import { useCelebrate } from '../../lib/celebrate';
import { buzz, reduced, token, type Token } from '../../lib/motion';
import { endMoments, momentSplit, runMoments, type MomToken } from '../../lib/puzzles/moments';
import { getPathState, type PathAward, type PathState } from '../../lib/puzzles/path';
import { usePathUi } from '../../lib/puzzles/pathUi';
import { barAt, boardMark, boardRing, clearBoardFx, flameOut, runTally, type BoardRef } from '../../lib/puzzles/tally';
import { sfx } from '../../lib/sfx';
import { LevelBanner, LevelUpPanel, TierUpCard } from './LevelUp';

/** Show a saved state in the header and card. */
export const syncPathUi = (st: PathState, gain = 0) => usePathUi.getState().set({ points: st.points, streak: st.streak, daily: st.dailyDay === today() ? st.dailyCount : 0, gain });

export interface PathTallyOpts {
  /** After an award has landed with no level-up: e.g. a streak banner. */
  onLanded?: (a: PathAward) => void;
  /** Tapping the level-up panel or "See your new board". */
  onOpenPath?: () => void;
}

export function usePathTally(opts: PathTallyOpts = {}) {
  const [path, setPath] = useState<PathState | null>(null);
  const [award, setAward] = useState<PathAward | null>(null);
  const board = useRef<BoardRef | null>(null);
  const onBoard = useCallback((b: BoardRef) => (board.current = b), []);
  const tally = useRef<Token | null>(null);
  const [tallying, setTallying] = useState(false);
  const moms = useRef<MomToken | null>(null);
  const [momenting, setMomenting] = useState(false);
  const [levelUp, setLevelUp] = useState<{ from: number; to: number; instant: boolean } | null>(null);
  const [banner, setBanner] = useState<number | null>(null);
  const [tierCard, setTierCard] = useState<number | null>(null);
  const lastSquare = useRef<string | undefined>(undefined);
  // The latest values, for callbacks memoised by the screens (load, Next).
  const live = useRef({ award, path, opts });
  live.current = { award, path, opts };

  useEffect(() => {
    void getPathState().then((st) => {
      setPath(st);
      syncPathUi(st);
    });
    return () => {
      if (tally.current) tally.current.skip = true;
      endMoments(moms.current);
      useCelebrate.getState().setHold(false);
    };
  }, []);

  /** The final numbers, celebrations released, then the level-up. `quiet` just lands the numbers. */
  const land = (a: PathAward, saved: PathState, skipped: boolean, quiet = false) => {
    syncPathUi(saved, a.total);
    barAt(saved.points);
    useCelebrate.getState().setHold(false);
    if (quiet) return;
    if (a.levelsCrossed.length) {
      if (reduced()) {
        setBanner(a.after);
        if (a.boardUp !== undefined) setTimeout(() => setTierCard(a.boardUp!), 900);
      } else setLevelUp({ from: a.before, to: a.after, instant: skipped });
    } else live.current.opts.onLanded?.(a);
  };

  /**
   * End the chips where they stand (chips gone, the ✓), then the moments (their points haven't
   * touched the bar yet: it stops at before + chips), then land the award.
   */
  const finish = (a: PathAward, saved: PathState, sq: string, skipped = true, quiet = false) => {
    if (tally.current) tally.current.skip = true;
    tally.current = null;
    setTallying(false);
    const b = board.current;
    if (b) {
      b.el.querySelectorAll('.pp-chip').forEach((e) => e.remove());
      document.querySelectorAll('.pp-orb,.pp-ripple').forEach((e) => e.remove());
      if (!b.el.querySelector('.pp-mark')) boardMark(b, sq, 'good');
    }
    const { msum, base, gain } = momentSplit(a);
    if (msum && b && !quiet && !reduced()) {
      usePathUi.getState().set({ points: base, streak: saved.streak, daily: saved.dailyDay === today() ? saved.dailyCount : 0, gain });
      barAt(base);
      const mt: MomToken = { skip: false };
      moms.current = mt;
      setMomenting(true);
      void runMoments(b.el, a.moments, base, gain, mt).then((ok) => {
        if (moms.current === mt) {
          moms.current = null;
          setMomenting(false);
        }
        if (ok) land(a, saved, skipped);
      });
      return;
    }
    land(a, saved, skipped, quiet);
  };

  const skipTally = (quiet = false) => {
    const { award: a, path: p } = live.current;
    if (!tally.current) return;
    if (a && p && lastSquare.current) finish(a, p, lastSquare.current, true, quiet);
    else {
      tally.current.skip = true;
      tally.current = null;
      setTallying(false);
      useCelebrate.getState().setHold(false);
    }
  };
  const stopMoments = () => {
    if (!moms.current) return;
    endMoments(moms.current);
    moms.current = null;
    setMomenting(false);
    const { award: a, path: p } = live.current;
    if (a && p) land(a, p, true, true);
  };

  /** A tap on the board or card: finish the tally; during a moment, skip to its reward (again: land it). */
  const tap = () => {
    if (moms.current) moms.current.skip = true;
    else skipTally();
  };

  /** Before a new puzzle (Next): everything stops, the numbers land, the board is cleared. */
  const reset = () => {
    if (tally.current) skipTally(true);
    stopMoments();
    clearBoardFx(board.current);
    setLevelUp(null);
    setBanner(null);
    setTierCard(null);
    setAward(null);
    usePathUi.getState().set({ gain: 0 });
  };

  /** After recordAttempt: show what was awarded (already saved). */
  const show = async (a: PathAward | undefined, success: boolean, square: string | undefined) => {
    lastSquare.current = square;
    if (a) setAward(a);
    const saved = await getPathState();
    setPath(saved);
    live.current = { ...live.current, award: a ?? null, path: saved };
    const b = board.current;
    if (!a || !b || !square) return syncPathUi(saved, a?.total ?? 0);
    if (!success) {
      // A miss: a red ✗ and ring, the friendly "bonk"; the flame goes out. The bar doesn't move.
      boardMark(b, square, 'bad');
      boardRing(b, square, '#fa412d');
      sfx('fail');
      buzz(40);
      if (a.streakLost) flameOut();
      return syncPathUi(saved, 0);
    }
    if (!a.parts.length) return syncPathUi(saved, 0);
    const tk = token();
    tally.current = tk;
    setTallying(true);
    useCelebrate.getState().setHold(true, { queue: true });
    const natural = await runTally(a, b, square, tk, { onMark: () => boardMark(b, square, 'good') });
    if (tally.current === tk) finish(a, saved, square, !natural);
  };

  const active = tallying || momenting;
  /** Rendered inside the board: the tap-to-skip layer and the reduced-motion level banner. */
  const boardOverlay: ReactNode = (
    <>
      {active && <div className="absolute inset-0 z-40" onClick={tap} data-testid="tally-skip" />}
      {banner !== null && <LevelBanner points={banner} onDone={() => setBanner(null)} />}
    </>
  );
  /** Rendered at the screen's root: the level-up panel and the new-board card. */
  const panels: ReactNode = (
    <>
      {levelUp && board.current && <LevelUpPanel key={`${levelUp.from}-${levelUp.to}`} from={levelUp.from} to={levelUp.to} board={board.current.el} instant={levelUp.instant} onTierCard={setTierCard} onOpenPath={opts.onOpenPath} />}
      {tierCard !== null && <TierUpCard board={tierCard} onClose={() => setTierCard(null)} onOpenPath={opts.onOpenPath} />}
    </>
  );

  return { path, award, onBoard, show, reset, tap, active, boardOverlay, panels };
}
