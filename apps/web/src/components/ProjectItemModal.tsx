
import { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, TextField, Autocomplete, Box, Typography,
    InputAdornment, FormControlLabel, Checkbox
} from '@mui/material';
import { api } from '../api';
import type { Filament, ProjectItem } from '../api';
import { useTranslation } from 'react-i18next';
import { getFilamentTitle } from '../utils/filament-utils';
import { normalizeNumericInput } from '../utils/number-utils';

interface ProjectItemModalProps {
    open: boolean;
    onClose: () => void;
    projectId: number;
    onSuccess: () => void;
    item?: ProjectItem | null;
}

export default function ProjectItemModal({ open, onClose, projectId, onSuccess, item }: ProjectItemModalProps) {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [filaments, setFilaments] = useState<Filament[]>([]);
    const [selectedFilament, setSelectedFilament] = useState<Filament | null>(null);
    const [weight, setWeight] = useState<number | string>(0);
    const [createPlannedConsumption, setCreatePlannedConsumption] = useState(true);
    const isEditing = Boolean(item);

    useEffect(() => {
        if (open) {
            loadFilaments();
            setWeight(item?.weight_required_g || 0);
            setSelectedFilament(item?.filament || null);
            setCreatePlannedConsumption(!item);
        }
    }, [open, item]);

    const loadFilaments = async () => {
        try {
            const data = await api.getAll();
            setFilaments(data);
        } catch (error) {
            console.error(error);
        }
    };

    const handleSubmit = async () => {
        if (!selectedFilament || Number(weight) <= 0) return;

        try {
            setLoading(true);
            if (item) {
                await api.updateProjectItem(projectId, item.id, {
                    filamentId: selectedFilament.id,
                    weight_required_g: Number(weight)
                });
            } else {
                await api.addProjectItem(projectId, {
                    filamentId: selectedFilament.id,
                    weight_required_g: Number(weight)
                });

                if (createPlannedConsumption) {
                    await api.addProjectConsumption(projectId, {
                        filamentId: selectedFilament.id,
                        amount: Number(weight),
                        type: 'PRINT',
                        isPlanned: true,
                        notes: t('projects.bomPlannedConsumptionNote', 'Planned from project BOM')
                    });
                }
            }
            onSuccess();
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>{isEditing ? t('projects.editMaterial', 'Edit Material') : t('projects.addMaterial', 'Add Material')}</DialogTitle>
            <DialogContent>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
                    <Autocomplete
                        options={filaments}
                        getOptionLabel={(option) => {
                            const title = getFilamentTitle(option);
                            return `${title} (${option.weightRemaining}g left)`;
                        }}
                        value={selectedFilament}
                        onChange={(_, newValue) => setSelectedFilament(newValue)}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label={t('inventory.filament')}
                                placeholder="Select a filament..."
                            />
                        )}
                        renderOption={(props, option) => (
                            <li {...props}>
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <Box
                                        component="span"
                                        sx={{
                                            width: 16,
                                            height: 16,
                                            borderRadius: '50%',
                                            bgcolor: option.color || '#ccc',
                                            border: '1px solid #ddd',
                                            mr: 2,
                                            flexShrink: 0
                                        }}
                                    />
                                    <Box>
                                        <Typography variant="body1">{getFilamentTitle(option)}</Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {option.brand?.name} - {option.weightRemaining}g available
                                        </Typography>
                                    </Box>
                                </Box>
                            </li>
                        )}
                    />

                    <TextField
                        label={t('inventory.weight')}
                        type="text"
                        value={weight || ''}
                        onChange={(e) => setWeight(normalizeNumericInput(e.target.value))}
                        InputProps={{
                            endAdornment: <InputAdornment position="end">g</InputAdornment>,
                        }}
                        helperText={selectedFilament ? `Est. Cost: ${((Number(weight) / selectedFilament.weightInitial) * (selectedFilament.price || 0)).toFixed(2)}€` : ''}
                    />
                    {!isEditing && (
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={createPlannedConsumption}
                                    onChange={(e) => setCreatePlannedConsumption(e.target.checked)}
                                />
                            }
                            label={
                                <Box>
                                    <Typography variant="body2">{t('projects.createPlannedConsumption', 'Add as planned consumption')}</Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {t('projects.createPlannedConsumptionHint', 'Reserves this quantity without deducting real stock yet.')}
                                    </Typography>
                                </Box>
                            }
                        />
                    )}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="inherit">{t('common.cancel')}</Button>
                <Button
                    onClick={handleSubmit}
                    variant="contained"
                    disabled={!selectedFilament || Number(weight) <= 0 || loading}
                >
                    {isEditing ? t('common.save') : t('common.add')}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
