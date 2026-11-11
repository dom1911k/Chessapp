// The learning path: chapters of lesson → practice puzzles → drill or game.
import { useCelebrate } from './celebrate';
import { db, kvGet, kvSet } from './db';
import { opponentById } from './people';
import { progress } from './progress';
import { lessonById } from './lessons/data';
import { MODEL_DONE_KEY, modelGameById } from './lessons/games';

export type CourseStep =
  | { id: string; kind: 'lesson'; lessonId: string; label: string }
  | { id: string; kind: 'puzzles'; theme: string; count: number; label: string }
  | { id: string; kind: 'drill'; drillId: string; label: string }
  | { id: string; kind: 'game'; opponentId: string; label: string }
  | { id: string; kind: 'model'; gameId: string; label: string };

export interface Chapter {
  id: string;
  /** Index into STAGES. */
  stage: number;
  title: string;
  icon: string;
  intro: string;
  steps: CourseStep[];
}

export interface Stage {
  id: string;
  title: string;
  /** Rough rating band the stage takes you through. */
  range: string;
  icon: string;
  intro: string;
}

/** The road from first moves to about 1800. */
export const STAGES: Stage[] = [
  { id: 'first', title: 'First steps', range: 'up to 600', icon: 'sprout', intro: 'The rules people skip, piece values, and not giving pieces away.' },
  { id: 'tactics', title: 'Tactics', range: '600 – 1000', icon: 'zap', intro: 'Forks, pins, discoveries and the routine that finds them.' },
  { id: 'attack', title: 'Attack & mates', range: '800 – 1200', icon: 'swords', intro: 'Mating patterns and how to attack a king.' },
  { id: 'openings', title: 'Openings', range: '1000 – 1400', icon: 'book', intro: 'Plans for White and Black, traps to know, and what to do next.' },
  { id: 'strategy', title: 'Strategy', range: '1200 – 1600', icon: 'map', intro: 'Good pieces, pawn structure and how to make a plan.' },
  { id: 'endgames', title: 'Endgames', range: '1000 – 1800', icon: 'flag', intro: 'The positions every strong player knows by heart.' },
  { id: 'mastery', title: 'Mastery', range: '1400 – 1800', icon: 'trophy', intro: 'Calculation, technique and practical play.' },
];

const game = (id: string, opponentId: string): CourseStep => ({ id, kind: 'game', opponentId, label: `Play ${opponentById(opponentId)?.name ?? opponentId}` });
const L = (lessonId: string): CourseStep => ({ id: `l-${lessonId}`, kind: 'lesson', lessonId, label: lessonById(lessonId)?.title ?? lessonId });
const P = (id: string, theme: string, count: number, what: string): CourseStep => ({ id, kind: 'puzzles', theme, count, label: `${count} ${what}` });
const D = (drillId: string, label: string): CourseStep => ({ id: `d-${drillId}`, kind: 'drill', drillId, label: `Drill: ${label}` });
const M = (gameId: string): CourseStep => ({ id: `m-${gameId}`, kind: 'model', gameId, label: `Model game: ${modelGameById(gameId)?.title ?? gameId}` });

