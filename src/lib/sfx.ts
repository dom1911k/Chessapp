// Premium synthesised sounds for the Puzzle Path (ported from docs/puzzle-path-prototype.html).
// No audio files: everything is Web Audio, so it stays offline and tiny. Every voice goes through
// one master bus: a dry path and a reverb send (a generated 2.4s stereo plate, darker as it decays)
// into a glue compressor, a warmth bump, a soft high shelf and a limiter. Instruments are layered:
// a transient (mallet, click, strike), a tonal body (marimba, bell, pluck, brass, pad) and air
// (reverb, shimmer). The chip notes climb a pentatonic. Sounds follow the motion speed factor and
// the app's sound setting; repeated foley is humanised slightly so a long walk never sounds
// mechanical.
import { speed } from './motion';
import { useSettings } from './settings';

type O = {
  pan?: number; pan2?: number; panT?: number; rev?: number; dec?: number; a?: number; g?: number; hold?: number;
  lp?: number; lpTo?: number; lpT?: number; lpEnd?: number; q?: number; det?: number[]; type?: string; from?: number; fromT?: number;
  to?: number; dur?: number; vib?: number; f1?: number; f2?: number; f?: number; click?: number; lo?: number; oct?: number; step?: number; open?: number;
};

let ac: BaseAudioContext | null = null;
/** While measuring a sound offline: the render context (the live one is untouched). */
let offline: BaseAudioContext | null = null;
let NB: AudioBuffer | null = null;
let BUS: { dry: GainNode; send: GainNode; out: GainNode } | null = null;
const SP = () => speed();

function au(): BaseAudioContext | null {
  if (offline) return offline;
  if (!useSettings.getState().sound) return null;
  try {
    ac = ac || new AudioContext({ latencyHint: 'interactive' });
    if (ac.state === 'suspended') void (ac as AudioContext).resume();
    if (!BUS) BUS = mkBus(ac);
    return ac;
  } catch {
    return null;
  }
}

function mkIR(c: BaseAudioContext, dur: number, decay: number, pre = 0.012) {
  const sr = c.sampleRate;
  const len = Math.floor(sr * dur);
  const b = c.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    let y = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const a = 0.75 - 0.65 * t;
      y += a * (Math.random() * 2 - 1 - y);
      const env = i < sr * pre ? 0 : Math.pow(1 - t, decay) * (i < sr * (pre + 0.004) ? (i - sr * pre) / (sr * 0.004) : 1);
      d[i] = y * env * 1.6;
    }
  }
  return b;
}

function mkBus(c: BaseAudioContext) {
  const sr = c.sampleRate;
  NB = c.createBuffer(1, sr * 2, sr);
  const nd = NB.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const out = c.createGain();
  out.gain.value = 0.85;
  const lim = c.createDynamicsCompressor();
  lim.threshold.value = -2.5;
  lim.knee.value = 0;
  lim.ratio.value = 20;
  lim.attack.value = 0.001;
  lim.release.value = 0.08;
  const glue = c.createDynamicsCompressor();
  glue.threshold.value = -20;
  glue.knee.value = 10;
  glue.ratio.value = 3;
  glue.attack.value = 0.004;
  glue.release.value = 0.2;
  const air = c.createBiquadFilter();
  air.type = 'highshelf';
  air.frequency.value = 8500;
  air.gain.value = -2.5;
  const body = c.createBiquadFilter();
  body.type = 'peaking';
  body.frequency.value = 320;
  body.Q.value = 0.8;
  body.gain.value = 1.5;
  glue.connect(body).connect(air).connect(lim).connect(out).connect(c.destination);
  const dry = c.createGain();
  dry.connect(glue);
  const plate = c.createConvolver();
  plate.buffer = mkIR(c, 2.4, 3.4);
  const wet = c.createGain();
  wet.gain.value = 0.5;
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 240;
  const send = c.createGain();
  send.connect(hp).connect(plate).connect(wet).connect(glue);
  return { dry, send, out };
}

