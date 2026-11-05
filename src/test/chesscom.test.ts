import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { monthComplete, monthsToFetch, normalizeTimeControl, parseCcGame, parseClocks, timeControlLabel, validUsername, type CcGame } from '../lib/chesscom/parse';
import { classifyPlies, mistakeCards, multipvFor, positionsOf, withAnalysis, bySource } from '../lib/chesscom/analysis';
import { gameInsights } from '../lib/games/insights';
import type { AnalysisResult } from '../lib/engine';
import type { AnyGame } from '../lib/store/types';

vi.mock('@capacitor/preferences', () => {
  const store = new Map<string, string>();
  return {
    Preferences: {
      get: async ({ key }: { key: string }) => ({ value: store.get(key) ?? null }),
      set: async ({ key, value }: { key: string; value: string }) => void store.set(key, value),
    },
  };
});
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false }, CapacitorHttp: { get: vi.fn() } }));
vi.mock('@capacitor/app', () => ({ App: { addListener: vi.fn() } }));
vi.mock('@capacitor/filesystem', () => ({ Directory: {}, Encoding: {}, Filesystem: {} }));
vi.mock('@capacitor/share', () => ({ Share: {} }));
// The analysis loop must not start a real engine in tests.
vi.mock('../lib/engine', () => ({ getEngine: () => ({ analyze: () => new Promise(() => undefined), cancelAll: () => undefined }), CancelledError: class extends Error {} }));

// Scholar's mate attempt where Black (me) blunders into mate.
const PGN = `[Event "Live Chess"]
[Site "Chess.com"]
[White "Opp_123"]
[Black "MyName"]
[Result "1-0"]
[TimeControl "600"]

1. e4 {[%clk 0:09:58.1]} 1... e5 {[%clk 0:09:57]} 2. Qh5 {[%clk 0:09:50]} 2... Nc6 {[%clk 0:09:40.5]} 3. Bc4 {[%clk 0:09:45]} 3... Nf6 {[%clk 0:09:20]} 4. Qxf7# {[%clk 0:09:44]} 1-0`;

const game = (over: Partial<CcGame> = {}): CcGame => ({
  url: 'https://www.chess.com/game/live/111',
  pgn: PGN,
  time_control: '600',
  time_class: 'rapid',
  end_time: 1790000000,
  rules: 'chess',
  uuid: 'abc-1',
  white: { username: 'Opp_123', rating: 640, result: 'win' },
  black: { username: 'MyName', rating: 610, result: 'checkmated' },
  ...over,
});

describe('chess.com import: parsing', () => {
  it('turns an archive game into an imported game from my side', () => {
    const g = parseCcGame(game(), 'myname')!;
    expect(g.id).toBe('cc:abc-1');
    expect(g.source).toBe('chess.com');
    expect(g.userColor).toBe('b');
    expect(g.opponentName).toBe('Opp_123');
    expect(g.elo).toBe(640);
    expect(g.myRating).toBe(610);
    expect(g.result).toBe('1-0');
    expect(g.userResult).toBe('loss');
    expect(g.reason).toBe('checkmate');
    expect(g.timeControl).toBe('600+0');
    expect(g.endedAt).toBe(1790000000 * 1000);
    expect(g.plies.length).toBe(7);
    expect(g.plies.filter((p) => p.isUser).map((p) => p.san)).toEqual(['e5', 'Nc6', 'Nf6']);
    expect(g.plies[6].san).toBe('Qxf7#');
    expect(g.clocks).toEqual([598.1, 597, 590, 580.5, 585, 560, 584]);
    expect(g.opening).toBeTruthy();
    expect(g.analyzed).toBe(false);
  });
  it('maps draws and wins, and skips variants or games without me', () => {
    const draw = parseCcGame(game({ white: { username: 'Opp_123', rating: 640, result: 'repetition' }, black: { username: 'MyName', rating: 610, result: 'repetition' } }), 'MyName')!;
    expect(draw.result).toBe('1/2-1/2');
    expect(draw.userResult).toBe('draw');
    expect(draw.reason).toBe('repetition');
    const win = parseCcGame(game({ white: { username: 'Opp_123', rating: 640, result: 'timeout' }, black: { username: 'MyName', rating: 610, result: 'win' } }), 'MyName')!;
    expect(win.userResult).toBe('win');
    expect(win.reason).toBe('time');
    expect(parseCcGame(game({ rules: 'chess960' }), 'MyName')).toBeNull();
    expect(parseCcGame(game(), 'someone-else')).toBeNull();
    expect(parseCcGame(game({ pgn: undefined }), 'MyName')).toBeNull();
  });
  it('time controls and clocks', () => {
    expect(normalizeTimeControl('180+2')).toBe('180+2');
    expect(normalizeTimeControl('1/86400')).toBe('daily');
    expect(timeControlLabel('600+0')).toBe('10+0');
    expect(timeControlLabel('180+2')).toBe('3+2');
    expect(timeControlLabel('daily')).toBe('Daily');
    expect(parseClocks('{[%clk 1:00:00]} {[%clk 0:00:05.5]}')).toEqual([3600, 5.5]);
    expect(validUsername('hikaru')).toBe(true);
    expect(validUsername('a')).toBe(false);
    expect(validUsername('bad name')).toBe(false);
  });
  it('fetches only months not yet complete, newest first', () => {
    const a = (m: string) => `https://api.chess.com/pub/player/x/games/${m}`;
    const archives = [a('2026/08'), a('2026/09'), a('2026/10'), a('2026/11')];
    const now = new Date(Date.UTC(2026, 10, 5));
    expect(monthsToFetch(archives, [], now)).toEqual([a('2026/11'), a('2026/10'), a('2026/09'), a('2026/08')]);
    // Complete months are skipped; the current month is always fetched again.
    expect(monthsToFetch(archives, ['2026/08', '2026/09', '2026/11'], now)).toEqual([a('2026/11'), a('2026/10')]);
    expect(monthComplete('2026/10', now)).toBe(true);
    expect(monthComplete('2026/11', now)).toBe(false);
  });
});

