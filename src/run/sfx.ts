// Run mode's own sounds (Web Audio, no files) + haptics + ambient music. Uses the app's synth
// voices read-only, on a separate audio context; respects the app's sound on/off and volume,
// times Run mode's own music/sound levels.
import { marimba, tockWith } from '../lib/sound';
import { useSettings } from '../lib/settings';
import { useRunSettings } from './settings';
import { playTheme, type Player, type Theme } from './music';

export type RunSound =
  | 'relic' | 'hit' | 'clear' | 'over' | 'slam' | 'chip' | 'coin' | 'card' | 'fail' | 'win' | 'whoosh' | 'door' | 'technique' | 'ready' | 'drip'
  // Crunch: scoring beats (pitched by the ladder), the room-end slam and the finale.
  | 'beatChip' | 'beatMult' | 'beatX' | 'beatGold' | 'collide' | 'tick' | 'milestone' | 'fanfare' | 'stamp' | 'ignite'
  | 'move' | 'capture' | 'check' | 'castle' | 'promote';

let ctx: AudioContext | null = null;
let sfxOut: GainNode | null = null;
let musicOut: GainNode | null = null;
let echo: GainNode | null = null;

function audio() {
  try {
    if (!ctx) {
      ctx = new AudioContext();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.connect(ctx.destination);
      sfxOut = ctx.createGain();
      musicOut = ctx.createGain();
      sfxOut.connect(comp);
      musicOut.connect(comp);
      // A short stone-room echo for piece sounds.
      echo = ctx.createGain();
      const d = ctx.createDelay(1);
      d.delayTime.value = 0.13;
      const fb = ctx.createGain();
      fb.gain.value = 0.3;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1300;
      echo.connect(d);
      d.connect(lp).connect(fb).connect(d);
      lp.connect(sfxOut);
      echo.connect(sfxOut);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    const app = useSettings.getState().soundVolume;
    const rs = useRunSettings.getState();
    sfxOut!.gain.value = app * rs.sfx;
    musicOut!.gain.value = app * rs.music;
    return { c: ctx, o: sfxOut!, e: echo!, m: musicOut! };
  } catch {
    return null;
  }
}

/** Re-apply volumes (after a settings change). */
export function applyVolumes() {
  if (ctx) audio();
}

function tone(c: AudioContext, o: AudioNode, t: number, f0: number, f1: number, dur: number, type: OscillatorType, gain: number) {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(o);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

/** Filtered noise burst (sweeping band-pass): crunches and whooshes. */
function noise(c: AudioContext, o: AudioNode, t: number, dur: number, f0: number, f1: number, gain: number, q = 1.2) {
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + Math.min(0.04, dur / 4));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(o);
  src.start(t);
}

/**
 * Play a sound. For piece sounds, `opp` makes it a little lower (the opponent's move).
 * `pitch` shifts the crunch sounds by semitones (the scoring chain's pitch ladder).
 */
export function sfx(name: RunSound, n = 0, opp = false, pitch = 0) {
  // Sound must never break the game.
  try {
    playSfx(name, n, opp, pitch);
  } catch (e) {
    console.warn('run sfx', e);
  }
}

function playSfx(name: RunSound, n: number, opp: boolean, pitch: number) {
  if (!useSettings.getState().sound) return;
  const a = audio();
  if (!a) return;
  const { c, o, e } = a;
  const t = c.currentTime + 0.01;
  const p = opp ? 0.86 : 1;
  const k = Math.pow(2, pitch / 12);
  const stone = (at: number, pitch: number, weight = 1.7, gain = 1) => {
    tockWith(c, o, at, 0.55 * pitch, gain, weight);
    tockWith(c, e, at, 0.55 * pitch, gain * 0.45, weight);
    tone(c, e, at, 130 * pitch, 70 * pitch, 0.14, 'sine', 0.22 * gain);
  };
  switch (name) {
    case 'move':
      stone(t, p);
      break;
    case 'capture':
      noise(c, o, t, 0.08, 1800 * p, 700 * p, 0.35, 2);
      stone(t + 0.03, p * 0.9, 2.2, 1.1);
      noise(c, e, t + 0.05, 0.45, 2200, 260, 0.12, 0.8);
      marimba(c, e, t + 0.08, 155.6 * p, 0.1, 0.7);
      marimba(c, e, t + 0.08, 164.8 * p, 0.08, 0.7);
      break;
    case 'check':
      stone(t, p);
      marimba(c, e, t + 0.06, 196 * p, 0.22, 1.8);
      marimba(c, e, t + 0.06, 293.7 * p, 0.09, 1.4);
      tone(c, e, t + 0.06, 784 * p, 776 * p, 1.2, 'sine', 0.03);
      break;
    case 'castle':
      stone(t, p);
      stone(t + 0.13, p * 0.94);
      break;
    case 'promote':
      stone(t, p);
      [392, 523.3, 659.3, 784].forEach((f, i) => marimba(c, e, t + 0.08 + i * 0.08, f * p, 0.16, i === 3 ? 1.2 : 0.4));
      break;
    case 'relic':
      [1568, 2349, 3136].forEach((f, i) => marimba(c, o, t + i * 0.035, f * (1 + n * 0.06), 0.12, 0.6));
      tone(c, o, t, 2600, 3400, 0.25, 'triangle', 0.03);
      break;
    case 'hit':
      tockWith(c, o, t, 0.5, 1.2, 1.8);
      tone(c, o, t, 140, 60, 0.35, 'sine', 0.35);
      marimba(c, e, t + 0.05, 233.1, 0.12, 0.5);
      marimba(c, e, t + 0.05, 246.9, 0.12, 0.5);
      break;
    case 'clear':
      [392, 523.3, 659.3, 784, 1046.5].forEach((f, i) => marimba(c, e, t + i * 0.06, f, 0.16, i === 4 ? 1 : 0.3));
      break;
    case 'fail':
      [392, 349.2, 311.1].forEach((f, i) => marimba(c, e, t + i * 0.12, f, 0.16, 0.5));
      break;
    case 'over':
      [466.2, 329.6, 233.1, 164.8].forEach((f, i) => marimba(c, e, t + i * 0.22, f, 0.18, 0.9));
      tone(c, o, t, 110, 55, 1.6, 'sawtooth', 0.04);
      break;
    case 'win':
      [523.3, 659.3, 784, 1046.5, 1318.5, 1568].forEach((f, i) => marimba(c, e, t + i * 0.07, f, 0.17, i === 5 ? 1.2 : 0.35));
      break;
    case 'slam':
      tockWith(c, o, t, 0.45, 1.3, 2.2);
      tone(c, o, t, 90, 40, 0.5, 'sine', 0.5);
      break;
    case 'chip':
      marimba(c, o, t, 880 * Math.pow(2, Math.min(n, 24) / 24), 0.07, 0.12);
      break;
    case 'coin':
      marimba(c, o, t, 1975.5, 0.1, 0.15);
      marimba(c, o, t + 0.06, 2637, 0.1, 0.3);
      break;
    case 'card':
      tockWith(c, o, t, 1.8, 0.4, 0.5);
      noise(c, o, t, 0.12, 3000, 1500, 0.05, 1);
      break;
    case 'whoosh':
      noise(c, e, t, 0.45, 300, 2400, 0.12, 0.7);
      break;
    case 'ready':
      // A small bright chime: the next Order purchase is affordable.
      [1318.5, 1760, 2637].forEach((f, i) => marimba(c, o, t + i * 0.07, f, 0.16, i === 2 ? 0.9 : 0.4));
      break;
    case 'drip':
      marimba(c, o, t, 1568 * Math.pow(2, Math.min(n, 12) / 24), 0.06, 0.1);
      break;
    case 'technique':
      // A blade swish, then a bright stab on the Gambit's D minor.
      noise(c, o, t, 0.22, 900, 5200, 0.16, 0.9);
      [293.7, 349.2, 440, 587.3].forEach((f) => marimba(c, e, t + 0.12, f, 0.2, 0.9));
      [1174.7, 1760].forEach((f, i) => marimba(c, o, t + 0.2 + i * 0.07, f, 0.12, 0.8));
      break;
    // ---- Crunch ----
    case 'beatChip':
      // A bright poker-chip click.
      tockWith(c, o, t, 2.2 * k, 0.35, 0.6);
      marimba(c, o, t, 1046.5 * k, 0.11, 0.14);
      break;
    case 'beatMult':
      // A warmer, rounder knock a fifth lower.
      marimba(c, o, t, 523.3 * k, 0.16, 0.22);
      marimba(c, e, t + 0.015, 784 * k, 0.07, 0.3);
      tone(c, o, t, 300 * k, 180 * k, 0.12, 'triangle', 0.08);
      break;
    case 'beatX':
      // Heavy: a sub thump, a crunch and a stacked stab.
      tone(c, o, t, 120 * k, 38, 0.38, 'sine', 0.55);
      noise(c, o, t, 0.16, 2600, 500, 0.26, 1.4);
      [392, 587.3, 784].forEach((f) => marimba(c, e, t + 0.02, f * k, 0.18, 0.7));
      tockWith(c, o, t, 0.5, 1.2, 2);
      break;
    case 'beatGold':
      marimba(c, o, t, 1975.5 * k, 0.1, 0.12);
      marimba(c, o, t + 0.05, 2637 * k, 0.09, 0.25);
      break;
    case 'collide': {
      // The Chips and Mult boxes collide: louder for bigger scores (n = shake px, 1..4).
      const w = 0.7 + n * 0.15;
      tockWith(c, o, t, 0.4, 1.2 * w, 2.4);
      tone(c, o, t, 100, 32, 0.6 + n * 0.1, 'sine', 0.45 * w);
      noise(c, o, t, 0.35, 3200, 240, 0.22 * w, 0.9);
      noise(c, e, t + 0.05, 0.6, 900, 140, 0.1 * w, 0.7);
      break;
    }
    case 'tick':
      tockWith(c, o, t, 2.6 * k, 0.18, 0.4);
      break;
    case 'stamp':
      tockWith(c, o, t, 0.9, 1, 1.6);
      marimba(c, e, t + 0.03, 1318.5, 0.12, 0.5);
      break;
    case 'ignite':
      noise(c, o, t, 0.7, 400, 3800, 0.16, 0.6);
      tone(c, o, t, 70, 140, 0.6, 'sawtooth', 0.05);
      break;
    case 'milestone':
      // A one-off bell peal: rising fifths over a low gong.
      tone(c, o, t, 98, 92, 2.2, 'sine', 0.3);
      [523.3, 784, 1174.7, 1568, 2349.3].forEach((f, i) => marimba(c, e, t + 0.1 + i * 0.11, f, 0.18, i === 4 ? 1.8 : 0.6));
      [1568, 2349.3].forEach((f) => marimba(c, e, t + 0.75, f, 0.12, 1.6));
      break;
    case 'fanfare':
      // New personal best: a brass-ish triad call, then the resolution.
      [[392, 0], [523.3, 0.14], [659.3, 0.28], [784, 0.42]].forEach(([f, d]) => {
        tone(c, o, t + d, f, f, 0.22, 'sawtooth', 0.05);
        marimba(c, e, t + d, f, 0.16, 0.5);
      });
      [523.3, 659.3, 784, 1046.5].forEach((f) => {
        tone(c, o, t + 0.62, f, f, 0.9, 'sawtooth', 0.035);
        marimba(c, e, t + 0.62, f, 0.18, 1.4);
      });
      break;
    case 'door':
      // Stone door grinding open, then a thud.
      noise(c, o, t, 0.6, 160, 420, 0.18, 3);
      tone(c, o, t, 55, 48, 0.6, 'sawtooth', 0.05);
      stone(t + 0.55, 0.7, 2.4, 1);
      break;
  }
}

export function buzz(ms: number | number[]) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not supported (iOS) */
  }
}

