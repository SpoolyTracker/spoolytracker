import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Grid,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Alert,
    FormControlLabel,
    Checkbox
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { FilamentOptionCategory } from '../api';

interface RefDataModalProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (data: any) => Promise<void>;
    type: 'brand' | 'type' | 'option' | 'material';
    initialData?: any;
}

export default function RefDataModal({ open, onClose, onSubmit, type, initialData }: RefDataModalProps) {
    const { t } = useTranslation();
    const [formData, setFormData] = useState<any>({ name: '', category: FilamentOptionCategory.FINISH, description: '' });
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name || '',
                category: initialData.category || FilamentOptionCategory.FINISH,
                description: initialData.description || '',
                isCharacteristic: initialData.isCharacteristic || false
            });
        } else {
            setFormData({ name: '', category: FilamentOptionCategory.FINISH, description: '', isCharacteristic: false });
        }
        setError(null);
    }, [initialData, open]);

    const handleSave = async () => {
        if (!formData.name) {
            setError('Name is required');
            return;
        }

        setIsSaving(true);
        setError(null);
        try {
            await onSubmit(formData);
            onClose();
        } catch (e: any) {
            setError(e.message || 'Failed to save');
        } finally {
            setIsSaving(false);
        }
    };

    const getTitle = () => {
        const action = initialData ? 'Edit' : 'Add';
        const item = type.charAt(0).toUpperCase() + type.slice(1);
        return `${action} ${item}`;
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>{getTitle()}</DialogTitle>
            <DialogContent>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                <Grid container spacing={2} sx={{ mt: 1 }}>
                    <Grid size={{ xs: 12 }}>
                        <TextField
                            fullWidth
                            label={t('common.name')}
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            autoFocus
                        />
                    </Grid>
                    {type === 'option' && (
                        <>
                            <Grid size={{ xs: 12 }}>
                                <FormControl fullWidth>
                                    <InputLabel>Category</InputLabel>
                                    <Select
                                        value={formData.category}
                                        label="Category"
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    >
                                        {Object.values(FilamentOptionCategory).map(cat => (
                                            <MenuItem key={cat} value={cat}>
                                                {cat.charAt(0).toUpperCase() + cat.slice(1)}
                                            </MenuItem>
                                        ))}
                                        <MenuItem value="custom">Custom</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid size={{ xs: 12 }}>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={formData.isCharacteristic}
                                            onChange={(e) => setFormData({ ...formData, isCharacteristic: e.target.checked })}
                                        />
                                    }
                                    label="Is Characteristic? (Visible in Title)"
                                />
                            </Grid>
                            <Grid size={{ xs: 12 }}>
                                <TextField
                                    fullWidth
                                    multiline
                                    rows={3}
                                    label={t('common.description')}
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                />
                            </Grid>
                        </>
                    )}
                    {(type === 'type' || type === 'material') && (
                        <Grid size={{ xs: 12 }}>
                            <TextField
                                fullWidth
                                multiline
                                rows={3}
                                label={t('common.description')}
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            />
                        </Grid>
                    )}
                </Grid>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={isSaving}>Cancel</Button>
                <Button onClick={handleSave} variant="contained" disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
