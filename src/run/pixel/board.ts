// Hand-drawn pixel art for Run mode's board: 16×16 piece silhouettes (shaded and outlined in
// code), bevelled stone tiles with variants, and pixel overlays for highlights. Everything is
// drawn synchronously on small canvases and cached as data URLs.

type Sil = string[];
/** '#' body, 'd' carved detail, '.' empty. Light comes from the top-left. */
const SIL: Record<'P' | 'N' | 'B' | 'R' | 'Q' | 'K', Sil> = {
  P: [
    '................', '................', '................', '................',
    '......####......', '.....######.....', '.....######.....', '......####......',
    '.......##.......', '......####......', '.......##.......', '......####......',
    '....########....', '...##########...', '................', '................',
  ],
  N: [
    '................', '................', '.......##.##....', '......######....',
    '.....########...', '....##d#######..', '...###########..', '..#######d####..',
    '..####..######..', '..##...#######..', '.......######...', '......#######...',
    '.....#########..', '....##########..', '................', '................',
  ],
  B: [
    '................', '.......##.......', '......####......', '.....##d###.....',
    '.....#d####.....', '.....######.....', '......####......', '....########....',
    '......####......', '......####......', '.....######.....', '....########....',
    '..############..', '..############..', '................', '................',
  ],
  R: [
    '................', '................', '...##.####.##...', '...##########...',
    '....########....', '.....######.....', '.....##d###.....', '.....######.....',
    '.....###d##.....', '.....######.....', '....########....', '...##########...',
    '..############..', '..############..', '................', '................',
  ],
  Q: [
    '................', '..#....##....#..', '.###..####..###.', '..#....##....#..',
    '..##..####..##..', '..############..', '...##########...', '....dddddddd....',
    '.....######.....', '.....######.....', '....########....', '...##########...',
    '..############..', '..############..', '................', '................',
  ],
  K: [
    '.......##.......', '......####......', '.......##.......', '......####......',
    '..###.####.###..', '.##############.', '.###d##dd##d###.', '..############..',
    '...##########...', '....dddddddd....', '....########....', '...##########...',
    '..############..', '..############..', '................', '................',
  ],
};

export interface BoardTheme {
  id: string;
  name: string;
  /** Tile ramps: [shadow, base, light, highlight]. */
  light: string[];
  dark: string[];
  /** Specks on dark tiles (moss, embers…). */
  speck: string;
  /** Piece ramps: [detail, shadow, mid, light, shine] and outline. */
  white: string[];
  whiteOutline: string;
  black: string[];
  blackOutline: string;
  frame: [string, string];
  coord: [string, string];
}

export const BOARD_THEMES: Record<string, BoardTheme> = {
  crypt: {
    id: 'crypt',
    name: 'Crypt',
    light: ['#2f2346', '#3d2f58', '#4a3a68', '#5c4a7e'],
    dark: ['#0e2018', '#152e22', '#1c3a2c', '#25483a'],
    speck: '#2f6a46',
    white: ['#3a2e1c', '#8c7448', '#cdb47c', '#f1e2b8', '#fffaea'],
    whiteOutline: '#1b0f22',
    black: ['#06030c', '#1d1032', '#3c2466', '#6a46a8', '#a888e0'],
    blackOutline: '#d9a441',
    frame: ['#e0a93a', '#8a5a1c'],
    coord: ['#c9a6ff', '#7fd1a5'],
  },
  bone: {
    id: 'bone',
    name: 'Bone & Blood',
    light: ['#5a4a3e', '#76644f', '#8c7860', '#a69176'],
    dark: ['#240f12', '#341619', '#431d21', '#55272b'],
    speck: '#7a2a2e',
    white: ['#3a3026', '#8a7c66', '#c9bba0', '#ece2cc', '#fffaf0'],
    whiteOutline: '#170b0c',
    black: ['#0a0204', '#3a0a12', '#6e1424', '#a8263a', '#e86070'],
    blackOutline: '#ecd9b0',
    frame: ['#d9c8a0', '#6e5a3e'],
    coord: ['#f0d9b0', '#d98088'],
  },
  frost: {
    id: 'frost',
    name: 'Frost Tomb',
    light: ['#34485e', '#435a74', '#526c88', '#6b88a6'],
    dark: ['#121f33', '#182941', '#1f324f', '#283e60'],
    speck: '#5aa0c8',
    white: ['#2a3a4a', '#7890a8', '#b8cce0', '#e6f0fa', '#ffffff'],
    whiteOutline: '#0c1420',
    black: ['#04060c', '#101a33', '#22345e', '#3e5a96', '#7fa0e0'],
    blackOutline: '#9fe0ff',
    frame: ['#bfe6ff', '#4a7aa0'],
    coord: ['#bfe6ff', '#7fb0e0'],
  },
  ember: {
    id: 'ember',
    name: 'Ember Forge',
    light: ['#46281a', '#5a3320', '#6c3f27', '#86522f'],
    dark: ['#180c0a', '#22120e', '#2c1712', '#3a1e17'],
    speck: '#c2501a',
    white: ['#3a2a14', '#9a7a44', '#e0b868', '#ffe2a0', '#fff8dc'],
    whiteOutline: '#120806',
    black: ['#060302', '#24100a', '#4a2010', '#7a3a1a', '#c86a30'],
    blackOutline: '#ffb454',
    frame: ['#ffb454', '#8a3a10'],
    coord: ['#ffcf8a', '#e08a50'],
  },
};

