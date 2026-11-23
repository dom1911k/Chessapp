// Press states that a quick tap still shows. Big buttons sink into their lip (CSS :active), and
// list rows and cards light up; `data-down` holds that state for 80ms after the finger lifts, and
// drops it at once when the touch turns into a scroll.
export const PRESS_SEL = '.press, .tile, .btn-primary, .btn-secondary, [data-lip]';
export const PRESS_HOLD = 80;
const SCROLL_SLOP = 10;

export function installPress(root: Document = document): () => void {
  let el: HTMLElement | null = null;
  let x0 = 0;
  let y0 = 0;
  const release = (now: boolean) => {
    const e = el;
    el = null;
    if (!e) return;
    if (now) e.removeAttribute('data-down');
    else setTimeout(() => e.removeAttribute('data-down'), PRESS_HOLD);
  };
  const down = (ev: PointerEvent) => {
    if (ev.pointerType === 'mouse' && ev.button > 0) return;
    const t = (ev.target as Element | null)?.closest?.(PRESS_SEL) as HTMLElement | null;
    if (!t || t.matches(':disabled, [aria-disabled="true"]')) return;
    release(true);
    el = t;
    x0 = ev.clientX;
    y0 = ev.clientY;
    t.setAttribute('data-down', '');
  };
  const move = (ev: PointerEvent) => {
    if (el && Math.hypot(ev.clientX - x0, ev.clientY - y0) > SCROLL_SLOP) release(true);
  };
  const up = () => release(false);
  const cancel = () => release(true);
  root.addEventListener('pointerdown', down, { passive: true, capture: true });
  root.addEventListener('pointermove', move, { passive: true, capture: true });
  root.addEventListener('pointerup', up, { passive: true, capture: true });
  root.addEventListener('pointercancel', cancel, { passive: true, capture: true });
  return () => {
    root.removeEventListener('pointerdown', down, { capture: true });
    root.removeEventListener('pointermove', move, { capture: true });
    root.removeEventListener('pointerup', up, { capture: true });
    root.removeEventListener('pointercancel', cancel, { capture: true });
  };
}
