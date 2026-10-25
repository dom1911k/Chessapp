// Coaching explanation engine: position + move + engine analysis → 1–3 short,
// beginner-friendly sentences, arrows and highlights. Entirely local and rule-based.
import { Chess } from 'chess.js';
import { parseUci } from '../chess/game';
import { CoachContext, type CoachInput } from './context';
import { ideaRules, motifIdea } from './rules/ideas';
import { principleRules } from './rules/principles';
import { problemRules } from './rules/problems';
import { praiseRules } from './rules/praise';
import type { Rule } from './rules/rule';
import { t } from './templates';
import type { CoachComment, Finding, FindingKind } from './types';
import { describeLine, moveMotifs } from './tactics';

export type { CoachInput } from './context';
export * from './types';

export const RULES: Record<FindingKind, Rule[]> = {
  problem: problemRules,
  idea: ideaRules,
  principle: principleRules,
  praise: praiseRules,
};

function run(ctx: CoachContext, kind: FindingKind, max = 1): Finding[] {
  const out: Finding[] = [];
  for (const rule of RULES[kind]) {
    if (ctx.input.suppress?.includes(rule.id)) continue;
    let r;
    try {
      r = rule.detect(ctx);
    } catch (e) {
      console.warn('coach rule failed', rule.id, e);
      continue;
    }
    if (r) {
      out.push({ rule: rule.id, kind, theme: r.theme ?? rule.theme, text: r.text, arrows: r.arrows, highlights: r.highlights });
      if (out.length >= max) break;
    }
  }
  return out;
}

function compose(ctx: CoachContext, findings: Finding[]): CoachComment {
  const cls = ctx.classification();
  return {
    classification: cls,
    text: findings.map((f) => f.text).slice(0, 3),
    themes: [...new Set(findings.filter((f) => f.kind !== 'praise').map((f) => f.theme))],
    ruleIds: findings.map((f) => f.rule),
    arrows: findings.flatMap((f) => f.arrows ?? []),
    highlights: findings.flatMap((f) => f.highlights ?? []),
    bestSan: ctx.bestSan,
    bestUci: ctx.bestUci ?? undefined,
  };
}

/** Explain a move that was just played. */
export function explainMove(input: CoachInput): CoachComment {
  const ctx = new CoachContext(input);
  const cls = ctx.classification();
  const findings: Finding[] = [];
  if (cls === 'mistake' || cls === 'blunder') {
    let problem = run(ctx, 'problem');
    let idea = run(ctx, 'idea');
    // A concrete idea beats the vague "strong reply" sentence…
    if (problem[0]?.rule === 'strong-reply' && idea[0] && idea[0].rule !== 'engine-prefers') problem = [];
    // …and once the problem is explained, the engine's preference only needs a short line.
    if (problem.length && idea[0]?.rule === 'engine-prefers' && ctx.bestSan)
      idea = [{ ...idea[0], text: t('fallbackShort', { move: ctx.bestSan }, ctx.seed) }];
    findings.push(...problem, ...idea);
    if (findings.length < 3) findings.push(...run(ctx, 'principle'));
  } else if (cls === 'inaccuracy') {
    const principle = run(ctx, 'principle');
    const problem = run(ctx, 'problem').filter((f) => f.rule !== 'strong-reply');
    const idea = run(ctx, 'idea');
    findings.push(...(principle.length ? principle : problem.length ? problem : []), ...idea.slice(0, 1));
  } else {
    const praise = run(ctx, 'praise');
    if (praise.length) findings.push(...praise);
    else {
      const principle = run(ctx, 'principle');
      if (principle.length) findings.push(...principle);
      else if (cls)
        findings.push({ rule: 'praise-generic', kind: 'praise', theme: 'material', text: t(cls === 'best' ? 'praiseBest' : 'praiseGood', {}, ctx.seed) });
    }
  }
  return compose(ctx, dedupe(findings));
}

function dedupe(f: Finding[]): Finding[] {
  const seen = new Set<string>();
  return f.filter((x) => (seen.has(x.text) ? false : (seen.add(x.text), true)));
}

/**
 * Explain why a known-good move works (puzzle solutions). `line` is the
 * solution continuation starting with `uci`.
 */
export function explainKeyMove(fen: string, uci: string, line: string[]): CoachComment {
  const c = new Chess(fen);
  const san = c.move(parseUci(uci)).san;
  const info = describeLine(fen, line, 12);
  const motifs = moveMotifs(fen, uci);
  const ctx = new CoachContext({
    fenBefore: fen,
    uci,
    before: { fen, depth: 0, bestMove: uci, lines: [{ multipv: 1, depth: 0, score: { type: 'cp', value: 0 }, pv: line }] },
    classification: 'best',
  });
  const text: string[] = [];
  const themes: CoachComment['themes'] = [];
  const arrows: CoachComment['arrows'] = [{ from: uci.slice(0, 2), to: uci.slice(2, 4), tone: 'good' }];
  if (info.matesIn) {
    themes.push(info.endsInBackRankMate ? 'backRankMate' : info.matesIn === 1 ? 'mateIn1' : info.matesIn === 2 ? 'mateIn2' : 'mate');
    text.push(
      info.matesIn === 1
        ? info.endsInBackRankMate
          ? `${san} is a back-rank checkmate — the king is trapped behind its own pawns.`
          : `${san} is checkmate!`
        : `${san} starts a forced checkmate in ${info.matesIn}: ${ctx.line(fen, line, info.matesIn * 2 - 1)}.`,
    );
  }
  for (const m of motifs) {
    if (text.length >= 2) break;
    const r = motifIdea(ctx, m);
    if (r) {
      themes.push(r.theme!);
      text.push(r.text.replace(/^Look for double attacks: /, ''));
      arrows.push(...(r.arrows ?? []).slice(1));
    } else if (m.kind === 'freeCapture' && !text.length) {
      themes.push('hangingPiece');
      text.push(`${san} grabs the undefended ${ctx.name(m.piece)}.`);
    } else if (m.kind === 'winningCapture' && !text.length) {
      text.push(`${san} wins the ${ctx.name(m.piece)}: it isn't defended well enough.`);
    }
  }
  if (!text.length) {
    const gain = info.materialGain;
    text.push(
      gain >= 1
        ? `${san} is the key move: after ${ctx.line(fen, line, 5)} you come out ahead in material.`
        : `${san} is the key move. The idea: ${ctx.line(fen, line, 5)}.`,
    );
  }
  return { classification: 'best', text, themes: [...new Set(themes)], ruleIds: [], arrows, highlights: [], bestSan: san, bestUci: uci };
}

export { getHint } from './hints';
export { safetyInfo } from './safety';
export { explainTakeback } from './takeback';