const cache = new Map<string, string>();
function draw(key: string, w: number, h: number, paint: (g: CanvasRenderingContext2D) => void): string {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  paint(g);
  const url = c.toDataURL('image/png');
  cache.set(key, url);
  return url;
}

/** One piece sprite (18×18 with outline). `color` w/b, `type` PNBRQK. */
export function pieceSprite(theme: BoardTheme, color: 'w' | 'b', type: keyof typeof SIL): string {
  return draw(`pc:${theme.id}:${color}${type}`, 18, 18, (g) => {
    const sil = SIL[type];
    const pal = color === 'w' ? theme.white : theme.black;
    const outline = color === 'w' ? theme.whiteOutline : theme.blackOutline;
    const on = (x: number, y: number) => x >= 0 && y >= 0 && x < 16 && y < 16 && sil[y][x] !== '.';
    const shade: (number | null)[][] = Array.from({ length: 18 }, () => new Array(18).fill(null));
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        if (!on(x, y)) continue;
        let l = x;
        while (on(l - 1, y)) l--;
        let r = x;
        while (on(r + 1, y)) r++;
        const t = (x - l) / Math.max(1, r - l);
        let v = t < 0.34 ? 3 : t < 0.72 ? 2 : 1;
        if (!on(x, y - 1) && v >= 2) v++;
        if (!on(x, y + 1) && y >= 12) v = Math.max(0, v - 1);
        if (sil[y][x] === 'd') v = 0;
        shade[y + 1][x + 1] = Math.min(4, v);
      }
    for (let y = 0; y < 18; y++)
      for (let x = 0; x < 18; x++) {
        const v = shade[y][x];
        let col: string | null = null;
        if (v !== null) col = pal[v];
        else if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => shade[y + dy]?.[x + dx] != null)) col = outline;
        if (!col) continue;
        g.fillStyle = col;
        g.fillRect(x, y, 1, 1);
      }
  });
}

// Small deterministic hash for tile variation.
const hash = (n: number) => {
  let x = (n * 2654435761) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 2246822507) >>> 0;
  x ^= x >>> 13;
  return x >>> 0;
};

