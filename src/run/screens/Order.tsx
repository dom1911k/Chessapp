// The Order (replaces the Sanctum): an 8×8 board where you place and upgrade buildings with
// materials from your runs. Buildings reach like chess pieces; a building reached by others is
// Empowered. Tap a building to see its reach, tap an empty square to move it there (free).
import { useEffect, useMemo, useState } from 'react';
import { BOOSTS, MILESTONES, UNLOCKS, boardUnlocked, milestoneSeals, piecesUnlocked, useMeta } from '../meta';
import {
  BUILDINGS, BUILDING_IDS, EMPTY_ORDER, MATERIAL_INFO, UNLOCK_BUILDING, buildCost, buildingAt, canAfford, cosmeticCost, empowerment, reach, reclaimCost, squareState, SQUARES,
  type Materials,
} from '../order';
import { TUNING as T } from '../tuning';
import { useRunSettings } from '../settings';
import { sfx, buzz } from '../sfx';
import { BOARD_THEMES, PIECE_SETS, pieceSprite, tileSprite, squareVariant } from '../pixel/board';
import { PixelPortrait, Sprite } from '../pixel/sprites';
import { GOLD, SPIRIT } from '../pixel/pixelize';
import { MaterialIcon, MaterialRow } from './bits';
import { PixelText } from './PixelText';
import { GrimoireScreen } from './Grimoire';
import { CodexScreen } from './Codex';

const PIECE_LETTER = { b: 'B', r: 'R', n: 'N', p: 'P' } as const;

