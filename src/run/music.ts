// Run mode's battle music: a small step sequencer with synthesized instruments (no files).
// Three themes share one leitmotif — the "Gambit motif" (A–D–F, then a fall back down), so the
// soundtrack has one recognisable hook:
//   battle — rooms with an opponent: D minor, 108 bpm, driving bass and drums (40 bars ≈ 89 s)
//   riddle — puzzle rooms: the motif on bells over a ticking clock, 84 bpm (32 bars ≈ 91 s)
//   rival  — the boss: Phrygian menace, taiko, choir and a 16th-note bass, 126 bpm (44 bars ≈ 84 s)

export type Theme = 'battle' | 'riddle' | 'rival';

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

// ---------------------------------------------------------------------------------------------
// Instruments
// ---------------------------------------------------------------------------------------------

/** A persistent voice bank (pad, choir): oscillators that are retuned instead of rebuilt. */
interface Bank {
  voices: { oscs: OscillatorNode[]; g: GainNode }[];
  lp: BiquadFilterNode;
  g: GainNode;
}

export interface Kit {
  c: AudioContext;
  /** Dry bus (into the music volume). */
  out: AudioNode;
  /** Reverb send. */
  verb: AudioNode;
  /** Echo send (lead). */
  echo: AudioNode;
  noise: AudioBuffer;
  /** Shared vibrato (cents) for leads. */
  vib: AudioNode;
  bassSyn: { saw: OscillatorNode; sub: OscillatorNode; lp: BiquadFilterNode; g: GainNode };
  padSyn: Bank;
  choirSyn: Bank;
  /** Persistent oscillators, stopped with the player. */
  stops: OscillatorNode[];
}

function send(k: Kit, from: AudioNode, to: AudioNode, amount: number) {
  if (!amount) return;
  if (amount === 1) return void from.connect(to);
  const g = k.c.createGain();
  g.gain.value = amount;
  from.connect(g).connect(to);
}

function voice(k: Kit, t: number, dur: number, a: number, peak: number, rel: number, sends: { dry?: number; verb?: number; echo?: number } = { dry: 1, verb: 0.3 }) {
  const g = k.c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.setValueAtTime(peak, t + Math.max(a, dur));
  g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a, dur) + rel);
  send(k, g, k.out, sends.dry ?? 0);
  send(k, g, k.verb, sends.verb ?? 0);
  send(k, g, k.echo, sends.echo ?? 0);
  return { g, end: t + Math.max(a, dur) + rel + 0.05 };
}

/** Saw/square lead with a filter swell (vibrato from the shared LFO on longer notes). */
function lead(k: Kit, t: number, m: number, dur: number, gain = 0.16, type: OscillatorType = 'sawtooth', cutoff = 2400) {
  const { c } = k;
  const { g, end } = voice(k, t, dur, 0.02, gain, 0.18, { dry: 1, verb: 0.35, echo: 0.28 });
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 4;
  lp.frequency.setValueAtTime(cutoff * 0.35, t);
  lp.frequency.linearRampToValueAtTime(cutoff, t + 0.06);
  lp.frequency.exponentialRampToValueAtTime(cutoff * 0.5, t + dur + 0.1);
  lp.connect(g);
  for (const det of [-7, 7]) {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = mtof(m);
    o.detune.value = det;
    if (dur > 0.3) k.vib.connect(o.detune);
    o.connect(lp);
    o.start(t);
    o.stop(end);
  }
}

/** A plucked bass on the persistent mono synth: the filter snaps shut on every note. */
function bass(k: Kit, t: number, m: number, dur: number, gain = 0.22, bright = 1) {
  const B = k.bassSyn;
  B.saw.frequency.setValueAtTime(mtof(m), t);
  B.sub.frequency.setValueAtTime(mtof(m - 12), t);
  B.lp.frequency.setValueAtTime(1100 * bright, t);
  B.lp.frequency.setTargetAtTime(160, t + 0.005, dur / 3);
  B.g.gain.setTargetAtTime(gain, t, 0.003);
  B.g.gain.setTargetAtTime(0, t + dur * 0.7, 0.03);
}

