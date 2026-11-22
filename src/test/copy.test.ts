import { describe, expect, it } from 'vitest';
import { castSummary, OPPONENTS } from '../lib/people';
import { COSMETICS, cosmeticTitle } from '../lib/rewards/cosmetics';

describe('copy read off the data', () => {
  it('describes the cast from the ladder itself', () => {
    const elos = OPPONENTS.map((o) => o.elo);
    expect(castSummary()).toBe(`Nine characters from ${Math.min(...elos)} to ${Math.max(...elos)}`);
    expect(castSummary([{ elo: 500 }, { elo: 300 }])).toBe('Two characters from 300 to 500');
  });

  it('names the kind when a cosmetic name is shared across kinds', () => {
    const titles = COSMETICS.map(cosmeticTitle);
    expect(new Set(titles).size).toBe(titles.length);
    expect(cosmeticTitle({ name: 'Marble', kind: 'board' })).toBe('Marble board');
    expect(cosmeticTitle({ name: 'Marble', kind: 'pieces' })).toBe('Marble pieces');
    // A name only one kind uses stays as it is.
    const solo = COSMETICS.find((c) => COSMETICS.filter((d) => d.name === c.name).length === 1)!;
    expect(cosmeticTitle(solo)).toBe(solo.name);
  });
});

describe('short dates', () => {
  it('drops the year when it is this year', async () => {
    const { shortDate } = await import('../lib/store/finish');
    const now = new Date(2026, 10, 22).getTime();
    expect(shortDate(new Date(2026, 10, 22, 15).getTime(), now)).toBe('22 Nov');
    expect(shortDate(new Date(2026, 0, 3).getTime(), now)).toBe('3 Jan');
    expect(shortDate(new Date(2025, 11, 31).getTime(), now)).toBe('31 Dec 2025');
  });
});
