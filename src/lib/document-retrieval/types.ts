export interface RecorderOffice {
  name: string;
  address: string;
  hours: string;
  searchRooms: Array<{ room: string; coverage: string }>;
}

export interface CopyFeeSchedule {
  certifiedFirstPage: number;
  certifiedAdditionalPage: number;
  /**
   * Plain (uncertified) copy of an ALREADY-RECORDED document.
   *
   * ADDED 2026-10-05, AND IT IS THE FIGURE THIS PRODUCT'S USERS ACTUALLY PAY.
   * It was missing, and `firstConformedCopy: 0` stood in its place with a note
   * saying the first copy is free. That is true of a conformed copy returned
   * to the person RECORDING a document, and this product serves the opposite
   * party — a homeowner asking for a copy of an easement recorded decades ago
   * by someone else. They pay this.
   */
  plainFirstPage: number;
  plainAdditionalPage: number;
  /** Free, but only at recording. Not what a records requester gets. */
  firstConformedCopy: number;
  /** Charged per name per year searched, with a minimum. Mail requests hit this. */
  searchFeePerNamePerYear: number;
  searchFeeMinimum: number;
  currency: 'USD';
  notes: string;
}

export interface MailRequestInfo {
  address: string;
  process: string;
}

export interface LaCountyFallbackData {
  recorderOffices: RecorderOffice[];
  copyFeeSchedule: CopyFeeSchedule;
  indexStructure: string[];
  mailRequest: MailRequestInfo;
  /**
   * ISO date this record was last checked against the Registrar-Recorder's own
   * published pages, or null if never.
   *
   * REPLACED A LITERAL `true` FLAG ON 2026-10-05. The flag could record that
   * verification was outstanding and could not record that it had happened,
   * so clearing it meant deleting it — and a deleted flag says nothing about
   * when anyone last looked. A date does both, and it goes stale on its own,
   * which a boolean cannot. Counties revise fee schedules and move counters
   * without announcing it, so "verified" is a perishable claim.
   */
  verifiedOn: string | null;
  /** The pages actually read. Named so a re-verification knows where to look. */
  verifiedAgainst: readonly string[];
  /**
   * Shown to the user beside this data. Required rather than optional: the
   * whole record is unverified, and a surface that renders it without saying
   * so is the failure this flag exists to prevent.
   */
  stalenessDisclosure: string;
}

export interface GeneralGuidance {
  message: string;
  steps: string[];
  routeTo: 'track-3';
}

/**
 * How long a verification of county reference data is treated as current.
 *
 * A STATED CONVENTION, NOT A MEASUREMENT — the same posture as
 * REVIEW_MAX_AGE_MONTHS. Twelve months because fee schedules are typically
 * revised on an annual cycle and because a year is short enough that an office
 * relocation does not sit unnoticed through two of them. Argue with it here.
 */
export const COUNTY_DATA_MAX_AGE_MONTHS = 12;

/** True when nobody has checked this against the county recently enough. */
export function needsLiveVerification(
  data: Pick<LaCountyFallbackData, 'verifiedOn'>,
  today: string,
): boolean {
  if (data.verifiedOn === null) return true;
  const from = new Date(`${data.verifiedOn}T00:00:00Z`);
  const to = new Date(`${today}T00:00:00Z`);
  const months =
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    (to.getUTCMonth() - from.getUTCMonth()) -
    (to.getUTCDate() < from.getUTCDate() ? 1 : 0);
  return months > COUNTY_DATA_MAX_AGE_MONTHS;
}
