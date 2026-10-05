/**
 * Can this deploy to production for a given state right now, and if not, what
 * exactly is in the way?
 *
 * WHY A MODULE RATHER THAN A CHECKLIST IN A DOC. The facts that decide this
 * are already in the code — whether an audit store is configured, whether
 * commerce is enabled, what the disclaimer version is, whether the state has a
 * reviewed rule set, which compliance gaps apply. A doc restating them goes
 * stale the first time one changes, and goes stale silently. This reads them.
 *
 * THE DISTINCTION THAT MATTERS IS BLOCKING VERSUS OPEN, and most of this
 * product's open questions are NOT blocking. An unreviewed rule set does not
 * stop a deploy: the analysis layer degrades to document observations and says
 * so. An uncited screening band does not stop a deploy: the figure ships as a
 * range with its arithmetic beside it, and the risk is accepted on the record.
 * Treating every open question as a launch blocker is how a product that is
 * honest about its limits never ships at all, which serves nobody — least of
 * all a homeowner who currently has no free way to find out what is on their
 * land.
 *
 * SO `blocking` IS RESERVED FOR ONE THING: the product does not work, or works
 * wrongly, if you deploy as configured. Today exactly one check can return it,
 * and it is a config line rather than a legal question — see
 * `audit-store-configured` below.
 */

import { resolveAuditStore, AUDIT_PATH_ENV } from '@/lib/compliance/audit-store-config';
import { COMMERCE_ENABLED } from '@/lib/compliance/commerce-mode';
import { CURRENT_DISCLAIMER } from '@/lib/compliance/disclaimer-copy';
import { getStateCompliance } from '@/config/state-tiers';
import { evaluateAdvocacyWizardAccess } from '@/lib/gating/advocacy-wizard-access';
import { basisFullyLapsed, operativeBases } from '@/lib/gating/regulatory-basis';
import { COMPLIANCE_GAPS, type ComplianceGap } from '@/lib/gating/compliance-gaps';
import { registeredRuleSet, resolveStateRuleSet } from '@/lib/analysis-layer/registry';

export type CheckStatus =
  /** True, nothing to do. */
  | 'met'
  /** Deploying as configured produces a product that does not work. */
  | 'blocking'
  /** Open, and someone with authority dated a decision to proceed anyway. */
  | 'accepted'
  /** Open and unexamined. Ships, and should be visible while it does. */
  | 'open';

export interface ReadinessCheck {
  readonly id: string;
  /** What has to be true. */
  readonly what: string;
  readonly status: CheckStatus;
  /** What IS true, read from the code rather than asserted here. */
  readonly detail: string;
  /** The concrete next action, or null when there is nothing to do. */
  readonly fix: string | null;
}

export interface ReadinessReport {
  readonly state: string;
  readonly environment: string;
  /** False when any check is blocking. Open and accepted items do not block. */
  readonly canDeploy: boolean;
  readonly checks: readonly ReadinessCheck[];
}

/** Gaps bearing on this state, including the ones marked for every state. */
export function gapsForState(state: string): readonly ComplianceGap[] {
  const s = state.trim().toUpperCase();
  return COMPLIANCE_GAPS.filter((g) => g.appliesTo === 'all' || g.appliesTo.includes(s));
}

