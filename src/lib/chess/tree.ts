// A move tree for the analysis board: the main line plus any side variations you try. Pure and
// immutable-ish: every change returns a new tree object (the node map is copied shallowly).
import { Chess } from 'chess.js';
import { parseUci } from './game';

export interface TreeNode {
  id: number;
  parent: number | null;
  /** The move that led here (null for the root). */
  uci: string | null;
  san: string | null;
  fen: string;
  /** Children in order; the first one is the main continuation. */
  children: number[];
  /** Ply number from the root (root = 0). */
  ply: number;
}

export interface Tree {
  nodes: Record<number, TreeNode>;
  root: number;
  current: number;
  next: number;
}

export function newTree(fen: string): Tree {
  return { nodes: { 0: { id: 0, parent: null, uci: null, san: null, fen, children: [], ply: 0 } }, root: 0, current: 0, next: 1 };
}

export const currentNode = (t: Tree) => t.nodes[t.current];

/** Play a move from the current position: reuse an existing child with the same move, otherwise add a branch. */
export function playMove(t: Tree, uci: string): Tree | null {
  const here = t.nodes[t.current];
  const existing = here.children.find((c) => t.nodes[c].uci === uci);
  if (existing !== undefined) return { ...t, current: existing };
  const c = new Chess(here.fen);
  let m;
  try {
    m = c.move(parseUci(uci));
  } catch {
    return null;
  }
  const id = t.next;
  const node: TreeNode = { id, parent: here.id, uci: m.lan, san: m.san, fen: c.fen(), children: [], ply: here.ply + 1 };
  return { nodes: { ...t.nodes, [here.id]: { ...here, children: [...here.children, id] }, [id]: node }, root: t.root, current: id, next: id + 1 };
}

/** Play several moves in a row (e.g. an engine line up to a point). */
export function playLine(t: Tree, ucis: string[]): Tree {
  let out = t;
  for (const u of ucis) {
    const n = playMove(out, u);
    if (!n) break;
    out = n;
  }
  return out;
}

export const goTo = (t: Tree, id: number): Tree => (t.nodes[id] ? { ...t, current: id } : t);
export const back = (t: Tree): Tree => (t.nodes[t.current].parent === null ? t : { ...t, current: t.nodes[t.current].parent! });
export const forward = (t: Tree): Tree => (t.nodes[t.current].children.length ? { ...t, current: t.nodes[t.current].children[0] } : t);
export const toStart = (t: Tree): Tree => ({ ...t, current: t.root });
export function toEnd(t: Tree): Tree {
  let id = t.current;
  while (t.nodes[id].children.length) id = t.nodes[id].children[0];
  return { ...t, current: id };
}

/** Ids from the root to the current node (root excluded). */
export function pathTo(t: Tree, id = t.current): number[] {
  const out: number[] = [];
  let n: TreeNode | undefined = t.nodes[id];
  while (n && n.parent !== null) {
    out.unshift(n.id);
    n = t.nodes[n.parent];
  }
  return out;
}

/** Remove the variation starting at `id` (and everything after it). The root can't be removed. */
export function deleteFrom(t: Tree, id: number): Tree {
  const n = t.nodes[id];
  if (!n || n.parent === null) return t;
  const gone = new Set<number>();
  const walk = (x: number) => {
    gone.add(x);
    for (const c of t.nodes[x].children) walk(c);
  };
  walk(id);
  const nodes: Record<number, TreeNode> = {};
  for (const [k, v] of Object.entries(t.nodes)) if (!gone.has(Number(k))) nodes[Number(k)] = v;
  const p = nodes[n.parent];
  nodes[n.parent] = { ...p, children: p.children.filter((c) => c !== id) };
  return { ...t, nodes, current: gone.has(t.current) ? n.parent : t.current };
}

/** Make the variation at `id` the main line at its branch point. */
export function promote(t: Tree, id: number): Tree {
  const n = t.nodes[id];
  if (!n || n.parent === null) return t;
  const p = t.nodes[n.parent];
  return { ...t, nodes: { ...t.nodes, [p.id]: { ...p, children: [id, ...p.children.filter((c) => c !== id)] } } };
}

/** A flat rendering for display: tokens of moves, with variations opened and closed in brackets. */
export type Token = { kind: 'move'; id: number; label: string; depth: number } | { kind: 'open'; depth: number } | { kind: 'close'; depth: number };

export function render(t: Tree): Token[] {
  const out: Token[] = [];
  const startTurn = t.nodes[t.root].fen.split(' ')[1];
  const startNo = Number(t.nodes[t.root].fen.split(' ')[5] ?? 1);
  const label = (n: TreeNode, force: boolean) => {
    const idx = n.ply - 1 + (startTurn === 'b' ? 1 : 0);
    const no = startNo + Math.floor(idx / 2);
    const white = idx % 2 === 0;
    return white ? `${no}. ${n.san}` : force ? `${no}… ${n.san}` : n.san!;
  };
  const line = (id: number, depth: number, first: boolean) => {
    let cur: number | undefined = id;
    let force = first;
    while (cur !== undefined) {
      const n: TreeNode = t.nodes[cur];
      out.push({ kind: 'move', id: n.id, label: label(n, force), depth });
      force = false;
      const parent = t.nodes[n.parent!];
      // Side variations of this move (siblings) right after it.
      if (parent.children[0] === n.id) {
        for (const sib of parent.children.slice(1)) {
          out.push({ kind: 'open', depth: depth + 1 });
          line(sib, depth + 1, true);
          out.push({ kind: 'close', depth: depth + 1 });
          force = true;
        }
      }
      cur = n.children[0];
    }
  };
  const first = t.nodes[t.root].children[0];
  if (first !== undefined) line(first, 0, true);
  return out;
}
