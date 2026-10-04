/**
 * The duration rules that read a DOCUMENT rather than apply a state's law.
 *
 * WHY THESE MOVED HERE. They were declared in ca-rule-set.ts with `ca-`
 * prefixed ids, and they were never California's. "The instrument contains the
 * word perpetual and states no term" is a reading of a document: any careful
 * person would agree with it, it holds identically in Florida, and it asserts
 * nothing about what any state's law does with the fact. Adding a second state
 * is what made that visible — the alternative was copying five rules into
 * Florida and maintaining two copies of a jurisdiction-neutral reading.
 *
 * THE IDS STAY STATE-PREFIXED, which looks like a contradiction and is not.
 * A rule id is not only a key: it is written into the audit record of every
 * send, it is asserted across the suite, and `analyzeEasement` returns it so
 * the UI can branch. Collapsing `ca-express-perpetual` to `express-perpetual`
 * would rewrite the meaning of records already on disk — a record saying
 * `ca-express-perpetual` would no longer correspond to any rule the code can
 * produce. So the factory stamps the prefix and the ids are unchanged, which
 * is the whole point: one definition, and nothing downstream can tell.
 *
 * ORDER IS PART OF THE CONTRACT. `classifyByRules` is first-match-wins, and
 * the sequence here is deliberate: unreadable before anything, conflicting
 * clauses before either express rule (a document saying both "perpetual" and
 * "for twenty years" is ambiguous, not perpetual), and unknown type before the
 * express rules so a document whose character cannot be established does not
 * get a confident duration anyway. A state whose law resolves the conflict the
 * other way needs a different ORDER, which means it needs its own array rather
 * than this one — see `StateEasementRuleSet.durationRules`.
 */

import type { ConfidenceRule } from './confidence-tiering';
import type { DurationDetermination, ExpressDurationBasis } from './duration-basis';
import type { EasementDurationFacts } from './duration-facts';

/**
 * Thrown for a malformed prefix. A programmer error, not a jurisdiction that
 * is unsupported — and worth failing loudly because the prefix ends up in
 * audit records, where a typo is discovered long after the records are written.
 */
export class InvalidRulePrefixError extends Error {
  constructor(prefix: string) {
    super(
      `"${prefix}" is not a valid rule-id prefix. Use the lowercase two-letter state code, e.g. ` +
        '"ca" or "fl". The prefix is written into the audit record of every send, so it is ' +
        'validated here rather than discovered later in a log.',
    );
    this.name = 'InvalidRulePrefixError';
  }
}

/**
 * The five observation rules, with `${statePrefix}-` stamped onto each id.
 *
 * Generic over the basis union so a state that adds doctrinal bases of its own
 * can hold these in the same array. The produced bases are always the two
 * express ones, so widening the parameter never widens what a rule can return.
 */
export function documentObservationRules<B extends string = ExpressDurationBasis>(
  statePrefix: string,
): ReadonlyArray<ConfidenceRule<EasementDurationFacts, DurationDetermination<B | ExpressDurationBasis>>> {
  if (!/^[a-z]{2}$/.test(statePrefix)) {
    throw new InvalidRulePrefixError(statePrefix);
  }

  return [
    {
      id: `${statePrefix}-illegible-document`,
      claimType: 'observation',
      evaluate(facts) {
        if (!facts.documentLegible) {
          return {
            tier: 'flagged-ambiguous',
            flagReason: 'Document image quality is too poor to confirm duration language.',
          };
        }
        return null;
      },
    },
    {
      id: `${statePrefix}-conflicting-duration-clauses`,
      claimType: 'observation',
      evaluate(facts) {
        if (facts.hasPerpetualLanguage && facts.hasTermOrConditionSubsequent) {
          return {
            tier: 'flagged-ambiguous',
            flagReason:
              'Document contains both perpetual language and a term/condition-subsequent ' +
              'clause; these conflict and require manual review.',
          };
        }
        return null;
      },
    },
    {
      id: `${statePrefix}-unknown-easement-type`,
      claimType: 'observation',
      evaluate(facts) {
        if (facts.easementType === 'unknown') {
          return {
            tier: 'flagged-ambiguous',
            flagReason:
              'Easement type (appurtenant, in gross, or prescriptive) could not be ' +
              'determined from the document.',
          };
        }
        return null;
      },
    },
    {
      id: `${statePrefix}-express-term-limited`,
      claimType: 'observation',
      evaluate(facts) {
        if (facts.hasTermOrConditionSubsequent) {
          return {
            tier: 'clear',
            value: {
              basis: 'term-limited',
              summary:
                'The document expressly limits the easement to a specific term or ' +
                'condition subsequent.',
            },
          };
        }
        return null;
      },
    },
    {
      id: `${statePrefix}-express-perpetual`,
      claimType: 'observation',
      evaluate(facts) {
        if (facts.hasPerpetualLanguage) {
          return {
            tier: 'clear',
            value: {
              basis: 'perpetual-express',
              summary: 'The document expressly states the easement is perpetual.',
            },
          };
        }
        return null;
      },
    },
  ];
}
