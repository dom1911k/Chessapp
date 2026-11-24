// The "versus" splash at the start of a game, rebuilt on the motion kit (docs/polish-3-prototype.html,
// scene 1). The halves sweep in, the green slash draws with a glint, you and your opponent spring in,
// VS stamps with a thud, a ring and a shake, their line pops. Then the hand-off: both portraits fly
// into their player-bar avatars while the intro fades and the board rises in under it; 520ms later
// the first coach line arrives with a two-bell chime. A tap leaves straight away.
import { UserAvatar, useMyName } from './UserAvatar';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { PieceIcon } from './PieceIcon';
import { opponentById } from '../lib/people';
import { getGameRating } from '../lib/rewards/rating';
import { BOUNCE, POP, SOFT, UI_EASE, animate, crossfade, haptic, sleep, token } from '../lib/motion';
import { centre, emit } from '../lib/fx';
import { sfx } from '../lib/sfx';
import { Portrait } from './Coach';

/** A 2px ring in the player's piece colour (black gets a hairline so it shows on charcoal). */
const ringFor = (c: 'w' | 'b') =>
  `${c === 'w' ? '0 0 0 2px #ffffff' : '0 0 0 2px #262421, 0 0 0 3px rgba(255,255,255,0.28)'}, 0 12px 30px rgba(0,0,0,0.45)`;

/** Where the green slash runs: the 160° gradient's 60% line through a w × h screen. */
function slashAt(w: number, h: number) {
  const a = (160 * Math.PI) / 180;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const len = Math.abs(w * dx) + Math.abs(h * dy);
  return { x: w / 2 + 0.1 * len * dx, y: h / 2 + 0.1 * len * dy, len: Math.hypot(w, h) * 1.2 };
}

/**
 * Fly a portrait from the intro into its player-bar avatar; the real avatar pops when it lands.
 * `frame` is the whole portrait on the intro (wrapper and ring): it hides while the clone flies,
 * and the clone carries the same ring, so nothing is left behind and the flight keeps its edge.
 */
function flyPortrait(from: Element | null, to: HTMLElement | null, frame: HTMLElement | null, ring: string) {
  if (!from || !to) return;
  const ra = from.getBoundingClientRect();
  const rb = to.getBoundingClientRect();
  if (!ra.width || !rb.width) return;
  const clone = from.cloneNode(true) as HTMLElement;
  Object.assign(clone.style, { position: 'fixed', left: `${ra.left}px`, top: `${ra.top}px`, width: `${ra.width}px`, height: `${ra.height}px`, margin: '0', zIndex: '81', borderRadius: '8px', overflow: 'hidden', boxShadow: ring, transformOrigin: '0 0', pointerEvents: 'none' });
  document.body.appendChild(clone);
  (frame ?? (from as HTMLElement)).style.visibility = 'hidden';
  to.style.visibility = 'hidden';
  const s = rb.width / ra.width;
  void animate(clone, [{ transform: 'none', borderRadius: '8px' }, { transform: `translate(${rb.left - ra.left}px,${rb.top - ra.top}px) scale(${s})`, borderRadius: `${5 / s}px` }], { d: 460, e: 'cubic-bezier(.3,.75,.25,1)', fill: 'forwards' }).then(() => {
    clone.remove();
    to.style.visibility = '';
    void animate(to, [{ transform: 'scale(1.18)' }, { transform: 'scale(1)' }], POP);
  });
}

