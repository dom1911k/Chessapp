// Soft, warm, wooden sound effects synthesised with Web Audio (no audio files).
//
// A piece landing on a wooden board is modelled as a few damped "modes":
// a low body thump plus inharmonic wood resonances that die away within a few
// tens of milliseconds, through a gentle low-pass so nothing sounds sharp.
// Chimes (success, check) use a soft marimba voice — also wood.
import { useSettings } from './settings';

export type SoundName = 'move' | 'capture' | 'check' | 'castle' | 'success' | 'error' | 'notify' | 'win' | 'brilliant' | 'reward';

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
      warm.frequency.value = 8000;
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

/** A physical model of a piece landing on a board: damped modes + a contact click + warmth. */
export interface SoundPack {
  label: string;
  description: string;
  /** [frequency Hz, amplitude, decay seconds]; the first mode is the "body". */
  modes: [number, number, number][];
  contact: { amp: number; freq: number };
  /** Low-pass cutoff — lower is softer/warmer. */
  warmth: number;
}

export const SOUND_PACKS: Record<string, SoundPack> = {
  wood: {
    label: 'Soft wood',
    description: 'Warm wooden pieces on a wooden board.',
    modes: [[150, 0.55, 0.022], [480, 0.42, 0.018], [1150, 0.16, 0.011], [2050, 0.05, 0.007]],
    contact: { amp: 0.18, freq: 2200 },
    warmth: 3400,
  },
  felt: {
    label: 'Felt',
    description: 'Felted pieces on a soft board — the quietest, most muted option.',
    modes: [[118, 0.7, 0.03], [330, 0.26, 0.016], [790, 0.05, 0.008]],
    contact: { amp: 0.05, freq: 900 },
    warmth: 1500,
  },
  deep: {
    label: 'Heavy wood',
    description: 'Weighted tournament pieces with a deep, round "thock".',
    modes: [[105, 0.56, 0.036], [290, 0.38, 0.026], [740, 0.13, 0.014], [1500, 0.04, 0.007]],
    contact: { amp: 0.12, freq: 1400 },
    warmth: 2600,
  },
  clack: {
    label: 'Club clack',
    description: 'Crisp plastic club pieces on a hard board.',
    modes: [[200, 0.34, 0.015], [700, 0.42, 0.014], [1650, 0.25, 0.009], [3100, 0.1, 0.005]],
    contact: { amp: 0.35, freq: 3200 },
    warmth: 6000,
  },
  marble: {
    label: 'Marble',
    description: 'Stone pieces with a short, bright ring.',
    modes: [[420, 0.33, 0.03], [1350, 0.33, 0.04], [2900, 0.16, 0.03], [4700, 0.05, 0.02]],
    contact: { amp: 0.22, freq: 4000 },
    warmth: 7000,
  },
  bamboo: {
    label: 'Bamboo',
    description: 'Hollow, woody knocks — like bamboo pieces on a mat.',
    modes: [[210, 0.4, 0.03], [620, 0.36, 0.028], [1480, 0.12, 0.012]],
    contact: { amp: 0.1, freq: 1800 },
    warmth: 3000,
  },
  crystal: {
    label: 'Crystal',
    description: 'Glass pieces with a soft, sparkling ring.',
    modes: [[880, 0.2, 0.05], [1760, 0.22, 0.07], [2640, 0.12, 0.06], [3960, 0.06, 0.04]],
    contact: { amp: 0.12, freq: 5000 },
    warmth: 9000,
  },
  minimal: {
    label: 'Minimal',
    description: 'A tiny, soft tick — barely there.',
    modes: [[880, 0.34, 0.012], [1760, 0.06, 0.006]],
    contact: { amp: 0, freq: 2000 },
    warmth: 4000,
  },
};

function currentPack(): SoundPack {
  return SOUND_PACKS[useSettings.getState().soundPack] ?? SOUND_PACKS.wood;
}

/** A piece set down on the board. `pitch` ~1, `weight` ~1 (heavier = more body). */
export function tockWith(c: BaseAudioContext, out: AudioNode, t: number, pitch = 1, gain = 1, weight = 1, pack = currentPack()) {
  const p = pitch * (0.97 + Math.random() * 0.06);
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = pack.warmth;
  f.Q.value = 0.5;
  f.connect(out);
  pack.modes.forEach(([freq, amp, decay], i) => mode(c, f, t, freq * p, amp * gain * (i === 0 ? weight : 1), i === 0 ? decay * weight : decay));
  if (pack.contact.amp) contact(c, f, t, pack.contact.amp * gain, pack.contact.freq * p);
}

/** A soft marimba note. */
export function marimba(c: BaseAudioContext, out: AudioNode, t: number, freq: number, gain = 0.3, length = 0.35) {
  mode(c, out, t, freq, gain, length / 3);
  mode(c, out, t, freq * 3.93, gain * 0.18, length / 12);
  mode(c, out, t, freq * 9.2, gain * 0.04, length / 30);
  contact(c, out, t, gain * 0.15, freq * 2);
}

/** Schedules the named sound on any (live or offline) audio context. */
export function renderSound(c: BaseAudioContext, out: AudioNode, name: SoundName, t: number, pack = currentPack()) {
  const tock = (c: BaseAudioContext, out: AudioNode, t: number, pitch = 1, gain = 1, weight = 1) => tockWith(c, out, t, pitch, gain, weight, pack);
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
    case 'brilliant':
      // A bright, rising arpeggio with a soft shimmer on top.
      [523.3, 659.3, 784, 1046.5].forEach((f, i) => marimba(c, out, t + i * 0.07, f, 0.2, i === 3 ? 0.8 : 0.35));
      marimba(c, out, t + 0.3, 2093, 0.05, 0.9);
      break;
    case 'reward':
      marimba(c, out, t, 784, 0.18, 0.3);
      marimba(c, out, t + 0.08, 1174.7, 0.16, 0.5);
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

/** Plays a short sample of a pack (move, move, capture, check) for the settings screen. */
export function previewPack(id: string) {
  const a = audio();
  const pack = SOUND_PACKS[id];
  if (!a || !pack) return;
  const t = a.c.currentTime + 0.02;
  renderSound(a.c, a.out, 'move', t, pack);
  renderSound(a.c, a.out, 'move', t + 0.45, pack);
  renderSound(a.c, a.out, 'capture', t + 0.9, pack);
  renderSound(a.c, a.out, 'check', t + 1.45, pack);
}
