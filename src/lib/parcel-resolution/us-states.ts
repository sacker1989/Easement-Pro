/** Two-letter USPS codes for the 50 states plus DC. Territories are out of scope for Phase 1. */
export const US_STATE_CODES: ReadonlySet<string> = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL',
  'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME',
  'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH',
  'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI',
  'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI',
  'WY',
]);

/**
 * Full state names to their USPS code.
 *
 * WHY THIS EXISTS: BROWSER AUTOFILL. The report's state field is marked
 * `autoComplete="address-level1"`, and browsers routinely fill that with the
 * full name — "California", not "CA". The page then passed it straight to
 * `analyzeEasementAt`, whose contract is a two-letter code and which throws
 * `UnsupportedStateRuleSetError` on anything else, calling it "a programmer
 * error rather than an unsupported jurisdiction".
 *
 * It was right about its own contract and the page was violating it. Measured
 * on a production build: `?state=California` returned HTTP 500, as did any
 * other unrecognised value. A homeowner whose browser helpfully completed the
 * field got a crash page instead of a report.
 *
 * Resolving the name is better than merely not crashing: "California" means
 * CA, and a reader who typed it should get the analysis they asked for rather
 * than a fallback.
 */
const US_STATE_NAMES: Readonly<Record<string, string>> = {
  ALABAMA: 'AL', ALASKA: 'AK', ARIZONA: 'AZ', ARKANSAS: 'AR',
  CALIFORNIA: 'CA', COLORADO: 'CO', CONNECTICUT: 'CT', DELAWARE: 'DE',
  'DISTRICT OF COLUMBIA': 'DC', FLORIDA: 'FL', GEORGIA: 'GA', HAWAII: 'HI',
  IDAHO: 'ID', ILLINOIS: 'IL', INDIANA: 'IN', IOWA: 'IA',
  KANSAS: 'KS', KENTUCKY: 'KY', LOUISIANA: 'LA', MAINE: 'ME',
  MARYLAND: 'MD', MASSACHUSETTS: 'MA', MICHIGAN: 'MI', MINNESOTA: 'MN',
  MISSISSIPPI: 'MS', MISSOURI: 'MO', MONTANA: 'MT', NEBRASKA: 'NE',
  NEVADA: 'NV', 'NEW HAMPSHIRE': 'NH', 'NEW JERSEY': 'NJ', 'NEW MEXICO': 'NM',
  'NEW YORK': 'NY', 'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND', OHIO: 'OH',
  OKLAHOMA: 'OK', OREGON: 'OR', PENNSYLVANIA: 'PA', 'RHODE ISLAND': 'RI',
  'SOUTH CAROLINA': 'SC', 'SOUTH DAKOTA': 'SD', TENNESSEE: 'TN', TEXAS: 'TX',
  UTAH: 'UT', VERMONT: 'VT', VIRGINIA: 'VA', WASHINGTON: 'WA',
  'WEST VIRGINIA': 'WV', WISCONSIN: 'WI', WYOMING: 'WY',
};

/**
 * A usable two-letter code, or null when the input is not a state at all.
 *
 * NULL RATHER THAN A DEFAULT, so the caller decides. A library that quietly
 * substituted a state would be choosing a body of law on the reader's behalf,
 * which is the one thing this product must not do by accident.
 */
export function resolveStateCode(raw: string | undefined): string | null {
  const cleaned = (raw ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
  if (cleaned === '') return null;
  if (US_STATE_CODES.has(cleaned)) return cleaned;
  return US_STATE_NAMES[cleaned] ?? null;
}
