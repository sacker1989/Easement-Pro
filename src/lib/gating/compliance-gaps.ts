/**
 * Known compliance gaps — scenarios where the product operates ahead of the
 * legal review its own design says it requires.
 *
 * WHY THIS FILE EXISTS. Searching for a grandfather clause that would let
 * California Track 1 keep operating without a recorded counsel review found
 * none. Cal. Bus. & Prof. Code §6400 et seq. carries a sunset provision
 * (§6401.7, repeal 1 January 2030) but no transition provision for existing
 * providers — and a statutory grandfather clause for LDA *registration* would
 * not answer whether an unreviewed software product may operate anyway. Those
 * are different questions.
 *
 * Substituting a clause borrowed from an unrelated matter was considered and
 * rejected: that manufactures legal authorization for a regulated activity,
 * and unauthorized practice of law is a licensing question that is criminal in
 * many states. So the gap is MARKED here rather than closed or papered over.
 *
 * This registry is deliberately greppable. `COMPLIANCE_GAPS` is the one place
 * to look for "what are we running without", and each entry names what would
 * close it. Nothing here changes behaviour — the gaps are open, and remain so
 * until someone with authority to accept or close them acts.
 */

export interface ComplianceGap {
  /** Stable id, safe to grep and to reference in a ticket. */
  readonly id: string;
  /** Where the gap lives. */
  readonly location: string;
  /** What the product does today. */
  readonly current: string;
  /** What its own design says it should do. */
  readonly required: string;
  /** The concrete artifact that would close it. */
  readonly closedBy: string;
  /** Who can decide to accept the risk instead. Never engineering alone. */
  readonly owner: 'product' | 'counsel' | 'product-and-counsel';
  readonly markedOn: string;
  /**
   * Present when someone with authority chose to operate with this gap open.
   *
   * ACCEPTANCE IS NOT CLOSURE, and the two must not collapse into one field.
   * A closed gap has had its question answered; an accepted gap still has the
   * question open and now has a dated decision to proceed anyway. The product
   * behaves identically in both cases — what differs is whether anyone
   * examined it, which is precisely what an audit trail needs to distinguish.
   * `hasOpenComplianceGaps()` deliberately still counts an accepted gap.
   */
  readonly riskAccepted?: {
    readonly by: 'product' | 'counsel' | 'product-and-counsel';
    readonly on: string;
    /** What was accepted and on what reasoning, in the accepter's terms. */
    readonly rationale: string;
    /** The event that should reopen the decision rather than a date to forget. */
    readonly revisitWhen: string;
  };
}