// ---- Ambient music --------------------------------------------------------------------------
// A slow minor progression of 8 chords × 8 s (≈64 s per cycle): a breathing drone on the root,
// a soft pad on the chord, a recurring bell motif at the top of each cycle and sparse bell notes
// in between, with small random variations each time round. In the rival's room a low heartbeat
// joins in.

type Chord = { root: number; tones: number[] };
const A2 = 110, C3 = 130.8, D3 = 146.8, E3 = 164.8, F2 = 87.3, G2 = 98, D2 = 73.4, E2 = 82.4, Gs3 = 207.7, B2 = 123.5;
const PROG: Chord[] = [
  { root: A2, tones: [220, 261.6, 329.6] }, // Am
  { root: F2, tones: [174.6, 220, 261.6] }, // F
  { root: D2, tones: [146.8, 174.6, 220] }, // Dm
  { root: E2, tones: [164.8, Gs3, 246.9] }, // E
  { root: A2, tones: [220, 261.6, 329.6] }, // Am
  { root: G2, tones: [196, 246.9, 293.7] }, // G
  { root: F2, tones: [174.6, 220, 261.6] }, // F
  { root: E2, tones: [164.8, Gs3, 246.9] }, // E
];
void [C3, D3, E3, B2];
const BAR = 8;
const MOTIF = [440, 523.3, 659.3, 587.3, 523.3, 493.9];

