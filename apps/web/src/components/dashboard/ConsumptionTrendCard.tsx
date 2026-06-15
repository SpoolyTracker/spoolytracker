import { Box, Card, CardContent, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConsumptionLog } from '../../api';
import DashboardChart from '../DashboardChart';
import { getFilamentTitle } from '../../utils/filament-utils';

const getWeekNumber = (d: Date) => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

const stringToColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const c = (hash & 0x00ffffff).toString(16).toUpperCase();
  return '#' + '00000'.substring(0, 6 - c.length) + c;
};

const adjustColor = (color: string, amount: number) => {
  if (!color) return stringToColor('gray');
  let hex = color.startsWith('#') ? color.replace('#', '') : color;
  if (hex.length === 3) hex = hex.split('').map((char) => char + char).join('');
  if (hex.length !== 6) return stringToColor(color);
  const num = parseInt(hex, 16);
  let r = (num >> 16);
  let g = ((num >> 8) & 0x00FF);
  let b = (num & 0x0000FF);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  if (lum < 40) { const boost = 40 - lum; r += boost; g += boost; b += boost; b += 10; }
  else if (lum > 200) { const darken = lum - 200; r -= darken; g -= darken; b -= darken; }
  r = Math.min(255, Math.max(0, r + amount));
  g = Math.min(255, Math.max(0, g + amount));
  b = Math.min(255, Math.max(0, b + amount));
  return `#${((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b)).toString(16).slice(1)}`;
};

interface ConsumptionTrendCardProps {
  history: ConsumptionLog[];
  restricted: boolean;
}

export default function ConsumptionTrendCard({ history, restricted }: ConsumptionTrendCardProps) {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<'weight' | 'cost'>('weight');
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month'>('day');
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');

  const { chartData, chartKeys, colorMap } = useMemo(() => {
    const aggregated: Record<string, Record<string, number>> = {};
    const keys = new Set<string>();
    const keyColorMap: Record<string, string> = {};
    const baseColorCounts: Record<string, number> = {};
    const now = new Date();
    let cutoff = new Date();
    if (timeRange === 'day') cutoff.setDate(now.getDate() - 90);
    if (timeRange === 'week') cutoff.setDate(now.getDate() - (52 * 7));
    if (timeRange === 'month') cutoff = new Date(0);
    const dateSortMap: Record<string, number> = {};

    history.forEach((log) => {
      const logDate = new Date(log.date);
      if (logDate < cutoff) return;
      let dateKey = '';
      if (timeRange === 'day') dateKey = logDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      else if (timeRange === 'week') dateKey = `W${getWeekNumber(logDate)}`;
      else dateKey = logDate.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

      if (!dateSortMap[dateKey] || logDate.getTime() < dateSortMap[dateKey]) {
        dateSortMap[dateKey] = logDate.getTime();
      }

      const filamentName = getFilamentTitle(log.filament);
      const plannedSuffix = ` (${t('consumption.isPlanned', 'Planifié')})`;
      const plannedKey = `${filamentName}${plannedSuffix}`;

      if (!keyColorMap[filamentName]) {
        const baseColor = (log.filament?.colors && log.filament.colors.length > 0)
          ? log.filament.colors[0]
          : (log.filament?.color?.startsWith('#') ? log.filament.color : null);
        if (baseColor) {
          const baseKey = baseColor.toUpperCase();
          if (!baseColorCounts[baseKey]) baseColorCounts[baseKey] = 0;
          const occurrence = baseColorCounts[baseKey];
          baseColorCounts[baseKey]++;
          const step = 25;
          const direction = occurrence % 2 === 0 ? 1 : -1;
          const magnitude = Math.ceil(occurrence / 2) * step;
          const variance = direction * magnitude;
          keyColorMap[filamentName] = adjustColor(baseColor, variance);
          keyColorMap[plannedKey] = adjustColor(baseColor, variance + 40);
        } else {
          keyColorMap[filamentName] = stringToColor(filamentName);
          keyColorMap[plannedKey] = stringToColor(plannedKey);
        }
      }

      if (!aggregated[dateKey]) aggregated[dateKey] = {};
      const targetKey = log.is_planned ? plannedKey : filamentName;
      if (!aggregated[dateKey][targetKey]) aggregated[dateKey][targetKey] = 0;

      let value = log.amount;
      if (viewMode === 'cost') {
        const price = log.filament?.price || 0;
        const weightInitial = log.filament?.weightInitial || 1000;
        value = log.amount * (price / weightInitial);
      }
      aggregated[dateKey][targetKey] += value;
      keys.add(targetKey);
    });

    const sortedKeys = Array.from(keys).sort((a, b) => {
      const baseA = a.replace(/ \(Planifié\)$/, '');
      const baseB = b.replace(/ \(Planifié\)$/, '');
      if (baseA === baseB) return a.includes('(') ? 1 : -1;
      return baseA.localeCompare(baseB);
    });

    const data = Object.entries(aggregated)
      .map(([date, values]) => ({ date, ...values }))
      .sort((a, b) => dateSortMap[a.date] - dateSortMap[b.date]);

    return { chartData: data, chartKeys: sortedKeys, colorMap: keyColorMap };
  }, [history, timeRange, viewMode, t]);

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="h3">{t('dashboard.consumptionTrend')}</Typography>
          {!restricted && (
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <ToggleButtonGroup value={chartType} exclusive onChange={(_, v) => v && setChartType(v)} size="small">
                <ToggleButton value="bar">Barres</ToggleButton>
                <ToggleButton value="line">Lignes</ToggleButton>
              </ToggleButtonGroup>
              <ToggleButtonGroup value={timeRange} exclusive onChange={(_, v) => v && setTimeRange(v)} size="small">
                <ToggleButton value="day">Jour</ToggleButton>
                <ToggleButton value="week">Sem</ToggleButton>
                <ToggleButton value="month">Mois</ToggleButton>
              </ToggleButtonGroup>
              <ToggleButtonGroup value={viewMode} exclusive onChange={(_, v) => v && setViewMode(v)} size="small">
                <ToggleButton value="weight">Poids</ToggleButton>
                <ToggleButton value="cost">Coût</ToggleButton>
              </ToggleButtonGroup>
            </Box>
          )}
        </Box>
        {restricted ? (
          <Box sx={{ height: 350, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(0,0,0,0.02)', borderRadius: 2 }}>
            <Typography variant="h5" gutterBottom>{t('dashboard.analyticsPro', 'Statistiques')}</Typography>
            <Typography color="textSecondary" align="center" sx={{ maxWidth: 400, mb: 2 }}>
              {t('dashboard.upgradeToProAnalytics', 'Passez au plan Pro pour visualiser les tendances de consommation, les coûts et les prévisions avancées.')}
            </Typography>
          </Box>
        ) : (
          <Box sx={{ height: 350, width: '100%', minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {chartData.length > 0 ? (
              <DashboardChart data={chartData} keys={chartKeys} viewMode={viewMode} colorMap={colorMap} chartType={chartType} />
            ) : (
              <Typography color="textSecondary">{t('dashboard.noConsumptionData', 'Aucune donnée de consommation disponible')}</Typography>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