/** A soft pluck (arpeggios, harp-like). */
function pluck(k: Kit, t: number, m: number, gain = 0.07, type: OscillatorType = 'triangle') {
  const { c } = k;
  const { g, end } = voice(k, t, 0.01, 0.004, gain, 0.45, { dry: 1, verb: 0.45 });
  const o = c.createOscillator();
  o.type = type;
  o.frequency.value = mtof(m);
  o.connect(g);
  o.start(t);
  o.stop(end);
}

/** A bell / celesta tone (inharmonic partials). */
function bell(k: Kit, t: number, m: number, gain = 0.09, decay = 1.6) {
  const { c } = k;
  [
    [1, 1],
    [2, 0.45],
    [2.76, 0.25],
  ].forEach(([ratio, amp]) => {
    const { g, end } = voice(k, t, 0.005, 0.003, gain * amp, decay / ratio, { dry: 1, verb: 0.6 });
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.value = mtof(m) * ratio;
    o.connect(g);
    o.start(t);
    o.stop(end);
  });
}

/** Play a chord on a persistent bank: retune, then swell in and out. */
function bankChord(b: Bank, t: number, notes: number[], dur: number, gain: number, attack: number, rel: number) {
  b.voices.forEach((v, i) => {
    const n = notes[i];
    v.g.gain.setTargetAtTime(n === undefined ? 0 : 1, t, 0.05);
    if (n !== undefined) for (const o of v.oscs) o.frequency.setTargetAtTime(mtof(n), t, 0.04);
  });
  b.g.gain.setTargetAtTime(gain, t, attack / 3);
  b.g.gain.setTargetAtTime(0, t + dur, rel / 3);
}

/** Slow detuned-saw pad on a chord. */
function pad(k: Kit, t: number, notes: number[], dur: number, gain = 0.035, cutoff = 1300) {
  k.padSyn.lp.frequency.setTargetAtTime(cutoff, t, 0.2);
  bankChord(k.padSyn, t, notes, dur, gain * 1.6, 0.5, 0.8);
}

/** A choir "aah": saws through two vowel formants, with vibrato. */
function choir(k: Kit, t: number, notes: number[], dur: number, gain = 0.05) {
  bankChord(k.choirSyn, t, notes, dur, gain * 1.5, 0.45, 0.9);
}

function noiseHit(k: Kit, t: number, dur: number, type: BiquadFilterType, freq: number, gain: number, q = 1, verb = 0.15) {
  const { c } = k;
  const src = c.createBufferSource();
  src.buffer = k.noise;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const { g, end } = voice(k, t, 0.002, 0.001, gain, dur, { dry: 1, verb });
  src.connect(f).connect(g);
  src.start(t, Math.random() * 0.5);
  src.stop(end);
}

function thump(k: Kit, t: number, f0: number, f1: number, dur: number, gain: number, verb = 0.1) {
  const { c } = k;
  const { g, end } = voice(k, t, 0.002, 0.002, gain, dur, { dry: 1, verb });
  const o = c.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.8);
  o.connect(g);
  o.start(t);
  o.stop(end);
}

const kick = (k: Kit, t: number, gain = 0.5) => (thump(k, t, 140, 42, 0.32, gain), noiseHit(k, t, 0.02, 'highpass', 2500, gain * 0.15));
const snare = (k: Kit, t: number, gain = 0.22) => (noiseHit(k, t, 0.16, 'bandpass', 1900, gain, 0.8, 0.35), thump(k, t, 210, 150, 0.09, gain * 0.6));
const hat = (k: Kit, t: number, gain = 0.05, open = false) => noiseHit(k, t, open ? 0.22 : 0.035, 'highpass', 8000, gain, 0.7, 0.05);
const tom = (k: Kit, t: number, f: number, gain = 0.3) => thump(k, t, f, f * 0.6, 0.28, gain, 0.3);
const taiko = (k: Kit, t: number, gain = 0.55) => (thump(k, t, 95, 48, 0.7, gain, 0.5), noiseHit(k, t, 0.12, 'lowpass', 380, gain * 0.5, 1, 0.5));
const crash = (k: Kit, t: number, gain = 0.06) => noiseHit(k, t, 1.6, 'highpass', 5200, gain, 0.5, 0.6);

// ---------------------------------------------------------------------------------------------
// Harmony and the motif
// ---------------------------------------------------------------------------------------------

