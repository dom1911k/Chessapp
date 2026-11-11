// What you face: the openings in my chess.com games, by colour, with my score, the usual line
// against me, where I go wrong, and a button to practise the line.
import { EmptyState } from '../components/ui';
import { Eye } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Header, Segmented, Spinner } from '../components/ui';
import { Board } from '../components/Board';
import { ChessComBadge, ImportProgress } from '../components/ChessCom';
import { db } from '../lib/db';
import { useNav } from '../lib/nav';
import { useSettings } from '../lib/settings';
import { whatYouFace, type FacedOpening } from '../lib/face';
import { formatLine, START_FEN } from '../lib/chess/game';
import { ECO } from '../lib/openings';
import type { Color } from '../lib/chess/pos';

export function FaceScreen() {
  const [list, setList] = useState<FacedOpening[] | null>(null);
  const [color, setColor] = useState<Color>('w');
  const user = useSettings((s) => s.ccUsername);
  const push = useNav((s) => s.push);
  useEffect(() => void db.imported.toArray().then((gs) => setList(whatYouFace(gs))), []);
  const shown = list?.filter((o) => o.color === color) ?? [];
  return (
    <div className="flex h-full flex-col">
      <Header title="What you face" back subtitle="From your chess.com games" />
      <div className="mx-auto w-full max-w-xl flex-1 space-y-3 overflow-y-auto p-4">
        {!list ? (
          <div className="flex justify-center p-8"><Spinner /></div>
        ) : list.length === 0 ? (
          <EmptyState
            icon={<Eye size={26} />}
            title={user ? 'Not enough games yet' : 'Link your chess.com account'}
            text={user ? 'This needs at least two of your chess.com games in the same opening. Sync in Settings and they will be analysed.' : 'Add your chess.com username and this screen shows what people play against you — and where you go wrong.'}
            action={<button className="btn-secondary" onClick={() => push({ name: 'settings' })}>Open Settings</button>}
          />
        ) : (
          <>
            <Segmented value={color} onChange={setColor} options={[{ value: 'w', label: 'As White' }, { value: 'b', label: 'As Black' }]} />
            <ImportProgress />
            {shown.length === 0 && <p className="text-center text-sm text-stone-500">No opening with 2+ games as {color === 'w' ? 'White' : 'Black'} yet.</p>}
            {shown.map((o) => (
              <OpeningCard key={o.name} o={o} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function OpeningCard({ o }: { o: FacedOpening }) {
  const push = useNav((s) => s.push);
  const [open, setOpen] = useState(false);
  const idea = ECO.find((e) => e.name === o.name)?.idea;
  const practise = () => push({ name: 'openingPractice', index: 0, custom: { name: o.name, line: o.line, side: o.color, idea } });
  return (
    <div className="card space-y-2 !p-3">
      <button className="flex w-full items-start gap-2 text-left" onClick={() => setOpen(!open)}>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{o.name}</span>
          <span className="block text-xs text-stone-500">
            <ChessComBadge /> {o.games} games · <b className="text-emerald-600">{o.w}W</b> {o.d}D <b className="text-red-500">{o.l}L</b>
          </span>
        </span>
        <span className={`text-xl font-bold ${o.score >= 55 ? 'text-emerald-600' : o.score < 45 ? 'text-red-500' : ''}`}>{o.score}%</span>
      </button>
      {o.line.length > 0 && (
        <div className="text-sm">
          <span className="text-stone-500">Usual line: </span>
          {formatLine(START_FEN, o.line)}
          <span className="text-stone-500"> — then your games go different ways.</span>
        </div>
      )}
      {o.trouble && (
        <div className="rounded-xl bg-amber-50 p-2 text-sm dark:bg-amber-900/20">
          You've gone wrong here <b>{o.trouble.times} times</b>: move {Math.floor(o.trouble.ply / 2) + 1}, you played <b>{o.trouble.played}</b>
          {o.trouble.better ? <> — {o.trouble.better} was better.</> : '.'}
        </div>
      )}
      {open && o.trouble && (
        <div className="mx-auto w-full max-w-xs">
          <Board fen={o.trouble.fenBefore} orientation={o.color === 'w' ? 'white' : 'black'} movable={null} />
        </div>
      )}
      <div className="flex gap-2">
        {o.line.length >= 2 && (
          <button className="btn-primary flex-1 !py-2 text-sm" onClick={practise}>
            Practise this line
          </button>
        )}
        {o.trouble && (
          <button className="btn-secondary flex-1 !py-2 text-sm" onClick={() => push({ name: 'review', gameId: o.trouble!.gameId, ply: o.trouble!.ply })}>
            See the game
          </button>
        )}
      </div>
    </div>
  );
}
