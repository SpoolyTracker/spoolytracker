import { useEffect, useState } from 'react';
import { Alert, Box, Dialog, DialogContent, DialogTitle, IconButton, Stack, Typography } from '@mui/material';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api, type Filament } from '../api';
import { getFilamentTitle } from '../utils/filament-utils';
import { CalibrationCalculators, type CalibrationPatch } from './filament-modal/CalibrationCalculators';

interface Props {
  open: boolean;
  filament: Filament | null;
  onClose: () => void;
}

export default function CalibrationCalculatorsModal({ open, filament, onClose }: Props) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(filament);

  useEffect(() => {
    setWorking(filament);
  }, [filament]);

  if (!working) return null;

  const handleApply = async (patch: CalibrationPatch) => {
    setError(null);
    try {
      await api.update(working.id, patch as any);
      setWorking(w => w ? ({ ...w, ...patch } as Filament) : w);
      window.dispatchEvent(new Event('inventory-updated'));
    } catch {
      setError(t('common.error', 'Une erreur est survenue'));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography component="div" sx={{ fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.2 }}>
            {t('inventory.filamentModal.calibrationCalculators', 'Calculateurs de calibration')}
          </Typography>
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.25 }}>
            {working.color && (
              <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: working.color, border: '1px solid', borderColor: 'divider', flexShrink: 0 }} />
            )}
            <Typography variant="caption" color="text.secondary" noWrap>
              {getFilamentTitle(working)}
            </Typography>
          </Stack>
        </Box>
        <IconButton size="small" onClick={onClose}><X size={20} /></IconButton>
      </DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <CalibrationCalculators
          t={t}
          currentFlowRatio={String(working.flowRatio ?? '')}
          currentPrintSpeedMax={typeof working.printSpeedMax === 'number' ? working.printSpeedMax : null}
          currentRules={working.conditionalTemperatureRules ?? []}
          onApply={handleApply}
        />
      </DialogContent>
    </Dialog>
  );
}
