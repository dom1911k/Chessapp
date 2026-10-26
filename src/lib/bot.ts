// Bot strength model. Stockfish's own UCI_Elo floor (~1320) is too strong for a
// beginner, so we search with MultiPV and pick among the candidate moves with
// Elo-dependent randomness. Weaker opponents also make *human* mistakes: they
// sometimes play the move that merely looks good (grab material, give check,
// attack something) without checking whether it is safe.
import { Chess, type Move } from 'chess.js';
import { applyUci, attacksFrom, hangingPieces, parseFen, sqIndex, VALUE } from './chess/pos';
import { povScore, scoreToCp } from './chess/evaluation';
import type { AnalysisResult } from './engine/types';
import type { PlayStyle } from './people';

export const MIN_ELO = 400;
export const MAX_ELO = 2000;
export const DEFAULT_ELO = 600;

interface Params {
  depth: number;
  multipv: number;
  temperature: number; // cp — higher = more random
  /** Chance of a "looks good" move picked without a safety check. */
  humanMoveChance: number;
  /** Chance that a human move is at least checked for hanging the moved piece. */
  carefulness: number;
}

function lerp(points: [number, number][], x: number): number {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x0, y0] = points[i - 1];
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return points[points.length - 1][1];
}

export function botParams(elo: number): Params {
  return {
    depth: Math.round(lerp([[400, 5], [800, 7], [1200, 9], [1600, 11], [2000, 14]], elo)),
    multipv: elo < 1500 ? 6 : 4,
    temperature: lerp([[400, 260], [800, 150], [1200, 70], [1600, 30], [2000, 8]], elo),
    humanMoveChance: lerp([[400, 0.45], [700, 0.3], [1000, 0.16], [1300, 0.06], [1500, 0]], elo),
    carefulness: lerp([[400, 0], [700, 0.35], [1000, 0.65], [1300, 0.9]], elo),
  };
}

/** Rough description for the strength slider. */
export function eloLabel(elo: number): string {
  if (elo < 600) return 'Just learning';
  if (elo < 900) return 'Beginner';
  if (elo < 1200) return 'Casual player';
  if (elo < 1500) return 'Club player';
  if (elo < 1800) return 'Strong club player';
  return 'Expert';
}

/** How a play style nudges the choice between candidate moves (in centipawns). */
function styleBonus(style: PlayStyle, san: string): number {
  const forcing = san.includes('x') || san.includes('+');
  if (style === 'aggressive') return forcing ? 45 : 0;
  if (style === 'solid') return forcing ? -15 : san.startsWith('O-O') ? 30 : 0;
  return 0;
}

export function chooseBotMove(
  fen: string,
  analysis: AnalysisResult,
  elo: number,
  rand: () => number = Math.random,
  style: PlayStyle = 'balanced',
): string | null {
  const p = botParams(elo);
  const chess = new Chess(fen);
  const legal = chess.moves({ verbose: true });
  if (!legal.length) return null;
  const turn = chess.turn();
  const lines = analysis.lines.filter((l) => l.pv.length);
  if (!lines.length) return analysis.bestMove ?? legal[0].lan;

  // Always take a forced mate-in-1 above beginner level.
  const best = lines[0];
  const bestPov = povScore(best.score, turn);
  if (bestPov.type === 'mate' && bestPov.value === 1 && elo >= 900) return best.pv[0];

  // "Wild" players (Lily) play on instinct more often.
  const humanChance = style === 'wild' ? Math.min(0.6, p.humanMoveChance * 1.3) : p.humanMoveChance;
  if (rand() < humanChance) {
    const m = humanMove(fen, legal, style, rand() < p.carefulness, rand);
    if (m) return m;
  }

  const cps = lines.map((l) => {
    const san = legal.find((m) => m.lan === l.pv[0])?.san ?? '';
    return scoreToCp(povScore(l.score, turn)) + styleBonus(style, san);
  });
  const top = Math.max(...cps);
  const weights = cps.map((cp) => Math.exp(-Math.min(3000, top - cp) / p.temperature));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < lines.length; i++) {
    r -= weights[i];
    if (r <= 0) return lines[i].pv[0];
  }
  return lines[0].pv[0];
}

/**
 * What a beginner might play: the move that *looks* best at a glance. Captures
 * are valued by what they grab (recaptures are ignored), checks and attacks on
 * pieces look exciting, and pieces come out toward the middle. A careful
 * player at least avoids leaving something hanging.
 */
export function humanMove(fen: string, legal: Move[], style: PlayStyle, careful: boolean, rand: () => number = Math.random): string | null {
  const { board: before, turn } = parseFen(fen);
  const opp = turn === 'w' ? 'b' : 'w';
  const fullmove = Number(fen.split(' ')[5] ?? 1);
  let best: { lan: string; score: number } | null = null;
  for (const m of legal) {
    if (m.san.endsWith('#')) return m.lan;
    let a = rand() * 14;
    if (m.captured) a += VALUE[m.captured] * 9;
    if (m.san.includes('+')) a += style === 'aggressive' ? 18 : 11;
    if (m.promotion) a += 60;
    const after = applyUci(before, m.lan);
    const to = sqIndex(m.to);
    // Attacking something valuable looks good.
    const attacked = attacksFrom(after, to).filter((t) => after[t]?.color === opp && after[t]!.type !== 'p').map((t) => VALUE[after[t]!.type]);
    if (attacked.length) a += Math.min(12, Math.max(...attacked));
    // Early on: bring knights and bishops out, push centre pawns, bring the queen out (a classic!).
    if (fullmove <= 10) {
      if ((m.piece === 'n' || m.piece === 'b') && (m.from[1] === '1' || m.from[1] === '8')) a += 9;
      if (m.piece === 'p' && 'de'.includes(m.from[0])) a += 7;
      if (m.piece === 'q') a += style === 'wild' ? 12 : 4;
      if (m.isKingsideCastle() || m.isQueensideCastle()) a += style === 'solid' ? 14 : 6;
    }
    if (m.piece === 'k' && !(m.isKingsideCastle() || m.isQueensideCastle())) a -= 8;
    if (careful) {
      // A quick look: is anything of mine left hanging after this?
      const worst = hangingPieces(after, turn)[0]?.loss ?? 0;
      a -= Math.max(0, worst - (m.captured ? VALUE[m.captured] : 0)) * 8;
    }
    if (!best || a > best.score) best = { lan: m.lan, score: a };
  }
  return best?.lan ?? null;
}

