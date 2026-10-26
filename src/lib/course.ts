// The learning path: chapters of lesson → practice puzzles → drill or game.
import { useCelebrate } from './celebrate';
import { db, kvGet, kvSet } from './db';
import { opponentById } from './people';
import { progress } from './progress';

export type CourseStep =
  | { id: string; kind: 'lesson'; lessonId: string; label: string }
  | { id: string; kind: 'puzzles'; theme: string; count: number; label: string }
  | { id: string; kind: 'drill'; drillId: string; label: string }
  | { id: string; kind: 'game'; opponentId: string; label: string };

export interface Chapter {
  id: string;
  title: string;
  icon: string;
  intro: string;
  steps: CourseStep[];
}

const game = (id: string, opponentId: string): CourseStep => ({ id, kind: 'game', opponentId, label: `Play ${opponentById(opponentId)?.name ?? opponentId}` });

export const CHAPTERS: Chapter[] = [
  {
    id: 'c1', title: 'How games are won', icon: 'king', intro: 'Checkmate is the goal. Learn what it is — and how to avoid stalemate.',
    steps: [
      { id: 'c1-l', kind: 'lesson', lessonId: 'checkmate', label: 'Lesson: Check, checkmate & stalemate' },
      { id: 'c1-p', kind: 'puzzles', theme: 'mateIn1', count: 5, label: '5 mate-in-one puzzles' },
      { id: 'c1-d', kind: 'drill', drillId: 'kqk', label: 'Drill: Queen mate' },
    ],
  },
  {
    id: 'c2', title: 'Keep your pieces safe', icon: 'gift', intro: 'Most beginner games are decided by pieces left hanging. Spot them — yours and your opponent\'s.',
    steps: [
      { id: 'c2-l', kind: 'lesson', lessonId: 'hanging', label: 'Lesson: Free pieces' },
      { id: 'c2-p', kind: 'puzzles', theme: 'hangingPiece', count: 8, label: '8 free-piece puzzles' },
      game('c2-g', 'lily'),
    ],
  },
  {
    id: 'c3', title: 'Double attacks', icon: 'fork', intro: 'One move, two threats: the fork.',
    steps: [
      { id: 'c3-l', kind: 'lesson', lessonId: 'forks', label: 'Lesson: Forks' },
      { id: 'c3-p', kind: 'puzzles', theme: 'fork', count: 8, label: '8 fork puzzles' },
      game('c3-g', 'tom'),
    ],
  },
  {
    id: 'c4', title: 'Pins & skewers', icon: 'pin', intro: 'Pieces lined up on a file, rank or diagonal are vulnerable.',
    steps: [
      { id: 'c4-l', kind: 'lesson', lessonId: 'pins', label: 'Lesson: Pins & skewers' },
      { id: 'c4-p', kind: 'puzzles', theme: 'pin', count: 5, label: '5 pin puzzles' },
      { id: 'c4-s', kind: 'puzzles', theme: 'skewer', count: 5, label: '5 skewer puzzles' },
    ],
  },
  {
    id: 'c5', title: 'The back rank', icon: 'castle', intro: 'A king behind its own pawns can be mated on the back rank.',
    steps: [
      { id: 'c5-l', kind: 'lesson', lessonId: 'backrank', label: 'Lesson: Back-rank mates' },
      { id: 'c5-p', kind: 'puzzles', theme: 'backRankMate', count: 6, label: '6 back-rank puzzles' },
      game('c5-g', 'maya'),
    ],
  },
  {
    id: 'c6', title: 'Start well', icon: 'book', intro: 'Center, development, castling — the opening in three rules.',
    steps: [
      { id: 'c6-l', kind: 'lesson', lessonId: 'opening', label: 'Lesson: Opening principles' },
      game('c6-g', 'jonas'),
    ],
  },
  {
    id: 'c7', title: 'Remove the defender', icon: 'shield', intro: 'Capture or chase away the piece that guards something valuable.',
    steps: [
      { id: 'c7-l', kind: 'lesson', lessonId: 'defender', label: 'Lesson: Remove the defender' },
      { id: 'c7-p', kind: 'puzzles', theme: 'capturingDefender', count: 6, label: '6 puzzles' },
      game('c7-g', 'priya'),
    ],
  },
  {
    id: 'c8', title: 'Pawn endings', icon: 'pawn', intro: 'Few pieces, big ideas: the square rule and the opposition.',
    steps: [
      { id: 'c8-l', kind: 'lesson', lessonId: 'pawns', label: 'Lesson: Pawn endings' },
      { id: 'c8-d1', kind: 'drill', drillId: 'kpk-front', label: 'Drill: King in front' },
      { id: 'c8-d2', kind: 'drill', drillId: 'kpk-defend', label: 'Drill: Defend with the king' },
      { id: 'c8-d3', kind: 'drill', drillId: 'kpk-square', label: 'Drill: The square rule' },
    ],
  },
  {
    id: 'c9', title: 'Mate in two', icon: 'queen', intro: 'Forcing moves — checks, captures, threats — lead to mate.',
    steps: [
      { id: 'c9-l', kind: 'lesson', lessonId: 'mate2', label: 'Lesson: Mate in two' },
      { id: 'c9-p', kind: 'puzzles', theme: 'mateIn2', count: 6, label: '6 mate-in-two puzzles' },
      game('c9-g', 'marcus'),
    ],
  },
  {
    id: 'c10', title: 'Rook endgames', icon: 'rook', intro: 'The most common endgame of all.',
    steps: [
      { id: 'c10-d1', kind: 'drill', drillId: 'krk', label: 'Drill: Rook mate' },
      { id: 'c10-d2', kind: 'drill', drillId: 'lucena', label: 'Drill: Lucena' },
      { id: 'c10-d3', kind: 'drill', drillId: 'philidor', label: 'Drill: Philidor' },
      game('c10-g', 'sofia'),
    ],
  },
  {
    id: 'c11', title: 'The final test', icon: 'trophy', intro: 'Everything together — against the strongest players.',
    steps: [game('c11-g1', 'viktor'), game('c11-g2', 'mei')],
  },
];

