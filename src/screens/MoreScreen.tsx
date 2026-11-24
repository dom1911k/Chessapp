// The More tab, chess.com style: your profile (and stats) on top, then everything else as a plain
// list, one row per screen.
import { UserAvatar } from '../components/UserAvatar';
import { useEffect, useState, type ReactNode } from 'react';
import { Award, ChevronRight, CloudDownload, Gem, History, Lightbulb, Map, Microscope, Settings, Target } from 'lucide-react';
import { Header } from '../components/ui';
import { SeenNumber } from '../components/Odometer';
import { getGameRating } from '../lib/rewards/rating';
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
      { icon: <History size={19} />, label: 'Game history', sub: 'Every game with its Game Review', to: { name: 'history' } },
      { icon: <Target size={19} />, label: 'My mistakes', sub: 'What keeps going wrong, with positions', to: { name: 'mistakes' } },
      { icon: <Lightbulb size={19} />, label: 'Insights', sub: 'Phase, openings, colour, time of day, speed', to: { name: 'insights' } },
      { icon: <Microscope size={19} />, label: 'Analysis board', sub: 'Engine lines and your own variations', to: { name: 'explore', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', orientation: 'white', title: 'Analysis' } },
    ],
  },
  {
    title: 'Rewards',
    items: [
      { icon: <Map size={19} />, label: 'Rating journey', to: { name: 'journey' } },
      { icon: <Award size={19} />, label: 'Achievements', to: { name: 'achievements' } },
      { icon: <Gem size={19} />, label: 'Collection', sub: 'Boards, pieces and sounds', to: { name: 'collection' } },
    ],
  },
];

export function MoreScreen() {
  const push = useNav((s) => s.push);
  const tab = useNav((s) => s.tab);
  const [rating, setRating] = useState<number | null>(null);
  useEffect(() => {
    if (tab === 'more') void getGameRating().then((r) => setRating(r.rating));
  }, [tab]);
  const ccUser = useSettings((s) => s.ccUsername);
  return (
    <div className="flex h-full flex-col">
      <Header title="More" />
      <div className="mx-auto w-full max-w-xl flex-1 space-y-4 overflow-y-auto p-4">
        <button className="card tile flex w-full items-center gap-3 !p-3 text-left transition-[filter] active:brightness-95" onClick={() => push({ name: 'profile' })}>
          <UserAvatar size={56} />
          <span className="flex-1">
            <span className="block text-lg font-bold">{ccUser || 'You'}</span>
            <span className="mt-0.5 flex items-center gap-1 text-[13px] text-stone-500 dark:text-stone-400" data-testid="more-rating">
              Rating <SeenNumber k="more.rating" value={rating} className="font-bold text-stone-800 dark:text-stone-100" />
            </span>
          </span>
          <span className="text-sm font-semibold text-brand-700 dark:text-brand-500">Profile and stats</span>
          <ChevronRight size={18} className="text-stone-400" />
        </button>
        {GROUPS.map((g) => (
          <section key={g.title}>
            <h2 className="mb-1.5 section-title">{g.title}</h2>
            <div className="card divide-y divide-stone-100 overflow-hidden !p-0 dark:divide-white/[0.06]">
              {g.items.map((it) => (
                <Row key={it.label} item={it} tint={g.title === 'Rewards' ? 'gold' : 'green'} onClick={() => push(it.to)} />
              ))}
            </div>
          </section>
        ))}
        <div className="card divide-y divide-stone-100 overflow-hidden !p-0 dark:divide-white/[0.06]">
          <Row item={{ icon: <CloudDownload size={19} />, label: 'chess.com import', sub: ccUser ? `Linked to ${ccUser}` : 'Bring in your games (optional, uses the internet)', to: { name: 'settings' } }} onClick={() => push({ name: 'settings' })} />
          <Row item={{ icon: <Settings size={19} />, label: 'Settings', sub: 'Board, sounds, coach, backup', to: { name: 'settings' } }} onClick={() => push({ name: 'settings' })} />
        </div>
      </div>
    </div>
  );
}

// The same tinted icon tiles as the lists in Learn > Practice.
const TINT = {
  green: 'bg-brand-100 text-brand-700 dark:bg-brand-700/25 dark:text-brand-100',
  gold: 'bg-gold-300/45 text-[#8a6416] dark:bg-gold-500/20 dark:text-gold-300',
  stone: 'bg-stone-200 text-stone-600 dark:bg-stone-800 dark:text-stone-300',
};

function Row({ item, onClick, tint = 'stone' }: { item: Item; onClick: () => void; tint?: keyof typeof TINT }) {
  return (
    <button className="flex w-full items-center gap-3 px-3.5 py-3 text-left press" onClick={onClick}>
      <span className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[32%] ${TINT[tint]}`}>{item.icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold leading-tight">{item.label}</span>
        {item.sub && <span className="mt-0.5 block truncate text-xs text-stone-500">{item.sub}</span>}
      </span>
      <ChevronRight size={17} className="shrink-0 text-stone-400" />
    </button>
  );
}
