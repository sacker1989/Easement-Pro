import { describe, expect, it } from 'vitest';
import { dispatchToAgent, dispatchMultiple, getTierCoverageSummary } from './dispatch-orchestrator';

describe('Dispatch Orchestrator', () => {
  describe('dispatchToAgent', () => {
    it('routes Tier A county to GIS Explorer agent', () => {
      const result = dispatchToAgent({ county: 'Los Angeles County', state: 'CA' });
      expect(result.county).toBe('Los Angeles County');
      expect(result.routingTier).toBe('immediate');
      expect(result.agent.type).toBe('gis-explorer');
      expect(result.message).toContain('Immediate integration available');
    });

    it('routes Tier B county to API Extractor agent', () => {
      const result = dispatchToAgent({ county: 'Cook County', state: 'IL' });
      expect(result.county).toBe('Cook County');
      expect(result.routingTier).toBe('standard');
      expect(result.agent.type).toBe('api-extractor');
      expect(result.message).toContain('Standard integration available');
    });

    it('routes a county with no online index to the FOIA Generator agent', () => {
      // Santa Clara withdrew its online Official Record Index; in-person only.
      const result = dispatchToAgent({ county: 'Santa Clara County', state: 'CA' });
      expect(result.county).toBe('Santa Clara County');
      expect(result.routingTier).toBe('fallback');
      expect(result.agent.type).toBe('foia-generator');
      expect(result.message).toContain('Limited integration');
    });

    it('routes Harris County to its online search, not a mail-in request', () => {
      // The source blueprint called Harris County legacy/PDF requiring FOIA.
      // It operates an online real property search, so it routes as standard.
      const result = dispatchToAgent({ county: 'Harris County', state: 'TX' });
      expect(result.routingTier).toBe('standard');
      expect(result.agent.type).toBe('api-extractor');
    });

    it('falls back to generic handler for unknown county', () => {
      const result = dispatchToAgent({ county: 'Unknown County', state: 'XX' });
      expect(result.routingTier).toBe('fallback');
      expect(result.agent.type).toBe('generic');
      expect(result.message).toContain('not explicitly mapped');
    });

    it('does not leak another county\'s clerk address into a generic fallback', () => {
      // Regression: an earlier implementation reused the first 'fallback'-tier
      // database row, handing that county's counter address to users in
      // completely unrelated counties.
      const result = dispatchToAgent({ county: 'Cuyahoga County', state: 'OH' });
      const serialized = JSON.stringify(result.agent);

      expect(result.agent.type).toBe('generic');
      expect(serialized).not.toContain('San Jose');
      expect(serialized).not.toContain('Tasman');
      expect(serialized).not.toContain('Houston');
      expect(result.route.county).toBe('Cuyahoga County');
      expect(result.route.state).toBe('OH');
    });

    it('returns the verified Esri REST service for LA County', () => {
      const result = dispatchToAgent({ county: 'Los Angeles County', state: 'CA' });
      expect(result.agent.type).toBe('gis-explorer');
      if (result.agent.type === 'gis-explorer') {
        expect(result.agent.esriServiceUrl).toBe(
          'https://public.gis.lacounty.gov/public/rest/services/LACounty_Cache/LACounty_Parcel/MapServer/0',
        );
        expect(result.agent.source.accessMode).toBe('documented-api');
      }
    });

    it('routes Orange County to the assessment roll, not the bare parcel service', () => {
      // The county publishes land values, but on LegalLotsAttributeOpenData —
      // not on Map_Layers/Parcels, which carries no money at all.
      const result = dispatchToAgent({ county: 'Orange County', state: 'CA' });
      expect(result.routingTier).toBe('immediate');
      expect(result.agent.type).toBe('gis-explorer');
      if (result.agent.type === 'gis-explorer') {
        expect(result.agent.source.accessMode).toBe('documented-api');
        expect(result.agent.esriServiceUrl).toContain('LegalLotsAttributeOpenData');
      }
    });

    it('records that Orange County publishes no Prop 13 base year', () => {
      // Values are real but of unknown vintage, so they cannot be indexed
      // forward the way LA's can.
      const result = dispatchToAgent({ county: 'Orange County', state: 'CA' });
      if (result.agent.type === 'gis-explorer') {
        expect(result.agent.source.limitations).toContain('NO Proposition 13 base year');
        expect(result.agent.source.limitations).toMatch(/LegalStartDate.*NOT be substituted/s);
      }
    });

    it('does not claim an API for counties whose parcel service is gated', () => {
      // San Diego requires a token; Riverside enumerates no layers.
      for (const county of ['San Diego County', 'Riverside County']) {
        const result = dispatchToAgent({ county, state: 'CA' });
        expect(result.agent.type).toBe('api-extractor');
        if (result.agent.type === 'api-extractor') {
          expect(result.agent.source.accessMode).toBe('human-portal');
        }
      }
    });

    it('records the AB 1785 address redaction on San Bernardino', () => {
      const result = dispatchToAgent({ county: 'San Bernardino County', state: 'CA' });
      if (result.agent.type === 'api-extractor') {
        expect(result.agent.source.limitations).toContain('1785');
      }
    });

    it('records the §7928.205 owner-data restriction on the LA County entry', () => {
      // A letter cannot be addressed from this source alone — the statute bars
      // owner name and mailing address from public CA parcel endpoints.
      const result = dispatchToAgent({ county: 'Los Angeles County', state: 'CA' });
      expect(result.agent.type).toBe('gis-explorer');
      if (result.agent.type === 'gis-explorer') {
        expect(result.agent.source.limitations).toContain('7928.205');
      }
    });

    it('returns the verified Clerk search portal for Cook County', () => {
      const result = dispatchToAgent({ county: 'Cook County', state: 'IL' });
      expect(result.agent.type).toBe('api-extractor');
      if (result.agent.type === 'api-extractor') {
        expect(result.agent.searchUrl).toContain('cookcountyclerkil.gov');
        expect(result.agent.source.accessMode).toBe('human-portal');
      }
    });

    it('returns the verified in-person address for Santa Clara County', () => {
      const result = dispatchToAgent({ county: 'Santa Clara County', state: 'CA' });
      expect(result.agent.type).toBe('foia-generator');
      if (result.agent.type === 'foia-generator') {
        expect(result.agent.clerkAddress?.city).toBe('San Jose');
        expect(result.agent.source.accessMode).toBe('in-person-only');
      }
    });

    it('is case-insensitive for county/state matching', () => {
      const result1 = dispatchToAgent({ county: 'los angeles county', state: 'ca' });
      const result2 = dispatchToAgent({ county: 'LOS ANGELES COUNTY', state: 'CA' });
      expect(result1.agent.type).toBe(result2.agent.type);
      expect(result1.routingTier).toBe(result2.routingTier);
    });
  });

  describe('dispatchMultiple', () => {
    it('routes multiple counties correctly', () => {
      const results = dispatchMultiple([
        { county: 'Los Angeles County', state: 'CA' },
        { county: 'Cook County', state: 'IL' },
        { county: 'Santa Clara County', state: 'CA' },
      ]);

      expect(results).toHaveLength(3);
      expect(results[0]?.routingTier).toBe('immediate');
      expect(results[1]?.routingTier).toBe('standard');
      expect(results[2]?.routingTier).toBe('fallback');
    });

    it('handles batch with unknown counties', () => {
      const results = dispatchMultiple([
        { county: 'Los Angeles County', state: 'CA' },
        { county: 'Fake County', state: 'XX' },
      ]);

      expect(results).toHaveLength(2);
      expect(results[0]?.routingTier).toBe('immediate');
      expect(results[1]?.routingTier).toBe('fallback');
    });
  });

  describe('getTierCoverageSummary', () => {
    it('returns coverage summary with all tiers', () => {
      const summary = getTierCoverageSummary();

      expect(summary.tierA.count).toBeGreaterThan(0);
      expect(summary.tierB.count).toBeGreaterThan(0);
      expect(summary.fallback.count).toBeGreaterThan(0);
      expect(summary.totalCounties).toBe(
        summary.tierA.count + summary.tierB.count + summary.fallback.count,
      );
    });

    it('includes California in Tier A states', () => {
      const summary = getTierCoverageSummary();
      expect(summary.tierA.states).toContain('CA');
    });

    it('includes multiple states across tiers', () => {
      const summary = getTierCoverageSummary();
      expect(summary.tierA.states.length).toBeGreaterThan(0);
      expect(summary.tierB.states.length).toBeGreaterThan(0);
    });

    it('totals all counties from database', () => {
      const summary = getTierCoverageSummary();
      // 2 immediate (LA, Orange) + 9 standard + 1 fallback (Santa Clara)
      expect(summary.totalCounties).toBe(12);
      expect(summary.tierA.count).toBe(2);
      expect(summary.tierB.count).toBe(9);
      expect(summary.fallback.count).toBe(1);
    });
  });

  describe('routing message clarity', () => {
    it('provides clear immediate tier message', () => {
      const result = dispatchToAgent({ county: 'Los Angeles County', state: 'CA' });
      expect(result.message).toContain('Immediate integration');
      expect(result.message).toContain('gis-explorer');
      expect(result.message).toContain('Los Angeles County');
    });

    it('provides clear standard tier message', () => {
      const result = dispatchToAgent({ county: 'Cook County', state: 'IL' });
      expect(result.message).toContain('Standard integration');
      expect(result.message).toContain('api-extractor');
    });

    it('provides clear fallback tier message with guidance', () => {
      const result = dispatchToAgent({ county: 'Unknown County', state: 'XX' });
      expect(result.message).toContain('not explicitly mapped');
      expect(result.message).toContain('fallback');
    });
  });
});
