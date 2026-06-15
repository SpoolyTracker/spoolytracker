import { Box, Typography } from '@mui/material';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import DashboardChart from '../DashboardChart';
import { formatEuros, formatGrams, formatPct } from '../../utils/analytics-view';
import type { BreakdownSlice, PeriodDelta, SeriesPoint } from '../../types/analytics';

const REAL = 'Réel';
const PLANNED = 'Planifié';
const PALETTE = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

export function SeriesChart({ series, mode }: { series: SeriesPoint[]; mode: 'weight' | 'cost' }) {
  if (!series.length) return <EmptyChart />;
  const data = series.map((p) => ({ date: p.bucket, [REAL]: p.value, [PLANNED]: p.planned }));
  const colorMap = { [REAL]: '#6366f1', [PLANNED]: '#a5b4fc' };
  return (
    <Box sx={{ height: 300 }}>
      <DashboardChart data={data} keys={[REAL, PLANNED]} viewMode={mode} colorMap={colorMap} chartType="bar" showLegend />
    </Box>
  );
}

export function BreakdownDonut({ slices, unit }: { slices: BreakdownSlice[]; unit: 'weight' | 'cost' }) {
  if (!slices.length) return <EmptyChart />;
  const fmt = unit === 'cost' ? formatEuros : formatGrams;
  return (
    <Box sx={{ height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={slices as unknown as Record<string, unknown>[]} dataKey="value" nameKey="label" innerRadius={55} outerRadius={90} paddingAngle={2}>
            {slices.map((s, i) => (
              <Cell key={s.key} fill={s.color_hex || PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v: number, n: string) => [fmt(v), n]} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </Box>
  );
}

export function DeltaBars({ delta, unit }: { delta: PeriodDelta; unit: 'weight' | 'cost' }) {
  const fmt = unit === 'cost' ? formatEuros : formatGrams;
  const up = delta.pct >= 0;
  const data = [
    { date: '30 j précédents', Période: delta.previous },
    { date: '30 derniers jours', Période: delta.current },
  ];
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
        <Typography variant="h3" sx={{ color: up ? 'success.main' : 'error.main' }}>
          {delta.previous > 0 ? formatPct(delta.pct) : '—'}
        </Typography>
        <Typography variant="body2" color="text.secondary">vs période précédente</Typography>
      </Box>
      <Typography variant="caption" color="text.secondary">
        {fmt(delta.current)} ces 30 derniers jours · {fmt(delta.previous)} sur les 30 jours d'avant
      </Typography>
      <Box sx={{ height: 160, mt: 1 }}>
        <DashboardChart data={data} keys={['Période']} viewMode={unit} colorMap={{ 'Période': '#6366f1' }} chartType="bar" />
      </Box>
    </Box>
  );
}

function EmptyChart() {
  return (
    <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Typography color="text.secondary" variant="body2">Pas encore de données</Typography>
    </Box>
  );
}
