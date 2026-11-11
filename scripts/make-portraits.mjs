#!/usr/bin/env node
// Renders the character portraits (coach + opponents, three moods) and the player's avatars
// from src/lib/people/looks.json and avatars.json. The illustrations are the "Avataaars" set by
// Pablo Stanley (free for personal and commercial use), assembled with DiceBear (MIT) — both are
// only used here, at build time; the app ships plain SVG files.
import { createAvatar } from '@dicebear/core';
import { avataaars } from '@dicebear/collection';
import { mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => JSON.parse(readFileSync(join(root, 'src/lib/people', f), 'utf8'));
const hex = (c) => c.replace('#', '');

const MOODS = {
  neutral: { eyes: 'default', eyebrows: 'defaultNatural', mouth: 'default' },
  happy: { eyes: 'happy', eyebrows: 'raisedExcitedNatural', mouth: 'smile' },
  worried: { eyes: 'surprised', eyebrows: 'sadConcernedNatural', mouth: 'concerned' },
};

function render(look, face, bg) {
  const one = (v) => (v ? [v] : undefined);
  return createAvatar(avataaars, {
    seed: 'x',
    top: one(look.top),
    hairColor: one(look.hairColor),
    hatColor: one(look.hatColor),
    skinColor: one(look.skinColor),
    accessories: one(look.accessories),
    accessoriesProbability: look.accessories ? 100 : 0,
    accessoriesColor: ['262e33'],
    facialHair: one(look.facialHair),
    facialHairProbability: look.facialHair ? 100 : 0,
    facialHairColor: one(look.facialHairColor),
    clothing: one(look.clothing),
    clothingGraphic: one(look.clothingGraphic),
    clothesColor: one(look.clothesColor),
    eyes: [face.eyes],
    eyebrows: [face.eyebrows],
    mouth: [face.mouth],
    backgroundColor: bg.map(hex),
    backgroundType: ['gradientLinear'],
    backgroundRotation: [140],
  }).toString();
}

function clean(dir) {
  mkdirSync(dir, { recursive: true });
  for (const f of readdirSync(dir)) rmSync(join(dir, f));
}

const people = join(root, 'src/assets/people');
clean(people);
for (const [id, look] of Object.entries(read('looks.json')))
  for (const mood of Object.keys(MOODS)) writeFileSync(join(people, `${id}-${mood}.svg`), render(look, { ...MOODS[mood], ...(look[mood] ?? {}) }, look.bg.colors));

const avatars = join(root, 'src/assets/avatars');
clean(avatars);
for (const [id, look] of Object.entries(read('avatars.json')))
  writeFileSync(join(avatars, `${id}.svg`), render(look, { eyes: look.eyes ?? 'default', eyebrows: look.eyebrows ?? 'defaultNatural', mouth: look.mouth ?? 'smile' }, look.bg));
console.log('portraits and avatars written');
