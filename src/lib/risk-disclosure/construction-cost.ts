/**
 * Regional construction cost per square foot, for estimating what it costs to
 * rebuild or relocate an improvement that encroaches on an easement.
 *
 * SOURCE: NAHB analysis of the Census Bureau Survey of Construction (SOC),
 * single-family homes started in 2024, median price per square foot of floor
 * area. https://eyeonhousing.org/2025/10/square-foot-prices-moderate-in-2024/
 *
 * These figures EXCLUDE developed lot value, which is what makes them usable
 * here: the land is not being rebuilt, only the structure. A sale-price-per-
 * square-foot figure would embed land and builder margin and overstate the
 * construction component.
 *
 * IMPORTANT — THIS IS A LOWER BOUND. It is the cost of NEW construction on an
 * open site. Reworking an existing improvement additionally involves
 * demolition, debris disposal, and building around site constraints, none of
 * which are captured. Read the output as "at least this much", not as a quote.
 *
 * This replaces an invented placeholder of $180/sq ft that had no source.
 */

export type CensusDivision =
  | 'new-england'
  | 'middle-atlantic'
  | 'east-north-central'
  | 'west-north-central'
  | 'south-atlantic'
  | 'east-south-central'
  | 'west-south-central'
  | 'mountain'
  | 'pacific';

/** National median for custom/contractor-built homes, 2024, excluding lot. */
export const NATIONAL_CONSTRUCTION_COST_PER_SQ_FT = 166;

/**
 * Median construction cost per sq ft by Census division, custom/contractor-
 * built, 2024, excluding lot value.
 *
 * west-north-central falls back to the national median: the source reports
 * the other eight divisions but not that one, and inventing a figure for it
 * is what this file exists to stop doing.
 */
export const CONSTRUCTION_COST_BY_DIVISION: Readonly<Record<CensusDivision, number>> = {
  'new-england': 190,
  'middle-atlantic': 188,
  'east-north-central': 186,
  'west-north-central': NATIONAL_CONSTRUCTION_COST_PER_SQ_FT,
  'south-atlantic': 155,
  'east-south-central': 129,
  'west-south-central': 138,
  mountain: 169,
  pacific: 167,
};

/** Divisions the source actually reports, as opposed to those defaulted. */
export const DIVISIONS_WITH_REPORTED_FIGURES: ReadonlySet<CensusDivision> = new Set([
  'new-england',
  'middle-atlantic',
  'east-north-central',
  'south-atlantic',
  'east-south-central',
  'west-south-central',
  'mountain',
  'pacific',
]);

const STATE_TO_DIVISION: Readonly<Record<string, CensusDivision>> = {
  CT: 'new-england', ME: 'new-england', MA: 'new-england',
  NH: 'new-england', RI: 'new-england', VT: 'new-england',

  NJ: 'middle-atlantic', NY: 'middle-atlantic', PA: 'middle-atlantic',

  IL: 'east-north-central', IN: 'east-north-central', MI: 'east-north-central',
  OH: 'east-north-central', WI: 'east-north-central',

  IA: 'west-north-central', KS: 'west-north-central', MN: 'west-north-central',
  MO: 'west-north-central', NE: 'west-north-central', ND: 'west-north-central',
  SD: 'west-north-central',

  DE: 'south-atlantic', DC: 'south-atlantic', FL: 'south-atlantic',
  GA: 'south-atlantic', MD: 'south-atlantic', NC: 'south-atlantic',
  SC: 'south-atlantic', VA: 'south-atlantic', WV: 'south-atlantic',

  AL: 'east-south-central', KY: 'east-south-central',
  MS: 'east-south-central', TN: 'east-south-central',

  AR: 'west-south-central', LA: 'west-south-central',
  OK: 'west-south-central', TX: 'west-south-central',

  AZ: 'mountain', CO: 'mountain', ID: 'mountain', MT: 'mountain',
  NV: 'mountain', NM: 'mountain', UT: 'mountain', WY: 'mountain',

  AK: 'pacific', CA: 'pacific', HI: 'pacific', OR: 'pacific', WA: 'pacific',
};

export function divisionForState(state: string): CensusDivision | null {
  return STATE_TO_DIVISION[state.trim().toUpperCase()] ?? null;
}

export interface ConstructionCostEstimate {
  readonly costPerSqFt: number;
  readonly division: CensusDivision | null;
  /** False when the division figure was defaulted to the national median. */
  readonly isDivisionReported: boolean;
  /** Provenance and limits, for the methodology text. */
  readonly note: string;
}

/**
 * Resolves a construction cost for a state, falling back to the national
 * median when the state is unrecognized or its division is not reported.
 */
export function resolveConstructionCost(state?: string): ConstructionCostEstimate {
  const division = state ? divisionForState(state) : null;
  const isDivisionReported = division !== null && DIVISIONS_WITH_REPORTED_FIGURES.has(division);
  const costPerSqFt = division
    ? CONSTRUCTION_COST_BY_DIVISION[division]
    : NATIONAL_CONSTRUCTION_COST_PER_SQ_FT;

  const basis = isDivisionReported
    ? `the ${division!.replace(/-/g, ' ')} Census division median`
    : 'the national median';

  const note =
    `Rework cost uses ${basis} for new single-family construction, ` +
    `$${costPerSqFt}/sq ft (NAHB analysis of the Census Survey of Construction, ` +
    `2024, excluding lot value). That is the cost of building new on an open ` +
    `site; reworking an existing improvement also involves demolition, disposal, ` +
    `and site constraints, so treat this as a lower bound rather than a quote.`;

  return { costPerSqFt, division, isDivisionReported, note };
}
