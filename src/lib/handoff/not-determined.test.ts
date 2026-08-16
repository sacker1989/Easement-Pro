import { describe, expect, it } from 'vitest';
import {
  allNotDeterminedKeys,
  buildNotDetermined,
  FLOOR_KEYS,
  hasFloorItems,
  type NotDeterminedSection,
} from './not-determined';

describe('the floor is unconditional', () => {
  it('appears with no inputs at all', () => {
    const s = buildNotDetermined();
    expect(hasFloorItems(s)).toBe(true);
  });

  it('appears even when every input says the question is answered', () => {
    // The floor exists because no formula produces a permanent easement value,
    // which is settled research — not a gap that better inputs close.
    const s = buildNotDetermined({
      easementIsRecorded: true,
      instrumentTermsRead: true,
      ownerKnown: true,
      areaKnown: true,
      landValueEmitted: true,
      stateRuleSetReviewed: true,
    });
    expect(hasFloorItems(s)).toBe(true);
    expect(s.map((i) => i.key)).toEqual([...FLOOR_KEYS]);
  });
});

describe('an empty section cannot exist', () => {
  it('does not typecheck', () => {
    // The suppression directive IS the assertion: relax NotDeterminedSection to
    // a plain array and this error disappears, at which point tsc fails on the
    // now-unused directive.
    // @ts-expect-error an empty section is not assignable
    const empty: NotDeterminedSection = [];
    expect(empty).toHaveLength(0);
  });

  it('always returns at least the four floor items', () => {
    expect(buildNotDetermined().length).toBeGreaterThanOrEqual(4);
  });
});

describe('polarity: silence produces MORE caveats, never fewer', () => {
  it('yields more items for no inputs than for fully-answered inputs', () => {
    const silent = buildNotDetermined();
    const answered = buildNotDetermined({
      easementIsRecorded: true,
      instrumentTermsRead: true,
      ownerKnown: true,
      areaKnown: true,
      landValueEmitted: true,
      stateRuleSetReviewed: true,
    });
    expect(silent.length).toBeGreaterThan(answered.length);
  });

  it('adds the recorded-instrument caveats when nothing is known', () => {
    const keys = buildNotDetermined().map((i) => i.key);
    expect(keys).toContain('easement-existence');
    expect(keys).toContain('easement-terms');
    expect(keys).toContain('encumbered-area');
    expect(keys).toContain('legal-conclusions');
  });
});

describe('conditional items', () => {
  it('raises authorisation-of-occupation only when infrastructure is ON the parcel', () => {
    // Tier A. The item that says the owner may be OWED compensation rather
    // than burdened — the direction geometry cannot settle.
    expect(buildNotDetermined({ infrastructureOnParcel: true }).map((i) => i.key)).toContain(
      'authorisation-of-occupation',
    );
    expect(buildNotDetermined({ infrastructureOnParcel: false }).map((i) => i.key)).not.toContain(
      'authorisation-of-occupation',
    );
  });

  it('keeps that item explicit about the direction being undetermined', () => {
    const item = buildNotDetermined({ infrastructureOnParcel: true }).find(
      (i) => i.key === 'authorisation-of-occupation',
    );
    expect(item!.why).toMatch(/may OWE the owner compensation/);
    expect(item!.why).toMatch(/DIRECTION IS NOT FIXED/);
  });

  it('raises temporary items only for a temporary easement', () => {
    const perm = buildNotDetermined({ isTemporary: false }).map((i) => i.key);
    const temp = buildNotDetermined({ isTemporary: true }).map((i) => i.key);
    expect(perm).not.toContain('temporary-term');
    expect(temp).toContain('temporary-term');
    expect(temp).toContain('observed-market-rent');
  });

  it('drops the temporary rent caveat once an observed rate exists', () => {
    const keys = buildNotDetermined({ isTemporary: true, observedRentAvailable: true }).map(
      (i) => i.key,
    );
    expect(keys).not.toContain('observed-market-rent');
  });
});

describe('every item is actionable', () => {
  it('names what, why, who resolves it, and what would resolve it', () => {
    // An item that says only "unknown" is a shrug. Each must route the reader
    // somewhere concrete.
    for (const item of buildNotDetermined({ infrastructureOnParcel: true, isTemporary: true })) {
      expect(item.what.length).toBeGreaterThan(15);
      expect(item.why.length).toBeGreaterThan(40);
      expect(item.whatWouldResolveIt.length).toBeGreaterThan(15);
      expect(item.whoResolves).toBeTruthy();
    }
  });

  it('cites the standard on the permanent-value item', () => {
    const item = buildNotDetermined().find((i) => i.key === 'permanent-easement-value');
    expect(item!.why).toMatch(/strip valuation/);
    expect(item!.why).toMatch(/Uniform Appraisal Standards/);
  });

  it('emits no duplicate keys', () => {
    const keys = buildNotDetermined({ infrastructureOnParcel: true, isTemporary: true }).map(
      (i) => i.key,
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('exposes the whole catalogue for enumeration', () => {
    expect(allNotDeterminedKeys().length).toBe(14);
  });
});
