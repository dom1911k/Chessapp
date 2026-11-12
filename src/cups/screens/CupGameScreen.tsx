// A cup game in pixel style: the opponent card, the VS slam, then a real game under Match
// conditions. The bottom bar holds Resign (and the charms, stage 3).
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { opponentById, pickLine } from '../../lib/people';
import { avatarUrl } from '../../lib/avatars';
import { fmtClock } from '../../lib/clock';
import { useSettings } from '../../lib/settings';
import { useMyName } from '../../components/UserAvatar';
import { RunBoard, PixelCaptured } from '../pixel/RunBoard';
import { PixelAvatar, PixelPortrait, Sprite } from '../pixel/sprites';
import { clockLeft, fenOf, otherColor, turnOf, useCupGame, type CupGameState } from '../game';
import { tierInfo, type CupTier } from '../ladder';
import { material } from '../material';
import { useCup } from '../store';
import { runMusic, sfx } from '../sfx';
import { VsIntro } from '../ui/VsIntro';
import { PixelText } from '../ui/PixelText';
import { ROUND_NAMES } from '../ladder';
import { Sheet } from '../ui/Sheet';

function useNow(ms = 200) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

function Clock({ ms, running, low }: { ms: number; running: boolean; low: boolean }) {
  return (
    <span className={`run-sans rounded px-2 py-0.5 text-lg font-black tabular-nums ${running ? (low ? 'bg-[var(--blood)] text-white' : 'bg-[var(--gold-2)] text-[#1b0f22]') : 'bg-black/40 text-[var(--ink-dim)]'}`}>{fmtClock(ms)}</span>
  );
}

function Bar({ face, name, sub, clock, captured }: { face: ReactNode; name: string; sub?: ReactNode; clock: ReactNode; captured: ReactNode }) {
  return (
    <div className="flex h-12 items-center gap-2 px-2">
      {face}
      <div className="min-w-0 flex-1 text-left leading-tight">
        <div className="run-sans truncate text-sm font-black">{name} {sub}</div>
        {captured}
      </div>
      {clock}
    </div>
  );
}

/** Before the game: who you face, your colour, what a draw means. */
function OpponentCard({ g, onPlay }: { g: CupGameState; onPlay: () => void }) {
  const o = opponentById(g.opponentId);
  return (
    <div className="run-fadeup flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="run-label">{tierInfo(g.tier as CupTier).name} · {ROUND_NAMES[g.round]}</div>
      <PixelPortrait id={g.opponentId} size={136} boss={g.round === 2} className="mt-3 run-boss-glow" />
      <div className="run-title mt-2 text-3xl font-black">{o?.name}</div>
      <div className="run-sans text-sm text-[var(--ink-dim)]">plays at {g.elo} · {o?.tagline}</div>
      <div className="run-panel mt-5 w-full max-w-xs px-3 py-2 text-left">
        <div className="run-sans text-sm">You play <b>{g.userColor === 'w' ? 'White' : 'Black'}</b> · {g.timeControl.split('+')[0] === '600' ? '10 minutes' : g.timeControl}</div>
        <div className="run-sans mt-0.5 text-xs text-[var(--ink-dim)]">{g.userColor === 'b' ? 'With Black, a draw sends you through.' : 'With White you need a win; a draw sends them through.'}</div>
        <div className="run-sans mt-0.5 text-xs text-[var(--ink-dim)]">Match conditions: no take-backs, hints or coach.</div>
      </div>
      <button className="run-btn mt-6 w-full max-w-xs text-lg" onClick={onPlay}>Play</button>
    </div>
  );
}

function GameOverPanel({ onContinue }: { onContinue: () => void }) {
  const over = useCupGame((s) => s.over);
  const g = useCupGame((s) => s.game)!;
  const o = opponentById(g.opponentId);
  if (!over) return <div className="run-sans fixed inset-x-0 bottom-24 z-30 text-center text-sm text-[var(--ink-dim)]">Recording the game…</div>;
  const title = over.userResult === 'win' ? 'Victory' : over.userResult === 'draw' ? 'Draw' : 'Defeat';
  const why = over.reason === 'checkmate' ? 'by checkmate' : over.reason === 'time' ? 'on time' : over.reason === 'resignation' ? 'by resignation' : over.reason;
  return (
    <Sheet>
      <div className="text-center">
        <PixelText text={title} size={4} color={over.userResult === 'loss' ? '#ff8c8c' : undefined} />
        <div className="run-sans mt-1 text-sm text-[var(--ink-dim)]">{why} · vs {o?.name}</div>
        <div className="mt-4 flex justify-center gap-6">
          <div><div className="run-label">Accuracy</div><div className="run-title text-2xl font-black">{over.accuracy.toFixed(0)}%</div></div>
          <div><div className="run-label">Moves</div><div className="run-title text-2xl font-black">{over.moves}</div></div>
          <div><div className="run-label">Clock</div><div className="run-title text-2xl font-black">{fmtClock(over.clockLeft * 1000)}</div></div>
        </div>
        <button className="run-btn mt-5 w-full text-lg" onClick={onContinue}>Continue</button>
      </div>
    </Sheet>
  );
}

