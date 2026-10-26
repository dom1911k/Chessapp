import { useEffect, useState } from 'react';
import { Check, Lock } from 'lucide-react';
import { CosmeticPreview } from '../components/CosmeticPreview';
import { Header, Segmented } from '../components/ui';
import { useCelebrate } from '../lib/celebrate';
import { COSMETICS, equip, isEquipped, isUnlocked, unlockContext, unlockText, type Cosmetic, type CosmeticKind, type UnlockContext } from '../lib/rewards/cosmetics';
import { useSettings } from '../lib/settings';
import { previewPack } from '../lib/sound';

const KINDS: CosmeticKind[] = ['board', 'pieces', 'fx', 'hl', 'snd'];
const TAB: Record<CosmeticKind, string> = { board: 'Boards', pieces: 'Pieces', fx: 'Effects', hl: 'Colours', snd: 'Sounds' };

/** Boards, pieces, celebrations, move colours and sounds — unlocked by playing. */
export function CollectionScreen() {
  const [kind, setKind] = useState<CosmeticKind>('board');
  const [ctx, setCtx] = useState<UnlockContext | null>(null);
  const settings = useSettings();
  useEffect(() => void unlockContext().then(setCtx), []);
  const total = COSMETICS.length;
  const owned = ctx ? COSMETICS.filter((c) => isUnlocked(c, ctx)).length : 0;
  const items = COSMETICS.filter((c) => c.kind === kind);

  const tap = (c: Cosmetic) => {
    if (!ctx || !isUnlocked(c, ctx)) return;
    equip(c);
    if (c.kind === 'snd') previewPack(c.key);
    if (c.kind === 'fx') useCelebrate.getState().confetti({ style: c.key, force: true });
  };

  return (
    <div className="flex h-full flex-col">
      <Header title="Collection" subtitle={ctx ? `${owned} of ${total} unlocked` : undefined} back />
      <div className="mx-auto w-full max-w-xl px-4 pb-2">
        <div className="mb-3 h-2 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800">
          <div className="h-full rounded-full bg-gradient-to-r from-gold-400 to-gold-500 transition-all duration-700" style={{ width: `${(owned / total) * 100}%` }} />
        </div>
        <div className="-mx-1 overflow-x-auto px-1">
          <Segmented value={kind} onChange={setKind} options={KINDS.map((k) => ({ value: k, label: TAB[k] }))} />
        </div>
      </div>
      <div className="mx-auto grid w-full max-w-xl flex-1 auto-rows-min grid-cols-2 gap-2.5 overflow-y-auto px-4 pb-4 land:max-w-4xl land:grid-cols-4">
        {items.map((c) => {
          const open = !!ctx && isUnlocked(c, ctx);
          const on = isEquipped(c, settings);
          return (
            <button
              key={c.id}
              onClick={() => tap(c)}
              className={`card flex flex-col items-center gap-2 !p-3 text-center transition active:scale-[0.98] ${on ? '!ring-2 !ring-brand-500' : ''} ${open ? '' : 'opacity-70'}`}
            >
              <div className="relative">
                <div className={open ? '' : 'grayscale-[0.7]'}>
                  <CosmeticPreview c={c} size={72} />
                </div>
                {!open && (
                  <span className="absolute -right-1.5 -bottom-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-stone-700 text-white ring-2 ring-white dark:ring-stone-900">
                    <Lock size={14} />
                  </span>
                )}
                {on && (
                  <span className="absolute -right-1.5 -bottom-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-white ring-2 ring-white dark:ring-stone-900">
                    <Check size={15} strokeWidth={3} />
                  </span>
                )}
              </div>
              <span className="text-sm leading-tight font-semibold">{c.name}</span>
              <span className={`text-[11px] leading-tight ${open ? 'text-brand-700 dark:text-brand-500' : 'text-stone-500'}`}>
                {on ? 'In use' : open ? (c.unlock.kind === 'free' ? 'Tap to use' : 'Unlocked · tap to use') : unlockText(c.unlock)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
