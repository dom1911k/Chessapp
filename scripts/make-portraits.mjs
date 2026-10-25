#!/usr/bin/env node
// Generates the character portraits (coach + opponents) in three moods from
// src/lib/people/looks.json, using the "Avataaars" style by Pablo Stanley
// (free for personal and commercial use) via DiceBear. Re-run after editing looks.
import { createAvatar } from '@dicebear/core';
import { avataaars } from '@dicebear/collection';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const looks = JSON.parse(readFileSync(join(root, 'src/lib/people/looks.json'), 'utf8'));
const out = join(root, 'src/assets/people');
mkdirSync(out, { recursive: true });

const MOODS = {
  neutral: { eyes: ['default'], eyebrows: ['defaultNatural'], mouth: ['smile'] },
  happy: { eyes: ['happy'], eyebrows: ['raisedExcitedNatural'], mouth: ['twinkle'] },
  worried: { eyes: ['default'], eyebrows: ['sadConcernedNatural'], mouth: ['serious'] },
};

for (const [id, l] of Object.entries(looks)) {
  for (const [mood, face] of Object.entries(MOODS)) {
    const opts = {
      seed: id,
      top: [l.top],
      hairColor: [l.hairColor],
      skinColor: [l.skinColor],
      clothing: [l.clothing],
      clothesColor: [l.clothesColor],
      clothingGraphic: l.clothingGraphic ? [l.clothingGraphic] : undefined,
      accessories: l.accessories ? [l.accessories] : undefined,
      accessoriesColor: l.accessoriesColor ? [l.accessoriesColor] : undefined,
      accessoriesProbability: l.accessories ? 100 : 0,
      facialHair: l.facialHair ? [l.facialHair] : undefined,
      facialHairColor: l.facialHairColor ? [l.facialHairColor] : undefined,
      facialHairProbability: l.facialHair ? 100 : 0,
      backgroundColor: [l.backgroundColor],
      style: ['circle'],
      ...face,
    };
    writeFileSync(join(out, `${id}-${mood}.svg`), createAvatar(avataaars, opts).toString());
  }
}
console.log(`portraits written to ${out}`);
