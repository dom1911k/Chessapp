// The Puzzle Path: a long climb of puzzle points over 8 illustrated boards (Wood … Legend), 20
// levels each, modelled on chess.com's puzzle points. Points only go up and aren't tied to rating.
// Difficulty comes from your place on the path (a gentle ladder), prompts fade as you climb, and a
// run of misses eases the puzzles until you're solving again. Every number here was checked in
// docs/path-economy-sim.py (about 2–3 years to Legend 20 at 5–10 puzzles a day).
//
// Pure: scorePuzzle / scoreEvent / nextPuzzleSpec / levelAt. The async wrapper at the bottom
// reads and writes kv('puzzlePath'), so backups include it.
import { kvGet, kvSet, today as todayStr } from '../db';

export const BOARD_NAMES = ['Wood', 'Stone', 'Bronze', 'Silver', 'Crystal', 'Elite', 'Champion', 'Legend'] as const;
export const BOARD_TOTALS = [3000, 11000, 25000, 44000, 63000, 82000, 102000, 125000];
export const BOARD_FACTORS = [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75];
export const LEVELS_PER_BOARD = 20;
/** Boards after Legend (Legend II, III, …) cost this much more, with Legend's rewards. */
const LEGEND_PLUS_COST = 1.25;

export type PuzzleDifficulty = 'standard' | 'hard' | 'extraHard';
export const SETTING_MULT: Record<PuzzleDifficulty, number> = { standard: 1, hard: 1.3, extraHard: 1.6 };
export const SETTING_LADDER: Record<PuzzleDifficulty, number> = { standard: 0, hard: 150, extraHard: 300 };

export const round5 = (v: number) => 5 * Math.round(v / 5);
const tierOf = (board: number) => Math.min(board, 7);
export const boardFactor = (board: number) => BOARD_FACTORS[tierOf(board)];

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
/** "Wood" … "Legend", then "Legend II", "Legend III", … */
export function boardName(board: number): string {
  if (board < 8) return BOARD_NAMES[board];
  const n = board - 6;
  return `Legend ${ROMAN[n] ?? n}`;
}

// ---------- Levels ----------

const costCache = new Map<number, number[]>();
/** The 20 level costs of a board: cheap first levels, dearer last ones; the last absorbs rounding. */
export function levelCosts(board: number): number[] {
  let c = costCache.get(board);
  if (c) return c;
  const total = board < 8 ? BOARD_TOTALS[board] : Math.round(BOARD_TOTALS[7] * LEGEND_PLUS_COST);
  // Halves round to even, as in the simulator (Wood level 1 = 110, Stone 410, Legend 4,690).
  const r5even = (v: number) => {
    const x = v / 5;
    const f = Math.floor(x);
    return 5 * (x - f === 0.5 ? (f % 2 === 0 ? f : f + 1) : Math.round(x));
  };
  c = Array.from({ length: LEVELS_PER_BOARD }, (_, l) => r5even((total / LEVELS_PER_BOARD) * (0.75 + (0.5 * l) / 19)));
  c[19] += total - c.reduce((a, b) => a + b, 0);
  costCache.set(board, c);
  return c;
}
export const boardTotal = (board: number) => levelCosts(board).reduce((a, b) => a + b, 0);
/** Points needed to finish Legend 20. */
export const PATH_TOTAL = BOARD_TOTALS.reduce((a, b) => a + b, 0);

export interface LevelPos {
  /** 0 = Wood … 7 = Legend, 8+ = Legend II+. */
  board: number;
  /** The board's look and rewards: min(board, 7). */
  tier: number;
  /** 1 … 20 */
  level: number;
  /** Points into this level, and what it costs. */
  into: number;
  cost: number;
  /** Points at the start of this level. */
  start: number;
}

export function levelAt(points: number): LevelPos {
  let p = Math.max(0, points);
  let start = 0;
  for (let board = 0; ; board++) {
    const costs = levelCosts(board);
    for (let l = 0; l < LEVELS_PER_BOARD; l++) {
      if (p < costs[l]) return { board, tier: tierOf(board), level: l + 1, into: p, cost: costs[l], start };
      p -= costs[l];
      start += costs[l];
    }
    if (board > 400) return { board, tier: 7, level: 20, into: 0, cost: costs[19], start };
  }
}
/** Points at the start of a board's level (1-based). */
export function pointsAtLevel(board: number, level: number): number {
  let p = 0;
  for (let b = 0; b < board; b++) p += boardTotal(b);
  const c = levelCosts(board);
  for (let l = 0; l < level - 1; l++) p += c[l];
  return p;
}
/** Ladder position: board × 20 + level − 1 (0 … 159 on the eight boards). */
export const ladderPos = (pos: Pick<LevelPos, 'board' | 'level'>) => pos.board * LEVELS_PER_BOARD + pos.level - 1;

