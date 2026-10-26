import { Chess, type Move } from 'chess.js';
import { classify, povScore, winPct, type Classification, type Score } from '../chess/evaluation';
import { lineToSan, parseUci, START_FEN } from '../chess/game';
import { lineWords, moveWords } from '../chess/words';
import { applyUci, other, parseFen, PIECE_NAME, sqIndex, sqName, type Color, type Piece, type PieceType } from '../chess/pos';
import type { AnalysisResult } from '../engine/types';
import { describeLine, moveMotifs, type LineInfo, type Motif } from './tactics';

export interface CoachInput {
  fenBefore: string;
  uci: string;
  /** Engine analysis of the position before the move (best move = what you could have played). */
  before?: AnalysisResult | null;
  /** Engine analysis after the move (its PV is the opponent's best reply). */
  after?: AnalysisResult | null;
  /** UCI moves played from the start of the game up to (not including) this move. */
  history?: string[];
  startFen?: string;
  /** Rule ids that should not fire again (e.g. a reminder already given this game). */
  suppress?: string[];
  /** Force a classification instead of computing it from the evals. */
  classification?: Classification;
}

const lazy = <T,>(f: () => T) => {
  let v: T | undefined;
  let done = false;
  return () => {
    if (!done) {
      v = f();
      done = true;
    }
    return v as T;
  };
};

export class CoachContext {
  readonly mover: Color;
  readonly opp: Color;
  readonly move: Move;
  readonly fenAfter: string;
  readonly boardBefore: (Piece | null)[];
  readonly boardAfter: (Piece | null)[];
  readonly from: number;
  readonly to: number;
  readonly seed: string;
  readonly gameOverAfter: boolean;

  constructor(readonly input: CoachInput) {
    const c = new Chess(input.fenBefore);
    this.mover = c.turn();
    this.opp = other(this.mover);
    this.move = c.move(parseUci(input.uci));
    this.fenAfter = c.fen();
    this.gameOverAfter = c.isGameOver();
    this.boardBefore = parseFen(input.fenBefore).board;
    this.boardAfter = applyUci(this.boardBefore, input.uci);
    this.from = sqIndex(this.move.from);
    this.to = sqIndex(this.move.to);
    this.seed = input.fenBefore + input.uci;
  }

  // ---- engine-derived ----
  get bestLine(): string[] {
    return this.input.before?.lines[0]?.pv ?? [];
  }
  get bestUci(): string | null {
    return this.input.before?.bestMove ?? this.bestLine[0] ?? null;
  }
  get refLine(): string[] {
    return this.input.after?.lines[0]?.pv ?? [];
  }

  readonly scoreBefore = lazy<Score | null>(() => {
    const s = this.input.before?.lines[0]?.score;
    return s ? povScore(s, this.mover) : null;
  });
  readonly scoreAfter = lazy<Score | null>(() => {
    if (this.gameOverAfter) {
      const c = new Chess(this.fenAfter);
      return c.isCheckmate() ? { type: 'mate', value: 1 } : { type: 'cp', value: 0 };
    }
    const s = this.input.after?.lines[0]?.score;
    return s ? povScore(s, this.mover) : null;
  });

  get isBest(): boolean {
    if (!this.bestUci) return false;
    if (this.bestUci === this.input.uci) return true;
    // Another multipv line with the same score counts as best too.
    const lines = this.input.before?.lines ?? [];
    const top = lines[0]?.score;
    return lines.some(
      (l) => l.pv[0] === this.input.uci && top && l.score.type === top.type && l.score.value === top.value,
    );
  }

  get wpBefore(): number | null {
    const s = this.scoreBefore();
    return s ? winPct(s) : null;
  }
  get wpAfter(): number | null {
    const s = this.scoreAfter();
    return s ? winPct(s) : null;
  }

