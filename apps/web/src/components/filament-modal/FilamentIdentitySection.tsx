import {
    Autocomplete,
    Box,
    Button,
    Checkbox,
    Chip,
    FormControl,
    FormControlLabel,
    FormHelperText,
    Grid,
    IconButton,
    InputAdornment,
    InputLabel,
    MenuItem,
    Select,
    Switch,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import type React from 'react';
import { Building2, Globe, Info, Plus, Trash2, X } from 'lucide-react';
import type { Brand, BrandCatalogEntry, FilamentMaterial, FilamentType } from '../../api';
import { api } from '../../api';
import type { FilamentFormData, SetFilamentFormData } from './types';

interface Props {
    t: any;
    formData: FilamentFormData;
    setFormData: SetFilamentFormData;
    brandOptions: Brand[];
    materialOptions: FilamentMaterial[];
    typeOptions: FilamentType[];
    catalogOptions: BrandCatalogEntry[];
    selectedCatalogEntryId: number | string;
    smartSelectionEnabled: boolean;
    setSmartSelectionEnabled: (value: boolean) => void;
    isCustomBrand: boolean;
    setIsCustomBrand: (value: boolean) => void;
    customBrand: string;
    setCustomBrand: (value: string) => void;
    isCustomMaterial: boolean;
    setIsCustomMaterial: (value: boolean) => void;
    customMaterial: string;
    setCustomMaterial: (value: string) => void;
    isCustomType: boolean;
    setIsCustomType: (value: boolean) => void;
    customType: string;
    setCustomType: (value: string) => void;
    setAddedTypes: React.Dispatch<React.SetStateAction<FilamentType[]>>;
    setLoading: (value: boolean) => void;
    handleCatalogSelection: (entryId: number) => void;
    handleDeleteBrand: (e: React.MouseEvent, id: number) => void;
    handleDeleteMaterial: (e: React.MouseEvent, id: number) => void;
    handleDeleteType: (e: React.MouseEvent, id: number) => void;
}

export function FilamentIdentitySection({
    t,
    formData,
    setFormData,
    brandOptions,
    materialOptions,
    typeOptions,
    catalogOptions,
    selectedCatalogEntryId,
    smartSelectionEnabled,
    setSmartSelectionEnabled,
    isCustomBrand,
    setIsCustomBrand,
    customBrand,
    setCustomBrand,
    isCustomMaterial,
    setIsCustomMaterial,
    customMaterial,
    setCustomMaterial,
    isCustomType,
    setIsCustomType,
    customType,
    setCustomType,
    setAddedTypes,
    setLoading,
    handleCatalogSelection,
    handleDeleteBrand,
    handleDeleteMaterial,
    handleDeleteType,
}: Props) {
    return (
        <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
                <Autocomplete
                    options={[...brandOptions, { id: 'custom', name: t('inventory.addCustomBrand') } as any]}
                    getOptionLabel={(option) => typeof option === 'string' ? option : option.name}
                    value={brandOptions.find(b => b.id === formData.brandId) || null}
                    onChange={(_, newValue) => {
                        if (newValue && typeof newValue !== 'string' && 'id' in newValue && newValue.id === 'custom') {
                            setIsCustomBrand(true);
                            setFormData(prev => ({ ...prev, brandId: '' }));
                        } else if (newValue && typeof newValue !== 'string') {
                            setIsCustomBrand(false);
                            setFormData(prev => ({ ...prev, brandId: (newValue as Brand).id }));
                        } else {
                            setFormData(prev => ({ ...prev, brandId: '' }));
                        }
                    }}
                    renderInput={(params) => <TextField {...params} label={t('inventory.brand')} required={!isCustomBrand} />}
                    renderOption={(props, option) => {
                        const { key, ...otherProps } = props;
                        if (option.id === 'custom') {
                            return <li key={key} {...otherProps}><Plus size={16} style={{ marginRight: 8 }} /> {option.name}</li>;
                        }
                        const isCustom = !!(option as any).organizationId;
                        return (
                            <li key={key} {...otherProps} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <span>{option.name}</span>
                                    {isCustom ? (
                                        <Chip size="small" icon={<Building2 size={10} />} label={t('referenceData.custom')} variant="outlined" sx={{ height: 20, fontSize: 10 }} color="primary" />
                                    ) : (
                                        <Chip size="small" icon={<Globe size={10} />} label={t('referenceData.global')} variant="outlined" sx={{ height: 20, fontSize: 10 }} />
                                    )}
                                </Box>
                                {isCustom && (
                                    <Box component="span" onClick={(e) => handleDeleteBrand(e, (option as any).id)} sx={{ cursor: 'pointer', p: 0.5, '&:hover': { color: 'error.main' } }}>
                                        <Trash2 size={14} />
                                    </Box>
                                )}
                            </li>
                        );
                    }}
                    isOptionEqualToValue={(option, value) => String(option.id) === String(value.id)}
                />
                <FormControlLabel
                    control={<Switch checked={smartSelectionEnabled} onChange={(e) => setSmartSelectionEnabled(e.target.checked)} size="small" color="secondary" />}
                    label={(
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">{t('inventory.smartSelection')}</Typography>
                            <Tooltip title={t('inventory.smartSelectionInfo')}>
                                <Info size={14} style={{ cursor: 'pointer', opacity: 0.6 }} />
                            </Tooltip>
                        </Box>
                    )}
                    sx={{ mt: 0.5, ml: 0.5 }}
                />
                {isCustomBrand && (
                    <TextField
                        fullWidth
                        placeholder={t('inventory.enterCustomBrand')}
                        value={customBrand}
                        onChange={(e) => setCustomBrand(e.target.value)}
                        sx={{ mt: 1 }}
                        InputProps={{
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton size="small" onClick={() => {
                                        setCustomBrand('');
                                        setIsCustomBrand(false);
                                        setFormData(prev => ({ ...prev, brandId: '' }));
                                    }}>
                                        <X size={16} />
                                    </IconButton>
                                </InputAdornment>
                            )
                        }}
                    />
                )}
            </Grid>

            {smartSelectionEnabled && catalogOptions.length > 0 ? (
                <Grid size={{ xs: 12, md: 6 }}>
                    <FormControl fullWidth>
                        <InputLabel>{t('inventory.filamentProfile')}</InputLabel>
                        <Select
                            value={selectedCatalogEntryId}
                            label={t('inventory.filamentProfile')}
                            onChange={(e) => handleCatalogSelection(Number(e.target.value))}
                        >
                            {catalogOptions.map((entry) => (
                                <MenuItem key={entry.id} value={entry.id}>
                                    {entry.material?.name} - {entry.type?.name}
                                </MenuItem>
                            ))}
                        </Select>
                        <FormHelperText>{t('inventory.catalogCombinationHint')}</FormHelperText>
                    </FormControl>
                </Grid>
            ) : (
                <>
                    <Grid size={{ xs: 12, md: 3 }}>
                        <Autocomplete
                            options={[...materialOptions, { id: 'custom', name: t('inventory.addCustomMaterial') } as any]}
                            getOptionLabel={(option) => typeof option === 'string' ? option : option.name}
                            value={materialOptions.find(b => b.id === formData.materialId) || null}
                            onChange={(_, newValue) => {
                                if (newValue && typeof newValue !== 'string' && 'id' in newValue && newValue.id === 'custom') {
                                    setIsCustomMaterial(true);
                                    setFormData(prev => ({ ...prev, materialId: '' }));
                                } else if (newValue && typeof newValue !== 'string') {
                                    setIsCustomMaterial(false);
                                    setFormData(prev => ({ ...prev, materialId: (newValue as FilamentMaterial).id }));
                                } else {
                                    setFormData(prev => ({ ...prev, materialId: '' }));
                                }
                            }}
                            renderInput={(params) => <TextField {...params} label={t('inventory.material')} required={!isCustomMaterial} />}
                            renderOption={(props, option) => {
                                const { key, ...otherProps } = props;
                                if (option.id === 'custom') return <li key={key} {...otherProps}><Plus size={16} style={{ marginRight: 8 }} /> {option.name}</li>;
                                const isCustom = !!(option as any).organizationId;
                                return (
                                    <li key={key} {...otherProps} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <span>{option.name}</span>
                                            {isCustom ? <Chip size="small" icon={<Building2 size={10} />} label={t('referenceData.custom')} variant="outlined" sx={{ height: 20, fontSize: 10 }} color="primary" /> : <Chip size="small" icon={<Globe size={10} />} label={t('referenceData.global')} variant="outlined" sx={{ height: 20, fontSize: 10 }} />}
                                        </Box>
                                        {isCustom && <Box component="span" onClick={(e) => handleDeleteMaterial(e, (option as any).id)} sx={{ cursor: 'pointer', p: 0.5, '&:hover': { color: 'error.main' } }}><Trash2 size={14} /></Box>}
                                    </li>
                                );
                            }}
                            isOptionEqualToValue={(option, value) => String(option.id) === String(value.id)}
                        />
                        {isCustomMaterial && (
                            <TextField
                                fullWidth
                                placeholder={t('inventory.enterCustomMaterial')}
                                value={customMaterial}
                                onChange={(e) => setCustomMaterial(e.target.value)}
                                sx={{ mt: 1 }}
                                InputProps={{
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton size="small" onClick={() => {
                                                setCustomMaterial('');
                                                setIsCustomMaterial(false);
                                                setFormData(prev => ({ ...prev, materialId: '' }));
                                            }}>
                                                <X size={16} />
                                            </IconButton>
                                        </InputAdornment>
                                    )
                                }}
                            />
                        )}
                    </Grid>

                    <Grid size={{ xs: 12, md: 3 }}>
                        <Autocomplete
                            multiple
                            disableCloseOnSelect
                            options={[...typeOptions, { id: 'custom', name: t('inventory.addCustomType') } as any]}
                            getOptionLabel={(option) => typeof option === 'string' ? option : option.name}
                            value={typeOptions.filter(t => formData.typeIds.includes(t.id))}
                            onChange={(_, newValue) => {
                                const customSelected = newValue.find((v: any) => v.id === 'custom');
                                if (customSelected) {
                                    setIsCustomType(true);
                                    return;
                                }
                                const ids = newValue.map((v: any) => v.id);
                                setFormData(prev => ({ ...prev, typeIds: ids }));
                            }}
                            renderInput={(params) => <TextField {...params} label={t('inventory.type')} />}
                            renderOption={(props, option, { selected }) => {
                                const { key, ...otherProps } = props;
                                if (option.id === 'custom') return <li key={key} {...otherProps}><Plus size={16} style={{ marginRight: 8 }} />{option.name}</li>;
                                const isCustom = !!(option as any).organizationId;
                                return (
                                    <li key={key} {...otherProps} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                                            <Checkbox
                                                icon={<Box sx={{ width: 20, height: 20, border: '1px solid #ccc', borderRadius: '4px' }} />}
                                                checkedIcon={<Box sx={{ width: 20, height: 20, bgcolor: 'primary.main', borderRadius: '4px' }} />}
                                                style={{ marginRight: 8 }}
                                                checked={selected}
                                            />
                                            <span>{option.name}</span>
                                            <Box sx={{ ml: 1 }}>
                                                {isCustom ? <Chip size="small" icon={<Building2 size={10} />} label={t('referenceData.custom')} variant="outlined" sx={{ height: 20, fontSize: 10 }} color="primary" /> : <Chip size="small" icon={<Globe size={10} />} label={t('referenceData.global')} variant="outlined" sx={{ height: 20, fontSize: 10 }} />}
                                            </Box>
                                        </Box>
                                        {isCustom && <Box component="span" onClick={(e) => handleDeleteType(e, (option as any).id)} sx={{ cursor: 'pointer', p: 0.5, '&:hover': { color: 'error.main' } }}><Trash2 size={14} /></Box>}
                                    </li>
                                );
                            }}
                            isOptionEqualToValue={(option, value) => String(option.id) === String(value.id)}
                        />
                    </Grid>
                </>
            )}

            {isCustomType && (
                <Grid size={{ xs: 12 }}>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <TextField fullWidth placeholder={t('inventory.enterCustomType')} value={customType} onChange={(e) => setCustomType(e.target.value)} size="small" />
                        <Button
                            variant="contained"
                            onClick={async () => {
                                if (!customType) return;
                                setLoading(true);
                                try {
                                    const orgId = formData.organizationId ? Number(formData.organizationId) : undefined;
                                    const newType = await api.createType(customType, false, orgId);
                                    setAddedTypes(prev => [...prev, newType]);
                                    setFormData(prev => ({ ...prev, typeIds: [...prev.typeIds, newType.id] }));
                                    setCustomType('');
                                    setIsCustomType(false);
                                } catch (e) {
                                    console.error(e);
                                }
                                setLoading(false);
                            }}
                        >
                            {t('common.add')}
                        </Button>
                        <Button onClick={() => setIsCustomType(false)}>{t('common.cancel')}</Button>
                    </Box>
                </Grid>
            )}
        </Grid>
    );
}
