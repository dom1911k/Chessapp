// The Codex (from the Sanctum): techniques you learn by doing — read a short lesson, then pass
// a 3-puzzle learning check (2 of 3). Learned techniques can be equipped for runs (up to
// codexSlots); executing one in a room fires its ×mult and counts toward mastery.
import { useEffect, useState } from 'react';
import { Chess } from 'chess.js';
import { useMeta } from '../meta';
import { TECHNIQUES, techById, techLevel, techMult, type TechId } from '../codex';
import { TUNING as T } from '../tuning';
import { sample } from '../rules';
import { RunBoard } from '../pixel/RunBoard';
import { Sprite } from '../pixel/sprites';
import { EMBER, GOLD } from '../pixel/pixelize';
import { sfx, buzz } from '../sfx';
import { PixelText } from './PixelText';
import { arrowOf } from '../store';
import { toUci, tryMove } from '../../lib/chess/game';
import { loadRange } from '../../lib/puzzles/data';
import { fromLichess, type PuzzleSpec } from '../../lib/puzzles/spec';
import { getRating } from '../../lib/puzzles/rating';

const LEVEL_NAME = { novice: 'Novice', adept: 'Adept', master: 'Master' } as const;

export function CodexScreen({ onBack }: { onBack: () => void }) {
  const m = useMeta();
  const [open, setOpen] = useState<TechId | null>(null);
  const eq = m.equipped ?? [];
  if (open) return <Lesson id={open} onBack={() => setOpen(null)} />;
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 pt-3">
        <button className="run-btn ghost px-3! py-2!" onClick={onBack}>
          ← Back
        </button>
        <span className="run-sans text-xs text-[var(--ink-dim)]">
          Equipped {eq.length}/{T.codex.slots}
        </span>
      </div>
      <div className="mt-2 flex flex-col items-center">
        <Sprite name="scroll" size={44} px={16} pal={EMBER} />
        <PixelText text="The Codex" size={3} className="mt-1" />
        <div className="run-sans mt-1 px-6 text-center text-xs text-[var(--ink-dim)]">
          Learn a technique by reading its lesson and solving {T.codex.checkNeed} of {T.codex.checkPuzzles} puzzles. Equip up to {T.codex.slots}: play one in a run and it fires its own ×mult.
        </div>
      </div>
      <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-6">
        {TECHNIQUES.map((t) => {
          const st = m.codex?.[t.id];
          const uses = st?.uses ?? 0;
          const lvl = techLevel(uses);
          const next = lvl === 'novice' ? T.codex.adeptUses : lvl === 'adept' ? T.codex.masterUses : null;
          const on = eq.includes(t.id);
          return (
            <div key={t.id} className={`run-panel flex items-center gap-3 p-2.5 ${st?.learned ? `tech-card lvl-${lvl}` : ''}`}>
              <button onClick={() => (setOpen(t.id), sfx('card'))} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <Sprite name={st?.learned ? t.glyph : 'lock'} size={34} px={14} pal={st?.learned ? EMBER : GOLD} />
                <div className="min-w-0">
                  <div className="run-title text-sm font-bold">
                    {t.name}
                    {st?.learned && <span className="run-sans ml-1.5 text-[10px] font-black text-[var(--gold-2)] uppercase">{LEVEL_NAME[lvl]} · ×{techMult(uses)}</span>}
                  </div>
                  <div className="run-sans text-[11px] text-[var(--ink-dim)]">
                    {st?.learned ? (next ? `${uses}/${next} uses to ${lvl === 'novice' ? 'Adept' : 'Master'}` : `${uses} uses · mastered`) : 'Tap to read the lesson and take the check.'}
                  </div>
                </div>
              </button>
              {st?.learned && (
                <button
                  className={`run-btn shrink-0 px-2.5! py-1.5! text-xs ${on ? '' : 'ghost'}`}
                  disabled={!on && eq.length >= T.codex.slots}
                  onClick={() => (m.toggleEquip(t.id) ? sfx('card') : sfx('fail'))}
                >
                  {on ? 'Equipped' : 'Equip'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Lesson({ id, onBack }: { id: TechId; onBack: () => void }) {
  const t = techById(id);
  const learned = useMeta((m) => !!m.codex?.[id]?.learned);
  const [check, setCheck] = useState(false);
  if (check) return <LearningCheck id={id} onDone={() => setCheck(false)} />;
  const side = t.example.fen.split(' ')[1] === 'w' ? 'white' : 'black';
  return (
    <div className="flex h-full flex-col overflow-y-auto px-4 pt-3 pb-6">
      <button className="run-btn ghost self-start px-3! py-2!" onClick={onBack}>
        ← Codex
      </button>
      <div className="mt-2 flex items-center gap-2">
        <Sprite name={t.glyph} size={36} px={14} pal={EMBER} />
        <PixelText text={t.name} size={3} />
      </div>
      <div className="run-panel mt-3 p-3">
        {t.lesson.map((x, i) => (
          <p key={i} className="run-sans mt-1 text-sm leading-snug first:mt-0">
            {x}
          </p>
        ))}
      </div>
      <div className="mx-auto mt-3 w-64">
        <RunBoard fen={t.example.fen} orientation={side} movable={null} arrows={[arrowOf(t.example.uci, 'good')]} showCoordinates={false} />
        <div className="run-sans mt-1 text-center text-xs text-[var(--ink-dim)]">Example: the green arrow shows the idea.</div>
      </div>
      <button className="run-btn mt-4 w-full" onClick={() => (setCheck(true), sfx('door'))}>
        {learned ? 'Practise again (3 puzzles)' : `Take the learning check (${T.codex.checkNeed} of ${T.codex.checkPuzzles})`}
      </button>
    </div>
  );
}

/** Three puzzles with the technique's Lichess theme; solve checkNeed to learn it. */
function LearningCheck({ id, onDone }: { id: TechId; onDone: () => void }) {
  const t = techById(id);
  const learn = useMeta((m) => m.learnTechnique);
  const [list, setList] = useState<PuzzleSpec[] | null>(null);
  const [i, setI] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  useEffect(() => {
    let live = true;
    void (async () => {
      const { rating } = await getRating();
      const w = T.codex.checkWindow;
      let pool = (await loadRange(rating - w, rating + w)).filter((p) => p.themes.includes(t.theme) && p.moves.length >= 2);
      if (pool.length < T.codex.checkPuzzles) pool = (await loadRange(0, 4000)).filter((p) => p.themes.includes(t.theme) && p.moves.length >= 2);
      if (live) setList(sample(pool, T.codex.checkPuzzles, Math.random).map(fromLichess));
    })();
    return () => void (live = false);
  }, [t.theme]);
  const solved = results.filter(Boolean).length;
  const finished = list && results.length >= list.length;
  useEffect(() => {
    if (finished && solved >= T.codex.checkNeed) {
      learn(id);
      sfx('win');
      buzz([30, 20, 90]);
    } else if (finished) sfx('fail');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);
  if (!list) return <div className="run-sans flex h-full items-center justify-center text-sm text-[var(--ink-dim)]">Finding puzzles…</div>;
  if (!list.length) return <div className="run-sans p-6 text-center text-sm">No puzzles for this technique right now. <button className="run-btn mt-3 w-full" onClick={onDone}>Back</button></div>;
  if (finished) {
    const ok = solved >= T.codex.checkNeed;
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <Sprite name={ok ? t.glyph : 'cross'} size={60} px={16} pal={ok ? EMBER : GOLD} />
        <PixelText text={ok ? 'Learned!' : 'Not yet'} size={4} className="mt-2" color={ok ? '#ffe7a3' : '#ff5a6a'} />
        <div className="run-sans mt-2 text-sm">
          {solved} of {list.length} solved. {ok ? `${t.name} is in your Codex — equip it for your next run.` : `You need ${T.codex.checkNeed}. Read the lesson again and retry.`}
        </div>
        <button className="run-btn mt-5 w-full" onClick={onDone}>
          Back to the lesson
        </button>
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col px-3 pt-3 pb-5">
      <div className="flex items-center justify-between px-1">
        <span className="run-label">{t.name} · learning check</span>
        <span className="run-sans text-xs font-bold">
          {i + 1}/{list.length} · solved {solved}
        </span>
      </div>
      <CheckPuzzle key={list[i].id} spec={list[i]} onEnd={(ok) => setResults((r) => [...r, ok])} onNext={() => setI((x) => x + 1)} last={i + 1 >= list.length} />
    </div>
  );
}

function CheckPuzzle({ spec, onEnd, onNext, last }: { spec: PuzzleSpec; onEnd: (ok: boolean) => void; onNext: () => void; last: boolean }) {
  const start = spec.setup ? tryMove(spec.fen, spec.setup)!.fen : spec.fen;
  const me = new Chess(start).turn();
  const [fen, setFen] = useState(start);
  const [step, setStep] = useState(0);
  const [state, setState] = useState<'play' | 'won' | 'lost'>('play');
  const [lastMv, setLastMv] = useState<{ from: string; to: string } | null>(spec.setup ? { from: spec.setup.slice(0, 2), to: spec.setup.slice(2, 4) } : null);
  const move = (uci: string): boolean => {
    if (state !== 'play') return false;
    const res = tryMove(fen, uci);
    if (!res) return false;
    const ok = uci === spec.solution[step] || res.move.san.endsWith('#');
    setFen(res.fen);
    setLastMv({ from: uci.slice(0, 2), to: uci.slice(2, 4) });
    if (!ok) {
      setState('lost');
      sfx('fail');
      onEnd(false);
      return true;
    }
    sfx('chip', 10);
    if (step + 1 >= spec.solution.length || res.move.san.endsWith('#')) {
      setState('won');
      sfx('clear');
      onEnd(true);
      return true;
    }
    const reply = spec.solution[step + 1];
    setTimeout(() => {
      const r2 = tryMove(res.fen, reply);
      if (r2) {
        setFen(r2.fen);
        setLastMv({ from: reply.slice(0, 2), to: reply.slice(2, 4) });
      }
      setStep(step + 2);
    }, 450);
    return true;
  };
  return (
    <div className="mt-2 flex flex-1 flex-col">
      <div className="run-sans mb-1 px-1 text-sm">{state === 'play' ? `You play ${me === 'w' ? 'White' : 'Black'}. Find the best move.` : state === 'won' ? '✓ Solved!' : '✕ Not this time — the green arrow was the answer.'}</div>
      <RunBoard
        fen={fen}
        orientation={me === 'w' ? 'white' : 'black'}
        movable={state === 'play' ? me : null}
        onMove={(m) => move(toUci(m))}
        lastMove={lastMv}
        arrows={state === 'lost' ? [arrowOf(spec.solution[step], 'good')] : []}
      />
      {state !== 'play' && (
        <button className="run-btn mt-3 w-full" onClick={onNext}>
          {last ? 'See the result' : 'Next puzzle'}
        </button>
      )}
    </div>
  );
}
