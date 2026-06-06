import type { ReactNode } from 'react';
import { Box, Button, Grid, IconButton, InputAdornment, TextField, Typography } from '@mui/material';
import { Box as BoxIcon, Clock, Flame, Gauge, Plus, Square, Thermometer, Trash2, Wind } from 'lucide-react';
import { normalizeNumericInput } from '../../utils/number-utils';
import type { FilamentFormData, SetFilamentFormData } from './types';

interface Props {
    t: any;
    formData: FilamentFormData;
    setFormData: SetFilamentFormData;
}

interface SpecGroupProps {
    icon: ReactNode;
    title: string;
    subtitle: string;
    children: ReactNode;
}

interface SpecFieldProps {
    label: string;
    value: string | number;
    unit?: ReactNode;
    onChange: (value: string) => void;
}

function SpecGroup({ icon, title, subtitle, children }: SpecGroupProps) {
    return (
        <Box
            sx={{
                p: 1.5,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                bgcolor: 'background.paper',
                height: '100%',
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.5 }}>
                <Box
                    sx={{
                        width: 34,
                        height: 34,
                        borderRadius: 1.5,
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor: 'primary.light',
                        color: 'primary.main',
                        flex: '0 0 auto',
                    }}
                >
                    {icon}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                        {subtitle}
                    </Typography>
                </Box>
            </Box>
            {children}
        </Box>
    );
}

function SpecField({ label, value, unit, onChange }: SpecFieldProps) {
    return (
        <TextField
            fullWidth
            size="small"
            label={label}
            type="text"
            value={value}
            onChange={(e) => onChange(normalizeNumericInput(e.target.value))}
            InputProps={unit ? {
                endAdornment: <InputAdornment position="end">{unit}</InputAdornment>,
            } : undefined}
        />
    );
}

const parseOptionalNumber = (value: string) => {
    if (value === '') return null;
    const normalized = value.trim().replace(',', '.');
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
};

const CELSIUS_UNIT = '\u00B0C';

