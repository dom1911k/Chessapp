// Transport-independent UCI client with a sequential job queue and a small cache.
import type { Score } from '../chess/evaluation';
import type { AnalysisLine, AnalysisResult, AnalyzeOptions, Engine } from './types';

export interface UciTransport {
  send(cmd: string): void;
  onLine(cb: (line: string) => void): void;
}

interface Job {
  fen: string;
  opts: AnalyzeOptions;
  resolve: (r: AnalysisResult) => void;
  reject: (e: Error) => void;
  lines: Map<number, AnalysisLine>;
  cancelled: boolean;
}

export class CancelledError extends Error {
  constructor() {
    super('cancelled');
  }
}

export function parseInfo(line: string, whiteToMove: boolean): AnalysisLine | null {
  if (!line.startsWith('info ') || !line.includes(' pv ')) return null;
  if (line.includes(' lowerbound') || line.includes(' upperbound')) return null;
  const t = line.split(' ');
  let depth = 0;
  let multipv = 1;
  let score: Score | null = null;
  let pv: string[] = [];
  for (let i = 1; i < t.length; i++) {
    switch (t[i]) {
      case 'depth':
        depth = Number(t[++i]);
        break;
      case 'multipv':
        multipv = Number(t[++i]);
        break;
      case 'score': {
        const kind = t[++i];
        const v = Number(t[++i]);
        const sign = whiteToMove ? 1 : -1;
        score = kind === 'mate' ? { type: 'mate', value: v * sign } : { type: 'cp', value: v * sign };
        break;
      }
      case 'pv':
        pv = t.slice(i + 1);
        i = t.length;
        break;
    }
  }
  if (!score || !pv.length) return null;
  return { depth, multipv, score, pv };
}

export class UciEngine implements Engine {
  private queue: Job[] = [];
  private current: Job | null = null;
  private ready: Promise<void>;
  private readyResolve!: () => void;
  private multipv = 1;
  private cache = new Map<string, AnalysisResult>();

  constructor(private transport: UciTransport) {
    this.ready = new Promise((r) => (this.readyResolve = r));
    transport.onLine((l) => this.handle(l));
    transport.send('uci');
    transport.send('setoption name Hash value 16');
    transport.send('isready');
  }

  analyze(fen: string, opts: AnalyzeOptions = {}): Promise<AnalysisResult> {
    const key = this.key(fen, opts);
    const cached = !opts.fresh && this.cache.get(key);
    if (cached) return Promise.resolve(cached);
    return new Promise((resolve, reject) => {
      this.queue.push({ fen, opts, resolve, reject, lines: new Map(), cancelled: false });
      void this.pump();
    });
  }

  cancelAll(owner?: string) {
    const mine = (j: Job) => owner === undefined || j.opts.owner === owner;
    for (const j of this.queue) if (mine(j)) j.reject(new CancelledError());
    this.queue = this.queue.filter((j) => !mine(j));
    if (this.current && mine(this.current)) {
      this.current.cancelled = true;
      this.transport.send('stop');
    }
  }

  private key(fen: string, o: AnalyzeOptions) {
    return `${fen}|${o.depth ?? ''}|${o.movetime ?? ''}|${o.multipv ?? 1}`;
  }

  private async pump() {
    await this.ready;
    if (this.current || !this.queue.length) return;
    const job = this.queue.shift()!;
    this.current = job;
    const mpv = job.opts.multipv ?? 1;
    if (mpv !== this.multipv) {
      this.transport.send(`setoption name MultiPV value ${mpv}`);
      this.multipv = mpv;
    }
    this.transport.send(`position fen ${job.fen}`);
    const parts = ['go'];
    if (job.opts.depth) parts.push('depth', String(job.opts.depth));
    if (job.opts.movetime) parts.push('movetime', String(job.opts.movetime));
    if (parts.length === 1) parts.push('depth', '12');
    this.transport.send(parts.join(' '));
  }

  private handle(line: string) {
    if (line === 'readyok') {
      this.readyResolve();
      return;
    }
    const job = this.current;
    if (!job) return;
    if (line.startsWith('info ')) {
      const info = parseInfo(line, job.fen.split(' ')[1] === 'w');
      if (info) job.lines.set(info.multipv, info);
      return;
    }
    if (line.startsWith('bestmove')) {
      this.current = null;
      const best = line.split(' ')[1];
      const lines = [...job.lines.values()].sort((a, b) => a.multipv - b.multipv);
      const result: AnalysisResult = {
        fen: job.fen,
        depth: lines[0]?.depth ?? 0,
        lines,
        bestMove: best && best !== '(none)' ? best : null,
      };
      if (job.cancelled) job.reject(new CancelledError());
      else {
        if (this.cache.size > 300) this.cache.delete(this.cache.keys().next().value!);
        this.cache.set(this.key(job.fen, job.opts), result);
        job.resolve(result);
      }
      void this.pump();
    }
  }
}