type Chord = { bass: number; pad: number[] };
const CH: Record<string, Chord> = {
  Dm: { bass: 38, pad: [57, 62, 65] },
  Bb: { bass: 34, pad: [58, 62, 65] },
  C: { bass: 36, pad: [60, 64, 67] },
  Gm: { bass: 43, pad: [58, 62, 67] },
  A: { bass: 33, pad: [57, 61, 64] },
  F: { bass: 41, pad: [57, 60, 65] },
  Eb: { bass: 39, pad: [58, 63, 67] },
};

/** A melody note: [8th-note step in the bar, midi, length in 8ths]. */
type N = [number, number, number];

/** The Gambit motif (8 bars over Dm Dm Bb C Dm Dm Gm A). */
const MOTIF: N[][] = [
  [[0, 69, 2], [2, 74, 2], [4, 77, 3], [7, 76, 1]],
  [[0, 74, 2], [2, 72, 1], [3, 74, 1], [4, 69, 4]],
  [[0, 70, 2], [2, 74, 2], [4, 77, 2], [6, 79, 2]],
  [[0, 76, 3], [3, 77, 1], [4, 76, 2], [6, 72, 2]],
  [[0, 69, 2], [2, 74, 2], [4, 77, 3], [7, 76, 1]],
  [[0, 74, 2], [2, 77, 2], [4, 81, 4]],
  [[0, 79, 2], [2, 77, 1], [3, 76, 1], [4, 74, 2], [6, 70, 2]],
  [[0, 73, 4], [4, 76, 2], [6, 69, 2]],
];
/** The answer phrase (over Bb F Gm Dm Bb C A A). */
const COUNTER: N[][] = [
  [[0, 74, 4], [4, 77, 4]],
  [[0, 72, 4], [4, 69, 4]],
  [[0, 70, 2], [2, 74, 2], [4, 79, 4]],
  [[0, 77, 6], [6, 76, 2]],
  [[0, 74, 4], [4, 70, 4]],
  [[0, 72, 2], [2, 76, 2], [4, 79, 4]],
  [[0, 76, 4], [4, 73, 4]],
  [[0, 69, 8]],
];
/** The rival's version: the same hook, bent Phrygian (E♭) and sharper. */
const RIVAL_MOTIF: N[][] = [
  [[0, 69, 1], [1, 74, 1], [2, 77, 2], [4, 75, 1], [5, 74, 3]],
  [[0, 75, 2], [2, 79, 2], [4, 77, 2], [6, 75, 2]],
  [[0, 74, 1], [1, 77, 1], [2, 81, 4], [6, 79, 1], [7, 77, 1]],
  [[0, 76, 3], [3, 79, 1], [4, 76, 2], [6, 72, 2]],
  [[0, 69, 1], [1, 74, 1], [2, 77, 2], [4, 75, 1], [5, 74, 3]],
  [[0, 79, 2], [2, 82, 2], [4, 81, 2], [6, 79, 2]],
  [[0, 77, 2], [2, 74, 2], [4, 70, 2], [6, 74, 2]],
  [[0, 73, 4], [4, 69, 4]],
];
const RIVAL_COUNTER: N[][] = [[[0, 74, 8]], [[0, 73, 8]], [[0, 74, 4], [4, 70, 4]], [[0, 76, 8]], [[0, 77, 8]], [[0, 79, 8]], [[0, 81, 4], [4, 79, 2], [6, 76, 2]], [[0, 73, 8]]];

const PROG_MAIN = ['Dm', 'Dm', 'Bb', 'C', 'Dm', 'Dm', 'Gm', 'A'];
const PROG_ANSWER = ['Bb', 'F', 'Gm', 'Dm', 'Bb', 'C', 'A', 'A'];
const PROG_RIVAL = ['Dm', 'Eb', 'Dm', 'C', 'Dm', 'Eb', 'Bb', 'A'];
const PROG_DARK = ['Bb', 'A', 'Gm', 'A', 'Bb', 'C', 'A', 'A'];

function melody(_k: Kit, t: number, e: number, notes: N[], play: (t: number, m: number, d: number) => void) {
  for (const [st, m, len] of notes) play(t + st * e, m, len * e * 0.92);
}

// ---------------------------------------------------------------------------------------------
// Themes: each schedules one bar (global bar index within the loop) at time t.
// `s` = one 16th note in seconds.
// ---------------------------------------------------------------------------------------------