export type MusicMode = 'calm' | 'tense';
let amb: { stop(): void; mode(m: MusicMode): void } | null = null;

export function ambient(on: boolean, mode: MusicMode = 'calm') {
  try {
    startAmbient(on, mode);
  } catch (e) {
    console.warn('run music', e);
  }
}

function startAmbient(on: boolean, mode: MusicMode) {
  if (!on || !useSettings.getState().sound || useRunSettings.getState().music <= 0) {
    amb?.stop();
    amb = null;
    return;
  }
  if (amb) return amb.mode(mode);
  const a = audio();
  if (!a) return;
  const { c, m: out } = a;
  const bus = c.createGain();
  bus.gain.setValueAtTime(0, c.currentTime);
  bus.gain.linearRampToValueAtTime(0.06, c.currentTime + 4);
  bus.connect(out);
  // Drone
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 420;
  lp.Q.value = 3;
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  lfo.frequency.value = 0.045;
  lfoGain.gain.value = 200;
  lfo.connect(lfoGain).connect(lp.frequency);
  lp.connect(bus);
  const drone = [0, 1.006, 0.5].map((mul, i) => {
    const osc = c.createOscillator();
    osc.type = i === 2 ? 'sine' : 'sawtooth';
    osc.frequency.value = A2 * mul;
    const g = c.createGain();
    g.gain.value = i === 2 ? 0.55 : 0.3;
    osc.connect(g).connect(lp);
    osc.start();
    return { osc, mul: mul || 1 };
  });
  // Pad
  const padLp = c.createBiquadFilter();
  padLp.type = 'lowpass';
  padLp.frequency.value = 900;
  padLp.connect(bus);
  const pad = [0, 1, 2].map(() => {
    const osc = c.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 220;
    const g = c.createGain();
    g.gain.value = 0;
    osc.connect(g).connect(padLp);
    osc.start();
    return { osc, g };
  });
  lfo.start();
  // Heartbeat (tense mode)
  const heart = c.createGain();
  heart.gain.value = 0;
  heart.connect(bus);
  let mode0: MusicMode = mode;
  let bar = 0;
  let next = c.currentTime + 0.2;
  const schedule = () => {
    try {
      scheduleBars();
    } catch (e) {
      console.warn('run music', e);
    }
  };
  const scheduleBars = () => {
    if (next < c.currentTime) next = c.currentTime + 0.1;
    while (next < c.currentTime + BAR + 1) {
      const ch = PROG[bar % PROG.length];
      const t = next;
      for (const d of drone) d.osc.frequency.setTargetAtTime(ch.root * d.mul, t, 1.2);
      pad.forEach((p, i) => {
        p.osc.frequency.setTargetAtTime(ch.tones[i] * (Math.random() < 0.15 ? 2 : 1), t, 1.4);
        p.g.gain.setTargetAtTime(0.0, Math.max(c.currentTime, t - 0.6), 0.5);
        p.g.gain.setTargetAtTime(0.11 + Math.random() * 0.05, t + 0.2, 1.6);
      });
      if (bar % PROG.length === 0) {
        // The motif, a little different each cycle.
        const start = Math.random() < 0.5 ? 0 : 2;
        MOTIF.slice(start, start + 4).forEach((f, i) => marimba(c, bus, t + 1 + i * 0.9, f, 0.45, 2.2));
      } else {
        const notes = 1 + Math.floor(Math.random() * 3);
        for (let k = 0; k < notes; k++) {
          const f = ch.tones[Math.floor(Math.random() * 3)] * (Math.random() < 0.6 ? 2 : 4);
          marimba(c, bus, t + 1 + Math.random() * (BAR - 2), f, 0.32, 1.8);
        }
      }
      // Heartbeat: two low thumps per beat, every 1.2 s.
      if (mode0 === 'tense')
        for (let b = 0; b < BAR - 0.3; b += 1.2) {
          tone(c, heart, t + b, 62, 42, 0.18, 'sine', 0.9);
          tone(c, heart, t + b + 0.24, 58, 40, 0.16, 'sine', 0.6);
        }
      next += BAR;
      bar++;
    }
  };
  schedule();
  const timer = setInterval(schedule, 2000);
  const setMode = (m: MusicMode) => {
    mode0 = m;
    heart.gain.setTargetAtTime(m === 'tense' ? 0.5 : 0, c.currentTime, 0.8);
    lp.frequency.setTargetAtTime(m === 'tense' ? 560 : 420, c.currentTime, 1);
  };
  setMode(mode);
  amb = {
    mode: setMode,
    stop() {
      clearInterval(timer);
      const t = c.currentTime;
      bus.gain.cancelScheduledValues(t);
      bus.gain.setValueAtTime(bus.gain.value, t);
      bus.gain.linearRampToValueAtTime(0, t + 1);
      setTimeout(() => {
        drone.forEach((d) => d.osc.stop());
        pad.forEach((p) => p.osc.stop());
        lfo.stop();
        bus.disconnect();
      }, 1100);
    },
  };
}

/** The sound for a move from its SAN. */
export function moveSound(san: string): RunSound {
  if (san.includes('=')) return 'promote';
  if (san.includes('+') || san.includes('#')) return 'check';
  if (san.startsWith('O-O')) return 'castle';
  if (san.includes('x')) return 'capture';
  return 'move';
}

// ---- Music director: ambient on the map, a battle theme in rooms --------------------------
let battle: Player | null = null;

/** What should play: 'map' = the ambient drone; a theme = that battle theme; null = silence. */
export function runMusic(want: 'map' | Theme | null) {
  try {
    const on = want !== null && useSettings.getState().sound && useRunSettings.getState().music > 0;
    if (!on) {
      battle?.stop();
      battle = null;
      ambient(false);
      return;
    }
    if (want === 'map') {
      battle?.stop();
      battle = null;
      ambient(true, 'calm');
      return;
    }
    if (battle?.theme === want) return;
    ambient(false);
    battle?.stop();
    const a = audio();
    if (!a) return;
    battle = playTheme(a.c, a.m, want, want === 'riddle' ? 1.35 : 1);
  } catch (e) {
    console.warn('run music', e);
  }
}
