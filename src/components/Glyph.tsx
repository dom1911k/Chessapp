// One consistent icon system: Lucide icons, optionally in a tinted medallion.
import {
  ArrowRightLeft, Award, BookOpen, BrickWall, CalendarCheck, Castle, ChessBishop, ChessKing, ChessKnight, ChessPawn, ChessQueen,
  ChessRook, CloudLightning, Crosshair, Crown, Eye, Flag, Flame, Gem, Gift, GraduationCap, Library, Lock, Map, Medal, Microscope,
  Pin, Repeat, Route, ScrollText, Shield, Shuffle, Sparkles, Sprout, Square, Star, Swords, Target, Timer, TreeDeciduous, Trophy,
  Utensils, Zap, Brain, type LucideIcon,
} from 'lucide-react';

export const GLYPHS: Record<string, LucideIcon> = {
  king: ChessKing, queen: ChessQueen, rook: ChessRook, bishop: ChessBishop, knight: ChessKnight, pawn: ChessPawn,
  gift: Gift, fork: Utensils, pin: Pin, skewer: ArrowRightLeft, eye: Eye, castle: Castle, shield: Shield, trap: Lock,
  shuffle: Shuffle, zap: Zap, target: Target, crown: Crown, flag: Flag, book: BookOpen, bridge: Route, wall: BrickWall,
  square: Square, trophy: Trophy, timer: Timer, brain: Brain, gem: Gem, repeat: Repeat, cap: GraduationCap, scroll: ScrollText,
  calendar: CalendarCheck, sprout: Sprout, tree: TreeDeciduous, map: Map, medal: Medal, award: Award, star: Star,
  microscope: Microscope, library: Library, sparkles: Sparkles, flame: Flame, lightning: CloudLightning, swords: Swords,
  crosshair: Crosshair,
};

export type Tint = 'green' | 'gold' | 'rose' | 'blue' | 'violet' | 'stone';

const TINTS: Record<Tint, string> = {
  green: 'bg-brand-100 text-brand-700 dark:bg-brand-700/25 dark:text-brand-100',
  gold: 'bg-gold-300/45 text-[#8a6416] dark:bg-gold-500/20 dark:text-gold-300',
  rose: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200',
  blue: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-200',
  violet: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200',
  stone: 'bg-stone-200 text-stone-600 dark:bg-stone-800 dark:text-stone-300',
};

/** An icon by name; falls back to rendering the text (for legacy emoji). */
export function Glyph({ name, size = 20, className = '' }: { name: string; size?: number; className?: string }) {
  const I = GLYPHS[name];
  return I ? <I size={size} strokeWidth={2} className={className} /> : <span className={className}>{name}</span>;
}

/** Icon in a rounded, tinted medallion. */
export function Medallion({ name, tint = 'green', size = 44, muted = false }: { name: string; tint?: Tint; size?: number; muted?: boolean }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-[32%] ${muted ? TINTS.stone : TINTS[tint]}`}
      style={{ width: size, height: size }}
    >
      <Glyph name={name} size={Math.round(size * 0.5)} />
    </span>
  );
}
