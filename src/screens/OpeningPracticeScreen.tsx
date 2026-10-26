import { useEffect, useMemo, useState } from 'react';
import { Board } from '../components/Board';
import { CoachBubble } from '../components/Coach';
import { PlayFromHere } from '../components/PlayFromHere';
import { Header, Segmented } from '../components/ui';
import { Chess } from 'chess.js';
import { START_FEN, tryMove, type MoveInput } from '../lib/chess/game';
import { ECO } from '../lib/openings';
import { playSound } from '../lib/sound';

function sanMove(fen: string, san: string) {
  const c = new Chess(fen);
  try {
    const move = c.move(san);
    return { move, fen: c.fen() };
  } catch {
    return null;
  }
}

/** Walk through an opening's moves from one side; the other side is played for you. */
export function OpeningPracticeScreen({ index }: { index: number }) {
  const o = ECO[index];
  const line = useMemo(() => o.moves.split(' '), [o]);
  const [side, setSide] = useState<'w' | 'b'>(/Defen[cs]e|Gambit Accepted|Gambit Declined/.test(o.name) && line.length > 1 ? 'b' : 'w');
  const [ply, setPly] = useState(0);
  const [fen, setFen] = useState(START_FEN);
  const [last, setLast] = useState<{ from: string; to: string } | null>(null);
  const [miss, setMiss] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const done = ply >= line.length;

  const reset = () => {
    setPly(0);
    setFen(START_FEN);
    setLast(null);
    setMiss(0);
    setNote(null);
  };
  useEffect(reset, [side, index]);

  // The other side's moves are played automatically.
  useEffect(() => {
    if (done) return;
    const turn = fen.split(' ')[1];
    if (turn === side) return;
    const t = setTimeout(() => {
      const r = sanMove(fen, line[ply]);
      if (!r) return;
      setFen(r.fen);
      setLast({ from: r.move.from, to: r.move.to });
      setPly((p) => p + 1);
    }, 500);
    return () => clearTimeout(t);
  }, [fen, ply, side, done, line]);

  useEffect(() => {
    if (done) playSound('success');
  }, [done]);

  const expected = !done ? sanMove(fen, line[ply])?.move : undefined;

  const onMove = (m: MoveInput) => {
    const r = tryMove(fen, m);
    if (!r || !expected) return false;
    if (r.move.san !== expected.san) {
      setMiss((x) => x + 1);
      setNote(`That's playable, but in the ${o.name} the usual move here is different.${miss >= 1 ? ` It's ${expected.san} — see the arrow.` : ' Try again!'}`);
      playSound('error');
      return false;
    }
    setNote(null);
    setMiss(0);
    setFen(r.fen);
    setLast({ from: r.move.from, to: r.move.to });
    setPly((p) => p + 1);
    return true;
  };

  const arrows = expected && miss >= 2 ? [{ from: expected.from, to: expected.to, tone: 'good' as const }] : [];

  return (
    <div className="flex h-full flex-col">
      <Header title={o.name} back />
      <div className="mx-auto w-full max-w-xl flex-1 space-y-3 overflow-y-auto pb-4">
        <div className="px-3">
          <Segmented value={side} onChange={setSide} options={[{ value: 'w', label: 'Play White' }, { value: 'b', label: 'Play Black' }]} />
        </div>
        <div className="px-1.5">
          <Board fen={fen} orientation={side === 'w' ? 'white' : 'black'} movable={done ? null : side} onMove={onMove} lastMove={last} arrows={arrows} />
        </div>
        <div className="space-y-3 px-3">
          {done ? (
            <CoachBubble
              actions={
                <>
                  <PlayFromHere fen={fen} color={side} label="▶ Continue as a game" />
                  <button className="btn-secondary" onClick={reset}>Practise again</button>
                </>
              }
            >
              <p className="font-semibold">That's the {o.name}!</p>
              <p>{o.idea}</p>
            </CoachBubble>
          ) : (
            <CoachBubble mood={note ? 'concerned' : 'happy'}>
              <p>{note ?? (fen.split(' ')[1] === side ? `Move ${Math.floor(ply / 2) + 1}: play the ${o.name} move for ${side === 'w' ? 'White' : 'Black'}.` : 'Watch the reply…')}</p>
              <p className="text-sm text-stone-500">{o.idea}</p>
            </CoachBubble>
          )}
        </div>
      </div>
    </div>
  );
}
