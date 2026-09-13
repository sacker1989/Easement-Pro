import type { ConfidenceRule } from './confidence-tiering';
import type { DurationDetermination, ExpressDurationBasis } from './duration-basis';
import type { EasementDurationFacts } from './duration-facts';

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

/**
 * The LEGAL CHARACTER of an easement — how it is held and how it arose.
 *
 * Renamed from `EasementType` 2026-08-02. That name was also exported by
 * src/lib/easements/easement-types.ts for an unrelated axis: the PHYSICAL
 * taxonomy of what the easement carries (utility-overhead, sewer, drainage,
 * and so on). Two exported types with one name and two meanings is a
 * collision waiting for the first consumer that imports both barrels, and the
 * phase specs need both axes on the same record simultaneously.
 *
 * The two are orthogonal and both are needed: a sewer easement (physical) may
 * be appurtenant or in gross (legal), and the valuation and the doctrine
 * questions turn on different ones.
 */
// Hoisted to duration-facts.ts in Phase 3 and re-exported here so existing
// importers keep working. These describe what a DOCUMENT says, which holds in
// any jurisdiction; declaring them beside California's doctrinal outcomes meant
// every later state would have inherited California's vocabulary with them.
export type { EasementLegalCharacter, EasementDurationFacts } from './duration-facts';

/**
 * California duration bases: the shared instrument-derived ones, plus the
 * three that are CA legal PRESUMPTIONS rather than facts about a document.
 *
 * The three below are doctrine and belong to this state file. Another state
 * may presume the opposite, or have no presumption at all — see
 * duration-basis.ts for why the split exists.
 */
export type CaDurationBasis =
  | ExpressDurationBasis
  /** CA presumes an appurtenant easement runs with the land absent contrary language. */
  | 'perpetual-appurtenant-default'
  /** CA treats an established prescriptive easement as perpetual absent a terminating event. */
  | 'perpetual-prescriptive-default'
  /** CA does not presume an easement in gross survives the grantee. */
  | 'life-of-grantee';

/** A CA duration finding, narrowed to the bases this state's rules can produce. */
export type CaDurationDetermination = DurationDetermination<CaDurationBasis>;

export const CA_DURATION_RULE_SET: ReadonlyArray<
  ConfidenceRule<EasementDurationFacts, CaDurationDetermination>
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
