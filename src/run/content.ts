// Names, texts and glyphs for relics, consumables, rooms, events and modifiers.
import { TUNING as T, type BossMod, type DiffId } from './tuning';
import type { ConsumableId, EventKind, MapNode, ModifierId, Rarity, RelicId, RoomKind } from './types';

export interface CardInfo {
  name: string;
  text: string;
  /** Roman numeral shown on the tarot card. */
  numeral: string;
  /** Sprite key (see screens/sprites). */
  glyph: string;
  rarity?: Rarity;
}

const R = T.relics;
export const RELICS: Record<RelicId, CardInfo> = {
  calm: { name: 'Calm Mind', numeral: 'I', glyph: 'moon', rarity: 'common', text: `Finish a room with no inaccuracy or worse: +${R.calmComposure} Composure.` },
  clean: { name: 'Clean Hands', numeral: 'VI', glyph: 'star', rarity: 'common', text: `+${R.cleanHandsMult} mult for every best move.` },
  scholar: { name: 'Scholar', numeral: 'IX', glyph: 'book', rarity: 'common', text: `+${R.scholarGold} gold for every puzzle you solve.` },
  patience: { name: 'Patience', numeral: 'XIV', glyph: 'hourglass', rarity: 'common', text: `+${R.patienceMult} mult for every quiet good move (no capture, no check).` },
  lucky: { name: 'Lucky Coin', numeral: 'X', glyph: 'clover', rarity: 'common', text: `The campfire shows ${R.luckyExtraOffer} more card; resting costs ${R.luckyRestDiscount} less.` },
  bloomer: { name: 'Late Bloomer', numeral: 'VIII', glyph: 'sprout', rarity: 'common', text: `+${R.lateBloomerPerRoom} mult per room already cleared.` },
  bloodhound: { name: 'Bloodhound', numeral: 'II', glyph: 'fang', rarity: 'uncommon', text: `+${R.bloodhoundGold} gold whenever you win an undefended piece.` },
  forkmaster: { name: 'Forkmaster', numeral: 'III', glyph: 'fork', rarity: 'uncommon', text: `+${R.forkMult} mult for every fork you play.` },
  pins: { name: 'Pin Collector', numeral: 'V', glyph: 'pin', rarity: 'uncommon', text: `+${R.pinMult} mult for every pin you play.` },
  ironwall: { name: 'Iron Wall', numeral: 'IV', glyph: 'tower', rarity: 'uncommon', text: `Siege rooms: +${R.ironWallMult} mult for every good move.` },
  hunter: { name: 'Hunter', numeral: 'XI', glyph: 'bow', rarity: 'uncommon', text: `+${R.hunterMult} mult for every good capture.` },
  spendthrift: { name: 'Spendthrift', numeral: 'VII', glyph: 'coin', rarity: 'uncommon', text: `Shop prices halved, but you carry ${R.spendthriftCarryPenalty} fewer card.` },
  executioner: { name: 'Executioner', numeral: 'XIII', glyph: 'axe', rarity: 'rare', text: `+${R.executionerMult} mult when you finish a room with checkmate.` },
  secondwind: { name: 'Second Wind', numeral: 'XX', glyph: 'feather', rarity: 'rare', text: 'Once per run, when your Composure would break, keep 1.' },
  castle: { name: 'Castle Keep', numeral: 'XXI', glyph: 'tower', rarity: 'common', text: `Castling: +${R.castleMult} mult and +${R.castleGold} gold.` },
  rite: { name: 'Promotion Rite', numeral: 'XIX', glyph: 'crown', rarity: 'uncommon', text: `+${R.riteMult} mult every time you promote a pawn.` },
  tempo: { name: 'Tempo', numeral: 'XVIII', glyph: 'bolt', rarity: 'uncommon', text: `+${R.tempoMult} mult for every good move that gives check.` },
  glass: { name: 'Glass Cannon', numeral: 'XVI', glyph: 'crystal', rarity: 'rare', text: `+${R.glassMult} mult in every room. Costs ${R.glassComposure} Composure when taken.` },
};

export const CONSUMABLES: Record<ConsumableId, CardInfo> = {
  eye: { name: "Engine's Eye", numeral: 'XVII', glyph: 'eye', text: "Shows Stockfish's best move. (Marked in your debrief.)" },
  rewind: { name: 'Rewind', numeral: 'X', glyph: 'rewind', text: 'Take back your last move. Its Composure is restored.' },
  cards: { name: 'Candidate Cards', numeral: 'III', glyph: 'cards', text: 'Shows three moves. One of them is the best.' },
  lens: { name: 'Threat Lens', numeral: 'IX', glyph: 'lens', text: 'Lights up every hanging or attacked piece, both sides.' },
  opinion: { name: 'Second Opinion', numeral: 'II', glyph: 'scale', text: 'Your next move is judged before it counts: safe, risky or blunder.' },
  check: { name: 'Blunder Check', numeral: 'I', glyph: 'bell', text: 'Your next move is checked: only a blunder is stopped (you may choose again).' },
  insurance: { name: 'Insurance', numeral: 'IV', glyph: 'shield', text: 'Your next blunder costs no Composure. Works by itself.' },
};

export const ROOM_NAME: Record<RoomKind, string> = {
  puzzle: 'The Riddle',
  convert: 'The Harvest',
  hold: 'The Siege',
  ward: 'The Ward',
  vault: 'The Vault',
  duel: 'The Duel',
  boss: 'The Rival',
};