// ---------- Difficulty: a ladder by path position ----------

export const LADDER = { start: 650, min: 500, max: 1100, climb: 500, k: 0.85, floor: 400, perLegendBoard: 25 };
export type Band = 'easy' | 'medium' | 'hard' | 'expert';
export const BANDS: Band[] = ['easy', 'medium', 'hard', 'expert'];
export const BAND_LABEL: Record<Band, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard', expert: 'Expert' };
const BAND_RAW: Record<Band, number> = { easy: 8, medium: 12, hard: 16, expert: 22 };
const BAND_TIME: Record<Band, number> = { easy: 0.8, medium: 1, hard: 1.3, expert: 1.6 };
const BAND_WINDOW: Record<Band, [number, number]> = { easy: [-250, -100], medium: [-100, 100], hard: [100, 250], expert: [250, 400] };
const BAND_WEIGHTS: Record<PuzzleDifficulty, number[]> = { standard: [20, 65, 13, 2], hard: [10, 55, 27, 8], extraHard: [5, 40, 38, 17] };

/** The ladder's starting point, set once from the puzzle rating when the path starts. */
export function ladderStartFor(rating: number | null): number {
  if (rating === null) return LADDER.start;
  return Math.max(LADDER.min, Math.min(LADDER.max, Math.round(rating - 350)));
}

/** The puzzle rating the ladder aims at for this position (ease ≤ 0 from recovery). */
export function ladderTarget(ladderStart: number, pos: Pick<LevelPos, 'board' | 'level'>, setting: PuzzleDifficulty = 'standard', ease = 0): number {
  const L = Math.min(ladderPos(pos), 159);
  const extra = pos.board > 7 ? LADDER.perLegendBoard * (pos.board - 7) : 0;
  const t = ladderStart + LADDER.climb * Math.pow(L / 159, LADDER.k) + extra + SETTING_LADDER[setting] + Math.min(0, ease);
  return Math.max(LADDER.floor, Math.round(t));
}

/** The band of a puzzle relative to the target it was picked for. */
export function bandOf(puzzleRating: number | undefined, target: number): Band {
  if (puzzleRating === undefined) return 'medium';
  const d = puzzleRating - target;
  return d < -100 ? 'easy' : d <= 100 ? 'medium' : d <= 250 ? 'hard' : 'expert';
}

// ---------- Prompts: the clues fade as you climb ----------

/** Share of [P3 theme + length, P2 theme, P1 goal only, P0 no clues] at the end of each board. */
export const PROMPT_MIX_END = [
  [1, 0, 0, 0],
  [0.3, 0.7, 0, 0],
  [0, 0.6, 0.4, 0],
  [0, 0.2, 0.6, 0.2],
  [0, 0, 0.5, 0.5],
  [0, 0, 0.2, 0.8],
  [0, 0, 0, 1],
  [0, 0, 0, 1],
];
export function promptMix(pos: Pick<LevelPos, 'board' | 'level'>): number[] {
  const t = tierOf(pos.board);
  if (pos.board > 7) return PROMPT_MIX_END[7];
  const a = t ? PROMPT_MIX_END[t - 1] : PROMPT_MIX_END[0];
  const b = PROMPT_MIX_END[t];
  const f = (pos.level - 1) / 19;
  return a.map((v, k) => v + (b[k] - v) * f);
}
/** Extra levels of help from recovery: one at ease ≤ −150, two at ≤ −300. */
export const promptHelp = (ease: number) => (ease <= -300 ? 2 : ease <= -150 ? 1 : 0);

export type PromptLevel = 0 | 1 | 2 | 3;
export function drawPrompt(pos: Pick<LevelPos, 'board' | 'level'>, ease: number, u: number): PromptLevel {
  const m = promptMix(pos);
  let k = 0;
  for (; k < 3; k++) {
    if (u < m[k]) break;
    u -= m[k];
  }
  return Math.min(3, 3 - k + promptHelp(ease)) as PromptLevel;
}

// ---------- State ----------

