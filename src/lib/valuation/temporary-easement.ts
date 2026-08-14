/**
 * Temporary easement valuation — the market rental method.
 *
 * This is the ONE easement measure the controlling federal standard both
 * endorses and makes computable. Uniform Appraisal Standards for Federal Land
 * Acquisitions (2016) §4.6.5.1.2:
 *
 *   "For temporary easements, like other temporary acquisitions, compensation
 *    is measured by the market rental value for the term of the easement,
 *    adjusted as may be appropriate for the rights of use, if any, reserved to
 *    the owner."
 *
 * Everything else in §4.6.5 is a rejection. Percentage-of-fee is rejected,
 * customary going rates are rejected, and strip valuation — the shape of
 * `area x land $/sq ft x factor` — is rejected as "fail[ing] to compare the
 * fair market value of the entire tract ... before and after the taking". A
 * permanent easement therefore has no formula this product can run. A
 * temporary one does, and this is it.
 *
 * THE RATE MUST BE OBSERVED. IT CANNOT BE DERIVED FROM LAND VALUE.
 *
 * That constraint is not a style preference, it comes from the same standard,
 * §4.7 on leaseholds: "It is improper to develop an opinion of the market
 * rental value of a leasehold estate based on the value of the underlying
 * fee--that is, a percentage-of-fee value method." It notes such methods "can
 * lead to 'gross over-valuation'" and that federal courts have rejected them
 * "even if comparable lease transactions are not available" — so the absence
 * of comparables is explicitly NOT a licence to fall back on a capitalisation
 * rate applied to fee value.
 *
 * Consequently this module has no default rate, derives no rate, and refuses
 * to run without one. Supplying `MarketRentRate` requires naming where the
 * figure was observed. That is the whole discipline of the module: it does the
 * arithmetic and the term handling, and will not invent the one input that
 * makes the arithmetic mean anything.
 */

/**
 * The one observed ground-rent source located in open data, and the land class
 * it is valid for.
 *
 * USDA NASS publishes county-level **agricultural** cash rents annually, by
 * survey, free — cropland and pasture, dollars per acre per year. For a
 * temporary easement across FARMLAND this is exactly the right input: an
 * observed market rent for that land class, in that county, from a named
 * federal survey.
 *
 * THE API NEEDS A KEY (`quickstats.nass.usda.gov/api` returns 401
 * `["unauthorized"]`), but the county estimate publications are open PDFs, e.g.
 * `data.nass.usda.gov/Statistics_by_State/Florida/Publications/County_Estimates/2024/FLPasture2024.pdf`.
 *
 * WHY IT CANNOT BE USED FOR A SUBURBAN LOT. Searching for an observed ground
 * rent for the Green Cove Springs residential market found none, and the
 * agricultural figures show why substituting them would be indefensible rather
 * than merely rough. Florida pasture cash rents run roughly $6.70-$51.50 per
 * acre per year — about **$0.00069/sq ft/yr at $30/acre**. An illustrative
 * suburban rate of $0.25/sq ft/yr is **~360x higher**. Applied to a 1,204 sq ft
 * easement over two years, pasture rent yields about $1.66. The land class is
 * not a detail; it is the whole magnitude.
 *
 * Clay County is additionally **not published at all** in that release —
 * counties are suppressed "due to insufficient data or to avoid disclosure of
 * individual operations" — so even the wrong-class figure is unavailable there.
 *
 * WHERE IT DOES ALL COINCIDE: BERKS COUNTY, PENNSYLVANIA. One org
 * (`services3.arcgis.com/dGYe1jDYrTw1wwpc`) publishes 1,692 agricultural
 * conservation easements, 215 general easements with book/page, and 156,928
 * parcels carrying `VALULNDMKT` and `LANDUSE` — and NASS publishes a cash rent
 * for that county. Every input is observed, in one jurisdiction, for the right
 * land class. Worked example: a 19.97-acre Bethel Township farm parcel,
 * `VALULNDMKT` $67,300 ($3,370/acre), against NASS Berks non-irrigated
 * cropland at $88.00/acre/yr — a 2-year temporary easement over the encumbered
 * acreage computes to $3,515 from an observed rate rather than a placeholder.
 *
 * TWO CAVEATS ON THAT EXAMPLE. The NASS figure is 2013 ($97.50 in 2012);
 * current county rents need the key-gated Quick Stats. And the easement
 * actually recorded there is a PERMANENT agricultural conservation easement
 * covering the whole parcel, which this temporary method does not value — the
 * figure demonstrates that all three inputs now exist and are observed, not
 * that this easement is worth $3,515.
 *
 * EXTRACTION TRAP, worth 4.9x. The NASS county PDF is multi-column and
 * `pdftotext -layout` offsets county labels by three rows against their data,
 * because the header consumes the first three name cells. Read naively it
 * gives Berks $20.00 instead of $97.50. Cross-check the label-to-value mapping
 * against the raw (non-layout) reading order before trusting any figure out of
 * these publications.
 */
