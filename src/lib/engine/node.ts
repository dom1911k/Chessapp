// Node transport for tests and scripts (not bundled into the app).
import { createRequire } from 'node:module';
import { UciEngine } from './uci';

export function createNodeEngine(): UciEngine {
  const require = createRequire(import.meta.url);
  const listeners: ((l: string) => void)[] = [];
  const pending: string[] = [];
  let sf: { processCommand(c: string): void } | null = null;
  const loader = require('stockfish');
  const inst = loader('lite-single', (line: string) => listeners.forEach((l) => l(line)));
  // The loader may return the engine synchronously or a promise.
  Promise.resolve(inst).then((e: { processCommand(c: string): void }) => {
    sf = e;
    for (const c of pending) sf.processCommand(c);
  });
  return new UciEngine({
    send: (cmd) => (sf ? sf.processCommand(cmd) : pending.push(cmd)),
    onLine: (cb) => listeners.push(cb),
  });
}
