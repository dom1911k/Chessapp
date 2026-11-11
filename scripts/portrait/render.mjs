// Vector portrait renderer (v2): bold flat illustration with real character — every look picks
// its own head shape, eyes, nose, mouth, hair silhouette, accessory and backdrop motif, so no
// two faces share the same template. One hard-edged shadow instead of soft gradients.
// renderPortrait(look, mood) → SVG string (200×200). Moods: neutral | happy | worried.

const INK = '#2b1c14';
const shade = (hex, k) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `#${[f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};

/** Head outline per shape, centred on x=100. Returns { d, top, chin, half (half-width at eye level), eyeY }. */
function head(shape) {
  switch (shape) {
    case 'round':
      return { d: 'M100 44 C132 44 146 66 146 92 C146 122 126 142 100 142 C74 142 54 122 54 92 C54 66 68 44 100 44 Z', top: 44, chin: 142, half: 46, eyeY: 94 };
    case 'square':
      return { d: 'M100 42 C130 42 144 58 144 84 L144 108 C144 128 130 142 110 143 L90 143 C70 142 56 128 56 108 L56 84 C56 58 70 42 100 42 Z', top: 42, chin: 143, half: 44, eyeY: 92 };
    case 'heart':
      return { d: 'M100 42 C134 42 148 62 146 88 C144 112 126 134 108 143 C103 145.5 97 145.5 92 143 C74 134 56 112 54 88 C52 62 66 42 100 42 Z', top: 42, chin: 145, half: 45, eyeY: 90 };
    case 'long':
      return { d: 'M100 36 C128 36 140 56 140 84 L140 104 C140 130 122 148 100 148 C78 148 60 130 60 104 L60 84 C60 56 72 36 100 36 Z', top: 36, chin: 148, half: 40, eyeY: 90 };
    default: // oval
      return { d: 'M100 40 C130 40 143 62 143 88 C143 120 124 145 100 145 C76 145 57 120 57 88 C57 62 70 40 100 40 Z', top: 40, chin: 145, half: 43, eyeY: 92 };
  }
}

function eyes(look, mood, h) {
  const y = h.eyeY;
  const dx = look.eyeGap ?? 17;
  const st = look.eyes ?? 'dot';
  const col = look.eyeColor ?? INK;
  const one = (x, flip) => {
    if (mood === 'happy' && st !== 'wide') return `<path d="M${x - 7} ${y + 1} Q${x} ${y - 7} ${x + 7} ${y + 1}" fill="none" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/>`;
    if (st === 'sleepy') return `<path d="M${x - 7} ${y - 1} Q${x} ${y + 3} ${x + 7} ${y - 1}" fill="${INK}"/><path d="M${x - 8} ${y - 2} L${x + 8} ${y - 2}" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`;
    if (st === 'almond')
      return `<path d="M${x - 8} ${y} Q${x} ${y - 7} ${x + 8} ${y} Q${x} ${y + 5} ${x - 8} ${y} Z" fill="#fff"/><circle cx="${x + (flip ? -1 : 1)}" cy="${y - 0.5}" r="3.6" fill="${col}"/><circle cx="${x + (flip ? -1 : 1)}" cy="${y - 0.5}" r="1.7" fill="${INK}"/><path d="M${x - 9} ${y - 1} Q${x} ${y - 9} ${x + 9} ${y - 1}" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`;
    if (st === 'wide') {
      const r = mood === 'worried' ? 7.5 : 6.5;
      return `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff"/><circle cx="${x}" cy="${y + (mood === 'happy' ? -1 : 0.5)}" r="3.8" fill="${col}"/><circle cx="${x}" cy="${y + (mood === 'happy' ? -1 : 0.5)}" r="1.9" fill="${INK}"/><circle cx="${x + 1.6}" cy="${y - 1.8}" r="1.1" fill="#fff"/>`;
    }
    // dot
    const r = mood === 'worried' ? 3.4 : 4;
    return `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 1.2}" fill="${INK}"/><circle cx="${x + 1.2}" cy="${y - 1.6}" r="1.1" fill="#fff"/>`;
  };
  const lash = look.lashes ? [-1, 1].map((s) => `<path d="M${100 + s * (dx + 8)} ${y - 3} l${s * 5} -4" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`).join('') : '';
  return one(100 - dx, true) + one(100 + dx, false) + lash;
}

function brows(look, mood, h) {
  const y = h.eyeY - (look.browLift ?? 13);
  const dx = look.eyeGap ?? 17;
  const w = look.browW ?? 9;
  const sw = look.browWeight ?? 3.4;
  const col = look.browColor ?? shade(look.hair ?? '#3a2a20', 0.7);
  // inner end raised when worried, lowered when stern
  const tilt = mood === 'worried' ? -5 : mood === 'happy' ? 1 : (look.stern ? 4 : 0);
  const b = (s) => `<path d="M${100 + s * (dx - w)} ${y + tilt} Q${100 + s * dx} ${y - (look.browArch ?? 3)} ${100 + s * (dx + w)} ${y + (mood === 'worried' ? 3 : 0)}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round"/>`;
  return b(-1) + b(1);
}

