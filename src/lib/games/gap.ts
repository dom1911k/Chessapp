// The gap tracker: how you score with the coach's safety net, without it (Match conditions),
// and on chess.com over the same period (pure).
import type { AnyGame } from '../store/types';

export interface Tally {
  n: number;
  /** Score in % (win 1, draw ½). */
  pct: number;
}
export interface GapBand {
  /** "600–899" */
  label: string;
  min: number;
  coached: Tally;
  match: Tally;
}
export interface GapReport {
  bands: GapBand[];
  coached: Tally;
  match: Tally;
  chessCom: Tally & { avgOpp: number };
  sentence: string;
}

export const BAND = 300;
export const PERIOD_DAYS = 60;
/** Fewest games on each side of a comparison. */
export const MIN_GAMES = 3;

const tally = (gs: Pick<AnyGame, 'userResult'>[]): Tally => ({
  n: gs.length,
  pct: gs.length ? Math.round((100 * gs.reduce((a, g) => a + (g.userResult === 'win' ? 1 : g.userResult === 'draw' ? 0.5 : 0), 0)) / gs.length) : 0,
});
const bandOf = (elo: number) => Math.floor(elo / BAND) * BAND;

export function gapReport(games: AnyGame[], now = Date.now(), days = PERIOD_DAYS): GapReport {
  const since = now - days * 864e5;
  const recent = games.filter((g) => g.endedAt >= since);
  const app = recent.filter((g) => g.source !== 'chess.com');
  const cc = recent.filter((g) => g.source === 'chess.com');
  const coachedAll = app.filter((g) => !g.match);
  const matchAll = app.filter((g) => g.match);
  const mins = [...new Set(app.map((g) => bandOf(g.elo)))].sort((a, b) => a - b);
  const bands: GapBand[] = mins.map((min) => ({
    label: `${min}–${min + BAND - 1}`,
    min,
    coached: tally(coachedAll.filter((g) => bandOf(g.elo) === min)),
    match: tally(matchAll.filter((g) => bandOf(g.elo) === min)),
  }));
  const chessCom = { ...tally(cc), avgOpp: cc.length ? Math.round(cc.reduce((a, g) => a + g.elo, 0) / cc.length) : 0 };
  return { bands, coached: tally(coachedAll), match: tally(matchAll), chessCom, sentence: gapSentence(bands, tally(coachedAll), tally(matchAll), chessCom) };
}

/** One plain sentence on what the gap suggests. */
export function gapSentence(bands: GapBand[], coached: Tally, match: Tally, cc: Tally): string {
  if (match.n === 0) return 'Play a few games in Match conditions to see how much of your result comes from the safety net.';
  // Compare against the same opponents where both sides have enough games; else overall.
  const same = bands.filter((b) => b.coached.n >= MIN_GAMES && b.match.n >= MIN_GAMES).sort((a, b) => b.coached.n + b.match.n - (a.coached.n + a.match.n))[0];
  const c = same ? same.coached : coached;
  const m = same ? same.match : match;
  if (c.n < MIN_GAMES || m.n < MIN_GAMES) return `${m.n} Match-conditions game${m.n === 1 ? '' : 's'} so far — play at least ${MIN_GAMES} of each kind against similar opponents to compare.`;
  const vs = same ? ' vs the same opponents' : '';
  const ccPart = cc.n >= MIN_GAMES ? ` (and ${cc.pct}% on chess.com)` : '';
  if (c.pct - m.pct >= 15) return `You score ${c.pct}% coached but ${m.pct}% in Match conditions${vs}${ccPart} — the safety net is doing a lot of work. Play more Match-conditions games.`;
  if (m.pct - c.pct >= 10) return `You score ${m.pct}% in Match conditions and ${c.pct}% coached${vs}${ccPart} — you don't need the safety net against these opponents; try stronger ones.`;
  return `You score ${c.pct}% coached and ${m.pct}% in Match conditions${vs}${ccPart} — what you've learned holds up without help.`;
}
