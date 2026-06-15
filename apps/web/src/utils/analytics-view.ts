import type { AnalyticsOverview } from '../types/analytics';

export function formatGrams(g: number): string {
  if (Math.abs(g) >= 1000) return `${(g / 1000).toFixed(1)} kg`;
  return `${Math.round(g)} g`;
}

export function formatEuros(v: number): string {
  return `${v.toFixed(2)} €`;
}

export function formatPct(pct: number): string {
  const sign = pct > 0 ? '+' : '';
  return `${sign}${Math.round(pct)} %`;
}

export interface Kpi {
  key: string;
  title: string;
  value: string;
  subtitle?: string;
}

export function kpisFromOverview(o: AnalyticsOverview): Kpi[] {
  return [
    { key: 'value', title: 'Valeur du stock', value: formatEuros(o.stock.total_value), subtitle: `Dispo ${formatEuros(o.stock.available_value)}` },
    { key: 'cost', title: 'Coût (30 j)', value: formatEuros(o.cost.delta.current), subtitle: `${formatPct(o.cost.delta.pct)} vs préc.` },
    { key: 'runway', title: 'Autonomie', value: o.stock.runway_days != null ? `${o.stock.runway_days} j` : '—', subtitle: 'Stock dispo / conso 30 j' },
    { key: 'conso', title: 'Conso (30 j)', value: formatGrams(o.consumption.delta.current), subtitle: `${formatPct(o.consumption.delta.pct)} vs préc.` },
  ];
}

export function stripHex(label: string): string {
  return label
    .replace(/#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export type SourceColor = 'success' | 'warning' | 'default';

export function sourceLabel(source: string): { label: string; color: SourceColor } {
  if (source === 'engine') return { label: 'IA temps réel', color: 'success' };
  if (source === 'api') return { label: 'API réelle', color: 'success' };
  if (source === 'local') return { label: 'Hors-ligne', color: 'warning' };
  return { label: source, color: 'default' };
}
