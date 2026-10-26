// Runs Maia networks off the main thread. Networks are fetched once and kept.
import { moveLogits, parseNet, type MaiaNet } from './net';

const nets = new Map<number, Promise<MaiaNet>>();

function net(rating: number, base: string): Promise<MaiaNet> {
  let p = nets.get(rating);
  if (!p) {
    p = fetch(new URL(`maia/maia-${rating}.bin`, base))
      .then((r) => {
        if (!r.ok) throw new Error(`Maia ${rating}: HTTP ${r.status}`);
        return r.arrayBuffer();
      })
      .then(parseNet);
    p.catch(() => nets.delete(rating));
    nets.set(rating, p);
  }
  return p;
}

interface Req {
  id: number;
  rating: number;
  base: string;
  fens: string[];
  legal: string[];
  castling: string[];
}

self.onmessage = async (e: MessageEvent<Req>) => {
  const { id, rating, base, fens, legal, castling } = e.data;
  try {
    const n = await net(rating, base);
    const logits = moveLogits(n, fens, legal, new Set(castling));
    (self as unknown as Worker).postMessage({ id, logits: [...logits] });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: String(err) });
  }
};
