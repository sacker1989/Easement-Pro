/**
 * What the referral package could NOT determine, and why.
 *
 * This is the section a professional most needs and the one most likely to be
 * dropped, because it is the only part of the package carrying no numbers — so
 * it is what a hurried renderer, a summary view, or a copy-paste truncates
 * first. Phase 5 makes dropping it impossible rather than discouraged.
 *
 * The floor is four items appearing in EVERY package regardless of input. They
 * are not conditional, because the reasons they exist are not conditional: no
 * formula this product can run produces the market value of a permanent
 * easement, and that is settled research rather than a gap awaiting data. See
 * docs/spec-easement-valuation.md §6.1 (superseded) and §6.1a.
 */

import { YELLOW_BOOK_4_6_5 } from '@/lib/valuation/encumbrance-factors';

/**
 * Closed union so the catalogue is enumerable and testable. A new reason for
 * being unable to answer something is a deliberate addition here, not a free
 * string invented at a call site.
 */
export type NotDeterminedKey =
  | 'permanent-easement-value'
  | 'encumbrance-factor'
  | 'remainder-damage'
  | 'highest-and-best-use'
  | 'easement-existence'
  | 'easement-terms'
  | 'authorisation-of-occupation'
  | 'owner-identity'
  | 'encumbered-area'
  | 'land-value'
  | 'temporary-term'
  | 'compensation-paid'
  | 'observed-market-rent'
  | 'legal-conclusions';

export type Resolver =
  | 'licensed appraiser'
  | 'attorney'
  | 'records custodian'
  | 'title company'
  | 'surveyor'
  | 'the property owner';

export interface NotDeterminedItem {
  readonly key: NotDeterminedKey;
  /** The question left open, in the reader's terms rather than the code's. */
  readonly what: string;
  /** Why this product cannot answer it. Carries the citation where one exists. */
  readonly why: string;
  readonly whoResolves: Resolver;
  /** The concrete next artefact that would answer it. */
  readonly whatWouldResolveIt: string;
}

/**
 * Non-empty by construction — an empty array does not typecheck.
 *
 * First of five overlapping mechanisms keeping this section in the package.
 * One would be a convention; five are a constraint.
 */
export type NotDeterminedSection = readonly [NotDeterminedItem, ...NotDeterminedItem[]];

/** The four items present in every package, whatever the inputs. */
export const FLOOR_KEYS = [
  'permanent-easement-value',
  'encumbrance-factor',
  'remainder-damage',
  'highest-and-best-use',
] as const satisfies readonly NotDeterminedKey[];

const FLOOR: NotDeterminedSection = [
  {
    key: 'permanent-easement-value',
    what: 'The market value of any permanent easement on this parcel.',
    why:
      'The controlling federal standard measures this as the whole tract before the easement ' +
      'minus the remainder after it. It rejects percentage-of-fee methods, customary going ' +
      'rates, and "strip valuation" — valuing the encumbered strip on its own — as not the ' +
      `correct measure. ${YELLOW_BOOK_4_6_5.citation} No formula available to this tool ` +
      'produces market value for a permanent easement, so none is offered.',
    whoResolves: 'licensed appraiser',
    whatWouldResolveIt:
      'A before-and-after appraisal of this specific property by a licensed appraiser.',
  },
  {
    key: 'encumbrance-factor',
    what: 'The share of the fee value that the easement takes.',
    why:
      'This is an OUTPUT of a before-and-after appraisal, not an input looked up by easement ' +
      'type. The standard is explicit that there is no generic easement of any given type. The ' +
      'factor table in this codebase is deliberately empty and returns unsourced for every type.',
    whoResolves: 'licensed appraiser',
    whatWouldResolveIt:
      'The same before-and-after appraisal — the factor falls out of it rather than feeding it.',
  },
  {
    key: 'remainder-damage',
    what: 'Damage to the remainder of the property beyond the encumbered area.',
    why:
      'A proper before-and-after measure includes damage to the remainder automatically, because ' +
      'it compares the whole tract before against the whole remainder after. It cannot be ' +
      'computed separately from parcel geometry and a land rate.',
    whoResolves: 'licensed appraiser',
    whatWouldResolveIt: 'The before-and-after appraisal, which accounts for it inherently.',
  },
  {
    key: 'highest-and-best-use',
    what: 'The property highest and best use, before and after the encumbrance.',
    why:
      'Highest and best use requires an on-the-ground analysis of this specific property — its ' +
      'physical characteristics, permitted uses, and market context. No published dataset ' +
      'supplies it and no inference from parcel records substitutes for it.',
    whoResolves: 'licensed appraiser',
    whatWouldResolveIt: 'A highest-and-best-use analysis, ordinarily part of the appraisal.',
  },
];

