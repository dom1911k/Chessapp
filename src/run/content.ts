// Names, texts and glyphs for relics, consumables, rooms, events and modifiers.
import { TUNING as T, type BossMod, type DiffId } from './tuning';
import type { Archetype, ConsumableId, EventKind, MapNode, ModifierId, Rarity, RelicId, RoomKind } from './types';

export interface CardInfo {
  name: string;
  /** Full description (info sheets, selection). */
  text: string;
  /** A few words for the card face. */
  short?: string;
  /** Roman numeral shown on the tarot card. */
  numeral: string;
  /** Sprite key (see screens/sprites). */
  glyph: string;
  rarity?: Rarity;
  /** Relics: the build direction it belongs to. */
  archetype?: Archetype;
}

const R = T.relics;
export const RELICS: Record<RelicId, CardInfo> = {
  calm: { short: `Clean room: +${R.calmComposure} candle`, name: 'Calm Mind', numeral: 'I', glyph: 'moon', rarity: 'common', text: `Finish a room with no inaccuracy or worse: +${R.calmComposure} Composure.` },
  clean: { short: `+${R.cleanHandsMult} mult per best move`, name: 'Clean Hands', numeral: 'VI', glyph: 'star', rarity: 'common', text: `+${R.cleanHandsMult} mult for every best move.` },
  scholar: { short: `+${R.scholarGold} gold per puzzle solved`, name: 'Scholar', numeral: 'IX', glyph: 'book', rarity: 'common', text: `+${R.scholarGold} gold for every puzzle you solve.` },
  patience: { short: `+${R.patienceMult} mult per quiet good move`, name: 'Patience', numeral: 'XIV', glyph: 'hourglass', rarity: 'common', text: `+${R.patienceMult} mult for every quiet good move (no capture, no check).` },
  lucky: { short: '+1 card at camp, cheaper rest', name: 'Lucky Coin', numeral: 'X', glyph: 'clover', rarity: 'common', text: `The campfire shows ${R.luckyExtraOffer} more card; resting costs ${R.luckyRestDiscount} less.` },
  bloomer: { short: `+${R.lateBloomerPerRoom} mult per room cleared`, name: 'Late Bloomer', numeral: 'VIII', glyph: 'sprout', rarity: 'common', text: `+${R.lateBloomerPerRoom} mult per room already cleared.` },
  bloodhound: { short: `+${R.bloodhoundGold} gold for a free piece`, name: 'Bloodhound', numeral: 'II', glyph: 'fang', rarity: 'uncommon', text: `+${R.bloodhoundGold} gold whenever you win an undefended piece.` },
  forkmaster: { short: `+${R.forkMult} mult per fork`, name: 'Forkmaster', numeral: 'III', glyph: 'fork', rarity: 'uncommon', text: `+${R.forkMult} mult for every fork you play.` },
  pins: { short: `+${R.pinMult} mult per pin`, name: 'Pin Collector', numeral: 'V', glyph: 'pin', rarity: 'uncommon', text: `+${R.pinMult} mult for every pin you play.` },
  ironwall: { short: `Siege: +${R.ironWallMult} mult per good move`, name: 'Iron Wall', numeral: 'IV', glyph: 'tower', rarity: 'uncommon', text: `Siege rooms: +${R.ironWallMult} mult for every good move.` },
  hunter: { short: `+${R.hunterMult} mult per good capture`, name: 'Hunter', numeral: 'XI', glyph: 'bow', rarity: 'uncommon', text: `+${R.hunterMult} mult for every good capture.` },
  spendthrift: { short: 'Half prices, one card slot less', name: 'Spendthrift', numeral: 'VII', glyph: 'coin', rarity: 'uncommon', text: `Shop prices halved, but you carry ${R.spendthriftCarryPenalty} fewer card.` },
  executioner: { short: `×${R.executionerMult} mult if you finish with mate`, name: 'Executioner', numeral: 'XIII', glyph: 'axe', rarity: 'rare', text: `×${R.executionerMult} mult when you finish a room with checkmate.` },
  perfectionist: { short: `×${R.perfectionistX} mult if every move is good`, name: 'Perfectionist', numeral: 'XXII', glyph: 'star', rarity: 'rare', text: `×${R.perfectionistX} mult in a room where every move was good or best.` },
  coldread: { short: `×${R.coldReadX} mult if you use no card`, name: 'Cold Read', numeral: 'XXIII', glyph: 'eye', rarity: 'rare', text: `×${R.coldReadX} mult in a room where you used no card.` },
  watchman: { short: 'Threat Lens returns if it wins material', name: 'Watchman', numeral: 'XXIV', glyph: 'lens', rarity: 'uncommon', text: `Threat Lens comes back if you win material within ${R.watchmanMoves} moves of using it.` },
  bookbinder: { short: `Free Blunder Check every ${R.bookbinderEvery} clean puzzles`, name: 'Bookbinder', numeral: 'XXV', glyph: 'book', rarity: 'uncommon', text: `Every ${R.bookbinderEvery} puzzles solved without a card: a free Blunder Check (if you have room).` },
  siege: { short: `Siege: +${R.siegeChips} chips × moves held`, name: 'Siege Engine', numeral: 'XXVI', glyph: 'tower', rarity: 'common', text: `Siege rooms: +${R.siegeChips} chips × moves survived above the red line.` },
  secondwind: { short: 'Once: keep your last candle', name: 'Second Wind', numeral: 'XX', glyph: 'feather', rarity: 'rare', text: 'Once per run, when your Composure would break, keep 1.' },
  castle: { short: `+${R.castleMult} mult if your king stays untouched`, name: 'Castle Keep', numeral: 'XXI', glyph: 'tower', rarity: 'common', text: `+${R.castleMult} mult at the end of a room where your king was never in check and no enemy piece ever attacked the squares around it.` },
  rite: { short: `+${R.riteMult} mult per promotion`, name: 'Promotion Rite', numeral: 'XIX', glyph: 'crown', rarity: 'uncommon', text: `+${R.riteMult} mult when you promote; +${R.riteRankMult} when a passed pawn reaches your 6th rank.` },
  tempo: { short: `+${R.tempoMult} mult per good check`, name: 'Tempo', numeral: 'XVIII', glyph: 'bolt', rarity: 'uncommon', text: `+${R.tempoMult} mult for every good move that gives check.` },
  combination: { short: `×${R.combinationX} per tactic after the first`, name: 'Combination', numeral: 'XXVII', glyph: 'swords', rarity: 'rare', text: `Keystone (Tactician): ×${R.combinationX} mult for each tactic (fork, pin, skewer, discovered attack) after the first in a room.` },
  bulwark: { short: 'Siege & Ward: mistakes are free', name: 'Bulwark', numeral: 'XXVIII', glyph: 'shield', rarity: 'rare', text: 'Keystone (Fortress): mistakes in Siege and Ward rooms cost no candles. (Blunders still do.)' },
  endgamesense: { short: `Vault ×${R.endgameSenseX}; +1 Vault on the map`, name: 'Endgame Sense', numeral: 'XXIX', glyph: 'chest', rarity: 'rare', text: `Keystone (Technician): ×${R.endgameSenseX} mult in Vault rooms, and one more Vault appears ahead on the map.` },
  ascetic: { short: `No cards; +${R.asceticMult} mult every room`, name: 'Ascetic', numeral: 'XXX', glyph: 'candle', rarity: 'rare', text: `Keystone (Purist): you can't hold cards (yours are discarded), but every room gets +${R.asceticMult} mult.` },
  patron: { short: 'Camp stall: 2 relics, one half price', name: 'Patron', numeral: 'XXXI', glyph: 'bag', rarity: 'rare', text: `Keystone (Trader): every campfire stall shows a second relic at ${Math.round(R.patronDiscount * 100)}% of its price.` },
  glass: { short: `+${R.glassMult} mult every room; −${R.glassComposure} candles`, name: 'Glass Cannon', numeral: 'XVI', glyph: 'crystal', rarity: 'rare', text: `+${R.glassMult} mult in every room. Costs ${R.glassComposure} Composure when taken.` },
};