export function VersusIntro({ opponentId, elo, userColor, line, onDone }: { opponentId?: string; elo: number; userColor: 'w' | 'b'; line?: string; onDone: () => void }) {
  const o = opponentById(opponentId);
  const [rating, setRating] = useState<number | null>(null);
  const name = useMyName();
  const root = useRef<HTMLButtonElement>(null);
  const r = useRef<Record<string, HTMLElement | null>>({});
  const ref = (k: string) => (el: HTMLElement | null) => {
    r.current[k] = el;
  };
  const leaveRef = useRef<() => void>(() => {});
  useEffect(() => void getGameRating().then((x) => setRating(x.rating)), []);

  // Before the first paint: the halves start off-screen and the coach card is hidden in the same
  // frame the intro mounts, so nothing of the game screen (or a resting layout) shows first.
  useLayoutEffect(() => {
    const q = r.current;
    const tk = token();
    let left = false;
    // The game screen sits under the intro from the start; its coach card waits for the hand-off.
    const coach = document.querySelector<HTMLElement>('[data-testid="coach-panel"]');
    if (coach) coach.style.opacity = '0';
    const leave = () => {
      if (left) return;
      left = true;
      tk.skip = true;
      flyPortrait(q.meImg, document.querySelector('[data-pb-avatar="me"]'), q.meFrame, ringFor(userColor));
      flyPortrait(q.opImg, document.querySelector('[data-pb-avatar="op"]'), q.opImg, ringFor(userColor === 'w' ? 'b' : 'w'));
      void animate(root.current, [{ opacity: 1 }, { opacity: 0 }], { d: 300 }).then(onDone);
      void animate(document.querySelector('[data-testid="game-board"]'), [{ opacity: 0, transform: 'scale(.965)' }, { opacity: 1, transform: 'none' }], { d: 420, delay: 80, e: UI_EASE });
      // The first coach line: a two-bell chime, the card rises in and its existing typewriter runs.
      setTimeout(() => {
        sfx('start');
        if (coach) {
          coach.style.opacity = '';
          void crossfade(coach);
        }
      }, 520);
    };
    leaveRef.current = leave;
    void (async () => {
      sfx('swish', -0.5);
      void animate(q.half1, [{ transform: 'translate(-60%,-30%)' }, { transform: 'none' }], { d: 520, e: 'cubic-bezier(.2,.8,.2,1)' });
      void animate(q.half2, [{ transform: 'translate(60%,30%)' }, { transform: 'none' }], { d: 520, e: 'cubic-bezier(.2,.8,.2,1)' });
      // The card is never empty for long: the slash and "You" start almost at once (same order and
      // springs as before); VS and the line keep their gaps from the opponent.
      void animate(q.slash, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { d: 380, delay: 40, e: 'cubic-bezier(.3,.8,.3,1)' });
      void animate(q.glint, [{ transform: 'translateX(-10%)', opacity: 1 }, { transform: 'translateX(110%)', opacity: 1 }], { d: 700, delay: 160, e: 'ease-in-out' });
      void animate(q.me, [{ opacity: 0, transform: 'translateX(-90px) rotate(-6deg)' }, { opacity: 1, transform: 'none' }], { ...BOUNCE, delay: 80 });
      void animate(q.op, [{ opacity: 0, transform: 'translateX(90px) rotate(6deg)' }, { opacity: 1, transform: 'none' }], { ...BOUNCE, delay: 200 });
      void animate(q.meChip, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { ...SOFT, delay: 260 });
      void animate(q.opChip, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { ...SOFT, delay: 380 });
      void animate(q.vs, [{ opacity: 0, transform: 'scale(2.6)' }, { opacity: 1, transform: 'scale(.92)', offset: 0.7 }, { opacity: 1, transform: 'scale(1)' }], { d: 300, delay: 400, e: 'cubic-bezier(.5,0,.6,1)' });
      void animate(q.line, [{ opacity: 0, transform: 'translateY(8px) scale(.92)' }, { opacity: 1, transform: 'none' }], { ...POP, delay: 910 });
      await sleep(610, tk);
      if (tk.skip) return;
      // VS lands.
      sfx('stamp');
      haptic('select');
      void animate(q.ring, [{ opacity: 0.9, transform: 'translate(-50%,-50%) scale(.5)' }, { opacity: 0, transform: 'translate(-50%,-50%) scale(2.4)' }], { d: 600, e: 'cubic-bezier(.2,.8,.3,1)' });
      void animate(q.card, [{ transform: 'none' }, { transform: 'translate(-4px,2px)' }, { transform: 'translate(4px,-2px)' }, { transform: 'translate(-2px,1px)' }, { transform: 'none' }], { d: 180, fill: 'none' });
      if (q.vs) {
        const c = centre(q.vs);
        emit({ x: c.x, y: c.y, n: 14, shape: 'spark', colors: ['#ffffff', '#dcf7b0'], speed: [180, 360], life: [0.2, 0.4], size: [1.5, 2.5] });
      }
      await sleep(1230, tk);
      if (!tk.skip) leave();
    })();
    return () => {
      tk.skip = true;
      if (coach) coach.style.opacity = '';
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sl = slashAt(typeof innerWidth === 'number' ? innerWidth : 390, typeof innerHeight === 'number' ? innerHeight : 844);
  return (
    <button ref={root} aria-label="Start the game" onClick={() => leaveRef.current()} className="fixed inset-0 z-50 overflow-hidden text-white" style={{ background: '#262421' }} data-testid="versus">
      {/* Two charcoal halves sweep in from opposite corners, split by a green slash. */}
      <div ref={ref('half1')} className="absolute inset-0" style={{ background: 'linear-gradient(160deg, #262421 0%, #262421 60%, transparent 60%)' }} />
      <div ref={ref('half2')} className="absolute inset-0" style={{ background: 'linear-gradient(160deg, transparent 60%, #3c3a37 60%, #3c3a37 100%)' }} />
      <div className="pointer-events-none absolute" style={{ left: sl.x, top: sl.y, transform: 'rotate(-20deg)' }}>
        <div ref={ref('slash')} className="absolute top-[-1.5px] h-[3px] origin-left overflow-hidden bg-[#81b64c]" style={{ left: -sl.len / 2, width: sl.len, transform: 'scaleX(0)' }}>
          <i ref={ref('glint')} className="absolute inset-y-0 left-0 w-[14%] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,.95),transparent)] opacity-0" />
        </div>
      </div>

      <div ref={ref('card')} className="relative mx-auto flex h-full max-w-md flex-col justify-between px-6 py-[18vh]">
        {/* You */}
        <div ref={ref('me')} className="flex items-center gap-4 self-start opacity-0">
          <span ref={ref('meFrame')} className="relative rounded-[8px]" style={{ boxShadow: ringFor(userColor) }}>
            <span ref={ref('meImg')} className="block overflow-hidden rounded-[8px]">
              <UserAvatar size={96} className="block" />
            </span>
            <span className="absolute -right-2 -bottom-2 h-9 w-9 rounded-full bg-white/95 p-1 shadow"><PieceIcon code={userColor === 'w' ? 'wK' : 'bK'} /></span>
          </span>
          <span className="text-left">
            <span className="block max-w-[46vw] truncate font-display text-3xl font-semibold">{name}</span>
            <span ref={ref('meChip')} className="mt-1 inline-flex items-center gap-1 rounded-full bg-black/30 px-2 py-0.5 text-xs font-semibold opacity-0">
              Rating {rating ?? <span className="skel inline-block h-3 w-6 rounded-[3px] align-middle" />} · {userColor === 'w' ? 'White' : 'Black'}
            </span>
          </span>
        </div>

        <div className="relative self-center">
          <i ref={ref('ring')} className="pointer-events-none absolute top-1/2 left-1/2 h-24 w-24 rounded-full border-[3px] border-white opacity-0" />
          <div ref={ref('vs')} className="font-display text-[64px] leading-none font-black tracking-tight text-white opacity-0 drop-shadow-[0_4px_14px_rgba(0,0,0,0.5)]">VS</div>
        </div>

        {/* Opponent */}
        <div className="flex flex-col items-end gap-3 self-end">
          <div ref={ref('op')} className="flex items-center gap-4 opacity-0">
            <span className="text-right">
              <span className="block font-display text-3xl font-semibold">{o ? o.name : 'Bot'}</span>
              <span ref={ref('opChip')} className="mt-1 inline-flex rounded-full bg-black/30 px-2 py-0.5 text-xs font-semibold opacity-0">{elo}{o ? ` · ${o.tagline}` : ''}</span>
            </span>
            <span ref={ref('opImg')} className="block overflow-hidden rounded-[8px]" style={{ boxShadow: ringFor(userColor === 'w' ? 'b' : 'w') }}>
              {o ? <Portrait id={o.id} size={96} mood="happy" className="block" /> : <span className="block h-24 w-24 bg-stone-700" />}
            </span>
          </div>
          {line && (
            <span ref={ref('line')} className="max-w-[85%] rounded-[10px] rounded-tr-[3px] bg-white px-3 py-2 text-left text-sm font-medium text-[#312e2b] opacity-0 shadow-lg">{line}</span>
          )}
        </div>
      </div>
      <span className="absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+20px)] text-center text-xs text-white/50">Tap to start</span>
    </button>
  );
}
