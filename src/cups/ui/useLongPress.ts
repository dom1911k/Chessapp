import { useRef } from 'react';
import { buzz } from '../../lib/motion';

/** Props for an element that calls `fn` after being held for `ms`. */
export function useLongPress(fn: () => void, ms = 650) {
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = () => {
    if (t.current) clearTimeout(t.current);
    t.current = null;
  };
  return {
    onPointerDown: () => {
      clear();
      t.current = setTimeout(() => {
        t.current = null;
        buzz(30);
        fn();
      }, ms);
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu: (e: { preventDefault(): void }) => e.preventDefault(),
  };
}
