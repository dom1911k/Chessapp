// "Plays: Turtle · Endgame Grinder" under a character's name: their player types with the Cups
// glyphs, 12px. Mei's change per game, so hers reads "Plays one of:". (Round 7.)
import { quirkById } from '../lib/playerTypes';
import type { Opponent } from '../lib/people';
import { Sprite } from '../cups/pixel/sprites';
import type { SpritePalette } from '../cups/pixel/pixelize';

/** A quiet stone palette, so the glyphs read like the chips' other icons in both themes. */
const STONE: SpritePalette = { outline: '#292524', dark: '#57534e', mid: '#a8a29e', light: '#e7e5e4', shine: '#ffffff' };

export function PlaysLine({ o }: { o: Opponent }) {
  const ids = o.typePool ?? o.types ?? [];
  const qs = ids.map(quirkById).filter((q): q is NonNullable<typeof q> => !!q);
  if (!qs.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[12px]" data-testid="plays-line">
      <span className="text-stone-500 dark:text-stone-400">{o.typePool ? 'Plays one of:' : 'Plays:'}</span>
      {qs.map((q) => (
        <span key={q.id} className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 font-semibold text-stone-700 dark:bg-stone-800 dark:text-stone-200" data-type={q.id}>
          <Sprite name={q.glyph} size={12} px={12} pal={STONE} />
          {q.name}
        </span>
      ))}
    </div>
  );
}
