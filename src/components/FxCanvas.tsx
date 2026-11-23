// One canvas over the whole app for the Puzzle Path's particles (fx.ts draws into it).
import { useEffect, useRef } from 'react';
import { attachFx, sizeFx } from '../lib/fx';

export function FxCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    attachFx(ref.current);
    const on = () => sizeFx();
    addEventListener('resize', on);
    return () => {
      removeEventListener('resize', on);
      attachFx(null);
    };
  }, []);
  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-[80] h-full w-full" aria-hidden />;
}
