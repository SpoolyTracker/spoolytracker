import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Typography,
    Alert,
    Box
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { api } from '../api';

interface MergeReferenceDataModalProps {
    open: boolean;
    onClose: () => void;
    sourceItem: any;
    type: 'brand' | 'material' | 'type';
    onSuccess: () => void;
}

export default function MergeReferenceDataModal({ open, onClose, sourceItem, type, onSuccess }: MergeReferenceDataModalProps) {
    const { t } = useTranslation();
    const [targets, setTargets] = useState<any[]>([]);
    const [selectedTarget, setSelectedTarget] = useState<number | ''>('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open && sourceItem) {
            fetchTargets();
        }
    }, [open, sourceItem]);

    const fetchTargets = async () => {
        try {
            setLoading(true);
            setError(null);
            // let data: any[] = [];

            // We want global items of the same type
            // Re-using admin fetch or just filtered list? 
            // Since we need to pick from existing Reference Data, we can use the main fetch APIs in api.ts 
            // but we need ensure we get ALL global items.
            // For now, let's assume we can fetch them via the standard endpoints and filter for global.
            // Ideally we should have a specific endpoint or use existing ones with scope filter.

            let res;
            if (type === 'brand') res = await api.getBrands();
            else if (type === 'material') res = await api.getMaterials();
            else if (type === 'type') res = await api.getTypes();

            if (res) {
                // Filter for Global (no orgId) and exclude sourceId
                const globals = res.filter((item: any) => !item.organizationId && item.id !== sourceItem.id);
                setTargets(globals);
            }
        } catch (err) {
            console.error(err);
            setError("Failed to load targets");
        } finally {
            setLoading(false);
        }
    };

    const handleMerge = async () => {
        if (!selectedTarget) return;
        try {
            setLoading(true);
            await api.mergeReferenceData(type, sourceItem.id, Number(selectedTarget));
            onSuccess();
            onClose();
        } catch (err) {
            console.error(err);
            setError("Merge failed");
            setLoading(false);
        }
    };

    if (!sourceItem) return null;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>{t('referenceData.merge') || "Merge into Global"}</DialogTitle>
            <DialogContent>
                <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" gutterBottom>
                        {t('referenceData.mergeConfirm') || `Merging "${sourceItem.name}" into a global entry will update all filaments using it and delete the local entry.`}
                    </Typography>

                    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                    <FormControl fullWidth sx={{ mt: 2 }}>
                        <InputLabel>{t('referenceData.targetGlobal') || "Target Global Entry"}</InputLabel>
                        <Select
                            value={selectedTarget}
                            label={t('referenceData.targetGlobal') || "Target Global Entry"}
                            onChange={(e) => setSelectedTarget(e.target.value as number)}
                        >
                            {targets.map((target) => (
                                <MenuItem key={target.id} value={target.id}>
                                    {target.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{t('referenceData.cancel')}</Button>
                <Button
                    onClick={handleMerge}
                    variant="contained"
                    color="warning"
                    disabled={!selectedTarget || loading}
                >
                    {t('referenceData.merge') || "Merge"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