export function CupGameScreen() {
  const s = useCupGame();
  const g = s.game!;
  const finishRound = useCup((c) => c.finishRound);
  const myName = useMyName();
  const avatar = useSettings((x) => x.avatar);
  const [vs, setVs] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const now = useNow();
  const o = opponentById(g.opponentId);
  const fen = fenOf(g);
  const mat = useMemo(() => material(fen), [fen]);
  const me = g.userColor;
  const opp = otherColor(me);
  const toMove = turnOf(fen);
  const last = g.plies[g.plies.length - 1];
  const greet = useMemo(() => (o ? pickLine(o, 'greet') : ''), [o]);

  useEffect(() => {
    runMusic(s.phase === 'intro' ? 'map' : g.round === 2 ? 'rival' : 'battle');
  }, [s.phase, g.round]);

  if (s.phase === 'intro' && !g.started)
    return (
      <>
        <OpponentCard g={g} onPlay={() => (sfx('card'), setVs(true))} />
        {vs && <VsIntro opponentId={g.opponentId} line={greet} myName={myName} onDone={() => (setVs(false), s.begin())} />}
      </>
    );

  const myMs = clockLeft(g, me, now);
  const oppMs = clockLeft(g, opp, now);
  return (
    <div className="flex h-full flex-col">
      <Bar
        face={<PixelPortrait id={g.opponentId} size={40} px={32} />}
        name={o?.name ?? 'Opponent'}
        sub={<span className="font-semibold text-[var(--ink-dim)]">({g.elo})</span>}
        clock={<Clock ms={oppMs} running={toMove === opp && !g.result} low={oppMs < 30_000} />}
        captured={<PixelCaptured pieces={mat.lost[me]} color={me} lead={opp === 'w' ? mat.diff : -mat.diff} />}
      />
      <div className="px-1">
        <RunBoard fen={fen} orientation={me === 'w' ? 'white' : 'black'} movable={s.phase === 'userTurn' ? me : null} onMove={(m) => s.userMove(m)} lastMove={last ? { from: last.uci.slice(0, 2), to: last.uci.slice(2, 4) } : null} />
      </div>
      <Bar
        face={<PixelAvatar avatarId={avatar} url={avatarUrl(avatar)} size={40} px={32} />}
        name={myName}
        clock={<Clock ms={myMs} running={toMove === me && !g.result} low={myMs < 30_000} />}
        captured={<PixelCaptured pieces={mat.lost[opp]} color={opp} lead={me === 'w' ? mat.diff : -mat.diff} />}
      />
      <div className="run-sans px-3 text-xs text-[var(--ink-dim)]">
        {s.phase === 'botThinking' ? `${o?.name} is thinking…` : s.phase === 'userTurn' ? 'Your move' : s.phase === 'analyzing' ? '…' : ''}
      </div>
      <div className="mt-auto" />
      {!g.result && (
        <div className="safe-bottom px-3 pb-2">
          <div className="run-panel flex items-stretch gap-1 p-1.5">
            <button className="run-btn ghost flex flex-1 flex-col items-center gap-0.5 px-1! py-1.5! text-[11px]" onClick={() => setConfirm(true)}>
              <Sprite name="cross" size={20} px={12} /> Resign
            </button>
          </div>
        </div>
      )}
      {confirm && (
        <Sheet onClose={() => setConfirm(false)}>
          <div className="text-center">
            <div className="run-title text-xl font-black">Resign this game?</div>
            <div className="run-sans mt-1 text-sm text-[var(--ink-dim)]">A loss knocks you out of the cup.</div>
            <div className="mt-4 flex gap-2">
              <button className="run-btn danger flex-1" onClick={() => (setConfirm(false), void s.resign())}>Resign</button>
              <button className="run-btn ghost flex-1" onClick={() => setConfirm(false)}>Keep playing</button>
            </div>
          </div>
        </Sheet>
      )}
      {g.result && <GameOverPanel onContinue={() => s.over && void finishRound(s.over)} />}
    </div>
  );
}
