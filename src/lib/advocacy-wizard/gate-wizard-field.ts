import type { TieredResult } from '@/lib/analysis-layer/confidence-tiering';
import {
  clarificationPointFromTieredResult,
  type ClarificationPoint,
} from '@/lib/letters/request-for-clarification';

/**
 * Per-field gating for the Advocacy Wizard (Track 1) — "per-field blocking
 * (not whole-document blocking)" per docs/development-strategy-v2.md. Each
 * wizard field (e.g. easement duration) is gated independently: a Clear
 * result is usable as-is, a Likely-with-caveat result is usable but must
 * surface its caveat, and a Flagged-ambiguous result is blocked from being
 * asserted in a paid, document-specific letter — but the wizard as a whole
 * is not blocked, and the user gets a Request for Clarification (Track 2)
 * offer for that specific field instead of being dead-ended.
 */

export type FieldGateStatus = 'usable' | 'usable-with-caveat' | 'blocked';

export type WizardFieldGateResult<TValue> =
  | { field: string; status: 'usable'; value: TValue }
  | { field: string; status: 'usable-with-caveat'; value: TValue; caveat: string }
  | { field: string; status: 'blocked'; clarificationOffer: ClarificationPoint };

export function gateWizardField<TValue>(
  field: string,
  result: TieredResult<TValue>,
): WizardFieldGateResult<TValue> {
  if (result.tier === 'clear') {
    return { field, status: 'usable', value: result.value };
  }
  if (result.tier === 'likely-with-caveat') {
    return { field, status: 'usable-with-caveat', value: result.value, caveat: result.caveat };
  }
  const clarificationOffer = clarificationPointFromTieredResult(field, result);
  // Unreachable: clarificationPointFromTieredResult only returns null for a 'clear' result,
  // and this branch has already excluded 'clear' above.
  if (!clarificationOffer) {
    throw new Error('Unexpected: no clarification offer for a flagged-ambiguous field.');
  }
  return { field, status: 'blocked', clarificationOffer };
}

export function isFieldUsableInLetter<TValue>(
  gateResult: WizardFieldGateResult<TValue>,
): gateResult is Extract<WizardFieldGateResult<TValue>, { status: 'usable' | 'usable-with-caveat' }> {
  return gateResult.status !== 'blocked';
}
