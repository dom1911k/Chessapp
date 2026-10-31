// Run over: final tally, the moments that cost the most Composure (with Coach Sam's
// explanation), Engine's Eye moves, and a one-tap "fun?" rating for playtests.
import { useEffect, useMemo, useState } from 'react';
import { Board } from '../../components/Board';
import { explainMove } from '../../lib/coach';
import { CLASS_LABEL } from '../../lib/chess/evaluation';
import { parseUci } from '../../lib/chess/game';
import { addPlaytest } from '../db';
import { ROOM_NAME } from '../content';
import { useRun } from '../store';
import { TUNING as T } from '../tuning';
import type { Moment } from '../types';
import { sfx, buzz } from '../sfx';
import { PixelNum } from './bits';

export function Debrief({ onShake }: { onShake: () => void }) {
  const s = useRun();
  const run = s.run!;
  const won = run.ended === 'won';
  const [shown, setShown] = useState(0);
  const rows = run.results;

  useEffect(() => {
    let i = 0;
    const tick = () => {
      i++;
      setShown(i);
      if (i <= rows.length) sfx('chip', i * 4);
      if (i === rows.length + 1) {
        sfx(won ? 'win' : 'slam');
        buzz([30, 20, 90]);
        onShake();
      }
      if (i <= rows.length) timer = setTimeout(tick, 320);
    };
    let timer = setTimeout(tick, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const moments = useMemo(() => [...run.moments].sort((a, b) => b.cost - a.cost || b.move.accuracy - a.move.accuracy).slice(0, 3), [run.moments]);
  const eyeMoves = collectEye(run);
  const minutes = Math.max(1, Math.round(((run.endedAt ?? Date.now()) - run.startedAt) / 60000));

  return (
    <div className="h-full overflow-y-auto px-4 pt-6 pb-8">
      <div className="text-center">
        <div className="run-label">{won ? 'The rival falls' : 'The run ends'} · {minutes} min</div>
        <div className="run-title mt-1 text-4xl font-black" style={{ color: won ? 'var(--gold-2)' : 'var(--blood)' }}>
          {won ? 'Victory' : 'Defeat'}
        </div>
      </div>

      <div className="run-panel mt-5 p-3">
        {rows.map((r, i) => (
          <div key={i} className={`flex items-center justify-between py-1.5 ${i < shown ? 'run-fadeup' : 'opacity-0'}`}>
            <span className="run-sans text-sm">
              <span className={r.won ? 'text-[#5ee59a]' : 'text-[var(--blood)]'}>{r.won ? '✓' : '✕'}</span> {ROOM_NAME[r.kind]}
              <span className="ml-1 text-xs text-[var(--ink-dim)]">
                {r.chips} × {r.mult}
              </span>
            </span>
            <PixelNum value={r.score} size={2.5} />
          </div>
        ))}
        {won && (
          <div className={`flex items-center justify-between py-1.5 ${shown > rows.length - 1 ? 'run-fadeup' : 'opacity-0'}`}>
            <span className="run-sans text-sm">Composure left × {T.score.composureLeftChips}</span>
            <PixelNum value={run.composure * T.score.composureLeftChips} size={2.5} />
          </div>
        )}
        <div className="mt-2 flex flex-col items-center border-t border-[var(--gold-dim)]/40 pt-3">
          <span className="run-label">Final score</span>
          {shown > rows.length ? <PixelNum className="run-slam" value={run.finalScore ?? 0} size={8} /> : <div className="h-10" />}
        </div>
      </div>

      <div className="run-title mt-6 text-xl font-bold">What cost you</div>
      {moments.length === 0 && <div className="run-sans mt-1 text-sm text-[var(--ink-dim)]">Nothing! Not a single mistake or blunder. Coach Sam is impressed.</div>}
      <div className="mt-2 space-y-3">
        {moments.map((m, i) => (
          <MomentCard key={i} m={m} />
        ))}
      </div>

      {eyeMoves.length > 0 && (
        <div className="run-panel mt-4 p-3">
          <div className="run-label">Engine's Eye moves</div>
          <div className="run-sans mt-1 text-sm">
            {eyeMoves.map((e, i) => (
              <span key={i} className="mr-2 inline-block">👁 {e}</span>
            ))}
          </div>
        </div>
      )}

      <FunRating />
    </div>
  );
}

function collectEye(run: { eyeMoves?: string[] }): string[] {
  return run.eyeMoves ?? [];
}

function MomentCard({ m }: { m: Moment }) {
  const comment = useMemo(() => {
    try {
      return explainMove({ fenBefore: m.move.fenBefore, uci: m.move.uci, before: m.move.before ?? null, after: m.move.after ?? null, classification: m.move.cls });
    } catch {
      return null;
    }
  }, [m]);
  const me = m.move.fenBefore.split(' ')[1] === 'w' ? 'white' : 'black';
  const best = m.move.before?.bestMove;
  return (
    <div className="run-panel flex gap-3 p-2.5">
      <div className="w-36 shrink-0">
        <Board
          fen={m.move.fenBefore}
          orientation={me}
          movable={null}
          showCoordinates={false}
          arrows={[{ ...parseUci(m.move.uci), tone: 'bad' }, ...(best && best !== m.move.uci ? [{ ...parseUci(best), tone: 'good' as const }] : [])]}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="run-sans text-xs text-[var(--ink-dim)]">{ROOM_NAME[m.kind]}</div>
        <div className="run-sans font-bold">
          {m.move.san}{' '}
          <span className="text-[var(--blood)]">
            {CLASS_LABEL[m.move.cls]} · −{m.cost}
          </span>
          {m.move.insured && <span className="ml-1 text-xs text-[#5ee59a]">(insured)</span>}
          {m.move.eye && <span className="ml-1">👁</span>}
        </div>
        <div className="mt-1 flex items-start gap-1.5">
          <span className="run-sans shrink-0 rounded bg-[var(--gold)]/20 px-1 text-[10px] font-bold text-[var(--gold-2)]">Sam</span>
          <p className="run-sans text-[13px] leading-snug">{comment?.text.join(' ') ?? 'This move lost too much.'}</p>
        </div>
        {comment?.bestSan && <div className="run-sans mt-1 text-xs text-[#5ee59a]">Better: {comment.bestSan}</div>}
      </div>
    </div>
  );
}

function FunRating() {
  const s = useRun();
  const run = s.run!;
  const [fun, setFun] = useState(0);
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);
  const save = async () => {
    await addPlaytest({
      at: Date.now(),
      runId: run.id,
      fun,
      note: note.trim(),
      result: run.ended === 'won' ? 'won' : 'lost',
      score: run.finalScore ?? 0,
      minutes: Math.round(((run.endedAt ?? Date.now()) - run.startedAt) / 6000) / 10,
      relics: run.relics,
      rooms: run.results.map((r) => ({ kind: r.kind, won: r.won, score: r.score })),
      composureLeft: run.composure,
      cursed: run.cursed,
    });
    setSaved(true);
    sfx('coin');
  };
  return (
    <div className="run-panel mt-6 p-3 text-center">
      {!saved ? (
        <>
          <div className="run-title text-lg font-bold">Was that fun?</div>
          <div className="mt-2 flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setFun(n)} className={`h-11 w-11 rounded-xl ring-1 ${fun === n ? 'bg-[var(--gold)] text-[#241503] ring-[var(--gold-2)]' : 'bg-black/30 ring-[var(--gold-dim)]'}`}>
                <PixelNum value={n} size={3} color={fun === n ? '#241503' : 'var(--gold-2)'} glow={false} />
              </button>
            ))}
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note: what felt good or bad?"
            rows={2}
            className="run-sans mt-3 w-full rounded-lg bg-black/30 p-2 text-sm text-[var(--ink)] ring-1 ring-[var(--gold-dim)] outline-none placeholder:text-[var(--ink-dim)]"
          />
          <button className="run-btn mt-2 w-full" disabled={!fun} onClick={() => void save()}>
            Save rating
          </button>
        </>
      ) : (
        <div className="run-sans text-sm text-[var(--ink-dim)]">Thanks! Saved for the playtest log.</div>
      )}
      <button className={`run-btn mt-3 w-full ${saved ? '' : 'ghost'}`} onClick={() => void s.newRun()}>
        New run
      </button>
    </div>
  );
}
