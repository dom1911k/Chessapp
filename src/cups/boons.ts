// Boons (last the whole cup) and charms (single use). They give time, information, forgiveness
// or choices — never extra moves or new piece abilities.
import type { CardInfo, Rarity } from './ui/bits';
import { TUNING } from './tuning';

const B = TUNING.boons;
const G = TUNING.gold;
const C = TUNING.charms;

export type BoonId = 'extraMinute' | 'steadyHand' | 'openingPrep' | 'secondWind' | 'scoutReport' | 'rattled' | 'drawOdds' | 'secondChance' | 'homePrep' | 'longNight';
export type CharmId = 'rewind' | 'threatBell' | 'candidates' | 'colour' | 'battlefield';

export interface BoonInfo extends CardInfo {
  id: BoonId;
  rarity: Rarity;
  /** In the pool from the start (others are bought in the Laurel shop). */
  starting: boolean;
}

export interface CharmInfo extends CardInfo {
  id: CharmId;
  starting: boolean;
  /** Used before a game (on the opponent card) rather than during it. */
  pregame?: boolean;
}

const secs = (ms: number) => `${Math.round(ms / 1000)} s`;
const mins = (ms: number) => (ms % 60_000 ? `${Math.floor(ms / 60_000)}:${String(Math.round((ms % 60_000) / 1000)).padStart(2, '0')}` : `${ms / 60_000}:00`);

/** Upgrade levels per boon/charm id (missing = level I). */
export type Levels = Record<string, number>;
/** A boon's or charm's level, 1–3. */
export const lv = (levels: Levels | undefined, id: string) => Math.max(1, Math.min(TUNING.levels.max, levels?.[id] ?? 1));
/** The value for a level from an [I, II, III] list. */
export const at = <T,>(list: readonly T[], level: number): T => list[Math.max(0, Math.min(list.length - 1, level - 1))];
const ROMAN = ['I', 'II', 'III'];
export const levelName = (level: number) => ROMAN[level - 1] ?? String(level);

/** Card face and description for a boon at a level. */
function boonTexts(id: BoonId, l: number): { short: string; text: string } {
  switch (id) {
    case 'extraMinute': {
      const ms = at(B.extraMinuteMs, l);
      return { short: `+${mins(ms)} on your clock`, text: `You start every game with ${mins(ms)} extra on your clock. Your opponent has the normal time.` };
    }
    case 'steadyHand':
      return { short: `+${secs(at(B.steadyHandIncMs, l))} per move`, text: `You gain ${secs(at(B.steadyHandIncMs, l))} with every move you make. Only you.` };
    case 'openingPrep':
      return { short: `First ${at(B.openingPrepMoves, l)} moves free`, text: `Your first ${at(B.openingPrepMoves, l)} moves of each game cost no clock time.` };
    case 'secondWind':
      return { short: `+${secs(at(B.secondWindAddMs, l))} below ${secs(B.secondWindBelowMs)}`, text: `Once per game, when your clock drops below ${secs(B.secondWindBelowMs)}, you get ${secs(at(B.secondWindAddMs, l))} more.` };
    case 'scoutReport':
      return l === 1
        ? { short: 'See all quirks', text: 'Before each game you see all of your opponent’s quirks, hidden ones included.' }
        : { short: l === 3 ? 'Quirks, openings, 4 boons' : 'See openings and quirks', text: `Before each game you see your opponent’s favourite openings and all of their quirks, hidden ones included.${l === 3 ? ' Boon picks show four cards instead of three.' : ''}` };
    case 'rattled':
      return { short: 'Win material, they wobble', text: `After you win material, your opponent plays looser for their next ${at(B.rattledMoves, l)} moves.` };
    case 'drawOdds':
      return at(B.drawOddsMaxRound, l) < 2
        ? { short: 'Draw = win (not final)', text: 'In the quarter- and semi-final, a draw sends you through, even with White.' }
        : { short: 'A draw counts as a win', text: `A draw sends you through, even with White.${at(B.drawOddsWinGold, l) ? ' Such a draw also pays the gold of a win.' : ''}` };
    case 'secondChance':
      return at(B.secondChanceFinal, l)
        ? { short: 'Survive one knockout', text: `Once per cup, a loss that would knock you out is replayed instead: same opponent, colours swapped.${at(B.secondChanceExtraMs, l) ? ` The replay gives you ${mins(at(B.secondChanceExtraMs, l))} extra.` : ''}` }
        : { short: 'Survive one knockout (not final)', text: 'Once per cup, a lost quarter- or semi-final is replayed instead: same opponent, colours swapped.' };
    case 'homePrep':
      return {
        short: at(B.homePrepBlack, l) ? 'Start from your repertoire' : 'Repertoire start (White)',
        text: `${at(B.homePrepBlack, l) ? 'Games' : 'Your White games'} start at the end of one of your own repertoire lines for your colour (Learn → My repertoire). With no line for that colour it does nothing.${at(B.homePrepFreeMoves, l) ? ` Your next ${at(B.homePrepFreeMoves, l)} moves after the line cost no clock time.` : ''}`,
      };
    case 'longNight':
      return { short: `Finalist −${at(B.longNightElo, l)} rating`, text: `Your opponent in the final plays ${at(B.longNightElo, l)} rating points weaker.` };
  }
}

