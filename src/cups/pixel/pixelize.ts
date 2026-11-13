// Turns vector art into pixel art at runtime (no image assets): glyphs, chess pieces and the
// cast's portraits are rasterized small, then palette-shaded / dithered and outlined.
// Results are cached data URLs; render them with `image-rendering: pixelated`.

export type RGB = [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

const cache = new Map<string, Promise<string>>();
const done = new Map<string, string>();
export const cached = (key: string) => done.get(key) ?? null;

export function memo(key: string, make: () => Promise<string>): Promise<string> {
  let p = cache.get(key);
  if (!p) {
    p = make().then((url) => (done.set(key, url), url));
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}
const svgUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, g: c.getContext('2d', { willReadFrequently: true })! };
}

/** Draws pixels (with alpha) to a data URL. */
function toUrl(w: number, h: number, px: (RGB | null)[]): string {
  const { c, g } = canvas(w, h);
  const img = g.createImageData(w, h);
  px.forEach((p, i) => {
    if (!p) return;
    img.data.set([p[0], p[1], p[2], 255], i * 4);
  });
  g.putImageData(img, 0, 0);
  return c.toDataURL('image/png');
}

export interface SpritePalette {
  outline: string;
  dark: string;
  mid: string;
  light: string;
  shine?: string;
}

export const GOLD: SpritePalette = { outline: '#1b0f22', dark: '#8a5a1c', mid: '#e0a93a', light: '#ffe08a', shine: '#fff8dc' };
export const BLOOD: SpritePalette = { outline: '#1b0f22', dark: '#6e1020', mid: '#d33a4c', light: '#ff8c8c', shine: '#ffe0e0' };
export const SPIRIT: SpritePalette = { outline: '#10101f', dark: '#245a7a', mid: '#4fb3ff', light: '#b8ecff', shine: '#ffffff' };
export const JADE: SpritePalette = { outline: '#0b1a12', dark: '#1d6b45', mid: '#3fbf7f', light: '#a9f0c8', shine: '#eafff3' };
export const EMBER: SpritePalette = { outline: '#1b0a06', dark: '#9a3a0a', mid: '#ff8a2a', light: '#ffd27a', shine: '#fff6d0' };

/**
 * A line-art SVG (48×48 viewBox, currentColor) as a chunky shaded sprite: filled with the mid
 * tone, lit from the top-left, shadowed bottom-right, with a dark 1-px outline.
 */
