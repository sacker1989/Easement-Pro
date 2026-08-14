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
