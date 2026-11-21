/**
 * Maps the twelve physical easement types onto the restriction table's five
 * purposes, and records which of those mappings has actually been reviewed.
 *
 * WHY THIS FILE EXISTS. `EASEMENT_TYPES` carries twelve members. The Track 3
 * restriction checklist has rules for five purposes, and the UI dropdown
 * offered five options. Seven types were therefore unreachable from the
 * interface and had no defined behavior if they arrived from anywhere else —
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
    /*
     * CLOSED 2026-11-21 against published utility standards, not a phone call.
     *
     * The open question was whether a potable water main is governed as a
     * UTILITY easement rather than a sewer one. It is, and the sources are
     * public and consistent across three jurisdictions:
     *
     *   LADWP Design Standards and Installation Requirements (2025): where a
     *   facility cannot go in a public street the water facility requires an
     *   easement, and the grantor "shall not modify grading, construct
     *   surface improvements or structures, plant trees, reduce capacity or
     *   alter path of existing surface drainage, park vehicles or store
     *   materials directly over the main, or reduce or increase the depth of
     *   cover over the main".
     *
     *   City of San Diego Water Facility Design Guidelines (2021): easement
     *   width keyed to pipe size, 15 ft minimum for mains 16 inches and
     *   under; trees or shrubs maturing over 3 ft must stand at least 10 ft
     *   from a water main, or use root barriers or above-ground planters.
     *
     *   Las Vegas Valley Water District non-exclusive easement form: no
     *   buildings, structures, walls, fences, pavers, trees or other
     *   vegetation on the easement.
     *
     * CONFIRMED, AND ALSO PARTLY WRONG, which is why this note is long. The
     * structural cells match the utility row exactly — fencing, additions and
     * pools are restricted under every standard above. What does NOT match is
     * the permissive landscaping cell and its silence on ground level: these
     * deeds forbid changing grading and the depth of cover over the main, and
     * a buried pressurised pipe is the one utility where re-grading a garden
     * is itself the hazard. The generic utility row never had to say that,
     * because an overhead conductor does not care how deep your soil is.
     *
     * So the mapping stands and the row needed a water-specific condition.
     * See WATER_LINE_COVER_CONDITION, rendered beside the checklist the way
     * LANDSCAPING_ACCESS_CONDITION is.
     */
    reviewed: true,
    label: 'Water line',
    note:
      'Treated as a utility easement, confirmed 2026-11-21 against LADWP, City of San Diego and ' +
      'Las Vegas Valley Water District published standards. A pressurised potable main is not a ' +
      'sewer: it does not leak nutrients and has no joints that roots actively seek, which is the ' +
      'physical reason the sewer row is stricter. Structures, fencing and pools are restricted ' +
      'here as under any utility easement. ' +
      'WHAT IS SPECIFIC TO WATER: these easements also bar changing the grade or the depth of ' +
      'soil over the pipe, and set planting distances by mature size rather than by root depth. ' +
      'Your own recorded easement and your utility’s standards control, and both can be ' +
      'stricter than this.',
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

/**
 * The noun phrase for the report headline, article included.
 *
 * SEPARATE FROM `label`, WHICH IS A DROPDOWN OPTION AND READS LIKE ONE. The
 * labels carry disambiguating parentheticals that are right in a picker and
 * wrong in a sentence: "What a prescriptive (established by use, no recorded
 * document) would mean for your property." Two of them are not even noun
 * phrases on their own — "Drainage" and "Prescriptive" need the word easement
 * supplied.
 *
 * Deriving the article with a vowel test and stripping the parenthetical was
 * the alternative, and it produces the right answer for ten of twelve and
 * garbage for the two that matter most to read well.
 *
 * `satisfies` so a thirteenth type fails to compile here, the same discipline
 * the map above uses.
 */
export const HEADLINE_PHRASE_BY_TYPE = {
  'utility-overhead': 'an overhead utility easement',
  'utility-underground': 'an underground utility easement',
  sewer: 'a sewer easement',
  'storm-drain': 'a storm drain easement',
  'water-line': 'a water line easement',
  pipeline: 'a pipeline easement',
  'access-ingress-egress': 'an access easement',
  'public-right-of-way': 'a public right of way',
  drainage: 'a drainage easement',
  slope: 'a slope easement',
  conservation: 'a conservation easement',
  prescriptive: 'a prescriptive easement',
} satisfies Record<EasementType, string>;

export function headlinePhrase(type: EasementType): string {
  return HEADLINE_PHRASE_BY_TYPE[type];
}