export function OrderScreen({ onBack, start }: { onBack: () => void; start?: 'codex' }) {
  const m = useMeta();
  const [sub, setSub] = useState<null | 'grimoire' | 'codex' | 'goals' | 'gallery'>(start ?? null);
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => void m.load(), [m]);
  const o = m.order ?? EMPTY_ORDER;
  if (sub === 'grimoire') return <GrimoireScreen onBack={() => setSub(null)} />;
  if (sub === 'codex') return <CodexScreen onBack={() => (start ? onBack() : setSub(null))} />;
  if (sub === 'goals') return <Goals onBack={() => setSub(null)} />;
  if (sub === 'gallery') return <Gallery onBack={() => setSub(null)} />;
  const selB = sel ? buildingAt(o, sel) : undefined;

  const tap = (sq: string) => {
    const here = buildingAt(o, sq);
    // A building selected + an empty open square: move it (free).
    if (selB && !here && squareState(o, sq) === 'open') {
      if (m.moveBuilding(selB, sq)) {
        sfx('move');
        buzz(10);
        setSel(sq);
      }
      return;
    }
    setSel(sel === sq ? null : sq);
    sfx('card');
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 px-4 pt-3">
        <button className="run-btn ghost shrink-0 px-3! py-2!" onClick={onBack}>
          ← Back
        </button>
        <MaterialRow m={m.materials ?? {}} all size={16} className="justify-end" />
      </div>
      <div className="mt-1 flex flex-col items-center">
        <PixelText text="The Order" size={3} />
        <div className="run-sans mt-0.5 px-6 text-center text-[11px] text-[var(--ink-dim)]">
          {m.runs} runs · {m.wins} won · best {m.best}
          {(m.heatBest ?? 0) > 0 && <span className="text-[#ffb454]"> · Heat {m.heatBest} cleared</span>}
        </div>
        {m.refundNote && (
          <button className="run-sans mx-4 mt-1 rounded bg-[#ffb454]/15 px-2 py-1 text-[11px] text-[#ffd9a8]" onClick={() => m.clearRefundNote()}>
            {m.refundNote} ✕
          </button>
        )}
        <div className="mt-1.5 flex gap-1.5">
          {(
            [
              ['grimoire', 'book', 'Grimoire'],
              ['codex', 'scroll', 'Codex'],
              ['goals', 'star', 'Goals'],
            ] as const
          ).map(([k, spr, label]) => (
            <button key={k} className="run-btn ghost flex items-center gap-1 px-2.5! py-1! text-xs" onClick={() => (setSub(k), sfx('card'))}>
              <Sprite name={spr} size={14} px={10} pal={GOLD} /> {label}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-2 pb-6">
        <OrderBoard sel={sel} onTap={tap} />
        <div className="run-sans mt-1 flex justify-between px-1 text-[10px] text-[var(--ink-dim)]">
          <span>Ranks 1–2 open · 3–4: reclaim with Stone · 5–8: fog</span>
          <span>Tap a building, then an empty square to move it</span>
        </div>
        <SquarePanel sq={sel} onGallery={() => setSub('gallery')} />
      </div>
    </div>
  );
}

/** The 8×8 board: tiles, fog, buildings (as their pieces), and the selected building's reach. */
function OrderBoard({ sel, onTap }: { sel: string | null; onTap: (sq: string) => void }) {
  const o = useMeta((m) => m.order ?? EMPTY_ORDER);
  const theme = BOARD_THEMES[useRunSettings((s) => s.board)] ?? BOARD_THEMES.crypt;
  const selB = sel ? buildingAt(o, sel) : undefined;
  const r = useMemo(() => (selB ? reach(o, selB) : null), [o, selB]);
  const emp = useMemo(() => Object.fromEntries(BUILDING_IDS.filter((id) => o.buildings[id]).map((id) => [id, empowerment(o, id)])), [o]);
  const xy = (sq: string) => [('abcdefgh'.indexOf(sq[0]) + 0.5) * 12.5, (8 - Number(sq[1]) + 0.5) * 12.5] as const;
  return (
    <div className="relative mx-auto w-full max-w-[380px] select-none" style={{ padding: 4, background: `linear-gradient(180deg, ${theme.frame[0]}, ${theme.frame[1]})`, boxShadow: '0 0 0 2px #1b0f22, 0 0 24px rgba(242,199,92,.2)' }}>
      <div className="relative grid grid-cols-8" style={{ boxShadow: 'inset 0 0 0 2px #1b0f22' }}>
        {SQUARES.map((sq) => {
          const st = squareState(o, sq);
          const light = ('abcdefgh'.indexOf(sq[0]) + Number(sq[1])) % 2 === 1;
          const b = buildingAt(o, sq);
          const reached = r?.squares.includes(sq);
          const hit = b && r?.hits.includes(b);
          const e = b ? emp[b] : undefined;
          return (
            <button key={sq} onClick={() => onTap(sq)} className="pixelated relative aspect-square" style={{ background: `url(${tileSprite(theme, light, squareVariant(sq))}) 0 0 / 100% 100%` }} aria-label={sq}>
              {st === 'fog' && <span className="absolute inset-0" style={{ background: 'repeating-linear-gradient(45deg, rgba(20,14,31,.86) 0 4px, rgba(36,26,51,.86) 4px 8px)' }} />}
              {st === 'reclaimable' && <span className="absolute inset-0 bg-black/55" style={{ boxShadow: 'inset 0 0 0 1px rgba(184,176,162,.35)' }} />}
              {st === 'reclaimable' && !b && <span className="absolute inset-0 flex items-center justify-center opacity-60"><MaterialIcon id="stone" size={10} /></span>}
              {reached && !b && <span className="absolute top-1/2 left-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2" style={{ background: '#ffe7a3', boxShadow: '0 0 0 1px #1b0f22, 0 0 6px #ffe7a3' }} />}
              {b && (
                <span className="absolute inset-0 flex items-center justify-center" style={{ boxShadow: hit ? 'inset 0 0 0 3px #5ee59a' : sel === sq ? 'inset 0 0 0 3px var(--gold-2)' : e && e.by.length ? 'inset 0 0 0 2px rgba(255,180,84,.8)' : undefined }}>
                  <img src={pieceSprite(theme, 'w', PIECE_LETTER[BUILDINGS[b].piece])} alt="" className="pixelated h-[80%] w-[80%]" />
                  <span className="absolute top-0 right-0 bg-[#140d20] px-px">
                    <Sprite name={BUILDINGS[b].sprite} size={12} px={10} pal={GOLD} />
                  </span>
                  <span className="run-sans absolute bottom-0 left-0 bg-[#140d20] px-0.5 text-[8px] font-black text-[var(--gold-2)]">{o.buildings[b]!.level === 2 ? 'II' : 'I'}</span>
                  {e && e.by.length > 0 && <span className="run-sans absolute right-0 bottom-0 bg-[#ffb454] px-0.5 text-[8px] font-black text-[#241503]">+{Math.round((e.mult - 1) * 100)}%</span>}
                </span>
              )}
              {sel === sq && !b && <span className="absolute inset-0" style={{ boxShadow: 'inset 0 0 0 3px var(--gold-2)' }} />}
            </button>
          );
        })}
        {/* Reach lines from the selected building */}
        {selB && r && sel && (
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            {r.squares.map((sq) => {
              const [x1, y1] = xy(sel);
              const [x2, y2] = xy(sq);
              const hit = r.hits.includes(buildingAt(o, sq)!);
              return <line key={sq} x1={x1} y1={y1} x2={x2} y2={y2} stroke={hit ? '#5ee59a' : '#ffe7a3'} strokeWidth={hit ? 1.1 : 0.6} strokeOpacity={hit ? 0.95 : 0.5} />;
            })}
          </svg>
        )}
      </div>
    </div>
  );
}

function Cost({ c, have }: { c: Materials; have: Materials }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {Object.entries(c).map(([k, n]) => {
        const ok = (have[k as keyof Materials] ?? 0) >= (n as number);
        return (
          <span key={k} className={`run-sans inline-flex items-center gap-0.5 text-xs font-black ${ok ? '' : 'opacity-50'}`} style={{ color: MATERIAL_INFO[k as keyof typeof MATERIAL_INFO].color }}>
            <MaterialIcon id={k as keyof typeof MATERIAL_INFO} size={12} /> {n as number}
          </span>
        );
      })}
    </span>
  );
}

/** What the selected square offers: a building's details (upgrade, reach), building options, or reclaiming. */
function SquarePanel({ sq, onGallery }: { sq: string | null; onGallery: () => void }) {
  const m = useMeta();
  const o = m.order ?? EMPTY_ORDER;
  const have = m.materials ?? {};
  if (!sq) {
    const built = BUILDING_IDS.filter((id) => o.buildings[id]).length;
    return (
      <div className="run-sans mt-3 text-center text-xs text-[var(--ink-dim)]">
        {built ? 'Tap a building to see its reach and upgrades. Tap an empty open square to build.' : 'Tap an empty square on ranks 1–2 to build your first building.'}
      </div>
    );
  }
  const st = squareState(o, sq);
  const b = buildingAt(o, sq);
  const ok = (x: boolean) => (x ? (sfx('coin'), sfx('relic'), buzz([20, 30, 20])) : sfx('fail'));
  if (b) {
    const info = BUILDINGS[b];
    const lvl = o.buildings[b]!.level;
    const e = empowerment(o, b);
    const r = reach(o, b);
    const unlocks = Object.entries(UNLOCK_BUILDING).filter(([, v]) => v.building === b);
    return (
      <div className="run-panel run-fadeup mt-3 p-3">
        <div className="flex items-center gap-2">
          <Sprite name={info.sprite} size={30} px={14} pal={GOLD} />
          <div className="min-w-0 flex-1">
            <div className="run-title font-bold">
              {info.name} {lvl === 2 ? 'II' : 'I'}
            </div>
            <div className="run-sans text-[11px] text-[var(--ink-dim)]">
              Reaches like a {({ b: 'bishop', r: 'rook', n: 'knight', p: 'pawn' } as const)[info.piece]}
              {r.hits.length ? ` · reaches ${r.hits.map((x) => BUILDINGS[x].name).join(', ')}` : ''}
            </div>
          </div>
        </div>
        <div className="run-sans mt-2 text-sm">{info.effect[lvl - 1]}.</div>
        {e.by.length > 0 ? (
          <div className="run-sans mt-1 text-xs text-[#ffb454]">
            Empowered +{Math.round((e.mult - 1) * 100)}% by {e.by.map((x) => BUILDINGS[x].name).join(' and ')}.
          </div>
        ) : (
          <div className="run-sans mt-1 text-xs text-[var(--ink-dim)]">Not empowered: place other buildings so they reach it (+{T.order.empower.per * 100}% each, max {T.order.empower.max}).</div>
        )}
        {(info.perks?.length || unlocks.length) && (
          <div className="run-sans mt-2 text-[11px] leading-snug text-[var(--ink-dim)]">
            {info.perks?.length ? <div>Perks: {info.perks.map((p) => BOOSTS.find((x) => x.id === p)?.name ?? p).join(', ')}</div> : null}
            {unlocks.length ? (
              <div>
                Unlocks:{' '}
                {unlocks.map(([id, v]) => (
                  <span key={id} className={v.level > lvl ? 'opacity-50' : 'text-[var(--ink)]'}>
                    {UNLOCKS.find((u) => u.id === id)?.name ?? id}
                    {v.level > lvl ? ' (II)' : ''}
                    {', '}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        )}
        <div className="mt-2 flex gap-2">
          {lvl < 2 && (
            <button className="run-btn flex flex-1 items-center justify-center gap-2 px-2! py-2! text-sm" disabled={!canAfford(have, buildCost(b, 2))} onClick={() => ok(m.upgrade(b))}>
              Upgrade to II <Cost c={buildCost(b, 2)} have={have} />
            </button>
          )}
          {b === 'gallery' && (
            <button className="run-btn ghost flex-1 px-2! py-2! text-sm" onClick={onGallery}>
              Open the Gallery
            </button>
          )}
        </div>
      </div>
    );
  }
  if (st === 'fog') return <div className="run-panel run-fadeup run-sans mt-3 p-3 text-sm text-[var(--ink-dim)]">{sq}: lost in fog. These ranks open later.</div>;
  if (st === 'reclaimable')
    return (
      <div className="run-panel run-fadeup mt-3 flex items-center gap-3 p-3">
        <div className="run-sans flex-1 text-sm">{sq}: rubble. Reclaim it to build here.</div>
        <button className="run-btn flex items-center gap-2 px-3! py-2! text-sm" disabled={!canAfford(have, reclaimCost())} onClick={() => ok(m.reclaim(sq))}>
          Reclaim <Cost c={reclaimCost()} have={have} />
        </button>
      </div>
    );
  const unbuilt = BUILDING_IDS.filter((id) => !o.buildings[id]);
  if (!unbuilt.length) return <div className="run-sans mt-3 text-center text-xs text-[var(--ink-dim)]">{sq}: empty. Select a building, then tap here to move it.</div>;
  return (
    <div className="run-fadeup mt-3 space-y-1.5">
      <div className="run-label px-1">Build on {sq}</div>
      {unbuilt.map((id) => {
        const info = BUILDINGS[id];
        const c = buildCost(id, 1);
        return (
          <div key={id} className="run-panel flex items-center gap-2 p-2">
            <Sprite name={info.sprite} size={26} px={12} pal={SPIRIT} />
            <div className="min-w-0 flex-1">
              <div className="run-title text-sm font-bold">
                {info.name} <span className="run-sans text-[10px] text-[var(--ink-dim)]">({({ b: 'bishop', r: 'rook', n: 'knight', p: 'pawn' } as const)[info.piece]})</span>
              </div>
              <div className="run-sans text-[11px] leading-snug text-[var(--ink-dim)]">{info.effect[0]}</div>
            </div>
            <button className="run-btn flex shrink-0 flex-col items-center gap-0.5 px-2! py-1.5! text-xs" disabled={!canAfford(have, c)} onClick={() => ok(m.build(id, sq))}>
              Build
              <Cost c={c} have={have} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function Goals({ onBack }: { onBack: () => void }) {
  const m = useMeta();
  return (
    <div className="flex h-full flex-col px-4 pt-3">
      <button className="run-btn ghost self-start px-3! py-2!" onClick={onBack}>
        ← The Order
      </button>
      <div className="run-sans mt-2 px-1 text-xs text-[var(--ink-dim)]">One-time goals. Each pays Seals the first time you reach it.</div>
      <div className="mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto pb-6">
        {MILESTONES.map((x) => {
          const done = (m.milestones ?? []).includes(x.id);
          return (
            <div key={x.id} className={`run-panel flex items-center gap-3 p-3 ${done ? '' : 'opacity-80'}`}>
              <Sprite name={done ? 'check' : 'star'} size={30} px={14} pal={done ? GOLD : SPIRIT} />
              <div className="min-w-0 flex-1">
                <div className="run-title font-bold">{x.name}</div>
                <div className="run-sans text-xs text-[var(--ink-dim)]">{x.text}</div>
              </div>
              <span className="run-sans flex items-center gap-1 text-xs font-black" style={{ color: done ? '#5ee59a' : MATERIAL_INFO.seals.color }}>
                {done ? 'Done' : <><MaterialIcon id="seals" size={12} /> {milestoneSeals(x)}</>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** The Gallery: board themes and piece sets (bought with materials). */
function Gallery({ onBack }: { onBack: () => void }) {
  const m = useMeta();
  const rs = useRunSettings();
  const o = m.order ?? EMPTY_ORDER;
  const cost = cosmeticCost(o);
  const have = m.materials ?? {};
  const theme = BOARD_THEMES[rs.board] ?? BOARD_THEMES.crypt;
  const buy = (id: string, then: () => void) => (m.buyCosmetic(id) ? (sfx('coin'), then()) : sfx('fail'));
  return (
    <div className="flex h-full flex-col px-4 pt-3">
      <div className="flex items-center justify-between">
        <button className="run-btn ghost px-3! py-2!" onClick={onBack}>
          ← The Order
        </button>
        <MaterialRow m={have} all size={14} />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <PixelPortrait id="coach" size={36} />
        <div className="run-sans text-xs text-[var(--ink-dim)]">
          The Gallery. Each look costs <Cost c={cost} have={have} />
        </div>
      </div>
      <div className="mt-2 min-h-0 flex-1 overflow-y-auto pb-6">
        <div className="grid grid-cols-2 gap-2">
          {Object.values(BOARD_THEMES).map((t) => {
            const own = boardUnlocked(m, t.id);
            const active = rs.board === t.id;
            return (
              <div key={t.id} className="run-panel p-2 text-center" style={active ? { boxShadow: '0 0 0 2px var(--gold), 0 0 18px rgba(242,199,92,.35)' } : undefined}>
                <div className="mx-auto grid w-24 grid-cols-3" style={{ boxShadow: `0 0 0 2px #1b0f22, 0 0 0 4px ${t.frame[0]}` }}>
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => {
                    const pc = i === 1 ? pieceSprite(t, 'b', 'Q') : i === 3 ? pieceSprite(t, 'w', 'N') : i === 5 ? pieceSprite(t, 'b', 'P') : i === 7 ? pieceSprite(t, 'w', 'K') : null;
                    return (
                      <div key={i} className="pixelated aspect-square" style={{ background: `url(${tileSprite(t, i % 2 === 0, i % 4)}) 0 0 / 100% 100%` }}>
                        {pc && <img src={pc} alt="" className="pixelated h-full w-full" />}
                      </div>
                    );
                  })}
                </div>
                <div className="run-title mt-2 text-sm font-bold">{t.name}</div>
                {own ? (
                  <button className={`run-btn mt-1 w-full px-2! py-1.5! text-xs ${active ? '' : 'ghost'}`} onClick={() => rs.set({ board: t.id })}>
                    {active ? 'In use' : 'Use'}
                  </button>
                ) : (
                  <button className="run-btn mt-1 w-full px-2! py-1.5! text-xs" disabled={!canAfford(have, cost)} onClick={() => buy(`board:${t.id}`, () => rs.set({ board: t.id }))}>
                    Buy
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <div className="run-label mt-3 px-1">Piece sets</div>
        <div className="grid grid-cols-3 gap-2">
          {Object.keys(PIECE_SETS).map((id) => {
            const own = piecesUnlocked(m, id);
            const active = (rs.pieces ?? 'board') === id;
            return (
              <div key={id} className="run-panel p-2 text-center" style={active ? { boxShadow: '0 0 0 2px var(--gold), 0 0 18px rgba(242,199,92,.35)' } : undefined}>
                <div className="flex justify-center gap-0.5">
                  {(['K', 'N'] as const).map((t, i) => (
                    <img key={t} src={pieceSprite(theme, i ? 'b' : 'w', t, id)} alt="" className="pixelated h-9 w-9" />
                  ))}
                </div>
                <div className="run-title mt-1 text-xs leading-tight font-bold">{id === 'board' ? 'Match board' : PIECE_SETS[id]!.name}</div>
                {own ? (
                  <button className={`run-btn mt-1 w-full px-1! py-1! text-[11px] ${active ? '' : 'ghost'}`} onClick={() => rs.set({ pieces: id })}>
                    {active ? 'In use' : 'Use'}
                  </button>
                ) : (
                  <button className="run-btn mt-1 w-full px-1! py-1! text-[11px]" disabled={!canAfford(have, cost)} onClick={() => buy(`pieces:${id}`, () => rs.set({ pieces: id }))}>
                    Buy
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
