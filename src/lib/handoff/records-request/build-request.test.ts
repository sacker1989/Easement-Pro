import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildRecordsRequest,
  NOT_SENT_BANNER,
  RecordsRequestError,
  buildRequestFromRule,
  type RecordsRequestDraft,
  type RecordsRequestOptions,
} from './build-request';
import { lookupJurisdiction, supportedJurisdictions } from './registry';
import { FL_FDOT_D7, FL_FDOT_D7_WORKED_PARCELS } from './fl-fdot';
import { classifyParcel, interpretField, type ParcelEvidence } from './jurisdiction-rule';
import { unclassifiedState } from '@/lib/gating/state-tier-config';

const PARCELS: readonly ParcelEvidence[] = [
  // The two the Department's own flag marks complete.
  { parcelId: '705A', layer: 'Segment3ROWParcels', acquiredValue: 'COMPLETE', rowCertifiedOn: '2023-12-31' },
  { parcelId: '705B', layer: 'Segment3ROWParcels', acquiredValue: 'COMPLETE', rowCertifiedOn: '2023-12-31' },
  // ROW-certified, ACQUIRED = "N/A". The twelve that a naive reading discards.
  { parcelId: '700', layer: 'Segment3ROWParcels', acquiredValue: 'N/A', rowCertifiedOn: '2022-10-20' },
  { parcelId: '701', layer: 'Segment3ROWParcels', acquiredValue: 'N/A', rowCertifiedOn: '2024-05-31' },
  { parcelId: '702', layer: 'US301_Parcels', acquiredValue: 'N/A', rowCertifiedOn: '2024-10-31' },
  // The superseded Pasco targeting: empty ACQUIRED, no certification date.
  { parcelId: 'P-01', layer: 'Segment_2a_ROW_Status', acquiredValue: '', rowCertifiedOn: null },
];

function options(over: Partial<RecordsRequestOptions> = {}): RecordsRequestOptions {
  return {
    requesterName: 'A. Requester',
    requesterContact: 'requester@example.com',
    feeCeilingUsd: 50,
    parcels: PARCELS,
    subjectMatter: 'temporary construction easement (TCE)',
    sourceLayers: [...FL_FDOT_D7_WORKED_PARCELS.layers],
    sourceOrg: FL_FDOT_D7_WORKED_PARCELS.arcgisOrg,
    stateCompliance: unclassifiedState('FL'),
    now: new Date('2026-08-17T00:00:00.000Z'),
    ...over,
  };
}

function draft(over: Partial<RecordsRequestOptions> = {}): RecordsRequestDraft {
  const result = buildRecordsRequest('FL/FDOT-D7', options(over));
  if (result.status !== 'draft-not-sent') throw new Error('expected a draft');
  return result;
}

describe('"N/A" means unknown, not no', () => {
  // The single most consequential reading in the worked example. Treating it
  // as a negative discards twelve ROW-certified parcels; treating it as a
  // positive targets in-progress acquisitions and gets the request denied.
  it('maps the literal string to unknown', () => {
    expect(interpretField(FL_FDOT_D7, 'ACQUIRED', 'N/A')).toBe('unknown');
  });

  it('still targets an unknown parcel that carries a certification date', () => {
    const p = classifyParcel(FL_FDOT_D7, PARCELS[2]!);
    expect(p.group).toBe('B');
    expect(p.reason).toMatch(/means UNKNOWN rather than no/);
  });

  it('excludes an unknown parcel with no certification date', () => {
    const p = classifyParcel(FL_FDOT_D7, {
      parcelId: 'X',
      layer: 'L',
      acquiredValue: 'N/A',
      rowCertifiedOn: null,
    });
    expect(p.group).toBe('not-targetable');
  });

  it('defaults an unrecognised value to unknown rather than guessing', () => {
    expect(interpretField(FL_FDOT_D7, 'ACQUIRED', 'PENDING REVIEW')).toBe('unknown');
  });

  it('treats the empty Pasco value as in-progress and refuses to target it', () => {
    // The superseded targeting, encoded. ACQUIRED and ACQ_DATE were empty
    // across all 27 records there.
    const p = classifyParcel(FL_FDOT_D7, PARCELS[5]!);
    expect(p.meaning).toBe('in-progress');
    expect(p.group).toBe('not-targetable');
    expect(p.reason).toMatch(/still in progress/);
  });
});

