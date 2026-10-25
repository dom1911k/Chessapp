import { Chess } from 'chess.js';
import { useState } from 'react';
import { useNav } from '../lib/nav';
import { useSettings } from '../lib/settings';
import { usePlay } from '../lib/store/play';
import { Dialog } from './ui';

/** Button that turns any position into a game against the bot. */
export function PlayFromHere({ fen, color, label = '▶ Play from here' }: { fen: string; color?: 'w' | 'b'; label?: string }) {
  const [ask, setAsk] = useState(false);
  const setTab = useNav((s) => s.setTab);
  const elo = useSettings((s) => s.botElo);
  const g = usePlay((s) => s.game);
  if (new Chess(fen).isGameOver()) return null;
  const me = color ?? (fen.split(' ')[1] as 'w' | 'b');
  const start = async () => {
    setAsk(false);
    const play = usePlay.getState();
    if (play.game && play.phase !== 'over') await play.abandon();
    play.newGame(me, elo, fen);
    setTab('play');
  };
  const busy = g && g.plies.length > 0 && usePlay.getState().phase !== 'over';
  return (
    <>
      <button className="btn-secondary" onClick={() => (busy ? setAsk(true) : void start())}>
        {label}
      </button>
      <Dialog open={ask} onClose={() => setAsk(false)} title="Start a new game?">
        <p className="text-sm">Your current game will end{g && g.plies.filter((p) => p.isUser).length >= 3 ? ' (it counts as resigned)' : ''}.</p>
        <div className="mt-4 flex gap-2">
          <button className="btn-primary flex-1" onClick={() => void start()}>Play from here</button>
          <button className="btn-secondary flex-1" onClick={() => setAsk(false)}>Cancel</button>
        </div>
      </Dialog>
    </>
  );
}
