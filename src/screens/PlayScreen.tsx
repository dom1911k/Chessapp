import { useEffect, useMemo, useState } from 'react';
import { eloLabel, MAX_ELO, MIN_ELO } from '../lib/bot';
import { povScore, winPct } from '../lib/chess/evaluation';
import { safetyInfo } from '../lib/coach';
import { START_FEN } from '../lib/chess/game';
import { detectOpening } from '../lib/openings';
import { useNav } from '../lib/nav';
import { useSettings } from '../lib/settings';
import { currentFen, turnOf, usePlay } from '../lib/store/play';
import { Board } from '../components/Board';
import { CoachBubble, FlagButton } from '../components/Coach';
import { Dialog, EvalBar, Header, Segmented, Spinner } from '../components/ui';
import { MoveList } from '../components/MoveList';
import type { CoachArrow, CoachHighlight } from '../lib/coach/types';

export function PlayScreen() {
  const phase = usePlay((s) => s.phase);
  const game = usePlay((s) => s.game);
  if (phase === 'loading') return <div className="flex h-full items-center justify-center"><Spinner /></div>;
  if (!game || phase === 'setup') return <SetupView />;
  return <GameView />;
}

function SetupView() {
  const settings = useSettings();
  const newGame = usePlay((s) => s.newGame);
  const push = useNav((s) => s.push);
  const start = () => {
    const color = settings.colorPref === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : settings.colorPref;
    newGame(color, settings.botElo);
  };
  return (
    <div className="flex h-full flex-col">
      <Header title="Play" right={<SettingsButton />} />
      <div className="mx-auto w-full max-w-md flex-1 space-y-4 overflow-y-auto p-4">
        <CoachBubble>
          <p>Ready for a game? I'll watch your moves and help you whenever something goes wrong.</p>
        </CoachBubble>
        <div className="card space-y-4">
          <div>
            <div className="mb-2 text-sm font-semibold text-stone-500">You play</div>
            <Segmented
              value={settings.colorPref}
              onChange={(v) => settings.set({ colorPref: v })}
              options={[
                { value: 'w', label: '♔ White' },
                { value: 'b', label: '♚ Black' },
                { value: 'random', label: '🎲 Random' },
              ]}
            />
          </div>
          <div>
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-sm font-semibold text-stone-500">Bot strength</span>
              <span className="text-sm font-bold">
                ~{settings.botElo} <span className="font-normal text-stone-500">· {eloLabel(settings.botElo)}</span>
              </span>
            </div>
            <input
              type="range"
              min={MIN_ELO}
              max={MAX_ELO}
              step={50}
              value={settings.botElo}
              onChange={(e) => settings.set({ botElo: Number(e.target.value) })}
              className="w-full accent-brand-600"
            />
          </div>
          <button className="btn-primary w-full !py-3 text-base" onClick={start}>
            Start game
          </button>
        </div>
        <button className="btn-ghost w-full" onClick={() => push({ name: 'history' })}>
          Past games
        </button>
      </div>
    </div>
  );
}

export function SettingsButton() {
  const push = useNav((s) => s.push);
  return (
    <button className="btn-ghost !px-2" aria-label="Settings" onClick={() => push({ name: 'settings' })}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    </button>
  );
}

