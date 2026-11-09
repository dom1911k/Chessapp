import { describe, expect, it } from 'vitest';
import { back, currentNode, deleteFrom, forward, goTo, newTree, pathTo, playLine, playMove, promote, render, toEnd, toStart } from '../lib/chess/tree';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const labels = (t: ReturnType<typeof newTree>) => render(t).map((x) => (x.kind === 'move' ? x.label : x.kind === 'open' ? '(' : ')')).join(' ');

describe('analysis move tree', () => {
  it('plays a main line and navigates it', () => {
    let t = playLine(newTree(START), ['e2e4', 'e7e5', 'g1f3']);
    expect(currentNode(t).san).toBe('Nf3');
    t = back(back(t));
    expect(currentNode(t).san).toBe('e4');
    expect(currentNode(forward(t)).san).toBe('e5');
    expect(currentNode(toEnd(t)).san).toBe('Nf3');
    expect(toStart(t).current).toBe(0);
    expect(playMove(t, 'e2e5')).toBeNull();
  });
  it('branches into variations, reuses existing moves and renders them', () => {
    let t = playLine(newTree(START), ['e2e4', 'e7e5', 'g1f3']);
    t = goTo(t, pathTo(t)[0]); // after 1. e4
    t = playLine(t, ['c7c5', 'g1f3']);
    t = goTo(t, pathTo(t)[0]);
    const again = playMove(t, 'e7e5')!;
    expect(currentNode(again).san).toBe('e5');
    expect(Object.keys(again.nodes)).toHaveLength(6);
    expect(labels(t)).toBe('1. e4 e5 ( 1… c5 2. Nf3 ) 2. Nf3');
  });
  it('promotes and deletes variations', () => {
    let t = playLine(newTree(START), ['e2e4', 'e7e5']);
    t = back(t);
    t = playMove(t, 'c7c5')!;
    const c5 = t.current;
    t = promote(t, c5);
    expect(labels(t)).toBe('1. e4 c5 ( 1… e5 )');
    t = deleteFrom(t, c5);
    expect(labels(t)).toBe('1. e4 e5');
    expect(currentNode(t).san).toBe('e4');
  });
});
