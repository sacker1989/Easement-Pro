/**
 * What a state's Track 1 classification RESTS ON, and whether that support
 * still reaches a product that takes no money.
 *
 * WHY THIS EXISTS, AND IT IS A DEFECT FREE MODE INTRODUCED. `basis` was a
 * free-text string. California's read "Legal Document Assistant statute, Cal.
 * Bus. & Prof. Code §6400 et seq.", which was accurate on the day it was
 * written and stopped being accurate on 2026-10-04, when the product went
 * free. §6400(c) defines a legal document assistant as someone who provides
 * self-help service "for compensation". Compensation is an ELEMENT of the
 * definition. Remove it and the statute does not reach this product at all —
 * so California's tier is justified by a statute that no longer applies to it,
 * and a string field cannot express that.
 *
 * THE DIRECTION OF THIS CHANGE IS GOOD, AND SAYING SO MATTERS. A lapsed basis
 * sounds alarming and is not. Free mode did not weaken a protection; it put
 * the product outside a regulatory regime it was previously inside. What is
 * stale is the DESCRIPTION, not the gate. Track 1 under free mode carries
 * strictly less exposure than Track 1 under the paid regime did:
 *
 *   §6400 et seq. — registration, bonding. Compensation is an element.
 *                   NO LONGER REACHES US. Exposure removed.
 *   §6125         — "No person shall practice law in California unless the
 *                   person is an active licensee of the State Bar."
 *                   No compensation element. UNCHANGED. Exposure identical.
 *
 * So there is no new reason to take anything dark, and this module exists to
 * let the code state that rather than leaving a reader to infer it from a
 * string that now describes the wrong statute.
 *
 * THE TRAP THIS CLOSES. The tempting edit, on noticing §6400 lapsed, is to
 * conclude the regime is satisfied and relax the gate. It is the opposite: the
 * regime that lapsed is the one with a compliance PATH — register, post a
 * bond, and you may operate. The regime that remains has no path short of
 * being a lawyer. Free mode narrowed the open question and made the remainder
 * harder, not easier, and `stillReaches` is deliberately named for what a
 * statute does rather than for whether we are safe.
 */

/** Which body of law a classification is resting on. */
export type RegulatoryRegime =
  /** Document-preparation licensing, e.g. California's LDA statute. */
  | 'document-assistant'
  /** Unauthorized practice of law. Criminal in many states. */
  | 'unauthorized-practice';

export interface RegulatoryBasis {
  /** Formal citation, e.g. "Cal. Bus. & Prof. Code §6400 et seq." */
  readonly citation: string;
  readonly regime: RegulatoryRegime;
  /**
   * Whether the statute's own DEFINITION requires compensation.
   *
   * Not "whether we are currently paid" and not "whether payment makes it
   * worse". This is a fact about the statute's elements, and it is the single
   * field that decides whether free operation moves the product outside it.
   */
  readonly compensationIsAnElement: boolean;
  /**
   * Whether a provider can comply by DOING something — registering, bonding,
   * filing. Recorded because it is what distinguishes the two regimes in
   * practice, and because the absence of a path is the thing most easily lost
   * when a basis is summarised.
   */
  readonly hasCompliancePath: boolean;
  readonly note: string;
}

/**
 * Whether this statute reaches the product, given whether money changes hands.
 *
 * A basis with a compensation element does not reach a free product. Every
 * other basis reaches it regardless.
 */
export function stillReaches(basis: RegulatoryBasis, commerceEnabled: boolean): boolean {
  return commerceEnabled || !basis.compensationIsAnElement;
}

/** The subset of an entry's bases that still govern. */
export function operativeBases(
  bases: readonly RegulatoryBasis[],
  commerceEnabled: boolean,
): readonly RegulatoryBasis[] {
  return bases.filter((b) => stillReaches(b, commerceEnabled));
}

/** Bases that no longer reach the product. Not "resolved" — out of scope. */
export function lapsedBases(
  bases: readonly RegulatoryBasis[],
  commerceEnabled: boolean,
): readonly RegulatoryBasis[] {
  return bases.filter((b) => !stillReaches(b, commerceEnabled));
}

/**
 * True when a classification's stated support has entirely stopped applying.
 *
 * NOT A SAFETY SIGNAL IN EITHER DIRECTION. It means the tier is now asserted
 * without a stated reason, which is a documentation defect to fix rather than
 * a hazard to gate on. California is NOT in this condition: §6400 lapsed and
 * §6125 did not.
 */
export function basisFullyLapsed(
  bases: readonly RegulatoryBasis[] | null,
  commerceEnabled: boolean,
): boolean {
  if (bases === null || bases.length === 0) return false;
  return operativeBases(bases, commerceEnabled).length === 0;
}

/**
 * One line per basis, for the audit record's `complianceBasis` string.
 *
 * The audit record kept a string field when this type arrived, deliberately:
 * records already written hold strings, and a reader comparing an old record
 * to a new one should not have to reconcile two shapes. What changes is that
 * the string now says which bases were OPERATIVE when the record was written,
 * which is the fact a later reader actually needs.
 */
export function basisSummary(
  bases: readonly RegulatoryBasis[] | null,
  commerceEnabled: boolean,
): string | null {
  if (bases === null || bases.length === 0) return null;
  const parts = bases.map((b) => {
    const reach = stillReaches(b, commerceEnabled)
      ? 'operative'
      : 'not operative (compensation is an element and this product is free)';
    return `${b.citation} [${b.regime}; ${reach}]`;
  });
  return parts.join('; ');
}
