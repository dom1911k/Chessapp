import { describe, expect, it } from 'vitest';
import { wantsSummaryLine } from '../lib/people';
describe("the opponent's summary line", () => {
  it('only follows a game with at least 10 of your moves', () => {
    expect(wantsSummaryLine(2)).toBe(false); // resigned on move 2
    expect(wantsSummaryLine(9)).toBe(false);
    expect(wantsSummaryLine(10)).toBe(true);
    expect(wantsSummaryLine(40)).toBe(true);
  });
});
