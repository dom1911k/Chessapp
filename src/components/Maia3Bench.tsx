// Developer tool (Settings): how fast Maia-3 runs on this device. 50 positions per run;
// average, 95th percentile and worst time per move, plus the one-off model load.
import { useState } from 'react';
import { benchmark, type BenchResult, type Maia3Backend, type Maia3Size } from '../lib/maia3';

const RUNS: { size: Maia3Size; backend: Maia3Backend; label: string }[] = [
  { size: '5m', backend: 'wasm', label: '5M · wasm' },
  { size: '23m', backend: 'wasm', label: '23M · wasm' },
  { size: '5m', backend: 'webgpu', label: '5M · WebGPU' },
  { size: '23m', backend: 'webgpu', label: '23M · WebGPU' },
];

const ms = (x: number) => `${Math.round(x)} ms`;

export function Maia3Bench() {
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState(0);
  const [results, setResults] = useState<(BenchResult & { label: string })[]>([]);
  const [error, setError] = useState<string | null>(null);
  const run = async (list: typeof RUNS) => {
    setError(null);
    for (const r of list) {
      setBusy(r.label);
      setDone(0);
      try {
        const res = await benchmark(r.size, r.backend, setDone);
        setResults((x) => [...x.filter((y) => y.label !== r.label), { ...res, label: r.label }]);
      } catch (e) {
        setError(`${r.label}: ${String(e)}`);
      }
    }
    setBusy(null);
  };
  return (
    <div className="py-2" data-testid="maia3-bench">
      <div className="mb-1 text-sm">Maia-3 speed test</div>
      <p className="mb-2 text-xs text-stone-500">Times 50 positions on this device. Target: under 300 ms per move.</p>
      <div className="flex flex-wrap gap-1.5">
        <button className="btn-secondary px-3 py-1.5 text-xs" disabled={!!busy} onClick={() => void run(RUNS)}>Run all</button>
        {RUNS.map((r) => (
          <button key={r.label} className="btn-secondary px-3 py-1.5 text-xs" disabled={!!busy} onClick={() => void run([r])}>{r.label}</button>
        ))}
      </div>
      {busy && <p className="mt-2 text-xs text-stone-500">Running {busy}… {done}/50</p>}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {results.length > 0 && (
        <table className="mt-2 w-full text-left text-xs tabular-nums">
          <thead className="text-stone-500">
            <tr><th className="py-0.5 font-medium">Model</th><th className="font-medium">Ran on</th><th className="font-medium">Avg</th><th className="font-medium">p95</th><th className="font-medium">Worst</th><th className="font-medium">Load</th></tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.label} className={r.avgMs < 300 ? '' : 'text-red-600'}>
                <td className="py-0.5">{r.label}</td><td>{r.backend}</td><td className="font-semibold">{ms(r.avgMs)}</td><td>{ms(r.p95Ms)}</td><td>{ms(r.worstMs)}</td><td>{(r.loadMs / 1000).toFixed(1)} s</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
