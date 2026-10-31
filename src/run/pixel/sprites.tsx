// Sprite sources (48×48 line art) and React helpers to show them as pixel art.
import { useEffect, useState, type CSSProperties } from 'react';
import { portrait } from '../../lib/people';
import { cached, GOLD, pixelPortrait, spriteFromSvg, type SpritePalette } from './pixelize';

export const SPRITES: Record<string, string> = {
  moon: '<path d="M28 7a15 15 0 1 0 8 23A12 12 0 0 1 28 7z"/><path d="M36 11l1 2M40 18h1"/>',
  fang: '<path d="M7 12c9 5 25 5 34 0"/><path d="M14 14l3 15 3-14M28 15l3 14 3-15"/><circle cx="24" cy="36" r="3"/>',
  fork: '<path d="M24 41V22M14 7v9a10 10 0 0 0 20 0V7M24 7v13"/>',
  tower: '<path d="M14 41h20M16 41V17h16v24M13 17V9h5v3h4V9h4v3h4V9h5v8"/><path d="M22 41v-7a2 2 0 0 1 4 0v7"/>',
  pin: '<path d="M7 24h34"/><circle cx="13" cy="24" r="4.5"/><circle cx="25" cy="24" r="3"/><circle cx="36" cy="24" r="4.5"/>',
  star: '<path d="M24 6l5 11.5 12 1-9 8 3 12L24 32l-11 6.5 3-12-9-8 12-1z"/>',
  coin: '<ellipse cx="24" cy="18" rx="13" ry="6"/><path d="M11 18v12c0 3 6 6 13 6s13-3 13-6V18"/><path d="M11 24c0 3 6 6 13 6s13-3 13-6"/>',
  sprout: '<path d="M24 41V22"/><path d="M24 24c0-8-6-12-14-12 0 8 6 12 14 12zM24 20c0-7 5-11 13-11 0 7-5 11-13 11z"/><path d="M15 41h18"/>',
  eye: '<path d="M4 24s8-12 20-12 20 12 20 12-8 12-20 12S4 24 4 24z"/><circle cx="24" cy="24" r="6"/><circle cx="24" cy="24" r="1.5"/>',
  rewind: '<path d="M22 13L9 24l13 11zM39 13L26 24l13 11z"/>',
  cards: '<rect x="7" y="13" width="14" height="21" rx="2" transform="rotate(-12 14 23)"/><rect x="17" y="10" width="14" height="22" rx="2"/><rect x="27" y="13" width="14" height="21" rx="2" transform="rotate(12 34 23)"/>',
  lens: '<circle cx="20" cy="20" r="12"/><path d="M29 29l12 12"/><path d="M15 20h10M20 15v10"/>',
  scale: '<path d="M24 8v32M14 40h20M9 14h30"/><path d="M9 14l-5 11h10zM39 14l-5 11h10z"/>',
  shield: '<path d="M24 5l16 5v12c0 9-7 17-16 21-9-4-16-12-16-21V10z"/><path d="M17 23l5 5 9-10"/>',
  skull: '<path d="M11 22a13 13 0 0 1 26 0v6l-4 3v6H15v-6l-4-3z"/><circle cx="19" cy="24" r="3"/><circle cx="29" cy="24" r="3"/><path d="M21 37v-3M27 37v-3"/>',
  flame: '<path d="M24 43c-8 0-12-6-12-12 0-8 8-12 8-21 4 3 6 7 6 11 2-2 3-4 3-7 5 5 7 10 7 17 0 6-4 12-12 12z"/>',
  book: '<path d="M8 10h13a3 3 0 0 1 3 3v27a3 3 0 0 0-3-3H8zM40 10H27a3 3 0 0 0-3 3v27a3 3 0 0 1 3-3h13z"/>',
  hourglass: '<path d="M12 6h24M12 42h24M15 6c0 10 9 13 9 18s-9 8-9 18M33 6c0 10-9 13-9 18s9 8 9 18"/><path d="M19 38h10"/>',
  clover: '<circle cx="18" cy="17" r="6"/><circle cx="30" cy="17" r="6"/><circle cx="18" cy="29" r="6"/><circle cx="30" cy="29" r="6"/><path d="M27 32l9 10"/>',
  bow: '<path d="M12 6c16 4 26 14 30 30"/><path d="M12 6l30 30"/><path d="M8 40l26-26M8 40h6M8 40v-6"/>',
  axe: '<path d="M14 42L36 12"/><path d="M28 8c6-2 12 2 13 9-6 1-11-2-13-9zM28 8l-2 7 9 4"/>',
  feather: '<path d="M38 8C22 10 12 22 10 40c10-2 26-12 28-32z"/><path d="M10 40L30 18M18 28h8M22 22h8"/>',
  crystal: '<path d="M24 4l11 12-11 28-11-28z"/><path d="M13 16h22M24 4v40"/>',
  scythe: '<path d="M30 42L18 8"/><path d="M18 8c10-4 20 0 24 8-8-3-16-2-22 2"/>',
  chest: '<rect x="8" y="20" width="32" height="20" rx="2"/><path d="M8 20c0-8 6-12 16-12s16 4 16 12M8 28h32"/><rect x="21" y="25" width="6" height="7" rx="1"/>',
  swords: '<path d="M8 8l26 26M40 8L14 34"/><path d="M30 38l8-8M10 30l8 8M34 34l5 5M14 34l-5 5"/>',
  question: '<path d="M16 16a8 8 0 1 1 12 7c-3 2-4 4-4 7"/><circle cx="24" cy="38" r="1.5"/>',
  candle: '<path d="M17 22h14v20H17z"/><path d="M24 22v-4"/><path d="M24 17c-3-3-2-7 0-11 2 4 3 8 0 11z"/>',
  dice: '<rect x="8" y="8" width="32" height="32" rx="5"/><circle cx="17" cy="17" r="2"/><circle cx="31" cy="31" r="2"/><circle cx="24" cy="24" r="2"/><circle cx="31" cy="17" r="2"/><circle cx="17" cy="31" r="2"/>',
  bag: '<path d="M16 14h16l6 26H10z"/><path d="M18 14l-3-7h18l-3 7M20 26h8M24 22v10"/>',
  altar: '<path d="M8 40h32M12 40V24h24v16M10 24h28M18 24v-6h12v6"/><path d="M24 18c-2-2-2-5 0-8 2 3 2 6 0 8z"/>',
  king: '<path d="M24 5v8M20 9h8"/><path d="M15 40c0-9 3-13 9-17 6 4 9 8 9 17z"/><path d="M12 42h24"/>',
  lock: '<rect x="11" y="21" width="26" height="20" rx="3"/><path d="M16 21v-6a8 8 0 0 1 16 0v6"/>',
  check: '<path d="M10 25l9 9 19-20"/>',
  cross: '<path d="M12 12l24 24M36 12L12 36"/>',
  music: '<path d="M18 36V10l20-4v26"/><circle cx="14" cy="36" r="4.5"/><circle cx="34" cy="32" r="4.5"/>',
  mute: '<path d="M8 18h8l10-8v28l-10-8H8z"/><path d="M32 18l10 12M42 18L32 30"/>',
  gear: '<circle cx="24" cy="24" r="7"/><path d="M24 5v6M24 37v6M5 24h6M37 24h6M10.5 10.5l4.2 4.2M33.3 33.3l4.2 4.2M37.5 10.5l-4.2 4.2M14.7 33.3l-4.2 4.2"/><circle cx="24" cy="24" r="13"/>',
  scroll: '<path d="M12 8h22a4 4 0 0 1 4 4v26a4 4 0 0 1-4 4H14"/><path d="M12 8a4 4 0 0 0-4 4v4h8v-4a4 4 0 0 0-4-4zM16 42a4 4 0 0 1-4-4v-4h8"/><path d="M20 16h12M20 22h12M20 28h8"/>',
  help: '<circle cx="24" cy="24" r="18"/><path d="M18 19a6 6 0 1 1 9 5c-2 1-3 3-3 5"/><circle cx="24" cy="34" r="1"/>',
};

