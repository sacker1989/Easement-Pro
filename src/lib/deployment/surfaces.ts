/**
 * Which user-facing surfaces work under a given configuration.
 *
 * WHY THIS EXISTS, AND IT IS A CORRECTION. The readiness report answered one
 * question — can this deploy — with one verdict, and that collapsed a
 * distinction that turns out to decide the whole deployment plan.
 *
 * The audit store gates ARTEFACTS: letters, referral packages, records
 * requests. Those leave the product and go to a utility, an agency or a
 * professional, and the trail has to be able to say afterwards what tier,
 * disclaimer and analysis governed them. That gating is right and stays.
 *
 * It does not gate the ANALYSIS, which is a page a homeowner reads. Nothing is
 * sent, nobody receives anything, and there is no artefact to be answerable
 * for later. /report imports no audit module at all.
 *
 * SO THE FREE TIER SHIPS TODAY. The previous check reported "blocking" on an
 * unset AUDIT_LOG_PATH with the detail "the product generates no letters for
 * anyone" — true, and it reads as "do not deploy". For a product whose free
 * surface is the analysis page and whose letter surfaces are the paid next
 * step, that was the wrong call, and acting on it would have withheld a
 * working product from every user while waiting on a storage decision that
 * only the artefact paths need.
 *
 * DEPLOYABLE IS NOT THE SAME AS FULLY WORKING, which is the other half and the
 * reason this is a list rather than a boolean. An operator deploying
 * unconfigured should know exactly which two surfaces will refuse, so they
 * find out here rather than from a user.
 */

import { resolveAuditStore } from '@/lib/compliance/audit-store-config';
import { COMMERCE_ENABLED } from '@/lib/compliance/commerce-mode';
import { getStateCompliance } from '@/config/state-tiers';
import { evaluateAdvocacyWizardAccess } from '@/lib/gating/advocacy-wizard-access';

export interface Surface {
  readonly id: string;
  readonly route: string;
  readonly what: string;
  /** Whether this surface produces something that leaves the product. */
  readonly producesArtefact: boolean;
  /** False for everything while the product is free. */
  readonly costsTheUser: boolean;
}

export interface SurfaceStatus extends Surface {
  readonly works: boolean;
  /** Why not, when it does not. Null when it works. */
  readonly degradedBecause: string | null;
}

/**
 * The surfaces that make up the free tier.
 *
 * `/report` is the product as far as a homeowner is concerned: what exists,
 * what it means for responsibilities and value, how long it lasts, and what
 * should be on record. Everything else is either a developer harness or an
 * artefact path.
 */
export const FREE_SURFACES: readonly Surface[] = [
  {
    id: 'report',
    route: '/report',
    what:
      'The analysis: county parcel record, what is restricted, who is responsible for what, how ' +
      'long it lasts, what should be on record, and a rough scale of the money involved.',
    producesArtefact: false,
    costsTheUser: false,
  },
  {
    id: 'analyze',
    route: '/analyze',
    what: 'Duration confidence tiering, standalone. A harness rather than a destination.',
    producesArtefact: false,
    costsTheUser: false,
  },
  {
    id: 'inquiry',
    route: '/inquiry',
    what: 'Track 2 — a request for clarification the homeowner sends themselves.',
    producesArtefact: true,
    costsTheUser: false,
  },
  {
    id: 'advocacy',
    route: '/advocacy',
    what: 'Track 1 — a maintenance request letter, handed to the homeowner to send themselves.',
    producesArtefact: true,
    costsTheUser: false,
  },
];

/**
 * Whether each surface works, given the environment.
 *
 * An artefact surface needs a durable audit store. A non-artefact surface
 * needs nothing, which is the finding this module exists to record.
 */
export function surfaceReadiness(
  state: string,
  env: Readonly<Record<string, string | undefined>> = process.env,
): readonly SurfaceStatus[] {
  const store = resolveAuditStore(env);
  const access = evaluateAdvocacyWizardAccess(getStateCompliance(state));

  return FREE_SURFACES.map((surface) => {
    if (surface.producesArtefact && !store.store.durable) {
      return {
        ...surface,
        works: false,
        degradedBecause:
          'No durable audit store is configured, and an artefact that leaves this product must be ' +
          'answerable afterwards. The page loads and refuses to produce the document.',
      };
    }

    if (surface.id === 'advocacy' && !access.available) {
      return {
        ...surface,
        works: false,
        degradedBecause: `Track 1 is not offered in ${state.toUpperCase()}.`,
      };
    }

    if (surface.costsTheUser && !COMMERCE_ENABLED) {
      return {
        ...surface,
        works: false,
        degradedBecause: 'Free mode. Nothing can be charged.',
      };
    }

    return { ...surface, works: true, degradedBecause: null };
  });
}

/** The surfaces a user can rely on right now. */
export function workingSurfaces(
  state: string,
  env?: Readonly<Record<string, string | undefined>>,
): readonly SurfaceStatus[] {
  return surfaceReadiness(state, env).filter((s) => s.works);
}
