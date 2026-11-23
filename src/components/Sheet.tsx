// Bottom sheets that feel like one: they spring up (SOFT) over a backdrop that fades in (220ms)
// with a light tick; a grab handle lets them follow your finger (upward drags resist at 25%);
// released past 30% of their height or on a downward flick (> 0.6 px/ms) they slide away (240ms,
// ease-in), otherwise they snap back (260ms, UI_EASE). Every close animates out: the ×, a backdrop
// tap, the back button, a drag, and a parent closing it (`open` turning false). Transforms only.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode, type RefObject } from 'react';
import { SOFT, UI_EASE, animate, haptic } from '../lib/motion';
import { addBackHandler } from '../lib/nav';

export const SHEET = { backdrop: 220, close: 240, closeEase: 'cubic-bezier(.4,0,.8,.4)', snap: 260, closeAt: 0.3, flick: 0.6, resist: 0.25, slop: 8 } as const;

/** Where a sheet goes when a drag ends: away past 30% of its height or on a downward flick, else back. */
export function sheetRelease(dy: number, vel: number, height: number): 'close' | 'snap' {
  return dy > height * SHEET.closeAt || vel > SHEET.flick ? 'close' : 'snap';
}
/** The sheet follows the finger down, and resists upward drags at 25%. */
export const dragOffset = (dy: number) => (dy < 0 ? dy * SHEET.resist : dy);

/** How far down the panel must go to leave the screen, from where it sits now (centred on tablets too). */
function offscreen(p: HTMLElement, current = 0): number {
  const top = p.getBoundingClientRect().top - current;
  return Math.max(80, window.innerHeight - top + 24);
}
const stop = (el: HTMLElement | null) => el?.getAnimations().forEach((a) => a.cancel());

export function sheetEnter(panel: HTMLElement | null, back: HTMLElement | null) {
  if (!panel) return;
  stop(panel);
  stop(back);
  panel.style.transform = '';
  if (back) back.style.opacity = '';
  void animate(back, [{ opacity: 0 }, { opacity: 1 }], { d: SHEET.backdrop, e: 'linear', fill: 'backwards' });
  void animate(panel, [{ transform: `translateY(${offscreen(panel)}px)` }, { transform: 'translateY(0)' }], { ...SOFT, fill: 'backwards' });
  haptic('select');
}

export function sheetExit(panel: HTMLElement | null, back: HTMLElement | null, from = 0): Promise<void> {
  if (!panel) return Promise.resolve();
  const op = back ? Number(getComputedStyle(back).opacity) : 1;
  stop(panel);
  stop(back);
  panel.style.transform = `translateY(${from}px)`;
  const to = offscreen(panel, from);
  return Promise.all([
    animate(back, [{ opacity: op }, { opacity: 0 }], { d: SHEET.backdrop, e: 'linear', fill: 'forwards' }),
    animate(panel, [{ transform: `translateY(${from}px)` }, { transform: `translateY(${to}px)` }], { d: SHEET.close, e: SHEET.closeEase, fill: 'forwards' }),
  ]).then(() => undefined);
}

