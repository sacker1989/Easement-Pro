/**
 * The per-jurisdiction rule a records request is generated from.
 *
 * WHY THE RULE IS THE UNIT, NOT THE LETTER. `docs/records-request-fdot-d7.md`
 * reads like a template and is not one. Its central finding is that TARGETING
 * DEPENDED ON STATUTORY EXEMPTION STATE: Sec. 119.0711, F.S. exempts
 * appraisals, reports relating to value, offers and counteroffers until an
 * option contract is executed or a written offer to sell is conditionally
 * accepted, so asking about an in-progress acquisition gets refused. Finding
 * layers where the exemption had already lapsed took a scan of 1,558 FDOT
 * services, and an earlier draft aimed at Pasco `Segment_2a_ROW_Status` was
 * superseded precisely because `ACQUIRED` and `ACQ_DATE` were empty there.
 *
 * Generalising the letter while dropping the exemption analysis would produce
 * requests that get denied. So what generalises is the rule.
 */

/**
 * What a field value means about acquisition status.
 *
 * A union rather than free text, because the whole trap the worked example
 * found is that a value can mean UNKNOWN and be read as a negative. In the
 * FDOT layers `ACQUIRED` is usually the literal string "N/A", which is not an
 * acquisition status at all. Treating it as "no" discards twelve ROW-certified
 * parcels; treating it as "yes" targets in-progress acquisitions and gets the
 * request denied. Only `unknown` is correct, and a string field would let that
 * distinction dissolve into prose.
 */
export type AcquisitionMeaning = 'complete' | 'in-progress' | 'unknown';

export interface FieldSemantic {
  readonly field: string;
  /** The literal published value, compared case-insensitively after trimming. */
  readonly value: string;
  readonly meaning: AcquisitionMeaning;
  /** Why it means that — the part a reader needs in order to disagree. */
  readonly note: string;
}

/**
 * A pre-enforcement notice requirement.
 *
 * WHAT THIS IS NOT. It is not a demand letter and it does not allege anything.
 * Under the Florida provision this models, whether an agency "unlawfully
 * refused" is a determination A COURT MAKES — the notice's statutory job is
 * only to identify the request and start a clock. A generated document that
 * asserted unlawful refusal would be stating a legal conclusion this product
 * cannot reach, and would hand the agency the first paragraph of its reply.
 */
export interface EnforcementNoticeRule {
  readonly cite: string;
  /** What sending it preserves — and, as important, what it does not do. */
  readonly purpose: string;
  readonly noticePeriod: string;
  /** What the notice must identify to satisfy the statute. */
  readonly mustIdentify: string;
  readonly recipient: string;
  /** How the same provision can run against the requester. Never omitted. */
  readonly counterRisk: string;
  /** Business days that must elapse, where the statute fixes a number. */
  readonly businessDaysRequired: number | null;
}

export interface RecordsRequestJurisdictionRule {
  /** e.g. 'FL/FDOT-D7'. */
  readonly key: string;
  readonly statute: { readonly cite: string; readonly name: string; readonly retrievedOn: string };
  readonly custodian: {
    readonly name: string;
    readonly email?: string;
    readonly phone?: string;
    readonly address?: string;
    readonly portalUrl?: string;
    readonly verifiedOn: string;
  };
  /** Whether records of value are exempt, and the condition under which that lapses. */
  readonly valueRecordExemption: {
    readonly cite: string;
    readonly covers: string;
    readonly lapsesWhen: string;
    /**
     * Whether a non-value term — duration in particular — is severable from
     * the exemption, and on what basis. Null where no such argument has been
     * researched for this jurisdiction, in which case the split is NOT
     * asserted: claiming severability without a basis invites the denial it
     * was meant to avoid.
     */
    readonly severabilityArgument: string | null;
  } | null;
  readonly targeting: {
    /** Parcels the agency's own flag marks as concluded. Unambiguous. */
    readonly describeGroupA: string;
    /** Strong evidence the process concluded, but not the agency's own flag. */
    readonly describeGroupB: string;
    readonly fieldSemantics: readonly FieldSemantic[];
  };
  /**
   * A statutory notice that must precede an enforcement action, where the
   * jurisdiction has one. Null everywhere it has not been researched, which is
   * everywhere but Florida — and null is also the right answer for states that
   * genuinely have no such requirement.
   *
   * Modelled on the rule rather than in the builder because this is precisely
   * the kind of provision that does not travel: it is a precondition to
   * RECOVERING FEES, not to filing, and a state without it would have a user
   * sending a document that accomplishes nothing.
   */
  readonly enforcementNotice: EnforcementNoticeRule | null;
  /** Partial production, statutory basis for withholding, re-request identifier. */
  readonly withholdingAsks: readonly string[];
  readonly feeAdvanceRule: string;
  readonly responseDeadlineRule: string | null;
}

