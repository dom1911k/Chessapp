// Quick match opponents (round 7, Phase 3): a new person every game, like the Play button on
// chess.com. Everything about one comes from a single seed, so a rematch gets the same person back:
// a chess.com-like username, a default avatar colour, a rating near yours (never the same by
// design) and 0–2 player types weighted by rating. No book: Maia-3 plays from move 1, except where
// a type has an opening plan. Form applies as in any real game. Pure.
import { quirkById } from '../playerTypes';

export interface Stranger {
  seed: number;
  /** Username, chess.com style ("quietknight88"). */
  name: string;
  /** Default avatar colour (index into STRANGER_COLORS), from the username. */
  avatar: number;
  rating: number;
  /** Player types (ids from playerTypes). */
  types: string[];
}

/** A small seeded generator (mulberry32). */
export function seeded(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const STRANGER = {
  /** Rating: yours plus a normal offset (sd), clamped to ±max, rounded; never exactly yours. */
  ratingSd: 45,
  ratingMax: 100,
  minRating: 100,
  maxRating: 2600,
  /** How many types: none / one / two. */
  typeCounts: [0.3, 0.45, 0.25],
};

/** Muted default-avatar colours (a pawn silhouette on one of these), readable in light and dark. */
export const STRANGER_COLORS = ['#6b8fa3', '#9a7a8c', '#7c9a6b', '#a38a5f', '#7d7aa6', '#a3726b', '#5f9a94', '#8c8f99'];

const ADJ = ['quiet', 'lucky', 'sleepy', 'brave', 'rapid', 'silent', 'happy', 'grumpy', 'clever', 'sneaky', 'tiny', 'mighty', 'lazy', 'eager', 'calm', 'wild', 'sunny', 'misty', 'rusty', 'cosmic', 'jolly', 'gentle', 'swift', 'steady', 'fuzzy', 'bold', 'humble', 'salty', 'spicy', 'chill'];
const NOUN = ['knight', 'rook', 'pawn', 'bishop', 'queen', 'king', 'tiger', 'panda', 'owl', 'fox', 'otter', 'falcon', 'badger', 'raven', 'comet', 'river', 'maple', 'pebble', 'castle', 'gambit', 'tempo', 'walrus', 'beetle', 'cactus', 'noodle', 'wombat', 'llama', 'moose', 'sparrow', 'turnip'];
const FIRST = ['anna', 'ben', 'carla', 'dev', 'emma', 'felix', 'gina', 'hugo', 'ines', 'jonah', 'kai', 'lena', 'milo', 'nora', 'omar', 'pia', 'quinn', 'rosa', 'sami', 'theo', 'uma', 'vera', 'wen', 'yara', 'zoe', 'arjun', 'bea', 'chen', 'dara', 'eli'];
const CHESSY = ['e4_enjoyer', 'd4_dreamer', 'bishop_pair', 'castles_early', 'fianchetto_fan', 'endgame_enjoyer', 'en_passant_fan', 'zugzwang_zone', 'tempo_thief', 'blitz_bunny', 'fork_finder', 'pin_master', 'knight_owl', 'rook_lift', 'pawn_storm', 'back_rank', 'open_file', 'queen_trade', 'tactic_taco', 'sac_attack'];

/** Real people's handles and names that a generated username must never contain. */
export const BLOCKLIST = ['magnus', 'carlsen', 'hikaru', 'nakamura', 'gotham', 'levy', 'rozman', 'naroditsky', 'danya', 'caruana', 'firouzja', 'alireza', 'nihal', 'sarin', 'cramling', 'botez', 'penguin', 'rosen', 'ginger', 'agadmator', 'niemann', 'kasparov', 'fischer', 'polgar', 'anand', 'kramnik', 'nepo', 'gukesh', 'pragg', 'chessbrah', 'chessnetwork', 'hambleton', 'ding', 'aronian', 'so_wesley', 'giri'];

const pick = <T,>(xs: T[], r: () => number) => xs[Math.floor(r() * xs.length) % xs.length];

/** A chess.com-like username from word lists and digits. */
export function makeUsername(r: () => number): string {
  for (let tries = 0; tries < 20; tries++) {
    const digits = () => String(Math.floor(r() * 100)).padStart(r() < 0.5 ? 1 : 2, '0');
    const year = () => String(Math.floor(r() * 30) + (r() < 0.5 ? 70 : 0)).padStart(2, '0');
    const kind = r();
    let name: string;
    if (kind < 0.35) name = `${pick(ADJ, r)}${pick(NOUN, r)}${r() < 0.7 ? digits() : ''}`;
    else if (kind < 0.6) name = `${pick(FIRST, r)}${pick(['_', '.', '', '_'], r)}${r() < 0.5 ? String.fromCharCode(97 + Math.floor(r() * 26)) : year()}`;
    else if (kind < 0.8) name = `${pick(CHESSY, r)}${r() < 0.4 ? digits() : ''}`;
    else name = `${pick(NOUN, r)}${pick(['_', '', '-'], r)}${pick(ADJ, r)}${r() < 0.5 ? digits() : ''}`;
    if (!BLOCKLIST.some((b) => name.includes(b))) return name;
  }
  return `player${Math.floor(r() * 9000) + 1000}`;
}

/** The avatar colour for a username (stable). */
export function avatarFor(name: string): number {
  let h = 0;
  for (const ch of name) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
  return Math.abs(h) % STRANGER_COLORS.length;
}

/**
 * Type weights by rating: Overconfident, Speedster and Pawn Grabber are common below 800;
 * Endgame Grinder, Trapper and Fast Starter above 1000; the rest now and then at any rating.
 */
export function typeWeights(rating: number): [string, number][] {
  const low = rating <= 800 ? 3 : rating >= 1200 ? 1 : 3 - ((rating - 800) / 400) * 2;
  const high = rating >= 1000 ? 3 : rating <= 600 ? 1 : 1 + ((rating - 600) / 400) * 2;
  return [
    ['earlyQueen', low], ['speedster', low], ['pawnGrabber', low],
    ['endgameGrinder', high], ['trapper', high], ['fastStarter', high],
    ['turtle', 1], ['tilter', 1], ['comebackKid', 1], ['gambiteer', 1], ['slowStarter', 1], ['pawnStormer', 1], ['timeTrouble', 1], ['uncastled', 0.5],
  ];
}

/** Types that don't go together (one undoes the other). */
const CLASH: [string, string][] = [['fastStarter', 'slowStarter'], ['speedster', 'timeTrouble']];

function drawTypes(rating: number, r: () => number): string[] {
  const u = r();
  const n = u < STRANGER.typeCounts[0] ? 0 : u < STRANGER.typeCounts[0] + STRANGER.typeCounts[1] ? 1 : 2;
  const out: string[] = [];
  let pool = typeWeights(rating);
  while (out.length < n && pool.length) {
    const total = pool.reduce((a, [, w]) => a + w, 0);
    let x = r() * total;
    let id = pool[pool.length - 1][0];
    for (const [t, w] of pool) if ((x -= w) < 0) { id = t; break; }
    out.push(id);
    pool = pool.filter(([t]) => t !== id && !CLASH.some(([a, b]) => (a === id && b === t) || (b === id && a === t)));
  }
  return out;
}

/** The opponent for `seed`, near `yourRating`. The same seed and rating give the same person. */
export function strangerFor(seed: number, yourRating: number): Stranger {
  const r = seeded(seed);
  const name = makeUsername(r);
  // Rating: a normal offset (Box–Muller), clamped, never exactly yours.
  const z = Math.sqrt(-2 * Math.log(Math.max(1e-9, r()))) * Math.cos(2 * Math.PI * r());
  let off = Math.round(Math.max(-STRANGER.ratingMax, Math.min(STRANGER.ratingMax, z * STRANGER.ratingSd)));
  if (off === 0) off = r() < 0.5 ? -1 : 1;
  const rating = Math.max(STRANGER.minRating, Math.min(STRANGER.maxRating, Math.round(yourRating) + off));
  return { seed, name, avatar: avatarFor(name), rating, types: drawTypes(rating, r) };
}

/** A fresh seed for the next opponent. */
export const newStrangerSeed = (rand: () => number = Math.random) => Math.floor(rand() * 2 ** 31);

/** "Their style: Gambiteer · Speedster", or "No particular style". */
export function styleLine(types: string[] | undefined): string {
  const names = (types ?? []).map((t) => quirkById(t)?.name).filter(Boolean);
  return names.length ? `Their style: ${names.join(' · ')}` : 'No particular style';
}
