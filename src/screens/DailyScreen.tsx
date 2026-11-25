import { useEffect, useState } from 'react';
import { CoachBubble } from '../components/Coach';
import { PuzzlePlayer } from '../components/PuzzlePlayer';
import { Header, Spinner, useBackHandler } from '../components/ui';
import { db, today } from '../lib/db';
import { useNav } from '../lib/nav';
import { recordAttempt, type AttemptOutcome } from '../lib/puzzles/record';
import { awardPath, type PathAward } from '../lib/puzzles/path';
import { usePathTally } from '../components/path/usePathTally';
import { SkillStrip } from '../components/path/SkillStrip';
import { LiveCrest, LiveDots, LiveFlame, LivePathCard } from '../components/path/PathUI';
import { useSettings } from '../lib/settings';
import { useCelebrate } from '../lib/celebrate';
import { progress } from '../lib/progress';
import { weakestThemes } from '../lib/puzzles/select';
import { themeLabel } from '../lib/puzzles/themes';
import { formatDue } from '../lib/srs';
import { currentStreak } from '../lib/stats';
import { dueCount, gameToday, planFor, SHORT_SIZE, useDaily } from '../lib/store/daily';
import { WeeklyGoalCard } from '../components/Gamification';
import { Medallion } from '../components/Glyph';
import { lessonById } from '../lib/lessons/data';
import { dueLessonIds } from '../lib/lessons/review';