export const CHAPTERS: Chapter[] = [
  // ---- Stage 1: First steps ----
  { id: 'c1', stage: 0, title: 'How games are won', icon: 'king', intro: 'Checkmate is the goal. Learn what it is — and how to avoid stalemate.', steps: [L('checkmate'), P('c1-p', 'mateIn1', 5, 'mate-in-one puzzles'), D('kqk', 'Queen mate'), L('s1-draws')] },
  { id: 'n1', stage: 0, title: 'The pieces', icon: 'gem', intro: 'What each piece is worth, and the special moves.', steps: [L('s1-values'), L('s1-castling'), L('s1-special')] },
  { id: 'c2', stage: 0, title: 'Keep your pieces safe', icon: 'gift', intro: 'Most beginner games are decided by pieces left hanging. Spot them — yours and theirs.', steps: [L('hanging'), L('s1-counting'), L('s1-threats'), P('c2-p', 'hangingPiece', 8, 'free-piece puzzles'), game('c2-g', 'lily')] },
  { id: 'n2', stage: 0, title: 'Basic checkmates', icon: 'rook', intro: 'Mate with two rooks, then with one.', steps: [L('s1-ladder'), D('rr-ladder', 'Two rooks'), L('mate-kingrook'), D('krk', 'Rook mate')] },
  { id: 'c6', stage: 0, title: 'Start well', icon: 'book', intro: 'Centre, development, castling — and the four-move mate.', steps: [L('opening'), L('s1-scholar'), M('opera'), game('c6-g', 'tom')] },
  // ---- Stage 2: Tactics ----
  { id: 'n3', stage: 1, title: 'How to find tactics', icon: 'brain', intro: 'A routine that works in every position.', steps: [L('s2-cct'), L('s2-loose')] },
  { id: 'c3', stage: 1, title: 'Double attacks', icon: 'fork', intro: 'One move, two threats: the fork.', steps: [L('forks'), P('c3-p', 'fork', 8, 'fork puzzles')] },
  { id: 'c4', stage: 1, title: 'Pins & skewers', icon: 'pin', intro: 'Pieces lined up on a file, rank or diagonal are vulnerable.', steps: [L('pins'), P('c4-p', 'pin', 5, 'pin puzzles'), P('c4-s', 'skewer', 5, 'skewer puzzles')] },
  { id: 'n4', stage: 1, title: 'Discoveries', icon: 'eye', intro: 'Move one piece, unleash another.', steps: [L('s2-discovered'), L('s2-doublecheck'), P('n4-p', 'discoveredAttack', 6, 'discovered-attack puzzles'), M('reti')] },
  { id: 'c7', stage: 1, title: 'Remove the defender', icon: 'shield', intro: 'Capture, deflect or lure away the piece that guards.', steps: [L('defender'), L('s2-deflection'), L('s2-attraction'), P('c7-p', 'capturingDefender', 6, 'remove-the-defender puzzles'), P('c7-q', 'deflection', 5, 'deflection puzzles')] },
  { id: 'n5', stage: 1, title: 'Tricks and defence', icon: 'trap', intro: 'Trapped pieces, in-between moves, and how to answer a threat.', steps: [L('s2-trapped'), L('s2-intermezzo'), L('s2-defence'), P('n5-p', 'trappedPiece', 5, 'trapped-piece puzzles'), game('n5-g', 'maya')] },
  // ---- Stage 3: Checkmates & attack ----
  { id: 'c5', stage: 2, title: 'The back rank', icon: 'castle', intro: 'A king behind its own pawns can be mated on the back rank.', steps: [L('backrank'), L('mate-backrank'), P('c5-p', 'backRankMate', 6, 'back-rank puzzles')] },
  { id: 'c9', stage: 2, title: 'Mate in two', icon: 'queen', intro: 'Forcing moves — checks, captures, threats — lead to mate.', steps: [L('mate2'), P('c9-p', 'mateIn2', 6, 'mate-in-two puzzles')] },
  { id: 'n6', stage: 2, title: 'Mating patterns I', icon: 'crown', intro: 'The pictures to recognise at a glance.', steps: [L('mate-kiss'), L('mate-helper'), L('mate-smothered'), L('mate-arabian'), L('mate-corner')] },
  { id: 'n7', stage: 2, title: 'Mating patterns II', icon: 'crosshair', intro: 'Opera, Anastasia, Boden, Greco, epaulette.', steps: [L('mate-opera'), L('mate-scholar'), L('s3-mates2'), P('n7-p', 'mateIn3', 5, 'mate-in-three puzzles')] },
  { id: 'n8', stage: 2, title: 'Attacking the king', icon: 'swords', intro: 'When to attack, the Greek gift, and the king caught in the centre.', steps: [L('s3-castled'), L('s3-greekgift'), L('s3-centreking'), P('n8-p', 'kingsideAttack', 6, 'kingside-attack puzzles'), M('greco'), M('lasker'), game('n8-g', 'jonas')] },
  // ---- Stage 4: Openings ----
  { id: 'n9', stage: 3, title: 'Open games', icon: 'book', intro: '1.e4 e5: the Italian, the Ruy Lopez, and the traps.', steps: [L('s4-italian'), L('s4-ruy'), L('s4-traps'), L('s4-gambits')] },
  { id: 'n10', stage: 3, title: 'Queen’s pawn openings', icon: 'queen', intro: 'The Queen’s Gambit and the London System.', steps: [L('s4-qg'), L('s4-london')] },
  { id: 'n11', stage: 3, title: 'Playing Black', icon: 'shield', intro: 'Reliable answers to 1.e4 and 1.d4.', steps: [L('s4-sicilian'), L('s4-solid'), L('s4-vsd4')] },
  { id: 'n12', stage: 3, title: 'Beyond the opening', icon: 'map', intro: 'What to do when development is finished.', steps: [L('s4-next'), L('s4-repertoire'), P('n12-p', 'opening', 6, 'opening-tactics puzzles'), M('immortal'), game('n12-g', 'priya')] },
  // ---- Stage 5: Strategy ----
  { id: 'n13', stage: 4, title: 'Good pieces', icon: 'sparkles', intro: 'Activity, outposts, open files and bishops.', steps: [L('s5-activity'), L('s5-outposts'), L('s5-files'), L('s5-bishops')] },
  { id: 'n14', stage: 4, title: 'Pawn structure', icon: 'pawn', intro: 'Weak pawns, passed pawns, space and pawn breaks.', steps: [L('s5-pawns'), L('s5-passed'), L('s5-space'), L('s5-breaks')] },
  { id: 'n15', stage: 4, title: 'Plans', icon: 'scroll', intro: 'Races, trades, prevention — and how to choose a plan.', steps: [L('s5-castling'), L('s5-minority'), L('s5-trades'), L('s5-prophylaxis'), L('s5-plan'), M('rubinstein'), game('n15-g', 'marcus')] },
  // ---- Stage 6: Endgames ----
  { id: 'c8', stage: 5, title: 'Pawn endings', icon: 'pawn', intro: 'Few pieces, big ideas: opposition, key squares, zugzwang.', steps: [L('s6-king'), L('pawns'), L('s6-keysquares'), D('kpk-front', 'King in front'), D('kpk-defend', 'Defend with the king'), D('kpk-square', 'The square rule'), L('s6-zugzwang'), D('zugzwang', 'Mutual zugzwang'), L('s6-breakthrough'), D('breakthrough', 'The breakthrough'), L('s6-outside'), D('outside', 'Outside passed pawn'), P('c8-p', 'pawnEndgame', 5, 'pawn-ending puzzles')] },
  { id: 'c10', stage: 5, title: 'Rook endings', icon: 'rook', intro: 'The most common endgame of all.', steps: [L('s6-rooks'), L('s6-lucena'), D('lucena', 'Lucena'), L('s6-philidor'), D('philidor', 'Philidor'), P('c10-p', 'rookEndgame', 5, 'rook-ending puzzles'), game('c10-g', 'sofia')] },
  { id: 'n16', stage: 5, title: 'Other endings', icon: 'bishop', intro: 'Minor pieces, queen against pawn, and winning technique.', steps: [L('s6-minor'), D('wrongbishop', 'The wrong bishop'), L('s6-queen'), D('qvp', 'Queen vs pawn'), D('kbbk', 'Two bishops'), L('s6-twoweak')] },
  // ---- Stage 7: Mastery ----
  { id: 'n17', stage: 6, title: 'Calculation', icon: 'brain', intro: 'Candidate moves, forcing lines, the blunder check.', steps: [L('s7-candidates'), L('s7-forcing'), L('s7-blunder'), L('s7-sacs'), L('s7-quiet'), P('n17-p', 'sacrifice', 6, 'sacrifice puzzles'), P('n17-q', 'quietMove', 5, 'quiet-move puzzles')] },
  { id: 'n18', stage: 6, title: 'Practical play', icon: 'trophy', intro: 'Winning won games, saving lost ones, and how to keep improving.', steps: [L('s7-convert'), L('s7-defend'), L('s7-study'), M('century')] },
  { id: 'c11', stage: 6, title: 'The final test', icon: 'medal', intro: 'Everything together — against the strongest players.', steps: [game('c11-g1', 'viktor'), game('c11-g2', 'mei')] },
];

