/**
 * Track 3 restriction checklist (fencing / additions / pool / landscaping).
 * Per docs/development-strategy-v2.md, this is part of the risk-disclosure
 * card and ships nationwide with no state-based gating.
 *
 * This is an engineering placeholder heuristic, not a legal or engineering
 * determination — same posture as the CA duration rule set. It needs review
 * before it drives real user-facing output. Where an easement's purpose is
 * unknown, every activity defaults to restricted: a false "not restricted"
 * is a worse failure mode here than an over-cautious warning the homeowner
 * can then verify.
 */

export type RestrictedActivity = 'fencing' | 'additions' | 'pool' | 'landscaping';

export type EasementPurpose = 'utility' | 'drainage' | 'access' | 'sewer' | 'unknown';

export interface RestrictionChecklistItem {
  activity: RestrictedActivity;
  restricted: boolean;
  rationale: string;
}

const ACTIVITIES: readonly RestrictedActivity[] = ['fencing', 'additions', 'pool', 'landscaping'];

type ActivityRule = { restricted: boolean; rationale: string };
type RestrictionTable = Record<EasementPurpose, Record<RestrictedActivity, ActivityRule>>;

const RESTRICTION_TABLE: RestrictionTable = {
  utility: {
    fencing: {
      restricted: true,
      rationale: 'Permanent fencing can block crew and equipment access to utility lines.',
    },
    additions: {
      restricted: true,
      rationale: 'Building additions are generally prohibited within a utility easement footprint.',
    },
    pool: {
      restricted: true,
      rationale: 'Pools and other permanent structures are generally prohibited within a utility easement footprint.',
    },
    landscaping: {
      restricted: false,
      rationale: 'Shallow-rooted plants are generally permitted, but keep access points clear.',
    },
  },
  drainage: {
    fencing: {
      restricted: true,
      rationale: 'Fencing can obstruct water flow and block maintenance access to a drainage easement.',
    },
    additions: {
      restricted: true,
      rationale: 'Building additions can alter drainage flow and are generally prohibited.',
    },
    pool: {
      restricted: true,
      rationale: 'Pools can interfere with drainage function and are generally prohibited.',
    },
    landscaping: {
      restricted: true,
      rationale: 'Landscaping that alters grading or blocks flow is generally restricted; check before planting.',
    },
  },
  access: {
    fencing: {
      restricted: true,
      rationale: 'Fencing across an access/ingress-egress easement can block the right of way.',
    },
    additions: {
      restricted: true,
      rationale: 'Building additions cannot obstruct the access path.',
    },
    pool: {
      restricted: true,
      rationale: 'A pool cannot obstruct the access path.',
    },
    landscaping: {
      restricted: false,
      rationale: 'Landscaping is generally permitted if it does not narrow or block the access path.',
    },
  },
  sewer: {
    fencing: {
      restricted: true,
      rationale: 'Permanent fencing can block excavation access for sewer line repairs.',
    },
    additions: {
      restricted: true,
      rationale: 'Building additions are generally prohibited above a sewer line easement.',
    },
    pool: {
      restricted: true,
      rationale: 'Pools are generally prohibited above a sewer line easement.',
    },
    landscaping: {
      restricted: true,
      rationale: 'Deep-rooted trees and shrubs can damage sewer lines and are generally restricted.',
    },
  },
  unknown: {
    fencing: {
      restricted: true,
      rationale: "Easement purpose is unknown; treating this activity as restricted until confirmed is the safer default.",
    },
    additions: {
      restricted: true,
      rationale: "Easement purpose is unknown; treating this activity as restricted until confirmed is the safer default.",
    },
    pool: {
      restricted: true,
      rationale: "Easement purpose is unknown; treating this activity as restricted until confirmed is the safer default.",
    },
    landscaping: {
      restricted: true,
      rationale: "Easement purpose is unknown; treating this activity as restricted until confirmed is the safer default.",
    },
  },
};

export function buildRestrictionChecklist(purpose: EasementPurpose): RestrictionChecklistItem[] {
  const table = RESTRICTION_TABLE[purpose];
  return ACTIVITIES.map((activity) => ({ activity, ...table[activity] }));
}
