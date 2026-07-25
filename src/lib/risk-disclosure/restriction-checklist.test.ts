import { describe, expect, it } from 'vitest';
import { buildRestrictionChecklist } from './restriction-checklist';

describe('buildRestrictionChecklist', () => {
  it('returns all four activities for every purpose', () => {
    const activities = buildRestrictionChecklist('utility').map((item) => item.activity);
    expect(activities).toEqual(['fencing', 'additions', 'pool', 'landscaping']);
  });

  it('permits shallow landscaping under a utility easement', () => {
    const checklist = buildRestrictionChecklist('utility');
    const landscaping = checklist.find((item) => item.activity === 'landscaping');
    expect(landscaping?.restricted).toBe(false);
  });

  it('restricts landscaping under a sewer easement (root damage risk)', () => {
    const checklist = buildRestrictionChecklist('sewer');
    const landscaping = checklist.find((item) => item.activity === 'landscaping');
    expect(landscaping?.restricted).toBe(true);
  });

  it('defaults every activity to restricted when the purpose is unknown', () => {
    const checklist = buildRestrictionChecklist('unknown');
    expect(checklist.every((item) => item.restricted)).toBe(true);
  });

  it('every item includes a rationale', () => {
    const checklist = buildRestrictionChecklist('access');
    expect(checklist.every((item) => item.rationale.length > 0)).toBe(true);
  });
});