export interface PathState {
  v: 1;
  points: number;
  /** Points the Path screen last showed; the pawn walks from here. */
  seen: number;
  streak: number;
  bestStreak: number;
  cleanSolved: number;
  hardSolved: number;
  hardestSolved: number;
  dailyDay: string;
  dailyCount: number;
  /** Consecutive days with a Daily Solver, and the last such day. */
  weekRun: number;
  weekDay: string;
  /** The ladder (set once) and recovery. */
  ladderStart: number;
  ease: number;
  missesInARow: number;
  flatDays: Record<'dailyPuzzle' | 'dailyTrainingDone', string>;
}

export function newPathState(rating: number | null): PathState {
  return {
    v: 1, points: 0, seen: 0, streak: 0, bestStreak: 0, cleanSolved: 0, hardSolved: 0, hardestSolved: 0,
    dailyDay: '', dailyCount: 0, weekRun: 0, weekDay: '', ladderStart: ladderStartFor(rating), ease: 0, missesInARow: 0,
    flatDays: { dailyPuzzle: '', dailyTrainingDone: '' },
  };
}

// ---------- The next puzzle ----------

export interface PuzzleSpecReq {
  target: number;
  window: [number, number];
  band: Band;
  promptLevel: PromptLevel;
  /** Your moves at most (Wood 2, Stone 3, Bronze 4, then any length). */
  maxMoves: number;
}
export function nextPuzzleSpec(s: PathState, setting: PuzzleDifficulty = 'standard', rand: () => number = Math.random): PuzzleSpecReq {
  const pos = levelAt(s.points);
  const target = ladderTarget(s.ladderStart, pos, setting, s.ease);
  const w = BAND_WEIGHTS[setting];
  let u = rand() * w.reduce((a, b) => a + b, 0);
  let i = 0;
  for (; i < 3; i++) {
    if (u < w[i]) break;
    u -= w[i];
  }
  const band = BANDS[i];
  const [lo, hi] = BAND_WINDOW[band];
  return {
    target,
    window: [Math.max(LADDER.floor - 150, target + lo), target + hi],
    band,
    promptLevel: drawPrompt(pos, s.ease, rand()),
    maxMoves: pos.board === 0 ? 2 : pos.board === 1 ? 3 : pos.board === 2 ? 4 : 99,
  };
}

// ---------- Scoring ----------

export type PathSource = 'full' | 'review' | 'yours' | 'dailyPuzzle' | 'none';
export interface SolveInput {
  source: PathSource;
  success: boolean;
  hintsUsed: number;
  correctMoves: number;
  seconds: number;
  userMoves: number;
  puzzleRating?: number;
  ratingBefore?: number;
  /** Set only when the attempt moved the puzzle rating; 'full' without it scores as 'none'. */
  ratingAfter?: number;
  promptLevel: PromptLevel;
  today: string;
  setting?: PuzzleDifficulty;
}
export type PathEvent = { event: 'dailyTrainingDone' | 'rushRecord'; today: string };

export type PartKind = 'base' | 'speed' | 'streak' | 'clues' | 'bestStreak' | 'hardest' | 'benchmark' | 'hint' | 'flat';
export interface Part {
  kind: PartKind;
  label: string;
  points: number;
  gold?: boolean;
}
export type MomentKind = 'daily3' | 'daily10' | 'streak' | 'solved' | 'week';
export interface Moment {
  kind: MomentKind;
  n?: number;
  points: number;
}
export interface PathAward {
  parts: Part[];
  moments: Moment[];
  total: number;
  before: number;
  after: number;
  /** Each level reached on the way ({ board, level } of the new level). */
  levelsCrossed: { board: number; level: number }[];
  /** The new board, when the award crossed into one. */
  boardUp?: number;
  streak: number;
  /** The streak a miss ended. */
  streakLost?: number;
  dailyCount: number;
  /** The board/tier the numbers came from (the start of the puzzle). */
  board: number;
  band?: Band;
}

/** Rarest first: when more than two moments fire at once, these two stay moments. */
const MOMENT_RARITY: Record<MomentKind, number> = { week: 5, solved: 4, streak: 3, daily10: 2, daily3: 1 };
export const momentLabel = (m: Moment) =>
  ({ daily3: 'Daily Solver', daily10: 'Daily Ten', streak: `${m.n} in a row`, solved: `${m.n} puzzles solved`, week: 'Perfect week' })[m.kind];

/** The day before a "YYYY-MM-DD" day. */
export function prevDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return todayStr(new Date(y, m - 1, d - 1));
}

