// Bot strength model. Stockfish's own UCI_Elo floor (~1320) is too strong for a
// beginner, so we search with MultiPV and pick among the candidate moves with
// Elo-dependent randomness, plus the occasional "human" random move.
import { Chess } from 'chess.js';
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
  randomMoveChance: number;
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
    randomMoveChance: lerp([[400, 0.14], [800, 0.06], [1200, 0.02], [1500, 0]], elo),
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

  // "Wild" players (Lily) make more random moves.
  const randomChance = style === 'wild' ? Math.min(0.35, p.randomMoveChance * 2) : p.randomMoveChance;
  if (rand() < randomChance) {
    // A "human" move: prefer natural-looking moves (captures/development) over pure noise.
    const natural = legal.filter((m) => m.captured || ['n', 'b'].includes(m.piece) || m.piece === 'p');
    const pool = natural.length ? natural : legal;
    return pool[Math.floor(rand() * pool.length)].lan;
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
