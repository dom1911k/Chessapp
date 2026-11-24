// Start your rating from chess.com: the Profile card ("Your chess.com rapid rating is 512. Start
// your rating here at 512?") and the same action as a row on the chess.com account card. After the
// start, a one-line confirmation takes their place. Nothing celebrates.
import { useEffect, useState } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { ccOffer, hideCcOffer, startFromChessCom, type CcOffer } from '../lib/chesscom/startRating';
import { useNav } from '../lib/nav';
import { plural } from '../lib/plural';
import { useSettings } from '../lib/settings';

const COPY = 'Your games here then count from your chess.com level. Your game history stays.';

/** `card`: Profile → Stats, only with a gap over 150 and not hidden. `row`: the chess.com account card, whenever the ratings differ. */
export function CcRatingStart({ variant, onDone, reloadKey }: { variant: 'card' | 'row'; onDone?: () => void; reloadKey?: unknown }) {
  const user = useSettings((s) => s.ccUsername);
  const push = useNav((s) => s.push);
  const [offer, setOffer] = useState<CcOffer | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ rating: number; looks: number } | null>(null);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let alive = true;
    void ccOffer(user).then((o) => alive && setOffer(o));
    return () => {
      alive = false;
    };
  }, [user, reloadKey]);

  if (done) {
    const text = (
      <span className="min-w-0 flex-1 text-sm">
        Rating set to {done.rating}.{done.looks > 0 && <> {plural(done.looks, 'new look')} in your Collection.</>}
      </span>
    );
    const cls = `flex w-full items-center gap-2 text-left ${variant === 'card' ? 'card !p-3' : 'rounded-xl bg-stone-100 px-3 py-2.5 dark:bg-stone-800'}`;
    return done.looks > 0 ? (
      <button className={`${cls} press`} onClick={() => push({ name: 'collection' })} data-testid="cc-start-done">
        <Check size={16} className="shrink-0 text-brand-600 dark:text-brand-500" />
        {text}
        <ChevronRight size={16} className="shrink-0 text-stone-400" />
      </button>
    ) : (
      <div className={cls} data-testid="cc-start-done">
        <Check size={16} className="shrink-0 text-brand-600 dark:text-brand-500" />
        {text}
      </div>
    );
  }
  if (!offer?.cc || hidden) return null;
  const cc = offer.cc;
  if (variant === 'card' ? !offer.show : cc.rating === offer.rating) return null;

  const start = async () => {
    setBusy(true);
    const r = await startFromChessCom(cc.rating);
    setBusy(false);
    setDone({ rating: cc.rating, looks: r.newLooks });
    onDone?.();
  };

  if (variant === 'row')
    return (
      <div className="rounded-xl bg-stone-100 px-3 py-2.5 dark:bg-stone-800" data-testid="cc-start-row">
        <div className="flex items-center gap-3">
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Start my rating from chess.com</span>
            <span className="block text-xs text-stone-500 dark:text-stone-400">
              {cc.cls === 'rapid' ? 'Rapid' : 'Blitz'} {cc.rating} · here {offer.rating}
            </span>
          </span>
          <button className="btn-primary shrink-0 !px-3 !py-1.5 text-sm" disabled={busy} onClick={() => void start()}>
            Start at {cc.rating}
          </button>
        </div>
        <p className="mt-1.5 text-xs text-stone-500 dark:text-stone-400">{COPY}</p>
      </div>
    );

  return (
    <div className="card space-y-2.5 !p-3" data-testid="cc-start">
      <p className="text-[15px] leading-snug">
        Your chess.com {cc.cls} rating is <b className="tabular-nums">{cc.rating}</b>. Start your rating here at {cc.rating}?
      </p>
      <div className="flex gap-2">
        <button className="btn-primary flex-1" disabled={busy} onClick={() => void start()} data-testid="cc-start-go">
          Start at {cc.rating}
        </button>
        <button
          className="btn-secondary flex-1"
          disabled={busy}
          onClick={() => {
            setHidden(true);
            void hideCcOffer(cc.rating);
          }}
          data-testid="cc-start-later"
        >
          Not now
        </button>
      </div>
      <p className="text-xs text-stone-500 dark:text-stone-400">{COPY}</p>
    </div>
  );
}
