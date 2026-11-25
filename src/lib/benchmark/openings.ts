// How people (and bots) play the opening, plies 1–12, measured the same way for both (round 7):
//   early queen   share of players who move their queen in their first 6 moves
//   castled       share of players who castle in their first 10 moves
//   theory        share of plies (1–12) still in known opening theory
//   leave         the first ply that leaves theory (13 if it never does by ply 12)
// "Theory" is the app's opening list (src/lib/openings/eco.ts): a short list, so these are a
// comparison between bots and people rather than absolute numbers.
import { ECO } from '../openings/eco';

let prefixes: Set<string> | null = null;
/** The moves so far are a known opening line (or the start of one). */
export function inTheory(sans: string[]): boolean {
  prefixes ??= new Set(
    ECO.flatMap((e) => {
      const m = e.moves.split(' ');
      return m.map((_, i) => m.slice(0, i + 1).join(' '));
    }),
  );
  return prefixes.has(sans.join(' '));
}

export interface OpeningSummary {
  games: number;
  earlyQueen: number;
  castled: number;
  theory: number;
  leave: number;
}

const pct = (x: number, of: number) => Math.round((x / Math.max(1, of)) * 1000) / 10;

export class OpeningProfile {
  private games = 0;
  private sides = 0;
  private queen = 0;
  private castled = 0;
  private theoryPlies = 0;
  private plies = 0;
  private leaveSum = 0;

  /** One game's SAN moves (at least the first 12 plies when the game lasted that long). */
  add(sans: string[]): void {
    this.games++;
    for (const side of [0, 1]) {
      const mine = sans.filter((_, i) => i % 2 === side);
      this.sides++;
      if (mine.slice(0, 6).some((m) => m.startsWith('Q'))) this.queen++;
      if (mine.slice(0, 10).some((m) => m.startsWith('O-O'))) this.castled++;
    }
    const n = Math.min(12, sans.length);
    let leave = 13;
    for (let i = 0; i < n; i++) {
      this.plies++;
      if (leave === 13 && inTheory(sans.slice(0, i + 1))) this.theoryPlies++;
      else if (leave === 13) leave = i + 1;
    }
    this.leaveSum += leave;
  }

  summary(): OpeningSummary {
    return { games: this.games, earlyQueen: pct(this.queen, this.sides), castled: pct(this.castled, this.sides), theory: pct(this.theoryPlies, this.plies), leave: Math.round((this.leaveSum / Math.max(1, this.games)) * 10) / 10 };
  }
}