const T = (t0: number) => ac!.currentTime + 0.005 + t0 * SP();
function vox(t0: number, o: O = {}) {
  const c = ac!;
  const g = c.createGain();
  let n: AudioNode = g;
  if (c.createStereoPanner && o.pan != null) {
    const p = c.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, o.pan));
    if (o.pan2 != null) p.pan.linearRampToValueAtTime(o.pan2, T(t0 + (o.panT || 0.4)));
    g.connect(p);
    n = p;
  }
  n.connect(BUS!.dry);
  const s = c.createGain();
  s.gain.value = o.rev ?? 0.18;
  n.connect(s).connect(BUS!.send);
  return g;
}
let SLV = 1;
let SHUM = 0;
const hum = () => (Math.random() - 0.5) * 2 * SHUM;
/** Every gain starts at 0 before anything is scheduled, so nothing clicks. */
function env(g: GainNode, t: number, a: number, peak: number, dec: number, hold = 0) {
  peak *= SLV;
  g.gain.value = 0;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  if (hold) g.gain.setValueAtTime(peak, t + a + hold);
  g.gain.setTargetAtTime(0, t + a + hold, dec / 4.2);
}
function stopAt(n: AudioScheduledSourceNode, t: number) {
  try {
    n.stop(t);
  } catch {
    /* already stopped */
  }
}

/** An oscillator (or a detuned stack) with optional glide, filter sweep and vibrato. */
function tone(f: number, t0: number, o: O = {}) {
  if (!au()) return;
  const c = ac!;
  const t = T(t0);
  const dec = (o.dec ?? 0.3) * SP();
  const a = (o.a ?? 0.004) * SP();
  const out = vox(t0, o);
  const g = c.createGain();
  let dst: AudioNode = g;
  if (o.lp) {
    const fl = c.createBiquadFilter();
    fl.type = 'lowpass';
    fl.Q.value = o.q ?? 0.7;
    fl.frequency.setValueAtTime(o.lp, t);
    if (o.lpTo) fl.frequency.exponentialRampToValueAtTime(o.lpTo, t + (o.lpT ?? 0.1) * SP());
    if (o.lpEnd) fl.frequency.exponentialRampToValueAtTime(o.lpEnd, t + a + dec);
    g.connect(fl);
    dst = fl;
  }
  dst.connect(out);
  env(g, t, a, o.g ?? 0.1, dec, (o.hold ?? 0) * SP());
  const det = o.det || [0];
  const hd = hum();
  det.forEach((d) => {
    const ob = c.createOscillator();
    ob.type = (o.type as OscillatorType) || 'sine';
    ob.detune.value = d + hd;
    ob.frequency.setValueAtTime(f * (o.from ?? 1), t);
    if (o.from) ob.frequency.exponentialRampToValueAtTime(f, t + (o.fromT ?? 0.02) * SP());
    if (o.to) ob.frequency.exponentialRampToValueAtTime(o.to, t + (o.dur ?? dec) * SP());
    if (o.vib) {
      const l = c.createOscillator();
      const lg = c.createGain();
      l.frequency.value = o.vib;
      lg.gain.setValueAtTime(0, t);
      lg.gain.linearRampToValueAtTime(f * 0.006, t + 0.25 * SP());
      l.connect(lg).connect(ob.frequency);
      l.start(t);
      stopAt(l, t + a + dec * 1.5 + (o.hold ?? 0) * SP());
    }
    const sg = c.createGain();
    sg.gain.value = 1 / Math.sqrt(det.length);
    ob.connect(sg).connect(g);
    ob.start(t);
    stopAt(ob, t + a + dec * 1.6 + (o.hold ?? 0) * SP() + 0.05);
  });
}
/** Filtered noise: clicks, swishes, rustles, air, cymbals. */
function noise(t0: number, dur: number, o: O = {}) {
  if (!au() || !NB) return;
  const c = ac!;
  const t = T(t0);
  const du = dur * SP();
  const s = c.createBufferSource();
  const fl = c.createBiquadFilter();
  const g = c.createGain();
  const out = vox(t0, { ...o, panT: dur });
  s.buffer = NB;
  s.loop = true;
  s.loopStart = Math.random();
  fl.type = (o.type as BiquadFilterType) || 'bandpass';
  fl.Q.value = o.q ?? 1;
  const hv = 1 + hum() / 600;
  fl.frequency.setValueAtTime((o.f1 ?? 1000) * hv, t);
  if (o.f2) fl.frequency.exponentialRampToValueAtTime(o.f2 * hv, t + du);
  const a = (o.a ?? 0.3) * du;
  g.gain.value = 0;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime((o.g ?? 0.05) * SLV, t + a);
  g.gain.setTargetAtTime(0, t + a, (du - a) / 3.5);
  s.connect(fl).connect(g).connect(out);
  s.start(t, Math.random() * 1.5);
  stopAt(s, t + du * 1.8 + 0.05);
}

// ---------- Instruments ----------