export function DailyScreen() {
  const d = useDaily();
  const onTop = useNav((s) => s.stack[s.stack.length - 1]?.name === 'daily');
  const [inSession, setInSession] = useState(false);
  const [info, setInfo] = useState<{ due: number; streak: number; weak: string[]; doneToday: boolean; nextDue: string | null; short: boolean } | null>(null);

  useEffect(() => {
    if (inSession) return;
    void (async () => {
      const act = await db.activity.get(today());
      const next = await db.cards.orderBy('due').first();
      setInfo({
        due: await dueCount(),
        streak: await currentStreak(),
        weak: await weakestThemes(3),
        doneToday: !!act?.dailyDone,
        nextDue: next ? formatDue(next) : null,
        short: await gameToday(),
      });
    })();
  }, [inSession]);

  // A session from an earlier day is stale.
  useEffect(() => {
    if (d.day && d.day !== today()) d.reset();
  }, [d]);

  const push = useNav((s) => s.push);
  const [dueLessons, setDueLessons] = useState<string[]>([]);
  useEffect(() => {
    if (onTop && !inSession) void dueLessonIds().then(setDueLessons);
  }, [onTop, inSession]);

  const leave = () => setInSession(false);
  useBackHandler(leave, inSession && onTop);

  const start = async () => {
    if (!d.items.length || d.index >= d.items.length) await d.build();
    setInSession(true);
  };

  if (inSession) return <Session onExit={leave} />;

  // After a game today, the plan is the short set (~5 min); otherwise ~10–15 min.
  const plan = planFor(!!info?.short, info?.due ?? 0);
  const reviewsToday = plan.reviews;
  return (
    <div className="flex h-full flex-col">
      <Header title="Daily training" back />
      <div className="mx-auto w-full max-w-xl flex-1 space-y-4 overflow-y-auto p-4">
        <WeeklyGoalCard />
        {dueLessons.length > 0 && (
          <div className="card !p-0">
            <div className="px-3.5 pt-3 text-[11px] font-bold tracking-[0.08em] text-stone-500 uppercase">Lesson refresh · {dueLessons.length} due</div>
            <div className="divide-y divide-stone-100 dark:divide-white/[0.06]">
              {dueLessons.slice(0, 3).map((id) => {
                const l = lessonById(id);
                if (!l) return null;
                return (
                  <button key={id} className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left press" onClick={() => push({ name: 'lesson', lessonId: id, mode: 'review' })}>
                    <Medallion name={l.icon} size={36} tint="blue" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{l.title}</span>
                      <span className="block text-xs text-stone-500">Just the questions — about two minutes</span>
                    </span>
                    <span className="text-sm font-semibold text-brand-700 dark:text-brand-500">Refresh</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {info?.doneToday && <div className="px-1 text-sm font-semibold text-brand-700 dark:text-brand-500">Today's session is done — anything more is a bonus.</div>}
        <CoachBubble
          actions={
            <button className="btn-primary !px-6 !py-3 text-base" onClick={start} disabled={d.building}>
              {d.building ? <Spinner /> : d.items.length && d.index < d.items.length ? 'Continue session' : info?.doneToday ? 'Train some more' : 'Start training'}
            </button>
          }
        >
          <p className="font-semibold" data-testid="daily-plan">Today's plan ({plan.minutes})</p>
          <ul className="list-disc pl-5 text-[15px]">
            <li>
              {reviewsToday > 0 ? `${reviewsToday} review${reviewsToday === 1 ? '' : 's'} of positions you missed` : 'No reviews due'}
              {reviewsToday === 0 && info?.nextDue ? ` (next ${info.nextDue})` : ''}
            </li>
            <li>
              {plan.fresh} new puzzle{plan.fresh === 1 ? '' : 's'}
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
  // The Puzzle Path: the same card, tally and level-up as the puzzle screen.
  const pt = usePathTally();
  const [outcome, setOutcome] = useState<AttemptOutcome | null>(null);
  const [doneAward, setDoneAward] = useState<PathAward | null>(null);
  const showRating = useSettings((st) => st.puzzleShowRating) ?? true;

  // The done card settles first: toasts (achievements from the session) queue meanwhile, then come
  // one at a time below the header.
  useEffect(() => {
    if (!finished || !d.items.length) return;
    useCelebrate.getState().setHold(true, { queue: true });
    const t = setTimeout(() => useCelebrate.getState().setHold(false), 900);
    return () => {
      clearTimeout(t);
      useCelebrate.getState().setHold(false);
    };
  }, [finished, d.items.length]);
  useEffect(() => {
    if (finished && d.items.length) {
      void (async () => {
        const day = today();
        const row = (await db.activity.get(day)) ?? { day, puzzles: 0, games: 0, reviews: 0 };
        const first = !row.dailyDone;
        await db.activity.put({ ...row, dailyDone: true });
        if (first) await progress({ kind: 'daily' });
        // Puzzle Path: finishing the session earns points once a day.
        const a = await awardPath({ event: 'dailyTrainingDone', today: day });
        if (a.total) setDoneAward(a);
      })();
    }
  }, [finished, d.items.length]);

  const solved = d.items.filter((x) => x.result).length;
  return (
    <div className="flex h-full flex-col">
      <Header
        title={finished ? 'Session complete' : `Daily · ${d.index + 1}/${d.items.length}`}
        leading={pt.path ? <LiveCrest size={32} onClick={pt.openPath} /> : undefined}
        right={
          <div className="flex items-center gap-3">
            <LiveDots />
            <LiveFlame size={20} />
            <button className="btn-ghost" onClick={onExit}>Close</button>
          </div>
        }
      />
      <div className="mx-auto mb-1 flex w-full max-w-xl gap-1 px-3">
        {d.items.map((x, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full ${x.result === true ? 'bg-brand-500' : x.result === false ? 'bg-danger-500' : i === d.index ? 'bg-stone-400' : 'bg-stone-200 dark:bg-stone-800'}`} />
        ))}
      </div>
      <div className="mx-auto w-full max-w-xl flex-1 overflow-y-auto pb-4 land:max-w-6xl">
        {finished ? (
          <div className="p-4">
            <CoachBubble
              actions={
                <>
                  {/* After the short set: 6 more, for a longer session. */}
                  {d.short && (
                    <button className="btn-primary" disabled={d.building} onClick={() => void d.more()} data-testid="daily-more">
                      {d.building ? <Spinner /> : `Keep going (${SHORT_SIZE} more)`}
                    </button>
                  )}
                  <button className={d.short ? 'btn-secondary' : 'btn-primary'} onClick={onExit}>Done</button>
                </>
              }
            >
              <p className="font-semibold">Great work today!</p>
              <p>You solved {solved} of {d.items.length}. The ones you missed will come back tomorrow.</p>
              {doneAward && (
                <p className="mt-1.5">
                  <span className="animate-reveal rounded-full bg-[#81b64c] px-2 py-0.5 text-xs font-extrabold text-white" data-testid="daily-done-points">
                    Daily training +{doneAward.total}
                  </span>
                </p>
              )}
            </CoachBubble>
          </div>
        ) : (
          item && (
            <PuzzlePlayer
              key={d.index}
              spec={item.spec}
              onFinish={async (r) => {
                d.markResult(d.index, r.success);
                pt.begin();
                const o = await recordAttempt(item.spec, r.success, r.hintsUsed, item.source, { seconds: r.seconds, correctMoves: r.correctMoves, path: item.source === 'review' ? 'review' : 'full' });
                setOutcome(o);
                await pt.show(o.path, r.success, r.square);
              }}
              onNext={() => {
                pt.reset();
                setOutcome(null);
                d.next();
              }}
              nextLabel={d.index === d.items.length - 1 ? 'Finish' : 'Next puzzle'}
              pathMode
              onBoard={pt.onBoard}
              onAgain={pt.reset}
              overlay={pt.boardOverlay}
              progress={pt.path ? <LivePathCard rating={showRating ? (outcome?.ratingAfter ?? null) : null} ratingDelta={showRating && outcome?.ratingAfter !== undefined && outcome.ratingBefore !== undefined ? outcome.ratingAfter - outcome.ratingBefore : null} onTap={pt.active ? pt.tap : undefined} extra={pt.landed ? <SkillStrip key={d.index} themes={item.spec.themes} /> : undefined} /> : undefined}
            />
          )
        )}
      </div>
      {pt.panels}
    </div>
  );
}