function nose(look, h) {
  const y = h.eyeY + 13;
  const c = shade(look.skin, 0.72);
  switch (look.nose ?? 'curve') {
    case 'dot':
      return `<ellipse cx="100" cy="${y + 2}" rx="3" ry="2.2" fill="${c}"/>`;
    case 'button':
      return `<path d="M94 ${y + 2} Q100 ${y + 8} 106 ${y + 2}" fill="none" stroke="${c}" stroke-width="2.8" stroke-linecap="round"/>`;
    case 'long':
      return `<path d="M101 ${y - 12} L96 ${y + 5} Q100 ${y + 9} 105 ${y + 5}" fill="none" stroke="${c}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 'hook':
      return `<path d="M99 ${y - 13} Q109 ${y - 2} 106 ${y + 5} Q101 ${y + 9} 95 ${y + 5}" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 'wide':
      return `<path d="M92 ${y + 3} Q95 ${y - 2} 100 ${y + 4} Q105 ${y - 2} 108 ${y + 3}" fill="none" stroke="${c}" stroke-width="2.8" stroke-linecap="round"/>`;
    default:
      return `<path d="M100 ${y - 8} Q95 ${y + 3} 97 ${y + 5} Q101 ${y + 7} 104 ${y + 5}" fill="none" stroke="${c}" stroke-width="2.6" stroke-linecap="round"/>`;
  }
}

function mouth(look, mood, h) {
  const y = h.eyeY + 30 + (look.mouthDrop ?? 0);
  const w = look.mouthW ?? 11;
  const lip = look.lip;
  if (mood === 'happy') {
    if (look.smile === 'closed') return `<path d="M${100 - w - 2} ${y - 2} Q100 ${y + 10} ${100 + w + 2} ${y - 2}" fill="none" stroke="${lip ?? INK}" stroke-width="3.2" stroke-linecap="round"/>`;
    return `<path d="M${100 - w - 2} ${y - 3} Q100 ${y + 15} ${100 + w + 2} ${y - 3} Z" fill="#5a1f1f"/><path d="M${100 - w + 1} ${y - 2} Q100 ${y + 2} ${100 + w - 1} ${y - 2} L${100 + w - 2} ${y - 3} L${100 - w + 2} ${y - 3} Z" fill="#fff"/><path d="M${100 - 6} ${y + 6.5} Q100 ${y + 3} ${100 + 6} ${y + 6.5} Q100 ${y + 10} ${100 - 6} ${y + 6.5} Z" fill="#e8787a"/>${lip ? `<path d="M${100 - w - 2} ${y - 3} Q100 ${y + 15} ${100 + w + 2} ${y - 3}" fill="none" stroke="${lip}" stroke-width="2"/>` : ''}`;
  }
  if (mood === 'worried') {
    if (look.worry === 'o') return `<ellipse cx="100" cy="${y + 2}" rx="4.5" ry="5.5" fill="#5a1f1f"/>`;
    return `<path d="M${100 - w} ${y + 4} Q${100 - w / 2} ${y - 2} 100 ${y + 2} Q${100 + w / 2} ${y + 6} ${100 + w} ${y + 1}" fill="none" stroke="${lip ?? INK}" stroke-width="3" stroke-linecap="round"/>`;
  }
  switch (look.mouth ?? 'smile') {
    case 'smirk':
      return `<path d="M${100 - w} ${y + 2} Q${100 + 2} ${y + 5} ${100 + w} ${y - 3}" fill="none" stroke="${lip ?? INK}" stroke-width="3" stroke-linecap="round"/>`;
    case 'flat':
      return `<path d="M${100 - w} ${y + 1} L${100 + w} ${y + 1}" stroke="${lip ?? INK}" stroke-width="3" stroke-linecap="round"/>`;
    case 'grin':
      return `<path d="M${100 - w} ${y - 1} Q100 ${y + 9} ${100 + w} ${y - 1} Z" fill="#fff" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>`;
    case 'lips':
      return `<path d="M${100 - w} ${y + 1} Q${100 - 4} ${y - 4} 100 ${y - 1} Q${100 + 4} ${y - 4} ${100 + w} ${y + 1} Q100 ${y + 8} ${100 - w} ${y + 1} Z" fill="${lip ?? '#b8474f'}"/>`;
    default:
      return `<path d="M${100 - w} ${y} Q100 ${y + 8} ${100 + w} ${y}" fill="none" stroke="${lip ?? INK}" stroke-width="3" stroke-linecap="round"/>`;
  }
}

