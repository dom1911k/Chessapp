// Review audit: analyse real games and print every line Game Review would show.
// Usage: npx tsx scripts/maia3/reviewdump.mts <sample.jsonl> <index> <w|b> [depth]
import { readFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { engine } from './players.mts';
import { explainMove } from '../../src/lib/coach/index.ts';
import { povScore } from '../../src/lib/chess/evaluation.ts';
import { reviewGame, punishment, moveNo, RC, isBad } from '../../src/lib/review.ts';
import { verdictLine, goodWhy, looseWhy, missedThreat } from '../../src/lib/reviewText.ts';
import { mistakeCauses, missedChances } from '../../src/lib/games/causes.ts';

const [file, idxS, me, depthS] = process.argv.slice(2);
const g0 = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))[Number(idxS)];
const depth = Number(depthS ?? 11);
const c = new Chess();
c.loadPgn(g0.pgn);
const moves = c.history({ verbose: true });
const fens = [moves[0].before, ...moves.map((m) => m.after)];
const res = [];
for (const f of fens) {
  const x = new Chess(f);
  res.push(x.isGameOver() ? null : await engine.analyze(f, { depth, multipv: 3 }));
}
const plies = moves.map((m, i) => {
  const before = res[i];
  const after = res[i + 1];
  const term = new Chess(m.after);
  const aScore = after?.lines[0]?.score ?? (term.isCheckmate() ? { type: 'mate', value: term.turn() === 'w' ? -1 : 1 } : term.isGameOver() ? { type: 'cp', value: 0 } : undefined);
  const base = { uci: m.lan, san: m.san, color: m.color, fenBefore: m.before, fenAfter: m.after, isUser: m.color === me, evalAfter: aScore };
  if (!base.isUser || !before) return base;
  const comment = explainMove({ fenBefore: m.before, uci: m.lan, before, after: after ?? null, history: moves.slice(0, i).map((x) => x.lan), startFen: fens[0] });
  return { ...base, comment, classification: comment.classification };
});
const result = g0.pgn.match(/\[Result "([^"]+)"\]/)?.[1];
const userResult = result === '1/2-1/2' ? 'draw' : (result === '1-0') === (me === 'w') ? 'win' : 'loss';
const g = { plies, userColor: me, startFen: fens[0], summary: { accuracy: 0, counts: {}, biggestMistakePly: null }, userResult, reason: 'resignation', elo: 0 } as never;
const r = reviewGame(g);
console.log(`=== game ${idxS} as ${me} (${userResult}) ratings ${g0.whiteRating}/${g0.blackRating}`);
console.log('VERDICT:', verdictLine(g, r));
console.log('SAM:', r.summary.join(' | '));
console.log('ACC me/them:', r.me.accuracy, r.them.accuracy);
for (const m of r.moments) console.log('MOMENT:', m.text);
const causes = mistakeCauses(g, r.plies.map((x) => x.cls));
for (const m of missedChances(g, r.plies.map((x) => x.cls))) console.log('MISSED:', moveNo(plies as never, m.ply), m.bestSan, m.what, '| played', m.played);
plies.forEach((p: any, i: number) => {
  const rp = r.plies[i];
  const cause = causes.find((x) => x.ply === i);
  const head = `${moveNo(plies as never, i)} ${p.san} [${rp.cls}${rp.effLoss ? ' L' + rp.effLoss.toFixed(0) : ''}]`;
  if (p.isUser) {
    const why = cause ? (cause.cause === 'hungPiece' && cause.sq ? looseWhy(p, cause.sq) ?? cause.text : cause.text) : '';
    const th = cause?.cause === 'missedThreat' ? missedThreat(p) : null;
    const nice = !isBad(rp.cls) && rp.cls !== 'book' ? goodWhy(p) : null;
    console.log(`YOU  ${head} ${RC[rp.cls].verdict}`);
    if (th) console.log('     THREAT:', th.text);
    if (why) console.log('     WHY:', why);
    if (nice) console.log('     NICE:', nice);
    for (const t of p.comment?.text ?? []) console.log('     TEXT:', t);
    if (isBad(rp.cls) && p.comment?.bestSan) console.log('     BEST:', p.comment.bestSan);
  } else if (isBad(rp.cls)) {
    console.log(`THEM ${head} ${RC[rp.cls].verdict} — ${punishment(plies as never, i) ?? '(no reply)'}`);
  }
});
process.exit(0);
