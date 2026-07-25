import { describe, expect, it } from 'vitest';
import { EasementValuationCalculator } from './calculator';

describe('EasementValuationCalculator', () => {
  const calculator = new EasementValuationCalculator(100, 'acres', 10000); // 100 acres at $10k/acre

  describe('constructor', () => {
    it('rejects non-positive total property area', () => {
      expect(() => new EasementValuationCalculator(0, 'acres', 10000)).toThrow(RangeError);
      expect(() => new EasementValuationCalculator(-10, 'acres', 10000)).toThrow(RangeError);
    });

    it('rejects non-positive unencumbered value', () => {
      expect(() => new EasementValuationCalculator(100, 'acres', 0)).toThrow(RangeError);
      expect(() => new EasementValuationCalculator(100, 'acres', -5000)).toThrow(RangeError);
    });

    it('calculates whole property value correctly', () => {
      expect(calculator.wholePropertyValue).toBe(1000000); // 100 * 10000
    });
  });

  describe('summationMethod', () => {
    it('rejects non-positive easement area', () => {
      expect(() => calculator.summationMethod(0, 'moderate_low')).toThrow(RangeError);
      expect(() => calculator.summationMethod(-5, 'moderate_low')).toThrow(RangeError);
    });

    it('rejects easement area exceeding total property', () => {
      expect(() => calculator.summationMethod(150, 'moderate_low')).toThrow(RangeError);
    });

    it('rejects negative remainder damages', () => {
      expect(() => calculator.summationMethod(10, 'moderate_low', -1000)).toThrow(RangeError);
    });

    it('calculates compensation for moderate_low impact with no damages', () => {
      const result = calculator.summationMethod(10, 'moderate_low', 0);
      expect(result.method).toBe('Summation Method');
      expect(result.easementArea).toBe(10);
      expect(result.rightsAcquiredPercent).toBe(37.5); // midpoint of 26-49
      expect(result.valuePartAcquired).toBeCloseTo(37500, 1); // 10 acres * 10k * 0.375
      expect(result.remainderDamages).toBe(0);
      expect(result.totalCompensation).toBeCloseTo(37500, 1);
    });

    it('adds remainder damages to part acquired value', () => {
      const result = calculator.summationMethod(10, 'moderate_low', 50000);
      expect(result.valuePartAcquired).toBeCloseTo(37500, 1);
      expect(result.remainderDamages).toBe(50000);
      expect(result.totalCompensation).toBeCloseTo(87500, 1);
    });

    it('respects custom percentage override', () => {
      const result = calculator.summationMethod(10, 'moderate_low', 0, 60);
      expect(result.rightsAcquiredPercent).toBe(60);
      expect(result.valuePartAcquired).toBeCloseTo(60000, 1); // 10 * 10k * 0.60
    });

    it('calculates severe impact (90-100% tier)', () => {
      const result = calculator.summationMethod(5, 'severe');
      expect(result.rightsAcquiredPercent).toBe(95); // midpoint
      expect(result.valuePartAcquired).toBeCloseTo(47500, 1); // 5 * 10k * 0.95
    });

    it('calculates minimal impact (0-10% tier)', () => {
      const result = calculator.summationMethod(20, 'minimal');
      expect(result.rightsAcquiredPercent).toBe(5); // midpoint
      expect(result.valuePartAcquired).toBeCloseTo(10000, 1); // 20 * 10k * 0.05
    });
  });

  describe('beforeAndAfterMethod', () => {
    it('rejects non-positive easement area', () => {
      expect(() => calculator.beforeAndAfterMethod(0, 8000, 'moderate_low')).toThrow(RangeError);
    });

    it('rejects negative remainder value per unit', () => {
      expect(() => calculator.beforeAndAfterMethod(10, -1000, 'moderate_low')).toThrow(RangeError);
    });

    it('calculates compensation when remainder value drops', () => {
      // Remainder value $8k/acre after easement vs. $10k before
      const result = calculator.beforeAndAfterMethod(10, 8000, 'moderate_low');
      expect(result.method).toBe('Before-and-After Method');
      expect(result.wholePropertyValue).toBe(1000000);
      expect(result.valueRemainderAfter).toBe(800000); // 100 * 8000
      expect(result.totalCompensation).toBe(200000); // 1000000 - 800000
      expect(result.impliedPartAcquired).toBeCloseTo(37500, 1);
      expect(result.impliedDamages).toBeCloseTo(162500, 1); // 200000 - 37500
    });

    it('handles zero remainder damages', () => {
      // No market depreciation from the easement
      const result = calculator.beforeAndAfterMethod(10, 10000, 'moderate_low');
      expect(result.totalCompensation).toBe(0);
      expect(result.impliedDamages).toBe(0);
    });

    it('respects custom percentage override', () => {
      const result = calculator.beforeAndAfterMethod(10, 8000, 'moderate_low', 50);
      expect(result.impliedPartAcquired).toBeCloseTo(50000, 1); // 10 * 10k * 0.50
      expect(result.impliedDamages).toBeCloseTo(150000, 1); // 200000 - 50000
    });
  });

  describe('invalid impact tier', () => {
    it('throws error for unknown tier in summationMethod', () => {
      expect(() => calculator.summationMethod(10, 'unknown_tier')).toThrow(Error);
    });

    it('throws error for unknown tier in beforeAndAfterMethod', () => {
      expect(() => calculator.beforeAndAfterMethod(10, 8000, 'unknown_tier')).toThrow(Error);
    });
  });

  describe('custom percentage bounds', () => {
    it('rejects custom percentage < 0', () => {
      expect(() => calculator.summationMethod(10, 'moderate_low', 0, -5)).toThrow(RangeError);
    });

    it('rejects custom percentage > 100', () => {
      expect(() => calculator.summationMethod(10, 'moderate_low', 0, 105)).toThrow(RangeError);
    });

    it('accepts custom percentage 0', () => {
      const result = calculator.summationMethod(10, 'moderate_low', 0, 0);
      expect(result.rightsAcquiredPercent).toBe(0);
      expect(result.valuePartAcquired).toBe(0);
    });

    it('accepts custom percentage 100', () => {
      const result = calculator.summationMethod(10, 'moderate_low', 0, 100);
      expect(result.rightsAcquiredPercent).toBe(100);
      expect(result.valuePartAcquired).toBeCloseTo(100000, 1);
    });
  });
});
