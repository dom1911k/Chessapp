// The results screen after a game, revealed step by step like the end of a level:
// result banner → stars → XP → rating → tactics → new achievements, unlocks and milestones.
import { BADGES, rivalryLevel, rivalryRank } from '../lib/people/rivalry';
import { UserAvatar } from './UserAvatar';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Check, Crown, Flame, RotateCcw, Star, Users, X } from 'lucide-react';
import { CountUp, FillBar, useSequence } from './Reward';
import { MILESTONES, START_RATING, type Milestone } from '../lib/rewards/rating';
import { useCelebrate } from '../lib/celebrate';
import { opponentById } from '../lib/people';
import { challengeFor } from '../lib/people/challenges';
import { MAX_STARS } from '../lib/people/record';
import { levelFor } from '../lib/progress/xp';
import { TACTIC_KEYS, TACTIC_LABEL } from '../lib/rewards/career';
import { KIND_LABEL } from '../lib/rewards/cosmetics';
import { SKILLS, TIERS } from '../lib/rewards/skills';
import { playSound } from '../lib/sound';
import type { GameRewards } from '../lib/store/finish';
import { CoachAvatar, Portrait } from './Coach';
import { CosmeticPreview } from './CosmeticPreview';
import { Medallion } from './Glyph';

function Reveal({ show, children, delay = 0 }: { show: boolean; children: ReactNode; delay?: number }) {
  if (!show) return null;
  return (
    <div className="animate-reveal" style={{ animationDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/** One compact 48px reward row: icon, title, a short progress bar or a line, and a "New!" chip. */
function RewardRow({ icon, title, sub, bar, right }: { icon: ReactNode; title: ReactNode; sub?: ReactNode; bar?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex min-h-12 items-center gap-3 py-1.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center">{icon}</span>
      <div className="min-w-0 flex-1 text-left leading-tight">
        <div className="truncate text-[14px] font-bold">{title}</div>
        {sub && <div className="truncate text-[12px] font-medium text-stone-500">{sub}</div>}
        {bar}
      </div>
      {right}
    </div>
  );
}

const NEW = <span className="chip shrink-0 bg-brand-500 text-white">New!</span>;

/** A tile of the stat strip: the value 18/800 over an 11/600 label. */
function Stat({ value, label, show }: { value: ReactNode; label: ReactNode; show: boolean }) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-[8px] bg-stone-100 px-1 py-2 transition-opacity duration-300 dark:bg-stone-800 ${show ? 'opacity-100' : 'opacity-0'}`}>
      <div className="text-[18px] leading-none font-extrabold tabular-nums">{value}</div>
      <div className="mt-1 text-[11px] font-semibold text-stone-500">{label}</div>
    </div>
  );
}

/** "by checkmate", "on time", "by resignation"… */
export function reasonText(reason: string): string {
  if (reason === 'time') return 'on time';
  if (reason === 'time vs insufficient material') return 'timeout vs insufficient material';
  return `by ${reason}`;
}

/** Where a rating sits on the Journey: index of the stretch it's in + how far along (2.4 = 40% into the third). */
function journeyPos(rating: number): { pos: number; next?: Milestone; prev: number } {
  const marks = [START_RATING, ...MILESTONES.map((m) => m.rating)];
  for (let i = 0; i < marks.length - 1; i++) {
    if (rating < marks[i + 1]) return { pos: i + Math.max(0, (rating - marks[i]) / (marks[i + 1] - marks[i])), next: MILESTONES[i], prev: marks[i] };
  }
  return { pos: marks.length - 1, prev: marks[marks.length - 1] };
}

export function RewardsOverlay({ r, onClose, onReport, onRematch, onNewOpponent, onPlayNext }: { r: GameRewards; onClose: () => void; onReport?: () => void; onRematch?: () => void; onNewOpponent?: () => void; onPlayNext?: (id: string) => void }) {
  const o = opponentById(r.opponentId);
  const lvBefore = levelFor(r.xpBefore);
  const lvAfter = levelFor(r.xpAfter);
  // Once all five stars are in, the rivalry carries the progression.
  const hasStars = !!o && r.starsBefore < MAX_STARS;
  const tactics = TACTIC_KEYS.filter((k) => r.tactics[k]);
  const extras = r.milestones.length + r.achievements.length + r.unlocks.length + r.skillsUp.length + (r.challengeOpened || r.challengeDone ? 1 : 0);
  const streak = r.winStreak ?? 0;
  // One beat at a time: banner → accuracy → stars → rating → XP → streak → tactics → new things → actions.
  const S = { acc: 1, stars: 2, rating: 3, xp: 4, streak: 5, tactics: 6, extras: 7, actions: 8 };
  const delays = useMemo(
    () => [450, 1000, hasStars ? 1000 : 60, 1300, lvAfter.level > lvBefore.level ? 2000 : 1300, streak >= 2 || r.unlocked ? 900 : 60, tactics.length ? 800 : 60, extras ? 700 : 60],
    [hasStars, lvAfter.level, lvBefore.level, streak, tactics.length, extras],
  );
  const { step, skip, skipped } = useSequence(delays);
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const [milestoneHit, setMilestoneHit] = useState(false);

  useEffect(() => {
    if (step === S.acc && r.userResult === 'win') useCelebrate.getState().confetti({ force: true });
    if (step === S.extras && extras) {
      playSound('success');
      if (r.milestones.length || r.unlocks.length || r.challengeDone) useCelebrate.getState().confetti({ force: true });
    }
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stars light up one by one, each with a little chime.
  const freshStars = Math.max(0, r.starsAfter - r.starsBefore);
  const [starsLit, setStarsLit] = useState(r.starsBefore);
  const [rivalNow, setRivalNow] = useState(skipped ? (r.rivalry?.levelAfter ?? 1) : (r.rivalry?.levelBefore ?? 1));
  useEffect(() => { if (skipped && r.rivalry) setRivalNow(r.rivalry.levelAfter); }, [skipped, r.rivalry]);
  useEffect(() => {
    if (!hasStars) return;
    if (skipped) return setStarsLit(r.starsAfter);
    if (step < S.stars || starsLit >= r.starsAfter) return;
    const t = setTimeout(() => {
      setStarsLit((n) => n + 1);
      playSound('reward');
    }, starsLit === r.starsBefore ? 150 : 280);
    return () => clearTimeout(t);
  }, [step, starsLit, skipped]); // eslint-disable-line react-hooks/exhaustive-deps

  const delta = r.ratingAfter - r.ratingBefore;
  const jb = journeyPos(r.ratingBefore);
  const ja = journeyPos(r.ratingAfter);
  const xpFrom = lvBefore.level + lvBefore.into / lvBefore.span;
  const xpTo = lvAfter.level + lvAfter.into / lvAfter.span;
  const ch = challengeFor(r.opponentId);
  const shownLevel = levelUp ?? lvBefore.level;

  const ring = (won: boolean | null) => (won ? 'ring-2 ring-[#81b64c] ring-offset-2 ring-offset-white dark:ring-offset-stone-900' : won === false ? 'grayscale-[0.5] opacity-80' : '');
  const meWon = r.userResult === 'win' ? true : r.userResult === 'loss' ? false : null;
  const theyWon = meWon === null ? null : !meWon;
  const crown = <span className="absolute -top-2 -right-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-[#81b64c] text-white shadow"><Crown size={12} strokeWidth={2.6} /></span>;
  const reached = MILESTONES.filter((m) => m.rating > r.ratingBefore && m.rating <= r.ratingAfter).pop();
  const nRows = 3 + (streak >= 2 ? 1 : 0);

  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div
        className="safe-bottom animate-pop relative flex w-full max-w-md flex-col overflow-hidden rounded-t-[14px] bg-white shadow-2xl sm:rounded-[14px] dark:bg-stone-900"
        style={{ maxHeight: 'min(88dvh, 720px)' }}
        onClick={(e) => (e.stopPropagation(), skip())}
        data-testid="results-sheet"
      >
        <button className="absolute top-1.5 right-1.5 z-20 rounded-full p-1.5 text-stone-500 active:bg-stone-100 dark:active:bg-stone-800" onClick={(e) => (e.stopPropagation(), onClose())} aria-label="Close">
          <X size={18} />
        </button>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-5 pb-3">
          {/* Header: the result between the two players; the winner ringed in green with a crown. */}
          <div className="flex items-center justify-between gap-3 px-7">
            <span className={`relative rounded-md ${ring(meWon)}`}>
              {meWon && crown}
              <UserAvatar size={56} className="block" />
            </span>
            <div className="min-w-0 flex-1 text-center">
              <div className="animate-banner text-[26px] leading-tight font-extrabold tracking-[-0.02em]">{r.userResult === 'win' ? 'You won' : r.userResult === 'draw' ? 'Draw' : 'You lost'}</div>
              <div className="mt-0.5 text-[13px] font-medium text-stone-500">
                {reasonText(r.reason)} · {o ? `vs ${o.name}` : 'vs the bot'}
              </div>
            </div>
            <span className={`relative rounded-md ${ring(theyWon)}`}>
              {theyWon && crown}
              {r.firstWin && o && (
                <span className="animate-vs-stamp absolute -right-3 -bottom-2 z-10 -rotate-12 rounded-md border-2 border-red-600 bg-white/90 px-1.5 text-[11px] font-black tracking-wider text-red-600 uppercase shadow dark:bg-stone-900/90" style={{ animationDelay: '350ms' }}>
                  Beaten
                </span>
              )}
              {o ? (
                <Portrait id={o.id} mood={r.userResult === 'win' ? 'worried' : r.userResult === 'loss' ? 'happy' : 'neutral'} size={56} />
              ) : (
                <span className="flex h-14 w-14 items-center justify-center rounded-md bg-stone-200 text-stone-500 dark:bg-stone-800">
                  <Users size={24} />
                </span>
              )}
            </span>
          </div>

          {/* One stat strip: rating ±, accuracy, stars, XP. */}
          <div className={`mt-4 grid gap-2 ${hasStars ? 'grid-cols-4' : 'grid-cols-3'}`}>
            <Stat
              show={step >= S.acc}
              value={<CountUp from={r.ratingBefore} to={r.ratingAfter} run={step >= S.rating} instant={skipped} ms={1000} delay={150} />}
              label={
                <span className="flex items-center gap-1">
                  Rating
                  <span className={`font-bold tabular-nums ${delta > 0 ? 'text-brand-700 dark:text-brand-500' : delta < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                    {delta > 0 ? '+' : delta < 0 ? '−' : '±'}
                    {Math.abs(delta)}
                  </span>
                </span>
              }
            />
            <Stat show={step >= S.acc} value={<CountUp from={0} to={r.accuracy} decimals={1} suffix="%" run={step >= S.acc} instant={skipped} ms={1000} />} label="Accuracy" />
            {hasStars && (
              <Stat
                show={step >= S.stars}
                value={
                  <span className="flex items-center justify-center gap-1">
                    <Star size={16} className={`fill-[#f7c631] text-[#e0a800] ${freshStars && starsLit > r.starsBefore ? 'animate-star' : ''}`} key={starsLit} />
                    {starsLit}/{MAX_STARS}
                  </span>
                }
                label={freshStars ? `+${freshStars} star` : 'Stars'}
              />
            )}
            <Stat show={step >= S.xp} value={<CountUp from={0} to={r.xpAfter - r.xpBefore} prefix="+" run={step >= S.xp} instant={skipped} ms={900} />} label="XP" />
          </div>

          {/* Compact rows, one after another. */}
          <div className="mt-3 divide-y divide-black/5 dark:divide-white/[0.06]">
            {o && r.rivalry && (
              <div className={`transition-opacity duration-300 ${step >= S.stars ? 'opacity-100' : 'opacity-0'}`}>
                <RewardRow
                  icon={<span className="flex h-8 w-8 flex-col items-center justify-center rounded-md bg-rose-600 text-white"><span className="text-[8px] leading-none font-bold uppercase">Lv</span><span className="text-[13px] leading-none font-extrabold tabular-nums">{rivalNow}</span></span>}
                  title={<>Rivalry with {o.name} · {rivalryRank(rivalNow)}</>}
                  bar={<FillBar className="mt-1 h-1.5" fill="bg-rose-500" from={rivalryLevel(r.rivalry.pointsBefore).pos} to={rivalryLevel(r.rivalry.pointsAfter).pos} run={step >= S.stars} instant={skipped} delay={500} onWrap={(l) => setRivalNow(l)} />}
                  right={r.rivalry.levelAfter > r.rivalry.levelBefore && rivalNow >= r.rivalry.levelAfter ? <span className="animate-count-pop chip shrink-0 bg-rose-600 text-white">Level up · +{r.rivalry.xp} XP</span> : <span className="shrink-0 text-xs font-bold text-rose-600 tabular-nums dark:text-rose-400">+{r.rivalry.gained}</span>}
                />
              </div>
            )}
            {o && r.rivalry?.newBadges.map((id) => (
              <Reveal key={id} show={step >= S.stars} delay={700}>
                <RewardRow icon={<span className="flex h-8 w-8 items-center justify-center rounded-md bg-rose-600 text-white"><Check size={16} strokeWidth={3} /></span>} title={BADGES.find((b) => b.id === id)?.label ?? 'Badge'} sub={`Rivalry badge with ${o.name}`} right={NEW} />
              </Reveal>
            ))}
            <div className={`transition-opacity duration-300 ${step >= S.rating ? 'opacity-100' : 'opacity-0'}`}>
              <RewardRow
                icon={<Medallion name="map" tint="blue" size={32} />}
                title={milestoneHit && reached ? <>{reached.title} reached!</> : ja.next ? <>Next: {ja.next.title} at {ja.next.rating}</> : 'Top of the journey!'}
                bar={<FillBar from={jb.pos} to={ja.pos} run={step >= S.rating} instant={skipped} delay={150} className="mt-1 h-1.5" fill="bg-sky-500" onWrap={() => (setMilestoneHit(true), playSound('reward'))} />}
                right={milestoneHit ? NEW : undefined}
              />
            </div>
            <div className={`transition-opacity duration-300 ${step >= S.xp ? 'opacity-100' : 'opacity-0'}`}>
              <RewardRow
                icon={<span key={shownLevel} className={`flex h-8 w-8 items-center justify-center rounded-md bg-[#f7c045] text-[13px] font-extrabold text-[#3a2a00] ${levelUp ? 'animate-badge-pop' : ''}`}>{shownLevel}</span>}
                title={levelUp ? <>Level up! {lvAfter.title}</> : <>Level {shownLevel} · {lvBefore.title}</>}
                bar={
                  <FillBar
                    from={xpFrom}
                    to={xpTo}
                    run={step >= S.xp}
                    instant={skipped}
                    delay={100}
                    className="mt-1 h-1.5"
                    fill="bg-[#f7c045]"
                    onWrap={(l) => {
                      setLevelUp(l);
                      playSound('reward');
                      useCelebrate.getState().confetti({ force: true });
                    }}
                  />
                }
                right={levelUp ? NEW : undefined}
              />
            </div>
            {streak >= 2 && (
              <div className={`transition-opacity duration-300 ${step >= S.streak ? 'opacity-100' : 'opacity-0'}`}>
                <RewardRow
                  icon={<span className={step >= S.streak ? 'animate-flame-pop' : ''}><Flame size={26} className={streak >= 5 ? 'fill-rose-400 text-rose-500' : 'fill-orange-400 text-orange-500'} /></span>}
                  title={`${streak} wins in a row`}
                  sub={r.newBestStreak ? 'Your best streak ever!' : `Best: ${r.bestWinStreak ?? streak}`}
                  right={r.newBestStreak ? <span className="chip shrink-0 bg-[#f7c045] text-[#3a2a00]">New best</span> : undefined}
                />
              </div>
            )}
            {r.unlocked && opponentById(r.unlocked) && (
              <div className={`transition-opacity duration-300 ${step >= S.streak ? 'opacity-100' : 'opacity-0'}`}>
                <RewardRow
                  icon={<Portrait id={r.unlocked} size={32} />}
                  title={<>New opponent: {opponentById(r.unlocked)!.name}</>}
                  sub={`Rating ${opponentById(r.unlocked)!.elo}`}
                  right={onPlayNext ? <button className="btn-primary !mb-[3px] !min-h-8 shrink-0 !px-3 !py-1 text-sm" onClick={(e) => (e.stopPropagation(), onPlayNext(r.unlocked!))}>Play</button> : NEW}
                />
              </div>
            )}
            {tactics.length > 0 && (
              <Reveal show={step >= S.tactics}>
                <RewardRow
                  icon={<Medallion name="zap" tint="gold" size={32} />}
                  title="Tactics you played"
                  sub={tactics.map((k) => `${r.tactics[k]}× ${r.tactics[k] === 1 ? TACTIC_LABEL[k].one : TACTIC_LABEL[k].many}`).join(' · ')}
                />
              </Reveal>
            )}
            {r.milestones.map((m, i) => (
              <Reveal key={m.rating} show={step >= S.extras} delay={i * 150}>
                <RewardRow icon={<Medallion name="map" tint="gold" size={32} />} title={m.title} sub={`Journey · ${m.rating} · ${m.line}`} right={NEW} />
              </Reveal>
            ))}
            {(r.challengeOpened || r.challengeDone) && ch && (
              <Reveal show={step >= S.extras} delay={100}>
                <RewardRow
                  icon={<Medallion name="flag" tint="gold" size={32} />}
                  title={<>{r.challengeDone ? 'Challenge complete' : 'Challenge unlocked'}: {ch.title}</>}
                  sub={r.challengeDone ? 'You did it!' : `${ch.description} Try it next game against ${o?.name}.`}
                  right={NEW}
                />
              </Reveal>
            )}
            {r.unlocks.map((c, i) => (
              <Reveal key={c.id} show={step >= S.extras} delay={200 + i * 150}>
                <RewardRow icon={<CosmeticPreview c={c} size={32} />} title={c.name} sub={`New ${KIND_LABEL[c.kind].one.toLowerCase()} · equip it in your Collection`} right={NEW} />
              </Reveal>
            ))}
            {r.achievements.map((a, i) => (
              <Reveal key={a.id} show={step >= S.extras} delay={300 + i * 150}>
                <RewardRow icon={a.portrait ? <Portrait id={a.portrait} size={32} /> : <Medallion name={a.icon} tint="gold" size={32} />} title={a.title} sub={`Achievement · ${a.description}`} right={NEW} />
              </Reveal>
            ))}
            {r.skillsUp.map((sk, i) => {
              const k = SKILLS.find((x) => x.id === sk.id)!;
              return (
                <Reveal key={sk.id} show={step >= S.extras} delay={400 + i * 150}>
                  <RewardRow icon={<Medallion name={k.icon} tint="blue" size={32} />} title={k.name} sub={`Skill · ${TIERS[sk.tier].name} — your skill tree grew`} right={NEW} />
                </Reveal>
              );
            })}
          </div>
          {step < S.actions && nRows > 0 && <p className="mt-2 text-center text-xs text-stone-400">Tap to skip</p>}
        </div>

        {/* Actions: always visible; the sheet scrolls above them. */}
        <div className="shrink-0 space-y-2 border-t border-black/[0.06] px-4 pt-3 pb-3 dark:border-white/[0.06]">
          {onReport ? (
            <button className="btn-primary !min-h-14 w-full text-[17px] !font-extrabold" onClick={onReport}>
              <CoachAvatar size={26} /> Game Review
            </button>
          ) : (
            <button className="btn-primary !min-h-14 w-full text-[17px] !font-extrabold" onClick={onClose}>
              Continue
            </button>
          )}
          {(onRematch || onNewOpponent) && (
            <div className="grid grid-cols-2 gap-2">
              {onRematch && (
                <button className="btn-secondary" onClick={onRematch}>
                  <RotateCcw size={16} /> Rematch
                </button>
              )}
              {onNewOpponent && (
                <button className="btn-secondary" onClick={onNewOpponent}>
                  <Users size={16} /> New bot
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
