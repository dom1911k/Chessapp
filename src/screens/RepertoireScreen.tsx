// The opening repertoire: choose a system for each slot, train the lines from memory, and
// record lines of your own.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronRight, Plus, RotateCcw, Trash2, Undo2 } from 'lucide-react';
import { Board } from '../components/Board';
import { CoachBubble } from '../components/Coach';
import { Medallion } from '../components/Glyph';
import { Header, Segmented } from '../components/ui';
import { tryMove, type MoveInput } from '../lib/chess/game';
import { useNav } from '../lib/nav';
import { progress } from '../lib/progress';
import { LEVEL_NAME, SLOTS, SYSTEMS, getRepStats, getRepertoire, lineById, lineLevel, linePlies, nextLine, recordRun, repertoireLines, saveRepertoire, systemById, validLine, type RepLine, type RepStats, type Repertoire } from '../lib/repertoire';
import { playSound } from '../lib/sound';

const LEVEL_STYLE = ['bg-stone-100 text-stone-600 dark:bg-white/10 dark:text-stone-300', 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300', 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300', 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'];

function LineRow({ line, stats, onOpen, onDelete }: { line: RepLine; stats: RepStats; onOpen: () => void; onDelete?: () => void }) {
  const lv = lineLevel(stats[line.id]);
  return (
    <div className="flex items-center">
      <button className="flex min-w-0 flex-1 items-center gap-3 px-3.5 py-2.5 text-left active:bg-stone-100 dark:active:bg-white/5" onClick={onOpen}>
        <span className={`h-4 w-4 shrink-0 rounded-full ring-1 ${line.color === 'w' ? 'bg-white ring-stone-400' : 'bg-stone-900 ring-stone-600'}`} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{line.name}</span>
          <span className="block truncate text-xs text-stone-500">{line.moves.split(' ').slice(0, 8).join(' ')}…</span>
        </span>
        <span className={`chip ${LEVEL_STYLE[lv]}`}>{lv === 3 && <Check size={11} strokeWidth={3} />}{LEVEL_NAME[lv]}</span>
        <ChevronRight size={17} className="text-stone-400" />
      </button>
      {onDelete && (
        <button aria-label={`Delete ${line.name}`} className="px-3 py-3 text-stone-400 active:text-red-500" onClick={onDelete}><Trash2 size={16} /></button>
      )}
    </div>
  );
}

export function RepertoireScreen() {
  const push = useNav((s) => s.push);
  const onTop = useNav((s) => s.stack[s.stack.length - 1]?.name === 'repertoire');
  const [rep, setRep] = useState<Repertoire | null>(null);
  const [stats, setStats] = useState<RepStats>({});
  useEffect(() => {
    if (!onTop) return;
    void getRepertoire().then(setRep);
    void getRepStats().then(setStats);
  }, [onTop]);
  if (!rep) return <div className="flex h-full flex-col"><Header title="My repertoire" back /></div>;
  const lines = repertoireLines(rep);
  const next = nextLine(lines, stats);
  const known = lines.filter((l) => lineLevel(stats[l.id]) >= 2).length;
  const pick = (slot: (typeof SLOTS)[number]['id'], id: string) => {
    const r = { ...rep, picks: { ...rep.picks, [slot]: rep.picks[slot] === id ? undefined : id } };
    setRep(r);
    void saveRepertoire(r);
  };
  const remove = (id: string) => {
    const r = { ...rep, custom: rep.custom.filter((l) => l.id !== id) };
    setRep(r);
    void saveRepertoire(r);
  };
  return (
    <div className="flex h-full flex-col">
      <Header title="My repertoire" back />
      <div className="mx-auto w-full max-w-xl flex-1 space-y-5 overflow-y-auto p-4">
        <div className="card flex items-center gap-3 !p-3.5">
          <Medallion name="library" tint="blue" size={46} />
          <span className="min-w-0 flex-1">
            <span className="block font-display text-lg leading-tight font-semibold">{lines.length ? `${known} of ${lines.length} lines known` : 'Build your repertoire'}</span>
            <span className="block text-xs text-stone-500">{lines.length ? 'The trainer plays the other side; you answer from memory.' : 'Pick one system for each slot below — three choices and you are set.'}</span>
          </span>
          {next && <button className="btn-primary !px-5" onClick={() => push({ name: 'repertoireTrain', lineId: next.id })}>Train</button>}
        </div>
        {SLOTS.map((slot) => {
          const chosen = systemById(rep.picks[slot.id] ?? '');
          return (
            <section key={slot.id}>
              <h2 className="section-title">{slot.label}</h2>
              <p className="mb-2 px-1 text-xs text-stone-500">{slot.sub}</p>
              <div className="flex flex-wrap gap-2">
                {SYSTEMS.filter((s) => s.slot === slot.id).map((s) => {
                  const on = chosen?.id === s.id;
                  return (
                    <button key={s.id} aria-pressed={on} className={`chip !px-3.5 !py-2 !text-sm transition active:scale-95 ${on ? 'bg-brand-600 text-white shadow' : 'bg-white ring-1 ring-stone-200 dark:bg-white/5 dark:ring-white/10'}`} onClick={() => pick(slot.id, s.id)}>
                      {on && <Check size={14} strokeWidth={3} />} {s.name}
                    </button>
                  );
                })}
              </div>
              {chosen && (
                <>
                  <p className="mt-2 px-1 text-sm text-stone-600 dark:text-stone-400">{chosen.blurb}</p>
                  <div className="card mt-2 divide-y divide-stone-100 !p-0 dark:divide-white/[0.06]">
                    {chosen.lines.map((l) => <LineRow key={l.id} line={l} stats={stats} onOpen={() => push({ name: 'repertoireTrain', lineId: l.id })} />)}
                  </div>
                </>
              )}
            </section>
          );
        })}
        <section>
          <div className="mb-2 flex items-baseline justify-between px-1">
            <h2 className="section-title !px-0">Your own lines</h2>
            <button className="flex items-center gap-1 text-xs font-semibold text-brand-700 dark:text-brand-500" onClick={() => push({ name: 'repertoireBuild' })}><Plus size={14} /> Record a line</button>
          </div>
          {rep.custom.length ? (
            <div className="card divide-y divide-stone-100 !p-0 dark:divide-white/[0.06]">
              {rep.custom.map((l) => <LineRow key={l.id} line={l} stats={stats} onOpen={() => push({ name: 'repertoireTrain', lineId: l.id })} onDelete={() => remove(l.id)} />)}
            </div>
          ) : (
            <p className="px-1 text-sm text-stone-500">Play the moves on a board and save them — a line from a book, a video, or the improvement you found in a Game Review.</p>
          )}
        </section>
      </div>
    </div>
  );
}

/** Drill one line: the other side's moves are played for you, yours come from memory. */
export function RepertoireTrainScreen({ lineId }: { lineId: string }) {
  const pop = useNav((s) => s.pop);
  const replace = useNav((s) => s.replace);
  const [line, setLine] = useState<RepLine | null | undefined>(undefined);
  const [rep, setRep] = useState<Repertoire | null>(null);
  useEffect(() => void getRepertoire().then((r) => (setRep(r), setLine(lineById(r, lineId) ?? null))), [lineId]);
  const plies = useMemo(() => (line ? linePlies(line.moves) : []), [line]);
  const [n, setN] = useState(0);
  const [tries, setTries] = useState(0);
  const [slips, setSlips] = useState(0);
  const [done, setDone] = useState(false);
  const [nextId, setNextId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const mine = (i: number) => !!line && (i % 2 === 0) === (line.color === 'w');
  // The other side moves by itself.
  useEffect(() => {
    if (!line || done || n >= plies.length || mine(n)) return;
    timer.current = setTimeout(() => setN((k) => k + 1), n === 0 ? 500 : 650);
    return () => clearTimeout(timer.current);
  }, [n, line, done, plies.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!line || done || n < plies.length || !plies.length) return;
    setDone(true);
    playSound('reward');
    void (async () => {
      await recordRun(line.id, slips === 0);
      void progress({ kind: 'lesson', first: false });
      if (rep) setNextId(nextLine(repertoireLines(rep).filter((l) => l.id !== line.id), await getRepStats())?.id ?? null);
    })();
  }, [n, plies.length, line, done]); // eslint-disable-line react-hooks/exhaustive-deps

  if (line === undefined) return <div className="flex h-full flex-col"><Header title="Repertoire" back /></div>;
  if (line === null) return <div className="flex h-full flex-col"><Header title="Repertoire" back /><p className="p-6 text-center text-stone-500">This line is no longer in your repertoire.</p></div>;

  const fen = n === 0 ? plies[0].fenBefore : plies[n - 1].fenAfter;
  const want = plies[n];
  const myTurn = !done && n < plies.length && mine(n);
  const onMove = (m: MoveInput) => {
    if (!myTurn) return false;
    if (m.from === want.from && m.to === want.to) {
      playSound('success');
      setTries(0);
      setN(n + 1);
      return true;
    }
    playSound('error');
    if (tries === 0) setSlips((s) => s + 1);
    setTries((t) => t + 1);
    return false;
  };
  const restart = () => {
    setN(0);
    setTries(0);
    setSlips(0);
    setDone(false);
  };
  const total = plies.filter((_, i) => mine(i)).length;
  const played = plies.slice(0, n).filter((_, i) => mine(i)).length;
  return (
    <div className="flex h-full flex-col">
      <Header title={line.name} back right={<span className="pr-2 text-xs font-semibold text-stone-500 tabular-nums">{played}/{total}</span>} />
      <div className="mx-auto mb-1 h-1.5 w-[calc(100%-1.5rem)] max-w-xl overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800 land:max-w-6xl">
        <div className="h-full rounded-full bg-brand-500 transition-[width] duration-300" style={{ width: `${(n / plies.length) * 100}%` }} />
      </div>
      <div className="board-split mx-auto w-full max-w-xl flex-1 space-y-3 overflow-y-auto pb-4 land:max-w-6xl">
        <div className="board-cell px-1.5">
          <Board
            fen={fen}
            orientation={line.color === 'w' ? 'white' : 'black'}
            movable={myTurn ? line.color : null}
            onMove={onMove}
            lastMove={n > 0 ? { from: plies[n - 1].from, to: plies[n - 1].to } : null}
            highlights={myTurn && tries === 1 ? [{ sq: want.from, tone: 'info' }] : undefined}
            arrows={myTurn && tries >= 2 ? [{ from: want.from, to: want.to, tone: 'good' }] : undefined}
          />
        </div>
        <div className="space-y-3 px-3">
          {done ? (
            <CoachBubble
              label={slips === 0 ? 'Perfect run' : 'Line complete'}
              actions={
                <>
                  <button className="btn-secondary" onClick={restart}><RotateCcw size={16} /> Again</button>
                  {nextId ? <button className="btn-primary" onClick={() => replace({ name: 'repertoireTrain', lineId: nextId })}>Next line</button> : <button className="btn-primary" onClick={pop}>Done</button>}
                </>
              }
            >
              <p>{slips === 0 ? 'Every move from memory.' : `${slips} slip${slips === 1 ? '' : 's'} — run it again until it is clean.`}</p>
              {line.idea && <p className="mt-1 text-stone-600 dark:text-stone-300"><b>The idea:</b> {line.idea}</p>}
              <p className="mt-1 text-xs text-stone-500">{line.moves}</p>
            </CoachBubble>
          ) : (
            <CoachBubble label={myTurn ? 'Your move' : 'Opponent'} mood={tries ? 'concerned' : 'happy'}>
              <p>
                {!myTurn
                  ? n === 0 ? 'Watch the first move…' : '…'
                  : tries === 0
                    ? `Move ${Math.floor(n / 2) + 1}: what do you play?`
                    : tries === 1
                      ? 'Not the repertoire move. The piece that moves is marked.'
                      : 'Follow the arrow — and say the move to yourself.'}
              </p>
              {n === 0 && line.idea && <p className="mt-1 text-sm text-stone-500">{line.idea}</p>}
            </CoachBubble>
          )}
        </div>
      </div>
    </div>
  );
}

/** Record a line of your own by playing it on a board. */
export function RepertoireBuildScreen() {
  const pop = useNav((s) => s.pop);
  const [sans, setSans] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [color, setColor] = useState<'w' | 'b'>('w');
  const plies = useMemo(() => linePlies(sans.join(' ')), [sans]);
  const fen = plies.length ? plies[plies.length - 1].fenAfter : 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const onMove = (m: MoveInput) => {
    const r = tryMove(fen, m);
    if (!r) return false;
    setSans((s) => [...s, r.move.san]);
    return true;
  };
  const ok = validLine(sans.join(' ')) && name.trim().length > 0;
  const save = async () => {
    const r = await getRepertoire();
    await saveRepertoire({ ...r, custom: [...r.custom, { id: `c${Date.now()}`, name: name.trim(), color, moves: sans.join(' '), custom: true }] });
    playSound('success');
    pop();
  };
  return (
    <div className="flex h-full flex-col">
      <Header title="Record a line" back />
      <div className="board-split mx-auto w-full max-w-xl flex-1 space-y-3 overflow-y-auto pb-4 land:max-w-6xl">
        <div className="board-cell px-1.5">
          <Board fen={fen} orientation={color === 'w' ? 'white' : 'black'} movable={fen.split(' ')[1] as 'w' | 'b'} onMove={onMove} lastMove={plies.length ? { from: plies[plies.length - 1].from, to: plies[plies.length - 1].to } : null} />
        </div>
        <div className="space-y-3 px-3">
          <div className="card !p-3">
            <div className="flex items-start gap-2">
              <p className="min-h-10 flex-1 text-sm leading-relaxed">
                {sans.length ? sans.map((s, i) => <span key={i}>{i % 2 === 0 && <span className="text-stone-400">{i / 2 + 1}. </span>}<b className="font-semibold">{s}</b> </span>) : <span className="text-stone-500">Play the moves for both sides on the board.</span>}
              </p>
              <button className="btn-secondary !min-h-9 !px-3" aria-label="Take back the last move" disabled={!sans.length} onClick={() => setSans((s) => s.slice(0, -1))}><Undo2 size={16} /></button>
            </div>
          </div>
          <div>
            <div className="mb-1.5 section-title">I play</div>
            <Segmented value={color} onChange={setColor} options={[{ value: 'w', label: 'White' }, { value: 'b', label: 'Black' }]} />
          </div>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Name of the line (e.g. Italian, …Na5 line)" className="w-full rounded-2xl bg-white px-3.5 py-3 text-[15px] ring-1 ring-stone-200 outline-none focus:ring-2 focus:ring-brand-500 dark:bg-white/5 dark:ring-white/10" />
          <button className="btn-primary w-full" disabled={!ok} onClick={() => void save()}>Save line</button>
          {!ok && sans.length > 0 && <p className="text-center text-xs text-stone-500">{sans.length < 4 ? 'Play at least four moves (two for each side).' : 'Give the line a name.'}</p>}
        </div>
      </div>
    </div>
  );
}