/** A 16×16 bevelled stone tile; `variant` adds cracks/specks so squares differ. */
export function tileSprite(theme: BoardTheme, light: boolean, variant: number): string {
  return draw(`tile:${theme.id}:${light ? 'l' : 'd'}:${variant}`, 16, 16, (g) => {
    const [sh, base, lt, hi] = light ? theme.light : theme.dark;
    g.fillStyle = base;
    g.fillRect(0, 0, 16, 16);
    // Sparse texture.
    for (let i = 0; i < 256; i++) {
      const h = hash(i + variant * 977 + (light ? 0 : 50000)) % 100;
      if (h < 5) (g.fillStyle = lt), g.fillRect(i % 16, i >> 4, 1, 1);
      else if (h < 10) (g.fillStyle = sh), g.fillRect(i % 16, i >> 4, 1, 1);
    }
    // Variant marks.
    if (variant % 4 === 1) {
      g.fillStyle = sh;
      for (const [x, y] of [[4, 5], [5, 6], [6, 6], [7, 7], [8, 8], [8, 9]]) g.fillRect(x, y, 1, 1);
    } else if (variant % 4 === 2 && !light) {
      g.fillStyle = theme.speck;
      for (const [x, y] of [[10, 10], [11, 10], [10, 11], [4, 12], [12, 4]]) g.fillRect(x, y, 1, 1);
    } else if (variant % 4 === 3) {
      g.fillStyle = lt;
      g.fillRect(9, 4, 2, 1);
      g.fillRect(9, 5, 1, 1);
    }
    // Bevel: lit top/left, shadowed bottom/right.
    g.fillStyle = hi;
    g.fillRect(0, 0, 16, 1);
    g.fillRect(0, 0, 1, 16);
    g.fillStyle = sh;
    g.fillRect(0, 15, 16, 1);
    g.fillRect(15, 0, 1, 16);
  });
}

export type OverlayKind = 'last' | 'sel' | 'move' | 'cap' | 'check' | 'good' | 'bad' | 'info';

/** Pixel overlays drawn on top of a tile. */
export function overlaySprite(kind: OverlayKind): string {
  return draw(`ov:${kind}`, 16, 16, (g) => {
    const px = (c: string, pts: number[][]) => {
      g.fillStyle = c;
      for (const [x, y] of pts) g.fillRect(x, y, 1, 1);
    };
    const brackets = (c: string, len = 4) => {
      g.fillStyle = c;
      g.fillRect(1, 1, len, 1);
      g.fillRect(1, 1, 1, len);
      g.fillRect(15 - len, 1, len, 1);
      g.fillRect(14, 1, 1, len);
      g.fillRect(1, 14, len, 1);
      g.fillRect(1, 15 - len, 1, len);
      g.fillRect(15 - len, 14, len, 1);
      g.fillRect(14, 15 - len, 1, len);
    };
    const frame = (c: string, a: string) => {
      g.fillStyle = a;
      g.fillRect(0, 0, 16, 16);
      g.fillStyle = c;
      g.fillRect(0, 0, 16, 1);
      g.fillRect(0, 15, 16, 1);
      g.fillRect(0, 0, 1, 16);
      g.fillRect(15, 0, 1, 16);
    };
    switch (kind) {
      case 'last':
        g.fillStyle = 'rgba(242,199,92,0.16)';
        g.fillRect(0, 0, 16, 16);
        brackets('#f2c75c');
        break;
      case 'sel':
        frame('#ffe7a3', 'rgba(255,231,163,0.28)');
        g.fillStyle = '#f2c75c';
        g.fillRect(1, 1, 14, 1);
        g.fillRect(1, 14, 14, 1);
        g.fillRect(1, 1, 1, 14);
        g.fillRect(14, 1, 1, 14);
        break;
      case 'move':
        px('#1b0f22', [[6, 6], [7, 6], [8, 6], [9, 6], [6, 9], [7, 9], [8, 9], [9, 9], [6, 7], [6, 8], [9, 7], [9, 8]]);
        px('#ffe7a3', [[7, 7], [8, 7], [7, 8]]);
        px('#e0a93a', [[8, 8]]);
        break;
      case 'cap':
        brackets('#ff5a6a', 5);
        break;
      case 'check':
        for (let y = 0; y < 16; y++)
          for (let x = 0; x < 16; x++) {
            const d = Math.hypot(x - 7.5, y - 7.5);
            if (d < 8 && (x + y) % 2 === 0) {
              g.fillStyle = d < 4 ? 'rgba(255,70,90,0.85)' : d < 6 ? 'rgba(255,70,90,0.55)' : 'rgba(255,70,90,0.3)';
              g.fillRect(x, y, 1, 1);
            }
          }
        break;
      case 'good':
        frame('#5ee59a', 'rgba(94,229,154,0.22)');
        break;
      case 'bad':
        frame('#ff5a6a', 'rgba(255,90,106,0.26)');
        break;
      case 'info':
        frame('#6fd3ff', 'rgba(111,211,255,0.2)');
        break;
    }
  });
}

export const squareVariant = (sq: string) => hash(sq.charCodeAt(0) * 31 + sq.charCodeAt(1)) % 4;