type ConditionalKey = Exclude<NotDeterminedKey, (typeof FLOOR_KEYS)[number]>;

/** Conditional items, keyed so callers select rather than compose prose. */
const CONDITIONAL: Readonly<Record<ConditionalKey, NotDeterminedItem>> = {
  'easement-existence': {
    key: 'easement-existence',
    what: 'Whether an easement encumbers this parcel at all.',
    why:
      'The finding here rests on the position of physical infrastructure, not on a recorded ' +
      'instrument. Proximity — even infrastructure crossing the parcel — does not establish that ' +
      'an easement exists. Only the recorded documents do.',
    whoResolves: 'title company',
    whatWouldResolveIt:
      'A title search, or the deed Exceptions and Reservations clause plus the recorded plat.',
  },
  'easement-terms': {
    key: 'easement-terms',
    what: 'The terms of the easement: width, exclusivity, reserved rights, maintenance duties.',
    why:
      'No recorded instrument was read for this parcel. Terms govern what the holder may do and ' +
      'what the owner retains, and they vary between instruments of the same type.',
    whoResolves: 'records custodian',
    whatWouldResolveIt:
      'The recorded easement document, from the county recorder, using the book and page or ' +
      'instrument number referenced in the deed.',
  },
  'authorisation-of-occupation': {
    key: 'authorisation-of-occupation',
    what:
      'Whether the operator of infrastructure on this parcel holds an easement, or is occupying ' +
      'the land without one.',
    why:
      'Geometry shows that infrastructure sits on the land; it cannot show whether that is ' +
      'authorised. THE DIRECTION IS NOT FIXED: an operator occupying private land without a ' +
      'recorded easement may OWE the owner compensation rather than the owner being burdened. ' +
      'Which applies turns on the recorded documents and the history of the use.',
    whoResolves: 'attorney',
    whatWouldResolveIt:
      'A title search for a recorded easement, and if none exists, legal advice on prescriptive ' +
      'rights and on any claim the owner may hold.',
  },
  'owner-identity': {
    key: 'owner-identity',
    what: 'The current record owner of the parcel.',
    why:
      'The county source for this parcel does not publish owner identity. Some jurisdictions ' +
      'withhold it by statute.',
    whoResolves: 'records custodian',
    whatWouldResolveIt: 'A record search at the county assessor or recorder.',
  },
  'encumbered-area': {
    key: 'encumbered-area',
    what: 'The area of the parcel actually encumbered.',
    why:
      'No measured or published area was available. Area cannot be assumed from an easement ' +
      'type: no default width is defensible, and applying one would invent the figure every ' +
      'later number is multiplied by.',
    whoResolves: 'surveyor',
    whatWouldResolveIt:
      'The dimensions stated in the recorded instrument or shown on the plat, or a survey.',
  },
  'land-value': {
    key: 'land-value',
    what: 'The market value of the land, per square foot.',
    why:
      'No value could be emitted within a calibrated error band. The band is measured for one ' +
      'estimation path only, and applying it to a figure produced another way would give a ' +
      'confident-looking interval that measures nothing.',
    whoResolves: 'licensed appraiser',
    whatWouldResolveIt: 'An appraisal, or observed comparable sales for this land class.',
  },
  'temporary-term': {
    key: 'temporary-term',
    what: 'How long a temporary easement runs.',
    why:
      'Term is half the compensation formula for a temporary easement, and it is not published. ' +
      'State DOT right-of-way layers record the parcel, the taking type and the purpose, but no ' +
      'duration.',
    whoResolves: 'records custodian',
    whatWouldResolveIt:
      'The easement instrument or acquisition file, by public records request to the acquiring ' +
      'agency.',
  },
  'compensation-paid': {
    key: 'compensation-paid',
    what: 'What was actually paid for comparable easements.',
    why:
      'Compensation is not published in the available datasets. Fields that look like values ' +
      'commonly hold dates instead — a DOT right-of-way appraisal field holds the appraisal ' +
      'DATE, not an amount.',
    whoResolves: 'records custodian',
    whatWouldResolveIt:
      'A public records request to the acquiring agency, subject to any statutory exemption while ' +
      'an acquisition remains in progress.',
  },
  'observed-market-rent': {
    key: 'observed-market-rent',
    what: 'The observed ground rent for this land class in this market.',
    why:
      'Temporary easement compensation is measured by market rental value, and that rate must be ' +
      'OBSERVED — deriving it from fee value is improper and rejected by federal courts even ' +
      'where comparable leases are unavailable. Open data supplies observed ground rent for ' +
      'agricultural land only; an agricultural rate applied to developed land understates by ' +
      'roughly two orders of magnitude.',
    whoResolves: 'licensed appraiser',
    whatWouldResolveIt:
      'Comparable ground leases for this land class, from an appraiser or a commercial ' +
      'comparables source.',
  },
  'legal-conclusions': {
    key: 'legal-conclusions',
    what: 'What the easement means legally in this state.',
    why:
      'This product has no counsel-reviewed rule set for this state. Easement doctrine is state ' +
      'law and differs materially between states, so applying another state rules would be worse ' +
      'than offering nothing.',
    whoResolves: 'attorney',
    whatWouldResolveIt: 'Advice from an attorney licensed in the state where the property sits.',
  },
};