export const ROOM_SPRITE: Record<RoomKind | 'event', string> = {
  puzzle: 'cards',
  convert: 'scythe',
  hold: 'tower',
  ward: 'shield',
  vault: 'chest',
  duel: 'swords',
  boss: 'skull',
  event: 'question',
};

export const EVENTS: Record<EventKind, { name: string; sprite: string; blurb: string }> = {
  shrine: { name: "Sam's Shrine", sprite: 'candle', blurb: 'Answer the coach. Earn a relic.' },
  gambler: { name: 'The Gambler', sprite: 'dice', blurb: 'Stake Composure on one puzzle.' },
  merchant: { name: 'The Merchant', sprite: 'bag', blurb: 'Relics for sale.' },
  altar: { name: 'The Cursed Altar', sprite: 'altar', blurb: 'Power, at a price.' },
  library: { name: 'The Library', sprite: 'book', blurb: 'Find the tactic. Earn a card.' },
  spring: { name: 'The Healing Spring', sprite: 'fountain', blurb: 'Gold for a candle.' },
};

export const RARITY_COLOR: Record<Rarity, string> = { common: '#cdbf9f', uncommon: '#6fd3ff', rare: '#ff6bd5' };

export const bossMod = (id: string): BossMod => T.bossMods[id] ?? T.bossMods.default;

/** Plain-language rule text for a rival. */
export function bossModText(m: BossMod): string {
  const parts: string[] = [];
  if (m.inaccuracyCost) parts.push(`inaccuracies cost ${m.inaccuracyCost} Composure`);
  if (m.mistakeExtra) parts.push(`mistakes cost ${m.mistakeExtra} more`);
  if (m.blunderFactor) parts.push(`blunders cost ×${m.blunderFactor}`);
  if (m.blunderEnds) parts.push('one blunder ends the fight');
  if (m.sealed?.length) parts.push(`${m.sealed.map((c) => CONSUMABLES[c].name).join(', ')} sealed`);
  if (m.noEarlyWin) parts.push('only the final position counts');
  if (m.captureMult) parts.push(`+${m.captureMult} mult per good capture`);
  if (m.multBonus) parts.push(`+${m.multBonus} mult`);
  const s = parts.join('; ');
  return s ? s[0].toUpperCase() + s.slice(1) + '.' : 'No special rule.';
}

/** The boss's goal numbers after its rule. */
export function bossGoal(m: BossMod) {
  const b = T.rooms.boss;
  return { winCp: m.winCp ?? b.winCp, endCp: m.endCp ?? b.endCp, moves: m.moves ?? b.moves, noEarlyWin: !!m.noEarlyWin };
}

export function objective(node: MapNode, boss?: BossMod, diff?: DiffId): string {
  const r = T.rooms;
  const e = node.elite;
  const d = T.difficulty[diff ?? 'adept'];
  const g = bossGoal(boss ?? T.bossMods.default);
  const pawns = (cp: number) => `${Math.round(cp) / 100}`;
  const grace = `Slip below the line and you get ${d.grace} move${d.grace === 1 ? '' : 's'} to recover.`;
  switch (node.kind) {
    case 'puzzle':
      return `Solve ${e ? T.elite.puzzleNeed : r.puzzle.needSolved} of ${r.puzzle.count} puzzles${e ? ' (harder)' : ''}.`;
    case 'ward':
      return `Your opponent threatens something. Find the one move that holds — ${e ? T.elite.wardNeed : r.ward.needSolved} of ${r.ward.count}.`;
    case 'convert':
      return node.goal === 'keep'
        ? `You're winning. Stay at least +${pawns((e ? T.elite.keepCp : r.convert.keepCp) - d.margin)} for ${r.convert.keepMoves} moves. ${grace}`
        : `You're winning. Win ${r.convert.gainMaterial}+ more material or mate within ${e ? T.elite.gainMoves : r.convert.gainMoves} moves.`;
    case 'hold':
      return `You're a little worse. Survive ${r.hold.moves} moves without the eval dropping more than ${pawns((e ? T.elite.holdMaxDropCp : r.hold.maxDropCp) + d.margin)}. ${grace}`;
    case 'vault':
      return 'A won endgame against perfect defence. Finish the job in time.';
    case 'duel':
      return `An opening, fresh from the book. After ${r.duel.moves} moves, don't be more than ${pawns((e ? T.elite.duelMaxDropCp : r.duel.maxDropCp) + d.margin)} worse than at the start (${d.grace} extra move${d.grace === 1 ? '' : 's'} to fix it). The book move is shown for your first ${r.duel.hintMoves}.`;
    case 'boss': {
      const end = g.endCp - d.margin;
      const endTxt = end > 0 ? `+${pawns(end)} or better` : end === 0 ? 'at least equal' : `no worse than ${pawns(end)}`;
      return g.noEarlyWin
        ? `Be ${endTxt} after ${g.moves} moves.`
        : `Reach +${g.winCp / 100} (or mate) within ${g.moves} moves, or be ${endTxt} at the end.`;
    }
    case 'event':
      return node.event ? EVENTS[node.event].blurb : '';
  }
}

export const MODIFIERS: Record<ModifierId, { name: string; text: string }> = {
  steady: { name: 'Still Air', text: 'No modifier.' },
  gilded: { name: 'Gilded', text: `Gold from this room ×${T.modifiers.gilded.goldMult}.` },
  focused: { name: 'Razor Focus', text: `+${T.modifiers.focused.mult} mult, but blunders cost ${T.modifiers.focused.extraBlunderCost} more Composure.` },
  rival: { name: "The Rival's Rule", text: '' },
};
