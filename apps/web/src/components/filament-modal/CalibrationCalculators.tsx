import { useMemo, useState, type ReactNode } from 'react';
import { Box, Button, Chip, Grid, InputAdornment, TextField, Typography } from '@mui/material';
import { Calculator } from 'lucide-react';
import { normalizeNumericInput } from '../../utils/number-utils';
import { computeVfaMaxSpeed, applyVfaResult } from '../../utils/calibration';
import type { ConditionalTemperatureRule } from '../../api';
import type { FilamentFormData } from './types';

export type CalibrationPatch = Partial<Pick<FilamentFormData,
    'maxVolumetricSpeedMm3S' | 'flowRatio' | 'kFactor' | 'nozzleTempMin' |
    'nozzleTempMax' | 'retractionDistanceMm' | 'printSpeedMax' | 'conditionalTemperatureRules'>>;

interface Props {
    t: any;
    currentFlowRatio: string;
    currentPrintSpeedMax: number | null;
    currentRules: ConditionalTemperatureRule[];
    onApply: (patch: CalibrationPatch) => void;
}

interface SpecFieldProps {
    label: string;
    value: string | number;
    unit?: ReactNode;
    onChange: (value: string) => void;
}

export function SpecField({ label, value, unit, onChange }: SpecFieldProps) {
    return (
        <TextField
            fullWidth
            size="small"
            label={label}
            type="text"
            value={value}
            onChange={(e) => onChange(normalizeNumericInput(e.target.value))}
            InputLabelProps={{ shrink: true }}
            InputProps={unit ? {
                endAdornment: <InputAdornment position="end">{unit}</InputAdornment>,
            } : undefined}
        />
    );
}

export const parseOptionalNumber = (value: string) => {
    if (value === '') return null;
    const normalized = value.trim().replace(',', '.');
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
};

const CELSIUS_UNIT = '°C';

