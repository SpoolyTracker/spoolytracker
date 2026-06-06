import { FormControl, FormHelperText, Grid, InputLabel, MenuItem, Select } from '@mui/material';
import type { Organization } from '../../api';
import type { FilamentFormData, SetFilamentFormData } from './types';

interface Props {
    t: any;
    formData: FilamentFormData;
    setFormData: SetFilamentFormData;
    organizations: Organization[];
}

export function FilamentAdvancedSection({ t, formData, setFormData, organizations }: Props) {
    return (
        <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
                <FormControl fullWidth>
                    <InputLabel id="org-select-label">{t('common.organization') || 'Organization'}</InputLabel>
                    <Select
                        labelId="org-select-label"
                        value={formData.organizationId}
                        label={t('common.organization') || 'Organization'}
                        onChange={(e) => setFormData(prev => ({ ...prev, organizationId: e.target.value }))}
                        disabled={!!localStorage.getItem('emulated_organization_id')}
                    >
                        {organizations.map(org => (
                            <MenuItem key={org.id} value={org.id}>{org.name}</MenuItem>
                        ))}
                    </Select>
                    <FormHelperText>Select which organization owns this filament</FormHelperText>
                </FormControl>
            </Grid>
        </Grid>
    );
}