function charmTexts(id: CharmId, l: number): { short: string; text: string } {
  switch (id) {
    case 'rewind':
      return { short: 'Take back a move', text: `Take back your last move (and your opponent’s reply). Costs ${at(C.prices.rewind, l)} gold.` };
    case 'threatBell': {
      const what = at(C.threatBellMinValue, l) >= 5 ? 'hang a rook or queen' : 'hang a piece';
      const n = at(C.threatBellMoves, l);
      return { short: n > 1 ? 'Guards your next 2 moves' : 'Warns before a blunder', text: `For your next ${n > 1 ? `${n} moves` : 'move only'}: if it would ${what} or allow mate, the bell rings and you choose again.` };
    }
    case 'candidates': {
      const n = at(C.candidateCards, l);
      return { short: `${n} moves, one best`, text: `${n} moves to choose from: one is the engine’s best, the other${n > 2 ? 's are moves' : ' is a move'} a player at your level would likely play.` };
    }
    case 'colour':
      return { short: 'Pick White or Black', text: `Choose your colour for the next game. (With Black, a draw sends you through.) Costs ${at(C.prices.colour, l)} gold.` };
    case 'battlefield':
      return { short: 'Pick the opening position', text: `Start the next game from one of ${at(C.battlefieldOptions, l)} opening positions, ${C.battlefieldPlies[0]}–${C.battlefieldPlies[1]} half-moves in.` };
  }
}

const BOON_BASE: Record<BoonId, Omit<BoonInfo, 'short' | 'text'>> = {
  extraMinute: { id: 'extraMinute', numeral: 'I', name: 'Extra Minute', glyph: 'hourglass', rarity: 'common', starting: true },
  steadyHand: { id: 'steadyHand', numeral: 'II', name: 'Steady Hand', glyph: 'feather', rarity: 'common', starting: true },
  openingPrep: { id: 'openingPrep', numeral: 'III', name: 'Opening Prep', glyph: 'book', rarity: 'common', starting: true },
  secondWind: { id: 'secondWind', numeral: 'IV', name: 'Second Wind', glyph: 'bolt', rarity: 'uncommon', starting: true },
  scoutReport: { id: 'scoutReport', numeral: 'V', name: 'Scout Report', glyph: 'eye', rarity: 'common', starting: true },
  rattled: { id: 'rattled', numeral: 'VI', name: 'Rattled', glyph: 'skull', rarity: 'uncommon', starting: true },
  drawOdds: { id: 'drawOdds', numeral: 'VII', name: 'Draw Odds', glyph: 'scale', rarity: 'uncommon', starting: false },
  secondChance: { id: 'secondChance', numeral: 'VIII', name: 'Second Chance', glyph: 'clover', rarity: 'rare', starting: false },
  homePrep: { id: 'homePrep', numeral: 'IX', name: 'Home Prep', glyph: 'scroll', rarity: 'uncommon', starting: false },
  longNight: { id: 'longNight', numeral: 'X', name: 'Long Night', glyph: 'moon', rarity: 'uncommon', starting: false },
};

const CHARM_BASE: Record<CharmId, Omit<CharmInfo, 'short' | 'text'>> = {
  rewind: { id: 'rewind', numeral: 'XI', name: 'Rewind', glyph: 'rewind', starting: true },
  threatBell: { id: 'threatBell', numeral: 'XII', name: 'Threat Bell', glyph: 'bell', starting: true },
  candidates: { id: 'candidates', numeral: 'XIII', name: 'Candidate Cards', glyph: 'cards', starting: true },
  colour: { id: 'colour', numeral: 'XIV', name: 'Choose Your Colour', glyph: 'dice', starting: true, pregame: true },
  battlefield: { id: 'battlefield', numeral: 'XV', name: 'Battlefield', glyph: 'compass', starting: false, pregame: true },
};

/** A boon's card at a level (default I). */
export const boonCard = (id: BoonId, level = 1): BoonInfo => ({ ...BOON_BASE[id], ...boonTexts(id, level), level });
/** A charm's card at a level (default I). */
export const charmCard = (id: CharmId, level = 1): CharmInfo => ({ ...CHARM_BASE[id], ...charmTexts(id, level), level });

/** Level-I cards (names, glyphs and flags; use boonCard/charmCard for the text at your level). */
export const BOONS = Object.fromEntries(Object.keys(BOON_BASE).map((id) => [id, boonCard(id as BoonId)])) as Record<BoonId, BoonInfo>;
export const CHARMS = Object.fromEntries(Object.keys(CHARM_BASE).map((id) => [id, charmCard(id as CharmId)])) as Record<CharmId, CharmInfo>;

