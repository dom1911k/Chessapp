// The Puzzle Path's shared artwork (plain SVG markup, used by React and by the world renderer):
// the level badge's puzzle-piece outline, each board's material, and a finished board's trophy.

/** The badge outline (60×60 box), from the prototype. */
export const PZ = 'M14,14 H23 C22,10 24,6.5 28.5,6.5 C33,6.5 35,10 34,14 H42 Q46,14 46,18 V25 C50,24 53.5,26 53.5,30.5 C53.5,35 50,37 46,36 V46 Q46,50 42,50 H14 Q10,50 10,46 V18 Q10,14 14,14 Z';
/** Each board's material: highlight, mid, shade (Wood adds grain). */
export const MAT: [string, string, string][] = [
  ['#e3b27a', '#b8773f', '#7d4a22'],
  ['#eef0f2', '#b3b9be', '#7d848b'],
  ['#f7c48c', '#c97a3c', '#7a3f16'],
  ['#ffffff', '#c6d0d9', '#7e8b97'],
  ['#e6fbff', '#5cc8e6', '#1a7e9e'],
  ['#e2c8ff', '#9b5de5', '#4a1d8a'],
  ['#ffb3b3', '#e0383e', '#7a1018'],
  ['#fff3b0', '#f2b51c', '#8a5a05'],
];

/** The trophy's box: 120 × 160, standing on (60, 160). */
export const TROPHY_W = 120;
export const TROPHY_H = 160;

const f1 = (v: number) => Math.round(v * 10) / 10;

/**
 * A finished board's trophy: its puzzle piece (the board's material, Wood's grain or the glint)
 * with a white star instead of a number, a gold laurel, a gold ribbon with the board's name in
 * caps, on a small isometric plinth in the board's colours. `u` keeps gradient ids apart.
 */
