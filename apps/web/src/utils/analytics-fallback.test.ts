import { describe, expect, it } from 'vitest';
import { computeLocalAnalytics } from './analytics-fallback';

const filaments = [
  { id: 1, brand: { name: 'Sunlu' }, material: { name: 'PLA' }, color: '#111',
    price: 20, weightInitial: 1000, weightRemaining: 400 },
  { id: 2, brand: { name: 'Bambu' }, material: { name: 'PETG' }, color: '#ef4444',
    price: 30, weightInitial: 1000, weightRemaining: 900 },
];

const logs = [
  { id: 1, filamentId: 1, amount: 100, date: '2026-03-18', is_planned: false, filament: filaments[0] },
  { id: 2, filamentId: 1, amount: 50, date: '2026-03-20', is_planned: false, filament: filaments[0] },
  { id: 3, filamentId: 2, amount: 40, date: '2026-03-20', is_planned: false, filament: filaments[1] },
  { id: 4, filamentId: 1, amount: 30, date: '2026-03-21', is_planned: true, filament: filaments[0] },
];

describe('computeLocalAnalytics', () => {
  it('marks the source as local', () => {
    const result = computeLocalAnalytics(logs as any, filaments as any, 'day');
    expect(result.source).toBe('local');
  });

  it('separates actual and planned consumption per bucket', () => {
    const result = computeLocalAnalytics(logs as any, filaments as any, 'day');
    const byBucket = Object.fromEntries(result.consumption.series.map((p) => [p.bucket, p]));
    expect(byBucket['2026-03-18'].value).toBe(100);
    expect(byBucket['2026-03-20'].value).toBe(90);
    expect(byBucket['2026-03-21'].planned).toBe(30);
  });

  it('computes cost from price per gram', () => {
    const result = computeLocalAnalytics(logs as any, filaments as any, 'day');
    expect(Number(result.cost.total_cost.toFixed(2))).toBe(4.2);
  });

  it('hides Pro-only fields in the local fallback', () => {
    const result = computeLocalAnalytics(logs as any, filaments as any, 'day');
    expect(result.stock.depletion).toEqual([]);
    expect(result.cost.suggested_budget ?? null).toBeNull();
  });
});