/** Conditions that add an item beyond the floor. All default to "not known". */
export interface NotDeterminedInputs {
  readonly easementIsRecorded?: boolean;
  readonly instrumentTermsRead?: boolean;
  readonly infrastructureOnParcel?: boolean;
  readonly ownerKnown?: boolean;
  readonly areaKnown?: boolean;
  readonly landValueEmitted?: boolean;
  readonly isTemporary?: boolean;
  readonly termKnown?: boolean;
  readonly observedRentAvailable?: boolean;
  readonly stateRuleSetReviewed?: boolean;
}

/**
 * Builds the section. The floor is unconditional; conditional items are added
 * for every question the inputs leave open.
 *
 * NOTE THE POLARITY. Absence of a positive flag ADDS an item, so a caller that
 * passes nothing gets the most complete list of limits rather than the
 * shortest. Forgetting to describe what you know cannot quietly shrink the
 * caveats — the failure mode of this function is over-disclosure.
 */
export function buildNotDetermined(inputs: NotDeterminedInputs = {}): NotDeterminedSection {
  const extra: NotDeterminedItem[] = [];
  const add = (k: ConditionalKey) => extra.push(CONDITIONAL[k]);

  if (!inputs.easementIsRecorded) add('easement-existence');
  if (!inputs.instrumentTermsRead) add('easement-terms');
  if (inputs.infrastructureOnParcel) add('authorisation-of-occupation');
  if (!inputs.ownerKnown) add('owner-identity');
  if (!inputs.areaKnown) add('encumbered-area');
  if (!inputs.landValueEmitted) {
    add('land-value');
    add('compensation-paid');
  }
  if (inputs.isTemporary && !inputs.termKnown) add('temporary-term');
  if (inputs.isTemporary && !inputs.observedRentAvailable) add('observed-market-rent');
  if (!inputs.stateRuleSetReviewed) add('legal-conclusions');

  const [first, ...restFloor] = FLOOR;
  return [first, ...restFloor, ...extra];
}

/** True when every floor item is present. Used by the render-time invariant. */
export function hasFloorItems(section: readonly NotDeterminedItem[]): boolean {
  const keys = new Set<NotDeterminedKey>(section.map((i) => i.key));
  return FLOOR_KEYS.every((k) => keys.has(k));
}

/** Every catalogue entry, for enumeration in tests and documentation. */
export function allNotDeterminedKeys(): readonly NotDeterminedKey[] {
  return [...FLOOR_KEYS, ...(Object.keys(CONDITIONAL) as ConditionalKey[])];
}