const FLAT_RAW = { review: 8, yours: 15, dailyPuzzle: 25, dailyTrainingDone: 40, rushRecord: 50 } as const;
const FLAT_LABEL = { review: 'Review', yours: 'From your game', dailyPuzzle: 'Daily Puzzle', dailyTrainingDone: 'Training complete', rushRecord: 'Rush record' } as const;

function finish(before: PathState, s: PathState, parts: Part[], moments: Moment[], extra: Partial<PathAward>): { state: PathState; award: PathAward } {
  const total = parts.reduce((a, p) => a + p.points, 0) + moments.reduce((a, m) => a + m.points, 0);
  s.points = before.points + total;
  const from = levelAt(before.points);
  const levelsCrossed: { board: number; level: number }[] = [];
  let pos = from;
  while (true) {
    const nextStart = pos.start + pos.cost;
    if (s.points < nextStart) break;
    pos = levelAt(nextStart);
    levelsCrossed.push({ board: pos.board, level: pos.level });
    if (levelsCrossed.length > 400) break;
  }
  const to = levelAt(s.points);
  return {
    state: s,
    award: {
      parts, moments, total, before: before.points, after: s.points, levelsCrossed,
      boardUp: to.board > from.board ? to.board : undefined,
      streak: s.streak, dailyCount: s.dailyCount, board: from.board, ...extra,
    },
  };
}

/** Score one puzzle attempt. Pure: returns the new state and the award (never touches `seen`). */
export function scorePuzzle(prev: PathState, input: SolveInput): { state: PathState; award: PathAward } {
  const s: PathState = { ...prev, flatDays: { ...prev.flatDays } };
  if (s.dailyDay !== input.today) {
    s.dailyDay = input.today;
    s.dailyCount = 0;
  }
  const pos = levelAt(prev.points);
  const g = boardFactor(pos.board);
  const setting = input.setting ?? 'standard';
  const sm = SETTING_MULT[setting];
  const source: PathSource = input.source === 'full' && input.ratingAfter === undefined ? 'none' : input.source;
  const parts: Part[] = [];

  if (source === 'none') return finish(prev, s, parts, [], {});

  if (source !== 'full') {
    // Flat sources: no speed, no streak change, no Daily Solver, no ladder.
    if (!input.success) return finish(prev, s, parts, [], {});
    if (source === 'dailyPuzzle') {
      if (s.flatDays.dailyPuzzle === input.today) return finish(prev, s, parts, [], {});
      s.flatDays.dailyPuzzle = input.today;
    }
    parts.push({ kind: 'flat', label: FLAT_LABEL[source], points: round5(FLAT_RAW[source] * g) });
    return finish(prev, s, parts, [], {});
  }

  const target = ladderTarget(prev.ladderStart, pos, setting, prev.ease);
  const band = bandOf(input.puzzleRating, target);

  if (!input.success) {
    const lost = s.streak;
    s.streak = 0;
    s.missesInARow += 1;
    s.ease = Math.max(-400, s.ease - 25 * Math.min(s.missesInARow, 4));
    return finish(prev, s, parts, [], { streakLost: lost > 0 ? lost : undefined, band });
  }
  if (input.hintsUsed > 0) {
    s.missesInARow = 0;
    parts.push({ kind: 'hint', label: 'Solved with a hint', points: Math.max(1, input.correctMoves) });
    return finish(prev, s, parts, [], { band });
  }

  // A clean solve.
  s.missesInARow = 0;
  s.ease = Math.min(0, s.ease + 12);
  s.streak += 1;
  s.cleanSolved += 1;
  s.dailyCount += 1;
  parts.push({ kind: 'base', label: BAND_LABEL[band], points: Math.round(BAND_RAW[band] * g * sm) });
  const T = (10 + 8 * (Math.max(1, input.userMoves) - 1)) * BAND_TIME[band];
  const r = input.seconds / T;
  const speed = r <= 0.4 ? 7 : r <= 0.6 ? 6 : r <= 0.8 ? 5 : r <= 1 ? 4 : r <= 1.5 ? 3 : r <= 2.5 ? 2 : 1;
  parts.push({ kind: 'speed', label: speed === 7 ? 'Lightning' : 'Speed', points: speed });
  if (s.streak >= 2) parts.push({ kind: 'streak', label: `Streak ×${s.streak}`, points: Math.round(Math.min(s.streak - 1, 14) * g * sm) });
  if (input.promptLevel === 1) parts.push({ kind: 'clues', label: 'Few clues', points: Math.round(2 * g * sm) });
  if (input.promptLevel === 0) parts.push({ kind: 'clues', label: 'No clues', points: Math.round(4 * g * sm) });

  if (s.streak > prev.bestStreak && s.streak >= 5) parts.push({ kind: 'bestStreak', label: 'New best streak', points: round5(25 * g), gold: true });
  s.bestStreak = Math.max(prev.bestStreak, s.streak);
  if (input.puzzleRating !== undefined) {
    if (prev.cleanSolved >= 20 && input.puzzleRating >= prev.hardestSolved + 50) parts.push({ kind: 'hardest', label: 'Hardest solved', points: round5(25 * g), gold: true });
    s.hardestSolved = Math.max(prev.hardestSolved, input.puzzleRating);
  }
  if (band === 'hard' || band === 'expert') {
    s.hardSolved += 1;
    if (s.hardSolved % 50 === 0) parts.push({ kind: 'benchmark', label: '50 hard puzzles', points: round5(50 * g), gold: true });
  }

  // Moments: rare milestones, each delivered by its own celebration.
  const moments: Moment[] = [];
  if (s.dailyCount === 3) {
    moments.push({ kind: 'daily3', points: Math.round(60 * g) });
    s.weekRun = s.weekDay === prevDay(input.today) ? s.weekRun + 1 : 1;
    s.weekDay = input.today;
    if (s.weekRun >= 7) {
      moments.push({ kind: 'week', points: round5(150 * g) });
      s.weekRun = 0;
    }
  }
  if (s.dailyCount === 10) moments.push({ kind: 'daily10', points: round5(25 * g) });
  const k = s.streak;
  if ([15, 30, 50, 100].includes(k) || (k > 100 && k % 50 === 0)) moments.push({ kind: 'streak', n: k, points: round5((k >= 100 ? 300 : k >= 50 ? 200 : k >= 30 ? 100 : 50) * g) });
  if (s.cleanSolved % 100 === 0) moments.push({ kind: 'solved', n: s.cleanSolved, points: round5((s.cleanSolved % 1000 === 0 ? 250 : 50) * g) });
  // At most two; the rest become gold chips. Shown in rising rarity (the rarer one last).
  moments.sort((a, b) => MOMENT_RARITY[b.kind] - MOMENT_RARITY[a.kind]);
  for (const m of moments.splice(2)) parts.push({ kind: 'benchmark', label: momentLabel(m), points: m.points, gold: true });
  moments.reverse();

  return finish(prev, s, parts, moments, { band });
}

