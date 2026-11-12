// Battlefield (charm): three opening positions from the opening book to start the next game from.
import { ECO } from '../lib/openings';
import { linePlies } from '../lib/repertoire';
import { TUNING } from './tuning';

export interface StartPos {
  fen: string;
  sans: string[];
  name: string;
}

/** All book lines of the right length, as positions. */
export function battlefieldPool(): StartPos[] {
  const [lo, hi] = TUNING.charms.battlefieldPlies;
  const out: StartPos[] = [];
  for (const e of ECO) {
    const sans = e.moves.split(' ');
    if (sans.length < lo || sans.length > hi) continue;
    try {
      const plies = linePlies(e.moves);
      out.push({ fen: plies[plies.length - 1].fenAfter, sans, name: e.name });
    } catch {
      /* skip a bad line */
    }
  }
  return out;
}

/** Three different positions to choose from. */
export function battlefieldOptions(rand: () => number, n = 3): StartPos[] {
  const left = battlefieldPool();
  const out: StartPos[] = [];
  while (out.length < n && left.length) out.push(left.splice(Math.floor(rand() * left.length), 1)[0]);
  return out;
}
