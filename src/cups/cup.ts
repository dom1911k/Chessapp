// One cup from start to finish (pure state transitions; the store saves them).
import { ROUND_NAMES, YOU, defaultColor, pickField, roundRating, seedBracket, simulateRound, type CupTier, type Place, type SimMatch } from './ladder';
import { TUNING } from './tuning';
import { assignQuirks } from './quirks';
import { rng } from './ladder';
import { at, goldFor, lv, type BoonId, type CharmId, type GoldPart, type Levels } from './boons';
import type { HeatId } from './heat';
import type { CupEvent } from './game';

/** How one of your games went. */
export interface RoundRecord {
  round: number;
  opponentId: string;
  elo: number;
  color: 'w' | 'b';
  result: 'win' | 'loss' | 'draw';
  reason: string;
  advanced: boolean;
  /** Your moves in the game. */
  moves: number;
  opening?: string;
  accuracy?: number;
  /** Seconds left on your clock at the end. */
  clockLeft?: number;
  /** The game in the app's history (Past games, rivalry). */
  gameId?: number;
  /** Gold this game earned. */
  gold?: number;
  /** What boons, charms and quirks did in the game (for the chronicle). */
  events?: CupEvent[];
  /** A lost game that Second Chance replayed. */
  replayed?: boolean;
  /** Great or brilliant moves you played (sponsor contracts). */
  greats?: number;
  /** The moment that decided it. */
  decisive?: import('./game').Decisive;
}

export interface CupState {
  v: 2;
  id: string;
  tier: CupTier;
  seed: number;
  startedAt: number;
  /** The seven characters, weakest seed first. */
  field: string[];
  /** Seed ratings inside the band (simulated matches). */
  ratings: Record<string, number>;
  /** Players still in, per round: 8, then 4, 2, 1. */
  rounds: string[][];
  /** The bots' matches of each round played so far. */
  sims: SimMatch[][];
  yours: RoundRecord[];
  /** Set when you are out or have won. */
  place?: Place;
  endedAt?: number;
  /** Boons (whole cup), charm slots and gold. */
  boons: BoonId[];
  charms: CharmId[];
  gold: number;
  /** Between rounds: pick a boon, then visit the shop. */
  flow?: 'boon' | 'shop';
  offer?: BoonId[];
  shop?: CharmId[];
  /** The last game's gold, for the tally. */
  lastGold?: GoldPart[];
  /** Choices for the next game (Choose Your Colour, Battlefield). */
  nextColor?: 'w' | 'b';
  nextStart?: { fen: string; sans: string[]; name: string };
  /** Second Chance has been used (and the replayed games). */
  secondChanceUsed?: boolean;
  /** Charms used in this cup (the cabinet records wins without any). */
  charmsUsed: number;
  /** Each character's visible quirk, and the finalist's hidden one (set when the final starts). */
  quirks: Record<string, string>;
  hidden?: string;
  /** Two-Faced heat: the hidden quirk of the quarter- and semi-final opponents (by round). */
  hiddens?: Record<number, string>;
  /** Boon and charm levels for this cup (taken from your upgrades when it starts). */
  levels: Levels;
  /** Heat challenges switched on for this cup. */
  heat: HeatId[];
  /** The sponsor's contract signed for this cup. */
  sponsor?: string;
  /** Your nemesis is in this cup: they win their other matches and play stronger per grudge. */
  nemesis?: { id: string; grudge: number };
  /** Extra time for your next game (Second Chance III). */
  nextExtraMs?: number;
  /** Quirks you beat for the first time in this cup (codex). */
  codexNew?: string[];
  /** What the finished cup paid, line by line. */
  rewards?: { label: string; laurels: number }[];
}

export interface CupOptions {
  levels?: Levels;
  heat?: HeatId[];
  sponsor?: string;
  nemesis?: { id: string; grudge: number; quirk?: string };
}