export const CONSUMABLES: Record<ConsumableId, CardInfo> = {
  eye: { short: 'Shows the best move', name: "Engine's Eye", numeral: 'XVII', glyph: 'eye', text: "Shows Stockfish's best move. (Marked in your debrief.)" },
  rewind: { short: 'Take back your last move', name: 'Rewind', numeral: 'X', glyph: 'rewind', text: 'Take back your last move. Its Composure is restored.' },
  cards: { short: 'Three moves; one is the best', name: 'Candidate Cards', numeral: 'III', glyph: 'cards', text: 'Shows three moves. One of them is the best.' },
  lens: { short: 'Lights up all hanging pieces', name: 'Threat Lens', numeral: 'IX', glyph: 'lens', text: 'Lights up every hanging or attacked piece, both sides.' },
  opinion: { short: 'Judges your next move first', name: 'Second Opinion', numeral: 'II', glyph: 'scale', text: 'Your next move is judged before it counts: safe, risky or blunder.' },
  check: { short: 'Stops your next move if it blunders', name: 'Blunder Check', numeral: 'I', glyph: 'bell', text: 'Your next move is checked: only a blunder is stopped (you may choose again).' },
  shadow: { short: 'Shows their likeliest reply first', name: 'Shadow', numeral: 'XII', glyph: 'moon', text: "After you pick your next move, see the opponent's most likely reply as an arrow before it counts. Play it or choose again." },
  insurance: { short: 'Next blunder costs no candle', name: 'Insurance', numeral: 'IV', glyph: 'shield', text: 'Your next blunder costs no Composure. Works by itself.' },
};

