import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { plural } from '../lib/plural';

describe('round 5 · 0.4 plurals', () => {
  it('puts the noun in the right number', () => {
    expect(plural(1, 'move')).toBe('1 move');
    expect(plural(0, 'move')).toBe('0 moves');
    expect(plural(2, 'game')).toBe('2 games');
    expect(plural(1204, 'puzzle')).toBe('1,204 puzzles');
    expect(plural(1, 'rated game')).toBe('1 rated game');
  });
});

describe('round 5 · 1.1–1.3 badges: gold, readable, one place on Home', async () => {
  const { BadgeIcon } = await import('../components/BadgeIcon');
  const { BadgeLine, BadgeStrip, BadgeTiles } = await import('../components/Rivalry');
  const rec = { w: 4, l: 0, d: 0, stars: 0, bestAccuracy: 0, badges: ['white', 'clean', 'sharp', 'quick', 'mate'] };
  it('earned badges are a gold disc with a dark icon, not the blunder rose', () => {
    const on = renderToStaticMarkup(createElement(BadgeIcon, { id: 'sharp', on: true }));
    expect(on).toContain('bg-gold-400');
    expect(on).not.toContain('rose');
    const off = renderToStaticMarkup(createElement(BadgeIcon, { id: 'sharp', on: false }));
    expect(off).not.toContain('bg-gold-400');
  });
  it('the opponent card line reads "5/8 · Next: With Black" with 16px icons', () => {
    const html = renderToStaticMarkup(createElement(BadgeLine, { opponentId: 'tom', rec }));
    expect(html.replace(/<!-- -->/g, '')).toContain('5/8</b> · Next: With Black');
    expect(html.match(/width:16px/g)).toHaveLength(8);
    expect(html).toContain('data-testid="badge-line"');
  });
  it('the picker strip draws 18px icons, 3px apart', () => {
    const html = renderToStaticMarkup(createElement(BadgeStrip, { rec, size: 18 }));
    expect(html.match(/width:18px/g)).toHaveLength(8);
    expect(html).toContain('gap-[3px]');
  });
  it('earned tiles are gold-tinted with a gold check', () => {
    const html = renderToStaticMarkup(createElement(BadgeTiles, { rec }));
    expect(html.match(/bg-hue-amber-50 dark:bg-hue-amber-500\/10/g)).toHaveLength(5);
    expect(html).not.toContain('rose');
  });
});