describe('the Group A / Group B split survives into the draft', () => {
  it('separates the agency flag from the certification date', () => {
    const d = draft();
    expect(d.groupA.map((p) => p.parcelId)).toEqual(['705A', '705B']);
    expect(d.groupB.map((p) => p.parcelId)).toEqual(['700', '701', '702']);
    expect(d.excluded.map((p) => p.parcelId)).toEqual(['P-01']);
  });

  it('names both groups in the body, so a partial denial does not sink it', () => {
    const body = draft().body;
    expect(body).toContain('Group A —');
    expect(body).toContain('Group B —');
    expect(body).toContain('705A');
  });

  it('never asks about an excluded parcel', () => {
    expect(draft().body).not.toContain('P-01');
  });

  it('refuses to build a request with nothing targetable', () => {
    expect(() =>
      buildRecordsRequest('FL/FDOT-D7', options({ parcels: [PARCELS[5]!] })),
    ).toThrow(RecordsRequestError);
    expect(() => buildRecordsRequest('FL/FDOT-D7', options({ parcels: [PARCELS[5]!] }))).toThrow(
      /would draw a denial/,
    );
  });
});

describe('Item 1 stands on its own', () => {
  it('asserts the split when the rule carries a severability argument', () => {
    const d = draft();
    expect(d.severabilityAsserted).toBe(true);
    expect(d.body).toContain('Item 1 is requested independently of Item 2');
    expect(d.body).toMatch(/term of the instrument rather than an appraisal/);
  });

  it('keeps Item 1 when Item 2 is omitted entirely', () => {
    // A follow-up asking only the severable term must still stand alone.
    const d = draft({ includeCompensationItem: false });
    expect(d.items).toHaveLength(1);
    expect(d.items[0]!.number).toBe(1);
    expect(d.items[0]!.severableFromValueExemption).toBe(true);
    expect(d.body).toMatch(/requested independently of any record of value/);
    expect(d.subject).not.toMatch(/compensation/);
  });

  it('does NOT assert the split when the rule has no argument for it', () => {
    // Claiming severability without a basis invites the denial it was meant to
    // avoid, so the sentence is absent rather than hedged. Built through the
    // real rendering path — asserting against the rule object would only prove
    // the fixture is shaped as written.
    const noArgument = {
      ...FL_FDOT_D7,
      key: 'TEST/NO-SEVERABILITY',
      valueRecordExemption: { ...FL_FDOT_D7.valueRecordExemption!, severabilityArgument: null },
    };
    const d = buildRequestFromRule(noArgument, options());
    expect(d.severabilityAsserted).toBe(false);
    expect(d.body).not.toContain('requested independently');
    expect(d.items[0]!.severableFromValueExemption).toBe(false);
    // The rest of the request still stands: the exemption paragraph and the
    // withholding asks do not depend on severability.
    expect(d.body).toContain('Group A —');
    expect(d.body).toMatch(/\(b\) State the statutory basis/);
  });
});

