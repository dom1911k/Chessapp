import { useEffect, useState } from 'react';
import { CoachBubble } from '../components/Coach';
import { PuzzlePlayer } from '../components/PuzzlePlayer';
import { Header, Spinner, useBackHandler } from '../components/ui';
import { db, today } from '../lib/db';
import { useNav } from '../lib/nav';
import { recordAttempt } from '../lib/puzzles/record';
import { weakestThemes } from '../lib/puzzles/select';
import { themeLabel } from '../lib/puzzles/themes';
import { formatDue } from '../lib/srs';
import { currentStreak } from '../lib/stats';
import { dueCount, MAX_REVIEWS, SESSION_SIZE, useDaily } from '../lib/store/daily';
import { SettingsButton } from './PlayScreen';

export function DailyScreen() {
  const d = useDaily();
  const tab = useNav((s) => s.tab);
  const stackEmpty = useNav((s) => s.stack.length === 0);
  const [inSession, setInSession] = useState(false);
  const [info, setInfo] = useState<{ due: number; streak: number; weak: string[]; doneToday: boolean; nextDue: string | null } | null>(null);

  useEffect(() => {
    if (tab !== 'daily' || inSession) return;
    void (async () => {
      const act = await db.activity.get(today());
      const next = await db.cards.orderBy('due').first();
      setInfo({
        due: await dueCount(),
        streak: await currentStreak(),
        weak: await weakestThemes(3),
        doneToday: !!act?.dailyDone,
        nextDue: next ? formatDue(next) : null,
      });
    })();
  }, [tab, inSession]);

  // A session from an earlier day is stale.
  useEffect(() => {
    if (d.day && d.day !== today()) d.reset();
  }, [d]);

  const leave = () => setInSession(false);
  useBackHandler(leave, inSession && tab === 'daily' && stackEmpty);

  const start = async () => {
    if (!d.items.length || d.index >= d.items.length) await d.build();
    setInSession(true);
  };

  if (inSession) return <Session onExit={leave} />;

  const reviewsToday = Math.min(info?.due ?? 0, MAX_REVIEWS);
  return (
    <div className="flex h-full flex-col">
      <Header title="Daily training" right={<SettingsButton />} />
      <div className="mx-auto w-full max-w-xl flex-1 space-y-4 overflow-y-auto p-4">
        <div className="card flex items-center gap-4">
          <div className="text-4xl">🔥</div>
          <div className="flex-1">
            <div className="text-2xl font-bold">{info?.streak ?? 0} day{info?.streak === 1 ? '' : 's'}</div>
            <div className="text-sm text-stone-500">training streak</div>
          </div>
          {info?.doneToday && <span className="chip bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">✓ Done today</span>}
        </div>
        <CoachBubble
          actions={
            <button className="btn-primary !px-6 !py-3 text-base" onClick={start} disabled={d.building}>
              {d.building ? <Spinner /> : d.items.length && d.index < d.items.length ? 'Continue session' : info?.doneToday ? 'Train some more' : 'Start training'}
            </button>
          }
        >
          <p className="font-semibold">Today's plan (~10–15 min)</p>
          <ul className="list-disc pl-5 text-[15px]">
            <li>
              {reviewsToday > 0 ? `${reviewsToday} review${reviewsToday === 1 ? '' : 's'} of positions you missed` : 'No reviews due'}
              {reviewsToday === 0 && info?.nextDue ? ` (next ${info.nextDue})` : ''}
            </li>
            <li>
              {Math.max(3, SESSION_SIZE - reviewsToday)} new puzzles
              {info?.weak.length ? ` on ${info.weak.map(themeLabel).join(', ').toLowerCase()}` : ''}
            </li>
          </ul>
        </CoachBubble>
        <p className="px-1 text-sm text-stone-500">
          Mistakes from your games and puzzles you miss come back after 1, 3, 7, 14 and 30 days. Get one wrong and it starts over — that's how it sticks!
        </p>
      </div>
    </div>
  );
}

function Session({ onExit }: { onExit: () => void }) {
  const d = useDaily();
  const item = d.items[d.index];
  const finished = d.index >= d.items.length;

  useEffect(() => {
    if (finished && d.items.length) {
      void (async () => {
        const day = today();
        const row = (await db.activity.get(day)) ?? { day, puzzles: 0, games: 0, reviews: 0 };
        await db.activity.put({ ...row, dailyDone: true });
      })();
    }
  }, [finished, d.items.length]);

  const solved = d.items.filter((x) => x.result).length;
  return (
    <div className="flex h-full flex-col">
      <Header
        title={finished ? 'Session complete' : `Daily · ${d.index + 1}/${d.items.length}`}
        right={<button className="btn-ghost" onClick={onExit}>Close</button>}
      />
      <div className="mx-auto mb-1 flex w-full max-w-xl gap-1 px-3">
        {d.items.map((x, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full ${x.result === true ? 'bg-emerald-500' : x.result === false ? 'bg-red-400' : i === d.index ? 'bg-stone-400' : 'bg-stone-200 dark:bg-stone-800'}`} />
        ))}
      </div>
      <div className="mx-auto w-full max-w-xl flex-1 overflow-y-auto pb-4">
        {finished ? (
          <div className="p-4">
            <CoachBubble actions={<button className="btn-primary" onClick={onExit}>Done</button>}>
              <p className="font-semibold">Great work today! 🎉</p>
              <p>You solved {solved} of {d.items.length}. The ones you missed will come back tomorrow.</p>
            </CoachBubble>
          </div>
        ) : (
          item && (
            <PuzzlePlayer
              key={d.index}
              spec={item.spec}
              onFinish={(r) => {
                d.markResult(d.index, r.success);
                void recordAttempt(item.spec, r.success, r.hintsUsed, item.source);
              }}
              onNext={d.next}
              nextLabel={d.index === d.items.length - 1 ? 'Finish' : 'Next'}
            />
          )
        )}
      </div>
    </div>
  );
}
