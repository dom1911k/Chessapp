// The short "versus" splash at the start of a game: you on one side, your opponent on the other.
import { useEffect, useState } from 'react';
import { defaultPieces } from 'react-chessboard';
import { Star } from 'lucide-react';
import { opponentById } from '../lib/people';
import { getXp, levelFor } from '../lib/progress/xp';
import { playSound } from '../lib/sound';
import { Portrait } from './Coach';

const SHOW_MS = 2600;

export function VersusIntro({ opponentId, elo, userColor, line, onDone }: { opponentId?: string; elo: number; userColor: 'w' | 'b'; line?: string; onDone: () => void }) {
  const o = opponentById(opponentId);
  const [level, setLevel] = useState<number | null>(null);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => void getXp().then((x) => setLevel(levelFor(x).level)), []);
  useEffect(() => {
    playSound('versus');
    const t1 = setTimeout(() => setLeaving(true), SHOW_MS - 350);
    const t2 = setTimeout(onDone, SHOW_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onDone]);
  const skip = () => {
    setLeaving(true);
    setTimeout(onDone, 250);
  };
  const king = defaultPieces[userColor === 'w' ? 'wK' : 'bK'];

  return (
    <button
      aria-label="Start the game"
      onClick={skip}
      className={`fixed inset-0 z-50 overflow-hidden text-white transition-opacity duration-300 ${leaving ? 'opacity-0' : 'opacity-100'}`}
      style={{ background: 'radial-gradient(circle at 50% 45%, #2a3b31 0%, #14100c 75%)' }}
    >
      {/* Two halves sweep in from opposite corners, split by a bright diagonal. */}
      <div className="animate-vs-left absolute inset-0" style={{ background: 'linear-gradient(160deg, #1f7a4c 0%, #12452d 60%, transparent 60.2%)' }} />
      <div className="animate-vs-right absolute inset-0" style={{ background: 'linear-gradient(160deg, transparent 59.8%, #7a3b2a 60%, #3b1c14 100%)' }} />
      <div className="animate-vs-flash absolute inset-0" style={{ background: 'linear-gradient(160deg, transparent 59.4%, rgba(255,236,170,0.95) 60%, transparent 60.6%)' }} />

      <div className="relative mx-auto flex h-full max-w-md flex-col justify-between px-6 py-[18vh]">
        {/* You */}
        <div className="animate-vs-in-left flex items-center gap-4 self-start">
          <span className="flex h-24 w-24 items-center justify-center rounded-[30%] bg-gradient-to-br from-stone-100 to-stone-300 shadow-[0_12px_30px_rgba(0,0,0,0.45)] ring-4 ring-white/80">
            <span className="h-16 w-16">{king({})}</span>
          </span>
          <span className="text-left">
            <span className="block font-display text-3xl font-semibold">You</span>
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold">
              <Star size={11} className="fill-gold-400 text-gold-400" /> Level {level ?? '…'} · {userColor === 'w' ? 'White' : 'Black'}
            </span>
          </span>
        </div>

        <div className="animate-vs-stamp self-center font-display text-7xl font-black tracking-tight text-gold-300 italic drop-shadow-[0_6px_18px_rgba(0,0,0,0.6)]">VS</div>

        {/* Opponent */}
        <div className="animate-vs-in-right flex flex-col items-end gap-3 self-end">
          <div className="flex items-center gap-4">
            <span className="text-right">
              <span className="block font-display text-3xl font-semibold">{o ? o.name : 'Bot'}</span>
              <span className="mt-1 inline-flex rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold">~{elo}{o ? ` · ${o.tagline}` : ''}</span>
            </span>
            {o ? (
              <Portrait id={o.id} size={96} mood="happy" className="ring-4 ring-white/80 shadow-[0_12px_30px_rgba(0,0,0,0.45)]" />
            ) : (
              <span className="h-24 w-24 rounded-[30%] bg-stone-700 ring-4 ring-white/80" />
            )}
          </div>
          {line && (
            <span className="animate-vs-line max-w-[85%] rounded-2xl rounded-tr-sm bg-white px-3 py-2 text-left text-sm font-medium text-stone-800 shadow-lg">{line}</span>
          )}
        </div>
      </div>
      <span className="absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+20px)] text-center text-xs text-white/50">Tap to start</span>
    </button>
  );
}