interface ThemeDef {
  bpm: number;
  bars: number;
  /** After the first pass, the loop restarts here (skips an intro). */
  loopFrom: number;
  bar(k: Kit, i: number, t: number, s: number): void;
}

const BASS_8THS = [0, 0, 12, 0, 7, 0, 12, 7];

const battle: ThemeDef = {
  bpm: 108,
  bars: 40,
  loopFrom: 0,
  bar(k, i, t, s) {
    const sec = Math.floor(i / 8); // 0 A groove, 1 motif, 2 answer, 3 motif (full), 4 breakdown
    const b = i % 8;
    const prog = sec === 2 ? PROG_ANSWER : PROG_MAIN;
    const ch = CH[prog[b]];
    const e = s * 2;
    const last = b === 7;
    // Drums
    if (sec === 4) {
      // Breakdown: half-time, heavy and sparse.
      kick(k, t, 0.5);
      if (b % 2 === 1) kick(k, t + 10 * s, 0.35);
      snare(k, t + 8 * s, 0.2);
      for (let st = 0; st < 16; st += 4) hat(k, t + st * s, 0.03);
    } else if (sec === 0 && b < 2) {
      kick(k, t, 0.45);
      for (let st = 0; st < 16; st += 2) hat(k, t + st * s, st % 4 ? 0.025 : 0.045);
    } else {
      kick(k, t, 0.5);
      kick(k, t + 8 * s, 0.45);
      if (b % 2 === 1) kick(k, t + 6 * s, 0.3);
      if (!last) {
        snare(k, t + 4 * s);
        snare(k, t + 12 * s);
      } else {
        snare(k, t + 4 * s);
        [8, 10, 12, 13, 14, 15].forEach((st, j) => (j < 3 ? tom(k, t + st * s, [180, 140, 110][j]) : snare(k, t + st * s, 0.12 + j * 0.03)));
      }
      for (let st = 0; st < 16; st += 2) hat(k, t + st * s, st % 4 ? 0.025 : 0.05, st === 14 && b % 4 === 3);
    }
    if (b === 0 && i > 0 && sec !== 4) crash(k, t);
    // Bass
    if (sec === 4) {
      bass(k, t, ch.bass, 8 * s, 0.24, 0.6);
      bass(k, t + 8 * s, ch.bass + (b % 2 ? 7 : 0), 8 * s, 0.2, 0.6);
    } else BASS_8THS.forEach((iv, j) => bass(k, t + j * e, ch.bass + iv, e, sec === 0 && b < 2 ? 0.17 : 0.21));
    // Pad
    pad(k, t, ch.pad, 16 * s, sec === 1 || sec === 3 ? 0.022 : 0.032, sec === 4 ? 800 : 1400);
    // Arpeggio (groove and answer sections)
    if ((sec === 0 && b >= 2) || sec === 2) {
      const tones = [...ch.pad, ch.pad[0] + 12];
      const order = [0, 1, 2, 3, 2, 1, 2, 3];
      order.forEach((n, j) => pluck(k, t + j * e, tones[n] + 12, 0.045));
    }
    // Foreshadow the hook on a bell in the groove section.
    if (sec === 0 && (b === 3 || b === 7)) melody(k, t, e, MOTIF[0], (tt, m) => bell(k, tt, m, 0.07));
    // The motif
    if (sec === 1) melody(k, t, e, MOTIF[b], (tt, m, d) => lead(k, tt, m, d, 0.13));
    if (sec === 3) {
      melody(k, t, e, MOTIF[b], (tt, m, d) => lead(k, tt, m, d, 0.14));
      melody(k, t, e, MOTIF[b], (tt, m, d) => lead(k, tt, m - 12, d, 0.07, 'square', 1600));
      choir(k, t, ch.pad.map((n) => n + 12), 16 * s, 0.022);
    }
    if (sec === 2) {
      melody(k, t, e, COUNTER[b], (tt, m, d) => choir(k, tt, [m], d, 0.05));
      if (b % 2 === 0) bell(k, t, ch.pad[2] + 12, 0.05);
    }
    if (sec === 4) {
      // The hook, slowed to half speed on a low bell, under a choir.
      const half = MOTIF[b % 4 === 0 ? 0 : b % 4 === 2 ? 4 : 1];
      if (b % 2 === 0) melody(k, t, e * 2, half.slice(0, 2), (tt, m) => bell(k, tt, m - 12, 0.1, 2.4));
      choir(k, t, [ch.pad[0], ch.pad[2]], 16 * s, 0.035);
    }
  },
};

