import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Grid,
    Typography,
    Box,
    InputAdornment,
    IconButton,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Divider
} from '@mui/material';
import { X, Save } from 'lucide-react';
import { api, type FilamentColorReference } from '../api';
import { normalizeNumericInput } from '../utils/number-utils';
import { FilamentColorSection } from './filament-modal/FilamentColorSection';

interface BulkEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    group: any;
}

export default function BulkEditModal({
    isOpen,
    onClose,
    onSuccess,
    group
}: BulkEditModalProps) {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);

    const [formData, setFormData] = useState({
        price: '',
        vendor: '',
        color: '#000000',
        colors: [] as string[],
        colorName: '',
        colorReferenceId: null as number | null,
        lowStockThreshold: '' as string | number,
        lowStockThresholdType: 'GRAMS' as 'GRAMS' | 'PERCENTAGE',
        nozzleTempMin: '',
        nozzleTempMax: '',
        bedTempMin: '',
        bedTempMax: '',
        densityGcm3: '',
        diameterMm: '',
        weightInitial: '',
    });
    const [colorReferences, setColorReferences] = useState<FilamentColorReference[]>([]);
    const [savingColorReference, setSavingColorReference] = useState(false);

    const firstItem = group?.items?.[0];
    const selectedBrandId = firstItem?.brand?.id || firstItem?.brandId || null;
    const selectedMaterialId = firstItem?.material?.id || firstItem?.materialId || null;
    const selectedTypeId = firstItem?.types?.[0]?.id || firstItem?.type?.id || null;

    useEffect(() => {
        if (isOpen && group && group.items && !isInitialized) {
            const first = group.items[0];
            const allSamePrice = group.items.every((i: any) => i.price === first.price);
            const allSameVendor = group.items.every((i: any) => i.vendor === first.vendor);
            const allSameColor = group.items.every((i: any) => i.color === first.color);
            const allSameColors = group.items.every((i: any) => JSON.stringify(i.colors) === JSON.stringify(first.colors));
            const allSameColorName = group.items.every((i: any) => i.colorName === first.colorName);
            const firstColorReferenceId = first.colorReferenceId ?? first.color_reference_id ?? null;
            const allSameColorReference = group.items.every((i: any) => (i.colorReferenceId ?? i.color_reference_id ?? null) === firstColorReferenceId);
            const allSameThreshold = group.items.every((i: any) => i.lowStockThreshold === first.lowStockThreshold);
            const allSameNozzleMin = group.items.every((i: any) => i.nozzleTempMin === first.nozzleTempMin);
            const allSameNozzleMax = group.items.every((i: any) => i.nozzleTempMax === first.nozzleTempMax);
            const allSameBedMin = group.items.every((i: any) => i.bedTempMin === first.bedTempMin);
            const allSameBedMax = group.items.every((i: any) => i.bedTempMax === first.bedTempMax);
            const allSameDensity = group.items.every((i: any) => i.densityGcm3 === first.densityGcm3);
            const allSameDiameter = group.items.every((i: any) => i.diameterMm === first.diameterMm);
            const allSameWeightInitial = group.items.every((i: any) => i.weightInitial === first.weightInitial);

            setFormData({
                price: allSamePrice && first.price ? first.price.toString() : '',
                vendor: allSameVendor ? (first.vendor || '') : '',
                color: allSameColor ? (first.color === 'transparent' ? 'transparent' : (first.color || '#000000')) : '#000000',
                colors: allSameColors && first.colors && first.colors.length > 1 ? first.colors.slice(1) : [],
                colorName: allSameColorName ? (first.colorName || '') : '',
                colorReferenceId: allSameColorReference ? firstColorReferenceId : null,
                lowStockThreshold: allSameThreshold && first.lowStockThreshold ? first.lowStockThreshold.toString() : '',
                lowStockThresholdType: first.lowStockThresholdType || 'GRAMS',
                nozzleTempMin: allSameNozzleMin && first.nozzleTempMin ? first.nozzleTempMin.toString() : '',
                nozzleTempMax: allSameNozzleMax && first.nozzleTempMax ? first.nozzleTempMax.toString() : '',
                bedTempMin: allSameBedMin && first.bedTempMin ? first.bedTempMin.toString() : '',
                bedTempMax: allSameBedMax && first.bedTempMax ? first.bedTempMax.toString() : '',
                densityGcm3: allSameDensity && first.densityGcm3 ? first.densityGcm3.toString() : '',
                diameterMm: allSameDiameter && first.diameterMm ? first.diameterMm.toString() : '',
                weightInitial: allSameWeightInitial && first.weightInitial ? first.weightInitial.toString() : '',
            });
            setIsInitialized(true);
        } else if (!isOpen) {
            setIsInitialized(false);
        }
    }, [group, isOpen, isInitialized]);

    useEffect(() => {
        let cancelled = false;

        const fetchColorReferences = async () => {
            if (!isOpen || !selectedBrandId) {
                setColorReferences([]);
                return;
            }

            try {
                const refs = await api.getColorReferences({
                    brandId: selectedBrandId,
                    materialId: selectedMaterialId || undefined,
                    typeId: selectedTypeId || undefined,
                });
                if (!cancelled) setColorReferences(refs);
            } catch (error) {
                console.error('Failed to fetch color references', error);
                if (!cancelled) setColorReferences([]);
            }
        };

        fetchColorReferences();

        return () => {
            cancelled = true;
        };
    }, [isOpen, selectedBrandId, selectedMaterialId, selectedTypeId]);

    useEffect(() => {
        if (!isOpen || formData.colorReferenceId || colorReferences.length === 0) return;

        const normalizeHexes = (hexes: Array<string | undefined | null>) => (
            hexes
                .filter(Boolean)
                .map(hex => String(hex).trim().toLowerCase())
        );
        const currentHexes = normalizeHexes([formData.color, ...formData.colors]);
        const currentName = formData.colorName.trim().toLowerCase();
        if (currentHexes.length === 0) return;

        const matchingReference = colorReferences.find(ref => {
            const refHexes = normalizeHexes(ref.hexes?.length ? ref.hexes : [ref.primaryHex]);
            const sameName = currentName && ref.name.trim().toLowerCase() === currentName;
            const sameHexes = refHexes.length === currentHexes.length
                && refHexes.every((hex, index) => hex === currentHexes[index]);
            return sameHexes && (!currentName || sameName);
        });

        if (matchingReference) {
            setFormData(prev => ({ ...prev, colorReferenceId: matchingReference.id }));
        }
    }, [isOpen, colorReferences, formData.colorReferenceId, formData.color, formData.colors, formData.colorName]);

    const handleApplyColorReference = (reference: FilamentColorReference | null) => {
        if (!reference) {
            setFormData(prev => ({ ...prev, colorReferenceId: null }));
            return;
        }

        const hexes = reference.hexes?.length ? reference.hexes : [reference.primaryHex];
        setFormData(prev => ({
            ...prev,
            colorReferenceId: reference.id,
            colorName: reference.name,
            color: hexes[0] || reference.primaryHex,
            colors: hexes.slice(1),
        }));
    };

    const handleSaveColorReference = async () => {
        if (!selectedBrandId || !formData.colorName.trim()) return;

        const name = formData.colorName.trim();
        const hexes = [formData.color, ...formData.colors].filter(Boolean);
        const existing = colorReferences.find(ref =>
            ref.brandId === selectedBrandId &&
            (ref.materialId || null) === (selectedMaterialId || null) &&
            (ref.typeId || null) === (selectedTypeId || null) &&
            ref.name.toLowerCase() === name.toLowerCase()
        );

        if (existing) {
            handleApplyColorReference(existing);
            return;
        }

        setSavingColorReference(true);
        try {
            const created = await api.createColorReference({
                brandId: selectedBrandId,
                materialId: selectedMaterialId,
                typeId: selectedTypeId,
                name,
                primaryHex: hexes[0],
                hexes,
                source: 'manual',
                isGlobal: false,
            });
            setColorReferences(prev => [...prev, created]);
            handleApplyColorReference(created);
        } catch (error: any) {
            console.error('Failed to save color reference', error);
            alert(error.message || t('referenceData.createFailed'));
        } finally {
            setSavingColorReference(false);
        }
    };

    const handleSubmit = async () => {
        if (!group || !group.items) return;
        setLoading(true);
        try {
            const ids = group.items.map((f: any) => f.id);
            const data: any = {};
            
            if (formData.price !== '') data.price = Number(formData.price);
            if (formData.vendor !== '') data.vendor = formData.vendor;
            if (formData.color !== '') {
                data.color = formData.color;
                data.colors = [formData.color, ...formData.colors];
                data.colorReferenceId = formData.colorReferenceId || null;
            } else if (formData.colors.length > 0) {
                // This case is unlikely if we don't have a primary color, 
                // but let's be safe if only secondary colors changed (not possible with current UI)
                data.colors = formData.colors;
            }
            if (formData.colorName !== '') data.colorName = formData.colorName;
            if (formData.lowStockThreshold !== '') data.lowStockThreshold = Number(formData.lowStockThreshold);
            data.lowStockThresholdType = formData.lowStockThresholdType;

            if (formData.nozzleTempMin !== '') data.nozzleTempMin = Number(formData.nozzleTempMin);
            if (formData.nozzleTempMax !== '') data.nozzleTempMax = Number(formData.nozzleTempMax);
            if (formData.bedTempMin !== '') data.bedTempMin = Number(formData.bedTempMin);
            if (formData.bedTempMax !== '') data.bedTempMax = Number(formData.bedTempMax);
            if (formData.densityGcm3 !== '') data.densityGcm3 = Number(formData.densityGcm3);
            if (formData.diameterMm !== '') data.diameterMm = Number(formData.diameterMm);
            if (formData.weightInitial !== '') {
                data.weightInitial = Number(formData.weightInitial);
                // Avoid updating weightRemaining here to preserve started spools' usage
            }

            await api.bulkUpdate(ids, data);
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Failed to bulk update', error);
            alert(t('inventory.bulkUpdateFailed'));
        } finally {
            setLoading(false);
        }
    };

    if (!group) return null;

    return (
        <Dialog open={isOpen} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="h6">
                    {t('inventory.bulkEditTitle', 'Édition en masse')} : {group.brandName} {group.displayName} ({group.colorName || (group.items?.[0]?.colorName) || t('inventory.noColor', 'Sans couleur')})
                </Typography>
                <IconButton onClick={onClose} size="small" disabled={loading}><X /></IconButton>
            </DialogTitle>
            <DialogContent dividers>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                    {t('inventory.bulkEditDesc', 'Les modifications seront appliquées aux {{count}} bobines du groupe.', { count: group.items.length })}
                </Typography>
                
                <Grid container spacing={3}>
                    {/* Basic Info */}
                    <Grid size={12}>
                        <Typography variant="subtitle2" color="primary" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {t('common.general', 'Général')}
                        </Typography>
                    </Grid>

                    <Grid size={12}>
                        <TextField
                            fullWidth
                            label={t('inventory.weightInitial', 'Poids initial (Bobine pleine)')}
                            type="text"
                            size="small"
                            value={formData.weightInitial}
                            onChange={(e) => setFormData(prev => ({ ...prev, weightInitial: normalizeNumericInput(e.target.value) }))}
                            InputProps={{ endAdornment: <InputAdornment position="end">g</InputAdornment> }}
                            helperText={t('inventory.bulkWeightInitialHint', 'Modifier le poids initial (ex: 1000g, 750g...). Cela mettra également à jour le poids restant.')}
                        />
                    </Grid>

                    {/* Colors */}
                    <Grid size={12}>
                        <Typography variant="subtitle2" color="primary" gutterBottom>
                            {t('inventory.filamentModal.colorTitle')}
                        </Typography>
                        <FilamentColorSection
                            t={t}
                            formData={formData as any}
                            setFormData={setFormData as any}
                            colorReferences={colorReferences}
                            selectedBrandId={selectedBrandId}
                            selectedMaterialId={selectedMaterialId}
                            selectedTypeId={selectedTypeId}
                            onApplyColorReference={handleApplyColorReference}
                            onSaveColorReference={handleSaveColorReference}
                            savingColorReference={savingColorReference}
                        />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                            fullWidth
                            label={t('inventory.price')}
                            type="text"
                            size="small"
                            value={formData.price}
                            onChange={(e) => setFormData(prev => ({ ...prev, price: normalizeNumericInput(e.target.value) }))}
                            InputProps={{ endAdornment: <InputAdornment position="end">€</InputAdornment> }}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                            fullWidth
                            label={t('inventory.vendor')}
                            size="small"
                            value={formData.vendor}
                            onChange={(e) => setFormData(prev => ({ ...prev, vendor: e.target.value }))}
                        />
                    </Grid>

                    <Grid size={12}>
                        <Typography variant="caption" color="textSecondary">{t('inventory.lowStockThreshold')}</Typography>
                        <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                            <TextField
                                fullWidth
                                label={t('inventory.thresholdValue')}
                                type="text"
                                size="small"
                                value={formData.lowStockThreshold}
                                onChange={(e) => setFormData(p => ({ ...p, lowStockThreshold: normalizeNumericInput(e.target.value) }))}
                            />
                            <FormControl sx={{ minWidth: 150 }} size="small">
                                <InputLabel>{t('inventory.thresholdType')}</InputLabel>
                                <Select
                                    value={formData.lowStockThresholdType}
                                    label={t('inventory.thresholdType')}
                                    onChange={(e) => setFormData(p => ({ ...p, lowStockThresholdType: e.target.value as any }))}
                                >
                                    <MenuItem value="GRAMS">{t('inventory.grams')}</MenuItem>
                                    <MenuItem value="PERCENTAGE">{t('inventory.percentage')}</MenuItem>
                                </Select>
                            </FormControl>
                        </Box>
                    </Grid>

                    <Grid size={12}><Divider /></Grid>

                    {/* Technical Specs */}
                    <Grid size={12}>
                        <Typography variant="subtitle2" color="primary" gutterBottom>
                            {t('inventory.techSpecs', 'Spécifications techniques')}
                        </Typography>
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                            fullWidth
                            label={t('inventory.nozzleTempMin')}
                            type="text"
                            size="small"
                            value={formData.nozzleTempMin}
                            onChange={(e) => setFormData(p => ({ ...p, nozzleTempMin: normalizeNumericInput(e.target.value) }))}
                            InputProps={{ endAdornment: <InputAdornment position="end">°C</InputAdornment> }}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                            fullWidth
                            label={t('inventory.nozzleTempMax')}
                            type="text"
                            size="small"
                            value={formData.nozzleTempMax}
                            onChange={(e) => setFormData(p => ({ ...p, nozzleTempMax: normalizeNumericInput(e.target.value) }))}
                            InputProps={{ endAdornment: <InputAdornment position="end">°C</InputAdornment> }}
                        />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                            fullWidth
                            label={t('inventory.bedTempMin')}
                            type="text"
                            size="small"
                            value={formData.bedTempMin}
                            onChange={(e) => setFormData(p => ({ ...p, bedTempMin: normalizeNumericInput(e.target.value) }))}
                            InputProps={{ endAdornment: <InputAdornment position="end">°C</InputAdornment> }}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                            fullWidth
                            label={t('inventory.bedTempMax')}
                            type="text"
                            size="small"
                            value={formData.bedTempMax}
                            onChange={(e) => setFormData(p => ({ ...p, bedTempMax: normalizeNumericInput(e.target.value) }))}
                            InputProps={{ endAdornment: <InputAdornment position="end">°C</InputAdornment> }}
                        />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                            fullWidth
                            label={t('inventory.density')}
                            type="text"
                            size="small"
                            value={formData.densityGcm3}
                            onChange={(e) => setFormData(p => ({ ...p, densityGcm3: normalizeNumericInput(e.target.value) }))}
                            InputProps={{ endAdornment: <InputAdornment position="end">g/cm³</InputAdornment> }}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                            fullWidth
                            label={t('inventory.diameter')}
                            type="text"
                            size="small"
                            value={formData.diameterMm}
                            onChange={(e) => setFormData(p => ({ ...p, diameterMm: normalizeNumericInput(e.target.value) }))}
                            InputProps={{ endAdornment: <InputAdornment position="end">mm</InputAdornment> }}
                        />
                    </Grid>
                </Grid>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={loading}>{t('common.cancel')}</Button>
                <Button
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={loading}
                    startIcon={loading ? null : <Save size={18} />}
                    sx={{ bgcolor: '#1661af', '&:hover': { bgcolor: '#0b4d91' } }}
                >
                    {loading ? t('common.saving') : t('common.save')}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