/** The course step that teaches a lesson (for links from reviews and Daily). */
export const lessonStage = (lessonId: string): number | null => CHAPTERS.find((ch) => ch.steps.some((s) => s.kind === 'lesson' && s.lessonId === lessonId))?.stage ?? null;

const PUZZLE_KEY = 'coursePuzzles';
const CHAPTER_KEY = 'courseChapters';

export interface CourseState {
  done: Record<string, boolean>;
  puzzles: Record<string, number>;
  chapters: Record<string, boolean>;
  /** Stage you started at (from the placement check); everything up to it is open. */
  start: number;
}

/** Works out which steps are done from what you've already played. */
export async function courseState(): Promise<CourseState> {
  const lessons = await kvGet<string[]>('lessonsDone', []);
  const drills = await kvGet<Record<string, { completed: number }>>('endgameProgress', {});
  const puzzles = await kvGet<Record<string, number>>(PUZZLE_KEY, {});
  const chapters = await kvGet<Record<string, boolean>>(CHAPTER_KEY, {});
  const models = await kvGet<Record<string, number>>(MODEL_DONE_KEY, {});
  const start = await kvGet<number>(START_KEY, 0);
  const games = await db.games.toArray();
  const played = new Set(games.filter((g) => g.plies.filter((p) => p.isUser).length >= 10).map((g) => g.opponentId));
  const done: Record<string, boolean> = {};
  for (const ch of CHAPTERS)
    for (const s of ch.steps) {
      done[s.id] =
        s.kind === 'lesson' ? lessons.includes(s.lessonId)
        : s.kind === 'drill' ? (drills[s.drillId]?.completed ?? 0) > 0
        : s.kind === 'game' ? played.has(s.opponentId)
        : s.kind === 'model' ? s.gameId in models
        : (puzzles[s.id] ?? 0) >= s.count;
    }
  return { done, puzzles, chapters, start };
}

