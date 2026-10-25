// Soft, warm, wooden sound effects synthesised with Web Audio (no audio files).
//
// A piece landing on a wooden board is modelled as a few damped "modes":
// a low body thump plus inharmonic wood resonances that die away within a few
// tens of milliseconds, through a gentle low-pass so nothing sounds sharp.
// Chimes (success, check) use a soft marimba voice — also wood.
import { useSettings } from './settings';

export type SoundName = 'move' | 'capture' | 'check' | 'castle' | 'success' | 'error' | 'notify' | 'win';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function audio(): { c: AudioContext; out: GainNode } | null {
  try {
    if (!ctx) {
      ctx = new AudioContext();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.ratio.value = 3;
      const warm = ctx.createBiquadFilter();
      warm.type = 'lowpass';
      warm.frequency.value = 3400;
      warm.Q.value = 0.4;
      master = ctx.createGain();
      master.connect(warm).connect(comp).connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    master!.gain.value = useSettings.getState().soundVolume;
    return { c: ctx, out: master! };
  } catch {
    return null;
  }
}

/** One damped sine "mode". */
function mode(c: BaseAudioContext, out: AudioNode, t: number, freq: number, amp: number, decay: number) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'sine';
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(amp, t + 0.002);
  g.gain.setTargetAtTime(0, t + 0.002, decay);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + decay * 8 + 0.05);
}

/** A very short, soft contact click (filtered noise) that gives the "wood" its attack. */
function contact(c: BaseAudioContext, out: AudioNode, t: number, amp: number, freq: number) {
  const len = Math.floor(c.sampleRate * 0.012);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = 0.9;
  const g = c.createGain();
  g.gain.value = amp;
  src.connect(f).connect(g).connect(out);
  src.start(t);
}

/** A wooden piece set down on the board. `pitch` ~1, `weight` ~1 (heavier = more body). */
export function tock(c: BaseAudioContext, out: AudioNode, t: number, pitch = 1, gain = 1, weight = 1) {
  const p = pitch * (0.97 + Math.random() * 0.06);
  mode(c, out, t, 150 * p, 0.55 * gain * weight, 0.022 * weight);
  mode(c, out, t, 480 * p, 0.42 * gain, 0.018);
  mode(c, out, t, 1150 * p, 0.16 * gain, 0.011);
  mode(c, out, t, 2050 * p, 0.05 * gain, 0.007);
  contact(c, out, t, 0.18 * gain, 2200 * p);
}

/** A soft marimba note. */
export function marimba(c: BaseAudioContext, out: AudioNode, t: number, freq: number, gain = 0.3, length = 0.35) {
  mode(c, out, t, freq, gain, length / 3);
  mode(c, out, t, freq * 3.93, gain * 0.18, length / 12);
  mode(c, out, t, freq * 9.2, gain * 0.04, length / 30);
  contact(c, out, t, gain * 0.15, freq * 2);
}

/** Schedules the named sound on any (live or offline) audio context. */
export function renderSound(c: BaseAudioContext, out: AudioNode, name: SoundName, t: number) {
  switch (name) {
    case 'move':
      tock(c, out, t, 1, 0.9);
      break;
    case 'capture':
      // Piece knocks the captured piece, then lands: two close, slightly heavier tocks.
      tock(c, out, t, 1.12, 0.55, 0.8);
      tock(c, out, t + 0.05, 0.92, 1, 1.25);
      break;
    case 'castle':
      tock(c, out, t, 1, 0.8);
      tock(c, out, t + 0.11, 0.94, 0.8);
      break;
    case 'check':
      tock(c, out, t, 1, 0.9);
      marimba(c, out, t + 0.04, 659.3, 0.16, 0.3); // E5
      break;
    case 'success':
      marimba(c, out, t, 523.3, 0.22); // C5
      marimba(c, out, t + 0.11, 784, 0.2, 0.5); // G5
      break;
    case 'error':
      marimba(c, out, t, 329.6, 0.2, 0.25); // E4
      marimba(c, out, t + 0.12, 261.6, 0.2, 0.35); // C4
      break;
    case 'notify':
      marimba(c, out, t, 440, 0.2, 0.4);
      break;
    case 'win':
      marimba(c, out, t, 523.3, 0.2);
      marimba(c, out, t + 0.1, 659.3, 0.2);
      marimba(c, out, t + 0.2, 784, 0.22, 0.7);
      break;
  }
}

export function playSound(name: SoundName) {
  if (!useSettings.getState().sound) return;
  const a = audio();
  if (!a) return;
  renderSound(a.c, a.out, name, a.c.currentTime + 0.005);
}