const riddle: ThemeDef = {
  bpm: 84,
  bars: 32,
  loopFrom: 0,
  bar(k, i, t, s) {
    const sec = Math.floor(i / 8); // 0 clockwork, 1 motif on bells, 2 answer, 3 motif + harp
    const b = i % 8;
    const ch = CH[(sec === 2 ? PROG_ANSWER : PROG_MAIN)[b]];
    const e = s * 2;
    // A ticking clock: tick-tock on every beat.
    for (let st = 0; st < 16; st += 4) noiseHit(k, t + st * s, 0.025, 'bandpass', st % 8 ? 2600 : 3400, 0.05, 6, 0.2);
    if (b % 4 === 0) thump(k, t, 70, 50, 0.4, 0.22, 0.3);
    bass(k, t, ch.bass + 12, 14 * s, 0.1, 0.5);
    pad(k, t, ch.pad, 16 * s, 0.03, 900);
    if (sec === 0 || sec === 3) {
      const tones = [...ch.pad, ch.pad[0] + 12];
      [0, 2, 1, 3, 2, 1].forEach((n, j) => pluck(k, t + j * e * (8 / 6), tones[n] + 12, 0.035, 'sine'));
    }
    if (sec === 1 || sec === 3) melody(k, t, e, MOTIF[b], (tt, m) => bell(k, tt, m, sec === 3 ? 0.08 : 0.1, 1.4));
    if (sec === 2) melody(k, t, e, COUNTER[b], (tt, m, d) => lead(k, tt, m, d, 0.06, 'triangle', 1800));
    if (b === 7 && sec !== 3) bell(k, t + 12 * s, 81, 0.04, 2.5);
  },
};

const RIVAL_BASS = [0, 0, 12, 0, 0, 0, 12, 0, 0, 0, 12, 0, 1, 0, 12, 7];

const rival: ThemeDef = {
  bpm: 126,
  bars: 44,
  loopFrom: 4,
  bar(k, i, t, s) {
    const e = s * 2;
    if (i < 4) {
      // Intro: a tolling bell, taiko and a rising choir.
      taiko(k, t, 0.6);
      if (i % 2 === 1) taiko(k, t + 8 * s, 0.4);
      bell(k, t, 50, 0.16, 3.5);
      choir(k, t, i < 2 ? [50, 57] : [51, 58], 16 * s, 0.03 + i * 0.01);
      if (i === 3) [8, 10, 12, 13, 14, 15].forEach((st, j) => tom(k, t + st * s, 200 - j * 18, 0.25 + j * 0.03));
      return;
    }
    const j = i - 4;
    const sec = Math.floor(j / 8); // 0 drive, 1 motif, 2 dark breakdown, 3 motif (full), 4 climax
    const b = j % 8;
    const prog = sec === 2 || sec === 4 ? PROG_DARK : PROG_RIVAL;
    const ch = CH[prog[b]];
    const last = b === 7;
    // Drums
    if (sec === 2) {
      taiko(k, t, 0.55);
      thump(k, t + 6 * s, 62, 42, 0.2, 0.4);
      thump(k, t + 8 * s, 58, 40, 0.18, 0.3);
      snare(k, t + 8 * s, 0.14);
    } else {
      [0, 3, 6, 8, 11, 14].forEach((st) => kick(k, t + st * s, st === 0 ? 0.55 : 0.4));
      snare(k, t + 4 * s, 0.24);
      snare(k, t + 12 * s, 0.24);
      for (let st = 0; st < 16; st += 2) hat(k, t + st * s, st % 4 ? 0.022 : 0.035);
      if (b % 2 === 0) taiko(k, t, 0.35);
      if (last) [12, 13, 14, 15].forEach((st, n) => tom(k, t + st * s, 190 - n * 25, 0.3));
      if (sec === 4) [2, 10].forEach((st) => snare(k, t + st * s, 0.1));
    }
    if (b === 0) crash(k, t, 0.07);
    // Bass
    if (sec === 2) bass(k, t, ch.bass, 16 * s, 0.24, 0.5);
    else RIVAL_BASS.forEach((iv, n) => bass(k, t + n * s, ch.bass + iv, s, 0.19, 1.2));
    // Choir chords (always), darker in the breakdown
    choir(k, t, sec === 2 ? [ch.pad[0] - 12, ch.pad[0], ch.pad[2]] : ch.pad, 16 * s, sec === 2 ? 0.05 : 0.035);
    if (b % 4 === 0) bell(k, t, ch.bass + 24, 0.08, 2.5);
    // Melody
    if (sec === 0 && b >= 4) melody(k, t, e, RIVAL_MOTIF[0].slice(0, 3), (tt, m) => pluck(k, tt, m, 0.06, 'square'));
    if (sec === 1 || sec === 3) melody(k, t, e, RIVAL_MOTIF[b], (tt, m, d) => lead(k, tt, m, d, 0.13, 'sawtooth', 2800));
    if (sec === 3) melody(k, t, e, RIVAL_MOTIF[b], (tt, m, d) => lead(k, tt, m - 12, d, 0.08, 'square', 1500));
    if (sec === 2) {
      // The hook at half speed, alone on a bell, while the heart pounds.
      if (b % 2 === 0) melody(k, t, e * 2, RIVAL_MOTIF[b % 4 === 0 ? 0 : 4].slice(0, 3), (tt, m) => bell(k, tt, m - 12, 0.12, 2.6));
    }
    if (sec === 4) {
      melody(k, t, e, RIVAL_COUNTER[b], (tt, m, d) => lead(k, tt, m, d, 0.11, 'sawtooth', 3000));
      melody(k, t, e, RIVAL_MOTIF[b], (tt, m) => pluck(k, tt, m + 12, 0.04, 'square'));
    }
  },
};

