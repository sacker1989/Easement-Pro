import type { ConfidenceRule } from './confidence-tiering';

/**
 * California-specific easement duration rule set. Per docs/development-strategy-v2.md,
 * "Compliance Agent" section, this rule set is what the Analysis Layer's gating
 * logic actually executes against — the Compliance Agent owns and versions its
 * content; engineering (this file's shape) owns the schema it plugs into.
 *
 * IMPORTANT: this is a starting hypothesis from general research, not a legal
 * determination — same posture as the state-tier compliance matrix. Every
 * rule here needs sign-off from CA counsel before it drives real user-facing
 * output, exactly like LA_COUNTY_FALLBACK_DATA needs live verification before
 * launch. Do not treat this as authoritative.
 */

export type EasementType = 'appurtenant' | 'in-gross' | 'prescriptive' | 'unknown';

export interface EasementDurationFacts {
  easementType: EasementType;
  /** Document contains language like "perpetual," "forever," "runs with the land." */
  hasPerpetualLanguage: boolean;
  /** Document contains a specific term (e.g. "for 20 years") or condition subsequent (e.g. "until X occurs"). */
  hasTermOrConditionSubsequent: boolean;
  /** Whether the source document/image was legible enough to trust the two flags above. */
  documentLegible: boolean;
}

export type DurationBasis =
  | 'perpetual-express'
  | 'perpetual-appurtenant-default'
  | 'perpetual-prescriptive-default'
  | 'term-limited'
  | 'life-of-grantee';

export interface DurationDetermination {
  basis: DurationBasis;
  summary: string;
}

export const CA_DURATION_RULE_SET: ReadonlyArray<
  ConfidenceRule<EasementDurationFacts, DurationDetermination>
> = [
  {
    id: 'ca-illegible-document',
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
    id: 'ca-conflicting-duration-clauses',
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
    id: 'ca-unknown-easement-type',
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
    id: 'ca-express-term-limited',
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
    id: 'ca-express-perpetual',
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
  {
    id: 'ca-appurtenant-default-presumption',
    evaluate(facts) {
      if (facts.easementType === 'appurtenant') {
        return {
          tier: 'likely-with-caveat',
          value: {
            basis: 'perpetual-appurtenant-default',
            summary:
              'No express duration language was found. Under California law, ' +
              'appurtenant easements are presumed to run with the land indefinitely ' +
              'absent contrary language.',
          },
          caveat:
            'This is a default legal presumption, not an explicit statement in the ' +
            'document — it could be rebutted by language elsewhere in the chain of ' +
            'title that this analysis did not capture.',
        };
      }
      return null;
    },
  },
  {
    id: 'ca-prescriptive-default-presumption',
    evaluate(facts) {
      if (facts.easementType === 'prescriptive') {
        return {
          tier: 'likely-with-caveat',
          value: {
            basis: 'perpetual-prescriptive-default',
            summary:
              'No recorded instrument governs a prescriptive easement\'s duration. Once ' +
              'established under California law, a prescriptive easement is generally ' +
              'treated as perpetual absent abandonment or another terminating event.',
          },
          caveat:
            'Prescriptive easements are established by use, not by a recorded ' +
            'instrument — this determination cannot be confirmed by document review alone.',
        };
      }
      return null;
    },
  },
  {
    id: 'ca-in-gross-default-presumption',
    evaluate(facts) {
      if (facts.easementType === 'in-gross') {
        return {
          tier: 'likely-with-caveat',
          value: {
            basis: 'life-of-grantee',
            summary:
              'No express duration language was found. An easement in gross (personal ' +
              'to the grantee) is not presumed to run with the land, and may terminate ' +
              'at the death of the grantee absent language extending it to heirs or assigns.',
          },
          caveat:
            'Whether this easement extends beyond the original grantee depends on ' +
            'specific instrument language this analysis did not find — treat this ' +
            'determination as provisional.',
        };
      }
      return null;
    },
  },
];

export const CA_DURATION_FALLBACK = {
  tier: 'flagged-ambiguous',
  flagReason: 'No CA duration rule matched this set of facts; this needs manual review.',
} as const;
