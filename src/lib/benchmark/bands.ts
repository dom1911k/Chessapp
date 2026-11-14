// chess.com rating bands for the bot-vs-human benchmark.
export interface Band {
  label: string;
  min: number;
  max: number;
}
export const BANDS: Band[] = [100, 300, 500, 700, 900, 1100, 1300, 1500, 1700].map((min) => ({ label: `${min}–${min + 200}`, min, max: min + 200 }));
export const bandOf = (rating: number): Band | null => BANDS.find((b) => rating >= b.min && rating < b.max) ?? null;