/** Hair is two layers: behind the head and over it. Coordinates assume the head box; `h` nudges. */
function hair(look, h) {
  const c = look.hair ?? '#3a2a20';
  const hi = look.hairHi ?? shade(c, 1.35);
  const t = h.top;
  const L = 100 - h.half;
  const R = 100 + h.half;
  switch (look.hairStyle) {
    case 'buns': // two high buns + short fringe
      return {
        back: `<circle cx="${L + 4}" cy="${t + 2}" r="19" fill="${c}"/><circle cx="${R - 4}" cy="${t + 2}" r="19" fill="${c}"/><circle cx="${L - 1}" cy="${t - 4}" r="5" fill="${hi}"/><circle cx="${R - 9}" cy="${t - 4}" r="5" fill="${hi}"/>`,
        front: `<path d="M${L - 3} ${t + 44} C${L - 6} ${t - 2} ${R + 6} ${t - 2} ${R + 3} ${t + 44} C${R - 4} ${t + 26} ${R - 14} ${t + 18} 118 ${t + 20} L112 ${t + 30} L104 ${t + 19} L96 ${t + 31} L88 ${t + 19} C${L + 16} ${t + 18} ${L + 5} ${t + 26} ${L - 3} ${t + 44} Z" fill="${c}"/>`,
      };
    case 'afro': // big round cloud
      return {
        back: `<g fill="${c}"><circle cx="100" cy="${t + 14}" r="54"/><circle cx="${L - 8}" cy="${t + 44}" r="24"/><circle cx="${R + 8}" cy="${t + 44}" r="24"/><circle cx="${L + 4}" cy="${t - 10}" r="22"/><circle cx="${R - 4}" cy="${t - 10}" r="22"/><circle cx="100" cy="${t - 26}" r="24"/></g><g fill="${hi}" opacity="0.5"><circle cx="${L + 6}" cy="${t - 14}" r="8"/><circle cx="110" cy="${t - 32}" r="7"/><circle cx="${R + 12}" cy="${t + 30}" r="7"/></g>`,
        front: `<path d="M${L - 2} ${t + 40} C${L} ${t + 6} ${R} ${t + 6} ${R + 2} ${t + 40} C${R - 10} ${t + 22} ${L + 10} ${t + 22} ${L - 2} ${t + 40} Z" fill="${c}"/>`,
      };
    case 'long': // long straight, centre part, falls over shoulders
      return {
        back: `<path d="M${L - 8} ${t + 30} C${L - 10} ${t - 12} ${R + 10} ${t - 12} ${R + 8} ${t + 30} L${R + 14} 200 L${L - 14} 200 Z" fill="${c}"/>`,
        front: `<path d="M100 ${t - 2} C${L + 6} ${t - 2} ${L - 6} ${t + 22} ${L - 5} ${t + 62} C${L + 2} ${t + 34} ${L + 16} ${t + 18} 100 ${t + 6} C${R - 16} ${t + 18} ${R - 2} ${t + 34} ${R + 5} ${t + 62} C${R + 6} ${t + 22} ${R - 6} ${t - 2} 100 ${t - 2} Z" fill="${c}"/><path d="M100 ${t - 1} L100 ${t + 8}" stroke="${shade(c, 0.6)}" stroke-width="2"/><path d="M${L + 4} ${t + 20} Q${L + 12} ${t + 6} ${L + 26} ${t + 4}" fill="none" stroke="${hi}" stroke-width="3" stroke-linecap="round" opacity="0.6"/>`,
      };
    case 'bob': // sharp chin-length bob with a heavy fringe
      return {
        back: `<path d="M${L - 10} ${t + 34} C${L - 12} ${t - 14} ${R + 12} ${t - 14} ${R + 10} ${t + 34} L${R + 12} ${h.chin - 6} L${R - 6} ${h.chin - 2} L${L + 6} ${h.chin - 2} L${L - 12} ${h.chin - 6} Z" fill="${c}"/>`,
        front: `<path d="M${L - 6} ${t + 50} C${L - 8} ${t - 8} ${R + 8} ${t - 8} ${R + 6} ${t + 50} L${R + 1} ${t + 32} L${L - 1} ${t + 32} Z" fill="${c}"/><path d="M${L + 8} ${t + 12} Q100 ${t + 2} ${R - 14} ${t + 10}" fill="none" stroke="${hi}" stroke-width="2.5" stroke-linecap="round" opacity="0.4"/>`,
      };
    case 'locs': // locs gathered up high, a few falling
      return {
        back: `<g fill="${c}"><rect x="${L - 12}" y="${t + 16}" width="12" height="74" rx="6"/><rect x="${R}" y="${t + 16}" width="12" height="80" rx="6"/><rect x="${L - 2}" y="${t + 20}" width="11" height="84" rx="5.5"/><rect x="${R - 9}" y="${t + 20}" width="11" height="78" rx="5.5"/></g>`,
        front: `<path d="M${L - 4} ${t + 38} C${L - 6} ${t - 4} ${R + 6} ${t - 4} ${R + 4} ${t + 38} C${R - 8} ${t + 18} ${L + 8} ${t + 18} ${L - 4} ${t + 38} Z" fill="${c}"/><g fill="${c}"><rect x="84" y="${t - 30}" width="11" height="40" rx="5.5" transform="rotate(-14 90 ${t})"/><rect x="95" y="${t - 34}" width="11" height="42" rx="5.5"/><rect x="106" y="${t - 30}" width="11" height="40" rx="5.5" transform="rotate(14 112 ${t})"/></g><rect x="80" y="${t - 2}" width="40" height="9" rx="4.5" fill="${look.accent ?? '#f2b83f'}"/>`,
      };
    case 'slick': // swept straight back, widow's peak
      return {
        back: `<path d="M${L - 3} ${t + 44} C${L - 8} ${t - 10} ${R + 8} ${t - 10} ${R + 3} ${t + 44} Z" fill="${c}"/>`,
        front: `<path d="M${L - 2} ${t + 34} C${L} ${t - 6} ${R} ${t - 6} ${R + 2} ${t + 34} C${R - 4} ${t + 20} ${R - 16} ${t + 15} 112 ${t + 15} L100 ${t + 25} L88 ${t + 15} C${L + 16} ${t + 15} ${L + 4} ${t + 20} ${L - 2} ${t + 34} Z" fill="${c}"/><path d="M${L + 14} ${t + 6} Q100 ${t - 2} ${R - 14} ${t + 6}" fill="none" stroke="${hi}" stroke-width="2.5" opacity="0.7"/><path d="M${L + 22} ${t + 3} Q100 ${t - 5} ${R - 22} ${t + 3}" fill="none" stroke="${hi}" stroke-width="2" opacity="0.5"/>`,
      };
    case 'topknot': // sleek, pulled up into a knot with a hair stick
      return {
        back: `<circle cx="100" cy="${t - 14}" r="19" fill="${c}"/><path d="M76 ${t - 30} L128 ${t + 2}" stroke="${look.accent ?? '#d6a13a'}" stroke-width="4.5" stroke-linecap="round"/><circle cx="76" cy="${t - 30}" r="4.5" fill="${look.accent ?? '#d6a13a'}"/>`,
        front: `<path d="M${L - 2} ${t + 40} C${L - 4} ${t - 6} ${R + 4} ${t - 6} ${R + 2} ${t + 40} C${R - 2} ${t + 26} ${R - 20} ${t + 17} 100 ${t + 17} C${L + 20} ${t + 17} ${L + 2} ${t + 26} ${L - 2} ${t + 40} Z" fill="${c}"/><path d="M${L + 12} ${t + 10} Q100 ${t} ${R - 12} ${t + 10}" fill="none" stroke="${hi}" stroke-width="3" opacity="0.5" stroke-linecap="round"/>`,
      };
    case 'sidepart': // wavy side part, volume on one side
      return {
        back: `<path d="M${L - 4} ${t + 40} C${L - 10} ${t - 12} ${R + 10} ${t - 14} ${R + 4} ${t + 40} Z" fill="${c}"/>`,
        front: `<path d="M${L - 3} ${t + 38} C${L - 8} ${t} ${L + 24} ${t - 10} 116 ${t - 6} C${R - 2} ${t - 4} ${R + 8} ${t + 14} ${R + 3} ${t + 40} C${R - 2} ${t + 22} ${R - 16} ${t + 12} 112 ${t + 14} C${L + 24} ${t + 16} ${L + 6} ${t + 22} ${L - 3} ${t + 38} Z" fill="${c}"/><path d="M${L + 16} ${t + 4} Q${L + 40} ${t - 8} ${R - 14} ${t + 2}" fill="none" stroke="${hi}" stroke-width="3.5" opacity="0.6" stroke-linecap="round"/>`,
      };
    case 'crop': // short textured crop
      return {
        back: '',
        front: `<path d="M${L - 2} ${t + 34} C${L - 4} ${t - 8} ${R + 4} ${t - 8} ${R + 2} ${t + 34} C${R - 4} ${t + 16} ${R - 12} ${t + 12} ${R - 20} ${t + 14} L${R - 26} ${t + 8} L${R - 34} ${t + 15} L100 ${t + 8} L${L + 30} ${t + 15} L${L + 22} ${t + 9} C${L + 12} ${t + 12} ${L + 4} ${t + 18} ${L - 2} ${t + 34} Z" fill="${c}"/>`,
      };
    case 'ponytail':
      return {
        back: `<path d="M${R - 6} ${t + 6} C${R + 34} ${t + 4} ${R + 34} ${t + 70} ${R + 14} ${t + 96} C${R + 22} ${t + 60} ${R + 12} ${t + 34} ${R - 8} ${t + 26} Z" fill="${c}"/>`,
        front: `<path d="M${L - 3} ${t + 40} C${L - 6} ${t - 6} ${R + 6} ${t - 6} ${R + 3} ${t + 40} C${R - 4} ${t + 20} ${R - 26} ${t + 8} ${L + 30} ${t + 12} C${L + 14} ${t + 16} ${L + 2} ${t + 26} ${L - 3} ${t + 40} Z" fill="${c}"/><rect x="${R - 6}" y="${t + 8}" width="9" height="14" rx="4" fill="${look.accent ?? '#e2574c'}"/>`,
      };
    case 'curlytop': // tight curls on top, faded sides
      return {
        back: `<path d="M${L - 1} ${t + 38} C${L - 2} ${t + 6} ${R + 2} ${t + 6} ${R + 1} ${t + 38} Z" fill="${shade(c, 1.25)}"/>`,
        front: `<g fill="${c}"><circle cx="${L + 14}" cy="${t + 6}" r="13"/><circle cx="${L + 32}" cy="${t - 4}" r="14"/><circle cx="${R - 32}" cy="${t - 4}" r="14"/><circle cx="${R - 14}" cy="${t + 6}" r="13"/><circle cx="100" cy="${t + 2}" r="14"/><circle cx="${L + 22}" cy="${t + 16}" r="10"/><circle cx="${R - 22}" cy="${t + 16}" r="10"/></g>`,
      };
    case 'hijab':
      return {
        back: `<path d="M${L - 16} ${t + 40} C${L - 20} ${t - 22} ${R + 20} ${t - 22} ${R + 16} ${t + 40} C${R + 22} ${t + 100} ${R + 30} 200 ${R + 30} 200 L${L - 30} 200 C${L - 30} 200 ${L - 22} ${t + 100} ${L - 16} ${t + 40} Z" fill="${c}"/>`,
        front: `<path d="M${L - 8} ${t + 52} C${L - 12} ${t - 10} ${R + 12} ${t - 10} ${R + 8} ${t + 52} C${R + 4} ${t + 14} ${L - 4} ${t + 14} ${L - 8} ${t + 52} Z" fill="${c}"/><path d="M${L - 6} ${h.chin - 16} Q100 ${h.chin + 22} ${R + 6} ${h.chin - 16} L${R + 14} ${h.chin + 30} L${L - 14} ${h.chin + 30} Z" fill="${c}"/><path d="M${L + 2} ${t + 16} Q100 ${t + 2} ${R - 2} ${t + 16}" fill="none" stroke="${hi}" stroke-width="3" opacity="0.5"/>`,
      };
    case 'mohawk':
      return {
        back: '',
        front: `<path d="M86 ${t + 14} C82 ${t - 26} 96 ${t - 38} 104 ${t - 36} C118 ${t - 34} 122 ${t - 6} 114 ${t + 14} Z" fill="${c}"/><path d="M96 ${t - 26} Q104 ${t - 30} 108 ${t - 14}" fill="none" stroke="${hi}" stroke-width="3.5" stroke-linecap="round" opacity="0.6"/><path d="M${L - 1} ${t + 34} C${L} ${t + 8} ${R} ${t + 8} ${R + 1} ${t + 34} Z" fill="${shade(c, 1.4)}" opacity="0.35"/>`,
      };
    case 'wavy': // shoulder-length waves
      return {
        back: `<path d="M${L - 10} ${t + 30} C${L - 16} ${t - 16} ${R + 16} ${t - 16} ${R + 10} ${t + 30} C${R + 22} ${t + 60} ${R + 6} ${t + 84} ${R + 18} ${t + 112} L${L - 18} ${t + 112} C${L - 6} ${t + 84} ${L - 22} ${t + 60} ${L - 10} ${t + 30} Z" fill="${c}"/>`,
        front: `<path d="M${L - 4} ${t + 46} C${L - 8} ${t - 6} ${R + 8} ${t - 6} ${R + 4} ${t + 46} C${R - 2} ${t + 20} ${R - 22} ${t + 8} 104 ${t + 10} C${L + 26} ${t + 4} ${L + 2} ${t + 20} ${L - 4} ${t + 46} Z" fill="${c}"/><path d="M${L + 10} ${t + 12} Q${L + 30} ${t - 2} ${R - 22} ${t + 6}" fill="none" stroke="${hi}" stroke-width="3.5" opacity="0.55" stroke-linecap="round"/>`,
      };
    case 'bald':
      return { back: '', front: `<path d="M${L + 14} ${t + 12} Q${L + 28} ${t + 3} ${L + 44} ${t + 5}" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity="0.35"/>` };
    case 'sides': // bald on top, hair at the sides (under a cap)
      return {
        back: `<path d="M${L - 5} ${t + 34} C${L - 8} ${t + 70} ${L - 2} ${t + 76} ${L + 6} ${t + 70} L${L + 6} ${t + 30} Z" fill="${c}"/><path d="M${R + 5} ${t + 34} C${R + 8} ${t + 70} ${R + 2} ${t + 76} ${R - 6} ${t + 70} L${R - 6} ${t + 30} Z" fill="${c}"/>`,
        front: '',
      };
    default:
      return { back: '', front: '' };
  }
}

