import { describe, expect, it } from 'vitest';
import { hadProgress, legacyLaurels } from '../cups/legacy';
import { momentCard } from '../cups/bridge';
import { TUNING } from '../cups/tuning';

describe('cups: old Run mode migration', () => {
  it('turns any old progress into a flat Laurel balance', () => {
    expect(legacyLaurels(undefined, 0)).toBe(0);
    expect(legacyLaurels({ embers: 0, unlocked: [], materials: { stone: 0 } }, 0)).toBe(0);
    expect(legacyLaurels({ embers: 120 }, 0)).toBe(TUNING.legacyLaurels);
    expect(legacyLaurels({ materials: { stone: 3 } }, 0)).toBe(TUNING.legacyLaurels);
    expect(legacyLaurels({ unlocked: ['board:ash'] }, 0)).toBe(TUNING.legacyLaurels);
    expect(legacyLaurels(undefined, 4)).toBe(TUNING.legacyLaurels);
    expect(hadProgress({ runs: 2 }, 0)).toBe(true);
    expect(TUNING.legacyLaurels).toBe(3);
  });
});

describe('cups: reviews bridge', () => {
  const m = { fenBefore: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', playedUci: 'f2f3', playedSan: 'f3', bestUci: 'e2e4', themes: ['kingSafety'], explanation: ['Weakens the king.'] };
  it('makes a review card for a move with a better alternative', () => {
    const c = momentCard('c1', 0, m, 1000)!;
    expect(c).toMatchObject({ id: 'm:cup-c1:0', kind: 'mistake', solution: ['e2e4'], playedUci: 'f2f3', label: 'From a cup', themes: ['kingSafety'] });
    expect(momentCard('c1', 0, { ...m, bestUci: 'f2f3' })).toBeNull();
    expect(momentCard('c1', 0, { ...m, bestUci: undefined })).toBeNull();
  });
});

import { OPPONENTS } from '../lib/people';
import { TIERS, YOU, advances, cupXp, defaultColor, pickField, rng, roundRating, seedBracket, simulateRound, tierInfo, tierOpen, winChance } from '../cups/ladder';
import { applyResult, champion, currentRound, cupMoves, newCup, opponentRating, yourColor, yourOpponent, type RoundRecord } from '../cups/cup';
import { newCupGame, pressCupClock, toSavedGame } from '../cups/game';
import { material } from '../cups/material';

describe('cups: ladder', () => {
  it('has five tiers in tight 200-point bands', () => {
    expect(TIERS).toEqual(['bronze', 'silver', 'gold', 'platinum', 'diamond']);
    expect(TIERS.map((t) => tierInfo(t).band)).toEqual([[400, 600], [600, 800], [800, 1000], [1000, 1200], [1200, 1400]]);
  });
  it('raises the opponent gently through the band, the final strongest', () => {
    expect([0, 1, 2].map((r) => roundRating('gold', r))).toEqual([800, 900, 1000]);
    expect(roundRating('bronze', 0)).toBe(400);
  });
  it('picks seven different characters with seed ratings inside the band', () => {
    for (const seed of [1, 2, 3, 99]) {
      const { field, ratings } = pickField('silver', seed);
      expect(new Set(field).size).toBe(7);
      for (const id of field) expect(OPPONENTS.some((o) => o.id === id)).toBe(true);
      expect(Object.values(ratings).every((r) => r >= 600 && r <= 800)).toBe(true);
      expect(ratings[field[0]]).toBe(600);
      expect(ratings[field[6]]).toBe(800);
    }
    const b = seedBracket(pickField('gold', 5).field);
    expect(b[0]).toBe(YOU);
    expect(b.length).toBe(8);
  });
  it('a win advances; a draw advances with Black or with Draw Odds', () => {
    expect(advances('win', 'w')).toBe(true);
    expect(advances('draw', 'w')).toBe(false);
    expect(advances('draw', 'b')).toBe(true);
    expect(advances('draw', 'w', true)).toBe(true);
    expect(advances('loss', 'b', true)).toBe(false);
    expect(defaultColor(0, 4)).toBe('w');
    expect(defaultColor(1, 4)).toBe('b');
  });
  it('carries old trophies over and opens the next tier', () => {
    expect(tierOpen('bronze', {})).toBe(true);
    expect(tierOpen('silver', {})).toBe(false);
    expect(tierOpen('silver', { bronze: 1 })).toBe(true);
    expect(tierOpen('platinum', { gold: 2 })).toBe(true);
    expect(tierOpen('diamond', { gold: 2 })).toBe(false);
    // An old Gold Cup win also opens everything below it.
    expect(tierOpen('silver', { gold: 1 })).toBe(true);
    expect(cupXp('bronze', 'winner')).toBe(80);
    expect(cupXp('diamond', 'quarter')).toBe(0);
    expect(winChance(1400, 400)).toBeGreaterThan(0.99);
  });
  it('simulates only the bots’ matches', () => {
    const c = newCup('bronze', 7, 0);
    const sims = simulateRound(c.rounds[0], c.ratings, c.seed, 0);
    expect(sims.length).toBe(3);
    expect(sims.every((m) => m.a !== YOU && m.b !== YOU && (m.winner === m.a || m.winner === m.b))).toBe(true);
    expect(simulateRound(c.rounds[0], c.ratings, c.seed, 0)).toEqual(sims);
  });
});

describe('cups: a cup from start to finish', () => {
  const rec = (c: ReturnType<typeof newCup>, result: 'win' | 'loss' | 'draw') => ({ opponentId: yourOpponent(c)!, elo: opponentRating(c), color: yourColor(c), result, reason: 'checkmate', moves: 25 });
  it('three wins lift the cup', () => {
    let c = newCup('gold', 42, 0);
    expect(yourOpponent(c)).toBe(c.field[0]);
    c = applyResult(c, rec(c, 'win'));
    expect(currentRound(c)).toBe(1);
    expect(yourColor(c)).toBe('b');
    c = applyResult(c, rec(c, 'draw'));
    expect(currentRound(c)).toBe(2);
    c = applyResult(c, rec(c, 'win'));
    expect(c.place).toBe('winner');
    expect(champion(c)).toBe(YOU);
    expect(cupMoves(c)).toBe(75);
    expect(c.sims.length).toBe(3);
  });
  it('a loss ends it and the bots finish the bracket', () => {
    let c = newCup('silver', 9, 0);
    c = applyResult(c, rec(c, 'loss'));
    expect(c.place).toBe('quarter');
    expect(champion(c)).toBeTruthy();
    expect(champion(c)).not.toBe(YOU);
    expect(yourOpponent(c)).toBeNull();
    let d = newCup('silver', 9, 0);
    d = applyResult(d, rec(d, 'win'));
    d = applyResult(d, { ...rec(d, 'draw'), color: 'w' });
    expect(d.place).toBe('semi');
  });
});

describe('cups: game clock and records', () => {
  const g = newCupGame({ cupId: 'c', tier: 'gold', round: 0, opponentId: 'tom', elo: 800, userColor: 'w', timeControl: '600+0', extraMs: { w: 60_000 }, extraInc: { w: 2000 }, freeMoves: 2 }, 0);
  it('gives each side its own time and increment', () => {
    expect(g.clock).toEqual({ w: 660_000, b: 600_000, turnStart: 0 });
    expect(g.inc).toEqual({ w: 2000, b: 0 });
  });
  it('charges the mover, skips free moves, adds the increment', () => {
    let r = pressCupClock(g, 'w', 5000);
    expect(r.clock.w).toBe(662_000);
    expect(r.freeMoves).toBe(1);
    r = pressCupClock({ ...g, freeMoves: 0 }, 'w', 5000);
    expect(r.clock.w).toBe(657_000);
    r = pressCupClock(g, 'b', 5000);
    expect(r.clock.b).toBe(595_000);
  });
  it('is recorded as a Match-conditions game tagged with the cup', () => {
    const s = toSavedGame({ ...g, rewinds: 1 });
    expect(s).toMatchObject({ match: true, opponentId: 'tom', elo: 800, takebacks: 1, hintsUsed: 0, cup: { id: 'c', tier: 'gold', round: 0 } });
  });
  it('counts captured pieces and the material lead', () => {
    expect(material('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toEqual({ lost: { w: [], b: [] }, diff: 0 });
    expect(material('rnb1kbnr/pppp1ppp/8/8/8/8/PPPPPPPP/RNBQKB1R w KQkq - 0 1')).toEqual({ lost: { w: ['n'], b: ['p', 'q'] }, diff: 7 });
  });
});

import { ALL_BOONS, ALL_CHARMS, BOONS, CHARMS, boonOffer, canHoldCharm, boonPool, charmPool, charmPrice, gameStartMods, goldFor, shopOffer, type BoonId } from '../cups/boons';
import { applySecondChance, secondChanceApplies } from '../cups/cup';
import { battlefieldOptions, battlefieldPool } from '../cups/battlefield';
import { Chess } from 'chess.js';

describe('cups: boons and charms', () => {
  it('starts with six boons and four charms; the rest are Laurel-shop unlocks', () => {
    expect(boonPool([]).sort()).toEqual(['extraMinute', 'openingPrep', 'rattled', 'scoutReport', 'secondWind', 'steadyHand'].sort());
    expect(charmPool([]).sort()).toEqual(['candidates', 'colour', 'rewind', 'threatBell'].sort());
    expect(boonPool(['drawOdds', 'homePrep'])).toContain('drawOdds');
    expect(charmPool(['battlefield'])).toContain('battlefield');
    expect(ALL_BOONS.length).toBe(10);
    expect(ALL_CHARMS.length).toBe(5);
    for (const b of ALL_BOONS) expect(BOONS[b].text.length).toBeGreaterThan(20);
    for (const c of ALL_CHARMS) expect(charmPrice(c)).toBeGreaterThan(0);
    expect(charmPrice('rewind')).toBe(10);
    expect(charmPrice('rewind', { rewind: 2 })).toBe(8);
    expect(charmPrice('rewind', { rewind: 3 })).toBe(6);
    expect(canHoldCharm([], 'rewind')).toBe(true);
    expect(canHoldCharm(['rewind'], 'rewind')).toBe(false);
    expect(canHoldCharm(['threatBell'], 'threatBell')).toBe(true);
    expect(CHARMS.colour.pregame).toBe(true);
  });
  it('offers three boons you do not have', () => {
    let i = 0;
    const r = () => ((i++ * 0.37) % 1);
    const o = boonOffer(['extraMinute'], [], r);
    expect(o.length).toBe(3);
    expect(new Set(o).size).toBe(3);
    expect(o).not.toContain('extraMinute');
    expect(boonOffer(boonPool([]), [], Math.random)).toEqual([]);
    expect(new Set(shopOffer([], Math.random)).size).toBe(3);
  });
  it('pays gold for a win, accuracy above the floor and great moves', () => {
    expect(goldFor({ userResult: 'win', advanced: true, accuracy: 80, greats: 1 })).toEqual({ parts: [{ label: 'Win', amount: 4 }, { label: 'Accuracy 80%', amount: 5 }, { label: '1 great move', amount: 2 }], total: 11 });
    expect(goldFor({ userResult: 'draw', advanced: true, accuracy: 50, greats: 0 }).total).toBe(3);
    expect(goldFor({ userResult: 'loss', advanced: false, accuracy: 50, greats: 0 }).total).toBe(0);
  });
  it('turns time boons into clock settings for your colour only', () => {
    expect(gameStartMods(['extraMinute', 'steadyHand', 'openingPrep'], 'b')).toEqual({ extraMs: { b: 40_000 }, extraInc: { b: 1_000 }, freeMoves: 5 });
    expect(gameStartMods(['extraMinute', 'steadyHand', 'openingPrep'], 'b', { extraMinute: 2, steadyHand: 2, openingPrep: 2 })).toEqual({ extraMs: { b: 60_000 }, extraInc: { b: 2_000 }, freeMoves: 8 });
    expect(gameStartMods(['extraMinute', 'steadyHand', 'openingPrep'], 'w', { extraMinute: 3, steadyHand: 3, openingPrep: 3 })).toEqual({ extraMs: { w: 90_000 }, extraInc: { w: 3_000 }, freeMoves: 12 });
    expect(gameStartMods([], 'w')).toEqual({ extraMs: {}, extraInc: {}, freeMoves: 0 });
  });
  it('Second Chance replays a knockout once, colours swapped; Long Night weakens the finalist', () => {
    let c: ReturnType<typeof newCup> = { ...newCup('gold', 3, 0), boons: ['secondChance'], nextStart: { fen: 'x', sans: ['e4'], name: 'Battlefield' } };
    const rec = { opponentId: yourOpponent(c)!, elo: 800, color: 'w' as const, result: 'loss' as const, reason: 'time', moves: 30 };
    expect(secondChanceApplies(c, 'loss', 'w')).toBe(true);
    expect(secondChanceApplies(c, 'draw', 'b')).toBe(false);
    c = applySecondChance(c, rec);
    expect(currentRound(c)).toBe(0);
    expect(yourColor(c)).toBe('b');
    expect(c.yours[0].replayed).toBe(true);
    expect(c.nextStart).toBeUndefined();
    expect(secondChanceApplies(c, 'loss', 'b')).toBe(false);
    let d = newCup('gold', 3, 0);
    d = applyResult(d, { ...rec, result: 'win' });
    d = applyResult(d, { ...rec, color: 'b', result: 'win', opponentId: yourOpponent(d)! });
    expect(opponentRating(d)).toBe(1000);
    expect(opponentRating({ ...d, boons: ['longNight'] })).toBe(970);
    expect(opponentRating({ ...d, boons: ['longNight'], levels: { longNight: 2 } })).toBe(950);
    expect(opponentRating({ ...d, boons: ['longNight'], levels: { longNight: 3 } })).toBe(920);
    // Second Chance I can't save a final; II can, III adds a minute to the replay.
    expect(secondChanceApplies({ ...d, boons: ['secondChance'] }, 'loss', 'w')).toBe(false);
    expect(secondChanceApplies({ ...d, boons: ['secondChance'], levels: { secondChance: 2 } }, 'loss', 'w')).toBe(true);
    expect(applySecondChance({ ...d, boons: ['secondChance'], levels: { secondChance: 3 } }, rec).nextExtraMs).toBe(60_000);
  });
  it('Battlefield offers three different book positions 4–8 half-moves in', () => {
    const pool = battlefieldPool();
    expect(pool.length).toBeGreaterThan(10);
    for (const p of pool) {
      expect(p.sans.length).toBeGreaterThanOrEqual(4);
      expect(p.sans.length).toBeLessThanOrEqual(8);
      expect(() => new Chess(p.fen)).not.toThrow();
    }
    const o = battlefieldOptions(Math.random);
    expect(new Set(o.map((x) => x.fen)).size).toBe(3);
  });
});

import { QUIRKS, QUIRK_IDS, assignQuirks, hiddenQuirk, lineMove, quirkById, quirkEffects, type QuirkCtx } from '../cups/quirks';
import { botMods, quirkOpening } from '../cups/mods';

describe('cups: opponent quirks', () => {
  const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const after = (sans: string) => { const c = new Chess(); for (const m of sans.split(' ').filter(Boolean)) c.move(m); return c.fen(); };
  const ctx = (o: Partial<QuirkCtx> = {}): QuirkCtx => ({ fen: START, sans: [], moveNo: 1, bot: 'w', me: 'b', botLeftMs: 600_000, state: {}, fromStart: true, ...o });
  const move = (fen: string, san: string) => new Chess(fen).move(san);
  it('has the fourteen quirks, each with an icon and one plain sentence', () => {
    expect(QUIRK_IDS.sort()).toEqual(['comebackKid', 'copycat', 'earlyQueen', 'endgameGrinder', 'gambiteer', 'pawnGrabber', 'pawnStormer', 'slowStarter', 'speedster', 'tilter', 'timeTrouble', 'trapper', 'turtle', 'uncastled'].sort());
    for (const q of QUIRKS) {
      expect(q.text.length).toBeGreaterThan(15);
      expect(q.glyph).toBeTruthy();
      expect(q.act.startsWith(q.name)).toBe(true);
    }
  });
  it('never repeats a quirk in a cup and avoids recent ones', () => {
    const field = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const recent = ['speedster', 'turtle', 'copycat', 'tilter', 'gambiteer', 'trapper'];
    const q = assignQuirks(field, recent, rng(5));
    expect(new Set(Object.values(q)).size).toBe(7);
    expect(Object.values(q).some((x) => recent.includes(x))).toBe(false);
    const h = hiddenQuirk(Object.values(q), recent, rng(2));
    expect(Object.values(q)).not.toContain(h);
    expect(recent).not.toContain(h);
  });
  it('time quirks change think time and temperature only', () => {
    expect(quirkEffects(['speedster'], ctx()).think).toBe(0.45);
    expect(quirkEffects(['speedster'], ctx()).temp).toBeCloseTo(0.15);
    expect(quirkEffects(['timeTrouble'], ctx({ moveNo: 5 })).think).toBe(2.6);
    expect(quirkEffects(['timeTrouble'], ctx({ moveNo: 20 })).think).toBe(1);
    expect(quirkEffects(['timeTrouble'], ctx({ moveNo: 30, botLeftMs: 40_000 })).temp).toBeCloseTo(TUNING.quirks.timeTrouble.lowTemp);
    expect(quirkEffects(['slowStarter'], ctx({ moveNo: 3 })).temp).toBeCloseTo(TUNING.quirks.slowStarter.temp);
    expect(quirkEffects(['slowStarter'], ctx({ moveNo: 13 })).temp).toBe(0);
    expect(quirkEffects(['comebackKid'], ctx({ botEval: -200 })).temp).toBeCloseTo(TUNING.quirks.comebackKid.temp);
    expect(quirkEffects(['comebackKid'], ctx({ botEval: 50 })).temp).toBe(0);
    expect(quirkEffects(['tilter'], ctx({ state: { tilt: 3 } })).temp).toBeCloseTo(TUNING.quirks.tilter.temp);
    expect(quirkById('tilter')!.afterUserMove!(ctx(), 3)).toEqual({ tilt: 6 });
  });
  it('opening quirks pick real book lines: gambits, traps, an early queen', () => {
    const r = () => 0;
    expect(quirkById('gambiteer')!.opening!(ctx({ fen: after('e4 e5'), sans: ['e4', 'e5'], moveNo: 2 }), r)).toBe('f2f4');
    expect(quirkById('gambiteer')!.opening!(ctx({ fen: after('d4'), sans: ['d4'], bot: 'b', me: 'w' }), r)).toBe('e7e5');
    expect(quirkById('earlyQueen')!.opening!(ctx({ fen: after('e4 e5'), sans: ['e4', 'e5'], moveNo: 2 }), r)).toBe('d1h5');
    const trap = quirkById('trapper')!.opening!(ctx({ fen: after('e4 e5'), sans: ['e4', 'e5'], moveNo: 2 }), r);
    expect(trap).toBeTruthy();
    expect(quirkById('gambiteer')!.opening!(ctx({ fromStart: false, sans: ['e4', 'e5'], fen: after('e4 e5') }), r)).toBeNull();
    expect(lineMove([['e4', 'e5', 'Ke2']], ['e4', 'e5'], after('e4 e5'), r)).toBe('e1e2');
    expect(lineMove([['e4', 'c5']], ['e4', 'e5'], after('e4 e5'), r)).toBeNull();
  });
  it('style quirks re-weight Maia’s moves, never adding new ones', () => {
    const f1 = after('e4 d5');
    expect(quirkEffects(['pawnGrabber'], ctx({ fen: f1, moveNo: 2 })).weight(move(f1, 'exd5'))).toBe(4);
    expect(quirkEffects(['earlyQueen'], ctx({ fen: after('e4 e5'), moveNo: 2 })).weight(move(after('e4 e5'), 'Qh5'))).toBe(5);
    const fc = after('e4 e5 Nf3 Nc6 Bc4 Bc5');
    expect(quirkEffects(['uncastled'], ctx({ fen: fc, moveNo: 4 })).weight(move(fc, 'O-O'))).toBeCloseTo(0.03);
    const fm = after('e4');
    expect(quirkEffects(['copycat'], ctx({ fen: fm, bot: 'b', me: 'w', lastUserUci: 'e2e4' })).weight(move(fm, 'e5'))).toBe(TUNING.quirks.copycat.weight);
    const ft = after('e4 e5 Nf3 Nc6 Bb5 a6');
    expect(quirkEffects(['turtle'], ctx({ fen: ft, moveNo: 4 })).weight(move(ft, 'Bxc6'))).toBeCloseTo(2.2);
    expect(quirkEffects(['endgameGrinder'], ctx({ fen: ft, moveNo: 4, botEval: 20 })).weight(move(ft, 'Bxc6'))).toBe(2.5);
    for (const q of QUIRKS) {
      const e = quirkEffects([q.id], ctx({ fen: ft, moveNo: 4, botEval: 0, lastUserUci: 'a7a6' }));
      for (const m of new Chess(ft).moves({ verbose: true })) expect(e.weight(m)).toBeGreaterThan(0);
    }
  });
  it('combines quirks with Rattled into the opponent’s settings', () => {
    const g = { ...newCupGame({ cupId: 'c', tier: 'gold', round: 2, opponentId: 'tom', elo: 900, userColor: 'b', timeControl: '600+0', boons: ['rattled'], quirks: ['speedster'], hidden: 'slowStarter' }, 0), rattled: 2 };
    const m = botMods(g, ctx());
    expect(m.thinkFactor).toBe(0.45);
    expect(m.tempDelta).toBeCloseTo(0.15 + TUNING.quirks.slowStarter.temp + TUNING.boons.rattledTemp[0]);
    expect(botMods({ ...g, levels: { rattled: 3 } }, ctx()).tempDelta).toBeCloseTo(0.15 + TUNING.quirks.slowStarter.temp + TUNING.boons.rattledTemp[2]);
    expect(quirkOpening({ ...g, quirks: ['gambiteer'], hidden: undefined }, ctx({ fen: after('e4 e5'), sans: ['e4', 'e5'] }), () => 0)).toEqual({ uci: 'f2f4', quirk: 'gambiteer' });
  });
});

import { chatter, chronicle, credit, cupMemory, gameLine, rivalLine } from '../cups/story';
import { decisiveMoment } from '../cups/game';
import { summarize } from '../cups/cup';

describe('cups: the story', () => {
  const noPronouns = (l: string) => expect(/\b(he|she|him|her|his|hers)\b/i.test(l), l).toBe(false);
  const finished = () => {
    let c = newCup('silver', 11, 1000);
    const rec = (result: 'win' | 'loss' | 'draw', extra = {}) => ({ opponentId: yourOpponent(c)!, elo: opponentRating(c), color: yourColor(c), result, reason: 'checkmate', moves: 22, accuracy: 80, opening: 'Italian Game', ...extra });
    c = applyResult(c, rec('win'));
    c = applyResult(c, rec('draw', { reason: 'repetition' }));
    c = applyResult(c, rec('win', { reason: 'time', clockLeft: 4, events: [{ ply: 30, kind: 'boon', id: 'secondWind', text: 'Second Wind: +30 s' }] }), { now: 2000 });
    return { ...c, boons: ['secondWind' as const] };
  };
  it('chats about the other matches and the road ahead, naming characters without pronouns', () => {
    const c = finished();
    for (let r = 0; r < 3; r++) {
      const lines = chatter(c, r);
      expect(lines.length).toBeGreaterThanOrEqual(1);
      expect(lines.length).toBeLessThanOrEqual(2);
      lines.forEach(noPronouns);
    }
    expect(chatter(c, 2).join(' ')).toMatch(/cup is yours/);
  });
  it('rivals remember cups and results', () => {
    const h = [{ id: 'x', tier: 'silver', place: 'semi' as const, endedAt: 5, moves: 40, charmsUsed: 0, secondChance: false, eliminatedBy: 'tom', beaten: ['lily'] }];
    expect(cupMemory(h, 'lily')).toEqual({ youKnockedOut: 'silver' });
    expect(cupMemory(h, 'tom')).toEqual({ theyKnockedYouOut: 'silver' });
    expect(cupMemory(h, 'mei')).toEqual({});
    expect(rivalLine({ youKnockedOut: 'silver' }, () => 0)).toBe('You knocked me out of the Silver Cup. Not this time.');
    expect(rivalLine({ theyKnockedYouOut: 'gold' }, () => 0)).toMatch(/Gold Cup/);
    expect(rivalLine({ record: { w: 3, l: 1, d: 0, stars: 0, bestAccuracy: 0 } }, () => 0)).toMatch(/beaten me 3 times/);
    expect(rivalLine({ record: { w: 0, l: 2, d: 0, stars: 0, bestAccuracy: 0 } }, () => 0)).toMatch(/won 2 of our 2/);
    expect(rivalLine({})).toBeNull();
  });
  it('credits the boon or charm that made a visible difference', () => {
    const base = { round: 2, opponentId: 'tom', elo: 800, color: 'w' as const, moves: 30, advanced: true };
    expect(credit({ ...base, result: 'win', reason: 'time', clockLeft: 4 }, ['extraMinute'])).toBe('Extra Minute');
    expect(credit({ ...base, result: 'draw', reason: 'repetition' }, ['drawOdds'])).toBe('Draw Odds');
    expect(credit({ ...base, result: 'win', reason: 'checkmate', events: [{ ply: 5, kind: 'charm', id: 'threatBell', text: 'Threat Bell rang: …' }] }, [])).toBe('Threat Bell');
    expect(credit({ ...base, result: 'win', reason: 'checkmate' }, [])).toBeNull();
  });
  it('writes one line per game from what happened, and highlight stats', () => {
    const c = finished();
    const ch = chronicle(c, 'Dom');
    expect(ch.lines.length).toBe(3);
    expect(ch.lines[0]).toMatch(/^Quarter-final: checkmated .+ in 22 moves in the Italian Game\.$/);
    expect(ch.lines[1]).toMatch(/drew with .+ and went through/);
    expect(ch.lines[2]).toBe(`Final: won on time against ${OPPONENTS.find((o) => o.id === c.yours[2].opponentId)!.name} with 4 seconds left in the Italian Game, thanks to Second Wind.`);
    ch.lines.forEach(noPronouns);
    expect(ch.title).toBe('Silver Cup · Champion');
    expect(ch.stats.find((s) => s.label === 'Games')!.value).toBe('3');
    expect(gameLine({ round: 0, opponentId: 'tom', elo: 400, color: 'w', result: 'loss', reason: 'resignation', moves: 18, advanced: false, decisive: { who: 'you', san: 'Qxb7', moveNo: 12, kind: 'blunder' } }, [])).toMatch(/12\.Qxb7 was the turning point/);
    expect(summarize(c)).toMatchObject({ tier: 'silver', place: 'winner', moves: 66, beaten: c.yours.map((r) => r.opponentId) });
  });
  it('finds the decisive moment', () => {
    const cp = (v: number) => ({ type: 'cp' as const, value: v });
    const p = (isUser: boolean, san: string, ev: number, extra = {}) => ({ uci: 'e2e4', san, color: (isUser ? 'w' : 'b') as 'w' | 'b', fenBefore: '', fenAfter: '', isUser, evalAfter: cp(ev), ...extra });
    const plies = [p(true, 'e4', 30), p(false, 'f6', 40), p(true, 'Nf3', 40), p(false, 'g5', 900), p(true, 'Qh5', 10000)];
    expect(decisiveMoment(plies, 'w', 'win')).toEqual({ who: 'them', san: 'g5', moveNo: 2, kind: 'blunder' });
    const lost = [p(true, 'e4', 30), p(false, 'e5', 30), p(true, 'Qh5', -400, { wpLoss: 35, classification: 'blunder' })];
    expect(decisiveMoment(lost, 'w', 'loss')).toEqual({ who: 'you', san: 'Qh5', moveNo: 2, kind: 'blunder' });
  });
});

import { LAUREL_SHOP, boardOwned, cabinet, canBuy, laurelsFor, piecesOwned, shopItem } from '../cups/laurels';
import { sponsorOffers } from '../cups/sponsors';
import { FRAMES, TITLES } from '../lib/avatars';
import { meets } from '../lib/rewards/cosmetics';

describe('cups: Laurels, the Laurel shop and the trophy cabinet', () => {
  it('pays Laurels by finish: semi 1, final 2, win 3, quarter 0', () => {
    expect((['quarter', 'semi', 'final', 'winner'] as const).map(laurelsFor)).toEqual([0, 1, 2, 3]);
  });
  it('sells the four boon unlocks, Battlefield, 5 pixel skins and a frame per tier at 2–6 Laurels', () => {
    expect(LAUREL_SHOP.filter((i) => i.kind === 'boon').map((i) => i.id).sort()).toEqual(['drawOdds', 'homePrep', 'longNight', 'secondChance']);
    expect(LAUREL_SHOP.filter((i) => i.kind === 'charm').map((i) => i.id)).toEqual(['battlefield']);
    expect(LAUREL_SHOP.filter((i) => i.kind === 'board' || i.kind === 'pieces').length).toBe(5);
    expect(LAUREL_SHOP.filter((i) => i.kind === 'frame').length).toBe(5);
    for (const i of LAUREL_SHOP) {
      expect(i.price).toBeGreaterThanOrEqual(2);
      expect(i.price).toBeLessThanOrEqual(6);
    }
    // Unlocked boons and charms join the random offers.
    expect(boonPool(['drawOdds'])).toContain('drawOdds');
  });
  it('checks price, ownership and the tier trophy for frames', () => {
    const frame = shopItem('frame:gold')!;
    expect(canBuy(frame, 10, [], {})).toEqual({ ok: false, why: 'Win the Gold Cup first' });
    expect(canBuy(frame, 10, [], { gold: 1 })).toEqual({ ok: true });
    expect(canBuy(shopItem('secondChance')!, 3, [], {})).toEqual({ ok: false, why: '6 Laurels' });
    expect(canBuy(shopItem('homePrep')!, 9, ['homePrep'], {})).toEqual({ ok: false, why: 'Owned' });
    expect(shopItem('homePrep')!.price).toBe(2);
    expect(boardOwned([], 'crypt')).toBe(true);
    expect(boardOwned([], 'frost')).toBe(false);
    expect(boardOwned(['board:frost'], 'frost')).toBe(true);
    expect(piecesOwned([], 'board')).toBe(true);
    expect(piecesOwned(['pieces:runic'], 'runic')).toBe(true);
  });
  it('tier frames unlock through the shop and titles through cup wins', () => {
    const f = FRAMES.find((x) => x.id === 'tier-platinum')!;
    const ctx = { level: 1, peak: 800, achievements: {}, challenges: new Set<string>(), gold: 0 };
    expect(meets(f.unlock, ctx)).toBe(false);
    expect(meets(f.unlock, { ...ctx, laurel: ['frame:platinum'] })).toBe(true);
    expect(TITLES.some((t) => t.label === 'Diamond Champion')).toBe(true);
  });
  it('fills the trophy cabinet from finished cups and old trophies', () => {
    const h = (o: object) => ({ id: Math.random().toString(), tier: 'bronze', place: 'winner' as const, endedAt: 1, moves: 80, charmsUsed: 1, secondChance: false, beaten: [], ...o });
    const rows = cabinet([h({ moves: 70 }), h({ moves: 95, charmsUsed: 0 }), h({ place: 'semi', tier: 'silver' }), h({ tier: 'silver', secondChance: true })], { bronze: 3, gold: 1 });
    expect(rows.find((r) => r.tier === 'bronze')).toEqual({ tier: 'bronze', won: 3, best: 'winner', fastest: 70, noCharms: true, secondChance: false });
    expect(rows.find((r) => r.tier === 'silver')).toMatchObject({ won: 1, best: 'winner', secondChance: true });
    expect(rows.find((r) => r.tier === 'gold')).toMatchObject({ won: 1, best: 'winner', fastest: null });
    expect(rows.find((r) => r.tier === 'diamond')).toMatchObject({ won: 0, best: null });
  });
  it('offers three different sponsor contracts, the same for the same seed', () => {
    const a = sponsorOffers('gold', 5);
    expect(a).toHaveLength(3);
    expect(new Set(a.map((s) => s.id)).size).toBe(3);
    expect(sponsorOffers('gold', 5).map((s) => s.id)).toEqual(a.map((s) => s.id));
  });
});

import { moveTokens } from '../cups/moveList';
describe('cups: move list', () => {
  const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  it('numbers moves from the start and marks the newest', () => {
    const t = moveTokens([], ['e4', 'e5', 'Nf3'], START);
    expect(t.map((x) => `${x.no ?? ''}${x.san}`)).toEqual(['1.e4', 'e5', '2.Nf3']);
    expect(t.map((x) => x.last)).toEqual([false, false, true]);
  });
  it('shows the opening the game started after dimmed, then continues the numbering', () => {
    const t = moveTokens(['e4', 'c6'], ['d4'], 'rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2');
    expect(t.map((x) => `${x.no ?? ''}${x.san}`)).toEqual(['1.e4', 'c6', '2.d4']);
    expect(t.map((x) => x.dim)).toEqual([true, true, false]);
  });
  it('starts with "n…" when Black moves first', () => {
    const t = moveTokens([], ['e5', 'Nf3'], 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1');
    expect(t.map((x) => `${x.no ?? ''}${x.san}`)).toEqual(['1…e5', '2.Nf3']);
  });
});

import { boonCard, charmCard, offerSize } from '../cups/boons';
import { cupAdvances, drawPaysWin, heatOn } from '../cups/cup';
import { HEATS, heatLaurels, heatOf } from '../cups/heat';
import { codexAfterGame, cupEnd, nemesisAfterCup, starsEarned } from '../cups/mastery';
import { EMPTY_META, upgradeCost } from '../cups/meta';
import { SPONSORS, sponsorById, sponsorReward } from '../cups/sponsors';
describe('cups: upgrades', () => {
  it('level II is the original strength; I weaker, III stronger, for every list', () => {
    const lists: number[][] = [TUNING.boons.extraMinuteMs, TUNING.boons.steadyHandIncMs, TUNING.boons.openingPrepMoves, TUNING.boons.secondWindAddMs, TUNING.boons.rattledTemp, TUNING.boons.rattledMoves, TUNING.boons.longNightElo, TUNING.charms.battlefieldOptions];
    for (const l of lists) expect(l[0] < l[1] && l[1] < l[2]).toBe(true);
    // Lower is better for prices and candidate cards.
    for (const p of Object.values(TUNING.charms.prices)) expect(p[0] >= p[1] && p[1] >= p[2]).toBe(true);
    expect(TUNING.charms.candidateCards).toEqual([4, 3, 2]);
  });
  it('costs Laurels to level up, up to level III', () => {
    expect(upgradeCost(1)).toBe(TUNING.levels.cost[0]);
    expect(upgradeCost(2)).toBe(TUNING.levels.cost[1]);
    expect(upgradeCost(3)).toBeNull();
  });
  it('describes every boon and charm at every level', () => {
    for (const l of [1, 2, 3]) {
      for (const b of ALL_BOONS) expect(boonCard(b, l).text.length).toBeGreaterThan(20);
      for (const c of ALL_CHARMS) expect(charmCard(c, l).text.length).toBeGreaterThan(20);
    }
    expect(boonCard('extraMinute', 1).short).toBe('+0:40 on your clock');
    expect(boonCard('extraMinute', 3).short).toBe('+1:30 on your clock');
    expect(charmCard('candidates', 3).short).toBe('2 moves, one best');
  });
  it('Draw Odds I works up to the semi-final; III pays win gold; Scout Report III shows 4 boons', () => {
    let c = { ...newCup('gold', 3, 0), boons: ['drawOdds'] as BoonId[] };
    expect(cupAdvances(c, 'draw', 'w')).toBe(true);
    c = applyResult(c, { opponentId: yourOpponent(c)!, elo: 800, color: 'w', result: 'win', reason: 'mate', moves: 20 });
    c = applyResult(c, { opponentId: yourOpponent(c)!, elo: 900, color: 'b', result: 'win', reason: 'mate', moves: 20 });
    expect(cupAdvances(c, 'draw', 'w')).toBe(false);
    expect(cupAdvances({ ...c, levels: { drawOdds: 2 } }, 'draw', 'w')).toBe(true);
    expect(drawPaysWin({ ...c, levels: { drawOdds: 3 } }, 'draw', 'w')).toBe(true);
    expect(offerSize(['scoutReport'], { scoutReport: 3 })).toBe(4);
    expect(offerSize(['scoutReport'])).toBe(3);
  });
});
describe('cups: heat', () => {
  it('adds up heat and pays Laurels by finish', () => {
    expect(heatOf(['sharper', 'doubleQuirk'])).toBe(3);
    expect(heatLaurels(4, 'winner')).toBe(4);
    expect(heatLaurels(4, 'final')).toBe(2);
    expect(heatLaurels(4, 'quarter')).toBe(0);
    expect(HEATS.length).toBe(7);
  });
  it('Sharper Field raises ratings; No Draw Odds takes away Black’s draw', () => {
    const c = newCup('silver', 4, 0, [], { heat: ['sharper', 'noDrawOdds'] });
    expect(heatOn(c, 'sharper')).toBe(true);
    expect(opponentRating(c)).toBe(600 + 50);
    expect(cupAdvances(c, 'draw', 'b')).toBe(false);
    expect(cupAdvances(newCup('silver', 4, 0), 'draw', 'b')).toBe(true);
  });
});
describe('cups: sponsors, stars, codex, nemesis', () => {
  const win = (c: ReturnType<typeof newCup>, extra: Partial<RoundRecord> = {}) => applyResult(c, { opponentId: yourOpponent(c)!, elo: 800, color: yourColor(c), result: 'win', reason: 'mate', moves: 25, accuracy: 85, clockLeft: 450, greats: 1, ...extra });
  it('signing a sponsor pays starting gold; contracts check the finished cup', () => {
    let c = newCup('gold', 8, 0, [], { sponsor: 'flawless', heat: ['sharper', 'doubleQuirk'] });
    expect(c.gold).toBe(TUNING.sponsors.signingGold);
    c = win(win(win(c)));
    expect(c.place).toBe('winner');
    for (const s of SPONSORS) expect(typeof s.done(c)).toBe('boolean');
    expect(sponsorById('flawless')!.done(c)).toBe(true);
    expect(sponsorById('quick')!.done(c)).toBe(true);
    expect(sponsorById('tactician')!.done(c)).toBe(true);
    expect(sponsorReward(sponsorById('quick')!, 'diamond')).toBe(sponsorById('quick')!.reward + 1);
    expect(starsEarned(c)).toEqual([true, true, true]);
    const end = cupEnd(c, EMPTY_META);
    expect(end.lines.map((l) => l.label)).toEqual(['Cup won', 'Heat 3', 'Endgame Insurance contract', 'Star: Win the cup', 'Star: Win every game', 'Star: Win at heat 3+']);
    expect(end.patch.stars?.gold).toEqual([true, true, true]);
    expect(end.patch.heatBest?.gold).toBe(3);
    // Stars already earned pay nothing again.
    expect(cupEnd(c, { ...EMPTY_META, stars: { gold: [true, true, true] } }).lines.some((l) => l.label.startsWith('Star'))).toBe(false);
  });
  it('the codex counts games and first wins per quirk', () => {
    const a = codexAfterGame({}, ['speedster', 'copycat'], true);
    expect(a.firsts).toEqual(['speedster', 'copycat']);
    const b = codexAfterGame(a.codex, ['speedster'], true);
    expect(b.firsts).toEqual([]);
    expect(b.codex.speedster).toEqual({ faced: 2, beaten: 2 });
  });
  it('who knocks you out becomes your nemesis; they return angrier until you beat them', () => {
    let c = newCup('silver', 9, 0);
    const opp = yourOpponent(c)!;
    c = applyResult(c, { opponentId: opp, elo: 600, color: 'w', result: 'loss', reason: 'mate', moves: 30 });
    const n1 = nemesisAfterCup(undefined, c);
    expect(n1.nemesis?.id).toBe(opp);
    expect(n1.nemesis?.grudge).toBe(1);
    expect(nemesisAfterCup(n1.nemesis, c).nemesis?.grudge).toBe(2);
    // Next cup: the nemesis is in the other half and wins their matches.
    let d = newCup('silver', 77, 0, [], { nemesis: { id: opp, grudge: 2 } });
    expect(d.rounds[0].slice(4)).toContain(opp);
    d = win(d);
    expect(d.rounds[1]).toContain(opp);
    d = win(d);
    expect(yourOpponent(d)).toBe(opp);
    expect(opponentRating(d)).toBe(800 + 2 * TUNING.mastery.grudgeElo);
    d = win(d);
    const n2 = nemesisAfterCup({ id: opp, grudge: 2, tier: 'silver' }, d);
    expect(n2.beaten).toBe(opp);
    expect(n2.nemesis).toBeUndefined();
  });
});