const PUZZLE_KEY = 'coursePuzzles';
const CHAPTER_KEY = 'courseChapters';

export interface CourseState {
  done: Record<string, boolean>;
  puzzles: Record<string, number>;
  chapters: Record<string, boolean>;
}

/** Works out which steps are done from what you've already played. */
export async function courseState(): Promise<CourseState> {
  const lessons = await kvGet<string[]>('lessonsDone', []);
  const drills = await kvGet<Record<string, { completed: number }>>('endgameProgress', {});
  const puzzles = await kvGet<Record<string, number>>(PUZZLE_KEY, {});
  const chapters = await kvGet<Record<string, boolean>>(CHAPTER_KEY, {});
  const games = await db.games.toArray();
  const played = new Set(games.filter((g) => g.plies.filter((p) => p.isUser).length >= 10).map((g) => g.opponentId));
  const done: Record<string, boolean> = {};
  for (const ch of CHAPTERS)
    for (const s of ch.steps) {
      done[s.id] =
        s.kind === 'lesson' ? lessons.includes(s.lessonId)
        : s.kind === 'drill' ? (drills[s.drillId]?.completed ?? 0) > 0
        : s.kind === 'game' ? played.has(s.opponentId)
        : (puzzles[s.id] ?? 0) >= s.count;
    }
  return { done, puzzles, chapters };
}

export const chapterDone = (ch: Chapter, st: CourseState) => ch.steps.every((s) => st.done[s.id]);

/** A chapter opens when the previous one is finished. */
export function chapterOpen(i: number, st: CourseState): boolean {
  return i === 0 || chapterDone(CHAPTERS[i - 1], st);
}

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
