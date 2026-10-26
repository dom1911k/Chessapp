// Hand-built vector portrait renderer: soft-shaded, front-facing busts.
// Each character is described by a "look" (see src/lib/people/looks.json).
// Output: a self-contained SVG string (200×200).

const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
function shade(hex, amt) {
  // amt > 0 lightens, < 0 darkens (−1..1)
  const n = parseInt(hex.replace('#', ''), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  else { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
  return `#${((clamp(r) << 16) | (clamp(g) << 8) | clamp(b)).toString(16).padStart(6, '0')}`;
}

let uid = 0;
function grad(id, stops, x1 = 0, y1 = 0, x2 = 0, y2 = 1) {
  return `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops
    .map(([o, c, op = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${op}"/>`)
    .join('')}</linearGradient>`;
}
function rgrad(id, stops, cx = 0.5, cy = 0.5, r = 0.5) {
  return `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops
    .map(([o, c, op = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${op}"/>`)
    .join('')}</radialGradient>`;
}

// ---------- parts ----------

const HEAD = 'M100 46 C126 46 140 64 140 92 C140 122 124 146 100 146 C76 146 60 122 60 92 C60 64 74 46 100 46 Z';

function clothing(look, ids) {
  const c = look.clothes ?? '#3d5a80';
  const style = look.top ?? 'crew';
  let detail = '';
  if (style === 'blazer')
    detail = `<path d="M100 150 L84 168 L76 200 L62 200 L70 166 Z" fill="${shade(c, -0.18)}"/><path d="M100 150 L116 168 L124 200 L138 200 L130 166 Z" fill="${shade(c, -0.18)}"/>
      <path d="M90 152 L100 172 L110 152 L106 150 L100 160 L94 150 Z" fill="${look.shirt ?? '#f4f1ec'}"/>`;
  if (style === 'sweater')
    detail = `<path d="M82 150 Q100 170 118 150 Q112 162 100 164 Q88 162 82 150 Z" fill="${look.shirt ?? '#f4f1ec'}"/><path d="M80 151 Q100 174 120 151" stroke="${shade(c, -0.22)}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
  if (style === 'hoodie')
    detail = `<path d="M70 150 Q100 182 130 150" stroke="${shade(c, -0.2)}" stroke-width="7" fill="none" stroke-linecap="round"/>
      <path d="M92 168 L90 188 M108 168 L110 188" stroke="${shade(c, 0.5)}" stroke-width="2.4" stroke-linecap="round"/>`;
  if (style === 'collar')
    detail = `<path d="M86 148 L100 162 L114 148 L120 156 L100 172 L80 156 Z" fill="${look.shirt ?? '#f4f1ec'}"/>`;
  if (style === 'crew') detail = `<path d="M84 150 Q100 164 116 150" stroke="${shade(c, -0.22)}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
  return `<path d="M34 200 C38 170 60 152 84 147 L116 147 C140 152 162 170 166 200 Z" fill="url(#${ids.cloth})"/>${detail}`;
}

function neck(look, ids) {
  return `<path d="M86 130 L86 152 Q100 160 114 152 L114 130 Z" fill="url(#${ids.neck})"/>
    <path d="M86 140 Q100 150 114 140 L114 134 Q100 144 86 134 Z" fill="${shade(look.skin, -0.25)}" opacity="0.35"/>`;
}

function ears(look) {
  const s = look.skin;
  return `<ellipse cx="60" cy="98" rx="8" ry="12" fill="${shade(s, -0.06)}"/><ellipse cx="61.5" cy="98" rx="4" ry="7" fill="${shade(s, -0.2)}" opacity="0.6"/>
    <ellipse cx="140" cy="98" rx="8" ry="12" fill="${shade(s, -0.06)}"/><ellipse cx="138.5" cy="98" rx="4" ry="7" fill="${shade(s, -0.2)}" opacity="0.6"/>
    ${look.earrings ? `<circle cx="60" cy="112" r="3" fill="#e2b13c"/><circle cx="59.2" cy="111.2" r="1" fill="#fff6d0"/><circle cx="140" cy="112" r="3" fill="#e2b13c"/><circle cx="139.2" cy="111.2" r="1" fill="#fff6d0"/>` : ''}`;
}

function face(look, ids, mood) {
  const s = look.skin;
  const ink = '#2b1d16';
  const brow = look.browColor ?? shade(look.hair, -0.25);
  const iris = look.eyeColor ?? '#5b3a24';
  // Eyebrows: raised inner ends when worried, lifted when happy.
  const lift = mood === 'happy' ? -2 : 0;
  const worry = mood === 'worried' ? -4 : 0;
  const bw = look.browWeight ?? 3.2;
  const brows = `<path d="M74 ${80 + lift} Q82 ${74 + lift} 92 ${78 + lift + worry}" stroke="${brow}" stroke-width="${bw}" fill="none" stroke-linecap="round"/>
    <path d="M126 ${80 + lift} Q118 ${74 + lift} 108 ${78 + lift + worry}" stroke="${brow}" stroke-width="${bw}" fill="none" stroke-linecap="round"/>`;
  let eyes;
  if (mood === 'happy') {
    eyes = `<path d="M75 94 Q83 86 91 94" stroke="${ink}" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M109 94 Q117 86 125 94" stroke="${ink}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
  } else {
    const eye = (cx) => `<path d="M${cx - 9} 93 Q${cx} 84 ${cx + 9} 93 Q${cx} 99 ${cx - 9} 93 Z" fill="#fbf8f4"/>
      <circle cx="${cx}" cy="92.6" r="4.4" fill="${iris}"/><circle cx="${cx}" cy="92.6" r="2.2" fill="#1a110c"/>
      <circle cx="${cx + 1.5}" cy="91" r="1.3" fill="#fff"/>
      <path d="M${cx - 9.5} 93 Q${cx} 83.5 ${cx + 9.5} 93" stroke="${ink}" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M${cx - 8} 87.5 Q${cx} 81 ${cx + 8} 87.5" stroke="${shade(s, -0.3)}" stroke-width="1.2" fill="none" opacity="0.6" stroke-linecap="round"/>
      <path d="M${cx - 6} 97.5 Q${cx} 99.5 ${cx + 6} 97.5" stroke="${shade(s, -0.25)}" stroke-width="1" fill="none" opacity="0.5" stroke-linecap="round"/>`;
    eyes = eye(83) + eye(117);
  }
  const nose = `<path d="M100 98 Q96 112 98 116 Q101 118 105 115" stroke="${shade(s, -0.32)}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  let mouth;
  if (mood === 'happy')
    mouth = `<path d="M88 124 Q100 138 112 124 Q100 128 88 124 Z" fill="#7a2e2a"/><path d="M90 125 Q100 129 110 125 L109 127 Q100 130 91 127 Z" fill="#fff"/>`;
  else if (mood === 'worried') mouth = `<path d="M91 129 Q100 124 109 129" stroke="#8a3b34" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
  else
    mouth = `<path d="M89 125 Q100 131 111 125 Q100 136 89 125 Z" fill="${look.lips ?? '#b9564b'}"/><path d="M88.5 125 Q100 131.5 111.5 125" stroke="#7a2e28" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M96 131 Q100 132.5 104 131" stroke="#fff" stroke-width="1.2" fill="none" opacity="0.35" stroke-linecap="round"/>`;
  const cheekLight = `<ellipse cx="78" cy="104" rx="7" ry="3.5" fill="#fff" opacity="0.18"/><ellipse cx="122" cy="104" rx="7" ry="3.5" fill="#fff" opacity="0.18"/>`;
  const blush = cheekLight + `<ellipse cx="76" cy="112" rx="9" ry="5" fill="url(#${ids.blush})"/><ellipse cx="124" cy="112" rx="9" ry="5" fill="url(#${ids.blush})"/>`;
  const freckles = look.freckles
    ? [[72, 106], [77, 109], [81, 105], [119, 105], [123, 109], [128, 106]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.1" fill="${shade(s, -0.35)}" opacity="0.7"/>`).join('')
    : '';
  return { features: blush + freckles + brows + eyes + nose, mouth };
}

function beard(look) {
  if (!look.beard) return '';
  const c = look.beardColor ?? look.hair;
  if (look.beard === 'stubble')
    return `<path d="M64 108 C66 136 84 148 100 148 C116 148 134 136 136 108 C130 128 116 136 100 136 C84 136 70 128 64 108 Z" fill="${c}" opacity="0.28"/>`;
  if (look.beard === 'moustache')
    return `<path d="M84 120 Q92 113 100 117 Q108 113 116 120 Q108 120 100 121 Q92 120 84 120 Z" fill="${c}"/>`;
  // full beard
  return `<path d="M62 100 C62 140 82 158 100 158 C118 158 138 140 138 100 C134 116 126 124 116 122 Q100 115 84 122 C74 124 66 116 62 100 Z M86 125 Q100 121 114 125 Q112 135 100 137 Q88 135 86 125 Z" fill="${c}" fill-rule="evenodd"/>
    <path d="M84 121 Q92 115 100 118 Q108 115 116 121 Q108 123 100 122 Q92 123 84 121 Z" fill="${shade(c, -0.12)}"/>
    <path d="M70 128 Q80 146 100 152 M130 128 Q120 146 100 152" stroke="${shade(c, 0.25)}" stroke-width="1.8" fill="none" opacity="0.45"/>`;
}

function glasses(look) {
  if (!look.glasses) return '';
  const f = look.glassesColor ?? '#2b1d16';
  const lens = `fill="#dfeffa" fill-opacity="0.18"`;
  const shape =
    look.glasses === 'round'
      ? `<circle cx="83" cy="93" r="12" ${lens} stroke="${f}" stroke-width="2.6"/><circle cx="117" cy="93" r="12" ${lens} stroke="${f}" stroke-width="2.6"/>`
      : `<rect x="70" y="84" width="26" height="18" rx="6" ${lens} stroke="${f}" stroke-width="2.6"/><rect x="104" y="84" width="26" height="18" rx="6" ${lens} stroke="${f}" stroke-width="2.6"/>`;
  return `${shape}<path d="M95 92 Q100 89 105 92" stroke="${f}" stroke-width="2.4" fill="none"/>
    <path d="M71 92 L62 90 M129 92 L138 90" stroke="${f}" stroke-width="2.4"/>
    <path d="M76 88 L82 84 M110 88 L116 84" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity="0.7"/>`;
}

/** Hair has a back layer (behind the head) and a front layer (over the forehead). */
function hair(look, ids) {
  const h = `url(#${ids.hair})`;
  const hl = shade(look.hair, 0.28);
  const st = look.hairStyle;
  const shine = (d) => `<path d="${d}" stroke="${hl}" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.55"/>`;
  switch (st) {
    case 'short':
      return {
        back: '',
        front: `<path d="M58 92 C54 56 76 38 102 38 C128 38 146 56 142 92 C138 74 128 64 112 62 C96 70 78 66 66 70 C60 76 59 84 58 92 Z" fill="${h}"/>${shine('M78 50 Q96 42 116 46')}`,
      };
    case 'sidepart':
      return {
        back: '',
        front: `<path d="M58 94 C52 58 74 36 104 36 C132 36 148 58 142 94 C140 76 132 62 118 58 C100 62 88 56 82 50 C76 60 66 66 60 74 Z" fill="${h}"/>${shine('M86 46 Q104 40 124 48')}`,
      };
    case 'slick':
      return {
        back: '',
        front: `<path d="M60 86 C56 54 78 40 102 40 C126 40 144 54 140 86 C136 66 124 56 100 56 C80 56 66 64 60 86 Z" fill="${h}"/>${shine('M76 54 Q100 44 124 54')}${shine('M80 62 Q100 54 120 60')}`,
      };
    case 'bald':
      return {
        back: '',
        front: `<path d="M58 100 C56 84 60 74 66 70 L68 92 Z" fill="${h}"/><path d="M142 100 C144 84 140 74 134 70 L132 92 Z" fill="${h}"/>${`<path d="M82 52 Q100 46 116 52" stroke="#fff" stroke-width="5" fill="none" opacity="0.18" stroke-linecap="round"/>`}`,
      };
    case 'spiky':
      return {
        back: '',
        front: `<path d="M58 92 C54 66 62 48 76 42 C80 34 92 30 100 34 C108 28 122 32 126 40 C140 46 146 66 142 92 C140 76 132 66 120 62 C112 68 102 64 96 60 C88 66 76 66 66 72 C62 78 59 84 58 92 Z" fill="${h}"/>
          <path d="M76 44 Q84 50 86 58 M98 36 Q104 46 102 56 M118 40 Q122 50 120 60" stroke="${shade(look.hair, -0.2)}" stroke-width="2.2" fill="none" stroke-linecap="round" opacity="0.6"/>${shine('M82 44 Q98 36 116 42')}`,
      };
    case 'bun':
      return {
        back: `<ellipse cx="100" cy="36" rx="19" ry="16" fill="${h}"/><path d="M86 34 Q100 26 114 34" stroke="${shade(look.hair, -0.3)}" stroke-width="2" fill="none" opacity="0.6"/>${shine('M90 28 Q100 22 110 28')}`,
        front: `<path d="M58 96 C54 60 76 40 100 40 C124 40 146 60 142 96 C138 72 126 58 100 56 C76 58 62 72 58 96 Z" fill="${h}"/>${shine('M80 52 Q100 44 120 52')}`,
      };
    case 'twobuns':
      return {
        back: `<circle cx="70" cy="44" r="15" fill="${h}"/><circle cx="130" cy="44" r="15" fill="${h}"/>`,
        front: `<path d="M58 96 C54 60 76 42 100 42 C124 42 146 60 142 96 C138 76 128 66 112 64 C104 72 86 70 78 64 C68 70 60 82 58 96 Z" fill="${h}"/>${shine('M82 54 Q100 46 118 54')}`,
      };
    case 'bob':
      return {
        back: `<path d="M54 92 C50 56 74 38 100 38 C126 38 150 56 146 92 L148 138 Q124 146 116 138 L84 138 Q76 146 52 138 Z" fill="${h}"/>`,
        front: `<path d="M58 100 C54 62 76 42 100 42 C124 42 146 62 142 100 C138 80 130 64 112 58 C98 66 80 64 70 66 C62 76 59 86 58 100 Z" fill="${h}"/>${shine('M84 52 Q102 44 122 52')}`,
      };
    case 'long':
      return {
        back: `<path d="M52 90 C48 52 74 36 100 36 C126 36 152 52 148 90 L154 176 Q128 186 116 170 L84 170 Q72 186 46 176 Z" fill="${h}"/>`,
        front: `<path d="M58 104 C54 62 76 40 100 40 C124 40 146 62 142 104 C140 80 128 62 106 58 C94 74 74 76 64 80 C60 88 59 96 58 104 Z" fill="${h}"/>${shine('M86 50 Q104 44 124 52')}${shine('M58 110 Q56 140 62 166')}`,
      };
    case 'curly': {
      const curls = [[64, 66], [72, 50], [88, 40], [104, 36], [120, 42], [134, 54], [140, 70], [60, 84], [142, 88], [56, 102], [146, 104], [58, 120], [144, 120], [64, 136], [138, 136]]
        .map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${13 + (i % 3)}" fill="${h}"/>`)
        .join('');
      return {
        back: curls,
        front: `<path d="M64 84 C66 64 82 54 100 54 C118 54 134 64 136 84 C128 72 116 68 104 70 C92 72 76 70 64 84 Z" fill="${h}"/>${[[78, 62], [96, 56], [114, 58], [128, 68]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="10" fill="${h}"/>`).join('')}${shine('M84 50 Q100 42 118 48')}`,
      };
    }
    case 'afro': {
      const blobs = [[100, 40], [76, 48], [124, 48], [62, 66], [138, 66], [86, 34], [114, 34]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="20" fill="${h}"/>`).join('');
      return { back: blobs, front: `<path d="M62 84 C64 62 80 52 100 52 C120 52 136 62 138 84 C130 70 116 66 100 66 C84 66 70 70 62 84 Z" fill="${h}"/>` };
    }
    case 'locs': {
      const locs = [58, 66, 74, 126, 134, 142].map((x, i) => `<rect x="${x - 4}" y="${64 + (i % 2) * 4}" width="9" height="${70 + (i % 3) * 8}" rx="4.5" fill="${h}"/>`).join('');
      return {
        back: locs,
        front: `<path d="M58 90 C54 58 76 40 100 40 C124 40 146 58 142 90 C136 72 124 62 100 62 C76 62 64 72 58 90 Z" fill="${h}"/>${[70, 84, 100, 116, 130].map((x) => `<path d="M${x} 46 Q${x + 2} 56 ${x} 64" stroke="${shade(look.hair, 0.2)}" stroke-width="2" fill="none" opacity="0.5"/>`).join('')}`,
      };
    }
    default:
      return { back: '', front: '' };
  }
}

