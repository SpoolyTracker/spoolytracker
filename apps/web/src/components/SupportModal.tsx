import { useState, useRef } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Box,
    Typography,
    ToggleButton,
    ToggleButtonGroup,
    IconButton,
    CircularProgress,
    Alert
} from '@mui/material';
import { LifeBuoy, Bug, MessageSquare, X, Upload, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';

interface SupportModalProps {
    open: boolean;
    onClose: () => void;
}

type SupportType = 'bug' | 'feedback';

export default function SupportModal({ open, onClose }: SupportModalProps) {
    const { t, i18n } = useTranslation();
    const [type, setType] = useState<SupportType>('bug');
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleTypeChange = (_: any, newType: SupportType | null) => {
        if (newType !== null) {
            setType(newType);
            if (newType === 'bug' && !message) {
                setMessage(t('support.bugTemplate', "Steps to reproduce:\n1. \n2. \n\nObserved behavior:\n\nExpected behavior:"));
            } else if (newType === 'feedback') {
                setMessage('');
            }
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            if (selectedFile.size > 5 * 1024 * 1024) {
                setError(t('support.fileTooBig', "File is too large (max 5MB)"));
                return;
            }
            setFile(selectedFile);
            setPreviewUrl(URL.createObjectURL(selectedFile));
            setError(null);
        }
    };

    const handleRemoveFile = () => {
        setFile(null);
        setPreviewUrl(null);
    };

    const handleSubmit = async () => {
        if (!message) return;
        
        setLoading(true);
        setError(null);
        
        try {
            const formData = new FormData();
            formData.append('type', type);
            formData.append('message', message);
            if (type === 'bug' && title) formData.append('title', title);
            if (file) formData.append('image', file);

            await api.submitSupportTicket(formData);
            setSuccess(true);
            setTimeout(() => {
                handleClose();
            }, 3000);
        } catch (err) {
            console.error(err);
            setError(t('support.sendError', "Failed to send report. Please try again later."));
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setType('bug');
        setTitle('');
        setMessage('');
        setFile(null);
        setPreviewUrl(null);
        setSuccess(false);
        setError(null);
        setLoading(false);
        onClose();
    };

    return (
        <Dialog 
            open={open} 
            onClose={loading ? undefined : handleClose} 
            maxWidth="sm" 
            fullWidth
            PaperProps={{
                sx: { borderRadius: 3, p: 1 }
            }}
        >
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <LifeBuoy size={24} color="#1661af" />
                    <Typography variant="h5" fontWeight="bold">
                        {t('support.title', 'Help & Feedback')}
                    </Typography>
                </Box>
                <IconButton onClick={handleClose} disabled={loading}>
                    <X size={20} />
                </IconButton>
            </DialogTitle>

            <DialogContent>
                {success ? (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                        <CheckCircle size={64} color="#10b981" style={{ marginBottom: 16 }} />
                        <Typography variant="h5" gutterBottom fontWeight="bold">
                            {t('support.successTitle', 'Thank you!')}
                        </Typography>
                        <Typography color="text.secondary">
                            {t('support.successMessage', 'Your report has been sent to our support team.')}
                        </Typography>
                    </Box>
                ) : (
                    <Box sx={{ mt: 1 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                            {t('support.subtitle', 'Have a problem or a suggestion? Let us know so we can improve Spoolytracker.')}
                            <Box component="span" sx={{ display: 'block', mt: 1 }}>
                                <Button 
                                    size="small" 
                                    href={`https://spoolytracker.com/${i18n.language === 'en' ? 'en/faq' : 'faq'}`}
                                    target="_blank"
                                    sx={{ textTransform: 'none', p: 0, minWidth: 0, fontWeight: 'bold' }}
                                >
                                    {t('support.viewFaq', 'Check our FAQ')}
                                </Button>
                            </Box>
                        </Typography>

                        <ToggleButtonGroup
                            value={type}
                            exclusive
                            onChange={handleTypeChange}
                            fullWidth
                            sx={{ mb: 3 }}
                        >
                            <ToggleButton value="bug" sx={{ py: 1.5, gap: 1 }}>
                                <Bug size={18} />
                                {t('support.typeBug', 'Signal a Bug')}
                            </ToggleButton>
                            <ToggleButton value="feedback" sx={{ py: 1.5, gap: 1 }}>
                                <MessageSquare size={18} />
                                {t('support.typeFeedback', 'Feedback')}
                            </ToggleButton>
                        </ToggleButtonGroup>

                        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                        {type === 'bug' && (
                            <TextField
                                fullWidth
                                label={t('support.bugTitle', 'Title (Optional)')}
                                variant="outlined"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                sx={{ mb: 2 }}
                                placeholder={t('support.bugTitlePlaceholder', 'Brief summary of the issue')}
                            />
                        )}

                        <TextField
                            fullWidth
                            label={type === 'bug' ? t('support.description', 'Description') : t('support.feedback', 'Your Suggestion')}
                            multiline
                            rows={type === 'bug' ? 6 : 4}
                            variant="outlined"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            required
                            placeholder={type === 'feedback' ? t('support.feedbackPlaceholder', 'What would you like to see in Spoolytracker?') : undefined}
                            sx={{ mb: 2 }}
                        />

                        {type === 'bug' && (
                            <Box>
                                <input
                                    type="file"
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                />
                                {previewUrl ? (
                                    <Box sx={{ position: 'relative', width: 'fit-content', mt: 1 }}>
                                        <img 
                                            src={previewUrl} 
                                            alt="Preview" 
                                            style={{ maxHeight: 150, borderRadius: 8, display: 'block' }} 
                                        />
                                        <IconButton 
                                            size="small" 
                                            onClick={handleRemoveFile}
                                            sx={{ 
                                                position: 'absolute', 
                                                top: -8, 
                                                right: -8, 
                                                bgcolor: 'background.paper',
                                                boxShadow: 2,
                                                '&:hover': { bgcolor: 'error.light', color: 'white' }
                                            }}
                                        >
                                            <X size={14} />
                                        </IconButton>
                                    </Box>
                                ) : (
                                    <Button
                                        variant="outlined"
                                        startIcon={<Upload size={18} />}
                                        onClick={() => fileInputRef.current?.click()}
                                        sx={{ borderRadius: 2 }}
                                    >
                                        {t('support.attachImage', 'Attach a Screenshot (optional)')}
                                    </Button>
                                )}
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                                    {t('support.fileRestriction', 'Max 5MB. Images only.')}
                                </Typography>
                            </Box>
                        )}

                        <Box sx={{ mt: 3, p: 2, bgcolor: 'primary.light', borderRadius: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
                            <Box sx={{ bgcolor: 'white', p: 1, borderRadius: '50%', display: 'flex' }}>
                                <img src="/logo/logo-picto.png" alt="Assistant" style={{ width: 20, height: 20 }} />
                            </Box>
                            <Typography variant="body2" color="primary.main" fontWeight="medium">
                                {t('support.assistantTip', 'Did you know? You can also ask our AI Assistant for help with using Spoolytracker!')}
                            </Typography>
                        </Box>
                    </Box>
                )}
            </DialogContent>

            <DialogActions sx={{ p: 2, px: 3 }}>
                {!success && (
                    <>
                        <Button 
                            onClick={handleClose} 
                            disabled={loading}
                            sx={{ borderRadius: 2 }}
                        >
                            {t('common.cancel')}
                        </Button>
                        <Button
                            variant="contained"
                            onClick={handleSubmit}
                            disabled={loading || !message}
                            sx={{ borderRadius: 2, minWidth: 120 }}
                        >
                            {loading ? <CircularProgress size={24} /> : (type === 'bug' ? t('support.sendBug', 'Send Bug Report') : t('support.sendFeedback', 'Send Feedback'))}
                        </Button>
                    </>
                )}
            </DialogActions>
        </Dialog>
    );
}