export function spriteFromSvg(key: string, inner: string, size: number, pal: SpritePalette, stroke = 4): Promise<string> {
  return memo(`spr:${key}:${size}:${pal.mid}:${stroke}`, async () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="${size * 4}" height="${size * 4}" style="color:#fff">` +
      `<g fill="none" stroke="#fff" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${inner}</g></svg>`;
    const img = await loadImage(svgUrl(svg.replace(/currentColor/g, '#fff')));
    const n = size;
    const { g } = canvas(n, n);
    g.imageSmoothingEnabled = true;
    g.drawImage(img, 0, 0, n, n);
    const a = g.getImageData(0, 0, n, n).data;
    const W = n + 2;
    const on = (x: number, y: number) => x >= 0 && y >= 0 && x < n && y < n && a[(y * n + x) * 4 + 3] > 100;
    const px: (RGB | null)[] = new Array(W * W).fill(null);
    const P = { o: hex(pal.outline), d: hex(pal.dark), m: hex(pal.mid), l: hex(pal.light), s: hex(pal.shine ?? pal.light) };
    for (let y = -1; y <= n; y++)
      for (let x = -1; x <= n; x++) {
        const i = (y + 1) * W + (x + 1);
        if (on(x, y)) {
          const tl = !on(x - 1, y) || !on(x, y - 1);
          const br = !on(x + 1, y) || !on(x, y + 1);
          const shine = tl && !on(x - 1, y - 1) && (x + y) % 5 === 0;
          px[i] = shine ? P.s : tl && !br ? P.l : br && !tl ? P.d : P.m;
        } else if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) px[i] = P.o;
      }
    return toUrl(W, W, px);
  });
}

/** Chess pieces: the piece's own light/dark areas mapped onto a 4-tone palette, outlined. */
export function spriteFromPieceSvg(key: string, svg: string, size: number, tones: string[], outline: string, rim?: string): Promise<string> {
  return memo(`pc:${key}:${size}`, async () => {
    const withNs = svg.includes('xmlns') ? svg : svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    const img = await loadImage(svgUrl(withNs));
    const n = size;
    const { g } = canvas(n, n);
    g.imageSmoothingEnabled = true;
    g.drawImage(img, 0, 0, n, n);
    const d = g.getImageData(0, 0, n, n).data;
    const W = n + 2;
    const on = (x: number, y: number) => x >= 0 && y >= 0 && x < n && y < n && d[(y * n + x) * 4 + 3] > 110;
    const T = tones.map(hex);
    const O = hex(outline);
    const Rm = rim ? hex(rim) : null;
    const px: (RGB | null)[] = new Array(W * W).fill(null);
    for (let y = -1; y <= n; y++)
      for (let x = -1; x <= n; x++) {
        const i = (y + 1) * W + (x + 1);
        if (on(x, y)) {
          const k = (y * n + x) * 4;
          const lum = (d[k] * 0.3 + d[k + 1] * 0.59 + d[k + 2] * 0.11) / 255;
          let t = lum > 0.72 ? 3 : lum > 0.45 ? 2 : lum > 0.2 ? 1 : 0;
          // Light from the top-left.
          if ((!on(x - 1, y) || !on(x, y - 1)) && t < 3 && t > 0) t++;
          if ((!on(x + 1, y) || !on(x, y + 1)) && t > 0) t--;
          px[i] = Rm && (!on(x, y - 1) || !on(x - 1, y)) && lum < 0.45 ? Rm : T[t];
        } else if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) px[i] = O;
      }
    return toUrl(W, W, px);
  });
}

// Occult palette for portraits: inks, felt greens, purples, golds, skin and hair tones.
const PORTRAIT_PAL = [
  '#0d0814', '#1d1033', '#33195a', '#5b2f8a', '#8f5bc4',
  '#10261d', '#1f5a3d', '#3f9a62',
  '#5a3a12', '#9c7a2c', '#e0b04a', '#ffe7a3',
  '#3a1c14', '#6e3a24', '#a8643e', '#d99a6c', '#f2c9a0', '#fff1dc',
  '#6e1020', '#c23a4c', '#ff8c9a',
  '#22324a', '#4a6a9a', '#9ab8e0',
].map(hex);
const BOSS_PAL = [
  '#0a0508', '#1f0812', '#3c0c1c', '#6e1020', '#a8203a', '#e2475a', '#ff8c8c',
  '#1d1033', '#33195a', '#5b2f8a',
  '#5a3a12', '#9c7a2c', '#e0b04a', '#ffe7a3',
  '#3a1c14', '#7a3a2a', '#c07050', '#e8a888', '#ffd8c0',
].map(hex);
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v / 16 - 0.5) * 34);
const BAYER_SOFT = BAYER4.map((v) => v * 0.45);

function nearest(pal: RGB[], r: number, g: number, b: number): RGB {
  let best = pal[0];
  let bd = Infinity;
  for (const p of pal) {
    const dr = p[0] - r, dg = p[1] - g, db = p[2] - b;
    const dd = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;
    if (dd < bd) {
      bd = dd;
      best = p;
    }
  }
  return best;
}

/** A portrait as dithered pixel art (transparent background, gold or blood rim). */
export function pixelPortrait(id: string, url: string, size = 40, boss = false): Promise<string> {
  return memo(`pt:${id}:${size}:${boss}`, async () => {
    let img: HTMLImageElement;
    if (/\.svg(\?|$)/.test(url) || url.startsWith('data:image/svg')) {
      let svg = await fetch(url).then((r) => r.text());
      // Drop the pastel background so the character sits on the felt.
      svg = svg.replace(/<rect width="200" height="200" fill="url\(#[^)]*bg\)"\/>/, '').replace(/<circle cx="150" cy="40" r="60" fill="#fff" opacity="0.18"\/>/, '');
      img = await loadImage(svgUrl(svg));
    } else img = await loadImage(url); // painted portraits keep their backdrop
    const n = size;
    const { g } = canvas(n, n);
    g.imageSmoothingEnabled = true;
    g.drawImage(img, 0, 0, n, n);
    const d = g.getImageData(0, 0, n, n).data;
    const pal = boss ? BOSS_PAL : PORTRAIT_PAL;
    const on = (x: number, y: number) => x >= 0 && y >= 0 && x < n && y < n && d[(y * n + x) * 4 + 3] > 120;
    const px: (RGB | null)[] = new Array(n * n).fill(null);
    const rim = hex(boss ? '#ff4a5e' : '#ffd36b');
    const ink = hex('#0d0814');
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const i = y * n + x;
        if (!on(x, y)) {
          if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) px[i] = ink;
          continue;
        }
        const k = i * 4;
        // Boost contrast a little, push toward the theme, then dither.
        const t = BAYER_SOFT[(y % 4) * 4 + (x % 4)];
        const c = (v: number) => Math.max(0, Math.min(255, (v - 128) * 1.15 + 128 + t));
        let r = c(d[k]), gg = c(d[k + 1]), b = c(d[k + 2]);
        const lum = (r * 0.3 + gg * 0.59 + b * 0.11) / 255;
        // Shadows lean purple (the theme's ink), highlights lean warm gold.
        if (lum < 0.26) {
          const m = (0.26 - lum) * 1.6;
          r = r * (1 - m) + 0x33 * m;
          gg = gg * (1 - m) + 0x19 * m;
          b = b * (1 - m) + 0x5a * m;
        } else if (lum > 0.8) {
          b *= 0.9;
        }
        if (boss) {
          r = r * 0.92;
          gg *= 0.6;
          b *= 0.7;
          // Glowing eyes: dark pixels in the eye band light up.
          const fx = x / n, fy = y / n;
          if (lum < 0.38 && fy > 0.4 && fy < 0.58 && ((fx > 0.27 && fx < 0.46) || (fx > 0.54 && fx < 0.73))) {
            px[i] = hex(lum < 0.25 ? '#ffe0a0' : '#ff3b4e');
            continue;
          }
        }
        px[i] = !on(x, y - 1) || !on(x - 1, y) ? rim : nearest(pal, r, gg, b);
      }
    return toUrl(n, n, px);
  });
}

/** A seamless dithered texture tile (felt, stone…), for CSS backgrounds. */
export function textureTile(key: string, size: number, colors: string[], seed = 1, bricks = false): Promise<string> {
  return memo(`tx:${key}`, async () => {
    let s = seed;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const C = colors.map(hex);
    const px: (RGB | null)[] = [];
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        let v = rnd() * 0.6 + 0.2 + BAYER4[(y % 4) * 4 + (x % 4)] / 120;
        if (bricks) {
          const row = Math.floor(y / 6);
          const off = row % 2 ? 6 : 0;
          if (y % 6 === 0 || (x + off) % 12 === 0) v = 0;
          else if (y % 6 === 1 || (x + off) % 12 === 1) v = Math.min(1, v + 0.3);
        }
        px.push(C[Math.max(0, Math.min(C.length - 1, Math.floor(v * C.length)))]);
      }
    return toUrl(size, size, px);
  });
}
