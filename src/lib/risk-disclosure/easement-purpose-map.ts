/**
 * Maps the twelve physical easement types onto the restriction table's five
 * purposes, and records which of those mappings has actually been reviewed.
 *
 * WHY THIS FILE EXISTS. `EASEMENT_TYPES` carries twelve members. The Track 3
 * restriction checklist has rules for five purposes, and the UI dropdown
 * offered five options. Seven types were therefore unreachable from the
 * interface and had no defined behaviour if they arrived from anywhere else —
 * not refused, just absent, which is the failure mode this project keeps
 * finding: a gap that reads as coverage.
 *
 * THE MAPPING IS NOT UNIFORMLY SAFE, AND THAT IS THE POINT. Some rows are
 * obvious — `utility-overhead` and `utility-underground` are both `utility`,
 * `storm-drain` is `drainage`. Others look obvious and are not:
 *
 *   - `pipeline` is NOT mapped to `utility`. A transmission pipeline carrying
 *     gas or petroleum is governed by federal and operator setback rules that
 *     are stricter than anything in the utility row, and 49 CFR 192/195
 *     encroachment restrictions have no analogue for an electric service drop.
 *     Mapping it to `utility` would return "landscaping generally permitted"
 *     over a high-pressure line. It maps to `unknown`, where everything is
 *     restricted.
 *   - `conservation` restricts the WHOLE PARCEL by its terms rather than a
 *     strip, so a footprint-shaped answer misdescribes it entirely.
 *   - `prescriptive` has no instrument to read, so its scope is whatever use
 *     established it. There is nothing to tabulate.
 *   - `slope` has no researched rules here at all.
 *
 * `unknown` restricts every activity, which the restriction table documents as
 * the deliberate safe default: a false "not restricted" is a worse failure
 * than an over-cautious warning the homeowner can go and verify.
 *
 * WHAT `reviewed: false` MEANS. It marks a mapping that is an engineering
 * judgement and has not been reviewed by anyone qualified — the same posture
 * as `CA_DURATION_RULE_SET` and the marked entries in `compliance-gaps.ts`.
 * It is surfaced in the UI rather than hidden, because the honest statement to
 * a homeowner is "we treat this conservatively and here is why", not silence.
 */

import type { EasementType } from '@/lib/easements/easement-types';
import type { EasementPurpose } from './restriction-checklist';

export interface PurposeMapping {
  readonly purpose: EasementPurpose;
  /** False where the mapping is an unreviewed engineering judgement. */
  readonly reviewed: boolean;
  /** Shown to the user. Explains the mapping, and any conservatism in it. */
  readonly note: string;
  /** Plain-language label for the interface. */
  readonly label: string;
}

/**
 * Exhaustive by construction. `satisfies Record<EasementType, …>` means a
 * thirteenth easement type fails to compile here rather than silently falling
 * through to a default — the same technique the not-determined floor uses.
 */
