# Phase 2: Multi-Agent Jurisdiction Routing System

## Overview

This module implements multi-agent orchestration and county-specific routing inspired by the **Property Advocacy Orchestration Platform scaffolding blueprint**. It extends Phase 1's California-only focus to a national multi-state architecture with specialized agents per jurisdiction.

## Architecture

### Three-Tier Agent System

#### Tier A: Immediate Integration (Full Capability)
**GIS Explorer Agents** — Real-time parcel data and easement vectors via county GIS portals and Esri MapServers.

- **Target Counties**: Los Angeles, San Francisco, Santa Clara (CA)
- **Output**: Georeferenced easement shapes, boundary proximity, JSON metadata with direct GIS URLs
- **Latency**: Real-time or near-real-time
- **Phase 1 Integration**: LA County fallback already uses this tier's data model

#### Tier B: Standard Integration (API-Based)
**API Extractor Agents** — Deed instruments and covenant clauses via county recorder index APIs.

- **Target Platforms**: Tyler Technologies, qPublic, Avenu, county-specific index servers
- **Target Counties**: Fulton GA, Dallas TX, Cook IL, Clark NV (expand in Phase 2)
- **Output**: Deed document references, recorded dates, covenant clauses, index URLs
- **Latency**: 1–5 seconds (API call + parsing)
- **Phase 1 Integration**: ParcelLookupProvider interface can be extended to use these APIs

#### Tier C: Fallback (Manual / Legacy)
**FOIA Request Generator Agents** — Public record request templates for unmapped or legacy systems.

- **Target Counties**: Harris TX and other unmapped jurisdictions
- **Output**: State-specific FOIA templates, mailing addresses, processing timelines
- **Latency**: 10–30 days (mail-in requests)
- **Phase 1 Integration**: Complements Track 2 (Request for Clarification) when automated lookup unavailable

### Dispatch Orchestrator

The `dispatch-orchestrator.ts` module handles routing:

```typescript
const result = dispatchToAgent({
  county: "Los Angeles County",
  state: "CA"
});

// Returns:
// {
//   county: "Los Angeles County",
//   state: "CA",
//   agent: {
//     type: "gis-explorer",
//     esriServiceUrl: "...",
//     ...
//   },
//   routingTier: "immediate",
//   message: "Immediate integration available..."
// }
```

## Phase 1 → Phase 2 Integration Points

### Step 1: Address Resolution + County Dispatch
**Current (Phase 1)**: `normalizeAddress()` → `resolveAddress()` → LA County fallback

**Phase 2 Enhancement**:
```typescript
// In src/lib/parcel-resolution/resolve-address.ts
const normalizedAddress = normalizeAddress({street, city, state, zip});
const parcelResult = await lookupParcel(normalizedAddress);

// NEW: Dispatch to county-specific agent
const dispatch = dispatchToAgent({
  county: parcelResult.county,
  state: parcelResult.state
});

// Use dispatch.agent config to fetch real-time data
const gisData = await fetchGISData(dispatch.agent);
```

**Files to enhance**:
- `src/lib/parcel-resolution/resolve-address.ts` — add dispatch call after county resolution
- `src/lib/parcel-resolution/parcel-lookup-provider.ts` — extend to support county-agent configs

### Step 3: Risk Disclosure + Agent-Driven Economic Impact
**Current (Phase 1)**: Hardcoded national benchmarks, LA County label in data-coverage

**Phase 2 Enhancement**:
```typescript
// In src/lib/risk-disclosure/economic-impact.ts
const coverage = classifyDataCoverage({
  county,
  state,
  dispatch: dispatchToAgent({county, state})
});

// Use Tier A/B/C to weight confidence in value estimates
if (coverage.tier === 'immediate') {
  // Tier A: GIS data + local assessor = "Verified" confidence
  return buildEconomicImpactEstimate(highConfidenceData);
} else if (coverage.tier === 'standard') {
  // Tier B: API data + estimated = "Likely-with-caveat" confidence
  return buildEconomicImpactEstimate(moderateConfidenceData);
} else {
  // Tier C: No automated data = "Flagged-ambiguous", suggest Track 2 FOIA
  return buildEconomicImpactEstimate(lowConfidenceData, {
    caveat: "No automated record access for this county. Use Track 2 to request records."
  });
}
```

**Files to create/enhance**:
- `src/lib/risk-disclosure/build-risk-disclosure-report.ts` — integrate dispatch for tier-based confidence weighting
- Extend confidence-tiering engine to map dispatch tiers → confidence levels

### Step 5: Advocacy Wizard + Jurisdiction Gating
**Current (Phase 1)**: State-tier gating (CA = Tier A only)

**Phase 2 Enhancement**:
```typescript
// In src/lib/gating/advocacy-wizard-access.ts
const stateCompliance = resolveStateCompliance(state);
const countyDispatch = dispatchToAgent({county, state});

// Combine state-tier + county-agent tier for feature availability
const accessLevel = {
  track1Available: stateCompliance.tier === 'A' && countyDispatch.routingTier === 'immediate',
  track2Recommended: countyDispatch.routingTier === 'fallback',
  jurisdictionMessage: countyDispatch.message
};
```