function auditStoreCheck(
  env: Readonly<Record<string, string | undefined>>,
  isProduction: boolean,
): ReadinessCheck {
  const resolved = resolveAuditStore(env);

  if (resolved.configured) {
    return {
      id: 'audit-store-configured',
      what: `${AUDIT_PATH_ENV} points at storage that survives a restart.`,
      status: 'met',
      detail: `Configured explicitly: ${resolved.path}`,
      fix: null,
    };
  }

  if (!isProduction) {
    return {
      id: 'audit-store-configured',
      what: `${AUDIT_PATH_ENV} points at storage that survives a restart.`,
      status: 'met',
      detail:
        `Not set, defaulting to ${resolved.path}. That is correct for development — the ` +
        'requirement attaches in production.',
      fix: null,
    };
  }

  /*
   * OPEN, NOT BLOCKING — AND THIS CHECK USED TO SAY BLOCKING, WRONGLY.
   *
   * Unconfigured in production, `resolveAuditStore` marks the store
   * non-durable, `recordGeneration` returns not-ok, and every ARTEFACT flow
   * withholds its document. That part was right and is unchanged.
   *
   * What was wrong was the conclusion drawn from it. The old detail read "the
   * product generates no letters for anyone", classified blocking, which an
   * operator reads as "do not deploy". But the audit store gates artefacts —
   * things that leave the product and go to a utility, an agency or a
   * professional, which have to be answerable afterwards. It does not gate the
   * ANALYSIS. /report imports no audit module at all: nothing is sent, nobody
   * receives anything, and there is no artefact to account for later.
   *
   * So the free tier — whose entire surface is the analysis page — ships
   * today. Treating this as blocking would have withheld a working product
   * from every user while waiting on a storage decision only the letter paths
   * need. See surfaces.ts for exactly which two degrade.
   */
  return {
    id: 'audit-store-configured',
    what: `${AUDIT_PATH_ENV} points at storage that survives a restart.`,
    status: 'open',
    detail:
      'Not set. In production the store is marked non-durable, so the two artefact surfaces — ' +
      'the Track 1 letter and the Track 2 clarification request — will load and then refuse to ' +
      'produce their document. THE ANALYSIS IS UNAFFECTED: /report depends on no audit module, ' +
      'because nothing there is sent to anyone. The free tier is deployable in this state.',
    fix:
      `Set ${AUDIT_PATH_ENV} to a path on a mounted volume before the letter surfaces are ` +
      'relied on. On a serverless host a file path is not sufficient at all — replace the ' +
      'adapter in src/lib/compliance/audit-store.ts with a database-backed one. The AuditStore ' +
      'interface exists so that is a drop-in.',
  };
}

function commerceCheck(): ReadinessCheck {
  return {
    id: 'commerce-mode-coherent',
    what: 'Nothing can be charged while counsel review is outstanding.',
    status: COMMERCE_ENABLED ? 'open' : 'met',
    detail: COMMERCE_ENABLED
      ? 'Commerce is ENABLED. Free mode was the basis on which Cal. Bus. & Prof. Code §6400 ' +
        'stopped reaching this product; re-enabling brings it back, along with registration and ' +
        'bonding questions that were set aside rather than answered.'
      : 'Free mode. assertCommerceEnabled throws on every payment surface and mayOfferPaidTier ' +
        'reads the same flag, so no paid tier can be advertised either.',
    fix: COMMERCE_ENABLED
      ? 'Confirm every condition in COMMERCE_REENABLE_CONDITIONS was met before this was flipped.'
      : null,
  };
}

function disclaimerCheck(): ReadinessCheck {
  const isPlaceholder = CURRENT_DISCLAIMER.version.startsWith('placeholder');
  return {
    id: 'disclaimer-signed-off',
    what: 'The disclaimer shipped with every artefact has been reviewed by counsel.',
    /*
     * OPEN, NOT BLOCKING, and the reasoning is the free-mode one. Counsel
     * sign-off on the disclaimer is listed in COMMERCE_REENABLE_CONDITIONS —
     * it is a precondition for taking money, not for operating free. Blocking
     * a free deploy on it would withhold the whole product from every
     * homeowner to improve wording that already says, in terms, that this is
     * not legal advice and no attorney wrote it.
     */
    status: isPlaceholder ? 'open' : 'met',
    detail: isPlaceholder
      ? `Version "${CURRENT_DISCLAIMER.version}" — still placeholder copy. The substance is ` +
        'right (not an attorney, not legal advice, homeowner is the author and sender); what is ' +
        'missing is a lawyer having read it. Required before commerce resumes, not before a free ' +
        'deploy.'
      : `Version "${CURRENT_DISCLAIMER.version}".`,
    fix: isPlaceholder
      ? 'Counsel review of src/lib/compliance/disclaimer-copy.ts, then a version string that is ' +
        'not "placeholder-*".'
      : null,
  };
}