function facialHair(look, h) {
  const c = look.beardColor ?? look.hair ?? '#3a2a20';
  const y = h.eyeY + 30;
  switch (look.beard) {
    case 'full':
      return `<path d="M${100 - h.half + 1} ${y - 22} C${100 - h.half} ${y + 18} ${100 - 22} ${h.chin + 9} 100 ${h.chin + 9} C${100 + 22} ${h.chin + 9} ${100 + h.half} ${y + 18} ${100 + h.half - 1} ${y - 22} C${100 + h.half - 10} ${y - 4} ${100 + 18} ${y - 12} 100 ${y - 12} C${100 - 18} ${y - 12} ${100 - h.half + 10} ${y - 4} ${100 - h.half + 1} ${y - 22} Z" fill="${c}"/><ellipse cx="100" cy="${y + 2}" rx="13" ry="8" fill="${look.skin}"/>`;
    case 'goatee':
      return `<path d="M86 ${y - 6} Q100 ${y - 12} 114 ${y - 6} L112 ${y + 12} Q100 ${h.chin + 10} 88 ${y + 12} Z" fill="${c}"/><ellipse cx="100" cy="${y + 1}" rx="10" ry="6" fill="${look.skin}"/>`;
    case 'moustache': // a grand one
      return `<path d="M100 ${y - 9} C92 ${y - 15} 78 ${y - 10} 70 ${y - 1} C80 ${y - 3} 92 ${y - 1} 100 ${y - 4} C108 ${y - 1} 120 ${y - 3} 130 ${y - 1} C122 ${y - 10} 108 ${y - 15} 100 ${y - 9} Z" fill="${c}"/>`;
    case 'stubble':
      return `<path d="M${100 - h.half + 4} ${y - 14} C${100 - h.half + 4} ${y + 18} ${100 - 20} ${h.chin + 2} 100 ${h.chin + 2} C${100 + 20} ${h.chin + 2} ${100 + h.half - 4} ${y + 18} ${100 + h.half - 4} ${y - 14} C${100 + 20} ${y - 2} ${100 - 20} ${y - 2} ${100 - h.half + 4} ${y - 14} Z" fill="${c}" opacity="0.22"/>`;
    default:
      return '';
  }
}