export function newCup(tier: CupTier, seed: number, now = Date.now(), recentQuirks: string[] = [], opts: CupOptions = {}): CupState {
  const picked = pickField(tier, seed);
  let field = picked.field;
  const ratings = { ...picked.ratings };
  const nem = opts.nemesis;
  if (nem) {
    // Your nemesis is in the other half of the bracket (field[3..6]), so you meet them in the final.
    if (!field.includes(nem.id)) {
      const out = field[6];
      ratings[nem.id] = ratings[out];
      delete ratings[out];
      field = field.map((f) => (f === out ? nem.id : f));
    } else if (field.indexOf(nem.id) < 3) {
      const i = field.indexOf(nem.id);
      [field[i], field[6]] = [field[6], field[i]];
      [ratings[field[i]], ratings[field[6]]] = [ratings[field[6]], ratings[field[i]]];
      field = [...field];
    }
  }
  const quirks = assignQuirks(field, recentQuirks, rng(seed + 7));
  if (nem?.quirk) quirks[nem.id] = nem.quirk;
  return {
    v: 2,
    id: `${tier}-${now}`,
    tier,
    seed,
    startedAt: now,
    field,
    ratings,
    rounds: [seedBracket(field)],
    sims: [],
    yours: [],
    boons: [],
    charms: [],
    gold: TUNING.gold.start + (opts.sponsor ? TUNING.sponsors.signingGold : 0),
    charmsUsed: 0,
    quirks,
    levels: opts.levels ?? {},
    heat: opts.heat ?? [],
    sponsor: opts.sponsor,
    nemesis: nem ? { id: nem.id, grudge: nem.grudge } : undefined,
  };
}

export const heatOn = (c: Pick<CupState, 'heat'>, id: HeatId) => (c.heat ?? []).includes(id);
const lvl = (c: Pick<CupState, 'levels'>, id: string) => lv(c.levels, id);

/** Does this result send you through? Black's draw odds (unless No Draw Odds heat) and the Draw Odds boon (up to its round). */
export function cupAdvances(c: CupState, result: 'win' | 'loss' | 'draw', color: 'w' | 'b', round = currentRound(c)): boolean {
  if (result === 'win') return true;
  if (result !== 'draw') return false;
  if (hasBoon(c, 'drawOdds') && round <= at(TUNING.boons.drawOddsMaxRound, lvl(c, 'drawOdds'))) return true;
  return color === 'b' && !heatOn(c, 'noDrawOdds');
}

/** A draw that only Draw Odds III turned into a win pays win gold. */
export const drawPaysWin = (c: CupState, result: 'win' | 'loss' | 'draw', color: 'w' | 'b') =>
  result === 'draw' && hasBoon(c, 'drawOdds') && at(TUNING.boons.drawOddsWinGold, lvl(c, 'drawOdds')) && cupAdvances(c, result, color);

export const currentRound = (c: CupState) => c.rounds.length - 1;
export const roundName = (c: CupState) => ROUND_NAMES[Math.min(2, currentRound(c))];

/** Who you play next (null once the cup is over). */
export function yourOpponent(c: CupState): string | null {
  if (c.place) return null;
  const alive = c.rounds[currentRound(c)];
  const i = alive.indexOf(YOU);
  return i < 0 ? null : alive[i % 2 === 0 ? i + 1 : i - 1];
}

/** Your colour next game: a Choose Your Colour pick, a Second Chance swap, or the default. */
export const yourColor = (c: CupState): 'w' | 'b' => c.nextColor ?? defaultColor(currentRound(c), c.seed);
/** Your opponent's rating this round (Long Night weakens the finalist). */
export function opponentRating(c: CupState): number {
  const round = currentRound(c);
  let r = roundRating(c.tier, round);
  if (round === 2 && c.boons.includes('longNight')) r -= at(TUNING.boons.longNightElo, lvl(c, 'longNight'));
  if (heatOn(c, 'sharper')) r += TUNING.heat.mods.sharper.elo ?? 0;
  if (c.nemesis && yourOpponent(c) === c.nemesis.id) r += TUNING.mastery.grudgeElo * Math.min(TUNING.mastery.maxGrudge, c.nemesis.grudge);
  return r;
}
export const hasBoon = (c: CupState, b: BoonId) => c.boons.includes(b);

/** Would this result knock you out, and can Second Chance save it? */
export const secondChanceApplies = (c: CupState, result: 'win' | 'loss' | 'draw', color: 'w' | 'b') =>
  !cupAdvances(c, result, color) && hasBoon(c, 'secondChance') && !c.secondChanceUsed && (currentRound(c) < 2 || at(TUNING.boons.secondChanceFinal, lvl(c, 'secondChance')));

