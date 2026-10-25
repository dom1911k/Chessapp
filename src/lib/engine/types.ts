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
}

export interface Engine {
  analyze(fen: string, opts?: AnalyzeOptions): Promise<AnalysisResult>;
  /** Cancel queued jobs and stop the running search (pending promises reject). */
  cancelAll(): void;
}
