import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';

describe('round 8 · 1.5 your avatar on the pawn\'s tag', async () => {
  const { frameById, frameMid } = await import('../lib/avatars');
  const { ISO } = await import('../lib/puzzles/world');
  it("the tag's border takes the frame's middle colour (none: white)", () => {
    expect(frameMid(frameById('gold'))).toBe('#d19a16');
    expect(frameMid(frameById('none'))).toBe('');
    // A conic frame: its middle stop.
    expect(frameMid(frameById('cup'))).toBe('#fff3b8');
  });
  it('the tag holds your avatar, clipped to the square with an id per scene; the silhouette only without one', () => {
    const a = ISO.build(360, { b: 0, lvl: 3, w0: 0, w1: 1, uid: 'one', avatar: '/a07.webp', ring: '#d19a16' }).svg as string;
    const b = ISO.build(360, { b: 0, lvl: 3, w0: 0, w1: 1, uid: 'two', avatar: '/a07.webp' }).svg as string;
    expect(a).toContain('<image href="/a07.webp"');
    expect(a).toContain('preserveAspectRatio="xMidYMid slice"');
    expect(a).toContain('clip-path="url(#onextagc)"');
    expect(b).toContain('clip-path="url(#twoxtagc)"');
    expect(a).toContain('fill="#d19a16"');
    expect(a).toContain('data-avatar="1"');
    const none = ISO.build(360, { b: 0, lvl: 3, w0: 0, w1: 1, uid: 'three' }).svg as string;
    expect(none).toContain('data-avatar="0"');
    expect(none).not.toContain('<image');
  });
  it('the tag sits centred over the pawn (no sideways offset)', () => {
    const svg = ISO.build(360, { b: 0, lvl: 3, w0: 0, w1: 1, uid: 'four', avatar: '/a.webp' }).svg as string;
    expect(svg).toMatch(/class="ptag" data-avatar="1" transform="translate\(0,-[\d.]+\)"/);
  });
});