export const THEMES: Record<Theme, ThemeDef> = { battle, riddle, rival };

// ---------------------------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------------------------

export interface Player {
  theme: Theme;
  stop(): void;
}

function impulse(c: BaseAudioContext, secs: number) {
  const len = Math.floor(c.sampleRate * secs);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
  }
  return buf;
}

let noiseBuf: AudioBuffer | null = null;
let verbBuf: AudioBuffer | null = null;

function makeKit(c: AudioContext | OfflineAudioContext, bus: AudioNode, bpm: number): Kit {
  if (!noiseBuf || noiseBuf.sampleRate !== c.sampleRate) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    verbBuf = null;
  }
  verbBuf ??= impulse(c, 1.5);
  const verb = c.createConvolver();
  verb.buffer = verbBuf;
  const verbOut = c.createGain();
  verbOut.gain.value = 0.5;
  verb.connect(verbOut).connect(bus);
  // Echo: a dotted-8th delay for the lead.
  const echo = c.createGain();
  const dl = c.createDelay(2);
  dl.delayTime.value = (60 / bpm) * 0.75;
  const fb = c.createGain();
  fb.gain.value = 0.32;
  const elp = c.createBiquadFilter();
  elp.type = 'lowpass';
  elp.frequency.value = 2200;
  echo.connect(dl);
  dl.connect(elp).connect(fb).connect(dl);
  elp.connect(bus);
  const stops: OscillatorNode[] = [];
  const osc = (type: OscillatorType, det = 0) => {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = 110;
    o.detune.value = det;
    o.start();
    stops.push(o);
    return o;
  };
  // Shared vibrato for leads and the choir.
  const lfo = osc('sine');
  lfo.frequency.value = 5.4;
  const vib = c.createGain();
  vib.gain.value = 8;
  lfo.connect(vib);
  // Bass: saw + sub sine through a resonant filter.
  const bg = c.createGain();
  bg.gain.value = 0;
  bg.connect(bus);
  const blp = c.createBiquadFilter();
  blp.type = 'lowpass';
  blp.Q.value = 7;
  blp.connect(bg);
  const saw = osc('sawtooth');
  saw.connect(blp);
  const sub = osc('sine');
  const subG = c.createGain();
  subG.gain.value = 0.8;
  sub.connect(subG).connect(bg);
  // Banks: pad (3 voices, root doubled) and choir (3 voices through vowel formants).
  const bank = (count: number, voiceOscs: (i: number) => OscillatorNode[], into: (g: GainNode) => void, verbAmt: number, dry: number): Bank => {
    const g = c.createGain();
    g.gain.value = 0;
    send({ c } as Kit, g, bus, dry);
    send({ c } as Kit, g, verb, verbAmt);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1300;
    into(g);
    const voices = Array.from({ length: count }, (_, i) => {
      const vg = c.createGain();
      vg.gain.value = 0;
      const oscs = voiceOscs(i);
      oscs.forEach((o) => o.connect(vg));
      vg.connect(lp);
      return { oscs, g: vg };
    });
    return { voices, lp, g };
  };
  const padSyn = bank(3, (i) => (i === 0 ? [osc('sawtooth', -9), osc('sawtooth', 9)] : [osc('sawtooth', i % 2 ? 6 : -6)]), () => {}, 0.6, 1);
  padSyn.lp.connect(padSyn.g);
  const choirSyn = bank(
    3,
    () => {
      const a = osc('sawtooth', -10);
      const b = osc('sawtooth', 10);
      vib.connect(a.detune);
      vib.connect(b.detune);
      return [a, b];
    },
    () => {},
    0.9,
    0.8,
  );
  // Vowel formants after the choir's filter.
  const f1 = c.createBiquadFilter();
  f1.type = 'bandpass';
  f1.frequency.value = 720;
  f1.Q.value = 5;
  const f2 = c.createBiquadFilter();
  f2.type = 'bandpass';
  f2.frequency.value = 1150;
  f2.Q.value = 6;
  choirSyn.lp.frequency.value = 4000;
  choirSyn.lp.connect(f1).connect(choirSyn.g);
  choirSyn.lp.connect(f2).connect(choirSyn.g);
  return { c: c as AudioContext, out: bus, verb, echo, noise: noiseBuf, vib, bassSyn: { saw, sub, lp: blp, g: bg }, padSyn, choirSyn, stops };
}