export const COMPLIANCE_GAPS: readonly ComplianceGap[] = [
  {
    id: 'CA-TRACK1-UNREVIEWED',
    location: 'src/config/state-tiers.ts — STATE_COMPLIANCE_MATRIX.CA',
    current:
      'California is Tier A with track1RequiredFlow "licensed-pathway", so Track 1 — the paid ' +
      'Maintenance Request Letter — is offered. lastReviewedDate is null.',
    required:
      'The entry\'s own note says "do not treat this entry as reviewed until then", and ' +
      'docs/development-strategy-v2.md calls the tier matrix "a hypothesis pending real counsel ' +
      'review per state".',
    closedBy:
      'A written opinion from a California-admitted attorney addressing whether the Track 1 ' +
      'letter output constitutes unauthorized practice of law under Cal. Bus. & Prof. Code ' +
      '§6400 et seq., with the reviewer, bar number, date, and the scope approved. Recording ' +
      'the date alone is not the artifact — the opinion is. ' +
      'MITIGATIONS IMPLEMENTED 2026-08-22 at product direction, in disclaimer-copy v2: the ' +
      'letter states it is not written by an attorney, states that the homeowner is its author ' +
      'and sender, and paid analytical output is framed as recommendations rather than a legal ' +
      'opinion. These narrow the exposure and they do not close this gap. ' +
      'WHY NOT: §6400(c) defines a legal document assistant as a person "who provides ... for ' +
      'compensation, any self-help service to a member of the public who is representing ' +
      'themselves in a legal matter" (fetched 2026-08-22). The definition turns on compensation, ' +
      'self-help service and self-representation — not on whether attorney status is disclaimed. ' +
      'Disclaiming it is what an LDA does, not what exempts one, so these mitigations may place ' +
      'the product inside the LDA regime rather than outside it. That regime requires ' +
      'REGISTRATION AND A BOND, which no disclaimer substitutes for. ' +
      'TWO QUESTIONS, EASILY COLLAPSED AND DIFFERENT: (1) is the output "self-help service" ' +
      'within §6400(d), or does it cross into legal advice, which no registration authorises; ' +
      '(2) if it is within §6400(d), must this product register. §6401\'s exemption list has not ' +
      'been fetched and is the specific next step.',
    owner: 'product-and-counsel',
    markedOn: '2026-08-16',
  },
  {
    id: 'LASTREVIEWEDDATE-NOT-ENFORCED',
    location: 'src/lib/gating/advocacy-wizard-access.ts — evaluateAdvocacyWizardAccess',
    current:
      'Track 1 availability branches only on track1RequiredFlow. lastReviewedDate is declared, ' +
      'documented as required, and read by no code. isTrack1Available() in state-tier-config.ts ' +
      'has no non-test caller at all.',
    required:
      'A control that records whether counsel review happened should gate the feature that ' +
      'depends on it. A compliance control that is never consulted is not a control.',
    closedBy:
      'One branch in evaluateAdvocacyWizardAccess returning unavailable when lastReviewedDate ' +
      'is null. It was written and reverted deliberately: fail-closed is correct for a ' +
      'compliance control, but it takes CA Track 1 dark, and that is a business decision to ' +
      'take knowingly rather than one to arrive at as a side effect of a refactor.',
    owner: 'product',
    markedOn: '2026-08-16',
    riskAccepted: {
      by: 'product',
      on: '2026-08-22',
      rationale:
        'Decision: do NOT go dark. Track 1 stays available in California without a recorded ' +
        'review date, because obtaining the date is not presently feasible and the control would ' +
        'take the only live paid product offline. To be revisited annually or semi-annually as ' +
        'feasible. This is the decision the reverted branch was left open for, taken knowingly. ' +
        'ONE THING IT DOES NOT CHANGE: the hard part is not ascertaining the date — the date is ' +
        'simply when counsel signs off. What is hard is obtaining the review. So this accepts ' +
        'operating without the review itself, which is CA-TRACK1-UNREVIEWED, and that gap is now ' +
        'the load-bearing one rather than a parallel note. The two are coupled: a Track 1 review ' +
        'closes both, and nothing else closes either.',
      revisitWhen:
        'At the next annual or semi-annual pass, whichever comes first; immediately on any State ' +
        'Bar or regulator contact, any consumer complaint touching the letter product, or any ' +
        'decision to advertise Track 1 rather than only offer it.',
    },
  },
  {
    id: 'CA-DURATION-RULES-UNREVIEWED',
    location: 'src/lib/analysis-layer/ca-rule-set.ts',
    current:
      'CA_DURATION_RULE_SET drives user-facing duration findings, including three legal ' +
      'presumptions about appurtenant, prescriptive and in-gross easements.',
    required:
      'The file\'s own header: "this is a starting hypothesis from general research, not a legal ' +
      'determination ... Every rule here needs sign-off from CA counsel before it drives real ' +
      'user-facing output."',
    closedBy:
      'CA counsel confirming each presumption AND the rule ORDER, since classifyByRules is ' +
      'first-match-wins and the ordering encodes doctrine.',
    owner: 'counsel',
    markedOn: '2026-08-16',
  },
  {
    id: 'SCREENING-BANDS-UNCITED',
    location: 'src/lib/valuation/encumbrance-factors.ts — UNCITED_SCREENING_RANGES',
    current:
      'Four percentage bands with no citation anyone has verified drive the dollar range shown to ' +
      'a homeowner on /report. They were recorded-but-not-adopted until the screening estimate ' +
      'shipped; the module name still says UNCITED.',
    required:
      'The module\'s own header states percentage-of-fee is the method Allen (IRWA 2001) and ' +
      'UASFLA §4.6.5 reject, and that the bands are kept "as an order-of-magnitude sanity check ' +
      'on a figure produced by a proper before-and-after appraisal. That is the only sanctioned ' +
      'use." Driving a user-facing figure is not that use.',
    closedBy:
      'A licensed appraiser confirming the bands are defensible as an order-of-magnitude screen ' +
      'and that the three denominators are applied correctly — strip land value for utility and ' +
      'drainage, TOTAL property value for access, development value for conservation. A citation ' +
      'that can be fetched and read would close it properly; a professional opinion on the ' +
      'record would close it adequately.',
    owner: 'product',
    markedOn: '2026-08-22',
    riskAccepted: {
      by: 'product',
      on: '2026-08-22',
      rationale:
        'Cannot be fully determined now; the bands are assumed correct for the time being. The ' +
        'residual exposure is bounded by structure rather than by wording: the output is a range ' +
        'with no point estimate field to render, the arithmetic prints beside it, the figure is ' +
        'rounded hard, and the page places it below the not-determined panel by an asserted rule. ' +
        'Four easement types are refused outright rather than approximated.',
      revisitWhen:
        'Before any paid tier is sold against the figure, before advertising runs in any state, ' +
        'or on the first occasion an appraiser, a regulator or a user disputes a range. Not a ' +
        'date — an event, because a date gets forgotten and these will not.',
    },
  },

  {
    id: 'LA-FALLBACK-UNVERIFIED',
    location: 'src/lib/document-retrieval/la-county-fallback.ts',
    current:
      'Recorder office addresses, hours, search rooms and copy fees are served to users from ' +
      'hardcoded Phase 1 content.',
    required:
      'needsLiveVerificationBeforeLaunch is set true on the record itself, described in the file ' +
      'as "a deliberate flag, not decoration".',
    closedBy:
      'Confirming each figure against the Registrar-Recorder\'s current published fees, hours ' +
      'and addresses, then clearing the flag.',
    owner: 'product',
    markedOn: '2026-08-16',
  },
];

/** Gaps someone with authority chose to operate with. Still open. */
export function acceptedGaps(): readonly ComplianceGap[] {
  return COMPLIANCE_GAPS.filter((g) => g.riskAccepted !== undefined);
}

/** Gaps nobody has examined or accepted. The ones that are simply outstanding. */
export function unexaminedGaps(): readonly ComplianceGap[] {
  return COMPLIANCE_GAPS.filter((g) => g.riskAccepted === undefined);
}

/** Gaps at a given location, for a test or a pre-launch check to assert against. */
export function gapsAt(locationSubstring: string): readonly ComplianceGap[] {
  return COMPLIANCE_GAPS.filter((g) => g.location.includes(locationSubstring));
}

/** True when any gap is open — every entry here is open by construction. */
export function hasOpenComplianceGaps(): boolean {
  return COMPLIANCE_GAPS.length > 0;
}