export const NASS_AGRICULTURAL_RENT = {
  validFor: 'agricultural land only — cropland and pasture',
  invalidFor:
    'residential, commercial and other developed land. Florida pasture runs ~$0.00069/sq ft/yr, ' +
    'roughly 360x below a plausible suburban ground rent, so substituting it understates ' +
    'compensation by more than two orders of magnitude.',
  source:
    'USDA NASS county estimates, Annual Cash Rents (Cropland/Pasture), published annually. ' +
    'Quick Stats API requires a free key; the county estimate PDFs are open.',
  countySuppression:
    'Counties with insufficient data are withheld. Clay County FL is absent from the 2024 ' +
    'Florida pasture release.',
  /** Where easements, valued parcels and an observed county rent all coincide. */
  referenceJurisdiction:
    'Berks County, Pennsylvania. One ArcGIS org publishes 1,692 agricultural conservation ' +
    'easements, 215 general easements with book/page, and 156,928 parcels carrying VALULNDMKT ' +
    'and LANDUSE; NASS publishes a Berks cash rent. Every input observed, one jurisdiction, ' +
    'right land class.',
  /**
   * READ THE PDF CAREFULLY. `pdftotext -layout` offsets county labels three
   * rows against their data in the NASS county publications, because the
   * header consumes the first three name cells. Read naively it gives Berks
   * $20.00 instead of $97.50 — a 4.9x error. Cross-check label-to-value
   * mapping against the raw non-layout reading order.
   */
  extractionTrap:
    'NASS county PDFs are multi-column; pdftotext -layout misaligns county labels by three rows. ' +
    'Verified Berks County non-irrigated cropland at $97.50/acre (2012) and $88.00/acre (2013) ' +
    'by cross-checking layout output against raw reading order.',
} as const;

/**
 * Where actual temporary construction easements are published, and what is
 * still missing from them.
 *
 * SEARCHED FOR TCEs IN BERKS COUNTY PA — the reference jurisdiction above —
 * AND FOUND NONE. Its 215 general easements are all permanent preservation
 * types: 147 conservation, 48 agricultural, plus trail, wetland, scenic and
 * open space. Berks publishes a land-PRESERVATION inventory, not a public-works
 * right-of-way inventory. So the county with the observed rent has no TCEs, and
 * the pattern of the split seen elsewhere in this project repeats.
 *
 * THERE IS A STRUCTURAL REASON TO EXPECT THIS. A TCE expires when construction
 * finishes, so it is released rather than maintained, and a preservation or
 * assessment layer has no reason to carry it. TCEs live in the acquiring
 * agency's right-of-way system, which is a project-tracking tool rather than a
 * land record.
 *
 * WHERE THEY DO EXIST: state DOT right-of-way acquisition layers. Florida DOT
 * (`services1.arcgis.com/O1JpcwDW8sjYuddV`) publishes ROW status layers
 * carrying PARCEL, OWNER, TAKING, PURPOSE, ACQ_DATE and ACQUIRED, with 27
 * records whose TAKING is `TCE` — purposes such as "TCE DRIVEWAY TIE-IN" and
 * "TCE PRIVATE ROAD TIE-IN". Owners include private individuals, so these are
 * genuine homeowner TCEs. Areas are computable: three sampled at 893, 581 and
 * 1,798 sq ft, which is the right size for a driveway tie-in at a road edge.
 *
 * WHAT IS STILL MISSING FROM THEM, and it is both remaining inputs:
 *   - NO COMPENSATION. The `APPRAISAL` field holds a date, not an amount. No
 *     dollar field in the layer is populated.
 *   - NO TERM. Nothing records how long the easement runs, and term is half
 *     the formula.
 * A rate for the right land class would also still be needed; these are
 * residential frontages, and the only observed ground rent found in open data
 * is agricultural (see NASS_AGRICULTURAL_RENT).
 *
 * Net: a real TCE on a real homeowner's parcel can now be identified and
 * measured. It still cannot be valued.
 */