  readonly classification = lazy<Classification | undefined>(() => {
    if (this.input.classification) return this.input.classification;
    const b = this.wpBefore;
    const a = this.wpAfter;
    if (b === null || a === null) return undefined;
    let cls = classify(b, a, this.isBest);
    // Missing a mate-in-one is worth pointing out even when still winning.
    const sb = this.scoreBefore();
    const sa = this.scoreAfter();
    if (sb?.type === 'mate' && sb.value === 1 && !(sa?.type === 'mate' && sa.value > 0) && (cls === 'best' || cls === 'good'))
      cls = 'inaccuracy';
    return cls;
  });

  readonly bestInfo = lazy<LineInfo | null>(() =>
    this.bestLine.length ? describeLine(this.input.fenBefore, this.bestLine) : null,
  );
  readonly bestMotifs = lazy<Motif[]>(() => (this.bestUci ? moveMotifs(this.input.fenBefore, this.bestUci) : []));
  readonly refInfo = lazy<LineInfo | null>(() =>
    this.refLine.length && !this.gameOverAfter ? describeLine(this.fenAfter, this.refLine) : null,
  );
  readonly refMotifs = lazy<Motif[]>(() =>
    this.refLine.length && !this.gameOverAfter ? moveMotifs(this.fenAfter, this.refLine[0]) : [],
  );
  readonly playedMotifs = lazy<Motif[]>(() => moveMotifs(this.input.fenBefore, this.input.uci));

  // ---- naming helpers ----
  pieceAt(board: 'before' | 'after', sq: number): PieceType | null {
    return (board === 'before' ? this.boardBefore : this.boardAfter)[sq]?.type ?? null;
  }
  name(t: PieceType | null | undefined): string {
    return t ? PIECE_NAME[t] : 'piece';
  }
  sq(i: number): string {
    return sqName(i);
  }
  get oppName(): string {
    return 'your opponent';
  }
  san(fen: string, uci: string): string {
    return lineToSan(fen, [uci])[0] ?? uci;
  }
  /** A line in plain words, told from the mover's (the user's) point of view. */
  line(fen: string, pv: string[], plies = 3): string {
    return lineWords(fen, pv, Math.min(plies, 5), fen.split(' ')[1] === this.mover ? 'you' : 'they');
  }
  /** The better move in words: "moving your rook to e1" / "move your rook to e1". */
  get bestGer(): string {
    return this.bestUci ? moveWords(this.input.fenBefore, this.bestUci, 'you', 'ger') : '';
  }
  get bestInf(): string {
    return this.bestUci ? moveWords(this.input.fenBefore, this.bestUci, 'you', 'inf') : '';
  }
  /** The opponent's reply in words, without a subject: "take your queen with their bishop". */
  get refInf(): string {
    return this.refLine[0] ? moveWords(this.fenAfter, this.refLine[0], 'they', 'inf') : '';
  }
  get bestSan(): string | undefined {
    return this.bestUci ? this.san(this.input.fenBefore, this.bestUci) : undefined;
  }
  get refSan(): string | undefined {
    return this.refLine[0] ? this.san(this.fenAfter, this.refLine[0]) : undefined;
  }

  // ---- opening helpers ----
  get isStandardGame(): boolean {
    return (this.input.startFen ?? START_FEN) === START_FEN && !!this.input.history;
  }
  /** Moves already played by the mover in this game (UCI). */
  get ownPreviousMoves(): string[] {
    const h = this.input.history ?? [];
    const startTurn = (this.input.startFen ?? START_FEN).split(' ')[1] as Color;
    return h.filter((_, i) => (i % 2 === 0 ? startTurn : other(startTurn)) === this.mover);
  }
  get ownMoveNumber(): number {
    return this.ownPreviousMoves.length + 1;
  }
  undevelopedMinors(): number {
    const rank = this.mover === 'w' ? '1' : '8';
    const home: [string, PieceType][] = [['b', 'n'], ['g', 'n'], ['c', 'b'], ['f', 'b']];
    return home.filter(([f, t]) => {
      const p = this.boardBefore[sqIndex(f + rank)];
      return p && p.color === this.mover && p.type === t;
    }).length;
  }
}
