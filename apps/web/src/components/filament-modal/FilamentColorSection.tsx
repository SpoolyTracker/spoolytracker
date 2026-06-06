import { useState } from 'react';
import { Autocomplete, Box, Button, Checkbox, Chip, FormControlLabel, Grid, IconButton, TextField, Typography } from '@mui/material';
import { Plus, Save, Trash2 } from 'lucide-react';
import ColorIndicator from '../ColorIndicator';
import type { FilamentFormData, SetFilamentFormData } from './types';
import type { FilamentColorReference } from '../../api';

interface Props {
    t: any;
    formData: FilamentFormData;
    setFormData: SetFilamentFormData;
    colorReferences?: FilamentColorReference[];
    selectedBrandId?: number | null;
    selectedMaterialId?: number | null;
    selectedTypeId?: number | null;
    onApplyColorReference?: (reference: FilamentColorReference | null) => void;
    onSaveColorReference?: () => Promise<void>;
    savingColorReference?: boolean;
}

export function FilamentColorSection({
    t,
    formData,
    setFormData,
    colorReferences = [],
    selectedBrandId,
    selectedMaterialId,
    selectedTypeId,
    onApplyColorReference,
    onSaveColorReference,
    savingColorReference = false,
}: Props) {
    const [previousColors, setPreviousColors] = useState<{ color: string; colors: string[] } | null>(null);
    const isTransparent = formData.color === 'transparent';

    const colorInputValue = (value: string) => {
        if (/^#[0-9a-fA-F]{6}$/.test(value)) return value;
        if (/^#[0-9a-fA-F]{8}$/.test(value)) return value.slice(0, 7);
        return '#ffffff';
    };
    const checkerboardSx = {
        backgroundColor: '#fff',
        backgroundImage: `
            linear-gradient(45deg, #d7dce2 25%, transparent 25%),
            linear-gradient(-45deg, #d7dce2 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, #d7dce2 75%),
            linear-gradient(-45deg, transparent 75%, #d7dce2 75%)
        `,
        backgroundSize: '14px 14px',
        backgroundPosition: '0 0, 0 7px, 7px -7px, -7px 0px',
    };

    const updateColor = (index: number, value: string) => {
        if (isTransparent) return;

        if (index === 0) {
            setFormData(p => ({ ...p, color: value, colorReferenceId: null }));
            return;
        }

        setFormData(p => {
            const nextColors = [...p.colors];
            nextColors[index - 1] = value;
            return { ...p, colors: nextColors, colorReferenceId: null };
        });
    };

    const removeSecondaryColor = (index: number) => {
        if (isTransparent) return;
        setFormData(p => ({ ...p, colors: p.colors.filter((_, i) => i !== index), colorReferenceId: null }));
    };

    const handleTransparentChange = (checked: boolean) => {
        if (checked) {
            setPreviousColors({
                color: formData.color === 'transparent' ? '#ffffff' : formData.color,
                colors: formData.colors,
            });
            setFormData(p => ({ ...p, color: 'transparent', colorReferenceId: null }));
            return;
        }

        setFormData(p => ({
            ...p,
            color: previousColors?.color && previousColors.color !== 'transparent'
                ? previousColors.color
                : '#ffffff',
            colors: previousColors?.colors ?? p.colors,
            colorReferenceId: null,
        }));
        setPreviousColors(null);
    };

    const getHierarchicalColorReferences = () => {
        if (!selectedBrandId) return [];

        let candidates = colorReferences.filter(ref => ref.brandId === selectedBrandId);

        if (selectedMaterialId) {
            const materialMatches = candidates.filter(ref => ref.materialId === selectedMaterialId);
            candidates = materialMatches.length > 0
                ? materialMatches
                : candidates.filter(ref => !ref.materialId);
        }

        if (selectedTypeId) {
            const typeMatches = candidates.filter(ref => ref.typeId === selectedTypeId);
            candidates = typeMatches.length > 0
                ? typeMatches
                : candidates.filter(ref => !ref.typeId);
        }

        return candidates.sort((a, b) => {
            const scopeA = a.organizationId ? 0 : 1;
            const scopeB = b.organizationId ? 0 : 1;
            if (scopeA !== scopeB) return scopeA - scopeB;
            return a.name.localeCompare(b.name);
        });
    };

    const referenceOptions = getHierarchicalColorReferences();
    const selectedReference = referenceOptions.find(ref => ref.id === formData.colorReferenceId) || null;
    const canSaveReference = Boolean(selectedBrandId && formData.colorName.trim() && !isTransparent && formData.color);

    const colorRows = [
        { label: t('inventory.filamentModal.primaryColor'), value: formData.color, index: 0 },
        ...formData.colors.map((value, index) => ({
            label: t('inventory.filamentModal.colorNumber', { number: index + 2 }),
            value,
            index: index + 1,
        })),
    ];

    return (
        <Grid container spacing={2}>
            <Grid size={{ xs: 12 }}>
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(220px, 320px)' },
                        gap: 2,
                        alignItems: 'flex-start',
                    }}
                >
                    <TextField
                        fullWidth
                        label={t('inventory.colorName')}
                        value={formData.colorName}
                        onChange={(e) => setFormData(p => ({ ...p, colorName: e.target.value, colorReferenceId: null }))}
                        helperText={t('inventory.filamentModal.colorNameHelper')}
                    />
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.5,
                            minHeight: 56,
                            pt: { xs: 0, md: 0.75 },
                            minWidth: 0,
                        }}
                    >
                        {isTransparent ? (
                            <Box
                                sx={{
                                    width: 44,
                                    height: 44,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    borderRadius: '50%',
                                    flex: '0 0 auto',
                                    ...checkerboardSx,
                                }}
                            />
                        ) : (
                            <ColorIndicator colors={[formData.color, ...formData.colors]} size={44} />
                        )}
                        <Box sx={{ minWidth: 0 }}>
                            <Typography variant="caption" color="text.secondary">{t('inventory.filamentModal.preview')}</Typography>
                            <Typography variant="body2" noWrap>
                                {isTransparent ? 'transparent' : [formData.color, ...formData.colors].join(', ')}
                            </Typography>
                        </Box>
                    </Box>
                </Box>
            </Grid>

            <Grid size={{ xs: 12 }}>
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) auto' },
                        gap: 1.5,
                        alignItems: 'center',
                    }}
                >
                    <Autocomplete
                        size="small"
                        options={referenceOptions}
                        value={selectedReference}
                        onChange={(_, value) => onApplyColorReference?.(value)}
                        disabled={!selectedBrandId || referenceOptions.length === 0}
                        getOptionLabel={(option) => option.name}
                        isOptionEqualToValue={(option, value) => option.id === value.id}
                        renderOption={(props, option) => {
                            const hexes = option.hexes?.length ? option.hexes : [option.primaryHex];
                            return (
                                <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <ColorIndicator colors={hexes} size={24} />
                                    <Box sx={{ minWidth: 0, flex: 1 }}>
                                        <Typography variant="body2" noWrap>{option.name}</Typography>
                                        <Typography variant="caption" color="text.secondary" noWrap>
                                            {hexes.join(', ')}
                                        </Typography>
                                    </Box>
                                    <Chip
                                        size="small"
                                        label={option.organizationId ? t('referenceData.custom') : option.source === 'spoolman' ? 'Spoolman' : t('referenceData.global')}
                                        variant="outlined"
                                        sx={{ height: 20, fontSize: 10 }}
                                    />
                                </Box>
                            );
                        }}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label={t('inventory.filamentModal.colorReference')}
                                placeholder={referenceOptions.length ? t('inventory.filamentModal.chooseColorReference') : t('inventory.filamentModal.noColorReference')}
                            />
                        )}
                    />
                    <Button
                        variant="outlined"
                        startIcon={<Save size={16} />}
                        disabled={!canSaveReference || savingColorReference}
                        onClick={onSaveColorReference}
                        sx={{ whiteSpace: 'nowrap' }}
                    >
                        {savingColorReference ? t('common.saving') : t('inventory.filamentModal.saveColorReference')}
                    </Button>
                </Box>
            </Grid>

            <Grid size={{ xs: 12 }}>
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: {
                            xs: '1fr',
                            sm: 'repeat(2, minmax(0, 1fr))',
                            lg: 'repeat(3, minmax(0, 1fr))',
                        },
                        gap: 1.5,
                        opacity: isTransparent ? 0.58 : 1,
                    }}
                >
                    {colorRows.map((row) => {
                        const isPrimary = row.index === 0;
                        const showTransparentSwatch = isPrimary && isTransparent;

                        return (
                            <Box
                                key={row.index}
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: '56px minmax(0, 1fr) auto',
                                    gap: 1,
                                    alignItems: 'center',
                                    p: 1,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    borderRadius: 1.5,
                                }}
                            >
                                {showTransparentSwatch ? (
                                    <Box
                                        sx={{
                                            width: 48,
                                            height: 48,
                                            border: '1px solid',
                                            borderColor: 'divider',
                                            borderRadius: 1,
                                            cursor: 'not-allowed',
                                            ...checkerboardSx,
                                        }}
                                    />
                                ) : (
                                    <Box
                                        component="input"
                                        type="color"
                                        aria-label={row.label}
                                        value={colorInputValue(row.value)}
                                        onChange={(e: any) => updateColor(row.index, e.target.value)}
                                        disabled={isTransparent}
                                        sx={{
                                            width: 48,
                                            height: 48,
                                            p: 0.5,
                                            border: '1px solid',
                                            borderColor: 'divider',
                                            borderRadius: 1,
                                            cursor: isTransparent ? 'not-allowed' : 'pointer',
                                            bgcolor: 'background.paper',
                                        }}
                                    />
                                )}
                                <TextField
                                    fullWidth
                                    size="small"
                                    label={isPrimary ? t('inventory.colorHex') : row.label}
                                    value={showTransparentSwatch ? 'transparent' : row.value}
                                    onChange={(e) => updateColor(row.index, e.target.value)}
                                    helperText={isPrimary ? t('inventory.filamentModal.linkedToPicker') : t('inventory.filamentModal.secondaryColor')}
                                    disabled={isTransparent}
                                />
                                {!isPrimary && (
                                    <IconButton
                                        size="small"
                                        onClick={() => removeSecondaryColor(row.index - 1)}
                                        disabled={isTransparent}
                                        sx={{ alignSelf: 'start', mt: 0.5 }}
                                    >
                                        <Trash2 size={16} />
                                    </IconButton>
                                )}
                            </Box>
                        );
                    })}

                    <IconButton
                        color="primary"
                        onClick={() => setFormData(p => ({ ...p, colors: [...p.colors, '#cccccc'], colorReferenceId: null }))}
                        disabled={isTransparent}
                        sx={{
                            width: '100%',
                            minHeight: 66,
                            border: '1px dashed',
                            borderColor: isTransparent ? 'divider' : 'primary.main',
                            borderRadius: 1.5,
                        }}
                    >
                        <Plus size={20} />
                    </IconButton>
                </Box>
            </Grid>

            <Grid size={{ xs: 12 }}>
                <FormControlLabel
                    control={<Checkbox size="small" checked={isTransparent} onChange={(e) => handleTransparentChange(e.target.checked)} />}
                    label={<Typography variant="body2">{t('inventory.filamentModal.transparentFilament')}</Typography>}
                    sx={{ m: 0 }}
                />
            </Grid>
        </Grid>
    );
}
