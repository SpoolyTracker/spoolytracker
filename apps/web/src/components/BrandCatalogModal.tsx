
import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Grid,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Alert,
    Box,
    Chip,
    Checkbox,
    ListItemText
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { Brand, FilamentType } from '../api';

interface BrandCatalogModalProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (data: any) => void;
    brands: Brand[];
    materials: any[];
    types: FilamentType[];
    isGlobal: boolean; // NEW PROP - Scope is determined by parent
}

export default function BrandCatalogModal({
    open,
    onClose,
    onSubmit,
    brands,
    materials,
    types,
    isGlobal
}: BrandCatalogModalProps) {
    const { t } = useTranslation();
    const [formData, setFormData] = useState({
        brandId: '',
        materialIds: [] as number[],
        typeIds: [] as number[]
    });

    useEffect(() => {
        if (open) {
            setFormData({ brandId: '', materialIds: [], typeIds: [] });
        }
    }, [open]);

    const handleSubmit = () => {
        if (!formData.brandId || formData.materialIds.length === 0 || formData.typeIds.length === 0) return;
        onSubmit({
            brandId: Number(formData.brandId),
            materialIds: formData.materialIds,
            typeIds: formData.typeIds,
            isGlobal: isGlobal
        });
        onClose();
    };

    const isFormValid = formData.brandId && formData.materialIds.length > 0 && formData.typeIds.length > 0;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>{isGlobal ? t('referenceData.addGlobalCatalogEntry') : t('referenceData.addCatalogEntry')}</DialogTitle>
            <DialogContent>
                <Alert severity="info" sx={{ mb: 2 }}>
                    {t('referenceData.catalogCombinationHelp')}
                </Alert>
                <Grid container spacing={2} sx={{ mt: 1 }}>
                    <Grid size={{ xs: 12 }}>
                        <FormControl fullWidth size="small">
                            <InputLabel>{t('referenceData.brand')}</InputLabel>
                            <Select
                                value={formData.brandId}
                                label={t('referenceData.brand')}
                                onChange={(e) => setFormData({ ...formData, brandId: e.target.value })}
                            >
                                {brands.map((brand) => (
                                    <MenuItem key={brand.id} value={brand.id}>{brand.name}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                        <FormControl fullWidth size="small">
                            <InputLabel>{t('referenceData.materialsMulti')}</InputLabel>
                            <Select
                                multiple
                                value={formData.materialIds}
                                label={t('referenceData.materialsMulti')}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setFormData({ ...formData, materialIds: typeof val === 'string' ? val.split(',').map(Number) : val as number[] })
                                }}
                                renderValue={(selected) => (
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                        {selected.map((value) => {
                                            const m = materials.find(mat => mat.id === value);
                                            return <Chip key={value} label={m ? m.name : value} size="small" />;
                                        })}
                                    </Box>
                                )}
                            >
                                {materials.map((m) => (
                                    <MenuItem key={m.id} value={m.id}>
                                        <Checkbox checked={formData.materialIds.indexOf(m.id) > -1} />
                                        <ListItemText primary={m.name} />
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                        <FormControl fullWidth size="small">
                            <InputLabel>{t('referenceData.typesMulti')}</InputLabel>
                            <Select
                                multiple
                                value={formData.typeIds}
                                label={t('referenceData.typesMulti')}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setFormData({ ...formData, typeIds: typeof val === 'string' ? val.split(',').map(Number) : val as number[] })
                                }}
                                renderValue={(selected) => (
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                        {selected.map((value) => {
                                            const t = types.find(typ => typ.id === value);
                                            return <Chip key={value} label={t ? t.name : value} size="small" />;
                                        })}
                                    </Box>
                                )}
                            >
                                {types.map((t) => (
                                    <MenuItem key={t.id} value={t.id}>
                                        <Checkbox checked={formData.typeIds.indexOf(t.id) > -1} />
                                        <ListItemText primary={t.name} />
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                </Grid>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{t('common.cancel')}</Button>
                <Button
                    onClick={handleSubmit}
                    variant="contained"
                    disabled={!isFormValid}
                >
                    {isGlobal ? t('referenceData.addGlobalEntry') : t('referenceData.addEntry')}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