export function CalibrationCalculators({ t, currentFlowRatio, currentPrintSpeedMax, currentRules, onApply }: Props) {
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
    const [vfaStart, setVfaStart] = useState('160');
    const [vfaStep, setVfaStep] = useState('20');
    const [vfaNotch, setVfaNotch] = useState('');
    const [vfaTemp, setVfaTemp] = useState('');

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
        const current = parseOptionalNumber(currentFlowRatio) ?? 1;
        if (expected === null || measured === null || expected <= 0 || measured <= 0) return null;
        return Math.round(current * expected / measured * 1000) / 1000;
    }, [wallExpectedWidth, wallMeasuredWidth, currentFlowRatio]);

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

    const vfaVmax = useMemo(() => computeVfaMaxSpeed({
        startSpeed: parseOptionalNumber(vfaStart),
        step: parseOptionalNumber(vfaStep),
        notch: parseOptionalNumber(vfaNotch),
    }), [vfaStart, vfaStep, vfaNotch]);

    const vfaTempValue = parseOptionalNumber(vfaTemp);
    const vfaCanApply = vfaVmax !== null && vfaTempValue !== null;

    const handleApplyVfa = () => {
        if (vfaVmax === null || vfaTempValue === null) return;
        const existing = currentRules.some(
            (r) => r.nozzleTempMin === vfaTempValue && r.nozzleTempMax === vfaTempValue,
        );
        if (existing && !window.confirm(
            t('inventory.filamentModal.vfaReplaceConfirm', { temp: vfaTempValue,
                defaultValue: `Une règle existe déjà à ${vfaTempValue} °C, la remplacer ?` }),
        )) return;
        const r = applyVfaResult({
            vmax: vfaVmax, temp: vfaTempValue,
            currentPrintSpeedMax, currentRules,
        });
        onApply({ printSpeedMax: r.printSpeedMax, conditionalTemperatureRules: r.conditionalTemperatureRules });
    };

    return (
        <Box sx={{ display: 'grid', gap: 1.25 }}>
            {/* Volumetric flow calculator */}
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
                                onClick={() => volumetricFlowResult && onApply({ maxVolumetricSpeedMm3S: String(volumetricFlowResult.recommended) })}
                            >
                                {t('inventory.filamentModal.applyRecommendedFlow', 'Appliquer')}
                            </Button>
                        </Box>
                    </Grid>
                </Grid>
            </Box>

            {/* Flow ratio calculator */}
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
                        <Button fullWidth size="small" variant="outlined" disabled={flowRatioResult === null} onClick={() => flowRatioResult !== null && onApply({ flowRatio: String(flowRatioResult) })}>
                            {t('inventory.filamentModal.applyFlowRatio', 'Appliquer flow')}
                        </Button>
                    </Grid>
                </Grid>
            </Box>

            {/* Pressure advance calculator */}
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
                        <Button size="small" variant="outlined" disabled={pressureAdvanceResult === null} onClick={() => pressureAdvanceResult !== null && onApply({ kFactor: String(pressureAdvanceResult) })}>
                            {t('inventory.filamentModal.applyKFactor', 'Appliquer K-factor')}
                        </Button>
                    </Grid>
                </Grid>
            </Box>

            {/* Temp tower calculator */}
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
                        <Button size="small" variant="outlined" disabled={tempTowerResult === null} onClick={() => tempTowerResult !== null && onApply({ nozzleTempMin: String(tempTowerResult), nozzleTempMax: String(tempTowerResult) })}>
                            {t('inventory.filamentModal.applyTemperature', 'Appliquer temperature')}
                        </Button>
                    </Grid>
                </Grid>
            </Box>

            {/* Retraction calculator */}
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
                        <Button size="small" variant="outlined" disabled={retractionResult === null} onClick={() => retractionResult !== null && onApply({ retractionDistanceMm: String(retractionResult) })}>
                            {t('inventory.filamentModal.applyRetraction', 'Appliquer distance')}
                        </Button>
                    </Grid>
                </Grid>
            </Box>

            {/* VFA calculator */}
            <Box sx={{ p: 1.25, borderRadius: 1.5, border: '1px dashed', borderColor: 'divider', bgcolor: 'rgba(15, 23, 42, 0.02)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Calculator size={16} />
                    <Typography variant="caption" fontWeight={800}>
                        {t('inventory.filamentModal.vfaCalculator', 'Calculateur VFA (vitesse max)')}
                    </Typography>
                    {vfaVmax !== null && <Chip size="small" label={`${vfaVmax} mm/s`} color="primary" sx={{ height: 22, fontSize: '0.7rem' }} />}
                </Box>
                <Grid container spacing={1}>
                    <Grid size={{ xs: 6, sm: 3 }}>
                        <SpecField label={t('inventory.filamentModal.flowStart', 'Depart')} unit="mm/s" value={vfaStart} onChange={setVfaStart} />
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3 }}>
                        <SpecField label={t('inventory.filamentModal.flowStep', 'Pas')} unit="mm/s" value={vfaStep} onChange={setVfaStep} />
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3 }}>
                        <SpecField label={t('inventory.filamentModal.vfaNotch', 'Encoche')} value={vfaNotch} onChange={setVfaNotch} />
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3 }}>
                        <SpecField label={t('inventory.filamentModal.temperature', 'Temperature')} unit="°C" value={vfaTemp} onChange={setVfaTemp} />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                            <Typography variant="caption" color="text.secondary">
                                {t('inventory.filamentModal.vfaHint', 'Encoche où apparaissent les artefacts. Ajoute une vitesse max conditionnelle pour cette température.')}
                            </Typography>
                            <Button size="small" variant="outlined" disabled={!vfaCanApply} onClick={handleApplyVfa}>
                                {t('inventory.filamentModal.applyVfa', 'Appliquer')}
                            </Button>
                        </Box>
                    </Grid>
                </Grid>
            </Box>
        </Box>
    );
}
