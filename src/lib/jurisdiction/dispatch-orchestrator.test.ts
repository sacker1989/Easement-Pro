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

    it('routes Tier C county to FOIA Generator agent', () => {
      const result = dispatchToAgent({ county: 'Harris County', state: 'TX' });
      expect(result.county).toBe('Harris County');
      expect(result.routingTier).toBe('fallback');
      expect(result.agent.type).toBe('foia-generator');
      expect(result.message).toContain('Limited integration');
    });

    it('falls back to generic handler for unknown county', () => {
      const result = dispatchToAgent({ county: 'Unknown County', state: 'XX' });
      expect(result.routingTier).toBe('fallback');
      expect(result.agent.type).toBe('generic');
      expect(result.message).toContain('not explicitly mapped');
    });

    it('does not leak another county\'s clerk address into a generic fallback', () => {
      // Regression: an earlier implementation reused the first 'fallback'-tier
      // database entry (Harris County, TX), handing a Houston mailing address
      // to users in completely unrelated counties.
      const result = dispatchToAgent({ county: 'Cuyahoga County', state: 'OH' });

      expect(result.agent.type).toBe('generic');
      expect(JSON.stringify(result.agent)).not.toContain('Caroline');
      expect(JSON.stringify(result.agent)).not.toContain('Houston');
      expect(result.route.county).toBe('Cuyahoga County');
      expect(result.route.state).toBe('OH');
    });

    it('returns correct Esri URL for LA County', () => {
      const result = dispatchToAgent({ county: 'Los Angeles County', state: 'CA' });
      expect(result.agent.type).toBe('gis-explorer');
      if (result.agent.type === 'gis-explorer') {
        expect(result.agent.countyGisPortal).toContain('lacounty.gov');
      }
    });

    it('returns correct Tyler Tech API for Cook County', () => {
      const result = dispatchToAgent({ county: 'Cook County', state: 'IL' });
      expect(result.agent.type).toBe('api-extractor');
      if (result.agent.type === 'api-extractor') {
        expect(result.agent.platformName).toBe('tyler-tech');
        expect(result.agent.apiEndpoint).toContain('cookcountyclerk');
      }
    });

    it('returns correct mailing address for Harris County FOIA', () => {
      const result = dispatchToAgent({ county: 'Harris County', state: 'TX' });
      expect(result.agent.type).toBe('foia-generator');
      if (result.agent.type === 'foia-generator') {
        expect(result.agent.clerkAddress?.street).toBe('201 Caroline St');
        expect(result.agent.clerkAddress?.city).toBe('Houston');
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
        { county: 'Harris County', state: 'TX' },
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
      // COUNTY_AGENT_ROUTES: 3 immediate (CA) + 4 standard (GA/TX/IL/NV) + 1 fallback (TX)
      expect(summary.totalCounties).toBe(8);
      expect(summary.tierA.count).toBe(3);
      expect(summary.tierB.count).toBe(4);
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
