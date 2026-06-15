import { describe, expect, it } from 'vitest';
import { formatEuros, formatGrams, formatPct, kpisFromOverview, sourceLabel, stripHex } from './analytics-view';
import type { AnalyticsOverview } from '../types/analytics';

const overview: AnalyticsOverview = {
  plan: 'pro', source: 'engine', granularity: 'day', generated_on: '2026-03-22',
  consumption: { series: [], by_material: [], by_brand: [], delta: { current: 1500, previous: 1000, pct: 50 } },
  cost: { series: [], by_material: [], total_cost: 42, delta: { current: 30, previous: 20, pct: 50 }, suggested_budget: 30 },
  stock: { runway_days: 120, total_value: 35, available_value: 27, by_material: [], by_brand: [], dormant: [], depletion: [] },
};

describe('formatters', () => {
  it('formats grams with kg threshold', () => {
    expect(formatGrams(450)).toBe('450 g');
    expect(formatGrams(1500)).toBe('1.5 kg');
  });
  it('formats euros', () => { expect(formatEuros(42)).toBe('42.00 €'); });
  it('formats signed pct', () => {
    expect(formatPct(50)).toBe('+50 %');
    expect(formatPct(-12)).toBe('-12 %');
    expect(formatPct(0)).toBe('0 %');
  });
});

describe('kpisFromOverview', () => {
  it('derives 4 KPIs', () => {
    const kpis = kpisFromOverview(overview);
    expect(kpis.map((k) => k.key)).toEqual(['value', 'cost', 'runway', 'conso']);
    expect(kpis[0].value).toBe('35.00 €');
    expect(kpis[2].value).toBe('120 j');
    expect(kpis[3].value).toBe('1.5 kg');
  });
  it('shows dash when runway is null', () => {
    const k = kpisFromOverview({ ...overview, stock: { ...overview.stock, runway_days: null } });
    expect(k[2].value).toBe('—');
  });
});

describe('stripHex', () => {
  it('removes hex color codes from a label', () => {
    expect(stripHex('PLA noir #111111')).toBe('PLA noir');
    expect(stripHex('PETG #ef4444 rouge')).toBe('PETG rouge');
    expect(stripHex('PLA sans code')).toBe('PLA sans code');
  });
});

describe('sourceLabel', () => {
  it('maps sources to label + color', () => {
    expect(sourceLabel('engine').color).toBe('success');
    expect(sourceLabel('local').color).toBe('warning');
    expect(sourceLabel('api').label).toBe('API réelle');
  });
});
