// Character portraits (bundled images). Kept apart from the character data so that data also
// loads outside the app (the benchmark scripts run it under Node).
import type { Mood } from './index';

const urls = import.meta.glob('../../assets/people/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export function portrait(id: string, mood: Mood = 'neutral'): string {
  return urls[`../../assets/people/${id}-${mood}.webp`] ?? urls[`../../assets/people/${id}-neutral.webp`] ?? '';
}
