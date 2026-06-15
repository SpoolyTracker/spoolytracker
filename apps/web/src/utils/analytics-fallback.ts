import type {
  AnalyticsOverview,
  BreakdownSlice,
  SeriesPoint,
} from '../types/analytics';

type Granularity = 'day' | 'week' | 'month';

// Formes minimales (sous-ensemble de ConsumptionLog/Filament de ../api).
interface FallbackFilament {
  id: number;
  brand?: { name?: string } | null;
  material?: { name?: string } | null;
  color?: string | null;
  price?: number | null;
  weightInitial?: number | null;
  weightRemaining?: number | null;
}

interface FallbackLog {
  id: number;
  filamentId?: number;
  amount: number;
  date: string;
  is_planned?: boolean;
  filament?: FallbackFilament | null;
}

function bucketKey(d: Date, g: Granularity): string {
  const y = d.getFullYear();
  if (g === 'month') return `${y}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  if (g === 'week') {
    const tmp = new Date(Date.UTC(y, d.getMonth(), d.getDate()));
    const day = tmp.getUTCDay() || 7;
    tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
  }
  return d.toISOString().slice(0, 10);
}

function pricePerGram(f?: FallbackFilament | null): number {
  if (!f || !f.price || !f.weightInitial || f.weightInitial <= 0) return 0;
  return f.price / f.weightInitial;
}

function toSlices(map: Record<string, number>): BreakdownSlice[] {
  return Object.entries(map)
    .map(([key, value]) => ({ key, label: key, value: Number(value.toFixed(2)) }))
    .sort((a, b) => b.value - a.value);
}

export function computeLocalAnalytics(
  logs: FallbackLog[],
  filaments: FallbackFilament[],
  granularity: Granularity = 'day',
): AnalyticsOverview {
  const actual: Record<string, number> = {};
  const planned: Record<string, number> = {};
  const costActual: Record<string, number> = {};
  const costPlanned: Record<string, number> = {};
  const byMaterial: Record<string, number> = {};
  const byBrand: Record<string, number> = {};
  let totalCost = 0;

  for (const log of logs) {
    const key = bucketKey(new Date(log.date), granularity);
    const f = log.filament;
    const cost = log.amount * pricePerGram(f);
    if (log.is_planned) {
      planned[key] = (planned[key] || 0) + log.amount;
      costPlanned[key] = (costPlanned[key] || 0) + cost;
      continue;
    }
    actual[key] = (actual[key] || 0) + log.amount;
    costActual[key] = (costActual[key] || 0) + cost;
    totalCost += cost;
    const mat = f?.material?.name || 'Inconnu';
    const brand = f?.brand?.name || 'Inconnu';
    byMaterial[mat] = (byMaterial[mat] || 0) + log.amount;
    byBrand[brand] = (byBrand[brand] || 0) + log.amount;
  }

  const buckets = Array.from(new Set([...Object.keys(actual), ...Object.keys(planned)])).sort();
  const consoSeries: SeriesPoint[] = buckets.map((b) => ({
    bucket: b, value: Number((actual[b] || 0).toFixed(2)), planned: Number((planned[b] || 0).toFixed(2)),
  }));
  const costSeries: SeriesPoint[] = buckets.map((b) => ({
    bucket: b, value: Number((costActual[b] || 0).toFixed(2)), planned: Number((costPlanned[b] || 0).toFixed(2)),
  }));

  const totalValue = filaments.reduce((sum, f) => sum + (f.weightRemaining || 0) * pricePerGram(f), 0);

  const invMaterial: Record<string, number> = {};
  const invBrand: Record<string, number> = {};
  for (const f of filaments) {
    const remaining = f.weightRemaining || 0;
    if (remaining <= 0) continue;
    const mat = f.material?.name || 'Inconnu';
    const brand = f.brand?.name || 'Inconnu';
    invMaterial[mat] = (invMaterial[mat] || 0) + remaining;
    invBrand[brand] = (invBrand[brand] || 0) + remaining;
  }

  return {
    plan: 'free',
    source: 'local',
    granularity,
    generated_on: new Date().toISOString().slice(0, 10),
    consumption: {
      series: consoSeries,
      by_material: toSlices(byMaterial),
      by_brand: toSlices(byBrand),
      delta: { current: 0, previous: 0, pct: 0 },
    },
    cost: {
      series: costSeries,
      by_material: toSlices(byMaterial),
      total_cost: Number(totalCost.toFixed(2)),
      delta: { current: 0, previous: 0, pct: 0 },
      suggested_budget: null,
    },
    stock: {
      runway_days: null,
      total_value: Number(totalValue.toFixed(2)),
      available_value: Number(totalValue.toFixed(2)),
      by_material: toSlices(invMaterial),
      by_brand: toSlices(invBrand),
      dormant: [],
      depletion: [],
    },
  };
}
