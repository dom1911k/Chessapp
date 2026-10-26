// The results screen after a game, revealed step by step like the end of a level:
// result banner → stars → XP → rating → tactics → new achievements, unlocks and milestones.
import { useEffect, useState, type ReactNode } from 'react';
import { Star, TrendingUp, X } from 'lucide-react';
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

function useCountUp(from: number, to: number, run: boolean, ms = 900) {
  const [v, setV] = useState(from);
  useEffect(() => {
    if (!run) return setV(from);
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      setV(Math.round(from + (to - from) * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [from, to, run, ms]);
  return v;
}

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

export function RewardsOverlay({ r, onClose, onReport }: { r: GameRewards; onClose: () => void; onReport?: () => void }) {
  const [step, setStep] = useState(0);
  const o = opponentById(r.opponentId);
  const lvBefore = levelFor(r.xpBefore);
  const lvAfter = levelFor(r.xpAfter);
  const hasStars = !!o;
  const tactics = TACTIC_KEYS.filter((k) => r.tactics[k]);
  const extras = r.milestones.length + r.achievements.length + r.unlocks.length + r.skillsUp.length + (r.challengeOpened || r.challengeDone ? 1 : 0);
  const LAST = 6;

  useEffect(() => {
    if (step >= LAST) return;
    const delays = [500, hasStars ? 1100 : 100, 1000, 1000, tactics.length ? 900 : 100, extras ? 700 : 100];
    const t = setTimeout(() => setStep((s) => s + 1), delays[step]);
    return () => clearTimeout(t);
  }, [step, hasStars, tactics.length, extras]);

  useEffect(() => {
    if (step === 1 && r.userResult === 'win') useCelebrate.getState().confetti({ force: true });
    if (step === 2 && hasStars && r.starsAfter > r.starsBefore) playSound('reward');
    if (step === 5 && extras) {
      playSound('success');
      if (r.milestones.length || r.unlocks.length || r.challengeDone) useCelebrate.getState().confetti({ force: true });
    }
  }, [step, r, hasStars, extras]);

  const xp = useCountUp(r.xpBefore, r.xpAfter, step >= 3);
  const lv = levelFor(xp);
  const rating = useCountUp(r.ratingBefore, r.ratingAfter, step >= 4);
  const delta = r.ratingAfter - r.ratingBefore;
  const banner =
    r.userResult === 'win'
      ? { text: 'Victory!', bg: 'from-gold-300 via-gold-400 to-gold-500', sub: r.reason === 'checkmate' ? 'by checkmate' : `by ${r.reason}` }
      : r.userResult === 'draw'
        ? { text: 'Draw', bg: 'from-slate-300 via-slate-400 to-slate-500', sub: r.reason }
        : { text: 'Good fight!', bg: 'from-sky-400 via-sky-500 to-blue-600', sub: 'Every game makes you stronger' };
  const ch = challengeFor(r.opponentId);

  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/55 backdrop-blur-[2px] sm:items-center" onClick={() => setStep(LAST)}>
      <div className="safe-bottom animate-pop relative max-h-[94dvh] w-full max-w-md overflow-y-auto rounded-t-[30px] bg-[#fffdf9] px-5 pt-3 pb-5 shadow-2xl sm:rounded-[30px] dark:bg-stone-900" onClick={(e) => e.stopPropagation()}>
        <button className="absolute top-3 right-3 rounded-full p-1.5 text-stone-400" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>
        {/* Banner */}
        <div className="flex flex-col items-center pt-2">
          {o && <Portrait id={o.id} mood={r.userResult === 'win' ? 'worried' : r.userResult === 'loss' ? 'happy' : 'neutral'} size={72} />}
          <div className={`animate-banner -mt-3 rounded-2xl bg-gradient-to-r px-7 py-2 shadow-lg ${banner.bg}`}>
            <div className="font-display text-3xl leading-none font-bold text-white drop-shadow">{banner.text}</div>
          </div>
          <div className="mt-1.5 text-sm text-stone-500">
            {o ? `vs ${o.name}` : 'vs the bot'} · {banner.sub} · {r.accuracy}% accuracy
          </div>
        </div>

        {/* Stars */}
        {hasStars && (
          <Reveal show={step >= 1}>
            <div className="mt-4 flex justify-center gap-2">
              {Array.from({ length: MAX_STARS }, (_, i) => {
                const had = i < r.starsBefore;
                const fresh = !had && i < r.starsAfter;
                const lit = had || (fresh && step >= 2);
                return (
                  <Star
                    key={i}
                    size={34}
                    className={`${lit ? 'fill-gold-400 text-gold-500 drop-shadow-[0_2px_4px_rgba(180,130,10,0.45)]' : 'text-stone-300 dark:text-stone-700'} ${fresh && step >= 2 ? 'animate-star' : ''}`}
                  />
                );
              })}
            </div>
            <div className="mt-1 text-center text-xs font-semibold text-stone-500">
              {r.starsAfter >= MAX_STARS ? `All ${MAX_STARS} stars with ${o!.name}!` : `${r.starsAfter} of ${MAX_STARS} stars · ${r.userResult === 'win' ? 'a win earns a star' : 'win to earn a star'}`}
            </div>
          </Reveal>
        )}

        {/* XP and rating */}
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <Reveal show={step >= 2}>
            <div className="rounded-2xl bg-stone-100 p-3 dark:bg-stone-800">
              <div className="flex items-baseline justify-between">
                <span className="text-[10px] font-bold tracking-wider text-stone-500 uppercase">Level {lv.level}</span>
                <span className="text-sm font-bold text-amber-600">+{r.xpAfter - r.xpBefore} XP</span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700">
                <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-gold-500 transition-[width] duration-150" style={{ width: `${(lv.into / lv.span) * 100}%` }} />
              </div>
              {lvAfter.level > lvBefore.level && step >= 3 && <div className="animate-pop mt-1.5 text-xs font-bold text-amber-600">Level up! {lvAfter.title}</div>}
            </div>
          </Reveal>
          <Reveal show={step >= 3}>
            <div className="rounded-2xl bg-stone-100 p-3 dark:bg-stone-800">
              <div className="flex items-baseline justify-between">
                <span className="text-[10px] font-bold tracking-wider text-stone-500 uppercase">Rating</span>
                <span className={`flex items-center gap-0.5 text-sm font-bold ${delta >= 0 ? 'text-brand-600' : 'text-stone-500'}`}>
                  {delta >= 0 && <TrendingUp size={14} />}
                  {delta >= 0 ? '+' : ''}
                  {delta}
                </span>
              </div>
              <div className="font-display text-2xl leading-tight font-semibold">{rating}</div>
            </div>
          </Reveal>
        </div>

        {/* Tactics played */}
        {tactics.length > 0 && (
          <Reveal show={step >= 4}>
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
            <Reveal key={m.rating} show={step >= 5} delay={i * 150}>
              <RewardCard badge={`Journey · ${m.rating}`} title={m.title} text={m.line} icon={<Medallion name="map" tint="gold" size={44} />} />
            </Reveal>
          ))}
          {(r.challengeOpened || r.challengeDone) && ch && (
            <Reveal show={step >= 5} delay={100}>
              <RewardCard
                badge={r.challengeDone ? 'Challenge complete' : 'Challenge unlocked'}
                title={ch.title}
                text={r.challengeDone ? 'You did it!' : `${ch.description} Try it in your next game against ${o?.name}.`}
                icon={<Medallion name="flag" tint="gold" size={44} />}
              />
            </Reveal>
          )}
          {r.unlocks.map((c, i) => (
            <Reveal key={c.id} show={step >= 5} delay={200 + i * 150}>
              <RewardCard badge={`New ${KIND_LABEL[c.kind].one.toLowerCase()} unlocked`} title={c.name} text="Equip it in your Collection." tint="green" icon={<CosmeticPreview c={c} size={44} />} />
            </Reveal>
          ))}
          {r.achievements.map((a, i) => (
            <Reveal key={a.id} show={step >= 5} delay={300 + i * 150}>
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
              <Reveal key={s.id} show={step >= 5} delay={400 + i * 150}>
                <RewardCard badge={`Skill · ${TIERS[s.tier].name}`} title={k.name} text="Your skill tree grew!" tint="blue" icon={<Medallion name={k.icon} tint="blue" size={44} />} />
              </Reveal>
            );
          })}
        </div>

        <Reveal show={step >= LAST}>
          <div className="mt-4 flex gap-2">
            {onReport && (
              <button className="btn-secondary flex-1" onClick={onReport}>
                Game report
              </button>
            )}
            <button className="btn-primary flex-1" onClick={onClose}>
              Continue
            </button>
          </div>
        </Reveal>
        {step < LAST && <p className="mt-4 text-center text-xs text-stone-400">Tap to skip</p>}
      </div>
    </div>
  );
}
