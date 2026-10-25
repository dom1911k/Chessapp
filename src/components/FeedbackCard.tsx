import { useEffect, useState } from 'react';
import { clearFeedback, feedbackItems, shareFeedback } from '../lib/feedback';

export function FeedbackCard() {
  const [n, setN] = useState(0);
  const refresh = () => void feedbackItems().then((x) => setN(x.length));
  useEffect(refresh, []);
  return (
    <div className="card space-y-2">
      <div className="text-sm font-semibold text-stone-500">Coach feedback</div>
      <p className="text-sm text-stone-600 dark:text-stone-300">
        {n === 0
          ? 'When an explanation looks wrong, tap "👎 This explanation seems wrong" under it. The positions are collected here.'
          : `${n} flagged explanation${n === 1 ? '' : 's'}. Share the file so the coach rules can be improved.`}
      </p>
      {n > 0 && (
        <div className="flex gap-2">
          <button className="btn-secondary flex-1" onClick={() => void shareFeedback()}>Share</button>
          <button className="btn-ghost" onClick={() => void clearFeedback().then(refresh)}>Clear</button>
        </div>
      )}
    </div>
  );
}
