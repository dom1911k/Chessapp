// Names, texts and glyphs for relics, consumables, rooms and modifiers.
import { TUNING as T } from './tuning';
import type { ConsumableId, ConvertGoal, ModifierId, RelicId, RoomKind } from './types';

export interface CardInfo {
  name: string;
  text: string;
  /** Roman numeral shown on the tarot card. */
  numeral: string;
  /** Glyph key (see screens/Glyphs). */
  glyph: string;
}

const R = T.relics;
export const RELICS: Record<RelicId, CardInfo> = {
  calm: { name: 'Calm Mind', numeral: 'I', glyph: 'moon', text: `Finish a room with no inaccuracy or worse: +${T.relics.calmComposure} Composure.` },
  bloodhound: { name: 'Bloodhound', numeral: 'II', glyph: 'fang', text: `+${R.bloodhoundGold} gold whenever you win an undefended piece.` },
  forkmaster: { name: 'Forkmaster', numeral: 'III', glyph: 'fork', text: `+${R.forkMult} mult for every fork you play.` },
  ironwall: { name: 'Iron Wall', numeral: 'IV', glyph: 'tower', text: `Hold rooms: +${R.ironWallMult} mult for every good move.` },
  pins: { name: 'Pin Collector', numeral: 'V', glyph: 'pin', text: `+${R.pinMult} mult for every pin you play.` },
  clean: { name: 'Clean Hands', numeral: 'VI', glyph: 'star', text: `+${R.cleanHandsMult} mult for every best move.` },
  spendthrift: { name: 'Spendthrift', numeral: 'VII', glyph: 'coin', text: `Shop prices halved, but you carry ${R.spendthriftCarryPenalty} fewer consumable.` },
  bloomer: { name: 'Late Bloomer', numeral: 'VIII', glyph: 'sprout', text: `+${R.lateBloomerPerRoom} mult per room already cleared.` },
};

export const CONSUMABLES: Record<ConsumableId, CardInfo> = {
  eye: { name: "Engine's Eye", numeral: 'XVII', glyph: 'eye', text: "Shows Stockfish's best move. (Marked in your debrief.)" },
  rewind: { name: 'Rewind', numeral: 'X', glyph: 'rewind', text: 'Take back your last move. Its Composure is restored.' },
  cards: { name: 'Candidate Cards', numeral: 'III', glyph: 'cards', text: 'Shows three moves. One of them is the best.' },
  lens: { name: 'Threat Lens', numeral: 'IX', glyph: 'lens', text: 'Lights up every hanging or attacked piece, both sides.' },
  opinion: { name: 'Second Opinion', numeral: 'II', glyph: 'scale', text: 'Your next move is judged before it counts: safe, risky or blunder.' },
  insurance: { name: 'Insurance', numeral: 'IV', glyph: 'shield', text: 'Your next blunder costs no Composure. Works by itself.' },
};

export const ROOM_NAME: Record<RoomKind, string> = {
  puzzle: 'The Riddle',
  convert: 'The Harvest',
  hold: 'The Siege',
  boss: 'The Rival',
};

export function objective(kind: RoomKind, goal?: ConvertGoal): string {
  const r = T.rooms;
  switch (kind) {
    case 'puzzle':
      return `Solve ${r.puzzle.needSolved} of ${r.puzzle.count} puzzles.`;
    case 'convert':
      return goal === 'keep'
        ? `You're winning. Stay at least +${r.convert.keepCp / 100} for ${r.convert.keepMoves} moves.`
        : `You're winning. Win ${r.convert.gainMaterial}+ more material or mate within ${r.convert.gainMoves} moves.`;
    case 'hold':
      return `You're a little worse. Survive ${r.hold.moves} moves without the eval dropping more than ${r.hold.maxDropCp / 100}.`;
    case 'boss':
      return `Reach +${r.boss.winCp / 100} (or mate) within ${r.boss.moves} moves, or be +${r.boss.endCp / 100} at the end.`;
  }
}

export const MODIFIERS: Record<ModifierId, { name: string; text: string }> = {
  steady: { name: 'Still Air', text: 'No modifier.' },
  gilded: { name: 'Gilded', text: `Gold from this room ×${T.modifiers.gilded.goldMult}.` },
  focused: { name: 'Razor Focus', text: `+${T.modifiers.focused.mult} mult, but blunders cost ${T.modifiers.focused.extraBlunderCost} more Composure.` },
  pickpocket: { name: 'The Pickpocket', text: `Blunders cost ×${T.boss.pickpocketBlunderFactor} Composure.` },
};