export const chapterDone = (ch: Chapter, st: CourseState) => ch.steps.every((s) => st.done[s.id]);

/** A chapter opens when the previous one is finished. */
export function chapterOpen(i: number, st: CourseState): boolean {
  return i === 0 || CHAPTERS[i].stage <= st.start || chapterDone(CHAPTERS[i - 1], st);
}

/** Steps done / total for a stage. */
export function stageProgress(stage: number, st: CourseState): { done: number; total: number } {
  const steps = CHAPTERS.filter((ch) => ch.stage === stage).flatMap((ch) => ch.steps);
  return { done: steps.filter((s) => st.done[s.id]).length, total: steps.length };
}

/** The stage you are working on: the first one with an open, unfinished chapter (never before your start). */
export function currentStage(st: CourseState): number {
  const i = CHAPTERS.findIndex((ch, k) => ch.stage >= st.start && !chapterDone(ch, st) && chapterOpen(k, st));
  return i < 0 ? Math.min(st.start, STAGES.length - 1) : CHAPTERS[i].stage;
}

export const START_KEY = 'courseStartStage';

/** Where the placement check puts you, from how many of its 8 positions you solved. */
export function placementStage(correct: number): number {
  return correct >= 7 ? 4 : correct >= 6 ? 3 : correct >= 4 ? 2 : correct >= 2 ? 1 : 0;
}

/** The placement check: one position from each level of the course, easiest first. */
export const PLACEMENT: { lessonId: string; step: number }[] = [
  { lessonId: 's1-values', step: 3 },
  { lessonId: 's2-loose', step: 1 },
  { lessonId: 's2-deflection', step: 3 },
  { lessonId: 's3-greekgift', step: 1 },
  { lessonId: 's4-traps', step: 1 },
  { lessonId: 's6-keysquares', step: 3 },
  { lessonId: 's6-zugzwang', step: 1 },
  { lessonId: 's6-breakthrough', step: 1 },
];

export async function addCoursePuzzle(stepId: string): Promise<number> {
  const p = await kvGet<Record<string, number>>(PUZZLE_KEY, {});
  p[stepId] = (p[stepId] ?? 0) + 1;
  await kvSet(PUZZLE_KEY, p);
  return p[stepId];
}

/** Celebrates chapters finished since the last check. */
export async function checkChapters(): Promise<void> {
  const st = await courseState();
  const fresh = CHAPTERS.filter((ch) => chapterDone(ch, st) && !st.chapters[ch.id]);
  if (!fresh.length) return;
  for (const ch of fresh) st.chapters[ch.id] = true;
  await kvSet(CHAPTER_KEY, st.chapters);
  const c = useCelebrate.getState();
  c.confetti();
  for (const ch of fresh) {
    c.toast({ icon: ch.icon, title: `Chapter complete: ${ch.title}`, text: 'The next chapter is open.' });
    await progress({ kind: 'chapter' });
  }
}

/** The lesson to study for each kind of mistake found in a Game Review. */
export const CAUSE_LESSON: Record<string, string> = {
  missedThreat: 's1-threats',
  hungPiece: 's1-counting',
  missedTactic: 's2-cct',
  calculation: 's7-candidates',
  plan: 's4-next',
  fast: 's7-blunder',
  timeTrouble: 's7-blunder',
};
