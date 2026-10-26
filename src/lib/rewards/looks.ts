// Piece sets, move highlights and celebration effects. Boards live in settings (BOARD_THEMES).
// Gradient fills reference <PieceDefs /> (rendered once in the app).

export interface PieceSet {
  label: string;
  /** Fill for white and black pieces: a colour or url(#gradient). */
  fill?: { w: string; b: string };
  filter?: { w?: string; b?: string };
}

const shadow = 'drop-shadow(0 1.5px 1px rgba(40,20,5,0.35))';

export const PIECE_SETS: Record<string, PieceSet> = {
  classic: { label: 'Classic' },
  wood: { label: 'Wood', fill: { w: '#f3dcb2', b: '#2e1c0e' }, filter: { w: shadow, b: shadow } },
  marble: { label: 'Marble', fill: { w: 'url(#pg-marble-w)', b: 'url(#pg-marble-b)' }, filter: { w: shadow, b: shadow } },
  glass: {
    label: 'Glass',
    fill: { w: 'url(#pg-glass-w)', b: 'url(#pg-glass-b)' },
    filter: { w: 'drop-shadow(0 0 2px rgba(120,190,255,0.7)) drop-shadow(0 1.5px 1px rgba(0,30,60,0.3))', b: 'drop-shadow(0 0 2px rgba(80,120,255,0.6)) drop-shadow(0 1.5px 1px rgba(0,0,30,0.4))' },
  },
  ruby: { label: 'Ruby & Sapphire', fill: { w: 'url(#pg-ruby)', b: 'url(#pg-sapphire)' }, filter: { w: shadow, b: shadow } },
  gold: {
    label: 'Gold & Silver',
    fill: { w: 'url(#pg-gold)', b: 'url(#pg-silver)' },
    filter: { w: 'drop-shadow(0 0 2px rgba(250,204,21,0.6)) drop-shadow(0 1.5px 1px rgba(60,40,0,0.35))', b: shadow },
  },
  jade: { label: 'Jade & Ivory', fill: { w: 'url(#pg-ivory)', b: 'url(#pg-jade)' }, filter: { w: shadow, b: shadow } },
  candy: { label: 'Candy', fill: { w: '#ffd6ea', b: '#8b5cf6' }, filter: { w: shadow, b: shadow } },
  shadow: { label: 'Shadow', fill: { w: '#d6dbe4', b: '#11151f' }, filter: { w: shadow, b: 'drop-shadow(0 0 2px rgba(255,255,255,0.35))' } },
  neon: {
    label: 'Neon',
    fill: { w: '#e6fdff', b: '#2b0f3d' },
    filter: { w: 'drop-shadow(0 0 3px rgba(34,211,238,0.9))', b: 'drop-shadow(0 0 3px rgba(236,72,153,0.9))' },
  },
  bronze: { label: 'Bronze', fill: { w: 'url(#pg-bronze)', b: '#3b2412' }, filter: { w: shadow, b: shadow } },
};

/** Last-move highlight colours: [from, to] square tints. */
export const HIGHLIGHTS: Record<string, { label: string; color: string }> = {
  classic: { label: 'Sunny', color: '250, 204, 21' },
  sky: { label: 'Sky', color: '56, 189, 248' },
  mint: { label: 'Mint', color: '52, 211, 153' },
  rose: { label: 'Rose', color: '251, 113, 133' },
  lavender: { label: 'Lavender', color: '167, 139, 250' },
  gold: { label: 'Gold', color: '234, 179, 8' },
};

export type FxShape = 'rect' | 'star' | 'heart' | 'circle' | 'piece' | 'leaf' | 'coin' | 'snow';

export const CELEBRATIONS: Record<string, { label: string; shapes: FxShape[]; colors: string[]; fireworks?: boolean }> = {
  confetti: { label: 'Confetti', shapes: ['rect'], colors: ['#2f9e63', '#facc15', '#f97316', '#3b82f6', '#ec4899', '#a855f7'] },
  stars: { label: 'Stars', shapes: ['star'], colors: ['#facc15', '#fde68a', '#fbbf24', '#ffffff'] },
  hearts: { label: 'Hearts', shapes: ['heart'], colors: ['#f43f5e', '#fb7185', '#ec4899', '#fda4af'] },
  fireworks: { label: 'Fireworks', shapes: ['circle'], colors: ['#facc15', '#38bdf8', '#f472b6', '#a3e635', '#fb923c'], fireworks: true },
  pieces: { label: 'Chess pieces', shapes: ['piece'], colors: ['#f3dcb2', '#2e1c0e', '#c9962f'] },
  leaves: { label: 'Autumn leaves', shapes: ['leaf'], colors: ['#ea580c', '#f59e0b', '#b45309', '#dc2626', '#65a30d'] },
  coins: { label: 'Gold coins', shapes: ['coin'], colors: ['#facc15', '#eab308', '#fde047'] },
  snow: { label: 'Snowflakes', shapes: ['snow'], colors: ['#ffffff', '#e0f2fe', '#bae6fd'] },
};