/** Schedule `bars` bars of a theme at once (offline rendering / previews). Returns the length in s. */
export function scheduleTheme(c: OfflineAudioContext, dest: AudioNode, theme: Theme, bars: number, level = 1): number {
  const def = THEMES[theme];
  const bus = c.createGain();
  bus.gain.value = 0.55 * level;
  bus.connect(dest);
  const k = makeKit(c, bus, def.bpm);
  const s = 60 / def.bpm / 4;
  let i = 0;
  for (let n = 0; n < bars; n++) {
    def.bar(k, i, 0.05 + n * s * 16, s);
    i++;
    if (i >= def.bars) i = def.loopFrom;
  }
  const end = 0.05 + bars * s * 16;
  k.stops.forEach((o) => o.stop(end + 2));
  return end;
}

/** Start a theme on `dest` (fades in). Scheduling runs ahead, so a throttled timer is fine. */
export function playTheme(c: AudioContext, dest: AudioNode, theme: Theme, level = 1): Player {
  const def = THEMES[theme];
  const bus = c.createGain();
  bus.gain.setValueAtTime(0, c.currentTime);
  bus.gain.linearRampToValueAtTime(0.55 * level, c.currentTime + 2.5);
  bus.connect(dest);
  const k = makeKit(c, bus, def.bpm);
  const s = 60 / def.bpm / 4;
  const barLen = s * 16;
  let i = 0;
  let next = c.currentTime + 0.15;
  let stopped = false;
  const tick = () => {
    if (stopped) return;
    try {
      if (next < c.currentTime) next = c.currentTime + 0.05;
      while (next < c.currentTime + 1.8) {
        def.bar(k, i, next, s);
        next += barLen;
        i++;
        if (i >= def.bars) i = def.loopFrom;
      }
    } catch (e) {
      console.warn('run music', e);
    }
  };
  tick();
  const timer = setInterval(tick, 250);
  return {
    theme,
    stop() {
      stopped = true;
      clearInterval(timer);
      const t = c.currentTime;
      bus.gain.cancelScheduledValues(t);
      bus.gain.setValueAtTime(bus.gain.value, t);
      bus.gain.linearRampToValueAtTime(0, t + 1.2);
      setTimeout(() => {
        k.stops.forEach((o) => o.stop());
        bus.disconnect();
      }, 4000);
    },
  };
}
