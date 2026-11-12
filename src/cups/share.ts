// The chronicle as a picture: drawn on a canvas in the Cups look, then handed to the share sheet
// (Android) or downloaded (browser).
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { Chronicle } from './story';

function wrap(g: CanvasRenderingContext2D, text: string, max: number): string[] {
  const words = text.split(' ');
  const out: string[] = [];
  let line = '';
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (g.measureText(t).width > max && line) {
      out.push(line);
      line = w;
    } else line = t;
  }
  if (line) out.push(line);
  return out;
}

/** Draw the chronicle card (1080 px wide) and return it as a PNG data URL. */
export function chronicleImage(ch: Chronicle): string {
  const W = 1080;
  const pad = 72;
  const c = document.createElement('canvas');
  const g = c.getContext('2d')!;
  g.font = '36px Georgia, serif';
  const body = ch.lines.flatMap((l) => [...wrap(g, l, W - pad * 2), '']);
  const H = 360 + body.length * 46 + 220;
  c.width = W;
  c.height = H;
  const bg = g.createLinearGradient(0, 0, W * 0.4, H);
  bg.addColorStop(0, '#10261d');
  bg.addColorStop(1, '#1d1033');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  g.strokeStyle = '#f2c75c';
  g.lineWidth = 6;
  g.strokeRect(24, 24, W - 48, H - 48);
  g.fillStyle = '#a99f8c';
  g.font = 'bold 30px Georgia, serif';
  g.fillText('CHESS COACH · CUPS', pad, 120);
  g.fillStyle = '#ffe7a3';
  g.font = 'bold 64px Georgia, serif';
  g.fillText(ch.title, pad, 205);
  g.fillStyle = '#a99f8c';
  g.font = '32px Georgia, serif';
  g.fillText(ch.subtitle, pad, 258);
  g.fillStyle = '#eadfc8';
  g.font = '36px Georgia, serif';
  let y = 340;
  for (const l of body) {
    g.fillText(l, pad, y);
    y += 46;
  }
  const cols = 4;
  const cw = (W - pad * 2) / cols;
  ch.stats.slice(0, 8).forEach((s, i) => {
    const x = pad + (i % cols) * cw;
    const yy = y + 40 + Math.floor(i / cols) * 100;
    g.fillStyle = '#a99f8c';
    g.font = 'bold 24px Georgia, serif';
    g.fillText(s.label.toUpperCase(), x, yy);
    g.fillStyle = '#ffe7a3';
    g.font = 'bold 44px Georgia, serif';
    g.fillText(s.value, x, yy + 48);
  });
  return c.toDataURL('image/png');
}

export async function shareChronicle(ch: Chronicle): Promise<void> {
  const url = chronicleImage(ch);
  const name = `cup-chronicle-${Date.now()}.png`;
  if (Capacitor.isNativePlatform()) {
    const res = await Filesystem.writeFile({ path: name, data: url.split(',')[1], directory: Directory.Cache });
    await Share.share({ title: ch.title, text: ch.title, url: res.uri, dialogTitle: ch.title });
  } else {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
  }
}
