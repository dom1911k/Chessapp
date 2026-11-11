// A model game, played through move by move with the coach's notes. At the key moments you
// guess the hero's move first; your hits are scored in stars.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Lightbulb, Star } from 'lucide-react';
import { Board } from '../components/Board';
import { CoachBubble } from '../components/Coach';
import { Header } from '../components/ui';
import type { MoveInput } from '../lib/chess/game';
import { kvGet, kvSet } from '../lib/db';
import { MODEL_DONE_KEY, guessStars, modelGameById, modelPlies } from '../lib/lessons/games';
import { useNav } from '../lib/nav';
import { progress } from '../lib/progress';
import { playSound } from '../lib/sound';
import { Rich } from './LessonScreen';
import { Dock, DockButton, DockMain } from '../components/Dock';

const label = (n: number, san: string) => `${Math.ceil(n / 2)}${n % 2 ? '.' : '…'} ${san}`;

export function ModelGameScreen({ gameId }: { gameId: string }) {
  const g = modelGameById(gameId)!;
  const plies = useMemo(() => modelPlies(g), [g]);
  const pop = useNav((s) => s.pop);
  /** Plies played so far (0 = start position). */
  const [n, setN] = useState(0);
  const [started, setStarted] = useState(false);
  /** Guess plies already answered → found on the first try? */
  const [answered, setAnswered] = useState<Record<number, boolean>>({});
  const [tries, setTries] = useState(0);
  const [wrong, setWrong] = useState<{ from: string; to: string } | null>(null);
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const nextPly = n + 1;
  const guessing = started && nextPly <= plies.length && g.guess.includes(nextPly) && !(nextPly in answered);
  const fen = n === 0 ? plies[0].fenBefore : plies[n - 1].fenAfter;
  const lastMove = n > 0 ? { from: plies[n - 1].from, to: plies[n - 1].to } : null;
  const atEnd = n >= plies.length;

  const step = (to: number) => {
    clearTimeout(timer.current);
    setWrong(null);
    setTries(0);
    setN(Math.max(0, Math.min(plies.length, to)));
  };

  const finish = async () => {
    const total = g.guess.length;
    const right = g.guess.filter((p) => answered[p]).length;
    const stars = guessStars(right, total);
    const book = await kvGet<Record<string, number>>(MODEL_DONE_KEY, {});
    const first = !(g.id in book);
    await kvSet(MODEL_DONE_KEY, { ...book, [g.id]: Math.max(book[g.id] ?? 0, stars) });
    void progress({ kind: 'lesson', first });
    playSound('reward');
    setDone(true);
  };

  const onMove = (m: MoveInput) => {
    if (!guessing) return false;
    const want = plies[n];
    if (m.from === want.from && m.to === want.to) {
      setAnswered((a) => ({ ...a, [nextPly]: tries === 0 }));
      playSound('success');
      step(nextPly);
      // The reply follows by itself, so you keep your rhythm.
      if (nextPly < plies.length && !g.guess.includes(nextPly + 1)) timer.current = setTimeout(() => setN((k) => (k === nextPly ? k + 1 : k)), 900);
      return true;
    }
    playSound('error');
    setWrong({ from: m.from, to: m.to });
    setTries((t) => t + 1);
    return false;
  };

  const reveal = () => {
    setAnswered((a) => ({ ...a, [nextPly]: false }));
    step(nextPly);
  };

  const right = g.guess.filter((p) => answered[p]).length;
  const note = n > 0 ? g.notes[n] : undefined;
  const heroName = g.hero === 'w' ? 'White' : 'Black';

  if (done) {
    const stars = guessStars(right, g.guess.length);
    return (
      <div className="flex h-full flex-col">
        <Header title={g.title} back />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <div className="flex gap-1.5">
            {[1, 2, 3].map((k) => (
              <Star key={k} size={44} className={`animate-star ${k <= stars ? 'fill-gold-400 text-gold-500' : 'text-stone-300 dark:text-stone-700'}`} style={{ animationDelay: `${k * 160}ms` }} />
            ))}
          </div>
          <h2 className="font-display text-2xl font-semibold">Game studied</h2>
          <p className="text-stone-600 dark:text-stone-300">
            You found <b>{right} of {g.guess.length}</b> of {heroName}’s key moves on the first try.
          </p>
          <p className="text-sm text-stone-500">The idea to take with you: <b>{g.theme}</b>.</p>
          <div className="mt-2 flex w-full gap-2">
            <button className="btn-secondary flex-1" onClick={() => { setDone(false); setAnswered({}); step(0); setStarted(false); }}>Replay</button>
            <button className="btn-primary flex-1" onClick={pop}>Continue</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <Header title={g.title} back right={<span className="pr-2 text-xs font-semibold text-stone-500 tabular-nums">{right}/{g.guess.length} found</span>} />
      <div className="mx-auto mb-1 h-1.5 w-[calc(100%-1.5rem)] max-w-xl overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800 land:max-w-6xl">
        <div className="h-full rounded-full bg-brand-500 transition-[width] duration-300" style={{ width: `${(n / plies.length) * 100}%` }} />
      </div>
      <div className="board-split mx-auto w-full max-w-xl flex-1 space-y-3 overflow-y-auto pb-4 land:max-w-6xl">
        <div className="board-cell px-1.5">
          <Board
            fen={fen}
            orientation={g.hero === 'w' ? 'white' : 'black'}
            movable={guessing ? g.hero : null}
            onMove={onMove}
            lastMove={lastMove}
            highlights={[...(wrong ? [{ sq: wrong.to, tone: 'bad' as const }] : []), ...(guessing && tries >= 2 ? [{ sq: plies[n].from, tone: 'info' as const }] : [])]}
          />
        </div>
        <div className="space-y-3 px-3">
          {!started ? (
            <CoachBubble label={g.theme}>
              <p className="text-xs font-semibold text-stone-500">{g.players}</p>
              <p className="mt-1"><Rich text={g.intro} /></p>
              <p className="mt-1.5 text-sm text-stone-500">You guess {heroName}’s key moves — {g.guess.length} of them.</p>
            </CoachBubble>
          ) : guessing ? (
            <CoachBubble
              label="Your move"
              mood={tries ? 'concerned' : 'thinking'}
              icon={<Lightbulb size={12} />}
            >
              {note && <p className="mb-1.5 text-stone-600 dark:text-stone-300"><b>{label(n, plies[n - 1].san)}</b> <Rich text={note.replace(/^\S+\s/, '')} /></p>}
              <p className="font-semibold">
                {tries === 0 ? `What did ${heroName} play here?` : tries === 1 ? 'Not the move from the game. One more try — think about checks and threats.' : 'The piece that moves is marked. Where does it go?'}
              </p>
            </CoachBubble>
          ) : (
            <CoachBubble
              label={n > 0 ? label(n, plies[n - 1].san) : g.theme}
            >
              {n > 0 && g.guess.includes(n) && (
                <p className={`mb-1 text-xs font-bold tracking-wide uppercase ${answered[n] ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-400'}`}>{answered[n] ? 'You found it' : 'The game move'}</p>
              )}
              <p>{note ? <Rich text={note.replace(/^\S+\s/, '')} /> : n === 0 ? 'The starting position. Step through with the arrows.' : n % 2 === (g.hero === 'w' ? 1 : 0) ? `${heroName} plays ${plies[n - 1].san}.` : `The reply: ${plies[n - 1].san}.`}</p>
            </CoachBubble>
          )}
        </div>
      </div>
      <Dock>
        <DockButton label="Back" ariaLabel="Previous move" icon={<ChevronLeft size={22} />} disabled={!started || n === 0} onClick={() => step(n - 1)} />
        <DockButton label={guessing ? 'Show move' : `Move ${Math.ceil(Math.max(1, n) / 2)}/${Math.ceil(plies.length / 2)}`} icon={<Lightbulb size={22} />} primary disabled={!guessing || tries < 1} onClick={reveal} />
        {!started ? (
          <DockMain onClick={() => setStarted(true)}>Start the game <ChevronRight size={18} /></DockMain>
        ) : atEnd ? (
          <DockMain onClick={() => void finish()}>Finish <ChevronRight size={18} /></DockMain>
        ) : (
          <DockMain ariaLabel="Next move" disabled={guessing} onClick={() => step(n + 1)}>{guessing ? 'Your move' : 'Next'} {!guessing && <ChevronRight size={18} />}</DockMain>
        )}
      </Dock>
    </div>
  );
}
