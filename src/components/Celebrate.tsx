import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import { playSound } from '../lib/sound';

interface Toast {
  id: number;
  icon: string;
  title: string;
  text?: string;
}

interface CelebrateStore {
  burst: number;
  toasts: Toast[];
  confetti(): void;
  toast(t: Omit<Toast, 'id'>): void;
  dismiss(id: number): void;
}

let nextId = 1;

/** Global celebrations: confetti bursts and small reward toasts. */
export const useCelebrate = create<CelebrateStore>((set, get) => ({
  burst: 0,
  toasts: [],
  confetti: () => set({ burst: get().burst + 1 }),
  toast: (t) => {
    const id = nextId++;
    set({ toasts: [...get().toasts, { ...t, id }].slice(-3) });
    setTimeout(() => get().dismiss(id), 3500);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

const COLORS = ['#2f9e63', '#facc15', '#f97316', '#3b82f6', '#ec4899', '#a855f7'];

export function CelebrationLayer() {
  const burst = useCelebrate((s) => s.burst);
  const toasts = useCelebrate((s) => s.toasts);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!burst || !canvas.current) return;
    const cv = canvas.current;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    cv.width = window.innerWidth * devicePixelRatio;
    cv.height = window.innerHeight * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);
    const W = window.innerWidth;
    const parts = Array.from({ length: 110 }, () => ({
      x: W / 2 + (Math.random() - 0.5) * 60,
      y: window.innerHeight * 0.35,
      vx: (Math.random() - 0.5) * 9,
      vy: -Math.random() * 11 - 4,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      c: COLORS[Math.floor(Math.random() * COLORS.length)],
      s: 5 + Math.random() * 5,
    }));
    let frame = 0;
    let raf = 0;
    const tick = () => {
      frame++;
      ctx.clearRect(0, 0, W, window.innerHeight);
      for (const p of parts) {
        p.vy += 0.32;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vr;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - frame / 110);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        ctx.restore();
      }
      if (frame < 110) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, W, window.innerHeight);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [burst]);

  useEffect(() => {
    if (toasts.length) playSound('notify');
  }, [toasts.length]);

  return (
    <>
      <canvas ref={canvas} className="pointer-events-none fixed inset-0 z-[60] h-full w-full" />
      <div className="safe-top pointer-events-none fixed inset-x-0 top-2 z-[61] flex flex-col items-center gap-2 px-3">
        {toasts.map((t) => (
          <div key={t.id} className="animate-pop pointer-events-auto flex max-w-sm items-center gap-3 rounded-2xl bg-white px-4 py-2.5 shadow-lg ring-1 ring-stone-200 dark:bg-stone-800 dark:ring-stone-700">
            <span className="text-2xl">{t.icon}</span>
            <span>
              <span className="block text-sm font-bold">{t.title}</span>
              {t.text && <span className="block text-xs text-stone-500">{t.text}</span>}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
