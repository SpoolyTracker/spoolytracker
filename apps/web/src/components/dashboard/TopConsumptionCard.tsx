import { Box, Card, CardContent, Divider, Tooltip, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { CalendarClock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ColorIndicator from '../ColorIndicator';
import type { TopConsumptionGroup } from './types';

export default function TopConsumptionCard({ groups }: { groups: TopConsumptionGroup[] }) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h3" gutterBottom>{t('dashboard.topConsumption')}</Typography>
        <Divider sx={{ mb: 2 }} />
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {groups.map((group) => (
            <Box key={group.id} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <ColorIndicator colors={group.colors} primaryColor={group.color} size={32} />
              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="subtitle2" noWrap>{group.displayName}</Typography>
                  {group.plannedAmount > 0 && (
                    <Tooltip title={`${group.plannedAmount.toFixed(0)}g planifiés`}>
                      <CalendarClock size={14} color={theme.palette.warning.main} />
                    </Tooltip>
                  )}
                </Box>
                <Typography variant="caption" color="textSecondary">{group.brand}</Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="body2" fontWeight="bold" color="text.primary">
                  {t('dashboard.stock', 'Stock')}: {group.stock.toFixed(2)}g
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  {group.plannedAmount > 0 ? (
                    <>{t('dashboard.conso', 'Conso')}: {Math.round(group.amount)}g | {t('dashboard.plannedShort', 'Planifié')}: {Math.round(group.plannedAmount)}g</>
                  ) : (
                    <>{t('dashboard.conso', 'Conso')}: {Math.round(group.amount)}g</>
                  )}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  {t('dashboard.cost', 'Coût')}: {group.cost.toFixed(2)}€
                  {group.plannedCost > 0 && (
                    <span style={{ color: '#6366f1', marginLeft: 8 }}>
                      ({t('dashboard.plannedShort', 'P')} : {group.plannedCost.toFixed(2)}€)
                    </span>
                  )}
                </Typography>
              </Box>
            </Box>
          ))}
          {groups.length === 0 && (
            <Typography variant="body2" color="textSecondary">{t('common.none', 'Aucune donnée disponible.')}</Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