const BELL: [number, number, number][] = [[1, 1, 1], [2, 0.22, 0.6], [2.76, 0.42, 0.42], [5.4, 0.2, 0.24], [8.93, 0.1, 0.14]];
function bell(f: number, t0: number, g = 0.08, o: O = {}) {
  const d = o.dec ?? 1.1;
  BELL.forEach(([r, k, dk]) => {
    if (f * r > 15000) return;
    tone(f * r, t0, { g: g * k, dec: d * dk, a: 0.002, pan: o.pan, rev: o.rev ?? 0.42, type: 'sine' });
  });
  noise(t0, 0.018, { f1: Math.min(12000, f * 4), q: 2, g: g * 0.35, a: 0.05, pan: o.pan, rev: 0.1 });
}
function marimba(f: number, t0: number, g = 0.1, o: O = {}) {
  const p = o.pan;
  tone(f, t0, { g, dec: o.dec ?? 0.55, a: 0.003, from: 1.012, fromT: 0.018, pan: p, rev: o.rev ?? 0.22, type: 'sine' });
  tone(f * 3.93, t0, { g: g * 0.22, dec: 0.09, a: 0.002, pan: p, rev: 0.1 });
  tone(f * 9.2, t0, { g: g * 0.06, dec: 0.025, a: 0.001, pan: p, rev: 0.05 });
  tone(f * 2, t0, { g: g * 0.08, dec: 0.2, pan: p, rev: 0.2, type: 'triangle', lp: f * 3 });
  noise(t0, 0.012, { f1: 2600, q: 1.4, g: g * 0.55, a: 0.05, pan: p, rev: 0.05 });
}
function pluck(f: number, t0: number, g = 0.08, o: O = {}) {
  tone(f, t0, { g, dec: o.dec ?? 0.28, a: 0.002, type: 'triangle', lp: f * 6, lpTo: f * 1.6, lpT: o.dec ?? 0.28, pan: o.pan, rev: o.rev ?? 0.2, det: [-4, 4] });
  tone(f * 2, t0, { g: g * 0.18, dec: 0.08, pan: o.pan, rev: 0.1 });
}
function thump(t0: number, g = 0.2, o: O = {}) {
  tone(o.f ?? 150, t0, { g, dec: o.dec ?? 0.16, a: 0.002, from: o.from ?? 2.2, fromT: 0.05, pan: o.pan, rev: o.rev ?? 0.05, type: 'sine' });
  noise(t0, 0.02, { type: 'lowpass', f1: o.click ?? 1800, q: 0.7, g: g * 0.35, a: 0.05, pan: o.pan, rev: 0.02 });
}
function brass(f: number, t0: number, dur: number, g = 0.05, o: O = {}) {
  tone(f, t0, { type: 'sawtooth', det: [-6, 0, 7], g, a: 0.035, hold: dur, dec: o.dec ?? 0.5, lp: f * 1.2, lpTo: f * 5.5, lpT: 0.07, lpEnd: f * 2.2, q: 1.1, vib: 5.5, pan: o.pan, rev: o.rev ?? 0.4 });
}
function pad(fs: number[], t0: number, dur: number, g = 0.035, o: O = {}) {
  fs.forEach((f, i) =>
    tone(f, t0, { type: 'sawtooth', det: [-9, -3, 4, 10], g, a: o.a ?? 0.12, hold: dur, dec: o.dec ?? 1.1, lp: f * 0.9, lpTo: f * (o.open ?? 3.2), lpT: o.lpT ?? 0.6, q: 0.6, pan: (i / (fs.length - 1 || 1) - 0.5) * 0.7, rev: o.rev ?? 0.6 }),
  );
}
function shimmer(t0: number, n: number, g = 0.025, o: O = {}) {
  for (let k = 0; k < n; k++) {
    const f = (o.lo ?? 2200) * Math.pow(2, Math.random() * (o.oct ?? 1.4));
    bell(f, t0 + k * (o.step ?? 0.045) + Math.random() * 0.02, g * (1 - (k / n) * 0.5), { pan: (Math.random() - 0.5) * 1.4, dec: 0.5, rev: 0.6 });
  }
}
const PENTA = [784, 880, 988, 1175, 1319, 1568, 1760, 1976, 2349, 2637];

// ---------- The effects ----------

