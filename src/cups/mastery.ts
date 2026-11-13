// Lasting goals across cups: three stars per tier, the quirk codex, your nemesis, Heat records and
// sponsor contracts. Pure functions: given the finished cup and your progress, what changes.
import { counted, type CupState } from './cup';
import type { CupsMeta } from './meta';
import { heatLaurels, heatOf } from './heat';
import { laurelsFor } from './laurels';
import { sponsorById, sponsorReward } from './sponsors';
import { QUIRKS } from './quirks';
import { TIERS } from './ladder';
import { TUNING } from './tuning';

const M = TUNING.mastery;

export interface RewardLine {
  label: string;
  laurels: number;
}

export const STAR_NAMES = ['Win the cup', 'Win every game', `Win at heat ${M.starHeat}+`];

/** Every counted game won, without Second Chance. */
export const flawless = (c: CupState) => c.place === 'winner' && !c.secondChanceUsed && counted(c).every((r) => r.result === 'win');

/** Stars this cup earns (whether or not you had them already). */
export function starsEarned(c: CupState): boolean[] {
  const won = c.place === 'winner';
  return [won, won && flawless(c), won && heatOf(c.heat) >= M.starHeat];
}

/** Total stars across tiers. */
export const starCount = (stars: CupsMeta['stars']) => Object.values(stars).reduce((n, s) => n + (s?.filter(Boolean).length ?? 0), 0);
export const allStars = () => TIERS.length * 3;

/** The codex after a game against these quirks; which ones you beat for the first time. */
export function codexAfterGame(codex: CupsMeta['codex'], quirks: string[], won: boolean): { codex: CupsMeta['codex']; firsts: string[] } {
  const next = { ...codex };
  const firsts: string[] = [];
  for (const q of quirks) {
    const e = next[q] ?? { faced: 0, beaten: 0 };
    if (won && e.beaten === 0) firsts.push(q);
    next[q] = { faced: e.faced + 1, beaten: e.beaten + (won ? 1 : 0) };
  }
  return { codex: next, firsts };
}

export const codexDone = (codex: CupsMeta['codex']) => QUIRKS.every((q) => (codex[q.id]?.beaten ?? 0) > 0);

/** Your nemesis after a cup: beaten (cleared), angrier (knocked you out again) or newly made. */
export function nemesisAfterCup(prev: CupsMeta['nemesis'], c: CupState): { nemesis: CupsMeta['nemesis']; beaten: string | null } {
  const games = counted(c);
  if (prev && games.some((r) => r.opponentId === prev.id && r.advanced)) return { nemesis: undefined, beaten: prev.id };
  const by = c.place !== 'winner' ? games.find((r) => !r.advanced)?.opponentId : undefined;
  if (!by) return { nemesis: prev, beaten: null };
  if (prev?.id === by) return { nemesis: { ...prev, grudge: prev.grudge + 1, tier: c.tier }, beaten: null };
  if (prev) return { nemesis: prev, beaten: null };
  return { nemesis: { id: by, grudge: 1, quirk: c.quirks[by], tier: c.tier }, beaten: null };
}

/** Everything a finished cup pays and changes in your lasting progress. */
export function cupEnd(c: CupState, meta: CupsMeta): { lines: RewardLine[]; patch: Partial<CupsMeta> } {
  const place = c.place ?? 'quarter';
  const lines: RewardLine[] = [];
  const base = laurelsFor(place);
  if (base) lines.push({ label: place === 'winner' ? 'Cup won' : place === 'final' ? 'Reached the final' : 'Reached the semi-final', laurels: base });
  const heat = heatOf(c.heat);
  const hl = heatLaurels(heat, place);
  if (hl) lines.push({ label: `Heat ${heat}`, laurels: hl });
  const sp = sponsorById(c.sponsor);
  let contractsDone = meta.contractsDone ?? 0;
  if (sp && sp.done(c)) {
    lines.push({ label: `${sp.name} contract`, laurels: sponsorReward(sp, c.tier) });
    contractsDone++;
  }
  const had = meta.stars[c.tier] ?? [false, false, false];
  const earned = starsEarned(c);
  const stars = had.map((h, i) => h || earned[i]);
  earned.forEach((e, i) => e && !had[i] && lines.push({ label: `Star: ${STAR_NAMES[i]}`, laurels: M.starLaurels }));
  const nem = nemesisAfterCup(meta.nemesis, c);
  const nemesesBeaten = nem.beaten ? [...(meta.nemesesBeaten ?? []), nem.beaten] : meta.nemesesBeaten ?? [];
  if (nem.beaten) lines.push({ label: 'Nemesis defeated', laurels: M.nemesisLaurels });
  const heatBest = { ...meta.heatBest };
  if (place === 'winner') heatBest[c.tier] = Math.max(heatBest[c.tier] ?? 0, heat);
  const allStarsNow = starCount({ ...meta.stars, [c.tier]: stars }) === allStars();
  const unlocks = allStarsNow && !meta.unlocks.includes('title:grand') ? [...meta.unlocks, 'title:grand', 'frame:grand'] : meta.unlocks;
  return {
    lines,
    patch: { stars: { ...meta.stars, [c.tier]: stars }, nemesis: nem.nemesis, nemesesBeaten, heatBest, contractsDone, unlocks },
  };
}
