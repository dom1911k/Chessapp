// Play Coach's quick questions on the board (round 7): while a question waits, taps on squares
// answer it (not moves); afterwards a green check marks the right square, or the answer shows next
// to a wrong tap.
import { Check, X } from 'lucide-react';
import type { usePlay } from '../../lib/store/play';

type Quiz = NonNullable<ReturnType<typeof usePlay.getState>['quiz']>;

const FILES = 'abcdefgh';

export function QuizBoard({ quiz, orientation, onTap }: { quiz: Quiz; orientation: 'white' | 'black'; onTap: (sq: string) => void }) {
  const squares: string[] = [];
  for (let r = 0; r < 8; r++)
    for (let f = 0; f < 8; f++) squares.push(orientation === 'white' ? `${FILES[f]}${8 - r}` : `${FILES[7 - f]}${r + 1}`);
  const res = quiz.result;
  return (
    <div className={`absolute inset-0 z-20 grid grid-cols-8 grid-rows-8 ${res ? 'pointer-events-none' : ''}`} data-testid="quiz-board">
      {squares.map((sq) => {
        const right = !!res && quiz.answers.includes(sq);
        const tapped = !!res && res.sq === sq;
        return res ? (
          <span key={sq} className="relative flex items-center justify-center">
            {(right || tapped) && (
              <span className={`flex h-[46%] w-[46%] items-center justify-center rounded-full text-white shadow-[0_1px_3px_rgba(0,0,0,0.35)] ${right ? 'bg-brand-500' : 'bg-danger-500'}`} data-quiz-mark={right ? 'right' : 'wrong'}>
                {right ? <Check size={16} strokeWidth={3} /> : <X size={16} strokeWidth={3} />}
              </span>
            )}
          </span>
        ) : (
          <button key={sq} className="h-full w-full active:bg-brand-500/25" aria-label={sq} data-sq={sq} onClick={() => onTap(sq)} />
        );
      })}
    </div>
  );
}
