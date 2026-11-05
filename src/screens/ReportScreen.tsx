import { useEffect, useState } from 'react';
import { EvalGraph } from '../components/Charts';
import { ClassBadge, CoachBubble } from '../components/Coach';
import { Header, Spinner } from '../components/ui';
import { CLASS_LABEL, type Classification } from '../lib/chess/evaluation';
import { db } from '../lib/db';
import { THEMES } from '../lib/themes';
import { useNav } from '../lib/nav';
import { THEME_SETS } from '../lib/puzzles/themes';
import { opponentById } from '../lib/people';
import { formatDate } from '../lib/store/finish';
import type { AnyGame, ImportedGame } from '../lib/store/types';
import { ChessComBadge } from '../components/ChessCom';
import { trapById, trapCard, trapForLoss } from '../lib/traps';
import { loadAnyGame } from '../lib/games';
import { Pin } from 'lucide-react';
import { shortWords } from '../lib/chess/words';

const ORDER: Classification[] = ['best', 'good', 'inaccuracy', 'mistake', 'blunder'];

export function ReportScreen({ gameId }: { gameId: number | string }) {
  const [g, setG] = useState<AnyGame | null>(null);
  const [cards, setCards] = useState(0);
  const push = useNav((s) => s.push);

  useEffect(() => {
    void loadAnyGame(gameId).then(setG);
    void db.cards.where('id').startsWith(`m:${gameId}:`).count().then(setCards);
  }, [gameId]);

  // A quick chess.com loss to a known trap: make sure that trap is in the daily reviews.
  const trapId = g?.source === 'chess.com' ? trapForLoss(g)?.id : undefined;
  useEffect(() => {
    if (!trapId || !g) return;
    void db.cards.get(`t:${trapId}`).then(async (c) => {
      if (!c) await db.cards.put(trapCard(trapById(trapId)!, Date.now(), g as ImportedGame));
    });
  }, [trapId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!g) return <div className="flex h-full items-center justify-center"><Spinner /></div>;
  const s = g.summary;
  const pending = g.source === 'chess.com' && !(g as ImportedGame).analyzed;
  const trap = g.source === 'chess.com' ? trapForLoss(g) : null;
  const big = s.biggestMistakePly !== null ? g.plies[s.biggestMistakePly] : null;
  const lessonPuzzleTheme = s.lessonTheme ? THEMES[s.lessonTheme].puzzleThemes.find((t) => THEME_SETS.some((x) => x.id === t)) : undefined;
  const resultText = g.userResult === 'win' ? 'You won' : g.userResult === 'loss' ? 'You lost' : 'Draw';

  return (
    <div className="flex h-full flex-col">
      <Header title="Game report" back />
      <div className="mx-auto w-full max-w-xl flex-1 space-y-4 overflow-y-auto p-4">
        <div className="card">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-xl font-bold">{resultText}</div>
              <div className="text-sm text-stone-500">
                {g.source === 'chess.com' && <ChessComBadge />} vs {g.opponentName ?? opponentById(g.opponentId)?.name ?? 'Bot'} {g.source === 'chess.com' ? `(${g.elo})` : `~${g.elo}`} · {g.reason} · {formatDate(g.endedAt)}
              </div>
              {g.opening && <div className="text-sm text-stone-500">{g.opening}</div>}
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-brand-600">{s.accuracy}%</div>
              <div className="text-xs text-stone-500">accuracy</div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-5 gap-1 text-center">
            {ORDER.map((c) => (
              <div key={c}>
                <div className="text-lg font-bold">{s.counts[c]}</div>
                <div className="text-[10px] leading-tight text-stone-500">{CLASS_LABEL[c]}</div>
              </div>
            ))}
          </div>
        </div>

        {trap && (
          <CoachBubble mood="concerned" actions={<button className="btn-primary" onClick={() => push({ name: 'trap', trapId: trap.id })}>Learn the {trap.name}</button>}>
            <p className="font-semibold">Lost to a known trap: {trap.name}</p>
            <p>This game ended quickly, and it follows a trick people at your level love to try. I've added it to your daily reviews.</p>
          </CoachBubble>
        )}
        {pending && (
          <CoachBubble>
            <p>I haven't analysed this chess.com game yet — it's in the queue (newest games first). You can already step through the moves.</p>
          </CoachBubble>
        )}
        <div className="card !p-3">
          <div className="mb-2 text-sm font-semibold text-stone-500">Evaluation</div>
          <EvalGraph plies={g.plies} onSelect={(i) => push({ name: 'review', gameId, ply: i })} />
        </div>

        {big && (
          <div className="card">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-semibold text-stone-500">Biggest mistake</span>
              {big.classification && <ClassBadge c={big.classification} />}
            </div>
            <p className="font-semibold">
              {shortWords(big.fenBefore, big.uci)}
              {big.comment?.bestUci && <span className="font-normal text-stone-500"> — better: {shortWords(big.fenBefore, big.comment.bestUci).toLowerCase()}</span>}
            </p>
            {big.comment?.text.map((t, i) => (
              <p key={i} className="mt-1 text-[15px]">{t}</p>
            ))}
            <button className="btn-secondary mt-3" onClick={() => push({ name: 'review', gameId, ply: s.biggestMistakePly! })}>
              Jump there
            </button>
          </div>
        )}

        {s.pattern && (
          <div className="card border-l-4 border-amber-500">
            <div className="text-sm font-semibold text-amber-700 dark:text-amber-400">Pattern spotted</div>
            <p className="text-[15px]">
              {THEMES[s.pattern.theme].label} came up in <b>{s.pattern.count} of your last {s.pattern.of} games</b>. {THEMES[s.pattern.theme].lesson}
            </p>
          </div>
        )}
        {s.lessonText ? (
          <CoachBubble
            actions={
              <>
                <button className="btn-primary" onClick={() => push({ name: 'practice', theme: s.lessonTheme! })}>
                  Practise this (2 min)
                </button>
                {lessonPuzzleTheme && (
                  <button className="btn-secondary" onClick={() => push({ name: 'puzzle', mode: { kind: 'theme', theme: lessonPuzzleTheme } })}>
                    More {THEME_SETS.find((t) => t.id === lessonPuzzleTheme)?.label.toLowerCase()} puzzles
                  </button>
                )}
              </>
            }
          >
            <p className="font-semibold">One lesson for next time</p>
            <p>{s.lessonText}</p>
            <p className="text-sm text-stone-500">I'll mix more {THEMES[s.lessonTheme!].label.toLowerCase()} puzzles into your daily training this week.</p>
          </CoachBubble>
        ) : (
          <CoachBubble>
            <p>{s.counts.mistake + s.counts.blunder === 0 ? 'No real mistakes this game — excellent work!' : 'Keep it up!'}</p>
          </CoachBubble>
        )}

        {cards > 0 && (
          <p className="px-1 text-sm text-stone-500">
            <Pin size={14} className="mr-1 inline -translate-y-px" />{cards} {cards === 1 ? 'position from this game was' : 'positions from this game were'} added to your Daily training.
          </p>
        )}
        <button className="btn-primary w-full" onClick={() => push({ name: 'review', gameId, ply: 0 })}>
          Review the game
        </button>
      </div>
    </div>
  );
}
