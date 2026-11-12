// The story of a cup: chatter about the other matches, rivals who remember you, and the
// chronicle at the end. All lines come from templates filled with what actually happened.
// Characters are referred to by name (no pronouns are assumed).
import { opponentById } from '../lib/people';
import type { OpponentRecord } from '../lib/people/record';
import { BOONS, CHARMS, type BoonId, type CharmId } from './boons';
import { counted, type CupState, type RoundRecord } from './cup';
import { ROUND_NAMES, YOU, rng, tierInfo, type CupTier } from './ladder';
import type { CupSummary } from './meta';
import { quirkById } from './quirks';

const nameOf = (id: string) => opponentById(id)?.name ?? id;
const pick = <T,>(xs: T[], r: () => number) => xs[Math.floor(r() * xs.length)];

/** One or two lines after a round: how the other matches went and who waits for you. */
export function chatter(c: CupState, round: number): string[] {
  const sims = c.sims[round] ?? [];
  const r = rng(c.seed * 13 + round);
  const lines: string[] = [];
  const featured = sims.length ? sims[Math.floor(r() * sims.length)] : null;
  if (featured) {
    const loser = featured.winner === featured.a ? featured.b : featured.a;
    const upset = (c.ratings[featured.winner] ?? 0) < (c.ratings[loser] ?? 0) - 60;
    const quick = featured.moves < 30;
    const verb = upset ? pick(['stunned', 'upset', 'shocked'], r) : quick ? pick(['crushed', 'swept aside', 'made short work of'], r) : pick(['outlasted', 'ground down', 'edged past'], r);
    lines.push(`${nameOf(featured.winner)} ${verb} ${nameOf(loser)} in ${featured.moves} moves.`);
  }
  const alive = c.rounds[round + 1];
  if (!alive) return lines;
  const you = alive.indexOf(YOU);
  if (alive.length === 1) {
    lines.push(alive[0] === YOU ? 'And the cup is yours.' : `${nameOf(alive[0])} lifts the ${tierInfo(c.tier).name}.`);
  } else if (you >= 0) {
    const next = alive[you % 2 === 0 ? you + 1 : you - 1];
    const q = quirkById(c.quirks[next]);
    const where = round + 1 === 2 ? 'in the final' : `in the ${ROUND_NAMES[round + 1].toLowerCase()}`;
    lines.push(pick([`${nameOf(next)} waits for you ${where}${q ? ` — watch out, a ${q.name.toLowerCase()}` : ''}.`, `Next up ${where}: ${nameOf(next)}${q ? ` (${q.name})` : ''}.`], r));
  } else if (round === 0 || round === 1) {
    const fav = [...alive].sort((a, b) => (c.ratings[b] ?? 0) - (c.ratings[a] ?? 0))[0];
    lines.push(`${nameOf(fav)} is the favourite now.`);
  }
  return lines.slice(0, 2);
}

export interface RivalMemory {
  record?: OpponentRecord;
  /** The tier of the most recent cup in which you knocked them out / they knocked you out. */
  youKnockedOut?: string;
  theyKnockedYouOut?: string;
}

/** What you remember about a character from past cups. */
export function cupMemory(history: CupSummary[], id: string): Pick<RivalMemory, 'youKnockedOut' | 'theyKnockedYouOut'> {
  const recent = [...history].sort((a, b) => b.endedAt - a.endedAt);
  const you = recent.find((h) => h.beaten.includes(id));
  const they = recent.find((h) => h.eliminatedBy === id);
  // Only the most recent of the two counts.
  if (you && (!they || you.endedAt >= they.endedAt)) return { youKnockedOut: you.tier };
  if (they) return { theyKnockedYouOut: they.tier };
  return {};
}

/** The character's line before the game, if your history gives them something to say. */
export function rivalLine(m: RivalMemory, r: () => number = Math.random): string | null {
  const cup = (t: string) => tierInfo(t as CupTier)?.name ?? 'the cup';
  if (m.youKnockedOut) return pick([`You knocked me out of the ${cup(m.youKnockedOut)}. Not this time.`, `I still remember the ${cup(m.youKnockedOut)}. Revenge tastes sweet.`], r);
  if (m.theyKnockedYouOut) return pick([`I sent you home from the ${cup(m.theyKnockedYouOut)}. Ready for round two?`, `Back for more after the ${cup(m.theyKnockedYouOut)}?`], r);
  const rec = m.record;
  if (!rec || rec.w + rec.l + rec.d === 0) return null;
  const games = rec.w + rec.l + rec.d;
  if (rec.w > rec.l) return pick([`You've beaten me ${rec.w} time${rec.w === 1 ? '' : 's'}. I've been studying.`, `${rec.w}–${rec.l} to you so far. Let's change that.`], r);
  if (rec.l > rec.w) return pick([`I've won ${rec.l} of our ${games} games. Make this one interesting.`, `${rec.l}–${rec.w} to me. You know how this goes.`], r);
  return `${rec.w}–${rec.l}${rec.d ? ` with ${rec.d} draw${rec.d === 1 ? '' : 's'}` : ''}. Time to settle it.`;
}

