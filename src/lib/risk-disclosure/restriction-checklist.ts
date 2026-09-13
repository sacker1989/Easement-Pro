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

/**
 * POSITION RECORDED 2026-08-22 (product owner, NOT an engineer).
 *
 * The two permissive cells in this table — `utility.landscaping` and
 * `access.landscaping` — were confirmed as worded, with the governing
 * principle stated as: landscaping must not affect the accessway of the
 * easement area. That is consistent with both cells as written, since each
 * already conditions permission on keeping the way clear, and it is now
 * surfaced explicitly as LANDSCAPING_ACCESS_CONDITION rather than left implied
 * in two separate rationales.
 *
 * STILL NOT AN ENGINEER'S REVIEW. This is a domain question rather than a
 * legal one, so a product-owner position carries more weight here than it
 * would on a statute — but the module header still says what it says, and
 * these two cells are the only places this product tells someone an activity
 * is probably fine.
 */

/**
 * The condition both permissive landscaping answers depend on.
 *
 * Stated once and rendered beside the checklist. Two rationales each implying
 * it separately is how one of them later gets edited to drop it.
 */
export const LANDSCAPING_ACCESS_CONDITION =
  'Landscaping must not affect the accessway of the easement area. Anything that narrows it, ' +
  'blocks it, or would have to be dug up to reach what is buried there is not "landscaping" for ' +
  'this purpose — including plants that are small now and will not stay that way.';

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