export const TCE_SOURCE_NOTES = {
  berksHasNone:
    'Berks County PA publishes no temporary construction easements. Its 215 easements are all ' +
    'permanent preservation types (147 conservation, 48 agricultural, plus trail, wetland, ' +
    'scenic, open space).',
  whereTheyLive:
    'State DOT right-of-way acquisition layers. Florida DOT publishes 27 records with TAKING=TCE, ' +
    'including private homeowners, with computable areas (893, 581, 1,798 sq ft sampled).',
  stillMissing:
    'Those layers carry no compensation amount (APPRAISAL holds a date) and no term. Both are ' +
    'required inputs, so a TCE can be identified and measured but not valued.',
} as const;

export interface MarketRentRate {
  /** Observed ground rent, dollars per square foot per year. */
  readonly perSqFtPerYear: number;
  /**
   * Where this rate was observed. Required — a rate with no provenance is the
   * thing this module exists to prevent. Name the comparable leases, the
   * market study, or the appraiser.
   */
  readonly source: string;
  /** ISO date the rate was observed or published. */
  readonly observedOn: string;
  /**
   * Set when the rate is illustrative rather than observed — a worked example,
   * a sensitivity test, a placeholder pending a market study.
   *
   * The source string alone cannot carry this reliably: a caller can write
   * anything there and the output would still read as measured. This flag
   * forces the disclaimer into `note` so an illustrative figure can never be
   * mistaken for a real one downstream, which matters because the rest of this
   * module exists to stop exactly that.
   */
  readonly hypothetical?: boolean;
}

export interface TemporaryEasementInput {
  /** Encumbered area in square feet. */
  readonly areaSqFt: number;
  /** Term in years. Fractions are fine — a 9-month TCE is 0.75. */
  readonly termYears: number;
  readonly rate: MarketRentRate;
  /**
   * Share of use the owner RETAINS during the term, 0 to 1. The standard
   * requires compensation be "adjusted as may be appropriate for the rights of
   * use, if any, reserved to the owner", so an owner who keeps meaningful use
   * of the strip is owed less than one who is excluded entirely.
   *
   * Defaults to 0 — full exclusion, the maximum compensation — because that is
   * the assumption that does NOT understate the owner's claim. Anything above
   * 0 reduces what they are owed and should come from the easement's actual
   * terms, not from an estimate.
   */
  readonly retainedUseShare?: number;
  /**
   * Optional annual discount rate for multi-year terms. Omitted by default:
   * whether to discount a term's rent to present value is an appraisal
   * judgment, and defaulting to a positive rate would silently reduce the
   * figure. When supplied, rent is treated as paid annually in arrears.
   */
  readonly discountRate?: number;
}

export interface TemporaryEasementValuation {
  readonly areaSqFt: number;
  readonly termYears: number;
  readonly annualRent: number;
  /** Rent over the whole term, before any adjustment. */
  readonly grossRent: number;
  readonly retainedUseShare: number;
  /** Present value applied, or null when undiscounted. */
  readonly discountRate: number | null;
  /** The compensation figure. */
  readonly compensation: number;
  readonly rate: MarketRentRate;
  readonly note: string;
}

export class TemporaryEasementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TemporaryEasementError';
  }
}

/**
 * Rejects a rate that was derived from fee value rather than observed.
 *
 * Callers can still lie, but the check catches the honest mistake — someone
 * capitalising a land value and passing it through, which is the specific
 * method §4.7 forbids.
 */
const DERIVED_FROM_FEE =
  /(cap(italis|italiz)ed|% of (fee|land|market) value|percent(age)? of fee|derived from (fee|land) value|land value x|land value \*)/i;

