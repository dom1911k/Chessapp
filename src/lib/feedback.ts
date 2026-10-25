// "This explanation was wrong" reports, kept on the device until you share them.
import { kvGet, kvSet, today } from './db';
import { shareJsonFile } from './backup';
import type { CoachComment } from './coach/types';

const KEY = 'coachFeedback';

export interface FeedbackItem {
  at: number;
  fen: string;
  uci: string;
  text: string[];
  ruleIds: string[];
  classification?: string;
  note?: string;
}

export async function flagExplanation(fen: string, uci: string, c: CoachComment, note?: string) {
  const list = await kvGet<FeedbackItem[]>(KEY, []);
  if (list.some((x) => x.fen === fen && x.uci === uci)) return;
  list.push({ at: Date.now(), fen, uci, text: c.text, ruleIds: c.ruleIds, classification: c.classification, note });
  await kvSet(KEY, list.slice(-200));
}

export const feedbackItems = () => kvGet<FeedbackItem[]>(KEY, []);

export async function shareFeedback() {
  const items = await feedbackItems();
  await shareJsonFile(`chess-coach-feedback-${today()}.json`, JSON.stringify({ format: 'chess-coach-feedback', items }, null, 1), 'Chess Coach feedback');
}

export const clearFeedback = () => kvSet(KEY, []);