/** Lets touch drags reach the sheet where nothing inside it scrolls vertically (horizontal pans stay native). */
function fitTouch(panel: HTMLElement | null) {
  if (!panel) return;
  const scrolls = (el: Element) => {
    const cs = getComputedStyle(el);
    return /(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1;
  };
  const any = scrolls(panel) || [...panel.querySelectorAll('*')].some(scrolls);
  panel.style.touchAction = any ? '' : 'pan-x';
}

function scrolledParent(el: Element | null, root: HTMLElement): boolean {
  for (let n = el; n && n !== root.parentElement; n = n.parentElement) {
    if ((n as HTMLElement).scrollTop > 0) return true;
  }
  return false;
}

/**
 * Drag a sheet by its grab handle (`data-sheet-handle`), or anywhere on it when nothing inside is
 * scrolled. A drag only starts after 8px of mostly vertical travel, so taps and buttons still work.
 */
export function useSheetDrag(panel: RefObject<HTMLElement | null>, back: RefObject<HTMLElement | null>, onClose: (from: number) => void, enabled = true) {
  const st = useRef<{ x0: number; y0: number; id: number; handle: boolean; on: boolean; dy: number; pts: { t: number; y: number }[] } | null>(null);
  const down = (e: RPointerEvent) => {
    if (!enabled || (e.pointerType === 'mouse' && e.button > 0)) return;
    const t = e.target as Element;
    if (t.closest('input, textarea, select, [data-no-sheet-drag]')) return;
    st.current = { x0: e.clientX, y0: e.clientY, id: e.pointerId, handle: !!t.closest('[data-sheet-handle]'), on: false, dy: 0, pts: [] };
  };
  const move = (e: RPointerEvent) => {
    const s = st.current;
    const p = panel.current;
    if (!s || !p || e.pointerId !== s.id) return;
    const dy = e.clientY - s.y0;
    const dx = e.clientX - s.x0;
    if (!s.on) {
      if (Math.abs(dy) < SHEET.slop || Math.abs(dy) < Math.abs(dx)) return;
      if (!s.handle && (dy < 0 || scrolledParent(e.target as Element, p))) {
        st.current = null;
        return;
      }
      s.on = true;
      try {
        p.setPointerCapture(e.pointerId);
      } catch {
        /* the pointer may already be gone */
      }
      stop(p);
      stop(back.current);
    }
    s.dy = dy;
    const y = dragOffset(dy);
    p.style.transform = `translateY(${y}px)`;
    if (back.current) back.current.style.opacity = String(Math.max(0.2, 1 - Math.max(0, y) / (p.offsetHeight * 1.2)));
    const now = performance.now();
    s.pts.push({ t: now, y: e.clientY });
    while (s.pts.length > 2 && now - s.pts[0].t > 90) s.pts.shift();
  };
  const up = (e: RPointerEvent) => {
    const s = st.current;
    const p = panel.current;
    st.current = null;
    if (!s?.on || !p) return;
    e.preventDefault();
    const a = s.pts[0];
    const b = s.pts[s.pts.length - 1];
    const vel = a && b && b.t > a.t ? (b.y - a.y) / (b.t - a.t) : 0;
    const y = dragOffset(s.dy);
    if (sheetRelease(s.dy, vel, p.offsetHeight) === 'close') return onClose(y);
    p.style.transform = '';
    void animate(p, [{ transform: `translateY(${y}px)` }, { transform: 'translateY(0)' }], { d: SHEET.snap, e: UI_EASE, fill: 'backwards' });
    const bk = back.current;
    if (bk) {
      const op = Number(bk.style.opacity || 1);
      bk.style.opacity = '';
      void animate(bk, [{ opacity: op }, { opacity: 1 }], { d: SHEET.snap, e: UI_EASE, fill: 'backwards' });
    }
  };
  return { onPointerDown: down, onPointerMove: move, onPointerUp: up, onPointerCancel: up };
}

/** The grab handle: a pill with a generous hit area that drags the sheet. */
export function GrabHandle({ className = '' }: { className?: string }) {
  return (
    <div data-sheet-handle className={`flex cursor-grab touch-none justify-center pt-2 pb-3 ${className}`} aria-hidden>
      <span className="h-1 w-10 rounded-full bg-stone-300 dark:bg-stone-600" />
    </div>
  );
}

/**
 * A bottom sheet. Keep it mounted with `open` (it animates out when `open` turns false, keeping its
 * last content), or mount it while shown and close through the `close` it hands its children.
 */
export function Sheet({
  open = true,
  onClose,
  children,
  z = 50,
  panelClass = '',
  backdropClass = 'bg-black/60',
  center = true,
  full = false,
  testId,
}: {
  open?: boolean;
  onClose: () => void;
  children: ReactNode | ((close: () => void) => ReactNode);
  z?: number;
  panelClass?: string;
  backdropClass?: string;
  /** Centred on wide screens (a dialog), bottom-aligned on phones. */
  center?: boolean;
  /** Fills the screen (the Explain sheet). */
  full?: boolean;
  testId?: string;
}) {
  const [mounted, setMounted] = useState(open);
  const panel = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLDivElement>(null);
  const closing = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const kept = useRef<typeof children>(children);
  if (open) kept.current = children;

  if (open && !mounted) setMounted(true);

  useLayoutEffect(() => {
    if (!open || !mounted) return;
    closing.current = false;
    sheetEnter(panel.current, back.current);
    fitTouch(panel.current);
    const t = setTimeout(() => fitTouch(panel.current), 400);
    return () => clearTimeout(t);
  }, [open, mounted]);

  // You closed it (×, backdrop, back, drag): slide away, then tell the parent.
  const close = useCallback((from = 0) => {
    if (closing.current) return;
    closing.current = true;
    void sheetExit(panel.current, back.current, from).then(() => onCloseRef.current());
  }, []);

  // The parent closed it: slide away with the last content, then unmount.
  useEffect(() => {
    if (open || !mounted) return;
    let alive = true;
    const done = () => alive && setMounted(false);
    if (closing.current) done();
    else {
      closing.current = true;
      void sheetExit(panel.current, back.current).then(done);
    }
    return () => {
      alive = false;
    };
  }, [open, mounted]);

  useEffect(() => {
    if (!open || !mounted) return;
    return addBackHandler(() => {
      close();
      return true;
    });
  }, [open, mounted, close]);

  const drag = useSheetDrag(panel, back, close, open);
  if (!mounted) return null;
  const body = typeof kept.current === 'function' ? kept.current(() => close()) : kept.current;
  return (
    <div className={`fixed inset-0 flex justify-center ${full ? 'items-stretch' : center ? 'items-end sm:items-center sm:p-3' : 'items-end'}`} style={{ zIndex: z }} onClick={() => close()} data-testid={testId ? `${testId}-root` : undefined}>
      <div ref={back} className={`absolute inset-0 ${backdropClass}`} />
      <div ref={panel} className={`relative ${panelClass}`} onClick={(e) => e.stopPropagation()} {...drag} data-testid={testId}>
        {body}
      </div>
    </div>
  );
}
