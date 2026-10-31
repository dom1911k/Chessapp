// Run mode's own sounds (Web Audio, no files) + haptics. Uses the app's synth voices read-only,
// on a separate audio context, and respects the app's sound on/off and volume.
import { marimba, tockWith } from '../lib/sound';
import { useSettings } from '../lib/settings';

export type RunSound = 'relic' | 'hit' | 'clear' | 'over' | 'slam' | 'chip' | 'coin' | 'card' | 'fail' | 'win';

let ctx: AudioContext | null = null;
let out: GainNode | null = null;

function audio() {
  try {
    if (!ctx) {
      ctx = new AudioContext();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      out = ctx.createGain();
      out.connect(comp).connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    out!.gain.value = useSettings.getState().soundVolume;
    return { c: ctx, o: out! };
  } catch {
    return null;
  }
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

export function sfx(name: RunSound, n = 0) {
  if (!useSettings.getState().sound) return;
  const a = audio();
  if (!a) return;
  const { c, o } = a;
  const t = c.currentTime + 0.01;
  switch (name) {
    case 'relic':
      // Glassy bell: two detuned high partials with a shimmer.
      [1568, 2349, 3136].forEach((f, i) => marimba(c, o, t + i * 0.035, f * (1 + n * 0.06), 0.12, 0.6));
      tone(c, o, t, 2600, 3400, 0.25, 'triangle', 0.03);
      break;
    case 'hit':
      // A low, heavy thud plus a sour minor second.
      tockWith(c, o, t, 0.5, 1.2, 1.8);
      tone(c, o, t, 140, 60, 0.35, 'sine', 0.35);
      marimba(c, o, t + 0.05, 233.1, 0.12, 0.5);
      marimba(c, o, t + 0.05, 246.9, 0.12, 0.5);
      break;
    case 'clear':
      [392, 523.3, 659.3, 784, 1046.5].forEach((f, i) => marimba(c, o, t + i * 0.06, f, 0.16, i === 4 ? 1 : 0.3));
      break;
    case 'fail':
      [392, 349.2, 311.1].forEach((f, i) => marimba(c, o, t + i * 0.12, f, 0.16, 0.5));
      break;
    case 'over':
      // Slow descending tritone + a deep drone.
      [466.2, 329.6, 233.1, 164.8].forEach((f, i) => marimba(c, o, t + i * 0.22, f, 0.18, 0.9));
      tone(c, o, t, 110, 55, 1.6, 'sawtooth', 0.04);
      break;
    case 'win':
      [523.3, 659.3, 784, 1046.5, 1318.5, 1568].forEach((f, i) => marimba(c, o, t + i * 0.07, f, 0.17, i === 5 ? 1.2 : 0.35));
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

// ---- Ambient music: a low drone with a slowly breathing filter and sparse marimba notes. ----
const MUSIC_KEY = 'chesscoach.run.music';
export const musicPref = () => {
  try {
    return localStorage.getItem(MUSIC_KEY) !== '0';
  } catch {
    return true;
  }
};
export const setMusicPref = (on: boolean) => {
  try {
    localStorage.setItem(MUSIC_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
};

let amb: { stop(): void } | null = null;
const SCALE = [220, 261.6, 293.7, 329.6, 392, 440, 523.3, 587.3];

export function ambient(on: boolean) {
  if (!on || !useSettings.getState().sound) {
    amb?.stop();
    amb = null;
    return;
  }
  if (amb) return;
  const a = audio();
  if (!a) return;
  const { c, o } = a;
  const bus = c.createGain();
  bus.gain.setValueAtTime(0, c.currentTime);
  bus.gain.linearRampToValueAtTime(0.05, c.currentTime + 3);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 380;
  lp.Q.value = 3;
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  lfo.frequency.value = 0.06;
  lfoGain.gain.value = 180;
  lfo.connect(lfoGain).connect(lp.frequency);
  lp.connect(bus).connect(o);
  const oscs = [55, 55.35, 82.4].map((f, i) => {
    const osc = c.createOscillator();
    osc.type = i === 2 ? 'sine' : 'sawtooth';
    osc.frequency.value = f;
    const g = c.createGain();
    g.gain.value = i === 2 ? 0.5 : 0.35;
    osc.connect(g).connect(lp);
    osc.start();
    return osc;
  });
  lfo.start();
  let timer: ReturnType<typeof setTimeout>;
  const note = () => {
    const t = c.currentTime + 0.02;
    const f = SCALE[Math.floor(Math.random() * SCALE.length)];
    marimba(c, bus, t, f, 0.5, 1.4);
    if (Math.random() < 0.3) marimba(c, bus, t + 0.18, f * 1.5, 0.3, 1.2);
    timer = setTimeout(note, 2200 + Math.random() * 2600);
  };
  timer = setTimeout(note, 1500);
  amb = {
    stop() {
      clearTimeout(timer);
      const t = c.currentTime;
      bus.gain.cancelScheduledValues(t);
      bus.gain.setValueAtTime(bus.gain.value, t);
      bus.gain.linearRampToValueAtTime(0, t + 0.8);
      setTimeout(() => {
        oscs.forEach((x) => x.stop());
        lfo.stop();
        bus.disconnect();
      }, 900);
    },
  };
}
