import type { CoachContext } from '../context';
import type { Finding, FindingKind, Theme } from '../types';

export type RuleResult = Omit<Finding, 'rule' | 'kind' | 'theme'> & { theme?: Theme };

/**
 * A coaching rule. To add a new one, write a `detect` function that inspects the
 * context and returns a sentence (or null), then add it to a rule list —
 * earlier rules in a list win when several match.
 */
export interface Rule {
  id: string;
  kind: FindingKind;
  theme: Theme;
  detect(ctx: CoachContext): RuleResult | null;
}