function accessories(look, h) {
  const out = { back: '', front: '' };
  const y = h.eyeY;
  const dx = look.eyeGap ?? 17;
  const L = 100 - h.half;
  const R = 100 + h.half;
  const acc = look.accent ?? '#f2b83f';
  if (look.glasses) {
    const f = look.frame ?? INK;
    const lens = look.glasses === 'round' ? [-1, 1].map((s) => `<circle cx="${100 + s * dx}" cy="${y}" r="12" fill="rgba(255,255,255,0.22)" stroke="${f}" stroke-width="3.4"/>`).join('') : look.glasses === 'cat' ? [-1, 1].map((s) => `<path d="M${100 + s * (dx - 13)} ${y - 7} L${100 + s * (dx + 15)} ${y - 11} L${100 + s * (dx + 11)} ${y + 8} Q${100 + s * dx} ${y + 12} ${100 + s * (dx - 11)} ${y + 8} Z" fill="rgba(255,255,255,0.2)" stroke="${f}" stroke-width="3.4" stroke-linejoin="round"/>`).join('') : [-1, 1].map((s) => `<rect x="${100 + s * dx - 13}" y="${y - 9}" width="26" height="18" rx="5" fill="rgba(255,255,255,0.22)" stroke="${f}" stroke-width="3.4"/>`).join('');
    out.front += `${lens}<path d="M${100 - dx + 12} ${y - 1} Q100 ${y - 6} ${100 + dx - 12} ${y - 1}" fill="none" stroke="${f}" stroke-width="3"/><path d="M${100 - dx - 12} ${y - 2} L${L - 2} ${y - 6} M${100 + dx + 12} ${y - 2} L${R + 2} ${y - 6}" stroke="${f}" stroke-width="3" stroke-linecap="round"/>`;
  }
  if (look.earrings) out.front += [-1, 1].map((s) => `<circle cx="${100 + s * (h.half + 5)}" cy="${y + 24}" r="${look.earrings === 'hoop' ? 6 : 3.4}" fill="${look.earrings === 'hoop' ? 'none' : acc}" stroke="${acc}" stroke-width="${look.earrings === 'hoop' ? 2.6 : 0}"/>`).join('');
  if (look.acc === 'headphones') {
    out.back += `<path d="M${L - 8} ${y + 4} C${L - 12} ${h.top - 34} ${R + 12} ${h.top - 34} ${R + 8} ${y + 4}" fill="none" stroke="${acc}" stroke-width="8" stroke-linecap="round"/>`;
    out.front += [-1, 1].map((s) => `<rect x="${100 + s * (h.half + 9) - 9}" y="${y - 12}" width="18" height="32" rx="8" fill="${acc}"/><rect x="${100 + s * (h.half + 9) - 4}" y="${y - 6}" width="8" height="20" rx="4" fill="${shade(acc, 0.7)}"/>`).join('');
  }
  if (look.acc === 'headset') {
    out.back += `<path d="M${L - 7} ${y + 2} C${L - 10} ${h.top - 44} ${R + 10} ${h.top - 44} ${R + 7} ${y + 2}" fill="none" stroke="#22252b" stroke-width="8" stroke-linecap="round"/>`;
    out.front += `<rect x="${L - 18}" y="${y - 12}" width="18" height="32" rx="8" fill="#22252b"/><rect x="${R}" y="${y - 12}" width="18" height="32" rx="8" fill="#22252b"/><circle cx="${L - 9}" cy="${y + 4}" r="4" fill="${acc}"/><circle cx="${R + 9}" cy="${y + 4}" r="4" fill="${acc}"/><path d="M${L - 9} ${y + 18} Q${L - 10} ${y + 44} ${100 - 20} ${y + 40}" fill="none" stroke="#22252b" stroke-width="4" stroke-linecap="round"/><rect x="${100 - 24}" y="${y + 35}" width="13" height="9" rx="4.5" fill="#22252b"/>`;
  }
  if (look.acc === 'flatcap') {
    const c = look.capColor ?? '#6b7a5a';
    out.front += `<path d="M${L - 8} ${h.top + 26} C${L - 8} ${h.top - 14} ${R + 4} ${h.top - 18} ${R + 8} ${h.top + 20} C${R - 10} ${h.top + 10} ${L + 14} ${h.top + 12} ${L - 8} ${h.top + 26} Z" fill="${c}"/><path d="M${L - 16} ${h.top + 30} C${L + 4} ${h.top + 14} ${R - 20} ${h.top + 10} ${R + 10} ${h.top + 20} L${R + 8} ${h.top + 26} C${R - 16} ${h.top + 20} ${L + 4} ${h.top + 24} ${L - 12} ${h.top + 37} Z" fill="${shade(c, 0.72)}"/><path d="M${L + 6} ${h.top + 6} L${R - 10} ${h.top + 2} M${L + 2} ${h.top + 16} L${R - 2} ${h.top + 10}" stroke="${shade(c, 1.25)}" stroke-width="2" opacity="0.6"/>`;
  }
  if (look.acc === 'beanie') {
    const c = look.capColor ?? '#d9473b';
    out.front += `<path d="M${L - 5} ${h.top + 30} C${L - 8} ${h.top - 26} ${R + 8} ${h.top - 26} ${R + 5} ${h.top + 30} Z" fill="${c}"/><rect x="${L - 8}" y="${h.top + 18}" width="${h.half * 2 + 16}" height="16" rx="8" fill="${shade(c, 0.78)}"/><g stroke="${shade(c, 0.62)}" stroke-width="2.4">${[0, 1, 2, 3, 4, 5, 6].map((i) => `<path d="M${L + 2 + i * ((h.half * 2 - 4) / 6)} ${h.top + 20} v12"/>`).join('')}</g><circle cx="100" cy="${h.top - 20}" r="9" fill="${shade(c, 1.2)}"/>`;
  }
  if (look.acc === 'cap') {
    const c = look.capColor ?? '#2f6fd0';
    out.front += `<path d="M${L - 4} ${h.top + 28} C${L - 6} ${h.top - 20} ${R + 6} ${h.top - 20} ${R + 4} ${h.top + 28} Z" fill="${c}"/><path d="M${L - 4} ${h.top + 24} L${R + 30} ${h.top + 24} Q${R + 34} ${h.top + 34} ${R + 22} ${h.top + 34} L${L - 4} ${h.top + 32} Z" fill="${shade(c, 0.74)}"/><circle cx="100" cy="${h.top - 12}" r="4" fill="${shade(c, 0.74)}"/>`;
  }
  if (look.acc === 'crown') out.front += `<path d="M76 ${h.top + 6} L72 ${h.top - 22} L88 ${h.top - 8} L100 ${h.top - 30} L112 ${h.top - 8} L128 ${h.top - 22} L124 ${h.top + 6} Z" fill="#f2c230" stroke="#b9860f" stroke-width="2.4" stroke-linejoin="round"/><circle cx="100" cy="${h.top - 6}" r="3.6" fill="#e2574c"/>`;
  if (look.freckles) out.front += [-1, 1].map((s) => [[10, 9], [16, 12], [22, 8], [15, 5]].map(([a, b]) => `<circle cx="${100 + s * (a + 6)}" cy="${y + b + 4}" r="1.5" fill="${shade(look.skin, 0.66)}"/>`).join('')).join('');
  if (look.blush) out.front += [-1, 1].map((s) => `<ellipse cx="${100 + s * (h.half - 12)}" cy="${y + 15}" rx="8" ry="5" fill="#ff7d7d" opacity="0.32"/>`).join('');
  if (look.mole) out.front += `<circle cx="${100 + 15}" cy="${y + 24}" r="1.8" fill="${INK}"/>`;
  if (look.wrinkles) out.front += `<path d="M${100 - dx - 12} ${y + 8} q-4 4 -2 9 M${100 + dx + 12} ${y + 8} q4 4 2 9" fill="none" stroke="${shade(look.skin, 0.7)}" stroke-width="2" stroke-linecap="round"/><path d="M88 ${h.top + 24} q12 -4 24 0" fill="none" stroke="${shade(look.skin, 0.74)}" stroke-width="2" stroke-linecap="round"/>`;
  return out;
}

