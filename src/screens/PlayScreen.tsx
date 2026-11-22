// The Play tab: the setup screen (opponent, mode, Play) or the game in progress. The parts live
// in ./play/ (SetupView, GameView, PlayerBar, CoachCard, GameActions, ChatBubble).
import { usePlay } from '../lib/store/play';
import { Spinner } from '../components/ui';
import { GameView } from './play/GameView';
import { SetupView } from './play/SetupView';

export { SettingsButton } from './play/SetupView';

export function PlayScreen() {
  const phase = usePlay((s) => s.phase);
  const game = usePlay((s) => s.game);
  const away = usePlay((s) => s.away);
  if (phase === 'loading') return <div className="flex h-full items-center justify-center"><Spinner /></div>;
  if (!game || phase === 'setup' || away) return <SetupView />;
  return <GameView />;
}