export const ROOM_NAME: Record<RoomKind, string> = {
  puzzle: 'The Riddle',
  convert: 'The Harvest',
  hold: 'The Siege',
  ward: 'The Ward',
  vault: 'The Vault',
  duel: 'The Duel',
  echo: 'The Echo',
  mirror: 'The Mirror',
  boss: 'The Rival',
};

/** Relic archetypes (build directions). */
export const ARCHETYPE: Record<RelicId, Archetype> = {
  forkmaster: 'tactician', pins: 'tactician', hunter: 'tactician', tempo: 'tactician', executioner: 'tactician', bookbinder: 'tactician', combination: 'tactician',
  ironwall: 'fortress', siege: 'fortress', castle: 'fortress', calm: 'fortress', secondwind: 'fortress', watchman: 'fortress', bulwark: 'fortress',
  rite: 'technician', patience: 'technician', bloomer: 'technician', endgamesense: 'technician',
  clean: 'purist', perfectionist: 'purist', coldread: 'purist', glass: 'purist', ascetic: 'purist',
  lucky: 'trader', spendthrift: 'trader', scholar: 'trader', bloodhound: 'trader', patron: 'trader',
};
export const ARCHETYPES: Record<Archetype, { name: string; sprite: string; color: string; suits: string }> = {
  tactician: { name: 'Tactician', sprite: 'swords', color: '#ff8c5a', suits: 'Riddles' },
  fortress: { name: 'Fortress', sprite: 'shield', color: '#6fd3ff', suits: 'Sieges and Wards' },
  technician: { name: 'Technician', sprite: 'chest', color: '#5ee59a', suits: 'Vaults and Harvest: Keep' },
  purist: { name: 'Purist', sprite: 'star', color: '#ffe7a3', suits: 'clean play anywhere' },
  trader: { name: 'Trader', sprite: 'coin', color: '#ffb454', suits: 'campfires and gold' },
};
for (const id of Object.keys(ARCHETYPE) as RelicId[]) RELICS[id].archetype = ARCHETYPE[id];

/** Archetypes a map node suits (shown as a small icon when you hold one of them). */
export function nodeArchetypes(n: Pick<MapNode, 'kind' | 'goal'>): Archetype[] {
  if (n.kind === 'puzzle') return ['tactician'];
  if (n.kind === 'hold' || n.kind === 'ward') return ['fortress'];
  if (n.kind === 'vault' || (n.kind === 'convert' && n.goal === 'keep')) return ['technician'];
  return [];
}

export const ROOM_SPRITE: Record<RoomKind | 'event' | 'camp', string> = {
  puzzle: 'cards',
  convert: 'scythe',
  hold: 'tower',
  ward: 'shield',
  vault: 'chest',
  duel: 'swords',
  echo: 'scroll',
  mirror: 'crystal',
  boss: 'skull',
  event: 'question',
  camp: 'flame',
};

export const EVENTS: Record<EventKind, { name: string; sprite: string; blurb: string }> = {
  shrine: { name: "Sam's Shrine", sprite: 'candle', blurb: 'Answer the coach. Earn a relic.' },
  gambler: { name: 'The Gambler', sprite: 'dice', blurb: 'Stake Composure on one puzzle.' },
  merchant: { name: 'The Merchant', sprite: 'bag', blurb: 'Relics for sale.' },
  altar: { name: 'The Cursed Altar', sprite: 'altar', blurb: 'Power, at a price.' },
  library: { name: 'The Library', sprite: 'book', blurb: 'Find the tactic. Earn a card.' },
  spring: { name: 'The Healing Spring', sprite: 'fountain', blurb: 'Gold for two candles — but the next room is under Razor Focus.' },
};

