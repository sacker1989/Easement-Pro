import { resolveImpactPercentage } from './valuation-matrix';
import type { JurisdictionalValuationContext } from './jurisdiction-valuation-bridge';

/**
 * Summation Method result: Value of Part Acquired + Damages to Remainder.
 * Used when easement damages are directly estimated or known.
 */
export interface SummationResult {
  readonly method: 'Summation Method';
  readonly wholePropertyValue: number;
  readonly easementArea: number;
  readonly easementAreaUnit: string;
  readonly rightsAcquiredPercent: number;
  readonly valuePartAcquired: number;
  readonly remainderDamages: number;
  readonly totalCompensation: number;
  readonly jurisdiction?: JurisdictionalValuationContext; // Phase 2: county-tier confidence
}

/**
 * Before-and-After (Federal) Method result.
 * Used when remainder value can be independently appraised post-acquisition.
 */
export interface BeforeAndAfterResult {
  readonly method: 'Before-and-After Method';
  readonly wholePropertyValue: number;
  readonly valueRemainderAfter: number;
  readonly impliedPartAcquired: number;
  readonly impliedDamages: number;
  readonly totalCompensation: number;
  readonly jurisdiction?: JurisdictionalValuationContext; // Phase 2: county-tier confidence
}

export type ValuationResult = SummationResult | BeforeAndAfterResult;

/**
 * IRWA Easement Valuation Calculator
 * Implements Summation Method and Before-and-After Method per Donnie Sherwood's methodology.
 * Phase 2: integrates with step 1 (address lookup) and step 3 (risk disclosure).
 */
export class EasementValuationCalculator {
  private readonly totalPropertyArea: number;
  private readonly totalPropertyAreaUnit: string;
  private readonly unencumberedValuePerUnit: number;

  constructor(
    totalPropertyArea: number,
    areaUnit: string,
    unencumberedValuePerUnit: number,
  ) {
    if (totalPropertyArea <= 0) {
      throw new RangeError('Total property area must be positive');
    }
    if (unencumberedValuePerUnit <= 0) {
      throw new RangeError('Unencumbered value per unit must be positive');
    }

    this.totalPropertyArea = totalPropertyArea;
    this.totalPropertyAreaUnit = areaUnit;
    this.unencumberedValuePerUnit = unencumberedValuePerUnit;
  }

  get wholePropertyValue(): number {
    return this.totalPropertyArea * this.unencumberedValuePerUnit;
  }

  /**
   * Summation Method: Total = Value of Part Acquired + Damages to Remainder
   * Phase 2: Optionally accepts jurisdictional context for confidence tiering.
   */
  summationMethod(
    easementArea: number,
    impactTier: string,
    remainderDamages: number = 0,
    customPercentage?: number,
    jurisdiction?: JurisdictionalValuationContext,
  ): SummationResult {
    if (easementArea <= 0 || easementArea > this.totalPropertyArea) {
      throw new RangeError(
        `Easement area must be positive and not exceed total property area (${this.totalPropertyArea} ${this.totalPropertyAreaUnit})`,
      );
    }
    if (remainderDamages < 0) {
      throw new RangeError('Remainder damages cannot be negative');
    }

    const rightsAcquiredPct = resolveImpactPercentage(impactTier, customPercentage);
    const valuePartAcquired = easementArea * this.unencumberedValuePerUnit * (rightsAcquiredPct / 100);
    const totalCompensation = valuePartAcquired + remainderDamages;

    return {
      method: 'Summation Method',
      wholePropertyValue: Math.round(this.wholePropertyValue * 100) / 100,
      easementArea,
      easementAreaUnit: this.totalPropertyAreaUnit,
      rightsAcquiredPercent: Math.round(rightsAcquiredPct * 10) / 10,
      valuePartAcquired: Math.round(valuePartAcquired * 100) / 100,
      remainderDamages: Math.round(remainderDamages * 100) / 100,
      totalCompensation: Math.round(totalCompensation * 100) / 100,
      jurisdiction,
    };
  }

  /**
   * Before-and-After Method: Total = Value of Whole - Value of Remainder After Acquisition
   * Remainder value reflects market depreciation due to easement burden.
   * Phase 2: Optionally accepts jurisdictional context for confidence tiering.
   */
  beforeAndAfterMethod(
    easementArea: number,
    remainderValuePerUnit: number,
    impactTier: string,
    customPercentage?: number,
    jurisdiction?: JurisdictionalValuationContext,
  ): BeforeAndAfterResult {
    if (easementArea <= 0 || easementArea > this.totalPropertyArea) {
      throw new RangeError(
        `Easement area must be positive and not exceed total property area (${this.totalPropertyArea} ${this.totalPropertyAreaUnit})`,
      );
    }
    if (remainderValuePerUnit < 0) {
      throw new RangeError('Remainder value per unit cannot be negative');
    }

    const valueRemainderAfter = this.totalPropertyArea * remainderValuePerUnit;
    const totalCompensation = this.wholePropertyValue - valueRemainderAfter;

    const rightsAcquiredPct = resolveImpactPercentage(impactTier, customPercentage);
    const impliedPartAcquired =
      easementArea * this.unencumberedValuePerUnit * (rightsAcquiredPct / 100);
    const impliedDamages = Math.max(0, totalCompensation - impliedPartAcquired);

    return {
      method: 'Before-and-After Method',
      wholePropertyValue: Math.round(this.wholePropertyValue * 100) / 100,
      valueRemainderAfter: Math.round(valueRemainderAfter * 100) / 100,
      impliedPartAcquired: Math.round(impliedPartAcquired * 100) / 100,
      impliedDamages: Math.round(impliedDamages * 100) / 100,
      totalCompensation: Math.round(totalCompensation * 100) / 100,
      jurisdiction,
    };
  }
}