/** A fake engine result: White-POV centipawns, best move first. */
const res = (fen: string, cp: number, best: string, mate?: number): AnalysisResult => ({
  fen,
  depth: 10,
  bestMove: best,
  lines: [{ multipv: 1, depth: 10, score: mate !== undefined ? { type: 'mate', value: mate } : { type: 'cp', value: cp }, pv: [best] }],
});

describe('chess.com import: analysis', () => {
  it('classifies my moves with the coach pipeline and makes tagged review cards', () => {
    const g = parseCcGame(game(), 'MyName')!;
    const fens = positionsOf(g);
    expect(fens.length).toBe(8);
    expect(multipvFor(g, 1)).toBe(3);
    expect(multipvFor(g, 0)).toBe(1);
    // Level until 3...Nf6?? allows mate in one (g6 or Qe7 was needed).
    const r = fens.map((f, k) => (k === 7 ? null : k === 6 ? res(f, 0, 'h5f7', 1) : res(f, 20, k === 5 ? 'g7g6' : 'a2a3')));
    const plies = classifyPlies(g, r);
    expect(plies[5].classification).toBe('blunder');
    expect(plies[5].comment?.bestUci).toBe('g7g6');
    expect(plies[6].evalAfter).toEqual({ type: 'mate', value: 1 });
    const done = withAnalysis(g, r);
    expect(done.analyzed).toBe(true);
    expect(done.summary.counts.blunder).toBe(1);
    expect(done.summary.biggestMistakePly).toBe(5);
    const cards = mistakeCards(done, 1000);
    expect(cards.length).toBe(1);
    expect(cards[0]).toMatchObject({ id: 'm:cc:abc-1:5', source: 'chess.com', ccGameId: 'cc:abc-1', solution: ['g7g6'], playedSan: 'Nf6' });
    expect(cards[0].label).toMatch(/^chess\.com · vs Opp_123/);
  });
  it('insights filter app / chess.com games', () => {
    const g = parseCcGame(game(), 'MyName')!;
    const fens = positionsOf(g);
    const done = withAnalysis(g, fens.map((f, k) => (k === 7 ? null : k === 6 ? res(f, 0, 'h5f7', 1) : res(f, 20, k === 5 ? 'g7g6' : 'a2a3'))));
    const app: AnyGame = { ...done, id: 1, source: undefined, userResult: 'win', plies: done.plies.map((p) => ({ ...p, classification: 'good' as const })) };
    const all = [done, app];
    expect(bySource(all, 'app').length).toBe(1);
    expect(bySource(all, 'chess.com')[0].id).toBe('cc:abc-1');
    expect(gameInsights(all, 'chess.com').mistakes.length).toBeGreaterThan(0);
    expect(gameInsights(all, 'app').mistakes.length).toBe(0);
    expect(gameInsights(all, 'all').score).toEqual({ w: 1, d: 0, l: 1 });
    // Unanalysed imports don't count.
    expect(gameInsights([{ ...g }], 'all').games).toBe(0);
  });
});

describe('chess.com import: sync', () => {
  it('fetches newest month first, stores new games once, keeps them in the backup', async () => {
    const { db } = await import('../lib/db');
    const { useSettings } = await import('../lib/settings');
    const { useImport } = await import('../lib/chesscom/store');
    const { buildBackup } = await import('../lib/backup');
    const urls: string[] = [];
    const month = (m: string) => `https://api.chess.com/pub/player/myname/games/${m}`;
    globalThis.fetch = vi.fn(async (u: string | URL) => {
      const url = String(u);
      urls.push(url);
      const body = url.endsWith('/archives') ? { archives: [month('2020/01'), month('2020/02')] } : { games: url.endsWith('2020/02') ? [game()] : [game({ uuid: 'abc-0', end_time: 1580000000 })] };
      return { ok: true, status: 200, json: async () => body } as Response;
    }) as typeof fetch;
    useSettings.getState().set({ ccUsername: 'MyName' });
    await useImport.getState().sync();
    expect(useImport.getState().error).toBeNull();
    expect(urls).toEqual(['https://api.chess.com/pub/player/myname/games/archives', month('2020/02'), month('2020/01')]);
    expect(await db.imported.count()).toBe(2);
    expect(useImport.getState().added).toBe(2);
    // Both months are complete now: the next sync only asks for the archive list.
    urls.length = 0;
    await useImport.getState().sync();
    expect(urls).toEqual(['https://api.chess.com/pub/player/myname/games/archives']);
    expect(useImport.getState().added).toBe(0);
    const b = await buildBackup();
    expect(b.tables.imported.length).toBe(2);
    useImport.getState().stop();
  });
  it('a failed request shows a clear message', async () => {
    const { useImport } = await import('../lib/chesscom/store');
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }) as typeof fetch;
    await useImport.getState().sync();
    expect(useImport.getState().error).toMatch(/blocked the request/);
    useImport.getState().stop();
  });
});
