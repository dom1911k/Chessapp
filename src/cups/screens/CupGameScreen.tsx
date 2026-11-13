// A cup game in pixel style: the opponent card, the VS slam, then a real game under Match
// conditions. The bottom bar holds Resign (and the charms, stage 3).
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
import { BoonRail } from '../ui/BoonRail';
import { PixelNum } from '../ui/bits';
import { CHARMS, goldFor, type BoonId, type CharmId } from '../boons';
import { advances } from '../ladder';
import { REPERTOIRES } from '../../lib/people/openings';
import { getGameRating } from '../../lib/rewards/rating';
import { battlefieldOptions, type StartPos } from '../battlefield';
import { useCupGame as useGameStore } from '../game';
import { buzz } from '../sfx';
import { TUNING } from '../tuning';
import { QuirkIcons, QuirkList } from '../ui/QuirkBadges';
import { getOpponentRecords } from '../../lib/people/record';
import { cupMemory, rivalLine } from '../story';
import { useCupsMeta } from '../meta';
import { CLASS_LABEL } from '../../lib/chess/evaluation';

function useNow(ms = 200) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

function Clock({ ms, running, low, flash = false }: { ms: number; running: boolean; low: boolean; flash?: boolean }) {
  return (
    <span className={`run-sans rounded px-2 py-0.5 text-lg font-black tabular-nums transition-shadow ${flash ? 'run-punch shadow-[0_0_0_3px_var(--gold),0_0_18px_var(--gold)]' : ''} ${running ? (low ? 'bg-[var(--blood)] text-white' : 'bg-[var(--gold-2)] text-[#1b0f22]') : 'bg-black/40 text-[var(--ink-dim)]'}`}>{fmtClock(ms)}</span>
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

/** Battlefield: three opening positions as mini-boards; pick one. */
function BattlefieldSheet({ color, onPick, onClose }: { color: 'w' | 'b'; onPick: (p: StartPos) => void; onClose: () => void }) {
  const [opts] = useState(() => battlefieldOptions(Math.random));
  return (
    <Sheet onClose={onClose}>
      <div className="run-label text-center">Battlefield · choose where the game starts</div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {opts.map((o) => (
          <button key={o.fen} className="run-panel flex flex-col items-center gap-1 p-1.5 active:scale-95" onClick={() => onPick(o)}>
            <div className="pointer-events-none w-full"><RunBoard fen={o.fen} orientation={color === 'w' ? 'white' : 'black'} movable={null} mini showCoordinates={false} /></div>
            <span className="run-sans text-[10px] leading-tight font-bold">{o.name}</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

/** Before the game: who you face, your colour, what a draw means, your scouting and pre-game charms. */
function OpponentCard({ g, onPlay }: { g: CupGameState; onPlay: () => void }) {
  const o = opponentById(g.opponentId);
  const cup = useCup();
  const c = cup.cup;
  const [colourOpen, setColourOpen] = useState(false);
  const [field, setField] = useState(false);
  const scout = c?.boons.includes('scoutReport');
  const has = (id: CharmId) => !!c?.charms.includes(id);
  const drawOdds = c?.boons.includes('drawOdds');
  return (
    <div className="run-fadeup flex h-full flex-col items-center overflow-y-auto px-6 pt-6 pb-6 text-center">
      <div className="run-label">{tierInfo(g.tier as CupTier).name} · {ROUND_NAMES[g.round]}</div>
      <PixelPortrait id={g.opponentId} size={128} boss={g.round === 2} className="mt-3 run-boss-glow" />
      <div className="run-title mt-2 text-3xl font-black">{o?.name}</div>
      <div className="run-sans text-sm text-[var(--ink-dim)]">plays at {g.elo} · {o?.tagline}</div>
      <div className="run-panel mt-4 w-full max-w-xs px-3 py-2 text-left">
        <div className="run-sans text-sm">You play <b>{g.userColor === 'w' ? 'White' : 'Black'}</b> · {g.timeControl.split('+')[0] === '600' ? '10 minutes' : g.timeControl}</div>
        <div className="run-sans mt-0.5 text-xs text-[var(--ink-dim)]">{g.userColor === 'b' || drawOdds ? 'A draw sends you through.' : 'With White you need a win; a draw sends them through.'}</div>
        {!!g.prelude?.length && <div className="run-sans mt-0.5 text-xs text-[var(--gold-2)]">Starts after {g.prelude.length} half-moves ({g.prelude.slice(0, 6).join(' ')}{g.prelude.length > 6 ? ' …' : ''}).</div>}
        {cup.note && <div className="run-sans mt-0.5 text-xs text-[var(--gold-2)]">{cup.note}</div>}
        <div className="run-sans mt-0.5 text-xs text-[var(--ink-dim)]">Match conditions: no take-backs, hints or coach.</div>
      </div>
      {(g.quirks.length > 0 || g.hidden) && (
        <div className="run-panel mt-2 w-full max-w-xs px-3 py-2 text-left">
          <div className="run-label mb-1">Quirks</div>
          <QuirkList quirks={g.quirks} hidden={g.hidden} scouted={!!scout} />
        </div>
      )}
      {scout && (
        <div className="run-panel mt-2 w-full max-w-xs px-3 py-2 text-left">
          <div className="run-label">Scout Report</div>
          <div className="run-sans text-sm">Favourite openings: <b>{REPERTOIRES[g.opponentId]?.favourite ?? 'nothing fixed — expect anything'}</b></div>
        </div>
      )}
      {(has('colour') || has('battlefield')) && (
        <div className="mt-3 flex w-full max-w-xs gap-2">
          {has('colour') && <button className="run-btn ghost flex-1 px-2! py-2! text-sm" onClick={() => setColourOpen(true)}>Choose colour</button>}
          {has('battlefield') && <button className="run-btn ghost flex-1 px-2! py-2! text-sm" onClick={() => setField(true)}>Battlefield</button>}
        </div>
      )}
      <button className="run-btn mt-5 w-full max-w-xs text-lg" onClick={onPlay}>Play</button>
      {colourOpen && (
        <Sheet onClose={() => setColourOpen(false)}>
          <div className="run-label text-center">Choose Your Colour</div>
          <div className="mt-3 flex gap-2">
            {(['w', 'b'] as const).map((col) => (
              <button key={col} className="run-btn flex-1" onClick={() => void cup.spendCharm('colour').then((ok) => (ok ? cup.pregame({ color: col }) : undefined)).then(() => setColourOpen(false))}>
                {col === 'w' ? 'White' : 'Black'}
              </button>
            ))}
          </div>
          <div className="run-sans mt-2 text-center text-xs text-[var(--ink-dim)]">With Black, a draw sends you through.</div>
        </Sheet>
      )}
      {field && <BattlefieldSheet color={g.userColor} onClose={() => setField(false)} onPick={(p) => void cup.spendCharm('battlefield').then((ok) => (ok ? cup.pregame({ start: p }) : undefined)).then(() => setField(false))} />}
    </div>
  );
}

function GameOverPanel({ onContinue }: { onContinue: () => void }) {
  const over = useCupGame((s) => s.over);
  const g = useCupGame((s) => s.game)!;
  const c = useCup((s) => s.cup);
  const o = opponentById(g.opponentId);
  const [shown, setShown] = useState(0);
  const [review, setReview] = useState(false);
  const through = over ? advances(over.userResult, g.userColor, !!c?.boons.includes('drawOdds')) : false;
  const gold = over ? goldFor({ userResult: over.userResult, advanced: through, accuracy: over.accuracy, greats: over.greats }) : { parts: [], total: 0 };
  // The gold lines slam in one by one (tap to skip), short and snappy.
  useEffect(() => {
    if (!over || shown >= gold.parts.length) return;
    const t = setTimeout(() => {
      setShown((n) => n + 1);
      sfx('coin');
      buzz(TUNING.juice.haptic.tick);
    }, shown === 0 ? 500 : 320);
    return () => clearTimeout(t);
  }, [over, shown, gold.parts.length]);
  if (!over) return <div className="run-sans fixed inset-x-0 bottom-24 z-30 text-center text-sm text-[var(--ink-dim)]">Recording the game…</div>;
  const title = over.userResult === 'win' ? 'Victory' : over.userResult === 'draw' ? 'Draw' : 'Defeat';
  const why = over.reason === 'checkmate' ? 'by checkmate' : over.reason === 'time' ? 'on time' : over.reason === 'resignation' ? 'by resignation' : over.reason;
  const goldNow = (c?.gold ?? 0) + gold.parts.slice(0, shown).reduce((n, p) => n + p.amount, 0);
  return (
    <Sheet>
      <div className="text-center" onClick={() => setShown(gold.parts.length)}>
        <PixelText text={title} size={4} color={over.userResult === 'loss' ? '#ff8c8c' : undefined} />
        <div className="run-sans mt-1 text-sm text-[var(--ink-dim)]">{why} · vs {o?.name}{over.userResult === 'draw' ? (through ? ' · you go through' : ' · they go through') : ''}</div>
        <div className="mt-4 flex justify-center gap-6">
          <div><div className="run-label">Accuracy</div><div className="run-title text-2xl font-black">{over.accuracy.toFixed(0)}%</div></div>
          <div><div className="run-label">Moves</div><div className="run-title text-2xl font-black">{over.moves}</div></div>
          <div><div className="run-label">Clock</div><div className="run-title text-2xl font-black">{fmtClock(over.clockLeft * 1000)}</div></div>
        </div>
        <div className="mx-auto mt-4 max-w-xs">
          <div className="flex items-center justify-between">
            <span className="run-label">Gold</span>
            <span key={goldNow} className="run-punch inline-flex items-center gap-1"><Sprite name="coin" size={18} px={10} stroke={5} /><PixelNum value={goldNow} size={3} /></span>
          </div>
          <div className="mt-1 min-h-[3.5rem] space-y-0.5">
            {gold.parts.slice(0, shown).map((p) => (
              <div key={p.label} className="run-slam run-sans flex justify-between text-sm"><span>{p.label}</span><b className="text-[var(--gold-2)]">+{p.amount}</b></div>
            ))}
            {!gold.parts.length && <div className="run-sans text-sm text-[var(--ink-dim)]">No gold this game.</div>}
          </div>
        </div>
        {over.biggestPly !== null && g.plies[over.biggestPly] && (
          <button className="run-btn ghost mt-3 w-full text-sm" onClick={(e) => (e.stopPropagation(), setReview(true))}>
            Review your biggest mistake ({Math.floor(over.biggestPly / 2) + 1}.{g.plies[over.biggestPly].san})
          </button>
        )}
        <button className="run-btn mt-3 w-full text-lg" onClick={onContinue}>Continue</button>
      </div>
      {review && over.biggestPly !== null && <MistakeReview g={g} ply={over.biggestPly} added={!!over.reviewAdded} onClose={() => setReview(false)} />}
    </Sheet>
  );
}

/** One tap: the position before your biggest mistake, what you played and what was better. */
function MistakeReview({ g, ply, added, onClose }: { g: CupGameState; ply: number; added: boolean; onClose: () => void }) {
  const p = g.plies[ply];
  const best = p.comment?.bestUci;
  return (
    <Sheet onClose={onClose} z={75}>
      <div className="run-label text-center">Your biggest mistake · move {Math.floor(ply / 2) + 1}</div>
      <div className="mx-auto mt-2 max-w-[300px]">
        <RunBoard
          fen={p.fenBefore}
          orientation={g.userColor === 'w' ? 'white' : 'black'}
          movable={null}
          arrows={[{ from: p.uci.slice(0, 2), to: p.uci.slice(2, 4), tone: 'bad' as const }, ...(best ? [{ from: best.slice(0, 2), to: best.slice(2, 4), tone: 'good' as const }] : [])]}
        />
      </div>
      <div className="run-sans mt-2 text-sm">
        You played <b>{p.san}</b>{p.classification ? ` (${CLASS_LABEL[p.classification].toLowerCase()})` : ''}. {best ? <>Better was the green arrow.</> : null}
      </div>
      {p.comment?.text.slice(0, 2).map((t) => <div key={t} className="run-sans mt-1 text-sm text-[var(--ink-dim)]">{t}</div>)}
      <div className="run-sans mt-2 text-xs text-[var(--gold-2)]">{added ? 'Added to your reviews (Daily training, “From a cup”).' : 'Already in your reviews.'}</div>
      <button className="run-btn mt-3 w-full" onClick={onClose}>Back</button>
    </Sheet>
  );
}

/** Candidate Cards: three moves on cards; tapping one plays it. */
function CandidateCards() {
  const s = useGameStore();
  if (!s.cands) return null;
  return (
    <div className="run-fadeup flex items-center justify-center gap-2 px-2 py-1.5">
      {s.cands.map((cd) => (
        <button key={cd.uci} className="run-panel run-deal px-3 py-2 active:scale-95" onClick={() => s.userMove({ from: cd.uci.slice(0, 2), to: cd.uci.slice(2, 4), promotion: cd.uci[4] as 'q' | undefined })}>
          <span className="run-title text-lg font-black">{cd.san}</span>
        </button>
      ))}
      <button className="run-sans px-2 text-xs text-[var(--ink-dim)]" onClick={s.dismissCands}>hide</button>
    </div>
  );
}

/** The moves so far, numbered, newest highlighted; scrolls to the latest. Opening moves the game
 *  started after (Home Prep, Battlefield) are shown dimmed. */
function CupMoveList({ prelude, sans, startFen }: { prelude: string[]; sans: string[]; startFen: string }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [sans.length]);
  const [, side, , , , full] = startFen.split(' ');
  type Tok = { no?: string; san: string; dim: boolean; last: boolean };
  const toks: Tok[] = [];
  const push = (list: string[], firstNo: number, blackFirst: boolean, dim: boolean, lastIdx: number) =>
    list.forEach((san, i) => {
      const k = i + (blackFirst ? 1 : 0);
      const no = firstNo + Math.floor(k / 2);
      toks.push({ no: k % 2 === 0 ? `${no}.` : i === 0 ? `${no}…` : undefined, san, dim, last: i === lastIdx });
    });
  if (prelude.length) push(prelude, 1, false, true, -1);
  push(sans, Number(full) || 1, side === 'b', false, sans.length - 1);
  if (!toks.length) return null;
  return (
    <div ref={box} className="run-sans mx-3 mt-1.5 max-h-[8.5rem] overflow-y-auto rounded bg-black/25 px-2 py-1 text-[13px] leading-6" style={{ boxShadow: 'inset 0 0 0 1px rgba(242,199,92,.18)' }} aria-label="Moves">
      {toks.map((t, i) => (
        <span key={i} className="mr-1.5 inline-block whitespace-nowrap">
          {t.no && <span className="mr-0.5 text-[var(--ink-dim)]">{t.no}</span>}
          <span className={t.last ? 'rounded bg-[var(--gold)]/25 px-1 font-bold text-[var(--gold-2)]' : t.dim ? 'text-[var(--ink-dim)] opacity-70' : 'text-[var(--ink)]'}>{t.san}</span>
        </span>
      ))}
    </div>
  );
}

/** The charms you hold, usable from the bar during the game. */
function CharmButton({ id, onUse, disabled }: { id: CharmId; onUse: () => void; disabled: boolean }) {
  const info = CHARMS[id];
  return (
    <button disabled={disabled} className="run-btn ghost flex flex-1 flex-col items-center gap-0.5 px-1! py-1.5! text-[11px] disabled:opacity-35" onClick={onUse} title={info.text}>
      <Sprite name={info.glyph} size={20} px={12} /> {info.name.replace('Candidate Cards', 'Candidates').replace('Choose Your Colour', 'Colour')}
    </button>
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
  const [greet, setGreet] = useState('');
  // Rivals remember: a line about your past cups or games against them, else their usual greeting.
  useEffect(() => {
    if (!o) return;
    void getOpponentRecords().then((recs) => {
      const line = rivalLine({ record: recs[o.id], ...cupMemory(useCupsMeta.getState().history ?? [], o.id) });
      setGreet(line ?? pickLine(o, 'greet'));
    });
  }, [o]);
  const cup = useCup((x) => x.cup);
  const spend = useCup((x) => x.spendCharm);
  const [rating, setRating] = useState(1100);
  useEffect(() => void getGameRating().then((r) => setRating(r.rating)), []);
  const flash = !!s.pulse && s.pulse.id === 'secondWind' && now - s.pulse.at < 1500;
  const useCharm = async (id: CharmId) => {
    if (id === 'rewind') {
      if (await spend('rewind')) s.rewind();
    } else if (id === 'threatBell') {
      if (await spend('threatBell')) s.armThreatBell();
    } else if (id === 'candidates') {
      if (await spend('candidates')) await s.showCandidates(rating);
    }
  };
  const canUse = (id: CharmId) => {
    if (CHARMS[id].pregame || g.result) return false;
    if (id === 'rewind') return g.plies.some((p) => p.isUser) && s.phase !== 'intro';
    if (id === 'threatBell') return !g.armed && (s.phase === 'userTurn' || s.phase === 'botThinking' || s.phase === 'analyzing');
    return s.phase === 'userTurn' && !s.cands;
  };

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
    <div className="relative flex h-full flex-col">
      <Bar
        face={<PixelPortrait id={g.opponentId} size={40} px={32} />}
        name={o?.name ?? 'Opponent'}
        sub={<><span className="font-semibold text-[var(--ink-dim)]">({g.elo})</span> <QuirkIcons /></>}
        clock={<Clock ms={oppMs} running={toMove === opp && !g.result} low={oppMs < 30_000} />}
        captured={<PixelCaptured pieces={mat.lost[me]} color={me} lead={opp === 'w' ? mat.diff : -mat.diff} />}
      />
      <div className="px-1">
        <RunBoard
          fen={fen}
          orientation={me === 'w' ? 'white' : 'black'}
          movable={s.phase === 'userTurn' ? me : null}
          onMove={(m) => s.userMove(m)}
          lastMove={last ? { from: last.uci.slice(0, 2), to: last.uci.slice(2, 4) } : null}
          highlights={s.warning ? [{ sq: s.warning.sq, tone: 'bad' }] : []}
          arrows={s.cands ? s.cands.map((cd) => ({ from: cd.uci.slice(0, 2), to: cd.uci.slice(2, 4), tone: 'info' as const })) : []}
        />
      </div>
      <Bar
        face={<PixelAvatar avatarId={avatar} url={avatarUrl(avatar)} size={40} px={32} />}
        name={myName}
        clock={<Clock ms={myMs} running={toMove === me && !g.result} low={myMs < 30_000} flash={flash} />}
        captured={<PixelCaptured pieces={mat.lost[opp]} color={opp} lead={me === 'w' ? mat.diff : -mat.diff} />}
      />
      {s.warning ? (
        <div className="run-sans run-fadeup mx-3 rounded bg-[var(--blood)]/25 px-2 py-1 text-xs text-[#ffd0d6]">🔔 Threat Bell: {s.warning.text} Choose again.</div>
      ) : (
        <div className="run-sans px-3 text-xs text-[var(--ink-dim)]">
          {g.armed ? 'Threat Bell is armed for your next move. ' : ''}
          {s.phase === 'botThinking' ? `${o?.name} is thinking…` : s.phase === 'userTurn' ? 'Your move' : s.phase === 'analyzing' ? '…' : ''}
        </div>
      )}
      <CandidateCards />
      <CupMoveList prelude={g.prelude ?? []} sans={g.plies.map((x) => x.san)} startFen={g.startFen} />
      <div className="mt-auto" />
      {cup && <BoonRail boons={cup.boons as BoonId[]} />}
      {!g.result && (
        <div className="safe-bottom px-3 pb-2">
          <div className="run-panel flex items-stretch gap-1 p-1.5">
            {(cup?.charms ?? []).map((id, k) => (
              <CharmButton key={`${id}-${k}`} id={id} disabled={!canUse(id)} onUse={() => void useCharm(id)} />
            ))}
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