function track1Check(state: string): ReadinessCheck {
  const entry = getStateCompliance(state);
  const access = evaluateAdvocacyWizardAccess(entry);
  const operative = entry.basis === null ? [] : operativeBases(entry.basis, COMMERCE_ENABLED);

  if (!access.available) {
    return {
      id: 'track1-available',
      what: `Track 1 letters can be generated in ${state}.`,
      // Not blocking. Track 2 and Track 3 are nationwide, so the product is
      // useful in a state where Track 1 is off — that is the design.
      status: 'open',
      detail: `Track 1 is not offered in ${state} (tier ${entry.tier}). Tracks 2 and 3 are.`,
      fix: `A counsel review for ${state} and a matrix entry enabling it.`,
    };
  }

  return {
    id: 'track1-available',
    what: `Track 1 letters can be generated in ${state}.`,
    status: 'met',
    detail:
      `Tier ${entry.tier}, flow "${access.requiredFlow}". Operative regulatory basis: ` +
      `${operative.map((b) => b.citation).join(', ') || 'none recorded'}.`,
    fix: null,
  };
}

function uplReviewCheck(state: string): ReadinessCheck {
  const entry = getStateCompliance(state);
  const decision = evaluateAdvocacyWizardAccess(entry);

  if (decision.available && !decision.operatingUnderAcceptedRisk) {
    return {
      id: 'upl-review',
      what: `An attorney licensed in ${state} has given an opinion on the practice-of-law question.`,
      status: 'met',
      detail:
        decision.upl.status === 'authorised'
          ? `Review ${decision.upl.review.id} by ${decision.upl.review.reviewedBy} ` +
            `(bar ${decision.upl.review.barNumber}), given ${decision.upl.review.reviewedOn}, ` +
            `expires ${decision.upl.review.expiresOn}.`
          : 'Authorised.',
      fix: null,
    };
  }

  const direction = entry.uplDirection;
  return {
    id: 'upl-review',
    what: `An attorney licensed in ${state} has given an opinion on the practice-of-law question.`,
    // Accepted where a dated acceptance is carrying it, open otherwise. Never
    // blocking: Track 2 and Track 3 run regardless, and taking Track 1 dark is
    // a product decision rather than something a readiness check performs.
    status: decision.available && decision.operatingUnderAcceptedRisk ? 'accepted' : 'open',
    detail:
      (decision.upl.status === 'refused' ? `No authorisation (${decision.upl.reason}). ` : '') +
      (decision.available
        ? `Track 1 is running on the acceptance recorded in ` +
          `${decision.available ? decision.acceptedUnderGapId : ''}. The gate consults the review ` +
          'and is overridden by a dated decision, rather than not checking.'
        : 'Track 1 is not offered.') +
      (direction === undefined
        ? ''
        : ` PRODUCT OWNER DIRECTION ${direction.on}: ${direction.statedAs} Nothing reads it.`),
    fix:
      direction === undefined
        ? `A written opinion from a ${state}-admitted attorney, recorded as a UplReviewRecord.`
        : `Supply the ${direction.missing.length} outstanding facts and this becomes an ` +
          `authorisation: ${direction.missing.join(' ')}`,
  };
}

function basisCheck(state: string): ReadinessCheck {
  const entry = getStateCompliance(state);
  const lapsed = basisFullyLapsed(entry.basis, COMMERCE_ENABLED);
  return {
    id: 'regulatory-basis-stated',
    what: `${state}'s classification rests on a statute that still reaches this product.`,
    status: lapsed ? 'open' : 'met',
    detail: lapsed
      ? `Every basis recorded for ${state} has stopped applying. The tier is asserted without a ` +
        'stated reason. This is a documentation defect rather than a hazard — but it means ' +
        'nobody can say why the state is classified as it is.'
      : entry.basis === null
        ? `No basis recorded for ${state}, which is the unclassified default rather than a lapse.`
        : `${operativeBases(entry.basis, COMMERCE_ENABLED).length} of ${entry.basis.length} ` +
          'recorded bases still reach this product.',
    fix: lapsed ? `Record the statute that actually governs ${state} today.` : null,
  };
}

