import { db, kvGet } from '../db';
import { THEMES } from '../lessons';
import { FOCUS_KEY } from '../store/finish';
import type { Theme } from '../coach/types';
import { loadRange } from './data';
import { getRating } from './rating';
import { THEME_SETS } from './themes';
import type { Puzzle } from './types';

async function attemptedIds(): Promise<Set<string>> {
  const ids = await db.attempts.orderBy('puzzleId').uniqueKeys();
  return new Set(ids as string[]);
}

function pick<T>(list: T[]): T | null {
  return list.length ? list[Math.floor(Math.random() * list.length)] : null;
}

/** A fresh puzzle near the user's rating, optionally restricted to a theme. */
export async function nextPuzzle(theme?: string, rating?: number): Promise<Puzzle | null> {
  const r = rating ?? (await getRating()).rating;
  const done = await attemptedIds();
  // Widen the window until something fits.
  for (const [lo, hi] of [[r - 100, r + 150], [r - 250, r + 300], [0, 4000]]) {
    const pool = (await loadRange(lo, hi)).filter((p) => !done.has(p.id) && (!theme || p.themes.includes(theme)));
    const p = pick(pool);
    if (p) return p;
  }
  return null;
}

export interface ThemeStat {
  id: string;
  attempts: number;
  solved: number;
  /** Smoothed success rate (0..1). */
  score: number;
}

export async function themeStats(): Promise<ThemeStat[]> {
  const attempts = await db.attempts.toArray();
  return THEME_SETS.map((t) => {
    const mine = attempts.filter((a) => a.themes.includes(t.id));
    const solved = mine.filter((a) => a.success).length;
    return { id: t.id, attempts: mine.length, solved, score: (solved + 2) / (mine.length + 4) };
  });
}

/** Weakest themes first. The lesson from the last game (if recent) leads the list. */
export async function weakestThemes(n = 3): Promise<string[]> {
  const stats = await themeStats();
  const focus = await kvGet<{ theme: Theme; until: number } | null>(FOCUS_KEY, null);
  const out: string[] = [];
  if (focus && focus.until > Date.now()) {
    for (const t of THEMES[focus.theme]?.puzzleThemes ?? []) if (THEME_SETS.some((s) => s.id === t)) out.push(t);
  }
  const tried = stats.filter((s) => s.attempts >= 3).sort((a, b) => a.score - b.score);
  const untried = stats.filter((s) => s.attempts < 3);
  for (const s of [...tried.filter((x) => x.score < 0.75), ...untried, ...tried]) if (!out.includes(s.id)) out.push(s.id);
  return out.slice(0, n);
}
