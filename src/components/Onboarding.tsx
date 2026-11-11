// The welcome shown once on a fresh install: meet the coach, pick your avatar, say how much
// chess you know and how often you want to train — then start in the right place.
import { useState } from 'react';
import { BookOpen, Check, ChevronLeft, Puzzle, Swords } from 'lucide-react';
import { AVATARS } from '../lib/avatars';
import { START_KEY } from '../lib/course';
import { kvSet } from '../lib/db';
import { useNav } from '../lib/nav';
import { EXPERIENCE, GOAL_CHOICES, finishOnboarding, startPlan, type Experience } from '../lib/onboarding';
import { opponentById } from '../lib/people';
import { GOAL_KEY } from '../lib/progress/weekly';
import { useSettings } from '../lib/settings';
import { playSound } from '../lib/sound';
import { Portrait } from './Coach';
import { AvatarImg } from './UserAvatar';

const STEPS = 5;

export function Onboarding({ onDone }: { onDone: () => void }) {
  const settings = useSettings();
  const [step, setStep] = useState(0);
  const [exp, setExp] = useState<Experience>('rules');
  const [goal, setGoal] = useState(4);
  const plan = startPlan(exp);
  const opp = opponentById(plan.opponentId);

  const close = async (go: boolean) => {
    settings.set({ opponentId: plan.opponentId });
    await kvSet(GOAL_KEY, goal);
    await kvSet(START_KEY, 0);
    // A complete beginner does not need the "find your level" prompt.
    if (exp === 'new') await kvSet('placementDone', true);
    await finishOnboarding();
    const nav = useNav.getState();
    if (go && plan.first === 'lesson') {
      nav.setTab('learn');
      nav.push({ name: 'lesson', lessonId: 'checkmate' });
    } else if (go && plan.first === 'placement') {
      nav.setTab('learn');
      nav.push({ name: 'placement' });
    } else nav.setTab('play');
    playSound('success');
    onDone();
  };
  const next = () => setStep((s) => Math.min(STEPS - 1, s + 1));

  return (
    <div className="animate-fade-in fixed inset-0 z-[60] flex flex-col bg-stone-100 dark:bg-stone-950">
      <div className="safe-top mx-auto flex w-full max-w-md items-center gap-2 px-3 pt-2">
        <button className={`flex h-10 w-10 items-center justify-center rounded-full text-stone-600 active:bg-stone-200 dark:text-stone-300 dark:active:bg-stone-800 ${step === 0 ? 'invisible' : ''}`} aria-label="Back" onClick={() => setStep(step - 1)}>
          <ChevronLeft size={24} />
        </button>
        <div className="flex flex-1 gap-1.5">
          {Array.from({ length: STEPS }, (_, k) => (
            <span key={k} className={`h-1.5 flex-1 rounded-full transition-colors ${k <= step ? 'bg-brand-500' : 'bg-stone-300 dark:bg-stone-800'}`} />
          ))}
        </div>
        <button className="px-2 py-2 text-sm font-semibold text-stone-500" onClick={() => void close(false)}>Skip</button>
      </div>

      <div key={step} className="animate-pop mx-auto flex w-full max-w-md flex-1 flex-col overflow-y-auto px-6 pt-6 pb-4">
        {step === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <Portrait id="coach" mood="happy" size={132} className="shadow-[0_18px_40px_-16px_rgba(27,90,60,0.6)]" />
            <h1 className="mt-5 font-display text-[30px] leading-tight font-semibold">Hi, I’m Coach Sam</h1>
            <p className="mt-2 text-stone-600 dark:text-stone-300">I’ll help you get better at chess — a little every day, at your own pace.</p>
            <div className="mt-6 w-full space-y-2.5 text-left">
              {[
                [<Swords size={19} key="a" />, 'Play opponents who make human mistakes', 'Nine characters from 400 to 2000, with a coach at your side.'],
                [<BookOpen size={19} key="b" />, 'Follow a course, level by level', 'From the first checkmate to about 1800.'],
                [<Puzzle size={19} key="c" />, 'Train with 100,000 puzzles', 'And with the mistakes from your own games.'],
              ].map(([icon, t, s], k) => (
                <div key={k} className="card flex items-center gap-3 !p-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[32%] bg-brand-100 text-brand-700 dark:bg-brand-700/25 dark:text-brand-100">{icon}</span>
                  <span className="min-w-0">
                    <span className="block font-semibold leading-tight">{t}</span>
                    <span className="mt-0.5 block text-xs text-stone-500">{s}</span>
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-stone-400">Everything works offline, and your data stays on your phone.</p>
          </div>
        )}
        {step === 1 && (
          <>
            <h1 className="font-display text-[26px] leading-tight font-semibold">Choose your picture</h1>
            <p className="mt-1 text-stone-600 dark:text-stone-300">This is you in games and on your profile. You can change it any time.</p>
            <div className="mt-5 grid grid-cols-4 gap-3">
              {AVATARS.map((a) => (
                <button key={a.id} aria-label={`Avatar ${a.id}`} aria-pressed={settings.avatar === a.id} className={`justify-self-center rounded-[30%] transition-transform active:scale-95 ${settings.avatar === a.id ? 'ring-[3px] ring-brand-600 ring-offset-2 ring-offset-stone-100 dark:ring-offset-stone-950' : ''}`} onClick={() => settings.set({ avatar: a.id })}>
                  <AvatarImg id={a.id} size={70} />
                </button>
              ))}
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <h1 className="font-display text-[26px] leading-tight font-semibold">How much chess do you know?</h1>
            <p className="mt-1 text-stone-600 dark:text-stone-300">So I can start you in the right place.</p>
            <div className="mt-5 space-y-3">
              {EXPERIENCE.map((e) => {
                const on = exp === e.id;
                return (
                  <button key={e.id} aria-pressed={on} className={`card tile flex w-full items-center gap-3 !p-4 text-left ${on ? '!ring-2 !ring-brand-500' : ''}`} onClick={() => setExp(e.id)}>
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${on ? 'bg-brand-600 text-white' : 'ring-2 ring-stone-300 dark:ring-stone-600'}`}>{on && <Check size={14} strokeWidth={3.5} />}</span>
                    <span>
                      <span className="block text-[17px] font-semibold leading-tight">{e.title}</span>
                      <span className="mt-0.5 block text-sm text-stone-500">{e.sub}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <h1 className="font-display text-[26px] leading-tight font-semibold">How often do you want to train?</h1>
            <p className="mt-1 text-stone-600 dark:text-stone-300">A day counts when you play a game, solve a puzzle or finish a lesson. Rest days never reset anything.</p>
            <div className="mt-6 flex justify-between gap-2">
              {GOAL_CHOICES.map((n) => (
                <button key={n} aria-pressed={goal === n} className={`flex h-16 flex-1 flex-col items-center justify-center rounded-2xl transition active:scale-95 ${goal === n ? 'bg-brand-600 text-white shadow-[0_8px_18px_-8px_rgba(27,90,60,0.8)]' : 'bg-white ring-1 ring-stone-200 dark:bg-white/5 dark:ring-white/10'}`} onClick={() => setGoal(n)}>
                  <span className="font-display text-2xl leading-none font-semibold">{n}</span>
                  <span className={`mt-1 text-[10px] font-semibold ${goal === n ? 'text-white/80' : 'text-stone-500'}`}>{n === 7 ? 'every day' : 'days'}</span>
                </button>
              ))}
            </div>
            <p className="mt-4 text-center text-sm text-stone-500">{goal <= 3 ? 'A steady pace. Small and regular beats big and rare.' : goal <= 5 ? 'A solid habit — you will notice the difference within weeks.' : 'Every day! Even ten minutes counts.'} · {goal} days a week</p>
          </>
        )}
        {step === 4 && (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <div className="flex items-center gap-3">
              <AvatarImg id={settings.avatar} size={84} />
              {plan.first === 'game' && opp && (
                <>
                  <span className="text-xs font-bold tracking-widest text-stone-400 uppercase">vs</span>
                  <Portrait id={opp.id} size={84} mood="happy" />
                </>
              )}
            </div>
            <h1 className="mt-5 font-display text-[28px] leading-tight font-semibold">You’re all set</h1>
            <p className="mt-2 text-stone-600 dark:text-stone-300">{plan.line}</p>
          </div>
        )}
      </div>

      <div className="safe-bottom mx-auto w-full max-w-md px-6 pt-1 pb-4">
        {step < STEPS - 1 ? (
          <button className="btn-primary w-full !rounded-[18px] !py-4 font-display text-lg" onClick={next}>{step === 0 ? 'Let’s go' : 'Continue'}</button>
        ) : (
          <>
            <button className="btn-primary w-full !rounded-[18px] !py-4 font-display text-lg" onClick={() => void close(true)}>{plan.cta}</button>
            <button className="mt-2 w-full py-2 text-sm font-semibold text-stone-500" onClick={() => void close(false)}>Look around first</button>
          </>
        )}
      </div>
    </div>
  );
}
