// Contrat partagé avec l'ai-engine (src/analytics/models.py). À garder synchronisé.

export interface SeriesPoint {
  bucket: string;
  value: number;
  planned: number;
}

export interface BreakdownSlice {
  key: string;
  label: string;
  value: number;
  color_hex?: string | null;
}

export interface PeriodDelta {
  current: number;
  previous: number;
  pct: number;
}

export interface ConsumptionAnalytics {
  series: SeriesPoint[];
  by_material: BreakdownSlice[];
  by_brand: BreakdownSlice[];
  delta: PeriodDelta;
}

export interface CostAnalytics {
  series: SeriesPoint[];
  by_material: BreakdownSlice[];
  total_cost: number;
  delta: PeriodDelta;
  suggested_budget?: number | null;
}

export interface DepletionItem {
  item_id: string;
  label: string;
  days_left?: number | null;
  estimated_date?: string | null;
  color_hex?: string | null;
  risk_level: string;
}

export interface DormantItem {
  item_id: string;
  label: string;
  remaining_g: number;
  value: number;
  last_used_on?: string | null;
  days_idle?: number | null;
  color_hex?: string | null;
}

export interface StockAnalytics {
  runway_days?: number | null;
  total_value: number;
  available_value: number;
  by_material: BreakdownSlice[];
  by_brand: BreakdownSlice[];
  dormant: DormantItem[];
  depletion: DepletionItem[];
}

export type AnalyticsSource = 'engine' | 'api' | 'local' | string;

export interface AnalyticsOverview {
  plan: string;
  source: AnalyticsSource;
  granularity: 'day' | 'week' | 'month' | string;
  generated_on: string;
  consumption: ConsumptionAnalytics;
  cost: CostAnalytics;
  stock: StockAnalytics;
}