/** Which boon or charm made a visible difference in a game (null if none did). */
export function credit(rec: RoundRecord, cupBoons: string[]): string | null {
  const ev = rec.events ?? [];
  const used = (id: string) => ev.some((e) => e.id === id);
  const timeBoon = (['secondWind', 'extraMinute', 'steadyHand', 'openingPrep'] as BoonId[]).find((b) => cupBoons.includes(b) && (b !== 'secondWind' || used('secondWind')));
  if (rec.result === 'win' && rec.reason === 'time' && timeBoon) return BOONS[timeBoon].name;
  if (rec.result === 'win' && (rec.clockLeft ?? 99) < 30 && timeBoon) return BOONS[timeBoon].name;
  if (used('secondWind') && rec.result !== 'loss') return BOONS.secondWind.name;
  if (rec.result === 'draw' && rec.advanced && rec.color === 'w' && cupBoons.includes('drawOdds')) return BOONS.drawOdds.name;
  if (ev.some((e) => e.id === 'threatBell' && e.text.startsWith('Threat Bell rang'))) return CHARMS.threatBell.name;
  for (const ch of ['rewind', 'candidates'] as CharmId[]) if (used(ch) && rec.result !== 'loss') return CHARMS[ch].name;
  if (used('rattled') && rec.result === 'win') return BOONS.rattled.name;
  return null;
}

const ROUND_SHORT = ['Quarter-final', 'Semi-final', 'Final'];
const fmtLeft = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s} second${s === 1 ? '' : 's'}`);

/** One line per game, from what actually happened. */
export function gameLine(rec: RoundRecord, cupBoons: string[]): string {
  const who = nameOf(rec.opponentId);
  const head = `${ROUND_SHORT[rec.round] ?? 'Round'}${rec.replayed ? ' (replayed)' : ''}`;
  const how =
    rec.result === 'win'
      ? rec.reason === 'time'
        ? `won on time against ${who}${rec.clockLeft !== undefined ? ` with ${fmtLeft(rec.clockLeft)} left` : ''}`
        : rec.reason === 'checkmate'
          ? `checkmated ${who} in ${rec.moves} moves`
          : `beat ${who} (${rec.reason})`
      : rec.result === 'draw'
        ? `drew with ${who}${rec.advanced ? ' and went through' : ' and went out'}`
        : rec.reason === 'time'
          ? `lost to ${who} on time`
          : `lost to ${who}${rec.reason === 'checkmate' ? ' by checkmate' : rec.reason === 'resignation' ? ' (resigned)' : ''}`;
  const parts = [`${head}: ${how}`];
  if (rec.opening) parts.push(`in the ${rec.opening}`);
  let line = parts.join(' ');
  const d = rec.decisive;
  if (d) line += d.who === 'them' ? ` — ${who}'s ${d.kind === 'blunder' ? 'blunder' : 'slip'} ${d.moveNo}.${d.san} turned it` : d.kind === 'brilliant' || d.kind === 'great' ? ` — your ${d.kind} move ${d.moveNo}.${d.san} decided it` : ` — ${d.moveNo}.${d.san} was the turning point`;
  const c = credit(rec, cupBoons);
  if (c) line += `, thanks to ${c}`;
  return `${line}.`;
}

export interface Chronicle {
  title: string;
  subtitle: string;
  lines: string[];
  stats: { label: string; value: string }[];
}

/** The recap card at the end of a cup. */
export function chronicle(c: CupState, myName: string): Chronicle {
  const games = c.yours;
  const real = counted(c);
  const place = { winner: 'Champion', final: 'Runner-up', semi: 'Semi-finalist', quarter: 'Quarter-finalist' }[c.place ?? 'quarter'];
  const acc = real.filter((r) => r.accuracy !== undefined).map((r) => r.accuracy!);
  const gold = games.reduce((n, r) => n + (r.gold ?? 0), 0);
  const greats = games.reduce((n, r) => n + (r.decisive?.who === 'you' && (r.decisive.kind === 'great' || r.decisive.kind === 'brilliant') ? 1 : 0), 0);
  const stats = [
    { label: 'Games', value: String(real.length) },
    { label: 'Moves', value: String(real.reduce((n, r) => n + r.moves, 0)) },
    { label: 'Accuracy', value: acc.length ? `${Math.round(acc.reduce((a, b) => a + b, 0) / acc.length)}%` : '—' },
    { label: 'Gold', value: String(gold) },
    { label: 'Boons', value: String(c.boons.length) },
    { label: 'Charms used', value: String(c.charmsUsed) },
  ];
  if (greats) stats.push({ label: 'Great moves', value: String(greats) });
  return {
    title: `${tierInfo(c.tier).name} · ${place}`,
    subtitle: `${myName} · ${new Date(c.endedAt ?? Date.now()).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`,
    lines: games.map((r) => gameLine(r, c.boons)),
    stats,
  };
}