export const PURPOSE_BY_EASEMENT_TYPE = {
  'utility-overhead': {
    purpose: 'utility',
    reviewed: true,
    label: 'Overhead utility line (power, telecom)',
    note:
      'Treated as a utility easement. Crews need clear access to poles and conductors, and ' +
      'vertical clearance matters as much as ground footprint.',
  },
  'utility-underground': {
    purpose: 'utility',
    reviewed: true,
    label: 'Underground utility line (power, telecom)',
    note:
      'Treated as a utility easement. Excavation access is the governing concern, so anything ' +
      'requiring a foundation is generally out.',
  },
  sewer: {
    purpose: 'sewer',
    reviewed: true,
    label: 'Sewer line',
    note:
      'Treated as a sewer easement, which is stricter than a generic utility one: deep-rooted ' +
      'planting is restricted because roots damage the line itself, not merely access to it.',
  },
  'storm-drain': {
    purpose: 'drainage',
    reviewed: true,
    label: 'Storm drain',
    note:
      'Treated as a drainage easement. The governing concern is flow, so grading changes matter ' +
      'as much as structures.',
  },
  'water-line': {
    purpose: 'utility',
    reviewed: false,
    label: 'Water line',
    note:
      'Treated as a utility easement. NOT REVIEWED: a potable water main may carry setback or ' +
      'cross-connection rules closer to the sewer row than the utility one. Verify with the ' +
      'water provider before relying on the landscaping answer.',
  },
  pipeline: {
    purpose: 'unknown',
    reviewed: false,
    label: 'Pipeline (gas, petroleum, transmission)',
    note:
      'Every activity is shown as restricted, deliberately. A transmission pipeline is governed ' +
      'by federal and operator encroachment rules stricter than anything in this tool, and ' +
      'mapping it to the utility row would report landscaping as generally permitted over a ' +
      'high-pressure line. Contact the operator before any ground disturbance, and call 811.',
  },
  'access-ingress-egress': {
    purpose: 'access',
    reviewed: true,
    label: 'Access / ingress-egress (driveway, shared road)',
    note:
      'Treated as an access easement. The governing concern is that the path stays passable at ' +
      'its full width.',
  },
  'public-right-of-way': {
    purpose: 'access',
    reviewed: false,
    label: 'Public right of way',
    note:
      'Treated as an access easement. NOT REVIEWED: a public right of way is usually governed by ' +
      'a municipal code with its own permit process and setback schedule, which this tool does ' +
      'not read. Check with the city or county before building anything near it.',
  },
  drainage: {
    purpose: 'drainage',
    reviewed: true,
    label: 'Drainage',
    note:
      'Treated as a drainage easement. Anything that alters grading or obstructs flow is ' +
      'generally restricted, including landscaping.',
  },
  slope: {
    purpose: 'unknown',
    reviewed: false,
    label: 'Slope easement',
    note:
      'Every activity is shown as restricted. No slope-easement rules have been researched for ' +
      'this tool. A slope easement typically exists to keep a cut or fill stable, so the real ' +
      'constraint is usually on excavation and loading rather than on structures as such — but ' +
      'that is a general observation, not a determination about your parcel.',
  },
  conservation: {
    purpose: 'unknown',
    reviewed: false,
    label: 'Conservation easement',
    note:
      'Every activity is shown as restricted, and the footprint framing on this page does not ' +
      'really fit. A conservation easement restricts the WHOLE parcel by the terms of its own ' +
      'instrument rather than a strip of it, and those terms vary case by case. The instrument ' +
      'is the only thing that answers this.',
  },
  prescriptive: {
    purpose: 'unknown',
    reviewed: false,
    label: 'Prescriptive (established by use, no recorded document)',
    note:
      'Every activity is shown as restricted. A prescriptive easement has no recorded instrument ' +
      'to read, and its scope is whatever the established use actually was — which is a question ' +
      'of fact and, ultimately, for a court. Whether one exists at all is itself contested.',
  },
} as const satisfies Record<EasementType, PurposeMapping>;

export function mapEasementTypeToPurpose(type: EasementType): PurposeMapping {
  return PURPOSE_BY_EASEMENT_TYPE[type];
}

/** Types whose mapping is an unreviewed engineering judgement. */
export function unreviewedEasementTypes(): readonly EasementType[] {
  return (Object.keys(PURPOSE_BY_EASEMENT_TYPE) as EasementType[]).filter(
    (t) => !PURPOSE_BY_EASEMENT_TYPE[t].reviewed,
  );
}

/**
 * Types deliberately routed to `unknown` so every activity reads restricted.
 *
 * Distinct from `unreviewed`: `water-line` is unreviewed but still mapped to a
 * real row, whereas `pipeline` is mapped to `unknown` ON PURPOSE because the
 * conservative answer is the correct one there.
 */
export function conservativelyRestrictedTypes(): readonly EasementType[] {
  return (Object.keys(PURPOSE_BY_EASEMENT_TYPE) as EasementType[]).filter(
    (t) => PURPOSE_BY_EASEMENT_TYPE[t].purpose === 'unknown',
  );
}