**Files to enhance**:
- `src/lib/gating/advocacy-wizard-access.ts` — add county dispatch to access evaluation

### Step 6: Checkout + Audit Trail with Jurisdiction Context
**Current (Phase 1)**: Audit record includes state tier and attorney review status

**Phase 2 Enhancement**:
```typescript
// In src/lib/compliance/audit-record.ts
export interface SendAuditRecord {
  // ... existing fields
  jurisdictionCounty?: string;
  jurisdictionAgentType?: CountyResolverAgentType;
  jurisdictionTier?: 'immediate' | 'standard' | 'fallback';
}

// buildSendAuditRecord() now includes county routing info
const record = buildSendAuditRecord({
  // ... existing params
  county: dispatch.county,
  agentType: dispatch.agent.type,
  tier: dispatch.routingTier
});
```

## Compliance & Risk Gating

### State-Tier System (Phase 1) + County-Agent Tiers (Phase 2)

**Combined Matrix**:
| State Tier | County Agent Tier | Result | Access |
|------------|------------------|--------|--------|
| A | Immediate | High confidence, full Track 1 | ✓ Track 1 + Track 2 |
| A | Standard | Moderate confidence, limited Track 1 | ✓ Track 1 + Track 2 (suggest caveat) |
| A | Fallback | Low confidence, suggest Track 2 | ✓ Track 2, offer Track 1 with warning |
| B | Immediate | Tier B mandatory review applies | ✓ Track 1 (mandatory review) + Track 2 |
| B | Standard | Tier B mandatory review + county limitation | ✓ Track 1 (mandatory review) + Track 2 |
| B | Fallback | Tier B mandatory review, no automated lookup | ✓ Track 2 + FOIA |
| C/Unclassified | Any | Track 1 unavailable | Track 2 + FOIA |

### Audit Trail + Jurisdictional Evidence

Each letter/decision now includes:
- **State compliance basis** (existing: Tier A/B/C from `src/config/state-tiers.ts`)
- **County agent routing** (new: gis-explorer / api-extractor / foia-generator)
- **Data confidence level** (existing: clear/likely-with-caveat/flagged; now weighted by county tier)
- **Source attribution** (existing: LA County Registrar; now: GIS URL / API endpoint / FOIA template)

## Database & Expansion

### Current Coverage (Phase 2.0)
- **Tier A**: 3 California counties (LA, SF, Santa Clara)
- **Tier B**: 5 counties (Fulton GA, Dallas TX, Cook IL, Clark NV, + placeholder for expansion)
- **Fallback**: Harris County TX + generic handler

### Adding New Counties
1. **Research county record platform** (Esri, Tyler Tech, qPublic, or legacy)
2. **Create agent config** in `county-database.ts` with appropriate type
3. **Set tier** based on API availability and latency (immediate → standard → fallback)
4. **Test dispatch routing** with DispatchOrchestrator tests
5. **Document platform-specific quirks** (e.g., API auth, search syntax, rate limits)

**Example: Adding Cook County, IL**
```typescript
{
  county: "Cook County",
  state: "IL",
  fipsCode: "17031",
  tier: "standard",
  agent: {
    type: "api-extractor",
    platformName: "tyler-tech",
    apiEndpoint: "https://recorder.cookcountyclerk.com/api",
    apiKeyRequired: true,
    recordIndexPath: "/recorder-search",
    description: "Cook County Clerk recorder system"
  }
}
```

## Testing & Verification (Phase 2)

### Test Case 1: Tier A GIS Routing
**Input**: Los Angeles, CA  
**Expected**: Dispatch to GIS Explorer, immediate tier, Esri URL output  
**Validation**: `dispatchToAgent()` returns `routingTier: "immediate"`, agent type is `gis-explorer`

### Test Case 2: Tier B API Routing
**Input**: Cook County, IL  
**Expected**: Dispatch to API Extractor, standard tier, Tyler Tech endpoint  
**Validation**: `dispatchToAgent()` returns `routingTier: "standard"`, agent type is `api-extractor`

### Test Case 3: Fallback FOIA Routing
**Input**: Harris County, TX (unmapped scenario)  
**Expected**: Dispatch to FOIA Generator, fallback tier, mailing address + template  
**Validation**: `dispatchToAgent()` returns `routingTier: "fallback"`, agent type is `foia-generator`

### Test Case 4: Unknown County Fallback
**Input**: Unknown County, New State  
**Expected**: Generic fallback, guidance message  
**Validation**: `dispatchToAgent()` succeeds, message explains limitation

## References

- **Scaffolding Blueprint**: Property Advocacy Orchestration Platform (multi-agent pattern)
- **Phase 1 State Tiers**: `src/config/state-tiers.ts` (state-level compliance)
- **Phase 1 Address Resolution**: `src/lib/parcel-resolution/` (county extraction)
- **Phase 1 Risk Disclosure**: `src/lib/risk-disclosure/` (confidence tiering)
