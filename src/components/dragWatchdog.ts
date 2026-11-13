// The board library clears a dragged piece's see-through "ghost" only when it sees the drop.
// On phones a press can occasionally end without that (a lost touch/mouse end), leaving the
// piece half-transparent and the board unresponsive. If a press ends and no drop or cancel
// follows shortly, remount the board to reset it.
import { useEffect, useRef, useState } from 'react';

const GRACE_MS = 450;

export function useDragWatchdog() {
  const [epoch, setEpoch] = useState(0);
  const dragging = useRef(false);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const ended = () => {
      if (!dragging.current) return;
      clearTimeout(t);
      t = setTimeout(() => {
        if (!dragging.current) return;
        dragging.current = false;
        setEpoch((e) => e + 1);
      }, GRACE_MS);
    };
    const evs = ['pointerup', 'pointercancel', 'mouseup', 'touchend', 'touchcancel'] as const;
    for (const e of evs) window.addEventListener(e, ended, true);
    return () => {
      clearTimeout(t);
      for (const e of evs) window.removeEventListener(e, ended, true);
    };
  }, []);
  return {
    /** Key for the board: changes when a stuck drag was reset. */
    epoch,
    started: () => void (dragging.current = true),
    finished: () => void (dragging.current = false),
  };
}