function GameView() {
  const s = usePlay();
  const settings = useSettings();
  const push = useNav((n) => n.push);
  const [menu, setMenu] = useState(false);
  const g = s.game!;
  const fen = currentFen(g);
  const orientation = g.userColor === 'w' ? 'white' : 'black';
  const last = g.plies[g.plies.length - 1];
  const opening = useMemo(() => (g.startFen === START_FEN ? detectOpening(g.plies.map((p) => p.san)) : null), [g.plies, g.startFen]);
  const myTurn = s.phase === 'userTurn' && turnOf(fen) === g.userColor;

  const arrows: CoachArrow[] = [];
  const highlights: CoachHighlight[] = [];
  if (s.phase === 'paused' && s.comment) {
    arrows.push(...s.comment.comment.arrows);
    highlights.push(...s.comment.comment.highlights);
  }
  if (s.hint) {
    arrows.push(...s.hint.arrows);
    highlights.push(...s.hint.highlights);
  }
  const note = s.threat ?? s.botNote;
  if (note && s.phase === 'userTurn') {
    arrows.push(...note.arrows);
    highlights.push(...note.highlights);
  }
  const safety = useMemo(
    () => (settings.safetyOverlay && myTurn ? safetyInfo(fen, g.userColor) : null),
    [settings.safetyOverlay, myTurn, fen, g.userColor],
  );
  if (safety) {
    arrows.push(...safety.arrows);
    highlights.push(...safety.highlights);
  }

  const lastEval = [...g.plies].reverse().find((p) => p.evalAfter)?.evalAfter;
  const whitePct = lastEval ? winPct(povScore(lastEval, 'w')) : 50;
  const userPlies = g.plies.filter((p) => p.isUser).length;

  useEffect(() => {
    if (s.over) setMenu(false);
  }, [s.over]);

  const whyNot = () => {
    const lastUser = [...g.plies].reverse().find((p) => p.isUser);
    push({
      name: 'explore',
      fen: lastUser ? lastUser.fenBefore : fen,
      orientation,
      title: 'Why not this move?',
    });
  };

  return (
    <div className="flex h-full flex-col">
      <Header
        title={opening ? opening.name : 'Play'}
        right={
          <button className="btn-ghost !px-2" onClick={() => setMenu(true)} aria-label="Game menu">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="12" cy="19" r="2" />
            </svg>
          </button>
        }
      />
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col overflow-y-auto">
        <div className="flex items-center justify-between px-3 pb-1.5 text-sm">
          <span className="font-semibold">
            🤖 Bot <span className="font-normal text-stone-500">~{g.elo}</span>
          </span>
          {s.phase === 'botThinking' && (
            <span className="flex items-center gap-1.5 text-stone-500">
              <Spinner /> thinking…
            </span>
          )}
          {s.phase === 'analyzing' && (
            <span className="flex items-center gap-1.5 text-stone-500">
              <Spinner /> coach is looking…
            </span>
          )}
        </div>
        <div className="flex gap-1.5 px-1.5">
          {settings.showEvalBar && <EvalBar whitePct={whitePct} orientation={orientation} />}
          <div className="flex-1">
            <Board
              fen={fen}
              orientation={orientation}
              movable={myTurn ? g.userColor : null}
              onMove={s.userMove}
              arrows={arrows}
              highlights={highlights}
              lastMove={last ? { from: last.uci.slice(0, 2), to: last.uci.slice(2, 4) } : null}
              showCoordinates={settings.showCoordinates}
              confirm={settings.confirmMoves}
            />
          </div>
        </div>
        <MoveList plies={g.plies} startFen={g.startFen} />
        <div className="space-y-3 px-3 pb-3">
          <CoachPanel opening={opening && g.plies.length <= 12 ? opening : null} safetyMessages={safety?.messages ?? []} />
        </div>
      </div>
      {!s.over && (
        <div className="mx-auto grid w-full max-w-xl grid-cols-5 gap-1 border-t border-stone-200 bg-stone-100 px-3 py-2 dark:border-stone-800 dark:bg-stone-950">
          <ActionButton label={s.hint ? `Hint ${s.hint.level}/3` : 'Hint'} icon="💡" disabled={!myTurn || s.hint?.level === 3} onClick={s.requestHint} />
          <ActionButton label="Threats?" icon="🎯" disabled={!myTurn} onClick={s.requestThreat} />
          <ActionButton label="Take back" icon="↶" disabled={userPlies === 0 || !['userTurn', 'paused', 'botThinking'].includes(s.phase)} onClick={s.takeback} />
          <ActionButton label="Why not…?" icon="🔍" disabled={userPlies === 0} onClick={whyNot} />
          <ActionButton
            label="Safety"
            icon="🛡️"
            active={settings.safetyOverlay}
            onClick={() => settings.set({ safetyOverlay: !settings.safetyOverlay })}
          />
        </div>
      )}
      <Dialog open={menu} onClose={() => setMenu(false)} title="Game">
        <div className="space-y-2">
          <button
            className="btn-secondary w-full"
            onClick={() => {
              setMenu(false);
              void s.resign();
            }}
          >
            🏳️ Resign
          </button>
          <button
            className="btn-secondary w-full"
            onClick={() => {
              setMenu(false);
              void s.abandon();
            }}
          >
            New game
          </button>
          <button className="btn-ghost w-full" onClick={() => setMenu(false)}>
            Cancel
          </button>
        </div>
      </Dialog>
    </div>
  );
}