/** Second Chance: the lost game is kept for the record; the round is replayed with colours swapped. */
export function applySecondChance(c: CupState, rec: Omit<RoundRecord, 'round' | 'advanced'>): CupState {
  // A new game: a Battlefield start chosen for the lost game does not carry over.
  const extra = at(TUNING.boons.secondChanceExtraMs, lvl(c, 'secondChance'));
  return { ...c, secondChanceUsed: true, nextColor: rec.color === 'w' ? 'b' : 'w', nextStart: undefined, nextExtraMs: extra || undefined, yours: [...c.yours, { ...rec, round: currentRound(c), advanced: false, replayed: true }] };
}

/** Your games that counted (not the ones Second Chance replayed). */
export const counted = (c: CupState) => c.yours.filter((r) => !r.replayed);

/** Your result is in: play the round (your match plus the simulated ones) and move the bracket on. */
export function applyResult(c: CupState, rec: Omit<RoundRecord, 'round' | 'advanced'>, opts: { now?: number } = {}): CupState {
  const round = currentRound(c);
  const alive = c.rounds[round];
  const through = cupAdvances(c, rec.result, rec.color, round);
  const sims = simulateRound(alive, c.ratings, c.seed, round, c.nemesis?.id);
  const next: string[] = [];
  for (let i = 0; i < alive.length; i += 2) {
    const [a, b] = [alive[i], alive[i + 1]];
    if (a === YOU || b === YOU) next.push(through ? YOU : rec.opponentId);
    else next.push(sims.find((m) => m.a === a && m.b === b)!.winner);
  }
  const out: CupState = { ...c, rounds: [...c.rounds, next], sims: [...c.sims, sims], yours: [...c.yours, { ...rec, round, advanced: through }], nextColor: undefined, nextStart: undefined, nextExtraMs: undefined };
  if (!through) return finishOff({ ...out, place: round === 0 ? 'quarter' : round === 1 ? 'semi' : 'final', endedAt: opts.now ?? Date.now() });
  return next.length === 1 ? { ...out, place: 'winner', endedAt: opts.now ?? Date.now() } : out;
}

/** After you are out, the bots play the bracket to the end, so it shows a champion. */
function finishOff(c: CupState): CupState {
  let cur = c;
  while (cur.rounds[cur.rounds.length - 1].length > 1) {
    const round = cur.rounds.length - 1;
    const alive = cur.rounds[round];
    const sims = simulateRound(alive, c.ratings, c.seed + 100, round, c.nemesis?.id);
    cur = { ...cur, rounds: [...cur.rounds, sims.map((m) => m.winner)], sims: [...cur.sims, sims] };
  }
  return cur;
}

export const champion = (c: CupState): string | null => {
  const last = c.rounds[c.rounds.length - 1];
  return last.length === 1 ? last[0] : null;
};

/** Total moves you played in a cup (fastest-win record). */
export const cupMoves = (c: CupState) => c.yours.reduce((n, r) => n + r.moves, 0);

/** Has your next game already been decided by a past round (guards against double counting)? */
export const roundDone = (c: CupState, round: number) => c.yours.some((r) => r.round === round && !r.replayed);

/** The cup as remembered once it is over. */
export function summarize(c: CupState): import('./meta').CupSummary {
  const games = counted(c);
  const lost = games.find((r) => !r.advanced);
  return {
    id: c.id,
    tier: c.tier,
    place: c.place ?? 'quarter',
    endedAt: c.endedAt ?? Date.now(),
    moves: games.reduce((n, r) => n + r.moves, 0),
    charmsUsed: c.charmsUsed,
    secondChance: !!c.secondChanceUsed,
    eliminatedBy: lost?.opponentId,
    beaten: games.filter((r) => r.advanced).map((r) => r.opponentId),
  };
}

/** Gold for one of your games in this cup: Draw Odds III pays a win, Stingy Purse heat halves it. */
export function cupGold(c: CupState, o: { userResult: 'win' | 'loss' | 'draw'; color: 'w' | 'b'; accuracy: number; greats: number }): { parts: GoldPart[]; total: number } {
  const through = cupAdvances(c, o.userResult, o.color);
  const raw = goldFor({ userResult: drawPaysWin(c, o.userResult, o.color) ? 'win' : o.userResult, advanced: through, accuracy: o.accuracy, greats: o.greats });
  if (!heatOn(c, 'stingy') || raw.total === 0) return raw;
  const total = Math.floor(raw.total * (TUNING.heat.mods.stingy.goldFactor ?? 0.5));
  return { parts: [...raw.parts, { label: 'Stingy Purse', amount: total - raw.total }], total };
}
