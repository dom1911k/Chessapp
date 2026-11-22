import { describe, expect, it } from 'vitest';
import { figurine } from '../components/MoveHistory';

describe('figurine notation', () => {
  it('swaps piece letters for symbols', () => {
    expect(figurine('Nf3')).toBe('♘f3');
    expect(figurine('Qxh7#')).toBe('♕xh7#');
    expect(figurine('exd5')).toBe('exd5');
    expect(figurine('O-O')).toBe('O-O');
    expect(figurine('e8=Q+')).toBe('e8=♕+');
  });
});

describe('Figurine', () => {
  it('draws the piece letters with the set pieces in the mover colour', async () => {
    const { createElement } = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { Figurine } = await import('../components/MoveHistory');
    const { PieceIcon } = await import('../components/PieceIcon');
    const icon = (code: string) => renderToStaticMarkup(createElement(PieceIcon, { code: code as 'wN', className: 'h-full w-full' }));
    const html = (san: string, color: 'w' | 'b') => renderToStaticMarkup(createElement(Figurine, { san, color }));
    const imgs = (h: string) => (h.match(/<img/g) ?? []).length;
    expect(imgs(html('Nf3', 'w'))).toBe(1);
    expect(html('Nf3', 'w')).toContain(icon('wN'));
    expect(html('Qxh7#', 'b')).toContain(icon('bQ'));
    expect(html('Qxh7#', 'b')).not.toContain(icon('wQ'));
    expect(html('Qxh7#', 'b').replace(/<[^>]+>/g, '')).toBe('xh7#');
    expect(imgs(html('exd5', 'w'))).toBe(0);
    expect(html('O-O', 'b')).toBe('O-O');
    expect(html('e8=Q+', 'w')).toContain(icon('wQ'));
    expect(html('e8=Q+', 'w').replace(/<[^>]+>/g, '')).toBe('e8=+');
  });
});
