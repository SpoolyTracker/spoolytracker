import { Box, Button, Chip, Divider, FormControl, Grid, InputLabel, MenuItem, Select, TextField, Typography } from '@mui/material';
import { FilamentOptionCategory } from '../../api';
import type { FilamentOption } from '../../api';
import type { CustomOptionCategory, FilamentFormData } from './types';

interface Props {
    t: any;
    formData: FilamentFormData;
    options: Record<string, FilamentOption[]>;
    customOption: string;
    setCustomOption: (value: string) => void;
    customOptionCategory: CustomOptionCategory;
    setCustomOptionCategory: (value: CustomOptionCategory) => void;
    isAddingCustomOption: boolean;
    setIsAddingCustomOption: (value: boolean) => void;
    toggleOption: (id: number) => void;
}

export function FilamentOptionsSection({
    t,
    formData,
    options,
    customOption,
    setCustomOption,
    customOptionCategory,
    setCustomOptionCategory,
    isAddingCustomOption,
    setIsAddingCustomOption,
    toggleOption,
}: Props) {
    return (
        <Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                {Object.values(options).flat()
                    .filter(opt => !opt.isCharacteristic)
                    .map(opt => (
                        <Chip
                            key={opt.id}
                            label={opt.name}
                            onClick={() => toggleOption(opt.id)}
                            color={formData.selectedOptions.includes(opt.id) ? 'primary' : 'default'}
                            variant={formData.selectedOptions.includes(opt.id) ? 'filled' : 'outlined'}
                            clickable
                        />
                    ))}
            </Box>

            {!isAddingCustomOption ? (
                <Button size="small" variant="outlined" onClick={() => setIsAddingCustomOption(true)}>
                    {t('inventory.addCustomOption')}
                </Button>
            ) : (
                <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="caption" gutterBottom display="block">{t('inventory.addCustomOption')}</Typography>
                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <TextField
                                fullWidth
                                size="small"
                                label={t('inventory.optionName')}
                                placeholder={t('inventory.optionPlaceholder')}
                                value={customOption}
                                onChange={(e) => setCustomOption(e.target.value)}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <FormControl fullWidth size="small">
                                <InputLabel>{t('referenceData.category')}</InputLabel>
                                <Select
                                    value={customOptionCategory}
                                    label={t('referenceData.category')}
                                    onChange={(e) => setCustomOptionCategory(e.target.value)}
                                >
                                    {Array.from(new Set([...Object.values(FilamentOptionCategory), ...Object.keys(options)])).map(cat => (
                                        <MenuItem key={cat} value={cat}>
                                            {cat.charAt(0).toUpperCase() + cat.slice(1)}
                                        </MenuItem>
                                    ))}
                                    <Divider />
                                    <MenuItem value="custom">{t('inventory.addNewCharacteristic')}</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid size={{ xs: 12 }}>
                            <Button
                                size="small"
                                variant="outlined"
                                onClick={() => {
                                    setIsAddingCustomOption(false);
                                    setCustomOption('');
                                    setCustomOptionCategory(FilamentOptionCategory.FINISH);
                                }}
                            >
                                {t('common.cancel')}
                            </Button>
                        </Grid>
                    </Grid>
                </Box>
            )}
        </Box>
    );
}