export function trophyMarkup(tier: number, name: string, plinth: { nx: string[]; fu: string[]; side: string }, u: string): string {
  const t = Math.min(7, Math.max(0, tier));
  const [a, b, c] = MAT[t];
  const label = name.toUpperCase();
  // Plinth: an iso block (top diamond, two faces) at the foot.
  const cx = 60, cy = 134, hw = 36, hh = 14, th = 12;
  const plin =
    `<ellipse cx="${cx + 4}" cy="${cy + hh + th - 1}" rx="${hw + 6}" ry="${hh * 0.7}" fill="#000" opacity=".22"/>` +
    `<polygon points="${cx - hw},${cy} ${cx},${cy + hh} ${cx},${cy + hh + th} ${cx - hw},${cy + th}" fill="${plinth.fu[0]}"/>` +
    `<polygon points="${cx},${cy + hh} ${cx + hw},${cy} ${cx + hw},${cy + th} ${cx},${cy + hh + th}" fill="${plinth.side}"/>` +
    `<polygon points="${cx - hw},${cy} ${cx},${cy - hh} ${cx + hw},${cy} ${cx},${cy + hh}" fill="${plinth.nx[0]}"/>` +
    `<polygon points="${cx - hw * 0.62},${cy} ${cx},${cy - hh * 0.62} ${cx + hw * 0.62},${cy} ${cx},${cy + hh * 0.62}" fill="${plinth.nx[1] ?? plinth.nx[0]}" opacity=".7"/>`;
  // Laurel: two branches curving up either side of the piece, almond leaves in pairs along them.
  let laurel = '';
  const leaf = (x: number, y: number, ang: number, L: number, w: number, fill: string) =>
    `<path d="M0,0 C${f1(L * 0.35)},${f1(-w)} ${f1(L * 0.72)},${f1(-w)} ${f1(L)},0 C${f1(L * 0.72)},${f1(w)} ${f1(L * 0.35)},${f1(w)} 0,0 Z" fill="${fill}" transform="translate(${f1(x)},${f1(y)}) rotate(${f1(ang)})"/>`;
  for (const side of [-1, 1]) {
    const x0 = 60 + side * 12, y0 = 128, x1 = 60 + side * 54, y1 = 108, x2 = 60 + side * 38, y2 = 46;
    laurel += `<path d="M${x0},${y0} Q${x1},${y1} ${x2},${y2}" fill="none" stroke="#b8860b" stroke-width="2.2" stroke-linecap="round"/>`;
    for (let k = 0; k < 7; k++) {
      const q = 0.08 + (k / 6) * 0.9;
      const x = (1 - q) * (1 - q) * x0 + 2 * (1 - q) * q * x1 + q * q * x2;
      const y = (1 - q) * (1 - q) * y0 + 2 * (1 - q) * q * y1 + q * q * y2;
      const dx = 2 * (1 - q) * (x1 - x0) + 2 * q * (x2 - x1);
      const dy = 2 * (1 - q) * (y1 - y0) + 2 * q * (y2 - y1);
      const th = (Math.atan2(dy, dx) * 180) / Math.PI;
      const L = 12 - q * 4;
      laurel += leaf(x, y, th - 38 * side, L, L * 0.36, '#e8a91c') + leaf(x, y, th + 38 * side, L, L * 0.36, '#f7c631');
      laurel += leaf(x, y, th - 38 * side, L * 0.8, L * 0.12, '#ffe58f') + leaf(x, y, th + 38 * side, L * 0.8, L * 0.12, '#fff1b8');
    }
    laurel += leaf(x2, y2, (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI, 11, 4, '#f7c631');
  }
  // The piece, with a star.
  const star = Array.from({ length: 10 }, (_, k) => {
    const r = k % 2 ? 5.4 : 12.5;
    const an = -Math.PI / 2 + (k * Math.PI) / 5;
    return `${f1(28 + Math.cos(an) * r)},${f1(32 + Math.sin(an) * r)}`;
  }).join(' ');
  const grain = t === 0 ? `<g clip-path="url(#${u}c)" opacity=".38">${[10, 16, 22, 28, 34, 40, 46].map((y, k) => `<path d="M8,${y} q12,${k % 2 ? -3 : 3} 24,0 t24,0" stroke="#6b3a14" stroke-width="1.2" fill="none"/>`).join('')}</g>` : `<path d="M12,16 L30,16 L16,40 Z" fill="#fff" opacity=".22" clip-path="url(#${u}c)"/>`;
  const piece =
    `<g transform="translate(23,30) scale(1.24) rotate(-8 30 30)">` +
    `<path d="${PZ}" fill="${c}" transform="translate(0,4)"/><path d="${PZ}" fill="url(#${u}g)"/>${grain}` +
    `<path d="${PZ}" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width="1.2"/>` +
    `<polygon points="${star}" fill="#fff" stroke="${c}" stroke-width="2.6" stroke-linejoin="round" paint-order="stroke"/></g>`;
  // Ribbon with the board's name.
  const fit = label.length > 7 ? ` textLength="74" lengthAdjust="spacingAndGlyphs"` : '';
  const ribbon =
    `<path d="M14,100 L24,100 L24,118 L14,118 L19,109 Z" fill="#c98a12"/><path d="M106,100 L96,100 L96,118 L106,118 L101,109 Z" fill="#c98a12"/>` +
    `<rect x="20" y="97" width="80" height="19" rx="3" fill="url(#${u}r)"/><rect x="20" y="97" width="80" height="3" rx="1.5" fill="#fff6c8" opacity=".7"/>` +
    `<text x="60" y="110.5" text-anchor="middle" font-size="11" font-weight="900" letter-spacing=".08em" fill="#6b4500"${fit} font-family="'Plus Jakarta Sans Variable',system-ui,sans-serif">${label}</text>`;
  const defs = `<defs><linearGradient id="${u}g" x1="0" y1="0" x2=".8" y2="1"><stop offset="0" stop-color="${a}"/><stop offset=".55" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient><linearGradient id="${u}r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe07a"/><stop offset="1" stop-color="#e0a21a"/></linearGradient><clipPath id="${u}c"><path d="${PZ}"/></clipPath></defs>`;
  return defs + plin + laurel + piece + ribbon;
}
