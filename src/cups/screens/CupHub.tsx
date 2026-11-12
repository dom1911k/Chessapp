// Between games: the bracket, your next match, and the cup's end.
import { opponentById } from '../../lib/people';
import { useMyName } from '../../components/UserAvatar';
import { champion, currentRound, opponentRating, roundName, yourColor, yourOpponent, type CupState } from '../cup';
import { quirkById } from '../quirks';
import { SPIRIT } from '../pixel/pixelize';
import { YOU, cupXp, tierInfo } from '../ladder';
import { useCup } from '../store';
import { PixelPortrait, Sprite } from '../pixel/sprites';
import { Bracket } from '../ui/Bracket';
import { PixelText } from '../ui/PixelText';
import { sfx } from '../sfx';
import { BoonPick } from './BoonPick';
import { Shop, GoldCount } from './Shop';
import { BOONS, CHARMS } from '../boons';
import { TarotCard } from '../ui/bits';
import { ChronicleCard } from '../ui/ChronicleCard';
import { chatter } from '../story';

const PLACE_TEXT = { winner: 'Cup won!', final: 'Runner-up', semi: 'Out in the semi-final', quarter: 'Out in the quarter-final' } as const;

export function CupHub({ c }: { c: CupState }) {
  if (c.flow === 'boon') return <BoonPick c={c} />;
  if (c.flow === 'shop') return <Shop c={c} />;
  return <CupHubMain c={c} />;
}

function CupHubMain({ c }: { c: CupState }) {
  const s = useCup();
  const myName = useMyName();
  const opp = yourOpponent(c);
  const o = opp ? opponentById(opp) : null;
  const champ = champion(c);
  return (
    <div className="flex h-full flex-col overflow-y-auto px-4 pt-4 pb-6">
      <div className="flex items-start justify-between">
        <div className="text-left">
          <div className="run-label">{tierInfo(c.tier).band.join('–')} rating band</div>
          <PixelText text={tierInfo(c.tier).name} size={3} />
        </div>
        <GoldCount value={c.gold} />
      </div>
      {(c.boons.length > 0 || c.charms.length > 0) && (
        <div className="mt-3 flex items-end justify-center gap-1.5">
          {c.boons.map((b) => <TarotCard key={b} info={BOONS[b]} kind="relic" w={50} />)}
          {c.charms.map((ch, k) => <TarotCard key={`${ch}${k}`} info={CHARMS[ch]} kind="consumable" w={44} />)}
        </div>
      )}
      {c.place ? (
        <div className="run-panel run-fadeup mt-4 flex flex-col items-center px-4 py-5 text-center">
          <Sprite name={c.place === 'winner' ? 'crown' : 'shield'} size={64} px={18} />
          <div className="run-title mt-2 text-2xl font-black">{PLACE_TEXT[c.place]}</div>
          <div className="run-sans mt-1 text-sm text-[var(--ink-dim)]">
            {c.place === 'winner' ? `Three wins in a row. The ${tierInfo(c.tier).name} is yours.` : champ && champ !== YOU ? `${opponentById(champ)?.name} went on to win it.` : ''}
          </div>
          {cupXp(c.tier, c.place) > 0 && <div className="run-sans mt-2 text-sm font-black text-[var(--gold-2)]">+{cupXp(c.tier, c.place)} XP</div>}
          <button className="run-btn mt-4 w-full" onClick={() => (sfx('card'), void s.leave())}>Back to the cups</button>
        </div>
      ) : (
        o && (
          <div className="run-panel run-fadeup mt-4 px-3 py-3 text-left">
            <div className="run-label">{roundName(c)} · your match{c.secondChanceUsed && c.yours.at(-1)?.replayed && !c.yours.some((r) => r.round === c.yours.at(-1)!.round && !r.replayed) ? ' · Second Chance replay' : ''}</div>
            <div className="mt-2 flex items-center gap-3">
              <PixelPortrait id={o.id} size={56} px={32} />
              <div className="min-w-0 flex-1">
                <div className="run-title truncate text-xl font-black">{o.name}</div>
                <div className="run-sans text-xs text-[var(--ink-dim)]">plays at {opponentRating(c)} · you have {yourColor(c) === 'w' ? 'White' : 'Black'}</div>
                {c.quirks[o.id] && <div className="run-sans mt-0.5 flex items-center gap-1 text-xs text-[#9fd8ff]"><Sprite name={quirkById(c.quirks[o.id])!.glyph} size={14} px={10} pal={SPIRIT} /> {quirkById(c.quirks[o.id])!.name}{currentRound(c) === 2 ? ' + a hidden quirk' : ''}</div>}
              </div>
            </div>
            <button className="run-btn mt-3 w-full text-lg" onClick={() => (sfx('card'), s.playNext())}>Play the match</button>
          </div>
        )
      )}
      {c.place && <ChronicleCard c={c} />}
      {c.sims.length > 0 && (
        <div className="run-panel mt-4 px-3 py-2 text-left">
          <div className="run-label">Around the bracket</div>
          {chatter(c, Math.min(c.sims.length - 1, c.yours.filter((r) => !r.replayed).length - 1)).map((l) => (
            <div key={l} className="run-sans mt-0.5 text-sm">{l}</div>
          ))}
        </div>
      )}
      <div className="mt-5">
        <Bracket c={c} myName={myName} />
      </div>
      {!c.place && (
        <button className="run-sans mx-auto mt-4 block text-xs font-bold text-[var(--ink-dim)]" onClick={() => void s.leave()}>
          Withdraw from this cup
        </button>
      )}
    </div>
  );
}