const SND = {
  /** A piece set down on wood: a clack plus the board's resonance. */
  move: () => {
    noise(0, 0.03, { f1: 2400, q: 3, g: 0.16, a: 0.04, pan: -0.1, rev: 0.08 });
    noise(0, 0.09, { f1: 420, q: 7, g: 0.12, a: 0.03, pan: -0.1, rev: 0.12 });
    thump(0, 0.08, { f: 120, from: 1.6, dec: 0.08 });
  },
  /** A two-note bell, lifted by a sparkle. */
  correct: () => {
    bell(1047, 0, 0.07, { pan: -0.15 });
    bell(1568, 0.075, 0.075, { pan: 0.15 });
    shimmer(0.12, 4, 0.012, { lo: 3000, step: 0.03 });
  },
  /** A chip pops: a marimba note that climbs the pentatonic, a soft pop, a faint bell octave. */
  tick: (k = 0) => {
    const f = PENTA[Math.min(k, 9)];
    marimba(f, 0, 0.11, { pan: -0.2 });
    tone(f * 2, 0.004, { g: 0.012, dec: 0.5, pan: -0.2, rev: 0.5 });
    tone(620, 0, { g: 0.05, dec: 0.035, to: 260, dur: 0.035, pan: -0.2, rev: 0 });
  },
  /** The circle flying to the total: air that pans with it and brightens. */
  whoosh: () => {
    noise(0, 0.44, { f1: 380, f2: 3200, q: 1.3, g: 0.07, a: 0.65, pan: -0.35, pan2: 0.1, rev: 0.25 });
    noise(0, 0.44, { type: 'highpass', f1: 5000, q: 0.5, g: 0.018, a: 0.7, pan: -0.35, pan2: 0.1, rev: 0.3 });
  },
  /** Landing on the total: a rounded thump, a pluck on the same step, a glint. */
  impact: (k = 0) => {
    const f = PENTA[Math.min(k, 9)];
    thump(0, 0.11, { f: 110, from: 2, dec: 0.12, pan: -0.1 });
    pluck(f, 0, 0.07, { pan: -0.1 });
    bell(f * 2, 0, 0.025, { pan: -0.1, dec: 0.5 });
  },
  /** A gold bonus: a celesta run, a warm swell, a cascade of sparkles. */
  gold: () => {
    [1047, 1319, 1568, 2093, 2637].forEach((f, i) => bell(f, i * 0.055, 0.06, { pan: -0.6 + i * 0.3 }));
    pad([523, 659, 784], 0, 0.35, 0.016, { a: 0.05, dec: 0.9, open: 4 });
    shimmer(0.28, 9, 0.016);
  },
  /** The bar fills a level: a rising sweep and a quick bell glissando. */
  unlock: () => {
    noise(0, 0.55, { type: 'bandpass', f1: 1800, f2: 9000, q: 2.2, g: 0.035, a: 0.7, pan: -0.4, pan2: 0.4, rev: 0.5 });
    [1568, 1760, 2093, 2349, 2637, 3136].forEach((f, i) => bell(f, i * 0.032, 0.035, { pan: -0.4 + i * 0.16, dec: 0.6 }));
  },
  /** The level badge: a soft hit, a warm chord blooming open, a bell arpeggio, a long sparkle tail. */
  levelUp: () => {
    thump(0, 0.16, { f: 90, from: 2.5, dec: 0.3, rev: 0.2 });
    pad([262, 330, 392, 523], 0, 0.7, 0.02, { a: 0.06, dec: 1.6, open: 4.5, lpT: 0.7 });
    [784, 1047, 1319, 1568, 2093].forEach((f, i) => bell(f, 0.05 + i * 0.07, 0.065, { pan: -0.5 + i * 0.25, dec: 1.4 }));
    shimmer(0.42, 12, 0.014, { step: 0.06 });
  },
  /** A new board: a brass fanfare with timpani and a cymbal swell, then bells. */
  tierUp: () => {
    brass(262, 0, 0.1, 0.04, { dec: 0.25 });
    brass(330, 0, 0.1, 0.035, { dec: 0.25 });
    brass(392, 0, 0.1, 0.035, { dec: 0.25 });
    thump(0, 0.2, { f: 98, from: 1.5, dec: 0.5, click: 900, rev: 0.3 });
    noise(0, 0.36, { type: 'bandpass', f1: 4000, f2: 8000, q: 0.7, g: 0.024, a: 0.92, rev: 0.5 });
    [392, 523, 659, 784].forEach((f, i) => brass(f, 0.34, 0.55, 0.03, { dec: 0.9, pan: (i - 1.5) * 0.25 }));
    thump(0.34, 0.24, { f: 131, from: 1.5, dec: 0.7, click: 900, rev: 0.35 });
    noise(0.34, 1.2, { type: 'bandpass', f1: 6500, q: 0.6, g: 0.022, a: 0.02, rev: 0.6 });
    [1568, 2093, 2637, 3136].forEach((f, i) => bell(f, 0.5 + i * 0.07, 0.05, { pan: -0.45 + i * 0.3, dec: 1.3 }));
    shimmer(0.8, 10, 0.012);
  },
  /** A whole board finished (round 8): three rising notes, a warm chord and a shimmer. */
  boardDone: () => {
    thump(0, 0.18, { f: 98, from: 2, dec: 0.45, click: 900, rev: 0.3 });
    [523, 659, 784].forEach((f, i) => brass(f, i * 0.15, 0.34, 0.034, { dec: 0.55, pan: (i - 1) * 0.3 }));
    pad([523, 659, 784, 1047], 0.45, 0.9, 0.018, { a: 0.05, dec: 1.8, open: 4, lpT: 0.7 });
    [1568, 2093, 2637, 3136].forEach((f, i) => bell(f, 0.52 + i * 0.06, 0.05, { pan: -0.45 + i * 0.3, dec: 1.4 }));
    shimmer(0.6, 14, 0.014, { step: 0.05 });
  },
  /** The pawn takes off: a sprung "boing" and a rustle of leaves. */
  hop: () => {
    tone(300, 0, { g: 0.05, dec: 0.12, to: 560, dur: 0.09, type: 'sine', rev: 0.12 });
    tone(600, 0, { g: 0.012, dec: 0.08, to: 1120, dur: 0.09, rev: 0.1 });
    noise(0, 0.12, { f1: 3800, q: 1.4, g: 0.025, a: 0.2, rev: 0.15 });
  },
  /** The pawn lands: a soft thud, a wooden knock, leaves settling. */
  pawnLand: () => {
    thump(0, 0.15, { f: 120, from: 2, dec: 0.14 });
    noise(0, 0.05, { f1: 760, q: 5, g: 0.07, a: 0.05, rev: 0.12 });
    noise(0.02, 0.16, { f1: 4200, q: 1.2, g: 0.018, a: 0.1, rev: 0.2 });
  },
  /** A finished tile grows into a hedge: a leafy swish and a rising two-note pluck. */
  grow: () => {
    noise(0, 0.3, { f1: 1400, f2: 5200, q: 1.1, g: 0.04, a: 0.4, rev: 0.25 });
    pluck(1175, 0.06, 0.04, { pan: 0.1 });
    pluck(1568, 0.12, 0.04, { pan: 0.15 });
  },
  /** The path panel opens. */
  open: () => noise(0, 0.4, { type: 'lowpass', f1: 300, f2: 2400, q: 0.6, g: 0.035, a: 0.55, rev: 0.35 }),
  /** Clouds parting: a gust sweeping across the stereo field. */
  wind: () => {
    noise(0, 1.2, { type: 'bandpass', f1: 500, f2: 1400, q: 0.7, g: 0.045, a: 0.45, pan: -0.5, pan2: 0.5, rev: 0.5 });
    noise(0.1, 1.1, { type: 'highpass', f1: 3500, q: 0.4, g: 0.012, a: 0.5, pan: 0.5, pan2: -0.5, rev: 0.5 });
  },
  rise: () => {
    tone(330, 0, { g: 0.04, dec: 0.9, to: 1320, dur: 0.9, rev: 0.5 });
    noise(0, 0.9, { f1: 400, f2: 4200, q: 0.8, g: 0.02, a: 0.8, rev: 0.5 });
  },
  /** A wrong move: a muted, friendly two-note pluck, clear but never harsh. */
  fail: () => {
    pluck(330, 0, 0.09, { dec: 0.22, rev: 0.15 });
    pluck(262, 0.13, 0.09, { dec: 0.36, rev: 0.18 });
    thump(0, 0.08, { f: 100, from: 1.5, dec: 0.12 });
  },
  /** The streak flame grows: a warm whoomph with a few crackles. */
  ember: () => {
    noise(0, 0.3, { type: 'lowpass', f1: 260, f2: 1800, q: 0.9, g: 0.06, a: 0.25, rev: 0.2 });
    for (let k = 0; k < 5; k++) noise(0.04 + Math.random() * 0.22, 0.012, { f1: 2500 + Math.random() * 3000, q: 3, g: 0.03, a: 0.05, rev: 0.1 });
  },
  /** The flame goes out: a breathy fizz sinking away. */
  smoke: () => {
    noise(0, 0.55, { f1: 1500, f2: 260, q: 0.9, g: 0.045, a: 0.15, rev: 0.3 });
    tone(520, 0, { g: 0.02, dec: 0.45, to: 220, dur: 0.45, rev: 0.3 });
  },
  // ----- moments -----
  snap: (i = 0) => {
    const p = -0.3 + i * 0.3;
    noise(0, 0.03, { f1: 2100, q: 2.6, g: 0.13, a: 0.04, pan: p, rev: 0.1 });
    thump(0, 0.09, { f: 150, from: 1.8, dec: 0.1, pan: p });
    bell([1047, 1319, 1568][Math.min(i, 2)], 0.012, 0.065, { pan: p, dec: 1.1 });
    if (i === 2) {
      shimmer(0.1, 9, 0.014);
      pad([523, 659, 784], 0.03, 0.3, 0.014, { a: 0.05, dec: 1.1, open: 4 });
    }
  },
  fill: (i = 0) => marimba(PENTA[Math.min(i, 9)], 0, 0.075, { pan: Math.sin((i / 10) * 6.283) * 0.6, rev: 0.3 }),
  reveal: () => {
    thump(0, 0.18, { f: 90, from: 2.4, dec: 0.3, rev: 0.2 });
    [1047, 1319, 1568, 2093].forEach((f, i) => bell(f, 0.03 + i * 0.05, 0.06, { pan: -0.4 + i * 0.27, dec: 1.3 }));
    pad([262, 330, 392, 523], 0, 0.5, 0.018, { a: 0.05, dec: 1.4, open: 4.5 });
    shimmer(0.3, 10, 0.014);
  },
  ignite: () => {
    noise(0, 0.55, { type: 'lowpass', f1: 220, f2: 3200, q: 1, g: 0.08, a: 0.35, rev: 0.3 });
    thump(0.02, 0.2, { f: 70, from: 2.5, dec: 0.45, rev: 0.3 });
    for (let k = 0; k < 10; k++) noise(0.05 + Math.random() * 0.9, 0.012, { f1: 2500 + Math.random() * 3500, q: 3, g: 0.03, a: 0.05, pan: (Math.random() - 0.5) * 0.8, rev: 0.15 });
    bell(1568, 0.18, 0.05, { dec: 1.2 });
    bell(2093, 0.25, 0.05, { dec: 1.2 });
    shimmer(0.3, 6, 0.012);
  },
  clack: (i = 0) => {
    const p = ((i % 4) - 1.5) * 0.3;
    noise(0, 0.03, { f1: 1500 + i * 90, q: 4, g: 0.11, a: 0.04, pan: p, rev: 0.12 });
    thump(0, 0.07, { f: 170 + i * 9, from: 1.6, dec: 0.08, pan: p });
  },
  /** The perfect week's crown. */
  weekCrown: () => {
    thump(0, 0.14, { f: 110, from: 2, dec: 0.22, rev: 0.2 });
    [2093, 2637, 3136, 4186].forEach((f, i) => bell(f, 0.02 + i * 0.06, 0.05, { pan: -0.4 + i * 0.27, dec: 1.6 }));
    noise(0, 0.7, { type: 'bandpass', f1: 7000, q: 0.6, g: 0.014, a: 0.1, rev: 0.6 });
    shimmer(0.25, 10, 0.013, { lo: 2600 });
    pad([392, 494, 587], 0, 0.4, 0.013, { a: 0.06, dec: 1.2, open: 4 });
  },
  reward: () => {
    bell(1319, 0, 0.05, { dec: 0.9 });
    bell(1976, 0.06, 0.045, { dec: 0.9 });
    tone(660, 0, { g: 0.03, dec: 0.45, rev: 0.4 });
    noise(0, 0.2, { type: 'highpass', f1: 5000, q: 0.5, g: 0.01, a: 0.2, rev: 0.5 });
  },

  // ----- the game's moments (polish round 3, docs/polish-3-prototype.html) -----
  /** The versus halves sweeping in: panned air. */
  swish: (p = -0.4) => noise(0, 0.42, { f1: 300, f2: 2600, q: 1.1, g: 0.05, a: 0.55, pan: p, pan2: -p, rev: 0.3 }),
  /** VS lands: a low thud, a click, a bell, a short sparkle. */
  stamp: () => {
    thump(0, 0.24, { f: 78, from: 2.6, dec: 0.38, rev: 0.25 });
    noise(0, 0.045, { f1: 2400, q: 1.4, g: 0.09, a: 0.05, rev: 0.1 });
    bell(1568, 0.02, 0.04, { dec: 0.9 });
    shimmer(0.06, 5, 0.01);
  },
  /** The first coach line of a game: two bells, G5 → D6. */
  start: () => {
    bell(784, 0, 0.045, { dec: 0.9 });
    bell(1175, 0.08, 0.045, { dec: 1 });
  },
  /** Game won: a soft hit, a warm chord, a four-bell rise, a sparkle. */
  win: () => {
    thump(0, 0.12, { f: 110, from: 2, dec: 0.25, rev: 0.2 });
    pad([523, 659, 784], 0, 0.55, 0.016, { a: 0.04, dec: 1.5, open: 4.5 });
    [784, 1047, 1319, 1568].forEach((f, i) => bell(f, 0.03 + i * 0.07, 0.06, { pan: -0.4 + i * 0.27, dec: 1.4 }));
    shimmer(0.32, 8, 0.012);
  },
  /** Game lost: two soft plucks down (A4 → F4) over a quiet pad. */
  loss: () => {
    pluck(440, 0, 0.075, { dec: 0.5, rev: 0.35 });
    pluck(349, 0.17, 0.075, { dec: 0.9, rev: 0.4 });
    pad([220, 262, 330], 0.05, 0.45, 0.011, { a: 0.14, dec: 1.3, open: 2.2 });
  },
  /** A draw: two bells, G5 then E5, over a light pad. */
  draw: () => {
    bell(784, 0, 0.05, { dec: 1 });
    bell(659, 0.16, 0.05, { dec: 1.2 });
    pad([392, 494, 587], 0.04, 0.35, 0.009, { a: 0.1, dec: 1.1, open: 3 });
  },
  /** The crown on the winner's avatar: two high bells and a little sparkle. */
  crown: () => {
    bell(1568, 0, 0.05, { dec: 0.9, pan: 0.2 });
    bell(2093, 0.06, 0.045, { dec: 1, pan: 0.25 });
    shimmer(0.08, 4, 0.01);
  },
  /** The king badges at the end of a game: a low thud with a knock. */
  mate: () => {
    thump(0, 0.17, { f: 70, from: 2.2, dec: 0.3, rev: 0.2 });
    noise(0, 0.04, { f1: 900, q: 3, g: 0.06, a: 0.05 });
  },
  /** A star lighting up: a bell climbing the pentatonic. */
  star: (k = 0) => {
    bell(PENTA[Math.min(9, k + 3)], 0, 0.055, { dec: 0.9 });
    shimmer(0.04, 3, 0.008);
  },
  /** A number landing, a bar filling: a marimba step on the pentatonic. */
  land: (k = 0) => marimba(PENTA[Math.min(9, k)], 0, 0.075, { pan: -0.1, rev: 0.25 }),
  /** "New!" on an achievement or unlock: a bell pair and a sparkle. */
  achieve: () => {
    bell(1319, 0, 0.05, { dec: 1 });
    bell(1976, 0.07, 0.05, { dec: 1.1 });
    shimmer(0.12, 6, 0.01);
  },
  /** The review's accuracies landing: a chord with two bells. */
  accLand: () => {
    pad([392, 494, 587], 0, 0.3, 0.013, { a: 0.05, dec: 1.1, open: 4 });
    bell(1175, 0.02, 0.05, { dec: 1 });
    bell(1568, 0.08, 0.045, { dec: 1.1 });
  },
  // Move classes (stepping through a review; a blunder never louder than a brilliant).
  clsBrilliant: () => {
    [1568, 1976, 2349, 3136].forEach((f, i) => bell(f, i * 0.045, 0.055, { pan: -0.3 + i * 0.2, dec: 1.2 }));
    pad([784, 988, 1175], 0, 0.3, 0.012, { a: 0.04, dec: 1.2, open: 5 });
    shimmer(0.15, 9, 0.013, { lo: 2800 });
  },
  clsGreat: () => {
    bell(1319, 0, 0.055, { dec: 1 });
    bell(1760, 0.07, 0.05, { dec: 1.1 });
  },
  clsBest: () => marimba(1175, 0, 0.05, { rev: 0.25 }),
  clsExcellent: () => marimba(988, 0, 0.045, { rev: 0.25 }),
  clsGood: () => marimba(880, 0, 0.035, { rev: 0.2 }),
  clsBook: () => {
    noise(0, 0.03, { f1: 900, q: 4, g: 0.06, a: 0.05 });
    thump(0, 0.05, { f: 180, from: 1.5, dec: 0.06 });
  },
  clsInaccuracy: () => pluck(523, 0, 0.05, { dec: 0.3 }),
  clsMistake: () => {
    pluck(392, 0, 0.06, { dec: 0.25 });
    pluck(349, 0.11, 0.06, { dec: 0.4 });
  },
  clsMiss: () => {
    pluck(392, 0, 0.06, { dec: 0.25 });
    pluck(330, 0.11, 0.06, { dec: 0.4 });
  },
  clsBlunder: () => {
    thump(0, 0.14, { f: 75, from: 1.8, dec: 0.25 });
    pluck(311, 0.02, 0.07, { dec: 0.3 });
    pluck(277, 0.14, 0.07, { dec: 0.55 });
  },
};
export type Sfx = keyof typeof SND;

