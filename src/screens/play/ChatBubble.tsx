// The opponent's chat line: a bubble anchored to their player bar, never over the pieces.
import { useState } from 'react';
import { usePlay } from '../../lib/store/play';

/** Chat lines already shown elsewhere (the versus intro shows the greeting) or dismissed with a tap. */
const usedChat = new Set<string>();

/**
 * The opponent's latest line as a speech bubble on their player bar (tail at the avatar), never
 * over the pieces: at most two lines, fades by itself, a tap dismisses it.
 */
export function ChatBubble() {
  const s = usePlay();
  const g = s.game!;
  const [, bump] = useState(0);
  const chat = s.chat && s.chat.ply >= g.plies.length - 1 && s.chat.text ? s.chat : null;
  const key = chat ? `${g.startedAt}:${chat.ply}:${chat.text}` : '';
  // The intro already shows its line: mark it used so it doesn't appear again after the intro.
  if (chat && s.intro) usedChat.add(key);
  if (!chat || s.intro || usedChat.has(key)) return null;
  return (
    <button
      key={key}
      className="animate-chat absolute top-1 left-[50px] z-30 max-w-[70%] text-left"
      onClick={() => (usedChat.add(key), bump((n) => n + 1))}
      aria-label="Dismiss"
      data-testid="chat-bubble"
    >
      <span className="absolute top-[11px] -left-[6px] h-0 w-0 border-y-[6px] border-r-[7px] border-y-transparent border-r-white" aria-hidden />
      <span className="line-clamp-2 rounded-[10px] rounded-tl-[3px] bg-white px-2.5 py-1 text-[13px] leading-[1.3] font-medium text-[#312e2b] shadow-[0_2px_8px_rgba(0,0,0,0.3)]">{chat.text}</span>
    </button>
  );
}
