// The More tab, chess.com style: your profile on top, then everything else as a plain list.
import { type ReactNode } from 'react';
import { Award, BookMarked, ChartColumn, ChevronRight, Clock3, CloudDownload, Crosshair, Eye, Gem, History, Lightbulb, Map, Microscope, Network, Settings, Skull, Target } from 'lucide-react';
import { Header } from '../components/ui';
import { LevelBadge } from '../components/Gamification';
import { useNav, type Screen } from '../lib/nav';
import { useSettings } from '../lib/settings';

interface Item {
  icon: ReactNode;
  label: string;
  sub?: string;
  to: Screen;
}

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: 'Your games',
    items: [
      { icon: <ChartColumn size={19} />, label: 'Stats', sub: 'Ratings, record, accuracy, best wins', to: { name: 'profile' } },
      { icon: <Lightbulb size={19} />, label: 'Insights', sub: 'Phase, openings, colour, time of day, speed', to: { name: 'insights' } },
      { icon: <History size={19} />, label: 'Game history', sub: 'Every game with its Game Review', to: { name: 'history' } },
      { icon: <Target size={19} />, label: 'My mistakes', sub: 'What keeps going wrong, with positions', to: { name: 'mistakes' } },
      { icon: <Microscope size={19} />, label: 'Analysis board', sub: 'Engine lines and your own variations', to: { name: 'explore', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', orientation: 'white', title: 'Analysis' } },
    ],
  },
  {
    title: 'Prepare for humans',
    items: [
      { icon: <Crosshair size={19} />, label: 'What you face', sub: 'Openings your opponents play', to: { name: 'face' } },
      { icon: <Skull size={19} />, label: 'Traps', sub: 'Spot them, and set them', to: { name: 'traps' } },
      { icon: <BookMarked size={19} />, label: 'Openings', sub: 'Your repertoire', to: { name: 'openings' } },
      { icon: <Clock3 size={19} />, label: 'Time drills', sub: 'Convert a win, move fast', to: { name: 'timeDrill', kind: 'convert' } },
      { icon: <Eye size={19} />, label: 'Vision', sub: 'Learn the board’s coordinates by heart', to: { name: 'vision' } },
    ],
  },
  {
    title: 'Rewards',
    items: [
      { icon: <Map size={19} />, label: 'Rating journey', to: { name: 'journey' } },
      { icon: <Award size={19} />, label: 'Achievements', to: { name: 'achievements' } },
      { icon: <Network size={19} />, label: 'Skill tree', to: { name: 'skills' } },
      { icon: <Gem size={19} />, label: 'Collection', sub: 'Boards, pieces and sounds', to: { name: 'collection' } },
    ],
  },
];

export function MoreScreen() {
  const push = useNav((s) => s.push);
  const ccUser = useSettings((s) => s.ccUsername);
  return (
    <div className="flex h-full flex-col">
      <Header title="More" />
      <div className="mx-auto w-full max-w-xl flex-1 space-y-4 overflow-y-auto p-4">
        <button className="card flex w-full items-center gap-3 !p-3 text-left active:scale-[0.99]" onClick={() => push({ name: 'profile' })}>
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-2xl font-black text-white">{(ccUser || 'Y')[0].toUpperCase()}</span>
          <span className="flex-1">
            <span className="block text-lg font-bold">{ccUser || 'You'}</span>
            <span className="mt-0.5 block">
              <LevelBadge />
            </span>
          </span>
          <span className="text-sm font-semibold text-brand-700 dark:text-brand-500">Profile</span>
          <ChevronRight size={18} className="text-stone-400" />
        </button>
        {GROUPS.map((g) => (
          <section key={g.title}>
            <h2 className="mb-1.5 section-title">{g.title}</h2>
            <div className="card divide-y divide-stone-100 !p-0 dark:divide-stone-800">
              {g.items.map((it) => (
                <Row key={it.label} item={it} onClick={() => push(it.to)} />
              ))}
            </div>
          </section>
        ))}
        <div className="card divide-y divide-stone-100 !p-0 dark:divide-stone-800">
          <Row item={{ icon: <CloudDownload size={19} />, label: 'chess.com import', sub: ccUser ? `Linked to ${ccUser}` : 'Bring in your games (optional, uses the internet)', to: { name: 'settings' } }} onClick={() => push({ name: 'settings' })} />
          <Row item={{ icon: <Settings size={19} />, label: 'Settings', sub: 'Board, sounds, coach, backup', to: { name: 'settings' } }} onClick={() => push({ name: 'settings' })} />
        </div>
      </div>
    </div>
  );
}

function Row({ item, onClick }: { item: Item; onClick: () => void }) {
  return (
    <button className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-stone-100 dark:active:bg-stone-800" onClick={onClick}>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-200">{item.icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{item.label}</span>
        {item.sub && <span className="block truncate text-xs text-stone-500">{item.sub}</span>}
      </span>
      <ChevronRight size={18} className="text-stone-400" />
    </button>
  );
}
