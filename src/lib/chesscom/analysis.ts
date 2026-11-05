// Turning engine results for an imported game into the same classified plies, summary and
// review cards an app game gets (pure: the engine results come in as arguments).
import { moveAccuracy, povScore, winPct, type Score } from '../chess/evaluation';
import { gameOverInfo } from '../chess/game';
import { explainMove } from '../coach';
import type { AnalysisResult } from '../engine';
import { summarize } from '../report';
import { specialMove, tacticsOfMove, type TacticCounts } from '../rewards/career';
import { newCardDue, type Card } from '../srs';
import type { AnyGame, ImportedGame, PlyRecord } from '../store/types';

/** Positions to analyse: the start and the position after every ply (null = game over there). */
export function positionsOf(g: Pick<ImportedGame, 'startFen' | 'plies'>): string[] {
  return [g.startFen, ...g.plies.map((p) => p.fenAfter)];
}
/** Lines wanted for position k: 3 before your own moves (for the coach's "better was…"), else 1. */
export const multipvFor = (g: Pick<ImportedGame, 'plies'>, k: number) => (g.plies[k]?.isUser ? 3 : 1);

function terminalScore(fen: string): Score | undefined {
  const info = gameOverInfo(fen);
  if (!info) return undefined;
  if (info.reason === 'checkmate') return { type: 'mate', value: info.result === '1-0' ? 1 : -1 } as Score;
  return { type: 'cp', value: 0 };
}

/** Classified plies from the analysis of every position (`res[k]` = after k plies). */
export function classifyPlies(g: Pick<ImportedGame, 'startFen' | 'plies'>, res: (AnalysisResult | null)[]): PlyRecord[] {
  const told: string[] = [];
  return g.plies.map((ply, i) => {
    const before = res[i];
    const after = res[i + 1];
    const aScore = after?.lines[0]?.score ?? terminalScore(ply.fenAfter);
    if (!ply.isUser || !before) return { ...ply, evalAfter: aScore };
    const comment = explainMove({ fenBefore: ply.fenBefore, uci: ply.uci, before, after: after ?? null, history: g.plies.slice(0, i).map((p) => p.uci), startFen: g.startFen, suppress: told });
    for (const r of comment.ruleIds) if (!told.includes(r)) told.push(r);
    const bScore = before.lines[0]?.score;
    const wpB = bScore ? winPct(povScore(bScore, ply.color)) : 50;
    const wpA = aScore ? winPct(povScore(aScore, ply.color)) : wpB;
    const sound = comment.classification === 'best' || comment.classification === 'good';
    const tactics: TacticCounts = sound ? tacticsOfMove(ply.fenBefore, ply.uci) : {};
    const special = specialMove(ply.fenBefore, ply.uci, before, after ?? null, comment.classification === 'best', g.plies[i - 1]?.uci) ?? undefined;
    if (special) tactics[special] = 1;
    return {
      ...ply,
      evalAfter: aScore,
      classification: comment.classification,
      accuracy: moveAccuracy(wpB, wpA),
      wpLoss: Math.max(0, wpB - wpA),
      comment,
      special,
      tactics: Object.keys(tactics).length ? tactics : undefined,
    };
  });
}

/** The analysed game: plies, summary and tactics filled in. */
export function withAnalysis(g: ImportedGame, res: (AnalysisResult | null)[]): ImportedGame {
  const plies = classifyPlies(g, res);
  const tactics: TacticCounts = {};
  for (const p of plies) if (p.isUser && p.tactics) for (const [k, v] of Object.entries(p.tactics)) tactics[k as keyof TacticCounts] = (tactics[k as keyof TacticCounts] ?? 0) + (v ?? 0);
  return { ...g, plies, summary: summarize(plies), tactics, analyzed: true };
}

const fmtDay = (t: number) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** Review cards for your mistakes and blunders in an imported game (tagged chess.com). */
export function mistakeCards(g: ImportedGame, now = Date.now()): Card[] {
  const out: Card[] = [];
  g.plies.forEach((p, i) => {
    if (!p.isUser || (p.classification !== 'mistake' && p.classification !== 'blunder')) return;
    const best = p.comment?.bestUci;
    if (!best || best === p.uci) return;
    out.push({
      id: `m:${g.id}:${i}`,
      kind: 'mistake',
      source: 'chess.com',
      ccGameId: g.id,
      fen: p.fenBefore,
      solution: [best],
      playedUci: p.uci,
      playedSan: p.san,
      themes: p.comment?.themes ?? [],
      label: `chess.com · vs ${g.opponentName} · ${fmtDay(g.endedAt)}`,
      explanation: p.comment?.text,
      createdAt: now,
      due: newCardDue(now),
      step: 0,
      reps: 0,
      lapses: 0,
    });
  });
  return out;
}

/** Games for stats, by where they were played. */
export type GameSource = 'all' | 'app' | 'chess.com';
export const sourceOf = (g: Pick<AnyGame, 'source'>): 'app' | 'chess.com' => (g.source === 'chess.com' ? 'chess.com' : 'app');
export const bySource = <T extends Pick<AnyGame, 'source'>>(games: T[], src: GameSource) => (src === 'all' ? games : games.filter((g) => sourceOf(g) === src));
