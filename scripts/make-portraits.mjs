#!/usr/bin/env node
// Renders the character portraits (coach + opponents) in three moods from
// src/lib/people/looks.json with our own vector portrait renderer
// (scripts/portrait/render.mjs). Re-run after editing looks.json or the renderer.
import { mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderPortrait } from './portrait/render.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const looks = JSON.parse(readFileSync(join(root, 'src/lib/people/looks.json'), 'utf8'));
const out = join(root, 'src/assets/people');
mkdirSync(out, { recursive: true });
for (const f of readdirSync(out)) rmSync(join(out, f));
for (const [id, look] of Object.entries(looks))
  for (const mood of ['neutral', 'happy', 'worried']) writeFileSync(join(out, `${id}-${mood}.svg`), renderPortrait(look, mood));
console.log(`portraits written to ${out}`);
