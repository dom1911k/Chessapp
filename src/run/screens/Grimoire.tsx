// The Grimoire: every scenario you've met in runs (rooms, Vault drills, riddle themes), how
// often you cleared or failed it, and which ones you've mastered (3 clears in a row).
// The map leans toward the scenarios you fail most.
import { useMeta } from '../meta';
import { ROOM_SPRITE } from '../content';
import { isMastered, scenarioWeight, type ScenarioStat } from '../rules';
import { TUNING as T } from '../tuning';
import { drillById } from '../../lib/endgames';
import { THEME_SETS } from '../../lib/puzzles/themes';
import { Sprite } from '../pixel/sprites';
import { GOLD, SPIRIT } from '../pixel/pixelize';
import { PixelText } from './PixelText';

interface Entry {
  key: string;
  name: string;
  text: string;
  sprite: string;
}

const ROOMS: Entry[] = [
  { key: 'hold', name: 'The Siege', text: 'Hold a worse position for a few moves.', sprite: ROOM_SPRITE.hold },
  { key: 'keep', name: 'Harvest: Keep', text: 'Stay winning for a few moves.', sprite: ROOM_SPRITE.convert },
  { key: 'gain', name: 'Harvest: Gain', text: 'Win more material or mate in time.', sprite: ROOM_SPRITE.convert },
  { key: 'ward', name: 'The Ward', text: 'Find the move that stops the threat.', sprite: ROOM_SPRITE.ward },
  { key: 'duel', name: 'The Duel', text: 'Leave the opening without falling behind.', sprite: ROOM_SPRITE.duel },
  { key: 'echo', name: 'The Echo', text: 'Replay your own slip — and don’t repeat it.', sprite: ROOM_SPRITE.echo },
  { key: 'mirror', name: 'The Mirror', text: 'Read their idea first, then hold.', sprite: ROOM_SPRITE.mirror },
];
const VAULTS: Entry[] = (T.rooms.vault.drills as readonly string[]).map((id) => ({
  key: `vault:${id}`,
  name: drillById(id)?.title ?? id,
  text: 'Vault endgame against perfect defence.',
  sprite: ROOM_SPRITE.vault,
}));
const RIDDLES: Entry[] = THEME_SETS.map((t) => ({ key: `riddle:${t.id}`, name: t.label, text: t.description, sprite: ROOM_SPRITE.puzzle }));

export function GrimoireScreen({ onBack }: { onBack: () => void }) {
  const g = useMeta((m) => m.grimoire ?? {});
  const all = [...ROOMS, ...VAULTS, ...RIDDLES];
  const met = all.filter((e) => g[e.key]?.met).length;
  const mastered = all.filter((e) => isMastered(g[e.key])).length;
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 pt-3">
        <button className="run-btn ghost px-3! py-2!" onClick={onBack}>
          ← Back
        </button>
        <span className="run-sans text-xs text-[var(--ink-dim)]">
          {met}/{all.length} met · {mastered} mastered
        </span>
      </div>
      <div className="mt-2 flex flex-col items-center">
        <Sprite name="book" size={44} px={16} pal={GOLD} />
        <PixelText text="Grimoire" size={3} className="mt-1" />
        <div className="run-sans mt-1 px-6 text-center text-xs text-[var(--ink-dim)]">
          Every scenario you meet in a run. {T.grimoire.masteredStreak} clears in a row masters it. The map brings back the ones you fail most.
        </div>
      </div>
      <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        <Section title="Rooms" entries={ROOMS} g={g} />
        <Section title="Vault drills" entries={VAULTS} g={g} />
        <Section title="Riddle themes" entries={RIDDLES} g={g} />
      </div>
    </div>
  );
}

function Section({ title, entries, g }: { title: string; entries: Entry[]; g: Record<string, ScenarioStat> }) {
  return (
    <>
      <div className="run-label mt-3 mb-1.5">{title}</div>
      <div className="space-y-2">
        {entries.map((e) => (
          <Row key={e.key} e={e} s={g[e.key]} weight={scenarioWeight(g, e.key)} />
        ))}
      </div>
    </>
  );
}

function Row({ e, s, weight }: { e: Entry; s?: ScenarioStat; weight: number }) {
  const done = isMastered(s);
  const seen = !!s?.met;
  return (
    <div className={`run-panel flex items-center gap-3 p-2.5 ${seen ? '' : 'opacity-55'}`}>
      <Sprite name={seen ? e.sprite : 'question'} size={30} px={14} pal={done ? GOLD : SPIRIT} />
      <div className="min-w-0 flex-1">
        <div className="run-title flex items-center gap-1.5 text-sm font-bold">
          {e.name}
          {done && <span className="run-sans rounded bg-[var(--gold)] px-1 text-[9px] font-black text-[#241503]">MASTERED</span>}
          {!done && weight > 1.01 && <span className="run-sans rounded bg-[#4a1020] px-1 text-[9px] font-black text-[#ffb3bd]">COMES UP MORE</span>}
        </div>
        <div className="run-sans truncate text-[11px] text-[var(--ink-dim)]">{seen ? e.text : 'Not met yet.'}</div>
      </div>
      {seen && (
        <div className="run-sans shrink-0 text-right text-[11px] leading-tight">
          <div>
            met <b>{s!.met}</b>
          </div>
          <div>
            <span className="text-[#5ee59a]">✓{s!.cleared}</span> <span className="text-[var(--blood)]">✕{s!.failed}</span>
          </div>
          {!done && s!.streak > 0 && (
            <div className="text-[var(--ink-dim)]">
              {s!.streak}/{T.grimoire.masteredStreak} in a row
            </div>
          )}
        </div>
      )}
    </div>
  );
}
