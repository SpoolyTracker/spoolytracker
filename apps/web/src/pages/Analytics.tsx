import {
  Box, Chip, LinearProgress, Tab, Tabs, ToggleButton,
  ToggleButtonGroup, Typography,
} from '@mui/material';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { aiEngine } from '../api';
import type { AnalyticsOverview } from '../types/analytics';
import { BreakdownDonut, DeltaBars, SeriesChart } from '../components/analytics/charts';
import { BudgetStat, DepletionList, DormantList, ProLock, RunwayStat } from '../components/analytics/panels';
import { sourceLabel } from '../utils/analytics-view';
import { WidgetEditBar, WidgetGrid, useWidgetLayout, type WidgetDef } from '../widgets';

type Granularity = 'day' | 'week' | 'month';

const CONSO_DEFS: WidgetDef[] = [
  { id: 'conso-trend', defaultSize: 12 },
  { id: 'conso-material', defaultSize: 6 },
  { id: 'conso-brand', defaultSize: 6 },
  { id: 'conso-delta', defaultSize: 6 },
];
const COST_DEFS: WidgetDef[] = [
  { id: 'cost-trend', defaultSize: 12 },
  { id: 'cost-material', defaultSize: 6 },
  { id: 'cost-budget', defaultSize: 6 },
];
const STOCK_DEFS: WidgetDef[] = [
  { id: 'stock-runway', defaultSize: 4 },
  { id: 'stock-inv-material', defaultSize: 6 },
  { id: 'stock-inv-brand', defaultSize: 6 },
  { id: 'stock-depletion', defaultSize: 6 },
  { id: 'stock-dormant', defaultSize: 6 },
];

const TITLES: Record<string, string> = {
  'conso-trend': 'Tendance de consommation',
  'conso-material': 'Consommation par matériau',
  'conso-brand': 'Consommation par marque',
  'conso-delta': 'Évolution sur 30 jours',
  'cost-trend': 'Dépense dans le temps',
  'cost-material': 'Coût par matériau',
  'cost-budget': 'Budget conseillé',
  'stock-runway': 'Autonomie',
  'stock-inv-material': 'Inventaire par matériau',
  'stock-inv-brand': 'Inventaire par marque',
  'stock-depletion': 'Rupture par bobine',
  'stock-dormant': 'Valeur dormante',
};

export default function AnalyticsPage() {
  const [granularity, setGranularity] = useState<Granularity>('day');
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const d = await aiEngine.analytics(granularity);
        if (mounted) setData(d);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [granularity]);

  const isPro = (data?.plan ?? localStorage.getItem('organization_plan')) === 'pro';

  const conso = useWidgetLayout('analytics-conso', CONSO_DEFS);
  const cost = useWidgetLayout('analytics-cost', COST_DEFS);
  const stock = useWidgetLayout('analytics-stock', STOCK_DEFS);
  const active = [conso, cost, stock][tab];

  const registry = useMemo<Record<string, ReactNode>>(() => {
    if (!data) return {};
    return {
      'conso-trend': <SeriesChart series={data.consumption.series} mode="weight" />,
      'conso-material': <BreakdownDonut slices={data.consumption.by_material} unit="weight" />,
      'conso-brand': <BreakdownDonut slices={data.consumption.by_brand} unit="weight" />,
      'conso-delta': <DeltaBars delta={data.consumption.delta} unit="weight" />,
      'cost-trend': <SeriesChart series={data.cost.series} mode="cost" />,
      'cost-material': <BreakdownDonut slices={data.cost.by_material} unit="cost" />,
      'cost-budget': <ProLock locked={!isPro}><BudgetStat value={data.cost.suggested_budget} /></ProLock>,
      'stock-runway': <RunwayStat days={data.stock.runway_days} />,
      'stock-inv-material': <BreakdownDonut slices={data.stock.by_material} unit="weight" />,
      'stock-inv-brand': <BreakdownDonut slices={data.stock.by_brand} unit="weight" />,
      'stock-depletion': <ProLock locked={!isPro}><DepletionList items={data.stock.depletion} /></ProLock>,
      'stock-dormant': <DormantList items={data.stock.dormant} />,
    };
  }, [data, isPro]);

  if (loading && !data) return <LinearProgress />;

  const src = data ? sourceLabel(data.source) : null;

  return (
    <Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="h2">Analytique</Typography>
          {src && <Chip size="small" color={src.color} label={src.label} />}
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <ToggleButtonGroup size="small" exclusive value={granularity} onChange={(_, v: Granularity | null) => v && setGranularity(v)}>
            <ToggleButton value="day">Jour</ToggleButton>
            <ToggleButton value="week">Sem</ToggleButton>
            <ToggleButton value="month">Mois</ToggleButton>
          </ToggleButtonGroup>
          <WidgetEditBar {...active} titleFor={(id) => TITLES[id]} />
        </Box>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Conso & tendances" />
        <Tab label="Coûts & budget" />
        <Tab label="Stock & prévisions" />
      </Tabs>

      <WidgetGrid
        items={active.items}
        isEditing={active.isEditing}
        onReorder={active.reorder}
        onToggleHide={active.toggleHidden}
        onSizeChange={active.setSize}
        titleFor={(id) => TITLES[id]}
        renderWidget={(id) => registry[id] ?? null}
      />
    </Box>
  );
}
