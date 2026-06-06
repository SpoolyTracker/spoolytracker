import { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Organization } from './types';

interface AdminDeleteDialogProps {
    open: boolean;
    type: 'user' | 'organization';
    item: any;
    organizations: Organization[];
    onClose: () => void;
    onConfirm: (transferToOrgId: number | null) => Promise<void>;
}

export default function AdminDeleteDialog({ open, type, item, organizations, onClose, onConfirm }: AdminDeleteDialogProps) {
    const { t } = useTranslation();
    const [transferToOrgId, setTransferToOrgId] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);

    const handleConfirm = async () => {
        setLoading(true);
        try {
            await onConfirm(transferToOrgId);
            onClose();
        } catch (error) {
            console.error('Delete failed:', error);
            alert('Delete failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle fontWeight="bold">
                {type === 'user' ? t('admin.deleteUser') || 'Delete User' : t('admin.deleteOrganization') || 'Delete Organization'}
            </DialogTitle>
            <DialogContent>
                <DialogContentText sx={{ mb: 3 }}>
                    {type === 'user'
                        ? `Delete user "${item?.username}"? This will also delete all organizations they own.`
                        : `Delete organization "${item?.name}"? This will delete all associated data.`
                    }
                </DialogContentText>

                <FormControl fullWidth size="small">
                    <InputLabel id="transfer-label">Transfer inventory to another organization (optional)</InputLabel>
                    <Select
                        labelId="transfer-label"
                        value={transferToOrgId || ''}
                        label="Transfer inventory to another organization (optional)"
                        onChange={(e) => setTransferToOrgId(e.target.value ? Number(e.target.value) : null)}
                    >
                        <MenuItem value=""><em>-- Delete all data --</em></MenuItem>
                        {organizations
                            .filter(org => org.id !== item?.id)
                            .map(org => (
                                <MenuItem key={org.id} value={org.id}>{org.name}</MenuItem>
                            ))
                        }
                    </Select>
                </FormControl>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={onClose} disabled={loading} color="inherit">
                    {t('common.cancel') || 'Cancel'}
                </Button>
                <Button 
                    onClick={handleConfirm} 
                    color="error" 
                    variant="contained" 
                    disabled={loading}
                    disableElevation
                >
                    {loading ? 'Deleting...' : (t('common.delete') || 'Delete')}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
