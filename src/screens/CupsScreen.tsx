// Bot cups: pick a cup, play your knockout matches as real games, collect the trophy.
import { useEffect, useState } from 'react';
import { Lock, Swords, Trophy } from 'lucide-react';
import { Portrait } from '../components/Coach';
import { UserAvatar, useMyName } from '../components/UserAvatar';
import { Header } from '../components/ui';
import { CUPS, ROUND_NAMES, TIERS, YOU, addTrophy, champion, cupXp, currentRound, getCup, getTrophies, newCup, playRound, saveCup, tierOpen, yourColor, yourOpponent, type CupState, type CupTier, type Trophies } from '../lib/cups';
import { timeControlLabel } from '../lib/chesscom/parse';
import { db } from '../lib/db';
import { useNav } from '../lib/nav';
import { opponentById } from '../lib/people';
import { awardXp } from '../lib/progress/xp';
import { playSound } from '../lib/sound';
import { useCelebrate } from '../lib/celebrate';
import { usePlay } from '../lib/store/play';

const TONE: Record<CupTier, string> = {
  bronze: 'from-[#f0b48a] to-[#a8612f]',
  silver: 'from-[#eef1f4] to-[#8d96a0]',
  gold: 'from-[#ffe680] to-[#d19a16]',
};

function Face({ id, size = 34, out = false }: { id: string; size?: number; out?: boolean }) {
  return <span className={out ? 'opacity-35 grayscale' : ''}>{id === YOU ? <UserAvatar size={size} /> : <Portrait id={id} size={size} />}</span>;
}