function ActionButton({ label, icon, onClick, disabled, active }: { label: string; icon: string; onClick: () => void; disabled?: boolean; active?: boolean }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-xs font-semibold transition active:scale-95 disabled:opacity-35 ${
        active ? 'bg-brand-100 text-brand-700 dark:bg-brand-700/30 dark:text-brand-100' : 'text-stone-700 dark:text-stone-200'
      }`}
    >
      <span className="text-lg leading-none">{icon}</span>
      {label}
    </button>
  );
}

function CoachPanel({ opening, safetyMessages }: { opening: { name: string; idea: string } | null; safetyMessages: string[] }) {
  const s = usePlay();
  const push = useNav((n) => n.push);
  const g = s.game!;

  if (s.over) {
    const { userResult } = resultFor(s.over.result, g.userColor);
    const text =
      userResult === 'win' ? 'You won! 🎉 Let\'s look at what went well.' : userResult === 'draw' ? `It's a draw (${s.over.reason}).` : s.over.reason === 'resignation' ? 'Game over. Every game teaches us something!' : 'Checkmate — the bot got you this time. Let\'s learn from it!';
    return (
      <CoachBubble
        mood={userResult === 'loss' ? 'concerned' : 'happy'}
        actions={
          <>
            {s.over.gameId > 0 && (
              <button className="btn-primary" onClick={() => push({ name: 'report', gameId: s.over!.gameId })}>
                See game report
              </button>
            )}
            <button className="btn-secondary" onClick={s.leaveGame}>
              New game
            </button>
          </>
        }
      >
        <p>{text}</p>
      </CoachBubble>
    );
  }

  if (s.phase === 'paused' && s.comment) {
    const c = s.comment.comment;
    return (
      <CoachBubble
        mood="concerned"
        badge={c.classification}
        actions={
          <>
            <button className="btn-primary" onClick={s.tryAgain}>
              Try again
            </button>
            <button className="btn-secondary" onClick={s.continueGame}>
              Continue
            </button>
          </>
        }
      >
        {c.text.map((t, i) => (
          <p key={i}>{t}</p>
        ))}
        <Flag ply={s.comment.ply} />
      </CoachBubble>
    );
  }

  if (s.hint) return <CoachBubble mood="thinking"><p>{s.hint.text}</p></CoachBubble>;
  if (s.threat) return <CoachBubble mood="thinking"><p>🎯 {s.threat.text}</p></CoachBubble>;
  if (s.message) return <CoachBubble><p>{s.message}</p></CoachBubble>;

  const items = [];
  if (safetyMessages.length) items.push(<CoachBubble key="safety" mood="concerned"><p>🛡️ {safetyMessages.join(' ')}</p></CoachBubble>);
  if (s.comment && s.comment.ply >= g.plies.length - 2) {
    const c = s.comment.comment;
    items.push(
      <CoachBubble key="c" badge={c.classification} mood={c.classification === 'blunder' || c.classification === 'mistake' ? 'concerned' : 'happy'}>
        {c.text.map((t, i) => (
          <p key={i}>{t}</p>
        ))}
        {c.classification !== 'best' && c.classification !== 'good' && <Flag ply={s.comment.ply} />}
      </CoachBubble>,
    );
  }
  if (s.botNote && s.phase === 'userTurn') {
    items.push(
      <CoachBubble key="bot" mood="concerned">
        <p>🤖 {s.botNote.text}</p>
      </CoachBubble>,
    );
  } else if (opening && !(s.comment && s.comment.ply >= g.plies.length - 2)) {
    items.push(
      <CoachBubble key="o">
        <p className="font-semibold">{opening.name}</p>
        <p>{opening.idea}</p>
      </CoachBubble>,
    );
  } else if (g.plies.length === 0) {
    items.push(
      <CoachBubble key="start">
        <p>{g.userColor === 'w' ? 'You have the white pieces. Tap a piece, then tap where it should go.' : 'You have black. The bot moves first.'}</p>
      </CoachBubble>,
    );
  }
  return <>{items}</>;
}

function Flag({ ply }: { ply: number }) {
  const g = usePlay((s) => s.game);
  const p = g?.plies[ply];
  if (!p?.comment) return null;
  return <FlagButton fen={p.fenBefore} uci={p.uci} comment={p.comment} />;
}

export function resultFor(result: string, userColor: 'w' | 'b') {
  const userResult = result === '1/2-1/2' ? 'draw' : (result === '1-0') === (userColor === 'w') ? 'win' : 'loss';
  return { userResult };
}