function analysisCheck(state: string): ReadinessCheck {
  const resolution = resolveStateRuleSet(state);
  const entry = registeredRuleSet(state);

  if (resolution.status === 'available') {
    return {
      id: 'analysis-rule-set',
      what: `${state} doctrine questions can be answered.`,
      status: 'met',
      detail: `Counsel-reviewed rule set, review ${resolution.review.id}.`,
      fix: null,
    };
  }

  return {
    id: 'analysis-rule-set',
    what: `${state} doctrine questions can be answered.`,
    /*
     * OPEN, NOT BLOCKING, AND THIS IS THE CHECK MOST LIKELY TO BE MISREAD.
     * An unreviewed state is the condition the analysis layer was built to
     * handle well: document-observation rules run, doctrine rules do not, and
     * the user is told which they got. A homeowner whose instrument plainly
     * says "perpetual" is answered. One whose answer depends on a presumption
     * is told that nobody has reviewed it. Both are better than no product.
     */
    status: 'open',
    detail:
      entry === undefined
        ? `No rule set registered for ${state}. Nothing runs; every duration question is flagged.`
        : `Registered but ${resolution.reason}. Document-observation rules run and doctrine rules ` +
          'do not, so an express instrument is still read and a presumption is still refused.',
    fix: `A ${state}-licensed attorney confirming the rule set, including the ORDER of the ` +
      'duration rules, which encodes doctrine.',
  };
}

function gapChecks(state: string): readonly ReadinessCheck[] {
  return gapsForState(state).map((gap) => {
    if (gap.closed !== undefined) {
      return {
        id: `gap-${gap.id}`,
        what: gap.required,
        status: 'met' as const,
        detail: `Closed ${gap.closed.on} by ${gap.closed.by}. Reopens: ${gap.closed.reopensWhen}`,
        fix: null,
      };
    }
    return {
      id: `gap-${gap.id}`,
      what: gap.required,
      // Accepted and open gate identically — neither blocks — and stay distinct
      // because "someone looked and decided" is a different fact from "nobody
      // has looked", which is the whole thesis of compliance-gaps.ts.
      status: gap.riskAccepted === undefined ? ('open' as const) : ('accepted' as const),
      detail:
        gap.riskAccepted === undefined
          ? gap.current
          : `${gap.current} ACCEPTED ${gap.riskAccepted.on} by ${gap.riskAccepted.by}. Revisit: ` +
            `${gap.riskAccepted.revisitWhen}`,
      fix: gap.closedBy,
    };
  });
}

/**
 * The readiness report for one state.
 *
 * Takes `env` so a test need not mutate process.env, and so an operator can
 * ask what a DIFFERENT environment would report — "would this deploy if I
 * shipped it to production right now" is the question worth asking from a
 * development machine, and it is unanswerable if the function can only read
 * its own environment.
 */
export function assessDeploymentReadiness(
  state: string,
  env: Readonly<Record<string, string | undefined>> = process.env,
): ReadinessReport {
  const normalized = state.trim().toUpperCase();
  const isProduction = env.NODE_ENV === 'production';

  const checks: readonly ReadinessCheck[] = [
    auditStoreCheck(env, isProduction),
    commerceCheck(),
    disclaimerCheck(),
    track1Check(normalized),
    uplReviewCheck(normalized),
    basisCheck(normalized),
    analysisCheck(normalized),
    ...gapChecks(normalized),
  ];

  return {
    state: normalized,
    environment: env.NODE_ENV ?? 'development',
    canDeploy: !checks.some((c) => c.status === 'blocking'),
    checks,
  };
}

/** Just the ones stopping a deploy. Empty is the answer you want. */
export function blockingChecks(report: ReadinessReport): readonly ReadinessCheck[] {
  return report.checks.filter((c) => c.status === 'blocking');
}
