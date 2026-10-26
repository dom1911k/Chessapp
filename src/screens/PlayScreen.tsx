import { useEffect, useMemo, useRef, useState } from 'react';
import { eloLabel, MAX_ELO, MIN_ELO } from '../lib/bot';
import { povScore, scoreToCp, winPct } from '../lib/chess/evaluation';
import { safetyInfo } from '../lib/coach';
import { START_FEN } from '../lib/chess/game';
import { detectOpening } from '../lib/openings';
import { useNav } from '../lib/nav';
import { useSettings } from '../lib/settings';
import { currentFen, turnOf, usePlay } from '../lib/store/play';
import { Board } from '../components/Board';
import { CoachBubble, FlagButton, Portrait } from '../components/Coach';
import { OPPONENTS, opponentById, type Mood } from '../lib/people';
import { LevelBadge } from '../components/Gamification';
import { getOpponentRecords, isUnlocked, type OpponentRecord } from '../lib/people/record';
import { REPERTOIRES } from '../lib/people/openings';
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
  const custom = settings.opponentId === 'custom';
  const [records, setRecords] = useState<Record<string, OpponentRecord>>({});
  useEffect(() => void getOpponentRecords().then(setRecords), []);
  const chosen = opponentById(settings.opponentId);
  const opp = custom ? null : chosen && isUnlocked(chosen.id, records) ? chosen : OPPONENTS[1];
  const rec = opp ? records[opp.id] : undefined;
  const start = () => {
    const color = settings.colorPref === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : settings.colorPref;
    newGame(color, opp ? opp.elo : settings.botElo, undefined, opp?.id);
  };
  return (
    <div className="flex h-full flex-col">
      <Header title="Play" right={<><LevelBadge /><SettingsButton /></>} />
      <div className="mx-auto w-full max-w-md flex-1 space-y-4 overflow-y-auto p-4">
        <div>
          <div className="mb-2 px-1 text-sm font-semibold text-stone-500">Choose your opponent</div>
          <div className="grid grid-cols-3 gap-2">
            {OPPONENTS.map((o, i) => {
              const open = isUnlocked(o.id, records);
              const stars = records[o.id]?.stars ?? 0;
              return (
                <button
                  key={o.id}
                  disabled={!open}
                  onClick={() => settings.set({ opponentId: o.id })}
                  className={`card relative flex flex-col items-center !p-2 transition ${opp?.id === o.id ? '!ring-2 !ring-brand-600' : ''}`}
                >
                  <Portrait id={o.id} size={56} mood={opp?.id === o.id ? 'happy' : 'neutral'} className={open ? '' : 'opacity-40 grayscale'} />
                  {!open && <span className="absolute top-8 text-xl">🔒</span>}
                  <span className="mt-1 text-sm font-semibold leading-tight">{o.name}</span>
                  <span className="text-xs text-stone-500">{open ? o.elo : `Beat ${OPPONENTS[i - 1].name}`}</span>
                  {open && <span className="text-xs leading-none tracking-tight">{'★'.repeat(stars)}<span className="text-stone-300 dark:text-stone-600">{'★'.repeat(3 - stars)}</span></span>}
                </button>
              );
            })}
          </div>
          <button className={`mt-2 w-full rounded-xl px-3 py-2 text-left text-sm ${custom ? 'bg-brand-100 font-semibold text-brand-700 dark:bg-brand-700/30 dark:text-brand-100' : 'text-stone-500'}`} onClick={() => settings.set({ opponentId: 'custom' })}>
            ⚙️ Custom strength…
          </button>
        </div>
        {opp ? (
          <div className="card flex gap-3">
            <Portrait id={opp.id} size={64} />
            <div>
              <div className="font-bold">{opp.name} <span className="font-normal text-stone-500">· ~{opp.elo}</span></div>
              <div className="text-xs font-semibold text-brand-700 dark:text-brand-500">{opp.tagline}</div>
              <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">{opp.bio}</p>
              {REPERTOIRES[opp.id] && <p className="mt-1 text-xs text-stone-500">📖 Favourite: {REPERTOIRES[opp.id].favourite}</p>}
              {rec && rec.w + rec.l + rec.d > 0 && (
                <p className="mt-0.5 text-xs text-stone-500">
                  Your record: {rec.w}W · {rec.d}D · {rec.l}L{rec.stars < 3 && rec.w > 0 ? ' — win with fewer hints for more ★' : ''}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-sm font-semibold text-stone-500">Bot strength</span>
              <span className="text-sm font-bold">
                ~{settings.botElo} <span className="font-normal text-stone-500">· {eloLabel(settings.botElo)}</span>
              </span>
            </div>
            <input type="range" min={MIN_ELO} max={MAX_ELO} step={50} value={settings.botElo} onChange={(e) => settings.set({ botElo: Number(e.target.value) })} className="w-full accent-brand-600" />
          </div>
        )}
        <div className="card space-y-3">
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
          <button className="btn-primary w-full !py-3 text-base" onClick={start}>
            Play {opp ? opp.name : 'the bot'}
          </button>
        </div>
        <button className="btn-ghost w-full" onClick={() => push({ name: 'history' })}>
          Past games
        </button>
      </div>
    </div>
  );
}

/** Opponent row above the board: portrait (mood follows the game), name and chat bubble. */
function OpponentBar() {
  const s = usePlay();
  const g = s.game!;
  const o = opponentById(g.opponentId);
  const lastEval = [...g.plies].reverse().find((p) => p.evalAfter)?.evalAfter;
  const botCp = lastEval ? scoreToCp(povScore(lastEval, g.userColor === 'w' ? 'b' : 'w')) : 0;
  const recentChat = s.chat && s.chat.ply >= g.plies.length - 1 ? s.chat : null;
  const mood: Mood = recentChat ? recentChat.mood : botCp > 150 ? 'happy' : botCp < -150 ? 'worried' : 'neutral';
  const thinking = s.phase === 'botThinking';
  return (
    <div className="flex items-start gap-2 px-3 pb-1.5">
      {o ? <Portrait id={o.id} mood={mood} size={40} /> : <span className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-200 text-xl dark:bg-stone-800">🤖</span>}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold">{o ? o.name : 'Bot'}</span>
          <span className="text-stone-500">~{g.elo}</span>
          {thinking && <span className="flex items-center gap-1 text-xs text-stone-500"><Spinner className="!h-3 !w-3" /> thinking…</span>}
          {s.phase === 'analyzing' && <span className="flex items-center gap-1 text-xs text-stone-500"><Spinner className="!h-3 !w-3" /> coach is looking…</span>}
        </div>
        {recentChat && (
          <div key={recentChat.text + recentChat.ply} className="animate-pop mt-0.5 inline-block rounded-2xl rounded-tl-sm bg-white px-3 py-1.5 text-sm shadow-sm ring-1 ring-stone-200 dark:bg-stone-800 dark:ring-stone-700">
            {recentChat.text}
          </div>
        )}
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
      <div className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col">
        <OpponentBar />
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
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-1 pb-3">
          <CoachPanel safetyMessages={safety?.messages ?? []} />
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

function CoachPanel({ safetyMessages }: { safetyMessages: string[] }) {
  const s = usePlay();
  const push = useNav((n) => n.push);
  const settings = useSettings();
  const g = s.game!;
  const feed = g.feed ?? [];
  const [all, setAll] = useState(false);
  const items = all ? feed : feed.slice(-8);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [feed.length, s.phase, s.over]);

  const paused = s.phase === 'paused';
  const rematch = () => s.newGame(g.userColor, g.elo, undefined, g.opponentId);
  return (
    <div className="space-y-2.5">
      {feed.length > items.length && (
        <button className="w-full text-center text-xs font-semibold text-stone-500" onClick={() => setAll(true)}>
          Show {feed.length - items.length} earlier messages
        </button>
      )}
      {items.map((it, k) => {
        const latest = k === items.length - 1;
        const p = it.ply >= 0 ? g.plies[it.ply] : undefined;
        const showActions = latest && ((paused && it.kind === 'comment') || (s.over && it.kind === 'result'));
        return (
          <CoachBubble
            key={it.id}
            compact={!latest}
            mood={it.mood ?? 'happy'}
            badge={it.classification}
            actions={
              showActions ? (
                paused ? (
                  <>
                    <button className="btn-primary" onClick={s.tryAgain}>Try again</button>
                    <button className="btn-secondary" onClick={s.continueGame}>Continue</button>
                  </>
                ) : s.over ? (
                  <>
                    {s.over.gameId > 0 && (
                      <button className="btn-primary" onClick={() => push({ name: 'report', gameId: s.over!.gameId })}>See game report</button>
                    )}
                    <button className="btn-secondary" onClick={rematch}>Rematch</button>
                    <button className="btn-ghost" onClick={s.leaveGame}>New opponent</button>
                  </>
                ) : null
              ) : undefined
            }
          >
            {it.kind === 'comment' && p && <p className="text-xs font-semibold text-stone-500">{p.san}</p>}
            {it.text.map((t, i) => (
              <p key={i} className={it.kind === 'opening' && i === 0 ? 'font-semibold' : ''}>{t}</p>
            ))}
            {latest && it.kind === 'comment' && p?.comment && it.classification !== 'best' && it.classification !== 'good' && (
              <FlagButton fen={p.fenBefore} uci={p.uci} comment={p.comment} />
            )}
          </CoachBubble>
        );
      })}
      {safetyMessages.length > 0 && settings.safetyOverlay && (
        <CoachBubble compact mood="concerned">
          <p>🛡️ {safetyMessages.join(' ')}</p>
        </CoachBubble>
      )}
      {s.phase === 'analyzing' && (
        <div className="flex items-center gap-2 pl-12 text-sm text-stone-500">
          <Spinner className="!h-3 !w-3" /> Coach Sam is looking at your move…
        </div>
      )}
      <div ref={end} />
    </div>
  );
}

export function resultFor(result: string, userColor: 'w' | 'b') {
  const userResult = result === '1/2-1/2' ? 'draw' : (result === '1-0') === (userColor === 'w') ? 'win' : 'loss';
  return { userResult };
}
