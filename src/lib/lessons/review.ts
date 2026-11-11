// Lessons come back for a quick refresh just before you would forget them: after 2 days, then
// 5, 12, 30 and 60. A refresh shows only the lesson's questions and exercises.
import { kvGet, kvSet, today } from '../db';
import type { Lesson } from './data';

export const REVIEW_KEY = 'lessonReview';
export const INTERVALS = [2, 5, 12, 30, 60];

export interface LessonReview {
  /** Day (YYYY-MM-DD) the refresh is due. */
  due: string;
  /** Index into INTERVALS of the gap that led to `due`. */
  step: number;
}
export type ReviewBook = Record<string, LessonReview>;

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Book after finishing a lesson for the first time (no change if it is already scheduled). */
export function schedule(book: ReviewBook, lessonId: string, day: string): ReviewBook {
  return book[lessonId] ? book : { ...book, [lessonId]: { due: addDays(day, INTERVALS[0]), step: 0 } };
}

/** Book after a refresh: a clean run moves to the next gap, a shaky one repeats the first gap. */
export function reviewed(book: ReviewBook, lessonId: string, day: string, clean: boolean): ReviewBook {
  const cur = book[lessonId];
  const step = clean ? Math.min((cur?.step ?? -1) + 1, INTERVALS.length - 1) : 0;
  return { ...book, [lessonId]: { due: addDays(day, INTERVALS[step]), step } };
}

/** Lessons due on `day`, most overdue first. */
export function dueLessons(book: ReviewBook, day: string): string[] {
  return Object.entries(book)
    .filter(([, r]) => r.due <= day)
    .sort((a, b) => a[1].due.localeCompare(b[1].due))
    .map(([id]) => id);
}

/** The steps shown in a refresh: questions and exercises only (the whole lesson if it has none). */
export function refreshSteps(lesson: Lesson) {
  const active = lesson.steps.filter((s) => s.task || s.quiz);
  return active.length ? active : lesson.steps;
}

export const getReviewBook = () => kvGet<ReviewBook>(REVIEW_KEY, {});
export async function scheduleLesson(lessonId: string) {
  await kvSet(REVIEW_KEY, schedule(await getReviewBook(), lessonId, today()));
}
export async function markReviewed(lessonId: string, clean: boolean) {
  await kvSet(REVIEW_KEY, reviewed(await getReviewBook(), lessonId, today(), clean));
}
export const dueLessonIds = async () => dueLessons(await getReviewBook(), today());