/** The bracket: one column per round, winners carried forward. */
function Bracket({ c }: { c: CupState }) {
  const me = useMyName();
  const name = (id: string) => (id === YOU ? me : opponentById(id)?.name ?? id);
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
      <div className="flex min-w-max gap-3">
        {[0, 1, 2].map((r) => {
          const alive = c.rounds[r];
          const winners = c.rounds[r + 1];
          return (
            <div key={r} className="flex w-[168px] shrink-0 flex-col justify-around gap-2">
              <div className="section-title !px-0">{ROUND_NAMES[r]}</div>
              {Array.from({ length: 4 >> r }, (_, m) => {
                const pair: (string | null)[] = alive ? [alive[m * 2], alive[m * 2 + 1]] : [null, null];
                const won = winners?.[m];
                return (
                  <div key={m} className={`card !rounded-2xl !p-2 ${pair.includes(YOU) && !won ? 'ring-2 ring-amber-400' : ''}`}>
                    {pair.map((id, k) => (
                      <div key={k} className={`flex items-center gap-2 py-0.5 ${won && id !== won ? 'text-stone-400' : ''}`}>
                        {id ? <Face id={id} size={26} out={!!won && id !== won} /> : <span className="h-[26px] w-[26px] rounded-[30%] bg-stone-200 dark:bg-stone-800" />}
                        <span className={`min-w-0 flex-1 truncate text-sm ${won === id ? 'font-bold' : 'font-medium'}`}>{id ? name(id) : '—'}</span>
                        {id && id !== YOU && <span className="text-[11px] text-stone-400 tabular-nums">{opponentById(id)?.elo}</span>}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CupsScreen() {
  const onTop = useNav((s) => s.stack[s.stack.length - 1]?.name === 'cups');
  const setTab = useNav((s) => s.setTab);
  const [cup, setCup] = useState<CupState | null | undefined>(undefined);
  const [trophies, setTrophies] = useState<Trophies>({});
  const [fresh, setFresh] = useState<{ xp: number } | null>(null);
  const running = usePlay((s) => (s.game && s.phase !== 'over' && s.phase !== 'setup' ? s.game : null));

  // On coming back: pick up the result of the match you were sent to play.
  useEffect(() => {
    if (!onTop) return;
    void (async () => {
      setTrophies(await getTrophies());
      let c = await getCup();
      if (c?.awaiting) {
        const aw = c.awaiting;
        const games = (await db.games.toArray()).filter((g) => g.opponentId === aw.opponentId && g.endedAt > aw.since);
        const g = games.sort((a, b) => b.endedAt - a.endedAt)[0];
        if (g) {
          c = playRound(c, g.userResult);
          await saveCup(c);
          if (c.place) {
            const xp = cupXp(c.tier, c.place);
            if (xp) await awardXp(xp);
            if (c.place === 'winner') {
              setTrophies(await addTrophy(c.tier));
              useCelebrate.getState().confetti({ force: true });
              playSound('reward');
            }
            setFresh({ xp });
          }
        }
      }
      setCup(c);
    })();
  }, [onTop]);

  const enter = async (tier: CupTier) => {
    const c = newCup(tier, Math.floor(Math.random() * 1e9));
    await saveCup(c);
    setFresh(null);
    setCup(c);
  };

  const playMatch = async () => {
    if (!cup) return;
    const oppId = yourOpponent(cup)!;
    const o = opponentById(oppId)!;
    const color = yourColor(cup);
    const next = { ...cup, awaiting: { opponentId: oppId, since: Date.now(), color } };
    await saveCup(next);
    setCup(next);
    if (running) await usePlay.getState().abandon();
    usePlay.getState().newGame(color, o.elo, undefined, o.id, { match: true, timeControl: CUPS[cup.tier].timeControl });
    setTab('play');
  };

  const leave = async () => {
    await saveCup(null);
    setFresh(null);
    setCup(null);
  };

  if (cup === undefined) return <div className="flex h-full flex-col"><Header title="Cups" back /></div>;

  const opp = cup ? yourOpponent(cup) : null;
  const o = opp ? opponentById(opp) : null;
  const champ = cup ? champion(cup) : null;
  return (
    <div className="flex h-full flex-col">
      <Header title={cup ? CUPS[cup.tier].name : 'Cups'} back />
      <div className="mx-auto w-full max-w-xl flex-1 space-y-4 overflow-y-auto p-4">
        {!cup && (
          <>
            <p className="px-1 text-sm text-stone-600 dark:text-stone-400">An eight-player knockout: you and seven bots. Your matches are real games under match conditions — clock on, no coach. Win three in a row to lift the cup.</p>
            {TIERS.map((t) => {
              const open = tierOpen(t, trophies);
              const n = trophies[t] ?? 0;
              return (
                <div key={t} className={`card flex items-center gap-3.5 !p-3.5 ${open ? '' : 'opacity-60'}`}>
                  <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[30%] bg-gradient-to-br text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_8px_16px_-8px_rgba(0,0,0,0.5)] ${TONE[t]}`}>
                    {open ? <Trophy size={28} /> : <Lock size={24} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-lg leading-tight font-semibold">{CUPS[t].name}</span>
                    <span className="block text-xs text-stone-500">{open ? CUPS[t].blurb : `Win the ${CUPS[CUPS[t].needs!].name} first.`}</span>
                    <span className="mt-0.5 block text-xs text-stone-500">
                      {timeControlLabel(CUPS[t].timeControl)} · +{CUPS[t].xp.winner} XP{n ? <> · <b className="text-amber-600 dark:text-amber-400">won {n}×</b></> : null}
                    </span>
                  </span>
                  <button className="btn-primary !px-5" disabled={!open} onClick={() => void enter(t)}>Enter</button>
                </div>
              );
            })}
            <p className="px-1 text-xs text-stone-400">Winning a cup also unlocks a frame and a title for your avatar (Profile → tap your picture).</p>
          </>
        )}
        {cup && (
          <>
            {cup.place ? (
              <div className="card flex flex-col items-center gap-2 !p-5 text-center">
                <span className={`animate-badge-pop flex h-20 w-20 items-center justify-center rounded-[30%] bg-gradient-to-br text-white ${cup.place === 'winner' ? TONE[cup.tier] : 'from-stone-300 to-stone-500'}`}>
                  <Trophy size={40} />
                </span>
                <h2 className="font-display text-2xl font-semibold">
                  {cup.place === 'winner' ? 'You won the cup!' : cup.place === 'final' ? 'Runner-up' : cup.place === 'semi' ? 'Out in the semi-final' : 'Out in the quarter-final'}
                </h2>
                <p className="text-sm text-stone-600 dark:text-stone-300">
                  {cup.place === 'winner' ? `Three wins in a row. The ${CUPS[cup.tier].name} is yours.` : champ && champ !== YOU ? `${opponentById(champ)?.name} went on to win it.` : ''}
                </p>
                {cupXp(cup.tier, cup.place) > 0 && <span className="chip bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">+{cupXp(cup.tier, cup.place)} XP{fresh ? '' : ' earned'}</span>}
                {cup.place === 'winner' && <p className="text-xs text-stone-500">New avatar frame and title unlocked.</p>}
                <button className="btn-primary mt-2 w-full" onClick={() => void leave()}>Back to the cups</button>
              </div>
            ) : (
              o && (
                <div className="card !p-3.5">
                  <div className="text-[11px] font-bold tracking-[0.08em] text-stone-500 uppercase">{ROUND_NAMES[currentRound(cup)]} · your match</div>
                  <div className="mt-2 flex items-center gap-3">
                    <UserAvatar size={52} />
                    <Swords size={18} className="text-stone-400" />
                    <Portrait id={o.id} size={52} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-lg leading-tight font-semibold">{o.name} <span className="text-sm font-normal text-stone-400">{o.elo}</span></span>
                      <span className="block text-xs text-stone-500">You play {yourColor(cup) === 'w' ? 'White' : 'Black'} · {timeControlLabel(CUPS[cup.tier].timeControl)}</span>
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-stone-500">{yourColor(cup) === 'b' ? 'You have Black, so a draw sends you through.' : 'You have White: you need a win; a draw sends your opponent through.'}</p>
                  {cup.awaiting ? (
                    <button className="btn-primary mt-3 w-full" onClick={() => (running ? (usePlay.getState().setAway(false), setTab('play')) : void playMatch())}>{running ? 'Back to the game' : 'Play the match'}</button>
                  ) : (
                    <button className="btn-primary mt-3 w-full !py-3.5 text-base" onClick={() => void playMatch()}>Play the match</button>
                  )}
                  {running && !cup.awaiting && <p className="mt-1.5 text-center text-xs text-stone-500">This ends your game in progress.</p>}
                </div>
              )
            )}
            <Bracket c={cup} />
            {!cup.place && <button className="mx-auto block text-xs font-semibold text-stone-400" onClick={() => void leave()}>Withdraw from this cup</button>}
          </>
        )}
      </div>
    </div>
  );
}