/** Each effect's level (the measured order: fanfare loudest … small foley quietest). */
const LEVEL: Partial<Record<Sfx, number>> = {
  clack: 10, snap: 1.25, fill: 1.3, move: 8, tick: 1.3, whoosh: 2, impact: 2.2, unlock: 1.25, open: 2.7, hop: 4, pawnLand: 2, grow: 1.6, levelUp: 1.2, wind: 2.4, fail: 0.65, ember: 4.2, smoke: 2.2,
  // the game's moments, measured offline (loudest 300ms): win −21, loss −25, stamp −23, brilliant −23, blunder −26, swish −35
  swish: 3.4, loss: 0.65, clsBook: 7, clsInaccuracy: 2.3, clsBlunder: 0.7, clsExcellent: 1.12, clsGood: 1.45,
};
/** Repeated foley varies a little each time (cents of detune; ±0.7 dB). Notes stay in tune. */
const HUMAN: Partial<Record<Sfx, number>> = { move: 15, hop: 30, pawnLand: 22, grow: 12, ember: 10, smoke: 10, whoosh: 8 };

/** Play a moment sound. `step` climbs the pentatonic for tick / impact / fill / snap / clack / land / star. */
export function sfx(name: Sfx, step?: number) {
  if (!offline && !useSettings.getState().sound) return;
  if (!au()) return;
  SLV = (LEVEL[name] || 1) * (1 + (HUMAN[name] ? (Math.random() - 0.5) * 0.16 : 0));
  SHUM = HUMAN[name] || 0;
  try {
    (SND[name] as (s?: number) => void)(step);
  } finally {
    SLV = 1;
    SHUM = 0;
  }
}

