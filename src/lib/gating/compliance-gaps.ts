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

/** Gaps at a given location, for a test or a pre-launch check to assert against. */
export function gapsAt(locationSubstring: string): readonly ComplianceGap[] {
  return COMPLIANCE_GAPS.filter((g) => g.location.includes(locationSubstring));
}

/** True when any gap is open — every entry here is open by construction. */
export function hasOpenComplianceGaps(): boolean {
  return COMPLIANCE_GAPS.length > 0;
}