describe('every draft is unsent, and says so', () => {
  it('carries the status and the banner verbatim', () => {
    const d = draft();
    expect(d.status).toBe('draft-not-sent');
    expect(d.notSentBanner).toBe(NOT_SENT_BANNER);
    expect(d.body.startsWith(NOT_SENT_BANNER)).toBe(true);
  });

  it('states that the product cannot file it', () => {
    expect(NOT_SENT_BANNER).toMatch(/no\s+ability to file it/);
    expect(NOT_SENT_BANNER).toMatch(/your decision/);
  });

  it('exposes no function that could send it', () => {
    // Source-text assertion. A comment saying "never send" would not survive a
    // refactor that adds a convenience helper.
    const src = readFileSync(new URL('./build-request.ts', import.meta.url), 'utf8').replace(
      /\/\*[\s\S]*?\*\//g,
      '',
    );
    for (const forbidden of ['fetch(', 'sendMail', 'nodemailer', 'axios', 'XMLHttpRequest']) {
      expect(src).not.toContain(forbidden);
    }
  });
});

describe('the three withholding asks and the fee ceiling', () => {
  it('renders all three asks', () => {
    const body = draft().body;
    expect(body).toMatch(/\(a\) Provide the records/);
    expect(body).toMatch(/\(b\) State the statutory basis/);
    expect(body).toMatch(/\(c\) Tell me what identifier to cite/);
  });

  it('states the ceiling and prefers a spreadsheet to instruments', () => {
    const body = draft().body;
    expect(body).toContain('$50');
    expect(body).toMatch(/spreadsheet listing term and amount per parcel is preferable/);
  });

  it('falls back to the rule when no ceiling is given', () => {
    const body = draft({ feeCeilingUsd: null }).body;
    expect(body).not.toMatch(/exceed \$/);
    expect(body).toContain(FL_FDOT_D7.feeAdvanceRule);
  });
});

describe('the Florida statute never leaks into another state', () => {
  const OTHER = ['PA/Berks', 'CA/Caltrans-D7', 'TX/TxDOT'];

  it('returns unsupported with an explanation', () => {
    for (const key of OTHER) {
      const r = lookupJurisdiction(key);
      expect(r.status).toBe('unsupported');
      if (r.status !== 'unsupported') continue;
      expect(r.explanation.length).toBeGreaterThan(100);
      expect(r.whatWouldBeNeeded.length).toBeGreaterThan(3);
    }
  });

  it('mentions no Florida citation anywhere in that output', () => {
    // A generated request citing the wrong authority is worse than none: it
    // tells the custodian the requester does not know the applicable law.
    for (const key of OTHER) {
      const text = JSON.stringify(lookupJurisdiction(key));
      expect(text).not.toContain('119.0711');
      expect(text).not.toContain('Chapter 119');
      expect(text).not.toContain('Florida');
      expect(text).not.toContain('FDOT');
    }
  });

  it('does not fall back to the researched rule when building', () => {
    const result = buildRecordsRequest('PA/Berks', options());
    expect(result.status).toBe('unsupported');
    expect(JSON.stringify(result)).not.toContain('119.0711');
  });

  it('ships exactly one populated rule', () => {
    expect(supportedJurisdictions()).toEqual(['FL/FDOT-D7']);
  });
});

describe('the audit record', () => {
  it('is produced per request, with the widened letterType', () => {
    const d = draft();
    expect(d.audit.letterType).toBe('records-request');
    expect(d.audit.state).toBe('FL');
    expect(d.audit.disclaimerVersion.length).toBeGreaterThan(0);
    expect(d.audit.generatedAt).toBe('2026-08-17T00:00:00.000Z');
  });
});

describe('the rule records what the scan actually found', () => {
  it('keeps the provenance of the targeting, including what was superseded', () => {
    expect(FL_FDOT_D7_WORKED_PARCELS.servicesScanned).toBe(1558);
    expect(FL_FDOT_D7_WORKED_PARCELS.supersededTargeting).toMatch(/empty across all 27 records/);
    expect(FL_FDOT_D7_WORKED_PARCELS.whyOnlyTwoItems).toMatch(/only two inputs that are not/);
  });

  it('verifies the custodian rather than inferring it', () => {
    expect(FL_FDOT_D7.custodian.verifiedOn).toBe('2026-08-02');
    expect(FL_FDOT_D7.custodian.email).toContain('@dot.state.fl.us');
  });
});
