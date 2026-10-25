import type { Score } from '../chess/evaluation';

export interface AnalysisLine {
  multipv: number;
  depth: number;
  score: Score; // White POV
  pv: string[]; // UCI moves
}

export interface AnalysisResult {
  fen: string;
  depth: number;
  lines: AnalysisLine[]; // sorted best first
  bestMove: string | null;
}

export interface AnalyzeOptions {
  depth?: number;
  movetime?: number;
  multipv?: number;
  /** Ignore cache and always search. */
  fresh?: boolean;
  /** Who asked (e.g. 'play', 'explore'); lets a screen cancel only its own jobs. */
  owner?: string;
}

export interface Engine {
  analyze(fen: string, opts?: AnalyzeOptions): Promise<AnalysisResult>;
  /** Cancel queued jobs and the running search of `owner` (all if omitted); their promises reject. */
  cancelAll(owner?: string): void;
}