function body(look, h) {
  const c = look.clothes ?? '#3f78c4';
  const d = shade(c, 0.74);
  const y = h.chin + 16;
  const neck = `<path d="M84 ${h.chin - 16} L84 ${y + 6} Q100 ${y + 18} 116 ${y + 6} L116 ${h.chin - 16} Z" fill="${shade(look.skin, 0.84)}"/>`;
  const torso = `<path d="M22 208 C22 ${y + 10} 58 ${y + 4} 84 ${y + 2} Q100 ${y + 14} 116 ${y + 2} C142 ${y + 4} 178 ${y + 10} 178 208 Z" fill="${c}"/>`;
  let extra = '';
  switch (look.top) {
    case 'hoodie':
      extra = `<path d="M70 ${y + 2} Q100 ${y + 34} 130 ${y + 2} L140 ${y + 8} Q100 ${y + 50} 60 ${y + 8} Z" fill="${d}"/><path d="M92 ${y + 26} v24 M108 ${y + 26} v24" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.8"/>`;
      break;
    case 'blazer':
      extra = `<path d="M84 ${y + 2} L100 ${y + 40} L116 ${y + 2} Q100 ${y + 14} 84 ${y + 2} Z" fill="${look.shirt ?? '#f4f1eb'}"/><path d="M84 ${y + 2} L66 ${y + 12} L96 ${y + 58} L100 ${y + 40} Z" fill="${d}"/><path d="M116 ${y + 2} L134 ${y + 12} L104 ${y + 58} L100 ${y + 40} Z" fill="${d}"/>`;
      break;
    case 'collar':
      extra = `<path d="M84 ${y + 2} L100 ${y + 30} L116 ${y + 2} Q100 ${y + 14} 84 ${y + 2} Z" fill="${look.shirt ?? '#f4f1eb'}"/><path d="M82 ${y} L70 ${y + 14} L92 ${y + 24} L100 ${y + 12} Z" fill="${look.shirt ?? '#fff'}"/><path d="M118 ${y} L130 ${y + 14} L108 ${y + 24} L100 ${y + 12} Z" fill="${look.shirt ?? '#fff'}"/>`;
      break;
    case 'turtleneck':
      extra = `<path d="M80 ${h.chin - 6} Q100 ${h.chin + 8} 120 ${h.chin - 6} L122 ${y + 10} Q100 ${y + 22} 78 ${y + 10} Z" fill="${d}"/>`;
      break;
    case 'stripes':
      extra = `<g stroke="${look.shirt ?? '#fff'}" stroke-width="6" opacity="0.85"><path d="M30 ${y + 30} Q100 ${y + 44} 170 ${y + 30}"/><path d="M26 ${y + 48} Q100 ${y + 62} 174 ${y + 48}"/></g>`;
      break;
    case 'sweater':
      extra = `<path d="M82 ${y + 1} Q100 ${y + 22} 118 ${y + 1} L124 ${y + 5} Q100 ${y + 32} 76 ${y + 5} Z" fill="${d}"/><path d="M86 ${y + 3} L100 ${y + 20} L114 ${y + 3}" fill="${look.shirt ?? '#f3efe6'}"/>`;
      break;
    default:
      extra = `<path d="M82 ${y + 1} Q100 ${y + 20} 118 ${y + 1} L122 ${y + 4} Q100 ${y + 28} 78 ${y + 4} Z" fill="${d}"/>`;
  }
  if (look.bowtie) extra += `<path d="M100 ${y + 14} L84 ${y + 6} L84 ${y + 24} Z M100 ${y + 14} L116 ${y + 6} L116 ${y + 24} Z" fill="${look.bowtie}"/><circle cx="100" cy="${y + 14}" r="4" fill="${shade(look.bowtie, 0.75)}"/>`;
  if (look.scarf) extra += `<path d="M76 ${h.chin - 2} Q100 ${h.chin + 18} 124 ${h.chin - 2} L128 ${y + 12} Q100 ${y + 28} 72 ${y + 12} Z" fill="${look.scarf}"/><path d="M112 ${y + 14} L120 ${y + 50} L104 ${y + 50} L104 ${y + 18} Z" fill="${shade(look.scarf, 0.82)}"/>`;
  if (look.necklace) extra += `<path d="M86 ${y + 4} Q100 ${y + 24} 114 ${y + 4}" fill="none" stroke="${look.necklace}" stroke-width="2.4"/><circle cx="100" cy="${y + 15}" r="3.4" fill="${look.necklace}"/>`;
  return neck + torso + extra;
}

