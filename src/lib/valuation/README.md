# Easement Valuation Module (Phase 2)

## Overview

This module implements the IRWA Easement Valuation Matrix and dual-method compensation calculators per Donnie Sherwood's appraisal methodology (SR/WA, MAI, FRICS). It is **Phase 2** infrastructure, not active in the Phase 1 MVP.

## Architecture

### Impact Tier Matrix

The `valuation-matrix.ts` file defines seven impact tiers, each mapping to a percentage-of-fee-value range:

| Tier | Range | Description |
|------|-------|-------------|
| severe | 90–100% | Severe surface impact, future-use conveyance (electric, flowage, major rail/canal) |
| major | 75–89% | Major surface impact, future-use conveyance (pipelines, drainage, flowage) |
| moderate_high | 51–74% | Some surface impact, ingress/egress rights (scenic, pipeline) |
| balanced | 50% | Balanced use (e.g., 50/50 sewer/water split) |
| moderate_low | 26–49% | Minor utility, location along setback/property line (cable, telecom, water) |
| minor | 11–25% | Nominal effect, minimal utility disruption |
| minimal | 0–10% | Subsurface easement, negligible surface impact |

When no custom percentage is provided, the calculator uses the **midpoint** of each tier's range.

### Dual Methods

#### 1. Summation Method
**Formula:** `Total = Value of Part Acquired + Damages to Remainder`

Used when:
- Easement damages/impacts are directly estimated or known
- Owner and holder have clear understanding of remainder diminution

**Inputs:**
- Easement area (acres, sq ft, etc.)
- Impact tier (or custom percentage of fee value)
- Remainder damages (separate assessment)

**Output:**
- Value of part acquired (easement area × unit value × impact %)
- Remainder damages (input directly)
- Total compensation (sum of above)

#### 2. Before-and-After (Federal) Method
**Formula:** `Total = Value of Whole Property - Value of Remainder After Acquisition`

Used when:
- Remainder property can be independently appraised post-acquisition
- Market reflects actual depreciation from easement burden

**Inputs:**
- Total property area and unencumbered value per unit
- Remainder value per unit (post-acquisition)
- Impact tier (for analytical back-calculation)

**Output:**
- Value of remainder after (total area × post-acquisition unit value)
- Total compensation (whole value − remainder value)
- Implied part acquired and damages (back-calculated for comparison)

## Phase 2 Integration Points

### Step 1 → Valuation
**Address Resolution → Parcel Lookup → Property Valuation Data**

The Phase 1 Step 1 module resolves addresses and performs parcel lookups. Phase 2 will extend this:
- Parcel lookup result includes estimated land value per unit (from county assessor, appraisal service, or Zillow API)
- Pass to valuation module as `unencumberedValuePerUnit`
- Use APN from Step 1 to fetch property metadata (total acreage, zoning)

**Files to enhance:**
- `src/lib/parcel-resolution/parcel-lookup-provider.ts` → add optional `estimatedValuePerUnit?: number` to `ParcelRecord`
- `src/lib/parcel-resolution/types.ts` → extend `ParcelRecord` interface

### Step 3 → Valuation
**Risk Disclosure → Economic Impact + Valuation**

The Phase 1 Step 3 module estimates economic impact (lost buildable area, value at risk). Phase 2 will integrate valuation:
- Risk disclosure identifies easement impact tier (from restriction checklist or user input)
- Pass impact tier, easement area, and property valuation data to valuation module
- Both Summation and Before-and-After methods run in parallel for comparison
- Display to user as "Market Compensation Range" alongside risk disclosure

**Files to create:**
- `src/lib/valuation/build-valuation-estimate.ts` → orchestrator combining risk + valuation
- Update `src/lib/risk-disclosure/economic-impact.ts` → optional `valuationEstimate?: ValuationResult[]`

### New Step 3.5 (Valuation Disclosure)
**Optional display between risk disclosure and Track 2 letter**

If valuation is available:
- Show both Summation and Before-and-After results
- Explain why estimates differ (data confidence, methodology assumptions)
- Link back to risk disclosure (impact tier informs valuation)
- Caveat: "Valuation is not appraisal; consult a licensed appraiser for formal compensation negotiations"

**Files to create:**
- `src/app/valuation/page.tsx` → demo harness for Phase 2

## Usage Example

```typescript
import { EasementValuationCalculator, IMPACT_TIERS } from '@/lib/valuation';

// Phase 2: Step 1 returns parcel with estimated value
const parcel = { /* ... */ estimatedValuePerUnit: 12000 }; // $12k/acre

// Phase 2: Risk disclosure identifies impact tier
const impactTier = 'moderate_low'; // From restriction checklist

// Create calculator
const calc = new EasementValuationCalculator(
  100, // total acres (from Step 1)
  'acres',
  parcel.estimatedValuePerUnit,
);

// Summation Method (if remainder damages known from Step 3)
const summation = calc.summationMethod(
  10, // easement area
  impactTier,
  75000, // estimated remainder damages
);
console.log(`Summation total: $${summation.totalCompensation}`);

// Before-and-After Method (if post-acquisition value appraised)
const beforeAfter = calc.beforeAndAfterMethod(
  10,
  10500, // remainder value post-easement (down from 12k)
  impactTier,
);
console.log(`Before-After total: $${beforeAfter.totalCompensation}`);
```

## Notes for Phase 2 Dev

1. **Custom Percentage Override:** Both methods accept `customPercentage` (0–100) to override the tier midpoint. This allows appraiser inputs or court-determined percentages.

2. **Rounding:** All monetary results are rounded to cents (`.00`). Area inputs maintain precision.

3. **State Compliance:** Currently US-only (imperial/metric units configurable per parcel). Phase 3 may add state-specific adjustment factors or alternative methodologies.

4. **Testability:** `EasementValuationCalculator` is purely functional, no external dependencies. Test suite includes edge cases (tier boundaries, zero damages, custom percentages).

5. **Not a Replacement for Licensed Appraisal:** Results are educational estimates. Disclaimer required on any UI surface: "This calculator provides illustrative valuation guidance based on IRWA methodology. It is not a substitute for a licensed appraisal or legal valuation for compensation negotiations."

## References

- Donnie Sherwood, SR/WA, MAI, FRICS. "Valuation of Easements." *IRWA Valuation Journal*, 2014.
  - https://eweb.irwaonline.org/eweb/upload/web_novdec_14_Valuation.pdf
- Uniform Standards of Professional Appraisal Practice (USPAP)
- California Department of Transportation (Caltrans) Appraisal Manual (partial adoption for state tier work)
