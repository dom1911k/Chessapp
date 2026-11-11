import { describe, expect, it } from 'vitest';
import { CUPS, YOU, advances, champion, cupXp, currentRound, newCup, playRound, rng, tierOpen, winChance, yourColor, yourOpponent } from '../lib/cups';
import { SYSTEMS, afterRun, lineLevel, linePlies, nextLine, repertoireLines, validLine, yourPlies } from '../lib/repertoire';

describe('bot cups', () => {
  it('seeds you against the weakest bot and keeps the strong half for the final', () => {
    const c = newCup('bronze', 7);
    expect(c.rounds[0].length).toBe(8);
    expect(new Set(c.rounds[0]).size).toBe(8);
    expect(yourOpponent(c)).toBe(CUPS.bronze.bots[0]);
    expect(yourColor(c)).toBe('w');
    expect(CUPS.gold.bots.length).toBe(7);
  });
  it('a win advances; a draw advances only with Black', () => {
    expect(advances('win', 'w')).toBe(true);
    expect(advances('draw', 'w')).toBe(false);
    expect(advances('draw', 'b')).toBe(true);
    expect(advances('loss', 'b')).toBe(false);
  });
  it('three wins lift the cup; a loss ends it and the bots finish the bracket', () => {
    let c = newCup('bronze', 42);
    c = playRound(c, 'win');
    expect(currentRound(c)).toBe(1);
    expect(c.rounds[1].length).toBe(4);
    expect(c.rounds[1][0]).toBe(YOU);
    expect(yourColor(c)).toBe('b');
    c = playRound(c, 'draw');
    expect(c.rounds[2]).toContain(YOU);
    c = playRound(c, 'win');
    expect(c.place).toBe('winner');
    expect(champion(c)).toBe(YOU);
    expect(cupXp('bronze', 'winner')).toBe(80);

    let d = playRound(newCup('silver', 42), 'loss');
    expect(d.place).toBe('quarter');
    expect(champion(d)).not.toBe(YOU);
    expect(champion(d)).toBeTruthy();
    expect(cupXp('silver', 'quarter')).toBe(0);
    d = playRound(playRound(newCup('gold', 3), 'win'), 'loss');
    expect(d.place).toBe('semi');
    expect(cupXp('gold', 'semi')).toBe(45);
  });
  it('is deterministic for a seed and favours the stronger bot', () => {
    expect(playRound(newCup('bronze', 5), 'win').rounds[1]).toEqual(playRound(newCup('bronze', 5), 'win').rounds[1]);
    expect(rng(1)()).toBe(rng(1)());
    expect(winChance('mei', 'lily')).toBeGreaterThan(0.95);
    expect(tierOpen('bronze', {})).toBe(true);
    expect(tierOpen('silver', {})).toBe(false);
    expect(tierOpen('silver', { bronze: 1 })).toBe(true);
  });
});

describe('repertoire', () => {
  it('every built-in line is legal and has moves for your side', () => {
    const ids = SYSTEMS.flatMap((s) => s.lines.map((l) => l.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of SYSTEMS)
      for (const l of s.lines) {
        expect(() => linePlies(l.moves), l.id).not.toThrow();
        expect(yourPlies(l).length, l.id).toBeGreaterThanOrEqual(4);
        expect(l.color, l.id).toBe(s.slot === 'white' ? 'w' : 'b');
      }
  });
  it('tracks runs and picks the weakest line next', () => {
    let st = afterRun({}, 'a', true, '2026-01-01');
    expect(lineLevel(st.a)).toBe(2);
    st = afterRun(afterRun(st, 'a', true, '2026-01-02'), 'a', true, '2026-01-03');
    expect(lineLevel(st.a)).toBe(3);
    st = afterRun(st, 'b', false, '2026-01-03');
    expect(lineLevel(st.b)).toBe(1);
    const lines = [{ id: 'a', name: 'A', color: 'w' as const, moves: 'e4 e5 Nf3 Nc6' }, { id: 'b', name: 'B', color: 'w' as const, moves: 'd4 d5 c4 e6' }, { id: 'c', name: 'C', color: 'w' as const, moves: 'c4 e5 Nc3 Nf6' }];
    expect(nextLine(lines, st)!.id).toBe('c');
    expect(nextLine([], st)).toBeNull();
  });
  it('builds the line list from picks and custom lines, and validates recordings', () => {
    const r = { picks: { white: 'london', d4: 'kid' }, custom: [{ id: 'x', name: 'Mine', color: 'b' as const, moves: 'e4 c5 Nf3 d6', custom: true }] };
    const ids = repertoireLines(r).map((l) => l.id);
    expect(ids).toContain('lo-main');
    expect(ids).toContain('kid-main');
    expect(ids).toContain('x');
    expect(ids).not.toContain('it-main');
    expect(validLine('e4 e5 Nf3 Nc6')).toBe(true);
    expect(validLine('e4 e5')).toBe(false);
    expect(validLine('e4 e5 Ke3 Nc6')).toBe(false);
  });
});