/** A bold backdrop with a motif that says something about the character. */
function backdrop(bg) {
  const [a, b] = bg.colors ?? ['#e6f0fd', '#9fc3f3'];
  const base = `<rect width="200" height="200" fill="${a}"/>`;
  switch (bg.motif) {
    case 'sun':
      return `${base}<g fill="${b}">${Array.from({ length: 12 }, (_, i) => `<path d="M100 105 L${100 + 180 * Math.cos((i * Math.PI) / 6 - 0.13)} ${105 + 180 * Math.sin((i * Math.PI) / 6 - 0.13)} L${100 + 180 * Math.cos((i * Math.PI) / 6 + 0.13)} ${105 + 180 * Math.sin((i * Math.PI) / 6 + 0.13)} Z"/>`).join('')}</g>`;
    case 'checker':
      return `${base}<g fill="${b}">${Array.from({ length: 5 }, (_, r) => Array.from({ length: 5 }, (_, c) => ((r + c) % 2 ? `<rect x="${c * 40}" y="${r * 40}" width="40" height="40"/>` : '')).join('')).join('')}</g>`;
    case 'stripes':
      return `${base}<g stroke="${b}" stroke-width="16">${Array.from({ length: 8 }, (_, i) => `<path d="M${-40 + i * 40} 210 L${60 + i * 40} -10"/>`).join('')}</g>`;
    case 'dots':
      return `${base}<g fill="${b}">${Array.from({ length: 6 }, (_, r) => Array.from({ length: 6 }, (_, c) => `<circle cx="${18 + c * 34 + (r % 2) * 17}" cy="${16 + r * 34}" r="7"/>`).join('')).join('')}</g>`;
    case 'circle':
      return `${base}<circle cx="100" cy="96" r="82" fill="${b}"/>`;
    case 'arch':
      return `${base}<path d="M24 210 L24 96 C24 40 176 40 176 96 L176 210 Z" fill="${b}"/>`;
    case 'bolt':
      return `${base}<path d="M-10 60 L80 20 L60 80 L210 30 L210 110 L100 150 L124 90 L-10 140 Z" fill="${b}"/>`;
    case 'waves':
      return `${base}<g fill="none" stroke="${b}" stroke-width="12">${[30, 70, 110, 150, 190].map((y) => `<path d="M-10 ${y} Q25 ${y - 18} 60 ${y} T130 ${y} T210 ${y}"/>`).join('')}</g>`;
    case 'split':
      return `${base}<path d="M0 0 L200 0 L200 200 Z" fill="${b}"/>`;
    default:
      return `${base}<circle cx="150" cy="40" r="70" fill="${b}"/>`;
  }
}

