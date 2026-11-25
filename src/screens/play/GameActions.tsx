// The choices of the moment where the Dock sits (a paused mistake, the pre-check, game over).
import { type ReactNode } from 'react';
import { EllipsisVertical } from 'lucide-react';
import { useNav } from '../../lib/nav';
import { usePlay } from '../../lib/store/play';
import { setLastColour } from '../../lib/colour';

/** Same opponent, strength, time control and mode (match or coached), colours swapped like on
 *  chess.com. The colour you get counts as the last colour for Alternate. */
export function rematch(s: ReturnType<typeof usePlay.getState>) {
  const g = s.game!;
  const color = g.userColor === 'w' ? 'b' : 'w';
  void setLastColour(color).catch(() => undefined);
  // Play Coach again with Sam at the same level; otherwise the same real game, colours swapped.
  if (g.coach) s.newGame(color, g.elo, undefined, 'coach', { coach: g.coach });
  else s.newGame(color, g.elo, undefined, g.opponentId, { match: true, timeControl: g.timeControl });
}

export type ActionKind = 'paused' | 'precheck' | 'over';

/** The choices of the moment, in a fixed row where the Dock sits (44px buttons, at most three per row). */
export function GameActions({ kind, onMore }: { kind: ActionKind; onMore: () => void }) {
  const s = usePlay();
  const push = useNav((n) => n.push);
  const row = 'mx-auto flex max-w-md gap-2';
  let body: ReactNode;
  if (kind === 'precheck' && s.precheck) {
    body = (
      <div className="space-y-1">
        <div className={row}>
          <button className="btn-primary !min-h-11 flex-1 !px-3" onClick={s.dismissPrecheck}>Let me think again</button>
          {!s.precheck.revealed && <button className="btn-secondary !min-h-11 flex-1 !px-3" onClick={s.revealPrecheck}>Show me why</button>}
          {s.precheck.revealed && <button className="btn-ghost !min-h-11 flex-1 !px-3" onClick={s.confirmPrecheck}>Play it anyway</button>}
        </div>
        {!s.precheck.revealed && (
          <div className="flex justify-center">
            <button className="btn-ghost !min-h-9 !py-1 text-sm" onClick={s.confirmPrecheck}>Play it anyway</button>
          </div>
        )}
      </div>
    );
  } else if (kind === 'paused') {
    body = (
      <div className={row}>
        <button className="btn-primary !min-h-11 flex-1" onClick={s.tryAgain}>Try again</button>
        <button className="btn-secondary !min-h-11 flex-1" onClick={s.continueGame}>Continue</button>
      </div>
    );
  } else {
    const id = s.over?.gameId ?? 0;
    body = (
      <div className={row}>
        {id > 0 && <button className="btn-primary !min-h-11 flex-[1.4]" onClick={() => push({ name: 'report', gameId: id })}>Game Review</button>}
        <button className={`${id > 0 ? 'btn-secondary' : 'btn-primary'} !min-h-11 flex-1`} onClick={() => rematch(s)}>Rematch</button>
        <button className="btn-secondary !min-h-11 w-11 shrink-0 !px-0" aria-label="More options" onClick={onMore}><EllipsisVertical size={20} /></button>
      </div>
    );
  }
  return (
    <div className="safe-bottom z-10 shrink-0 border-t border-black/[0.08] bg-white px-3 pt-2 pb-1.5 dark:border-white/[0.06] dark:bg-stone-900" data-testid="game-actions">
      {body}
    </div>
  );
}