/** A pixel sprite (falls back to nothing until rendered — usually one frame). */
export function Sprite({ name, size = 32, px = 16, pal = GOLD, stroke, className = '', style }: { name: string; size?: number; px?: number; pal?: SpritePalette; stroke?: number; className?: string; style?: CSSProperties }) {
  const src = usePromise(() => spriteFromSvg(name, SPRITES[name] ?? SPRITES.star, px, pal, stroke ?? 4), `${name}:${px}:${pal.mid}:${stroke}`, `spr:${name}:${px}:${pal.mid}:${stroke ?? 4}`);
  return (
    <span className={`inline-block shrink-0 ${className}`} style={{ width: size, height: size, ...style }} aria-hidden>
      {src && <img src={src} alt="" width={size} height={size} style={{ imageRendering: 'pixelated', width: size, height: size }} draggable={false} />}
    </span>
  );
}

/** A cast member as a pixel portrait. */
export function PixelPortrait({ id, size = 64, boss = false, px = 40, className = '', style }: { id: string; size?: number; boss?: boolean; px?: number; className?: string; style?: CSSProperties }) {
  const src = usePromise(() => pixelPortrait(id, portrait(id), px, boss), `${id}:${px}:${boss}`, `pt:${id}:${px}:${boss}`);
  return (
    <span className={`inline-block shrink-0 ${className}`} style={{ width: size, height: size, ...style }}>
      {src && <img src={src} alt="" width={size} height={size} style={{ imageRendering: 'pixelated', width: size, height: size }} draggable={false} />}
    </span>
  );
}

export function usePromise(make: () => Promise<string>, dep: string, cacheKey?: string): string | null {
  const [v, setV] = useState<string | null>(() => (cacheKey ? cached(cacheKey) : null));
  useEffect(() => {
    let alive = true;
    const hit = cacheKey ? cached(cacheKey) : null;
    if (hit) {
      setV(hit);
      return;
    }
    make().then((u) => alive && setV(u)).catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep]);
  return v;
}