export function FilamentTechnicalSection({ t, formData, setFormData }: Props) {
    const updateRule = (index: number, field: string, value: string) => {
        const parsed = parseOptionalNumber(value);
        setFormData(prev => ({
            ...prev,
            conditionalTemperatureRules: prev.conditionalTemperatureRules.map((rule, i) => i === index
                ? { ...rule, [field]: parsed }
                : rule),
        }));
    };

    return (
        <Grid container spacing={2}>
            <Grid size={{ xs: 12, lg: 6 }}>
                <SpecGroup
                    icon={<Flame size={18} />}
                    title={t('inventory.nozzle')}
                    subtitle={t('inventory.filamentModal.nozzleSubtitle')}
                >
                    <Grid container spacing={1.5}>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <SpecField
                                label={t('common.min', 'Min')}
                                unit={CELSIUS_UNIT}
                                value={formData.nozzleTempMin}
                                onChange={(value) => setFormData(p => ({ ...p, nozzleTempMin: value }))}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <SpecField
                                label={t('common.max', 'Max')}
                                unit={CELSIUS_UNIT}
                                value={formData.nozzleTempMax}
                                onChange={(value) => setFormData(p => ({ ...p, nozzleTempMax: value }))}
                            />
                        </Grid>
                    </Grid>
                </SpecGroup>
            </Grid>

            <Grid size={{ xs: 12, lg: 6 }}>
                <SpecGroup
                    icon={<Square size={18} />}
                    title={t('inventory.bed')}
                    subtitle={t('inventory.filamentModal.bedSubtitle')}
                >
                    <Grid container spacing={1.5}>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <SpecField
                                label={t('common.min', 'Min')}
                                unit={CELSIUS_UNIT}
                                value={formData.bedTempMin}
                                onChange={(value) => setFormData(p => ({ ...p, bedTempMin: value }))}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <SpecField
                                label={t('common.max', 'Max')}
                                unit={CELSIUS_UNIT}
                                value={formData.bedTempMax}
                                onChange={(value) => setFormData(p => ({ ...p, bedTempMax: value }))}
                            />
                        </Grid>
                    </Grid>
                </SpecGroup>
            </Grid>

            <Grid size={{ xs: 12 }}>
                <SpecGroup
                    icon={<Thermometer size={18} />}
                    title={t('inventory.filamentModal.nozzleTemperatureBySpeed')}
                    subtitle={t('inventory.filamentModal.nozzleTemperatureBySpeedSubtitle')}
                >
                    <Grid container spacing={1.5}>
                        {formData.conditionalTemperatureRules.map((rule, index) => (
                            <Grid size={{ xs: 12 }} key={index}>
                                <Grid container spacing={1} alignItems="center">
                                    <Grid size={{ xs: 6, sm: 2 }}>
                                        <SpecField
                                            label={t('inventory.filamentModal.speedMin')}
                                            unit="mm/s"
                                            value={rule.speedMinMmS ?? ''}
                                            onChange={(value) => updateRule(index, 'speedMinMmS', value)}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 6, sm: 2 }}>
                                        <SpecField
                                            label={t('inventory.filamentModal.speedMax')}
                                            unit="mm/s"
                                            value={rule.speedMaxMmS ?? ''}
                                            onChange={(value) => updateRule(index, 'speedMaxMmS', value)}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 6, sm: 2 }}>
                                        <SpecField
                                            label={t('inventory.filamentModal.temperatureMin')}
                                            unit={CELSIUS_UNIT}
                                            value={rule.nozzleTempMin ?? ''}
                                            onChange={(value) => updateRule(index, 'nozzleTempMin', value)}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 6, sm: 2 }}>
                                        <SpecField
                                            label={t('inventory.filamentModal.temperatureMax')}
                                            unit={CELSIUS_UNIT}
                                            value={rule.nozzleTempMax ?? ''}
                                            onChange={(value) => updateRule(index, 'nozzleTempMax', value)}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 10, sm: 3 }}>
                                        <TextField
                                            fullWidth
                                            size="small"
                                            label={t('common.notes')}
                                            value={rule.notes ?? ''}
                                            onChange={(e) => setFormData(prev => ({
                                                ...prev,
                                                conditionalTemperatureRules: prev.conditionalTemperatureRules.map((item, i) => i === index
                                                    ? { ...item, notes: e.target.value }
                                                    : item),
                                            }))}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 2, sm: 1 }}>
                                        <IconButton
                                            aria-label={t('inventory.filamentModal.removeTemperatureRule')}
                                            onClick={() => setFormData(prev => ({
                                                ...prev,
                                                conditionalTemperatureRules: prev.conditionalTemperatureRules.filter((_, i) => i !== index),
                                            }))}
                                        >
                                            <Trash2 size={18} />
                                        </IconButton>
                                    </Grid>
                                </Grid>
                            </Grid>
                        ))}
                        <Grid size={{ xs: 12 }}>
                            <Button
                                size="small"
                                startIcon={<Plus size={16} />}
                                onClick={() => setFormData(prev => ({
                                    ...prev,
                                    conditionalTemperatureRules: [
                                        ...prev.conditionalTemperatureRules,
                                        { speedMinMmS: null, speedMaxMmS: null, nozzleTempMin: null, nozzleTempMax: null, notes: '' },
                                    ],
                                }))}
                            >
                                {t('inventory.filamentModal.addTemperatureRule')}
                            </Button>
                        </Grid>
                    </Grid>
                </SpecGroup>
            </Grid>

            <Grid size={{ xs: 12, lg: 6 }}>
                <SpecGroup
                    icon={<BoxIcon size={18} />}
                    title={t('inventory.filamentModal.chamber')}
                    subtitle={t('inventory.filamentModal.chamberSubtitle')}
                >
                    <Grid container spacing={1.5}>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <SpecField
                                label={t('common.min', 'Min')}
                                unit={CELSIUS_UNIT}
                                value={formData.chamberTempMin}
                                onChange={(value) => setFormData(p => ({ ...p, chamberTempMin: value }))}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <SpecField
                                label={t('common.max', 'Max')}
                                unit={CELSIUS_UNIT}
                                value={formData.chamberTempMax}
                                onChange={(value) => setFormData(p => ({ ...p, chamberTempMax: value }))}
                            />
                        </Grid>
                    </Grid>
                </SpecGroup>
            </Grid>

            <Grid size={{ xs: 12, lg: 6 }}>
                <SpecGroup
                    icon={<Clock size={18} />}
                    title={t('inventory.filamentModal.drying')}
                    subtitle={t('inventory.filamentModal.dryingSubtitle')}
                >
                    <Grid container spacing={1.5}>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <SpecField
                                label={t('inventory.filamentModal.dryingTemperature')}
                                unit={CELSIUS_UNIT}
                                value={formData.dryTemp}
                                onChange={(value) => setFormData(p => ({ ...p, dryTemp: value }))}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <SpecField
                                label={t('inventory.filamentModal.dryingTime')}
                                unit="h"
                                value={formData.dryTime}
                                onChange={(value) => setFormData(p => ({ ...p, dryTime: value }))}
                            />
                        </Grid>
                    </Grid>
                </SpecGroup>
            </Grid>

            <Grid size={{ xs: 12, lg: 6 }}>
                <SpecGroup
                    icon={<Gauge size={18} />}
                    title={t('inventory.filamentModal.flowTitle')}
                    subtitle={t('inventory.filamentModal.flowSubtitle')}
                >
                    <Grid container spacing={1.5}>
                        <Grid size={{ xs: 12, sm: 4 }}>
                            <SpecField
                                label={t('inventory.filamentModal.speedMin')}
                                unit="mm/s"
                                value={formData.printSpeedMin}
                                onChange={(value) => setFormData(p => ({ ...p, printSpeedMin: value }))}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 4 }}>
                            <SpecField
                                label={t('inventory.filamentModal.speedMax')}
                                unit="mm/s"
                                value={formData.printSpeedMax}
                                onChange={(value) => setFormData(p => ({ ...p, printSpeedMax: value }))}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 4 }}>
                            <SpecField
                                label="K-factor"
                                value={formData.kFactor}
                                onChange={(value) => setFormData(p => ({ ...p, kFactor: value }))}
                            />
                        </Grid>
                    </Grid>
                </SpecGroup>
            </Grid>

            <Grid size={{ xs: 12, lg: 6 }}>
                <SpecGroup
                    icon={<Wind size={18} />}
                    title={t('inventory.filamentModal.retraction')}
                    subtitle={t('inventory.filamentModal.retractionSubtitle')}
                >
                    <Grid container spacing={1.5}>
                        <Grid size={{ xs: 12, sm: 4 }}>
                            <SpecField
                                label={t('inventory.filamentModal.distance')}
                                unit="mm"
                                value={formData.retractionDistanceMm}
                                onChange={(value) => setFormData(p => ({ ...p, retractionDistanceMm: value }))}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 4 }}>
                            <SpecField
                                label={t('inventory.speed')}
                                unit="mm/s"
                                value={formData.retractionSpeedMmS}
                                onChange={(value) => setFormData(p => ({ ...p, retractionSpeedMmS: value }))}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 4 }}>
                            <SpecField
                                label={t('inventory.filamentModal.zHop')}
                                unit="mm"
                                value={formData.retractionZHopMm}
                                onChange={(value) => setFormData(p => ({ ...p, retractionZHopMm: value }))}
                            />
                        </Grid>
                        <Grid size={{ xs: 12 }}>
                            <TextField
                                fullWidth
                                size="small"
                                label={t('common.notes')}
                                value={formData.retractionNotes}
                                onChange={(e) => setFormData(p => ({ ...p, retractionNotes: e.target.value }))}
                            />
                        </Grid>
                    </Grid>
                </SpecGroup>
            </Grid>

            <Grid size={{ xs: 12, lg: 6 }}>
                <SpecGroup
                    icon={<Thermometer size={18} />}
                    title={t('inventory.filamentModal.materialSpecsTitle')}
                    subtitle={t('inventory.filamentModal.materialSpecsSubtitle')}
                >
                    <Grid container spacing={1.5}>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <SpecField
                                label={t('inventory.density')}
                                unit="g/cm3"
                                value={formData.densityGcm3}
                                onChange={(value) => setFormData(p => ({ ...p, densityGcm3: value }))}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <SpecField
                                label={t('inventory.diameter')}
                                unit="mm"
                                value={formData.diameterMm}
                                onChange={(value) => setFormData(p => ({ ...p, diameterMm: value }))}
                            />
                        </Grid>
                    </Grid>
                </SpecGroup>
            </Grid>

        </Grid>
    );
}


