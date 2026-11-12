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

export const BOONS: Record<BoonId, BoonInfo> = {
  extraMinute: { id: 'extraMinute', numeral: 'I', name: 'Extra Minute', glyph: 'hourglass', rarity: 'common', starting: true, short: `+${B.extraMinuteMs / 60_000}:00 on your clock`, text: `You start every game with ${B.extraMinuteMs / 60_000} extra minute on your clock. Your opponent has the normal time.` },
  steadyHand: { id: 'steadyHand', numeral: 'II', name: 'Steady Hand', glyph: 'feather', rarity: 'common', starting: true, short: `+${secs(B.steadyHandIncMs)} per move`, text: `You gain ${secs(B.steadyHandIncMs)} with every move you make. Only you.` },
  openingPrep: { id: 'openingPrep', numeral: 'III', name: 'Opening Prep', glyph: 'book', rarity: 'common', starting: true, short: `First ${B.openingPrepMoves} moves free`, text: `Your first ${B.openingPrepMoves} moves of each game cost no clock time.` },
  secondWind: { id: 'secondWind', numeral: 'IV', name: 'Second Wind', glyph: 'bolt', rarity: 'uncommon', starting: true, short: `+${secs(B.secondWindAddMs)} below ${secs(B.secondWindBelowMs)}`, text: `Once per game, when your clock drops below ${secs(B.secondWindBelowMs)}, you get ${secs(B.secondWindAddMs)} more.` },
  scoutReport: { id: 'scoutReport', numeral: 'V', name: 'Scout Report', glyph: 'eye', rarity: 'common', starting: true, short: 'See openings and quirks', text: 'Before each game you see your opponent’s favourite openings and all of their quirks, hidden ones included.' },
  rattled: { id: 'rattled', numeral: 'VI', name: 'Rattled', glyph: 'skull', rarity: 'uncommon', starting: true, short: 'Win material, they wobble', text: `After you win material, your opponent plays looser for their next ${B.rattledMoves} moves.` },
  drawOdds: { id: 'drawOdds', numeral: 'VII', name: 'Draw Odds', glyph: 'scale', rarity: 'uncommon', starting: false, short: 'A draw counts as a win', text: 'A draw sends you through, even with White.' },
  secondChance: { id: 'secondChance', numeral: 'VIII', name: 'Second Chance', glyph: 'clover', rarity: 'rare', starting: false, short: 'Survive one knockout', text: 'Once per cup, a loss that would knock you out is replayed instead: same opponent, colours swapped.' },
  homePrep: { id: 'homePrep', numeral: 'IX', name: 'Home Prep', glyph: 'scroll', rarity: 'uncommon', starting: false, short: 'Start from your repertoire', text: 'Games start at the end of one of your own repertoire lines for your colour (Learn → My repertoire). With no line for that colour it does nothing.' },
  longNight: { id: 'longNight', numeral: 'X', name: 'Long Night', glyph: 'moon', rarity: 'uncommon', starting: false, short: `Finalist −${B.longNightElo} rating`, text: `Your opponent in the final plays ${B.longNightElo} rating points weaker.` },
};

export const CHARMS: Record<CharmId, CharmInfo> = {
  rewind: { id: 'rewind', numeral: 'XI', name: 'Rewind', glyph: 'rewind', starting: true, short: 'Take back a move', text: 'Take back your last move (and your opponent’s reply).' },
  threatBell: { id: 'threatBell', numeral: 'XII', name: 'Threat Bell', glyph: 'bell', starting: true, short: 'Warns before a blunder', text: 'For your next move only: if it would hang a piece or allow mate, the bell rings and you choose again.' },
  candidates: { id: 'candidates', numeral: 'XIII', name: 'Candidate Cards', glyph: 'cards', starting: true, short: 'Three moves, one best', text: 'Three moves to choose from: one is the engine’s best, the other two are moves a player at your level would likely play.' },
  colour: { id: 'colour', numeral: 'XIV', name: 'Choose Your Colour', glyph: 'dice', starting: true, pregame: true, short: 'Pick White or Black', text: 'Choose your colour for the next game. (With Black, a draw sends you through.)' },
  battlefield: { id: 'battlefield', numeral: 'XV', name: 'Battlefield', glyph: 'compass', starting: false, pregame: true, short: 'Pick the opening position', text: `Start the next game from one of three opening positions, ${C.battlefieldPlies[0]}–${C.battlefieldPlies[1]} half-moves in.` },
};

export const ALL_BOONS = Object.keys(BOONS) as BoonId[];
export const ALL_CHARMS = Object.keys(CHARMS) as CharmId[];
export const charmPrice = (id: CharmId) => C.prices[id] ?? 5;
/** Some charms may only be held once at a time (Rewind). */
export const canHoldCharm = (held: CharmId[], id: CharmId) => held.filter((h) => h === id).length < (C.maxHeld[id] ?? Infinity);

/** Boons and charms you can be offered: the starting ones plus what you unlocked with Laurels. */
export const boonPool = (unlocked: string[]) => ALL_BOONS.filter((b) => BOONS[b].starting || unlocked.includes(b));
export const charmPool = (unlocked: string[]) => ALL_CHARMS.filter((c) => CHARMS[c].starting || unlocked.includes(c));

/** Pick `n` boons you don't have yet; a rare one only now and then. */
export function boonOffer(owned: BoonId[], unlocked: string[], rand: () => number, n = B.offer): BoonId[] {
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

/** What your boons change at the start of a game. */
export function gameStartMods(boons: BoonId[], color: 'w' | 'b'): { extraMs: { w?: number; b?: number }; extraInc: { w?: number; b?: number }; freeMoves: number } {
  return {
    extraMs: boons.includes('extraMinute') ? { [color]: B.extraMinuteMs } : {},
    extraInc: boons.includes('steadyHand') ? { [color]: B.steadyHandIncMs } : {},
    freeMoves: boons.includes('openingPrep') ? B.openingPrepMoves : 0,
  };
}
