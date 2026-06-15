import { Box, Card, CardContent, Grid, Tooltip, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { CalendarClock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import StockGauge from '../StockGauge';
import type { GroupedFilament } from './types';

export default function StockOverviewCard({ groups }: { groups: GroupedFilament[] }) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h3" sx={{ mb: 2 }}>{t('dashboard.stockOverview')}</Typography>
        <Grid container spacing={2}>
          {groups.map((group) => (
            <Grid size={{ xs: 6, sm: 4, md: 3 }} key={group.id}>
              <Card sx={{ height: '100%' }} variant="outlined">
                <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 2 }}>
                  <Box sx={{ mb: 2 }}>
                    <StockGauge
                      value={(group.weightRemaining / group.weightInitial) * 100}
                      plannedValue={(group.plannedWeight / group.weightInitial) * 100}
                      label={`${Math.round((group.weightRemaining / group.weightInitial) * 100)}%`}
                      color={group.color}
                      colors={group.colors}
                      physicalWeight={group.weightRemaining}
                      plannedWeightRaw={group.plannedWeight}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="h4" gutterBottom>{group.weightRemaining.toFixed(0)}g</Typography>
                    {group.plannedWeight > 0 && (
                      <Tooltip title={`${group.plannedWeight.toFixed(0)}g planifiés`}>
                        <CalendarClock size={20} color={theme.palette.warning.main} />
                      </Tooltip>
                    )}
                  </Box>
                  <Typography variant="subtitle2" noWrap title={group.displayName} sx={{ maxWidth: '100%', textAlign: 'center' }}>
                    {group.displayName}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
          {groups.length === 0 && (
            <Grid size={{ xs: 12 }}>
              <Typography variant="body2" color="textSecondary">{t('common.none', 'Aucune donnée disponible.')}</Typography>
            </Grid>
          )}
        </Grid>
      </CardContent>
    </Card>
  );
}