/**
 * Returned for every jurisdiction but the one researched.
 *
 * Mirrors `encumbrance-factors.ts` shipping empty and `unclassifiedState()`
 * gating as absence-of-review: an unsupported jurisdiction is a statement
 * about what has not been researched, not a determination about that state's
 * law.
 */
export interface UnsupportedJurisdiction {
  readonly status: 'unsupported';
  readonly jurisdiction: string;
  readonly explanation: string;
  /** The specific research that would populate a rule. */
  readonly whatWouldBeNeeded: readonly string[];
}

export type JurisdictionLookup =
  | { readonly status: 'supported'; readonly rule: RecordsRequestJurisdictionRule }
  | UnsupportedJurisdiction;

/**
 * Reads a published field value through the rule's semantics.
 *
 * Defaults to `unknown` for anything unlisted. That direction is deliberate:
 * an unrecognised value is not evidence of anything, and the failure mode of
 * guessing is that a request goes out against an in-progress acquisition.
 */
export function interpretField(
  rule: RecordsRequestJurisdictionRule,
  field: string,
  rawValue: string | null | undefined,
): AcquisitionMeaning {
  if (rawValue === null || rawValue === undefined) return 'unknown';
  const value = rawValue.trim().toLowerCase();
  const hit = rule.targeting.fieldSemantics.find(
    (s) => s.field.toLowerCase() === field.toLowerCase() && s.value.trim().toLowerCase() === value,
  );
  return hit?.meaning ?? 'unknown';
}

export interface ParcelEvidence {
  readonly parcelId: string;
  readonly layer: string;
  /** The raw published acquisition-status value, exactly as the layer holds it. */
  readonly acquiredValue: string | null;
  /** ROW certification date, when published. Group B rests entirely on this. */
  readonly rowCertifiedOn: string | null;
  readonly privatelyOwned?: boolean;
}

export type TargetGroup = 'A' | 'B' | 'not-targetable';

export interface ClassifiedParcel extends ParcelEvidence {
  readonly group: TargetGroup;
  readonly meaning: AcquisitionMeaning;
  /** Why it landed in that group, carried into the rendered request. */
  readonly reason: string;
}

/**
 * Sorts a parcel into Group A, Group B, or neither.
 *
 * The Group A / Group B split is what keeps a partial denial from sinking the
 * whole request: A is the agency's own completion flag, B rests on a populated
 * certification date. A parcel with neither is not targetable, and asking
 * about it is what gets a request refused.
 */
export function classifyParcel(
  rule: RecordsRequestJurisdictionRule,
  parcel: ParcelEvidence,
  acquisitionField = 'ACQUIRED',
): ClassifiedParcel {
  const meaning = interpretField(rule, acquisitionField, parcel.acquiredValue);

  if (meaning === 'complete') {
    return {
      ...parcel,
      meaning,
      group: 'A',
      reason: `${acquisitionField} = ${parcel.acquiredValue}, the agency's own completion flag.`,
    };
  }
  if (meaning === 'in-progress') {
    return {
      ...parcel,
      meaning,
      group: 'not-targetable',
      reason:
        `${acquisitionField} indicates the acquisition is still in progress, so records of value ` +
        'remain exempt. Asking about it is what gets a request denied.',
    };
  }
  if (parcel.rowCertifiedOn !== null && parcel.rowCertifiedOn.trim() !== '') {
    return {
      ...parcel,
      meaning,
      group: 'B',
      reason:
        `${acquisitionField} is "${parcel.acquiredValue ?? 'empty'}", which is not an acquisition ` +
        `status and means UNKNOWN rather than no. Right-of-way certification on ` +
        `${parcel.rowCertifiedOn} is strong evidence the process concluded, but it is not the ` +
        `agency's own flag, so this parcel is asked about in the alternative.`,
    };
  }
  return {
    ...parcel,
    meaning,
    group: 'not-targetable',
    reason:
      `${acquisitionField} is "${parcel.acquiredValue ?? 'empty'}" and no right-of-way ` +
      'certification date is published. Nothing here indicates the exemption has lapsed.',
  };
}