/** A move class's sound when you step onto it in a review (brilliant … blunder). */
export const CLS_SFX: Record<string, Sfx> = { brilliant: 'clsBrilliant', great: 'clsGreat', best: 'clsBest', excellent: 'clsExcellent', good: 'clsGood', book: 'clsBook', inaccuracy: 'clsInaccuracy', mistake: 'clsMistake', miss: 'clsMiss', blunder: 'clsBlunder' };
export function sfxCls(cls: string) {
  const n = CLS_SFX[cls];
  if (n) sfx(n);
}

/**
 * Render a sound offline and measure it: the peak and the loudest 300ms (RMS, dBFS), the way the
 * levels were set. Dev tooling (window.__sndRender in dev builds).
 */
export async function renderSfx(name: Sfx, step?: number, dur = 3): Promise<{ peak: number; rms: number }> {
  const keep = { ac, BUS, NB };
  const oc = new OfflineAudioContext(2, Math.floor(48000 * dur), 48000);
  offline = oc;
  ac = oc;
  BUS = mkBus(oc);
  try {
    sfx(name, step);
  } finally {
    offline = null;
  }
  const buf = await oc.startRendering();
  ({ ac, BUS, NB } = keep);
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);
  const W = 14400;
  let pk = 0;
  let acc = 0;
  let best = 0;
  for (let i = 0; i < L.length; i++) {
    pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i]));
    acc += (L[i] * L[i] + R[i] * R[i]) / 2;
    if (i >= W) acc -= (L[i - W] * L[i - W] + R[i - W] * R[i - W]) / 2;
    if (acc > best) best = acc;
  }
  return { peak: +(20 * Math.log10(pk || 1e-9)).toFixed(1), rms: +(10 * Math.log10(best / W || 1e-12)).toFixed(1) };
}
if (import.meta.env.DEV && typeof window !== 'undefined') (window as unknown as { __sndRender: typeof renderSfx }).__sndRender = renderSfx;
