// The bot-vs-human table: each chess.com band next to the bot it should match (pure).
import { BANDS } from './bands';
import type { ProfileSummary } from './profile';
import { toChessCom } from '../games/ccmap';

export interface BotRow extends ProfileSummary {
  label: number;
}
export interface HumanRow extends ProfileSummary {
  band: string;
}
export interface TableRow {
  band: string;
  /** The bot label whose chess.com estimate falls in the middle of the band. */
  label: number;
  human?: HumanRow;
  bot?: BotRow;
}

/** The bot label that claims to play like the middle of `band` (chess.com = label + offset). */
export function labelForBand(min: number, max: number, offset: number): number {
  return Math.max(400, Math.min(2000, Math.round(((min + max) / 2 - offset) / 50) * 50));
}

/** Rows per band: humans (yours where measured, else the public sample) and the nearest profiled bot. */
export function benchTable(humans: HumanRow[], bots: BotRow[], offset: number, mine: HumanRow[] = [], minMoves = 150): TableRow[] {
  return BANDS.map((b) => {
    const label = labelForBand(b.min, b.max, offset);
    const own = mine.find((h) => h.band === b.label && h.moves >= minMoves);
    const human = own ?? humans.find((h) => h.band === b.label);
    const bot = [...bots].sort((x, y) => Math.abs(x.label - label) - Math.abs(y.label - label))[0];
    return { band: b.label, label, human, bot: bot && Math.abs(bot.label - label) <= 100 ? bot : undefined };
  }).filter((r) => r.human || r.bot);
}

/** Does the bot's chess.com estimate land in the band? (sanity check for the label) */
export const inBand = (label: number, offset: number, min: number, max: number) => {
  const cc = toChessCom(label, { offset });
  return cc >= min && cc < max;
};
