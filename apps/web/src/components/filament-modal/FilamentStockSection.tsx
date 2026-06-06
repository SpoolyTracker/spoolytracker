import {
    Box,
    Button,
    Checkbox,
    FormControl,
    FormControlLabel,
    FormHelperText,
    Grid,
    MenuItem,
    Select,
    TextField,
} from '@mui/material';
import { normalizeNumericInput } from '../../utils/number-utils';
import type { FilamentFormData, SetFilamentFormData, WeightMode } from './types';

interface Props {
    t: any;
    formData: FilamentFormData;
    setFormData: SetFilamentFormData;
    isEditing: boolean;
    weightMode: WeightMode;
    setWeightMode: (mode: WeightMode) => void;
}

export function FilamentStockSection({ t, formData, setFormData, isEditing, weightMode, setWeightMode }: Props) {
    return (
        <Grid container spacing={2}>
            {!isEditing && (
                <Grid size={{ xs: 12, md: 3 }}>
                    <TextField
                        fullWidth
                        label={t('inventory.quantity')}
                        type="text"
                        value={formData.quantity}
                        onChange={(e) => setFormData(p => ({ ...p, quantity: normalizeNumericInput(e.target.value) }))}
                        helperText={t('inventory.bulkAdd')}
                    />
                </Grid>
            )}
            <Grid size={{ xs: 12, md: isEditing ? 4 : 3 }}>
                <TextField
                    fullWidth
                    label={t('inventory.totalWeight')}
                    type="text"
                    value={formData.weightInitial}
                    onChange={(e) => setFormData(p => ({ ...p, weightInitial: normalizeNumericInput(e.target.value) }))}
                />
            </Grid>
            <Grid size={{ xs: 12, md: isEditing ? 4 : 3 }}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button variant={weightMode === 'remaining' ? 'contained' : 'outlined'} onClick={() => setWeightMode('remaining')} fullWidth>
                        {t('inventory.remaining')}
                    </Button>
                    <Button variant={weightMode === 'used' ? 'contained' : 'outlined'} onClick={() => setWeightMode('used')} fullWidth>
                        {t('inventory.used')}
                    </Button>
                </Box>
            </Grid>
            <Grid size={{ xs: 12, md: isEditing ? 4 : 3 }}>
                {weightMode === 'remaining' ? (
                    <TextField
                        fullWidth
                        label={t('inventory.remainingWeight')}
                        type="text"
                        value={formData.weightRemaining}
                        onChange={(e) => setFormData(p => ({ ...p, weightRemaining: normalizeNumericInput(e.target.value) }))}
                    />
                ) : (
                    <TextField
                        fullWidth
                        label={t('inventory.usedWeight')}
                        type="text"
                        value={formData.weightUsed}
                        onChange={(e) => setFormData(p => ({ ...p, weightUsed: normalizeNumericInput(e.target.value) }))}
                        helperText={`${t('inventory.calculatedRemaining')}: ${Number(formData.weightInitial) - Number(formData.weightUsed)}g`}
                    />
                )}
            </Grid>

            <Grid size={{ xs: 12, md: 8 }}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                    <TextField
                        fullWidth
                        label={t('inventory.lowStockThreshold')}
                        type="text"
                        value={formData.lowStockThreshold === null ? '' : formData.lowStockThreshold}
                        onChange={(e) => setFormData(prev => ({ ...prev, lowStockThreshold: e.target.value === '' ? null : normalizeNumericInput(e.target.value) }))}
                        placeholder="100"
                        helperText={t('inventory.lowStockThresholdDesc')}
                    />
                    <FormControl sx={{ minWidth: 88 }}>
                        <Select
                            value={formData.lowStockThresholdType}
                            onChange={(e) => setFormData(prev => ({ ...prev, lowStockThresholdType: e.target.value as 'GRAMS' | 'PERCENTAGE' }))}
                        >
                            <MenuItem value="GRAMS">g</MenuItem>
                            <MenuItem value="PERCENTAGE">%</MenuItem>
                        </Select>
                        <FormHelperText>&nbsp;</FormHelperText>
                    </FormControl>
                </Box>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
                <FormControlLabel
                    control={<Checkbox checked={formData.isRefill} onChange={(e) => setFormData(p => ({ ...p, isRefill: e.target.checked }))} />}
                    label={t('inventory.isRefill')}
                />
            </Grid>
        </Grid>
    );
}
