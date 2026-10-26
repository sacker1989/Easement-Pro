import { describe, expect, it } from 'vitest';
import {
  COUNTY_UTILITY_SOURCES,
  NATIONAL_UTILITY_SOURCES,
  STATE_UTILITY_SOURCES,
  type CountyUtilitySource,
} from './county-utilities';

const ALL: readonly CountyUtilitySource[] = [
  ...Object.values(COUNTY_UTILITY_SOURCES).flat(),
  ...Object.values(STATE_UTILITY_SOURCES).flat(),
  ...NATIONAL_UTILITY_SOURCES,
];

describe('every wired source accounts for itself', () => {
  it('is a table worth testing', () => {
    // Guards below iterate; an empty table would pass all of them silently.
    expect(ALL.length).toBeGreaterThanOrEqual(6);
  });

  it('states its own coverage, because absence is ambiguous', () => {
    /*
     * A query that matches nothing outside a service area and one that
     * matches nothing inside it are the same query result and mean opposite
     * things. Every source must be able to say which it is.
     */
    for (const s of ALL) expect(s.coverage.length).toBeGreaterThan(80);
  });

  it('names a publisher a reader could actually ring', () => {
    for (const s of ALL) expect(s.publisher.trim()).not.toBe('');
  });

  it('queries its layer without a /query suffix baked in', () => {
    // Appending it is the caller's job, and doing it twice is a 400. This was
    // a production bug once: the stored URL was a layer URL, the local test
    // had /query typed by hand, and only production saw the difference.
    for (const s of ALL) expect(s.layerUrl).not.toMatch(/\/query$/);
  });

  it('reads the fields its own describe and quality depend on', () => {
    for (const s of ALL) expect(s.outFields.length).toBeGreaterThan(0);
  });
});

describe('the federal transmission layer', () => {
  const [hifld] = NATIONAL_UTILITY_SOURCES;

  it('is wired, because Cook County has nothing else', () => {
    /*
     * Cook was the one served county with no agency utility source at all.
     * Checked by name on 2026-10-15: Cook County's GIS "Utilities" folder
     * holds Esri geometry and printing services, not a network; the Chicago
     * data portal returns nothing for "sewer" or "water main" geometry; and
     * MWRD, which operates the interceptors, publishes watersheds, outfalls
     * and plants but no pipe alignments. Chicago withholds buried utility
     * geometry. The federal transmission layer is what is actually available.
     */
    expect(hifld).toBeDefined();
    expect(hifld!.publisher).toMatch(/HIFLD/);
  });

  it('reads the INFERRED flag rather than assuming survey accuracy', () => {
    expect(hifld!.outFields).toContain('INFERRED');
    expect(hifld!.quality({ INFERRED: 'Y' })).toBe('inferred');
    expect(hifld!.quality({ INFERRED: 'y' })).toBe('inferred');
    expect(hifld!.quality({ INFERRED: 'N' })).toBe('mapped');
  });

  it('treats a missing flag as mapped, deliberately', () => {
    /*
     * The safer-looking default would be 'inferred'. It is the wrong one: an
     * absent column means the layer does not make the distinction, and
     * suppressing the tier for every such source would make the field mean
     * "unknown provenance" instead of "the publisher says it is inferred".
     * Only this layer publishes the flag, and it publishes it on every row.
     */
    expect(hifld!.quality({})).toBe('mapped');
  });

  it('does not render "NOT AVAILABLE" as an owner', () => {
    /*
     * A LITERAL VALUE IN THE COLUMN, not a null, on three of eight rows
     * sampled near Chicago. Passed through it reads as the name of the
     * company that owns the line.
     */
    const label = hifld!.describe({ OWNER: 'NOT AVAILABLE', VOLTAGE: 138, TYPE: 'AC; OVERHEAD', STATUS: 'IN SERVICE' });
    expect(label).not.toMatch(/NOT AVAILABLE/i);
    expect(label).toBe('138kV overhead electricity transmission line');
  });

  it('names the owner when there is one', () => {
    expect(
      hifld!.describe({ OWNER: 'COMMONWEALTH EDISON CO', VOLTAGE: 345, TYPE: 'AC; OVERHEAD', STATUS: 'IN SERVICE' }),
    ).toBe('345kV overhead electricity transmission line (COMMONWEALTH EDISON CO)');
  });

  it('says overhead or underground, which is the fact a neighbor cares about', () => {
    expect(hifld!.describe({ TYPE: 'AC; OVERHEAD' })).toMatch(/overhead/);
    expect(hifld!.describe({ TYPE: 'AC; UNDERGROUND' })).toMatch(/underground/);
    // Neither, rather than a guess, when the column says neither.
    expect(hifld!.describe({ TYPE: '' })).not.toMatch(/overhead|underground/);
  });

  it('flags a line that is not in service', () => {
    expect(hifld!.describe({ VOLTAGE: 138, TYPE: 'AC; OVERHEAD', STATUS: 'NOT AVAILABLE' })).toMatch(/—/);
    expect(hifld!.describe({ VOLTAGE: 138, TYPE: 'AC; OVERHEAD', STATUS: 'IN SERVICE' })).not.toMatch(/—/);
  });

  it('tells a reader that transmission is not the lines on their street', () => {
    // The commonest outcome for a residential address is that this layer
    // finds nothing, and that must not read as "no power lines near you".
    expect(hifld!.coverage).toMatch(/does not include distribution/i);
    expect(hifld!.coverage).toMatch(/normal case/i);
  });

  it('says plainly where no sewer layer exists at all', () => {
    expect(hifld!.coverage).toMatch(/Chicago and Cook County do not publish/i);
  });
});

describe('the sewer and storm layers claim survey accuracy, and may', () => {
  it('marks as-built operator records mapped', () => {
    const sewers = Object.values(COUNTY_UTILITY_SOURCES).flat();
    for (const s of sewers) expect(s.quality({})).toBe('mapped');
  });
});
