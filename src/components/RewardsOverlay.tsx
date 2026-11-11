// The results screen after a game, revealed step by step like the end of a level:
// result banner → stars → XP → rating → tactics → new achievements, unlocks and milestones.
import { BADGES, rivalryLevel, rivalryRank } from '../lib/people/rivalry';
import { UserAvatar } from './UserAvatar';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Check, Flame, RotateCcw, Star, TrendingDown, TrendingUp, Users, X } from 'lucide-react';
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
import { Portrait } from './Coach';
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

function RewardCard({ icon, title, text, tint = 'gold', badge }: { icon: ReactNode; title: string; text?: string; tint?: 'gold' | 'green' | 'blue'; badge: string }) {
  const ring = tint === 'gold' ? 'ring-gold-400 from-[#fff6dc]' : tint === 'green' ? 'ring-brand-500 from-brand-50' : 'ring-sky-400 from-sky-50';
  return (
    <div className={`relative flex items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r to-white p-2.5 ring-2 dark:from-stone-800 dark:to-stone-900 ${ring}`}>
      <span className="animate-shine pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 bg-white/70 dark:bg-white/10" />
      {icon}
      <div className="min-w-0 flex-1 text-left">
        <div className="text-[10px] font-bold tracking-wider text-stone-500 uppercase">{badge}</div>
        <div className="leading-tight font-semibold">{title}</div>
        {text && <div className="text-xs text-stone-500">{text}</div>}
      </div>
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
  const banner =
    r.userResult === 'win'
      ? { text: 'You won!', bg: 'from-gold-300 via-gold-400 to-gold-500' }
      : r.userResult === 'draw'
        ? { text: 'Draw', bg: 'from-slate-300 via-slate-400 to-slate-500' }
        : { text: 'You lost', bg: 'from-slate-500 via-slate-600 to-slate-700' };
  const ch = challengeFor(r.opponentId);
  const shownLevel = levelUp ?? lvBefore.level;

  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/55 backdrop-blur-[2px] sm:items-center" onClick={skip}>
      <div className="safe-bottom animate-pop relative max-h-[94dvh] w-full max-w-md overflow-y-auto rounded-t-[30px] bg-[#fffdf9] px-5 pt-3 pb-5 shadow-2xl sm:rounded-[30px] dark:bg-stone-900" onClick={(e) => (e.stopPropagation(), skip())}>
        <button className="absolute top-3 right-3 z-10 rounded-full p-1.5 text-stone-400" onClick={(e) => (e.stopPropagation(), onClose())} aria-label="Close">
          <X size={20} />
        </button>
        {/* Banner: you vs them (the winner ringed in gold), the result and how it ended. */}
        <div className="flex flex-col items-center pt-2">
          <div className="flex items-center gap-3">
            <span className={`rounded-[30%] ${r.userResult === 'win' ? 'ring-[3px] ring-gold-400 ring-offset-2 ring-offset-[#fffdf9] dark:ring-offset-stone-900' : ''}`}>
              <UserAvatar size={60} className="block" />
            </span>
            <span className="text-xs font-bold tracking-widest text-stone-400 uppercase">vs</span>
            <span className={`relative rounded-[30%] ${r.userResult === 'loss' ? 'ring-[3px] ring-gold-400 ring-offset-2 ring-offset-[#fffdf9] dark:ring-offset-stone-900' : ''}`}>
              {r.firstWin && o && (
                <span className="animate-vs-stamp absolute -right-3 -bottom-2 z-10 -rotate-12 rounded-md border-2 border-red-600 bg-white/90 px-1.5 text-[11px] font-black tracking-wider text-red-600 uppercase shadow dark:bg-stone-900/90" style={{ animationDelay: '350ms' }}>
                  Beaten
                </span>
              )}
              {o ? (
                <Portrait id={o.id} mood={r.userResult === 'win' ? 'worried' : r.userResult === 'loss' ? 'happy' : 'neutral'} size={60} />
              ) : (
                <span className="flex h-[60px] w-[60px] items-center justify-center rounded-[30%] bg-stone-200 text-stone-500 dark:bg-stone-800">
                  <Users size={26} />
                </span>
              )}
            </span>
          </div>
          <div className={`animate-banner mt-3 rounded-2xl bg-gradient-to-r px-7 py-2 shadow-lg ${banner.bg}`}>
            <div className="font-display text-3xl leading-none font-bold text-white drop-shadow">{banner.text}</div>
          </div>
          <div className="mt-1.5 text-sm text-stone-500">
            {reasonText(r.reason)} · {o ? `vs ${o.name}` : 'vs the bot'}
          </div>
        </div>

        {/* Accuracy: counts up */}
        <div className="mt-4 flex items-center justify-center gap-2">
          <span className="text-[11px] font-bold tracking-wider text-stone-500 uppercase">Accuracy</span>
          <CountUp from={0} to={r.accuracy} decimals={1} suffix="%" run={step >= S.acc} instant={skipped} ms={1000} className="font-display text-[28px] leading-none font-semibold" />
        </div>

        {/* Stars: one by one */}
        {hasStars && (
          <div className={`mt-3 transition-opacity duration-300 ${step >= S.stars ? 'opacity-100' : 'opacity-0'}`}>
            <div className="flex justify-center gap-2">
              {Array.from({ length: MAX_STARS }, (_, i) => {
                const lit = i < starsLit;
                const fresh = i >= r.starsBefore && i < r.starsAfter;
                return (
                  <Star
                    key={i}
                    size={32}
                    className={`transition-colors ${lit ? 'fill-gold-400 text-gold-500 drop-shadow-[0_2px_4px_rgba(180,130,10,0.45)]' : 'text-stone-300 dark:text-stone-700'} ${lit && fresh ? 'animate-star' : ''}`}
                  />
                );
              })}
            </div>
            <div className="mt-1 text-center text-xs font-semibold text-stone-500">
              {r.starsAfter >= MAX_STARS ? `All ${MAX_STARS} stars with ${o!.name}!` : freshStars ? `+${freshStars} star · ${r.starsAfter} of ${MAX_STARS}` : `${r.starsAfter} of ${MAX_STARS} stars · ${r.userResult === 'win' ? 'a win earns a star' : 'win to earn a star'}`}
            </div>
          </div>
        )}

        {/* Rivalry: the progression with this opponent that never caps. */}
        {o && r.rivalry && (
          <div className={`mt-3 rounded-2xl bg-rose-50 p-3 transition-opacity duration-300 dark:bg-rose-500/10 ${step >= S.stars ? 'opacity-100' : 'opacity-0'}`}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[11px] font-bold tracking-[0.08em] text-rose-600 uppercase dark:text-rose-400">Rivalry with {o.name}</span>
              <span className="text-xs font-bold text-rose-600 tabular-nums dark:text-rose-400">+{r.rivalry.gained}</span>
            </div>
            <div className="mt-0.5 flex items-baseline justify-between gap-2">
              <span className="font-semibold">Level {rivalNow} · {rivalryRank(rivalNow)}</span>
              {r.rivalry.levelAfter > r.rivalry.levelBefore && rivalNow >= r.rivalry.levelAfter && <span className="animate-count-pop chip bg-rose-600 text-white">Level up · +{r.rivalry.xp} XP</span>}
            </div>
            <FillBar className="mt-1.5 h-2" fill="bg-gradient-to-r from-rose-400 to-rose-600" from={rivalryLevel(r.rivalry.pointsBefore).pos} to={rivalryLevel(r.rivalry.pointsAfter).pos} run={step >= S.stars} instant={skipped} delay={500} onWrap={(l) => setRivalNow(l)} />
            {r.rivalry.newBadges.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {r.rivalry.newBadges.map((id) => (
                  <span key={id} className="chip animate-reveal bg-rose-600 text-white"><Check size={11} strokeWidth={3.5} /> {BADGES.find((b) => b.id === id)?.label}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Rating: rolls, with the bar to the next Journey milestone */}
        <div className={`mt-4 rounded-2xl bg-stone-100 p-3.5 transition-opacity duration-300 dark:bg-white/[0.04] ${step >= S.rating ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex items-baseline gap-2">
            <span className="text-[11px] font-bold tracking-wider text-stone-500 uppercase">Rating</span>
            <CountUp from={r.ratingBefore} to={r.ratingAfter} run={step >= S.rating} instant={skipped} ms={1000} delay={150} className="font-display ml-auto text-[26px] leading-none font-semibold" />
            <span className={`flex items-center gap-0.5 rounded-full px-1.5 text-sm font-bold tabular-nums ${delta > 0 ? 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-100' : delta < 0 ? 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300' : 'text-stone-500'}`}>
              {delta > 0 ? <TrendingUp size={14} /> : delta < 0 ? <TrendingDown size={14} /> : null}
              {delta > 0 ? '+' : delta < 0 ? '−' : '±'}
              {Math.abs(delta)}
            </span>
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            <FillBar from={jb.pos} to={ja.pos} run={step >= S.rating} instant={skipped} delay={150} className="h-2.5 flex-1" fill="bg-gradient-to-r from-sky-400 to-brand-500" onWrap={() => (setMilestoneHit(true), playSound('reward'))} />
            <span className={`flex h-7 items-center rounded-full px-2 text-[11px] font-bold whitespace-nowrap ${milestoneHit ? 'animate-badge-pop bg-gold-300/50 text-stone-800 dark:text-gold-300' : 'bg-white text-stone-600 ring-1 ring-stone-200 dark:bg-white/[0.06] dark:text-stone-300 dark:ring-white/10'}`}>
              {(milestoneHit ? MILESTONES.find((m) => m.rating > r.ratingBefore && m.rating <= r.ratingAfter) : jb.next)?.rating ?? '★'}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-stone-500">
            {milestoneHit ? (
              <>
                <b className="text-stone-700 dark:text-stone-200">{MILESTONES.filter((m) => m.rating > r.ratingBefore && m.rating <= r.ratingAfter).pop()?.title ?? 'Milestone'} reached!</b>
                {ja.next ? <> Next: {ja.next.title} at {ja.next.rating}</> : null}
              </>
            ) : ja.next ? <>Next on your journey: <b className="text-stone-700 dark:text-stone-200">{ja.next.title}</b> at {ja.next.rating}</> : 'Top of the journey!'}
          </div>
        </div>

        {/* XP: fills, with a level-up pop when a level is crossed */}
        <div className={`mt-2.5 rounded-2xl bg-stone-100 p-3.5 transition-opacity duration-300 dark:bg-white/[0.04] ${step >= S.xp ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex items-baseline gap-2">
            <span key={shownLevel} className={`flex h-6 items-center rounded-full bg-gradient-to-b from-amber-300 to-amber-500 px-2 text-[11px] font-black text-amber-950 ${levelUp ? 'animate-badge-pop' : ''}`}>Level {shownLevel}</span>
            {levelUp && <span className="animate-reveal text-xs font-bold text-amber-600">Level up! {lvAfter.title}</span>}
            <CountUp from={0} to={r.xpAfter - r.xpBefore} prefix="+" suffix=" XP" run={step >= S.xp} instant={skipped} ms={900} className="ml-auto text-sm font-bold text-amber-600" />
          </div>
          <FillBar
            from={xpFrom}
            to={xpTo}
            run={step >= S.xp}
            instant={skipped}
            delay={100}
            className="mt-2.5 h-2.5"
            fill="bg-gradient-to-r from-amber-300 to-gold-500"
            onWrap={(l) => {
              setLevelUp(l);
              playSound('reward');
              useCelebrate.getState().confetti({ force: true });
            }}
          />
        </div>

        {/* Win streak */}
        {streak >= 2 && (
          <div className={`mt-2.5 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-orange-50 to-rose-50 p-3 ring-1 ring-orange-200/70 transition-opacity duration-300 dark:from-orange-500/10 dark:to-rose-500/10 dark:ring-orange-500/20 ${step >= S.streak ? 'opacity-100' : 'opacity-0'}`}>
            <span className={step >= S.streak ? 'animate-flame-pop' : ''}>
              <Flame size={28} className={`${streak >= 5 ? 'fill-rose-400 text-rose-500' : 'fill-orange-400 text-orange-500'}`} />
            </span>
            <span className="flex-1">
              <span className="block font-bold">{streak} wins in a row</span>
              <span className="block text-xs text-stone-500">{r.newBestStreak ? 'Your best streak ever!' : `Best: ${r.bestWinStreak ?? streak}`}</span>
            </span>
            {r.newBestStreak && <span className="chip bg-gold-300/50 text-stone-800 dark:text-gold-300">New best</span>}
          </div>
        )}

        {/* First win: the next opponent on the ladder unlocks */}
        {r.unlocked && opponentById(r.unlocked) && (
          <div className={`mt-2.5 flex items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-brand-50 to-sky-50 p-3 ring-1 ring-brand-500/30 transition-opacity duration-300 dark:from-brand-500/10 dark:to-sky-500/10 ${step >= S.streak ? 'opacity-100' : 'opacity-0'}`}>
            <span className={step >= S.streak ? 'animate-vs-in-right' : ''}>
              <Portrait id={r.unlocked} size={46} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-bold tracking-wider text-brand-700 uppercase dark:text-brand-500">New opponent unlocked</span>
              <span className="block font-semibold">{opponentById(r.unlocked)!.name} <span className="font-normal text-stone-500">{opponentById(r.unlocked)!.elo}</span></span>
            </span>
            {onPlayNext && (
              <button className="btn-primary !min-h-9 !px-3 !py-1.5 text-sm" onClick={(e) => (e.stopPropagation(), onPlayNext(r.unlocked!))}>
                Play
              </button>
            )}
          </div>
        )}

        {/* Tactics played */}
        {tactics.length > 0 && (
          <Reveal show={step >= S.tactics}>
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              {tactics.map((k, i) => (
                <span key={k} className="animate-pop chip bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-200" style={{ animationDelay: `${i * 90}ms` }}>
                  {r.tactics[k]}× {r.tactics[k] === 1 ? TACTIC_LABEL[k].one : TACTIC_LABEL[k].many}
                </span>
              ))}
            </div>
          </Reveal>
        )}

        {/* New things */}
        <div className="mt-3 space-y-2">
          {r.milestones.map((m, i) => (
            <Reveal key={m.rating} show={step >= S.extras} delay={i * 150}>
              <RewardCard badge={`Journey · ${m.rating}`} title={m.title} text={m.line} icon={<Medallion name="map" tint="gold" size={44} />} />
            </Reveal>
          ))}
          {(r.challengeOpened || r.challengeDone) && ch && (
            <Reveal show={step >= S.extras} delay={100}>
              <RewardCard
                badge={r.challengeDone ? 'Challenge complete' : 'Challenge unlocked'}
                title={ch.title}
                text={r.challengeDone ? 'You did it!' : `${ch.description} Try it in your next game against ${o?.name}.`}
                icon={<Medallion name="flag" tint="gold" size={44} />}
              />
            </Reveal>
          )}
          {r.unlocks.map((c, i) => (
            <Reveal key={c.id} show={step >= S.extras} delay={200 + i * 150}>
              <RewardCard badge={`New ${KIND_LABEL[c.kind].one.toLowerCase()} unlocked`} title={c.name} text="Equip it in your Collection." tint="green" icon={<CosmeticPreview c={c} size={44} />} />
            </Reveal>
          ))}
          {r.achievements.map((a, i) => (
            <Reveal key={a.id} show={step >= S.extras} delay={300 + i * 150}>
              <RewardCard
                badge="Achievement"
                title={a.title}
                text={a.description}
                icon={a.portrait ? <Portrait id={a.portrait} size={44} /> : <Medallion name={a.icon} tint="gold" size={44} />}
              />
            </Reveal>
          ))}
          {r.skillsUp.map((s, i) => {
            const k = SKILLS.find((x) => x.id === s.id)!;
            return (
              <Reveal key={s.id} show={step >= S.extras} delay={400 + i * 150}>
                <RewardCard badge={`Skill · ${TIERS[s.tier].name}`} title={k.name} text="Your skill tree grew!" tint="blue" icon={<Medallion name={k.icon} tint="blue" size={44} />} />
              </Reveal>
            );
          })}
        </div>

        <Reveal show={step >= S.actions}>
          <div className="mt-5 space-y-2">
            {onReport ? (
              <button className="btn-primary w-full !py-3.5 text-base" onClick={onReport}>
                Game Review
              </button>
            ) : (
              <button className="btn-primary w-full !py-3.5 text-base" onClick={onClose}>
                Continue
              </button>
            )}
            <div className="grid grid-cols-3 gap-2">
              {onRematch && (
                <button className="btn-secondary !px-2" onClick={onRematch}>
                  <RotateCcw size={16} /> Rematch
                </button>
              )}
              {onNewOpponent && (
                <button className="btn-secondary !px-2" onClick={onNewOpponent}>
                  New bot
                </button>
              )}
              <button className="btn-secondary !px-2" onClick={onClose}>
                View board
              </button>
            </div>
          </div>
        </Reveal>
        {step < S.actions && <p className="mt-4 text-center text-xs text-stone-400">Tap to skip</p>}
      </div>
    </div>
  );
}