/** The two event bonuses: finishing Daily training (once a day) and a Puzzle Rush record. */
export function scoreEvent(prev: PathState, e: PathEvent): { state: PathState; award: PathAward } {
  const s: PathState = { ...prev, flatDays: { ...prev.flatDays } };
  const g = boardFactor(levelAt(prev.points).board);
  if (e.event === 'dailyTrainingDone') {
    if (s.flatDays.dailyTrainingDone === e.today) return finish(prev, s, [], [], {});
    s.flatDays.dailyTrainingDone = e.today;
  }
  return finish(prev, s, [{ kind: 'flat', label: FLAT_LABEL[e.event], points: round5(FLAT_RAW[e.event] * g) }], [], {});
}

// ---------- Storage ----------

export const PATH_KEY = 'puzzlePath';

/** The saved path, created on first use (the ladder starts from the puzzle rating, once). */
export async function getPathState(): Promise<PathState> {
  const s = await kvGet<PathState | null>(PATH_KEY, null);
  if (s && s.v === 1) return s;
  const { getRating } = await import('./rating');
  const r = await getRating();
  const fresh = newPathState(r.games > 0 ? r.rating : null);
  await kvSet(PATH_KEY, fresh);
  return fresh;
}
export async function savePathState(s: PathState): Promise<void> {
  await kvSet(PATH_KEY, s);
}

let chain: Promise<unknown> = Promise.resolve();
/** Score and save in one step (serialised, so two quick awards never overwrite each other). */
export function awardPath(e: SolveInput | PathEvent): Promise<PathAward> {
  const run = chain.then(async () => {
    const s = await getPathState();
    const { state, award } = 'event' in e ? scoreEvent(s, e) : scorePuzzle(s, e);
    await savePathState(state);
    return award;
  });
  chain = run.catch(() => undefined);
  return run;
}

/** The Path screen has shown the pawn up to here. */
export async function markPathSeen(points: number): Promise<void> {
  await (chain = chain.then(async () => {
    const s = await getPathState();
    if (points > s.seen) await savePathState({ ...s, seen: Math.min(points, s.points) });
  }).catch(() => undefined));
}
