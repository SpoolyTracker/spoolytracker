
import React from 'react';
import {
    Box,
    Drawer,
    Typography,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    FormControlLabel,
    Switch,
    Slider,
    Chip,
    IconButton,
    Divider,
    Button
} from '@mui/material';
import { X, RotateCcw } from 'lucide-react';
import type { Brand, FilamentType, FilamentMaterial } from '../api';
import { useTranslation } from 'react-i18next';

interface InventoryFiltersProps {
    open: boolean;
    onClose: () => void;
    brands: Brand[];
    materials: FilamentMaterial[];
    types: FilamentType[];
    filters: FilterState;
    onFilterChange: (filters: FilterState) => void;
    onReset: () => void;
}

export interface FilterState {
    search: string;
    brandIds: number[];
    materialIds: number[];
    typeIds: number[];
    minWeight: number;
    lowStock: boolean;
    favoriteOnly: boolean;
    color?: string;
    isAvailable?: boolean;
}

export const InventoryFilters: React.FC<InventoryFiltersProps> = ({
    open,
    onClose,
    brands,
    materials,
    types,
    filters,
    onFilterChange,
    onReset,
}) => {
    const { t } = useTranslation();

    const handleChange = (field: keyof FilterState, value: any) => {
        onFilterChange({
            ...filters,
            [field]: value,
        });
    };

    const handleBrandChange = (event: any) => {
        const { value } = event.target;
        // On autofill we get a stringified value.
        const newValues = typeof value === 'string' ? value.split(',') : value;
        handleChange('brandIds', newValues);
    };

    const handleMaterialChange = (event: any) => {
        const { value } = event.target;
        const newValues = typeof value === 'string' ? value.split(',') : value;
        handleChange('materialIds', newValues);
    }

    const handleTypeChange = (event: any) => {
        const { value } = event.target;
        const newValues = typeof value === 'string' ? value.split(',') : value;
        handleChange('typeIds', newValues);
    }

    return (
        <Drawer
            anchor="right"
            open={open}
            onClose={onClose}
            variant="temporary"
            PaperProps={{
                sx: { width: 320, p: 3, display: 'flex', flexDirection: 'column', gap: 3 }
            }}
        >
            <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="h6" fontWeight="bold">
                    {t('common.filters', 'Filtres')}
                </Typography>
                <IconButton onClick={onClose}>
                    <X size={20} />
                </IconButton>
            </Box>

            <TextField
                label={t('common.searchFilaments', 'Rechercher filaments...')}
                variant="outlined"
                size="small"
                fullWidth
                value={filters.search}
                onChange={(e) => {
                    let value = e.target.value;
                    // Strip scheme prefix injected by barcode scanners (e.g. spooly://, spoolydev://)
                    value = value.replace(/^[a-z]+:\/\/(filament\/)?/i, '');
                    handleChange('search', value);
                }}
                placeholder={t('common.searchPlaceholder', 'Nom, couleur...')}
            />

            <Divider />

            <FormControl size="small" fullWidth>
                <InputLabel>{t('filament.brand', 'Marque')}</InputLabel>
                <Select
                    multiple
                    value={filters.brandIds}
                    onChange={handleBrandChange}
                    label={t('filament.brand', 'Marque')}
                    renderValue={(selected) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {(selected as number[]).map((value) => {
                                const brand = brands.find(b => b.id === value);
                                return <Chip key={value} label={brand?.name || value} size="small" />;
                            })}
                        </Box>
                    )}
                >
                    {brands.map((brand) => (
                        <MenuItem key={brand.id} value={brand.id}>
                            {brand.name}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>

            <FormControl size="small" fullWidth>
                <InputLabel>{t('filament.material', 'Matériau')} (PLA, PETG...)</InputLabel>
                <Select
                    multiple
                    value={filters.materialIds}
                    onChange={handleMaterialChange}
                    label={`${t('filament.material', 'Matériau')} (PLA, PETG...)`}
                    renderValue={(selected) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {(selected as number[]).map((value) => {
                                const material = materials.find(m => m.id === value);
                                return <Chip key={value} label={material?.name || value} size="small" />;
                            })}
                        </Box>
                    )}
                >
                    {materials.map((material) => (
                        <MenuItem key={material.id} value={material.id}>
                            {material.name}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>

            <FormControl size="small" fullWidth>
                <InputLabel>{t('filament.type', 'Type')} (Matte, Silk...)</InputLabel>
                <Select
                    multiple
                    value={filters.typeIds}
                    onChange={handleTypeChange}
                    label={`${t('filament.type', 'Type')} (Matte, Silk...)`}
                    renderValue={(selected) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {(selected as number[]).map((value) => {
                                const type = types.find(t => t.id === value);
                                return <Chip key={value} label={type?.name || value} size="small" />;
                            })}
                        </Box>
                    )}
                >
                    {types.map((type) => (
                        <MenuItem key={type.id} value={type.id}>
                            {type.name}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>

            <Box>
                <Typography gutterBottom variant="caption" color="text.secondary">
                    {t('inventory.minWeight', 'Poids restant minimum (g)')}
                </Typography>
                <Slider
                    value={filters.minWeight}
                    onChange={(_, value) => handleChange('minWeight', value)}
                    valueLabelDisplay="auto"
                    min={0}
                    max={1000}
                    step={50}
                />
            </Box>

            <FormControlLabel
                control={
                    <Switch
                        checked={filters.lowStock}
                        onChange={(e) => handleChange('lowStock', e.target.checked)}
                    />
                }
                label={t('inventory.lowStockOnly', 'Stock faible uniquement')}
            />

            <FormControlLabel
                control={
                    <Switch
                        checked={filters.favoriteOnly}
                        onChange={(e) => handleChange('favoriteOnly', e.target.checked)}
                    />
                }
                label={t('inventory.favoriteOnly', 'Favoris uniquement')}
            />

            <Box mt="auto">
                <Button
                    variant="outlined"
                    startIcon={<RotateCcw size={16} />}
                    fullWidth
                    onClick={onReset}
                >
                    {t('common.resetFilters', 'Réinitialiser les filtres')}
                </Button>
            </Box>
        </Drawer>
    );
};