export function renderPortrait(look, mood = 'neutral') {
  const h = head(look.head ?? 'oval');
  const hr = hair(look, h);
  const ac = accessories(look, h);
  const sk = look.skin;
  const dark = shade(sk, 0.86);
  const id = `c${Math.abs([...JSON.stringify(look) + mood].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) | 0, 7))}`;
  const ears = look.hairStyle === 'hijab' ? '' : [-1, 1].map((s) => `<ellipse cx="${100 + s * (h.half + 1)}" cy="${h.eyeY + 8}" rx="7" ry="11" fill="${s < 0 ? sk : dark}"/>`).join('');
  const tilt = look.tilt ?? 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
<defs><clipPath id="${id}"><path d="${h.d}"/></clipPath><clipPath id="${id}f"><rect width="200" height="200"/></clipPath></defs>
<g clip-path="url(#${id}f)">
${backdrop(look.bg ?? {})}
<g transform="translate(0 ${look.drop ?? 10})">
${body(look, h)}
<g transform="rotate(${tilt} 100 ${h.chin})">
${ac.back}${hr.back}${ears}
<path d="${h.d}" fill="${sk}"/>
<g clip-path="url(#${id})"><path d="M108 0 L200 0 L200 200 L132 200 Q118 120 108 0 Z" fill="${dark}"/>${look.cheek ? `<ellipse cx="100" cy="${h.chin + 4}" rx="30" ry="12" fill="${dark}" opacity="0.5"/>` : ''}</g>
${facialHair(look, h)}
${hr.front}
${brows(look, mood, h)}${eyes(look, mood, h)}${nose(look, h)}${mouth(look, mood, h)}
${ac.front}
</g></g></g></svg>`;
}
