import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Alert,
    MenuItem,
    Select,
    InputLabel,
    FormControl
} from '@mui/material';

interface OrganizationModalProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (data: any) => Promise<void>;
    initialData?: any;
    users?: any[];
}


export default function OrganizationModal({ open, onClose, onSubmit, initialData, users = [] }: OrganizationModalProps) {
    const { t } = useTranslation();
    const [formData, setFormData] = useState({
        name: '',
        slug: '',
        plan: 'free',
        manualPlanEndDate: '',
        ownerId: ''
    });

    const [error, setError] = useState('');

    useEffect(() => {
        if (open && initialData) {
            // Format ISO datetime string to YYYY-MM-DD for the date input
            const formattedDate = initialData.manualPlanEndDate 
                ? new Date(initialData.manualPlanEndDate).toISOString().split('T')[0] 
                : '';

            setFormData({
                name: initialData.name || '',
                slug: initialData.slug || '',
                plan: initialData.plan || 'free',
                manualPlanEndDate: formattedDate,
                ownerId: ''
            });
        } else {
            setFormData({
                name: '',
                slug: '',
                plan: 'free',
                manualPlanEndDate: '',
                ownerId: ''
            });
        }

        setError('');
    }, [open, initialData]);

    const handleSubmit = async () => {
        try {
            await onSubmit(formData);
            onClose();
        } catch (err) {
            setError('Failed to save organization');
            console.error(err);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>{initialData ? t('admin.editOrg') : t('admin.addOrg')}</DialogTitle>
            <DialogContent>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                <TextField
                    fullWidth
                    label={t('common.name')}
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    sx={{ mt: 2, mb: 2 }}
                />
                <TextField
                    fullWidth
                    label="Slug"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    helperText="Unique identifier used in URLs"
                    sx={{ mb: 2 }}
                />

                {!initialData && (
                    <FormControl fullWidth sx={{ mb: 2 }}>
                        <InputLabel>Owner (Optional)</InputLabel>
                        <Select
                            value={formData.ownerId}
                            label="Owner (Optional)"
                            onChange={(e) => setFormData({ ...formData, ownerId: e.target.value })}
                        >
                            <MenuItem value=""><em>None</em></MenuItem>
                            {users.map((u) => (
                                <MenuItem key={u.id} value={u.id}>
                                    {u.username} ({u.email})
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                )}

                
                {initialData && (
                    <>
                        <FormControl fullWidth sx={{ mb: 2, mt: 1 }}>
                            <InputLabel>{t('common.plan')}</InputLabel>
                            <Select
                                value={formData.plan}
                                label={t('common.plan')}
                                onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
                            >
                                <MenuItem value="free">Free</MenuItem>
                                <MenuItem value="pro">Pro</MenuItem>
                                <MenuItem value="beta">Beta</MenuItem>
                                <MenuItem value="enterprise">Enterprise</MenuItem>
                            </Select>
                        </FormControl>

                        <TextField
                            fullWidth
                            type="date"
                            label={t('admin.manualPlanEndDate')}
                            InputLabelProps={{ shrink: true }}
                            value={formData.manualPlanEndDate}
                            onChange={(e) => setFormData({ ...formData, manualPlanEndDate: e.target.value })}
                            helperText={t('admin.manualPlanEndDateDesc')}
                            sx={{ mb: 2 }}
                        />
                    </>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{t('common.cancel')}</Button>
                <Button variant="contained" onClick={handleSubmit}>{t('common.save')}</Button>
            </DialogActions>
        </Dialog>
    );
}
