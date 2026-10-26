// Coach Sam's tip of the day: personal when there's a recent pattern, otherwise a general tip.
import { kvGet, today } from '../db';
import type { Theme } from './types';
import { THEMES } from '../themes';
import { FOCUS_KEY } from '../store/finish';

export const TIPS = [
  'Before every move, ask: "What does my opponent\'s last move want to do?"',
  'Checks, captures, threats — look at these first, for both sides.',
  'A knight on the rim is dim: knights love central squares.',
  'Castle early, then connect your rooks.',
  'When you are ahead in material, trade pieces (not pawns).',
  'When you are behind, keep pieces on the board and look for tricks.',
  'Rooks love open files — put them where no pawns block them.',
  'In the endgame your king is a strong piece. March it to the center.',
  'Passed pawns must be pushed!',
  "Don't bring your queen out too early — she becomes a target.",
  'If you see a good move, sit on your hands and look for a better one.',
  'Count attackers and defenders before you capture.',
  'Pins are everywhere: watch pieces lined up with your king or queen.',
  'A piece that defends two things is overloaded — attack one of them.',
  'Make a little escape square ("luft") for your king when your back rank is crowded.',
  'Look at your least active piece and improve it.',
  'Every pawn move leaves squares behind that it can never defend again.',
  'Two bishops are strong in open positions.',
  'Knights are great in closed positions with locked pawns.',
  'When your opponent attacks on the side, strike back in the center.',
  "If you don't know what to do, improve your worst piece.",
  'Blunder check: after choosing a move, imagine your opponent\'s best reply.',
  'Trading when ahead turns a small advantage into a winning one.',
  'In rook endgames, put your rook behind passed pawns.',
  'Opposition: when kings face each other, the side NOT to move usually wins the battle.',
  'A queen and king can checkmate quickly — practise it in Learn!',
  'Don\'t be afraid to take back in training. Learning matters more than winning.',
  'Slow down when the position gets sharp — that\'s where games are decided.',
  'Review your losses: they hold the best lessons.',
  'Rest days are fine. Steady practice beats cramming.',
];

export interface Tip {
  text: string;
  personal: boolean;
}

export async function tipOfTheDay(): Promise<Tip> {
  const focus = await kvGet<{ theme: Theme; until: number } | null>(FOCUS_KEY, null);
  const day = today();
  const n = [...day].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;
  if (focus && focus.until > Date.now() && n % 2 === 0) {
    const t = THEMES[focus.theme];
    return { text: `${t.label} came up in your recent games. ${t.lesson}`, personal: true };
  }
  return { text: TIPS[n % TIPS.length], personal: false };
}