/** Renders one portrait as an SVG string. mood: neutral | happy | worried */
export function renderPortrait(look, mood = 'neutral') {
  const p = `p${uid++}`;
  const ids = { bg: `${p}bg`, skin: `${p}sk`, neck: `${p}nk`, hair: `${p}hr`, cloth: `${p}cl`, blush: `${p}bl`, vig: `${p}vg`, clip: `${p}cp`, rim: `${p}rm` };
  const s = look.skin;
  const defs = [
    rgrad(ids.bg, [[0, look.bg[0]], [1, look.bg[1]]], 0.35, 0.25, 0.9),
    rgrad(ids.skin, [[0, shade(s, 0.12)], [0.6, s], [1, shade(s, -0.12)]], 0.4, 0.35, 0.7),
    grad(ids.neck, [[0, shade(s, -0.18)], [1, shade(s, -0.05)]]),
    grad(ids.hair, [[0, shade(look.hair, 0.16)], [1, shade(look.hair, -0.18)]]),
    grad(ids.cloth, [[0, shade(look.clothes, 0.1)], [1, shade(look.clothes, -0.15)]]),
    rgrad(ids.blush, [[0, '#ff8b7a', 0.45], [1, '#ff8b7a', 0]]),
    rgrad(ids.vig, [[0.6, '#000', 0], [1, '#000', 0.16]], 0.5, 0.45, 0.75),
    `<clipPath id="${ids.clip}"><rect width="200" height="200" rx="44"/></clipPath>`,
    `<filter id="${ids.rim}" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2.5" stdDeviation="2.2" flood-color="#2b1a10" flood-opacity="0.28"/></filter>`,
  ].join('');
  const hr = hair(look, ids);
  const f = face(look, ids, mood);
  const body = [
    `<rect width="200" height="200" fill="url(#${ids.bg})"/>`,
    `<circle cx="150" cy="40" r="60" fill="#fff" opacity="0.18"/>`,
    `<g transform="translate(100 112) scale(1.2) translate(-100 -104)">`,
    hr.back,
    clothing(look, ids),
    neck(look, ids),
    ears(look),
    `<path d="${HEAD}" fill="url(#${ids.skin})" filter="url(#${ids.rim})"/>`,
    // jaw shadow
    `<path d="M66 118 C72 138 86 146 100 146 C114 146 128 138 134 118 C126 136 114 142 100 142 C86 142 74 136 66 118 Z" fill="${shade(s, -0.2)}" opacity="0.35"/>`,
    f.features,
    beard(look),
    f.mouth,
    `<g filter="url(#${ids.rim})">${hr.front}</g>`,
    glasses(look),
    `</g>`,
    `<rect width="200" height="200" fill="url(#${ids.vig})"/>`,
  ].join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200"><defs>${defs}</defs><g clip-path="url(#${ids.clip})">${body}</g></svg>`;
}
