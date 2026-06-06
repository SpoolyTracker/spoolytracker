import { Grid, TextField } from '@mui/material';
import { normalizeNumericInput } from '../../utils/number-utils';
import type { FilamentFormData, SetFilamentFormData } from './types';

interface Props {
    t: any;
    formData: FilamentFormData;
    setFormData: SetFilamentFormData;
}

export function FilamentPurchaseSection({ t, formData, setFormData }: Props) {
    return (
        <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                    fullWidth
                    label={t('inventory.purchaseDate')}
                    type="date"
                    InputLabelProps={{ shrink: true }}
                    value={formData.purchaseDate}
                    onChange={(e) => setFormData(p => ({ ...p, purchaseDate: e.target.value }))}
                />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                    fullWidth
                    label="Price (EUR)"
                    type="text"
                    value={formData.price}
                    onChange={(e) => setFormData(p => ({ ...p, price: normalizeNumericInput(e.target.value) }))}
                />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                    fullWidth
                    label="Vendor"
                    value={formData.vendor}
                    onChange={(e) => setFormData(p => ({ ...p, vendor: e.target.value }))}
                />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                    fullWidth
                    label="Spool Reference / QR Code"
                    value={formData.spoolReference}
                    onChange={(e) => setFormData(p => ({ ...p, spoolReference: e.target.value }))}
                />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                    fullWidth
                    label="NFC Tag ID"
                    value={formData.nfcTagId}
                    slotProps={{ input: { readOnly: true } }}
                    disabled={!formData.nfcTagId}
                    placeholder="Scan a tag to populate"
                />
            </Grid>
        </Grid>
    );
}
