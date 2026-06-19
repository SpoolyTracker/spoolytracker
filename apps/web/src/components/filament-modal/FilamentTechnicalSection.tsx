import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { Box, Button, Chip, Grid, IconButton, InputAdornment, TextField, Typography } from '@mui/material';
import { Box as BoxIcon, Calculator, Clock, Flame, Gauge, Plus, Square, Thermometer, Trash2, Wind } from 'lucide-react';
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
    const [flowStart, setFlowStart] = useState('5');
    const [flowMax, setFlowMax] = useState('20');
    const [flowStep, setFlowStep] = useState('0.5');
    const [flowMeasuredHeight, setFlowMeasuredHeight] = useState('');
    const [flowSafetyPercent, setFlowSafetyPercent] = useState('95');
    const [wallExpectedWidth, setWallExpectedWidth] = useState('0.45');
    const [wallMeasuredWidth, setWallMeasuredWidth] = useState('');
    const [paStart, setPaStart] = useState('0');
    const [paStep, setPaStep] = useState('0.002');
    const [paBestIndex, setPaBestIndex] = useState('');
    const [tempStart, setTempStart] = useState('230');
    const [tempStep, setTempStep] = useState('5');
    const [tempBestIndex, setTempBestIndex] = useState('');
    const [retractionStart, setRetractionStart] = useState('0.2');
    const [retractionStep, setRetractionStep] = useState('0.1');
    const [retractionBestIndex, setRetractionBestIndex] = useState('');

    const volumetricFlowResult = useMemo(() => {
        const start = parseOptionalNumber(flowStart);
        const max = parseOptionalNumber(flowMax);
        const step = parseOptionalNumber(flowStep);
        const height = parseOptionalNumber(flowMeasuredHeight);
        const safety = parseOptionalNumber(flowSafetyPercent) ?? 100;

        if (start === null || max === null || step === null || height === null || step <= 0) {
            return null;
        }

        const observed = Math.min(start + height * step, max);
        const recommended = observed * Math.max(0, Math.min(safety, 100)) / 100;
        const towerHeight = (max - start) / step;

        return {
            observed: Math.round(observed * 100) / 100,
            recommended: Math.round(recommended * 100) / 100,
            towerHeight: Math.round(towerHeight * 100) / 100,
        };
    }, [flowStart, flowMax, flowStep, flowMeasuredHeight, flowSafetyPercent]);

    const flowRatioResult = useMemo(() => {
        const expected = parseOptionalNumber(wallExpectedWidth);
        const measured = parseOptionalNumber(wallMeasuredWidth);
        const current = parseOptionalNumber(String(formData.flowRatio)) ?? 1;
        if (expected === null || measured === null || expected <= 0 || measured <= 0) return null;
        return Math.round(current * expected / measured * 1000) / 1000;
    }, [wallExpectedWidth, wallMeasuredWidth, formData.flowRatio]);

    const pressureAdvanceResult = useMemo(() => {
        const start = parseOptionalNumber(paStart);
        const step = parseOptionalNumber(paStep);
        const line = parseOptionalNumber(paBestIndex);
        if (start === null || step === null || line === null || step <= 0 || line < 1) return null;
        return Math.round((start + (line - 1) * step) * 10000) / 10000;
    }, [paStart, paStep, paBestIndex]);

    const tempTowerResult = useMemo(() => {
        const start = parseOptionalNumber(tempStart);
        const step = parseOptionalNumber(tempStep);
        const index = parseOptionalNumber(tempBestIndex);
        if (start === null || step === null || index === null || step <= 0) return null;
        return Math.round(start - index * step);
    }, [tempStart, tempStep, tempBestIndex]);

    const retractionResult = useMemo(() => {
        const start = parseOptionalNumber(retractionStart);
        const step = parseOptionalNumber(retractionStep);
        const index = parseOptionalNumber(retractionBestIndex);
        if (start === null || step === null || index === null || step <= 0) return null;
        return Math.round((start + index * step) * 100) / 100;
    }, [retractionStart, retractionStep, retractionBestIndex]);

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
                        <Grid size={{ xs: 12, sm: 4 }}>
                            <SpecField
                                label={t('inventory.filamentModal.flowRatio', 'Flow ratio')}
                                value={formData.flowRatio}
                                onChange={(value) => setFormData(p => ({ ...p, flowRatio: value }))}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 4 }}>
                            <SpecField
                                label={t('inventory.filamentModal.maxVolumetricSpeed', 'Debit volumetrique max')}
                                unit="mm3/s"
                                value={formData.maxVolumetricSpeedMm3S}
                                onChange={(value) => setFormData(p => ({ ...p, maxVolumetricSpeedMm3S: value }))}
                            />
                        </Grid>
                        <Grid size={{ xs: 12 }}>
                            <Box
                                sx={{
                                    p: 1.25,
                                    borderRadius: 1.5,
                                    border: '1px dashed',
                                    borderColor: 'divider',
                                    bgcolor: 'rgba(15, 23, 42, 0.02)',
                                }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                    <Calculator size={16} />
                                    <Typography variant="caption" fontWeight={800}>
                                        {t('inventory.filamentModal.volumetricCalculator', 'Calculateur debit volumetrique')}
                                    </Typography>
                                    {volumetricFlowResult && (
                                        <Chip
                                            size="small"
                                            label={`${volumetricFlowResult.recommended} mm3/s`}
                                            color="primary"
                                            sx={{ height: 22, fontSize: '0.7rem' }}
                                        />
                                    )}
                                </Box>
                                <Grid container spacing={1}>
                                    <Grid size={{ xs: 6, sm: 4 }}>
                                        <SpecField
                                            label={t('inventory.filamentModal.flowStart', 'Depart')}
                                            unit="mm3/s"
                                            value={flowStart}
                                            onChange={setFlowStart}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 6, sm: 4 }}>
                                        <SpecField
                                            label={t('common.max', 'Max')}
                                            unit="mm3/s"
                                            value={flowMax}
                                            onChange={setFlowMax}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 6, sm: 4 }}>
                                        <SpecField
                                            label={t('inventory.filamentModal.flowStep', 'Pas')}
                                            unit="mm3/s/mm"
                                            value={flowStep}
                                            onChange={setFlowStep}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 6, sm: 4 }}>
                                        <SpecField
                                            label={t('inventory.filamentModal.cleanHeight', 'Hauteur propre')}
                                            unit="mm"
                                            value={flowMeasuredHeight}
                                            onChange={setFlowMeasuredHeight}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 6, sm: 4 }}>
                                        <SpecField
                                            label={t('inventory.filamentModal.safetyMargin', 'Marge')}
                                            unit="%"
                                            value={flowSafetyPercent}
                                            onChange={setFlowSafetyPercent}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                                            <Typography variant="caption" color="text.secondary">
                                                {volumetricFlowResult
                                                    ? `${t('inventory.filamentModal.observedFlow', 'Observe')}: ${volumetricFlowResult.observed} mm3/s - ${t('inventory.filamentModal.towerHeight', 'Hauteur tour')}: ${volumetricFlowResult.towerHeight} mm`
                                                    : t('inventory.filamentModal.flowCalculatorHint', 'Renseignez la hauteur propre mesuree pour calculer la valeur recommandee.')}
                                            </Typography>
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                disabled={!volumetricFlowResult}
                                                onClick={() => volumetricFlowResult && setFormData(p => ({
                                                    ...p,
                                                    maxVolumetricSpeedMm3S: String(volumetricFlowResult.recommended),
                                                }))}
                                            >
                                                {t('inventory.filamentModal.applyRecommendedFlow', 'Appliquer')}
                                            </Button>
                                        </Box>
                                    </Grid>
                                </Grid>
                            </Box>
                        </Grid>
                        <Grid size={{ xs: 12 }}>
                            <Box sx={{ display: 'grid', gap: 1.25 }}>
                                <Box sx={{ p: 1.25, borderRadius: 1.5, border: '1px dashed', borderColor: 'divider', bgcolor: 'rgba(15, 23, 42, 0.02)' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                        <Calculator size={16} />
                                        <Typography variant="caption" fontWeight={800}>
                                            {t('inventory.filamentModal.flowRatioCalculator', 'Calculateur flow rate')}
                                        </Typography>
                                        {flowRatioResult !== null && <Chip size="small" label={String(flowRatioResult)} color="primary" sx={{ height: 22, fontSize: '0.7rem' }} />}
                                    </Box>
                                    <Grid container spacing={1}>
                                        <Grid size={{ xs: 6, sm: 4 }}>
                                            <SpecField label={t('inventory.filamentModal.expectedWidth', 'Largeur cible')} unit="mm" value={wallExpectedWidth} onChange={setWallExpectedWidth} />
                                        </Grid>
                                        <Grid size={{ xs: 6, sm: 4 }}>
                                            <SpecField label={t('inventory.filamentModal.measuredWidth', 'Largeur mesuree')} unit="mm" value={wallMeasuredWidth} onChange={setWallMeasuredWidth} />
                                        </Grid>
                                        <Grid size={{ xs: 12, sm: 4 }}>
                                            <Button fullWidth size="small" variant="outlined" disabled={flowRatioResult === null} onClick={() => flowRatioResult !== null && setFormData(p => ({ ...p, flowRatio: String(flowRatioResult) }))}>
                                                {t('inventory.filamentModal.applyFlowRatio', 'Appliquer flow')}
                                            </Button>
                                        </Grid>
                                    </Grid>
                                </Box>

                                <Box sx={{ p: 1.25, borderRadius: 1.5, border: '1px dashed', borderColor: 'divider', bgcolor: 'rgba(15, 23, 42, 0.02)' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                        <Calculator size={16} />
                                        <Typography variant="caption" fontWeight={800}>
                                            {t('inventory.filamentModal.pressureAdvanceCalculator', 'Calculateur pressure advance')}
                                        </Typography>
                                        {pressureAdvanceResult !== null && <Chip size="small" label={String(pressureAdvanceResult)} color="primary" sx={{ height: 22, fontSize: '0.7rem' }} />}
                                    </Box>
                                    <Grid container spacing={1}>
                                        <Grid size={{ xs: 4 }}>
                                            <SpecField label={t('inventory.filamentModal.flowStart', 'Depart')} value={paStart} onChange={setPaStart} />
                                        </Grid>
                                        <Grid size={{ xs: 4 }}>
                                            <SpecField label={t('inventory.filamentModal.flowStep', 'Pas')} value={paStep} onChange={setPaStep} />
                                        </Grid>
                                        <Grid size={{ xs: 4 }}>
                                            <SpecField label={t('inventory.filamentModal.bestLine', 'Meilleure ligne')} value={paBestIndex} onChange={setPaBestIndex} />
                                        </Grid>
                                        <Grid size={{ xs: 12 }}>
                                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                                                {t('inventory.filamentModal.pressureAdvanceHint', 'Ligne 1 = valeur de depart, puis chaque ligne ajoute le pas.')}
                                            </Typography>
                                            <Button size="small" variant="outlined" disabled={pressureAdvanceResult === null} onClick={() => pressureAdvanceResult !== null && setFormData(p => ({ ...p, kFactor: String(pressureAdvanceResult) }))}>
                                                {t('inventory.filamentModal.applyKFactor', 'Appliquer K-factor')}
                                            </Button>
                                        </Grid>
                                    </Grid>
                                </Box>

                                <Box sx={{ p: 1.25, borderRadius: 1.5, border: '1px dashed', borderColor: 'divider', bgcolor: 'rgba(15, 23, 42, 0.02)' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                        <Calculator size={16} />
                                        <Typography variant="caption" fontWeight={800}>
                                            {t('inventory.filamentModal.tempTowerCalculator', 'Calculateur temp tower')}
                                        </Typography>
                                        {tempTowerResult !== null && <Chip size="small" label={`${tempTowerResult}${CELSIUS_UNIT}`} color="primary" sx={{ height: 22, fontSize: '0.7rem' }} />}
                                    </Box>
                                    <Grid container spacing={1}>
                                        <Grid size={{ xs: 4 }}>
                                            <SpecField label={t('inventory.filamentModal.startTemperature', 'Temp depart')} unit={CELSIUS_UNIT} value={tempStart} onChange={setTempStart} />
                                        </Grid>
                                        <Grid size={{ xs: 4 }}>
                                            <SpecField label={t('inventory.filamentModal.flowStep', 'Pas')} unit={CELSIUS_UNIT} value={tempStep} onChange={setTempStep} />
                                        </Grid>
                                        <Grid size={{ xs: 4 }}>
                                            <SpecField label={t('inventory.filamentModal.bestSection', 'Meilleure section')} value={tempBestIndex} onChange={setTempBestIndex} />
                                        </Grid>
                                        <Grid size={{ xs: 12 }}>
                                            <Button size="small" variant="outlined" disabled={tempTowerResult === null} onClick={() => tempTowerResult !== null && setFormData(p => ({ ...p, nozzleTempMin: String(tempTowerResult), nozzleTempMax: String(tempTowerResult) }))}>
                                                {t('inventory.filamentModal.applyTemperature', 'Appliquer temperature')}
                                            </Button>
                                        </Grid>
                                    </Grid>
                                </Box>
                            </Box>
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
                        <Grid size={{ xs: 12 }}>
                            <Box sx={{ p: 1.25, borderRadius: 1.5, border: '1px dashed', borderColor: 'divider', bgcolor: 'rgba(15, 23, 42, 0.02)' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                    <Calculator size={16} />
                                    <Typography variant="caption" fontWeight={800}>
                                        {t('inventory.filamentModal.retractionCalculator', 'Calculateur retraction')}
                                    </Typography>
                                    {retractionResult !== null && <Chip size="small" label={`${retractionResult} mm`} color="primary" sx={{ height: 22, fontSize: '0.7rem' }} />}
                                </Box>
                                <Grid container spacing={1}>
                                    <Grid size={{ xs: 4 }}>
                                        <SpecField label={t('inventory.filamentModal.flowStart', 'Depart')} unit="mm" value={retractionStart} onChange={setRetractionStart} />
                                    </Grid>
                                    <Grid size={{ xs: 4 }}>
                                        <SpecField label={t('inventory.filamentModal.flowStep', 'Pas')} unit="mm" value={retractionStep} onChange={setRetractionStep} />
                                    </Grid>
                                    <Grid size={{ xs: 4 }}>
                                        <SpecField label={t('inventory.filamentModal.bestSection', 'Meilleure section')} value={retractionBestIndex} onChange={setRetractionBestIndex} />
                                    </Grid>
                                    <Grid size={{ xs: 12 }}>
                                        <Button size="small" variant="outlined" disabled={retractionResult === null} onClick={() => retractionResult !== null && setFormData(p => ({ ...p, retractionDistanceMm: String(retractionResult) }))}>
                                            {t('inventory.filamentModal.applyRetraction', 'Appliquer distance')}
                                        </Button>
                                    </Grid>
                                </Grid>
                            </Box>
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


