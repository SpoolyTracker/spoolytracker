import { Box, Button, Card, CardContent, Divider, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { History, PencilRuler, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ColorIndicator from '../ColorIndicator';
import { getFilamentTitle } from '../../utils/filament-utils';
import type { DashboardActivity } from './types';

export default function RecentActivityCard({ activities }: { activities: DashboardActivity[] }) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <Card sx={{ height: '100%', maxHeight: 600, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ pb: 1 }}>
        <Typography variant="h3">{t('dashboard.recentActivity')}</Typography>
      </CardContent>
      <Divider />
      <Box sx={{ flex: 1, overflowY: 'auto', p: 0 }}>
        {activities.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="textSecondary">{t('dashboard.noActivity')}</Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            {activities.map((activity, index) => {
              const filament = activity.filament;
              const title = getFilamentTitle(filament);
              const date = activity.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
              return (
                <Box key={activity.id}>
                  <Box sx={{ p: 2, display: 'flex', alignItems: 'flex-start', gap: 2, '&:hover': { bgcolor: 'rgba(0,0,0,0.02)' } }}>
                    <Box sx={{ mt: 0.5 }}>
                      <ColorIndicator colors={filament?.colors || []} primaryColor={filament?.color} size={32} />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }} noWrap>
                          <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            {activity.type === 'creation'
                              ? <Sparkles size={14} color={theme.palette.primary.main} />
                              : <PencilRuler size={14} color={theme.palette.warning.main} />}
                            {title}
                          </Box>
                        </Typography>
                        <Typography variant="caption" color="textSecondary" sx={{ ml: 1, flexShrink: 0 }}>{date}</Typography>
                      </Box>
                      <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
                        {filament?.brand?.name} • {filament?.material?.name}
                      </Typography>
                      {activity.type === 'consumption' && (
                        <Box sx={{ mt: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Typography variant="body2" sx={{ color: activity.isPlanned ? theme.palette.warning.main : theme.palette.error.main, fontWeight: 700 }}>
                            -{Math.round(activity.amount || 0)}g
                            {activity.isPlanned && <span style={{ fontSize: '0.8em', fontWeight: 400, marginLeft: 4 }}>({t('dashboard.planned')})</span>}
                          </Typography>
                          {activity.notes && (
                            <Typography variant="caption" color="textSecondary" noWrap sx={{ maxWidth: '60%', fontStyle: 'italic' }}>
                              "{activity.notes}"
                            </Typography>
                          )}
                        </Box>
                      )}
                      {activity.type === 'creation' && (
                        <Typography variant="body2" sx={{ color: theme.palette.primary.main, fontWeight: 700, mt: 0.5 }}>
                          +{(filament as { weightInitial?: number })?.weightInitial}g
                        </Typography>
                      )}
                    </Box>
                  </Box>
                  {index < activities.length - 1 && <Divider />}
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
      <Divider />
      <Box sx={{ p: 1, textAlign: 'center' }}>
        <Button size="small" startIcon={<History size={16} />} href="/consumption">{t('dashboard.viewAll')}</Button>
      </Box>
    </Card>
  );
}
