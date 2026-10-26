import { useEffect, useRef } from 'react';
import { useCelebrate } from '../lib/celebrate';
import { playSound } from '../lib/sound';
import { Medallion } from './Glyph';
import { useSettings } from '../lib/settings';
import { CELEBRATIONS, type FxShape } from '../lib/rewards/looks';

/** Draws one particle of a celebration style at the origin. */
function drawShape(ctx: CanvasRenderingContext2D, shape: FxShape, size: number, color: string) {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  switch (shape) {
    case 'rect':
      ctx.fillRect(-size / 2, -size / 4, size, size / 2);
      break;
    case 'circle':
      ctx.beginPath();
      ctx.arc(0, 0, size / 2.6, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'star': {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? size * 0.25 : size * 0.6;
        const a = (i * Math.PI) / 5 - Math.PI / 2;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'heart': {
      const k = size / 16;
      ctx.beginPath();
      ctx.moveTo(0, 5 * k);
      ctx.bezierCurveTo(-9 * k, -2 * k, -5 * k, -9 * k, 0, -4 * k);
      ctx.bezierCurveTo(5 * k, -9 * k, 9 * k, -2 * k, 0, 5 * k);
      ctx.fill();
      break;
    }
    case 'leaf':
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 0.55, size * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'coin':
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 0.45, size * 0.45 * Math.abs(Math.cos(ctx.getTransform().a)), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillRect(-size * 0.12, -size * 0.3, size * 0.08, size * 0.6);
      break;
    case 'snow':
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 3; i++) {
        ctx.rotate(Math.PI / 3);
        ctx.beginPath();
        ctx.moveTo(-size / 2, 0);
        ctx.lineTo(size / 2, 0);
        ctx.stroke();
      }
      break;
    case 'piece':
      ctx.font = `${size * 1.6}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(['♞', '♛', '♜', '♝', '♟', '♚'][Math.floor(Math.abs(size * 7)) % 6], 0, 0);
      break;
  }
}

export function CelebrationLayer() {
  const burst = useCelebrate((s) => s.burst);
  const burstStyle = useCelebrate((s) => s.burstStyle);
  const equipped = useSettings((s) => s.celebration);
  const toasts = useCelebrate((s) => s.toasts);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!burst || !canvas.current) return;
    const style = CELEBRATIONS[burstStyle ?? equipped] ?? CELEBRATIONS.confetti;
    const cv = canvas.current;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    cv.width = window.innerWidth * devicePixelRatio;
    cv.height = window.innerHeight * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);
    const W = window.innerWidth;
    const H = window.innerHeight;
    const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
    // Fireworks: a few rockets bursting at different spots; everything else: one fountain.
    const origins = style.fireworks
      ? Array.from({ length: 4 }, (_, i) => ({ x: W * (0.2 + 0.2 * i) + (Math.random() - 0.5) * 40, y: H * (0.2 + Math.random() * 0.2), delay: i * 12 }))
      : [{ x: W / 2, y: H * 0.35, delay: 0 }];
    const parts = origins.flatMap((o) =>
      Array.from({ length: style.fireworks ? 40 : 110 }, () => {
        const a = Math.random() * Math.PI * 2;
        const v = style.fireworks ? 2 + Math.random() * 4.5 : 0;
        return {
          x: o.x + (style.fireworks ? 0 : (Math.random() - 0.5) * 60),
          y: o.y,
          vx: style.fireworks ? Math.cos(a) * v : (Math.random() - 0.5) * 9,
          vy: style.fireworks ? Math.sin(a) * v : -Math.random() * 11 - 4,
          r: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.3,
          c: pick(style.colors),
          shape: pick(style.shapes),
          s: (style.shapes[0] === 'piece' ? 9 : 5) + Math.random() * 5,
          delay: o.delay,
        };
      }),
    );
    const gravity = style.shapes[0] === 'leaf' || style.shapes[0] === 'snow' ? 0.12 : style.fireworks ? 0.06 : 0.32;
    const life = style.fireworks ? 140 : 110;
    let frame = 0;
    let raf = 0;
    const tick = () => {
      frame++;
      ctx.clearRect(0, 0, W, H);
      for (const p of parts) {
        if (frame < p.delay) continue;
        p.vy += gravity;
        p.vx *= gravity < 0.2 ? 0.97 : 0.99;
        if (style.shapes[0] === 'leaf' || style.shapes[0] === 'snow') p.vx += Math.sin((frame + p.s * 10) / 12) * 0.08;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vr;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - (frame - p.delay) / life);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        drawShape(ctx, p.shape, p.s, p.c);
        ctx.restore();
      }
      if (frame < life + 50) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, W, H);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [burst, burstStyle, equipped]);

  useEffect(() => {
    if (toasts.length) playSound('notify');
  }, [toasts.length]);

  return (
    <>
      <canvas ref={canvas} className="pointer-events-none fixed inset-0 z-[60] h-full w-full" />
      <div className="safe-top pointer-events-none fixed inset-x-0 top-2 z-[61] flex flex-col items-center gap-2 px-3">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-pop pointer-events-auto relative flex max-w-sm items-center gap-3 overflow-hidden rounded-2xl px-4 py-2.5 shadow-lg ${
              t.title.startsWith('Achievement') ? 'bg-gradient-to-r from-[#fff7e0] to-white ring-2 ring-gold-400 dark:from-[#3a2f12] dark:to-stone-800' : 'bg-white ring-1 ring-stone-200 dark:bg-stone-800 dark:ring-stone-700'
            }`}
          >
            {t.title.startsWith('Achievement') && <span className="animate-shine pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 skew-x-[-20deg] bg-white/60" />}
            <Medallion name={t.icon} tint="gold" size={40} />
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

export { useCelebrate };