export function assertObservedRate(rate: MarketRentRate): void {
  if (!Number.isFinite(rate.perSqFtPerYear) || rate.perSqFtPerYear <= 0) {
    throw new TemporaryEasementError('Rent rate must be a positive number of dollars per sq ft per year');
  }
  const source = String(rate.source ?? '').trim();
  if (source.length < 10) {
    throw new TemporaryEasementError(
      'Rent rate requires a source naming where it was observed — comparable leases, a market ' +
        'study, or an appraiser. A rate with no provenance is exactly what this module refuses.',
    );
  }
  if (DERIVED_FROM_FEE.test(source)) {
    throw new TemporaryEasementError(
      `Rent rate appears to be derived from fee value ("${source}"). The Uniform Appraisal ` +
        'Standards for Federal Land Acquisitions §4.7 holds it "improper to develop an opinion of ' +
        'the market rental value ... based on the value of the underlying fee", and federal courts ' +
        'reject that method even where comparable leases are unavailable. Supply an observed rent.',
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(rate.observedOn ?? ''))) {
    throw new TemporaryEasementError('Rent rate requires an ISO observation date (YYYY-MM-DD)');
  }
}

/** Present value of a level annuity paid annually in arrears. */
function annuityFactor(termYears: number, discountRate: number): number {
  if (discountRate <= 0) return termYears;
  return (1 - Math.pow(1 + discountRate, -termYears)) / discountRate;
}

/**
 * Values a temporary easement per §4.6.5.1.2.
 *
 * Note what this deliberately does NOT do: it does not touch land value, does
 * not consult an encumbrance factor, and does not reference the parcel's
 * assessment. Those belong to the permanent-easement path, which the standard
 * forecloses. The only property inputs here are area and term.
 */
export function valueTemporaryEasement(
  input: TemporaryEasementInput,
): TemporaryEasementValuation {
  const { areaSqFt, termYears, rate, retainedUseShare = 0, discountRate } = input;

  if (!Number.isFinite(areaSqFt) || areaSqFt <= 0) {
    throw new TemporaryEasementError('Encumbered area must be a positive number of square feet');
  }
  if (!Number.isFinite(termYears) || termYears <= 0) {
    throw new TemporaryEasementError('Term must be a positive number of years');
  }
  if (!Number.isFinite(retainedUseShare) || retainedUseShare < 0 || retainedUseShare >= 1) {
    throw new TemporaryEasementError(
      'Retained-use share must be at least 0 and below 1. A share of 1 would mean the owner ' +
        'loses nothing, which is not a compensable easement.',
    );
  }
  if (discountRate !== undefined && (!Number.isFinite(discountRate) || discountRate < 0)) {
    throw new TemporaryEasementError('Discount rate must be a non-negative number when supplied');
  }
  assertObservedRate(rate);

  const annualRent = areaSqFt * rate.perSqFtPerYear;
  const factor = discountRate === undefined ? termYears : annuityFactor(termYears, discountRate);
  const grossRent = annualRent * factor;
  const compensation = grossRent * (1 - retainedUseShare);

  const discountNote =
    discountRate === undefined
      ? 'Rent is not discounted to present value; whether to discount is an appraisal judgment and ' +
        'defaulting to a positive rate would silently reduce the figure.'
      : `Rent is discounted to present value at ${(discountRate * 100).toFixed(2)}% annually, ` +
        'treated as paid yearly in arrears.';

  const retainedNote =
    retainedUseShare === 0
      ? 'No retained use is assumed, i.e. the owner is excluded from the area for the term. This is ' +
        'the assumption that does not understate the claim; reduce it only from the easement terms.'
      : `Compensation is reduced by ${(retainedUseShare * 100).toFixed(0)}% for use the owner ` +
        'retains during the term.';

  const hypotheticalNote = rate.hypothetical
    ? 'THE RENT RATE USED HERE IS ILLUSTRATIVE, NOT OBSERVED. This figure demonstrates the method ' +
      'and is not a compensation estimate. Replace the rate with observed ground rents before it ' +
      'informs any decision. '
    : '';

  return {
    areaSqFt,
    termYears,
    annualRent,
    grossRent,
    retainedUseShare,
    discountRate: discountRate ?? null,
    compensation,
    rate,
    note:
      hypotheticalNote +
      `Temporary easement compensation measured as the market rental value of ${areaSqFt.toFixed(0)} ` +
      `sq ft for ${termYears} year${termYears === 1 ? '' : 's'}, per the Uniform Appraisal Standards ` +
      `for Federal Land Acquisitions §4.6.5.1.2. Rent of $${rate.perSqFtPerYear.toFixed(2)}/sq ft/year ` +
      `observed ${rate.observedOn}: ${rate.source}. ${retainedNote} ${discountNote} This is a ` +
      `calculation from a supplied market rent, not an appraisal, and it does not address any ` +
      `permanent easement or damage to the remainder.`,
  };
}
