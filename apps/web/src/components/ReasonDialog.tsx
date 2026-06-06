import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Typography,
    Box,
    Alert
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { ShieldAlert } from 'lucide-react';

interface ReasonDialogProps {
    open: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => void;
    title?: string;
    description?: string;
    actionLabel?: string;
    required?: boolean;
}

const ReasonDialog: React.FC<ReasonDialogProps> = ({
    open,
    onClose,
    onConfirm,
    title,
    description,
    actionLabel,
    required = true
}) => {
    const { t } = useTranslation();
    const [reason, setReason] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleConfirm = () => {
        if (required && (!reason.trim() || reason.trim().length < 5)) {
            setError(t('admin.audit.reason_required_min', 'Une justification d\'au moins 5 caractères est requise pour cette action.'));
            return;
        }
        onConfirm(reason.trim());
        setReason('');
        setError(null);
    };

    const handleCancel = () => {
        setReason('');
        setError(null);
        onClose();
    };

    return (
        <Dialog open={open} onClose={handleCancel} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ShieldAlert size={24} color="#ed6c02" />
                {title || t('admin.audit.reason_dialog_title', 'Justification requise')}
            </DialogTitle>
            <DialogContent>
                <Box sx={{ mt: 1 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                        {description || t('admin.audit.reason_dialog_description', 'Veuillez justifier cette action administrative. Cette information sera enregistrée dans l\'audit log.')}
                    </Typography>
                    <TextField
                        autoFocus
                        margin="dense"
                        label={t('admin.audit.reason_label', 'Raison / Pourquoi ?')}
                        fullWidth
                        multiline
                        rows={3}
                        variant="outlined"
                        value={reason}
                        onChange={(e) => {
                            setReason(e.target.value);
                            if (error) setError(null);
                        }}
                        error={!!error}
                        helperText={error}
                        placeholder={t('admin.audit.reason_placeholder', 'Ex: Correction d\'erreur de saisie, demande du client au support, etc.')}
                    />
                    {required && (
                        <Alert severity="info" sx={{ mt: 2 }}>
                            {t('admin.audit.mandatory_info', 'Cette action est sensible. Une justification est obligatoire.')}
                        </Alert>
                    )}
                </Box>
            </DialogContent>
            <DialogActions sx={{ p: 2, pt: 0 }}>
                <Button onClick={handleCancel} color="inherit">
                    {t('common.cancel')}
                </Button>
                <Button 
                    onClick={handleConfirm} 
                    variant="contained" 
                    color="warning"
                    disabled={required && (!reason.trim() || reason.trim().length < 5)}
                >
                    {actionLabel || t('common.confirm')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ReasonDialog;