export const ALL_BOONS = Object.keys(BOONS) as BoonId[];
export const ALL_CHARMS = Object.keys(CHARMS) as CharmId[];
export const charmPrice = (id: CharmId, levels?: Levels) => at(C.prices[id] ?? [5], lv(levels, id));
/** Some charms may only be held once at a time (Rewind). */
export const canHoldCharm = (held: CharmId[], id: CharmId) => held.filter((h) => h === id).length < (C.maxHeld[id] ?? Infinity);

/** Boons and charms you can be offered: the starting ones plus what you unlocked with Laurels. */
export const boonPool = (unlocked: string[]) => ALL_BOONS.filter((b) => BOONS[b].starting || unlocked.includes(b));
export const charmPool = (unlocked: string[]) => ALL_CHARMS.filter((c) => CHARMS[c].starting || unlocked.includes(c));

/** Pick `n` boons you don't have yet; a rare one only now and then. */
export function boonOffer(owned: BoonId[], unlocked: string[], rand: () => number, n: number = B.offer): BoonId[] {
  const pool = boonPool(unlocked).filter((b) => !owned.includes(b) && (BOONS[b].rarity !== 'rare' || rand() < B.rareChance));
  const out: BoonId[] = [];
  const left = [...pool];
  while (out.length < n && left.length) out.push(left.splice(Math.floor(rand() * left.length), 1)[0]);
  return out;
}

/** Three charms for the shop (different ones while the pool allows). */
export function shopOffer(unlocked: string[], rand: () => number, n = C.shopOffer): CharmId[] {
  const left = [...charmPool(unlocked)];
  const out: CharmId[] = [];
  while (out.length < n && left.length) out.push(left.splice(Math.floor(rand() * left.length), 1)[0]);
  return out;
}

export interface GoldPart {
  label: string;
  amount: number;
}

/** Gold for one game, as the lines of the tally. */
export function goldFor(o: { userResult: 'win' | 'loss' | 'draw'; advanced: boolean; accuracy: number; greats: number }): { parts: GoldPart[]; total: number } {
  const parts: GoldPart[] = [];
  if (o.userResult === 'win') parts.push({ label: 'Win', amount: G.goldWin });
  else if (o.userResult === 'draw' && o.advanced) parts.push({ label: 'Draw — through', amount: G.goldDraw });
  const acc = Math.floor(Math.max(0, o.accuracy - G.goldAccFloor) * G.goldPerAccPoint);
  if (acc > 0) parts.push({ label: `Accuracy ${Math.round(o.accuracy)}%`, amount: acc });
  if (o.greats > 0) parts.push({ label: `${o.greats} great move${o.greats === 1 ? '' : 's'}`, amount: o.greats * G.goldGreat });
  return { parts, total: parts.reduce((n, p) => n + p.amount, 0) };
}

/** Cards in a boon pick (Scout Report III shows one more). */
export const offerSize = (boons: BoonId[], levels?: Levels) => (boons.includes('scoutReport') ? at(B.scoutOffer, lv(levels, 'scoutReport')) : B.offer);

/** What your boons change at the start of a game. */
export function gameStartMods(boons: BoonId[], color: 'w' | 'b', levels?: Levels): { extraMs: { w?: number; b?: number }; extraInc: { w?: number; b?: number }; freeMoves: number } {
  return {
    extraMs: boons.includes('extraMinute') ? { [color]: at(B.extraMinuteMs, lv(levels, 'extraMinute')) } : {},
    extraInc: boons.includes('steadyHand') ? { [color]: at(B.steadyHandIncMs, lv(levels, 'steadyHand')) } : {},
    freeMoves: boons.includes('openingPrep') ? at(B.openingPrepMoves, lv(levels, 'openingPrep')) : 0,
  };
}

/** A few words for what a level gives (upgrade rows: "level now → next"). */
export function levelLine(id: BoonId | CharmId, l: number): string {
  switch (id) {
    case 'extraMinute': return `+${mins(at(B.extraMinuteMs, l))} clock`;
    case 'steadyHand': return `+${secs(at(B.steadyHandIncMs, l))} per move`;
    case 'openingPrep': return `${at(B.openingPrepMoves, l)} free moves`;
    case 'secondWind': return `+${secs(at(B.secondWindAddMs, l))}`;
    case 'scoutReport': return ['quirks', 'quirks + openings', '+ 4th boon card'][l - 1];
    case 'rattled': return `${at(B.rattledMoves, l)} shaky moves${l === 3 ? ', shakier' : ''}`;
    case 'drawOdds': return ['up to the semi-final', 'every round', '+ win gold'][l - 1];
    case 'secondChance': return ['not in the final', 'any round', '+1:00 on the replay'][l - 1];
    case 'homePrep': return ['White only', 'both colours', '+5 free moves'][l - 1];
    case 'longNight': return `finalist −${at(B.longNightElo, l)}`;
    case 'rewind': return `${at(C.prices.rewind, l)} gold`;
    case 'threatBell': return ['rook & queen', 'any piece', 'two moves'][l - 1];
    case 'candidates': return `${at(C.candidateCards, l)} cards`;
    case 'colour': return `${at(C.prices.colour, l)} gold`;
    case 'battlefield': return `${at(C.battlefieldOptions, l)} positions`;
  }
}