export const RARITY_COLOR: Record<Rarity, string> = { common: '#cdbf9f', uncommon: '#6fd3ff', rare: '#ff6bd5' };

export const bossMod = (id: string): BossMod => T.bossMods[id] ?? T.bossMods.default;
/** The rule in force for this run's rival: a nemesis rule (from your recurring mistakes) replaces its own. */
export const rivalRule = (r: { bossId: string; nemesis?: string }): BossMod & { nemesis?: boolean } => {
  const n = r.nemesis ? (T.nemesis.rules as Record<string, BossMod>)[r.nemesis] : undefined;
  return n ? { ...n, nemesis: true } : bossMod(r.bossId);
};
/** The six Heat constraints (cumulative), for the picker and the run. */
export const HEAT_TEXT = [
  `Rivals play ${T.heat.rivalElo} rating stronger.`,
  'Inaccuracies cost a candle in the rival fight.',
  'The eval bar shows words only during play (numbers in the tally).',
  "Engine's Eye is never offered.",
  'One move less to recover below a red line (minimum 1).',
  'The eval bar is hidden during play.',
];

/** What the nemesis rule answers (shown under its name). */
export const NEMESIS_WHY: Record<string, string> = {
  hangingPiece: 'You keep leaving pieces hanging in your games.',
  defense: 'You keep missing your opponent’s threats in your games.',
  fork: 'Forks keep catching you in your games.',
  kingSafety: 'Your king keeps getting caught in your games.',
};

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

export function objective(node: MapNode, boss?: BossMod, diff?: DiffId, heat = 0): string {
  const r = T.rooms;
  const e = node.elite;
  const d = T.difficulty[diff ?? 'adept'];
  const g = bossGoal(boss ?? T.bossMods.default);
  const pawns = (cp: number) => `${Math.round(cp) / 100}`;
  const gr = Math.max(1, d.grace - (heat >= 5 ? T.heat.graceLess : 0));
  const grace = `Slip below the line and you get ${gr} move${gr === 1 ? '' : 's'} to recover.`;
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
      return 'An endgame against perfect play: finish the job in time — or, in a defence drill, hold the draw.';
    case 'duel':
      return `An opening, fresh from the book. After ${r.duel.moves} moves, don't be more than ${pawns((e ? T.elite.duelMaxDropCp : r.duel.maxDropCp) + d.margin)} worse than at the start (${d.grace} extra move${d.grace === 1 ? '' : 's'} to fix it). The book move is shown for your first ${r.duel.hintMoves}.`;
    case 'echo':
      return `A position from your own games where you slipped. Don't repeat it: ${r.echo.moves} moves, none of them more than ${pawns(r.echo.echoMaxDropCp + d.margin)} worse than the best.`;
    case 'mirror':
      return `Before each move, name your opponent's most dangerous idea (3 choices). Then hold the line for ${r.mirror.moves} moves. A wrong read halves that move's chips.`;
    case 'boss': {
      const end = g.endCp - d.margin;
      const endTxt = end > 0 ? `+${pawns(end)} or better` : end === 0 ? 'at least equal' : `no worse than ${pawns(end)}`;
      return g.noEarlyWin
        ? `Be ${endTxt} after ${g.moves} moves.`
        : `Reach +${g.winCp / 100} (or mate) within ${g.moves} moves, or be ${endTxt} at the end.`;
    }
    case 'event':
      return node.event ? EVENTS[node.event].blurb : '';
    case 'camp':
      return 'A campfire: buy cards and relics, rest, or make the pouch bigger. No fight.';
  }
}

export const MODIFIERS: Record<ModifierId, { name: string; text: string }> = {
  steady: { name: 'Still Air', text: 'No modifier.' },
  gilded: { name: 'Gilded', text: `Gold from this room ×${T.modifiers.gilded.goldMult}.` },
  focused: { name: 'Razor Focus', text: `+${T.modifiers.focused.mult} mult, but blunders cost ${T.modifiers.focused.extraBlunderCost} more Composure.` },
  rival: { name: "The Rival's Rule", text: '' },
};
