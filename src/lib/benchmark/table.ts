// The bot-vs-human table: each chess.com band next to the bot it should match (pure).
import { BANDS } from './bands';
import type { ProfileSummary } from './profile';

export interface BotRow extends ProfileSummary {
  label: number;
}
export interface HumanRow extends ProfileSummary {
  band: string;
}
export interface TableRow {
  band: string;
  /** The bot label in the middle of the band (bot ratings are chess.com ratings). */
  label: number;
  human?: HumanRow;
  bot?: BotRow;
}

/** The bot label for the middle of a band. */
export const labelForBand = (min: number, max: number) => Math.round((min + max) / 2);

/** Rows per band: humans (yours where measured, else the public sample) and the nearest profiled bot. */
export function benchTable(humans: HumanRow[], bots: BotRow[], mine: HumanRow[] = [], minMoves = 150): TableRow[] {
  return BANDS.map((b) => {
    const label = labelForBand(b.min, b.max);
    const own = mine.find((h) => h.band === b.label && h.moves >= minMoves);
    const human = own ?? humans.find((h) => h.band === b.label);
    const bot = [...bots].sort((x, y) => Math.abs(x.label - label) - Math.abs(y.label - label))[0];
    return { band: b.label, label, human, bot: bot && Math.abs(bot.label - label) <= 100 ? bot : undefined };
  }).filter((r) => r.human || r.bot);
}
