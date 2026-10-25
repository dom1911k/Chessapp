// Small synthesized sound effects (Web Audio) — no audio files to ship.
import { useSettings } from './settings';

export type SoundName = 'move' | 'capture' | 'check' | 'success' | 'error' | 'notify';

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(c: AudioContext, freq: number, start: number, dur: number, type: OscillatorType, gain: number) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime + start);
  g.gain.setValueAtTime(0, c.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, c.currentTime + start + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  o.connect(g).connect(c.destination);
  o.start(c.currentTime + start);
  o.stop(c.currentTime + start + dur + 0.02);
}

/** A short "knock" made from filtered noise, like a piece landing on wood. */
function knock(c: AudioContext, start: number, gain: number, freq: number) {
  const len = Math.floor(c.sampleRate * 0.06);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = 1.2;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(c.destination);
  src.start(c.currentTime + start);
}

export function playSound(name: SoundName) {
  if (!useSettings.getState().sound) return;
  const c = audio();
  if (!c) return;
  switch (name) {
    case 'move':
      knock(c, 0, 0.9, 900);
      break;
    case 'capture':
      knock(c, 0, 1, 700);
      knock(c, 0.05, 0.7, 1100);
      break;
    case 'check':
      knock(c, 0, 0.9, 900);
      tone(c, 880, 0.03, 0.18, 'triangle', 0.12);
      break;
    case 'success':
      tone(c, 660, 0, 0.12, 'sine', 0.14);
      tone(c, 880, 0.1, 0.22, 'sine', 0.14);
      break;
    case 'error':
      tone(c, 220, 0, 0.22, 'triangle', 0.14);
      break;
    case 'notify':
      tone(c, 740, 0, 0.15, 'sine', 0.1);
      break;
  }
}

/** Picks the sound for a move from its SAN. */
export function moveSound(san: string) {
  playSound(san.includes('+') || san.includes('#') ? 'check' : san.includes('x') ? 'capture' : 'move');
}
