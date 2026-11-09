// The analysis board: play any moves from a position and branch into variations; the engine shows
// its top three lines live with an eval bar, and Coach Sam says a word about the last move played.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Cpu, EllipsisVertical, FlipVertical2, GitBranchPlus, ScanSearch, Trash2 } from 'lucide-react';
import { Board } from '../components/Board';
import { CoachAvatar } from '../components/Coach';
import { ReviewIcon } from '../components/ReviewIcon';
import { Dialog, EvalBar, Header, Spinner } from '../components/ui';
import { PlayFromHere } from '../components/PlayFromHere';
import { explainPosition } from '../lib/coach/position';
import { formatScore, povScore, winPct } from '../lib/chess/evaluation';
import { lineToSan, type MoveInput } from '../lib/chess/game';
import { explainMove, type CoachComment } from '../lib/coach';
import { getEngine, type AnalysisResult } from '../lib/engine';
import { analysisLimits } from '../lib/engine/speed';
import { back, currentNode, deleteFrom, forward, newTree, pathTo, playLine, playMove, promote, render, toEnd, toStart, goTo, type Tree } from '../lib/chess/tree';
import { tryMove } from '../lib/chess/game';
import type { ReviewClass } from '../lib/review';

const OWNER = 'explore';

export function ExploreScreen({ fen, orientation: startOrientation, title }: { fen: string; orientation: 'white' | 'black'; title?: string }) {
  const [tree, setTree] = useState<Tree>(() => newTree(fen));
  const [orientation, setOrientation] = useState(startOrientation);
  const [engineOn, setEngineOn] = useState(true);
  const [lines, setLines] = useState<AnalysisResult | null>(null);
  const [thinking, setThinking] = useState(false);
  const [comment, setComment] = useState<{ id: number; c: CoachComment } | null>(null);
  const [explained, setExplained] = useState<{ id: number; text: string[] } | null>(null);
  const [menu, setMenu] = useState(false);
  const run = useRef(0);
  const node = currentNode(tree);
  const parent = node.parent !== null ? tree.nodes[node.parent] : null;

  useEffect(() => () => getEngine().cancelAll(OWNER), []);

  // Live analysis of the position shown: a quick pass, then a deeper one; plus the coach's word on
  // the move that led here (needs the position before it, too).
  useEffect(() => {
    const my = ++run.current;
    const eng = getEngine();
    eng.cancelAll(OWNER);
    setLines(null);
    if (!engineOn) {
      setThinking(false);
      return;
    }
    setThinking(true);
    const base = analysisLimits().depth;
    void (async () => {
      try {
        const quick = await eng.analyze(node.fen, { depth: Math.min(10, base), multipv: 3, owner: OWNER });
        if (my !== run.current) return;
        setLines(quick);
        const deep = await eng.analyze(node.fen, { depth: base + 4, multipv: 3, owner: OWNER });
        if (my !== run.current) return;
        setLines(deep);
        setThinking(false);
        if (parent && node.uci && comment?.id !== node.id) {
          const before = await eng.analyze(parent.fen, { depth: base, multipv: 3, owner: OWNER });
          if (my !== run.current) return;
          setComment({ id: node.id, c: explainMove({ fenBefore: parent.fen, uci: node.uci, before, after: deep }) });
        }
      } catch {
        /* cancelled: a newer position took over */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id, engineOn]);

  const onMove = (m: MoveInput) => {
    const r = tryMove(node.fen, m);
    if (!r) return false;
    const t = playMove(tree, r.move.lan);
    if (!t) return false;
    setTree(t);
    return true;
  };

  const whitePct = lines?.lines[0] ? winPct(povScore(lines.lines[0].score, 'w')) : 50;
  const tokens = useMemo(() => render(tree), [tree]);
  const path = useMemo(() => new Set(pathTo(tree)), [tree]);
  const isVariation = node.parent !== null && tree.nodes[node.parent].children[0] !== node.id;
  const variationRoot = (() => {
    // The first node of the side line the current move sits in.
    let id = node.id;
    while (tree.nodes[id].parent !== null && tree.nodes[tree.nodes[id].parent!].children[0] === id) id = tree.nodes[id].parent!;
    return tree.nodes[id].parent === null ? null : id;
  })();
  const best = lines?.lines[0]?.pv[0];
  const lastMove = node.uci ? { from: node.uci.slice(0, 2), to: node.uci.slice(2, 4) } : null;
  const mover = (fen: string) => (fen.split(' ')[1] === 'w' ? 'w' : 'b');

  return (
    <div className="flex h-full flex-col">
      <Header
        title={title ?? 'Analysis'}
        back
        right={
          <span className="flex items-center gap-1">
            <button
              aria-label={engineOn ? 'Turn the engine off' : 'Turn the engine on'}
              className={`flex h-9 items-center gap-1 rounded-full px-2.5 text-xs font-bold transition-colors ${engineOn ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100' : 'bg-stone-200/70 text-stone-500 dark:bg-white/[0.06]'}`}
              onClick={() => setEngineOn(!engineOn)}
            >
              <Cpu size={15} /> {engineOn ? 'On' : 'Off'}
            </button>
            <button aria-label="Flip board" className="flex h-9 w-9 items-center justify-center rounded-full text-stone-600 active:bg-stone-200 dark:text-stone-300 dark:active:bg-white/10" onClick={() => setOrientation(orientation === 'white' ? 'black' : 'white')}>
              <FlipVertical2 size={19} />
            </button>
            <button aria-label="More" className="flex h-9 w-9 items-center justify-center rounded-full text-stone-600 active:bg-stone-200 dark:text-stone-300 dark:active:bg-white/10" onClick={() => setMenu(true)}>
              <EllipsisVertical size={19} />
            </button>
          </span>
        }
      />
      <div className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col land:max-w-6xl land:flex-row land:gap-5 land:px-3">
        <div className="flex gap-1.5 px-1.5 land:w-[min(calc(100dvh-7rem),58vw)] land:shrink-0">
          {engineOn && <EvalBar whitePct={whitePct} orientation={orientation} />}
          <div className="min-w-0 flex-1">
            <Board
              fen={node.fen}
              orientation={orientation}
              movable="both"
              onMove={onMove}
              arrows={engineOn && best ? [{ from: best.slice(0, 2), to: best.slice(2, 4), tone: 'good' }] : []}
              lastMove={lastMove}
            />
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-2.5 px-3 pt-2.5">
          {/* Engine lines */}
          {engineOn && (
            <div className="card shrink-0 divide-y divide-stone-100 !p-0 dark:divide-white/[0.05]">
              {(lines?.lines ?? []).slice(0, 3).map((l, i) => {
                const san = lineToSan(node.fen, l.pv, 8);
                const score = formatScore(l.score);
                const good = l.score.type === 'mate' ? l.score.value > 0 : l.score.value >= 0;
                return (
                  <div key={i} className="flex items-center gap-2 px-2.5 py-1.5">
                    <span className={`w-12 shrink-0 rounded-md py-0.5 text-center text-xs font-bold tabular-nums ${good ? 'bg-white text-stone-900 ring-1 ring-stone-200 dark:ring-transparent' : 'bg-stone-800 text-white dark:bg-black/50'}`}>{score}</span>
                    <span className="no-scrollbar flex min-w-0 flex-1 gap-1 overflow-x-auto text-[13px] whitespace-nowrap">
                      {san.map((m, k) => (
                        <button key={k} className={`rounded px-0.5 ${k === 0 ? 'font-bold' : 'text-stone-600 dark:text-stone-300'} active:bg-stone-200 dark:active:bg-white/10`} onClick={() => setTree(playLine(tree, l.pv.slice(0, k + 1)))}>
                          {m}
                        </button>
                      ))}
                    </span>
                  </div>
                );
              })}
              {!lines && (
                <div className="flex items-center gap-2 px-3 py-2.5 text-sm text-stone-500">
                  <Spinner className="!h-3.5 !w-3.5" /> Thinking…
                </div>
              )}
              <div className="flex items-center justify-between px-2.5 py-1 text-[11px] text-stone-400">
                <span>{lines ? `Depth ${lines.depth}` : ''}</span>
                {thinking && lines && <span className="flex items-center gap-1"><Spinner className="!h-2.5 !w-2.5" /> going deeper</span>}
              </div>
            </div>
          )}

          {/* The coach's word on the last move */}
          {comment && comment.id === node.id && parent && (
            <div className="flex shrink-0 items-start gap-2.5">
              <CoachAvatar mood={comment.c.classification === 'blunder' || comment.c.classification === 'mistake' ? 'concerned' : 'happy'} size={34} />
              <div className="card min-w-0 flex-1 !rounded-[16px] !rounded-tl-md !px-3 !py-2 text-[13.5px] leading-snug">
                <p className="flex items-center gap-1.5 font-semibold">
                  {comment.c.classification && <ReviewIcon cls={comment.c.classification as ReviewClass} size={16} />}
                  {node.san}
                </p>
                <p className="mt-0.5">{comment.c.text[0]}</p>
              </div>
            </div>
          )}
          {explained && explained.id === node.id && (
            <div className="card shrink-0 !px-3.5 !py-2.5 text-[13.5px] leading-snug">
              {explained.text.map((t, i) => <p key={i} className={i ? 'mt-1' : ''}>{t}</p>)}
            </div>
          )}

          {/* Moves and variations */}
          <div className="card min-h-[64px] flex-1 overflow-y-auto !px-3 !py-2.5 text-[13.5px] leading-relaxed">
            {tokens.length === 0 ? (
              <p className="text-stone-500">Play a move on the board. You can go back and try something else — each idea becomes its own variation.</p>
            ) : (
              <p>
                {tokens.map((tk, i) =>
                  tk.kind === 'open' ? (
                    <span key={i} className="text-stone-400"> (</span>
                  ) : tk.kind === 'close' ? (
                    <span key={i} className="text-stone-400">) </span>
                  ) : (
                    <button
                      key={i}
                      onClick={() => setTree(goTo(tree, tk.id))}
                      className={`mx-px rounded-md px-1 ${tk.id === tree.current ? 'bg-stone-900 font-semibold text-white dark:bg-stone-50 dark:text-stone-900' : tk.depth ? 'text-stone-500 dark:text-stone-400' : path.has(tk.id) ? 'font-semibold' : ''}`}
                    >
                      {tk.label}
                    </button>
                  ),
                )}
              </p>
            )}
          </div>

          {/* Navigation */}
          <div className="safe-bottom grid shrink-0 grid-cols-4 gap-1.5 pb-2">
            <Nav label="First move" onClick={() => setTree(toStart(tree))} disabled={tree.current === tree.root}><ChevronFirst size={21} /></Nav>
            <Nav label="Previous move" onClick={() => setTree(back(tree))} disabled={tree.current === tree.root}><ChevronLeft size={24} /></Nav>
            <Nav label="Next move" onClick={() => setTree(forward(tree))} disabled={!node.children.length} primary><ChevronRight size={24} /></Nav>
            <Nav label="Last move" onClick={() => setTree(toEnd(tree))} disabled={!node.children.length}><ChevronLast size={21} /></Nav>
          </div>
        </div>
      </div>

      <Dialog open={menu} onClose={() => setMenu(false)}>
        <div className="-mx-2 space-y-0.5">
          <MenuItem
            icon={<ScanSearch size={19} />}
            label="Explain this position"
            onClick={() => {
              setMenu(false);
              void getEngine()
                .analyze(node.fen, { ...analysisLimits(), owner: OWNER })
                .then((a) => setExplained({ id: node.id, text: explainPosition(node.fen, a, mover(node.fen) === 'w' ? 'w' : 'b') }))
                .catch(() => undefined);
            }}
          />
          {isVariation && variationRoot !== null && (
            <MenuItem icon={<GitBranchPlus size={19} />} label="Make this the main line" onClick={() => (setMenu(false), setTree(promote(tree, variationRoot)))} />
          )}
          {node.parent !== null && <MenuItem icon={<Trash2 size={19} />} label="Delete from here" onClick={() => (setMenu(false), setTree(deleteFrom(tree, node.id)))} />}
          {tokens.length > 0 && <MenuItem icon={<Trash2 size={19} />} label="Clear all moves" onClick={() => (setMenu(false), setTree(newTree(fen)))} />}
          <div className="px-3 pt-2">
            <PlayFromHere fen={node.fen} color={orientation === 'white' ? 'w' : 'b'} />
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function Nav({ children, onClick, disabled, label, primary }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; label: string; primary?: boolean }) {
  return (
    <button aria-label={label} disabled={disabled} onClick={onClick} className={`flex h-12 items-center justify-center rounded-xl transition active:scale-95 disabled:opacity-30 ${primary ? 'bg-brand-600 text-white' : 'bg-white ring-1 ring-stone-200 dark:bg-white/[0.04] dark:ring-white/10'}`}>
      {children}
    </button>
  );
}

function MenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left font-semibold active:bg-stone-100 dark:active:bg-stone-800" onClick={onClick}>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-200">{icon}</span>
      {label}
    </button>
  );
}
