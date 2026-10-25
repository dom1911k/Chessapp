import type { Puzzle } from './types';

interface BandInfo {
  min: number;
  max: number;
  file: string;
  count: number;
  themes: Record<string, number>;
}
export interface PuzzleIndex {
  total: number;
  bands: BandInfo[];
}

type Raw = [string, string, string, number, string];

let indexPromise: Promise<PuzzleIndex> | null = null;
const bandCache = new Map<number, Promise<Puzzle[]>>();

const url = (f: string) => new URL(`puzzles/${f}`, document.baseURI).href;

export function loadIndex(): Promise<PuzzleIndex> {
  indexPromise ??= fetch(url('index.json')).then((r) => r.json());
  return indexPromise;
}

export async function loadBand(min: number): Promise<Puzzle[]> {
  let p = bandCache.get(min);
  if (!p) {
    p = loadIndex().then(async (ix) => {
      const band = ix.bands.find((b) => b.min === min);
      if (!band) return [];
      const raw: Raw[] = await fetch(url(band.file)).then((r) => r.json());
      return raw.map(([id, fen, moves, rating, themes]) => ({ id, fen, moves: moves.split(' '), rating, themes: themes ? themes.split(' ') : [] }));
    });
    bandCache.set(min, p);
  }
  return p;
}

/** Puzzles from all bands overlapping [lo, hi]. */
export async function loadRange(lo: number, hi: number): Promise<Puzzle[]> {
  const ix = await loadIndex();
  const bands = ix.bands.filter((b) => b.max > lo && b.min <= hi);
  const lists = await Promise.all(bands.map((b) => loadBand(b.min)));
  return lists.flat().filter((p) => p.rating >= lo && p.rating <= hi);
}

export async function ratingBounds(): Promise<[number, number]> {
  const ix = await loadIndex();
  return [ix.bands[0].min, ix.bands[ix.bands.length - 1].max];
}
