import { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    TextField,
    Button,
    Card,
    CardContent,
    Divider,
    Alert,
    CircularProgress,
    Stack,
    ToggleButton,
    ToggleButtonGroup
} from '@mui/material';
import { Save, Info, Eye, Edit3, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '../../contexts/AuthContext';
import { API_URL as BASE_URL } from '../../runtimeConfig';

export default function SettingsTab() {
    const { t } = useTranslation();
    const { token } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
    const [status, setStatus] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        fetchSetting();
    }, []);

    const fetchSetting = async () => {
        try {
            const response = await fetch(`${BASE_URL}/admin/settings/BETA_WELCOME_MESSAGE`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            setMessage(data.value || '');
        } catch (error) {
            console.error('Failed to fetch setting:', error);
            setStatus({ type: 'error', text: t('admin.errorLoading') });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setStatus(null);
        try {
            const response = await fetch(`${BASE_URL}/admin/settings/BETA_WELCOME_MESSAGE`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ 
                    value: message,
                    description: 'Message de bienvenue automatique pour les nouveaux bêta-testeurs.'
                })
            });

            if (response.ok) {
                setStatus({ type: 'success', text: t('admin.saveSuccess') });
            } else {
                throw new Error('Save failed');
            }
        } catch (error) {
            console.error('Failed to save setting:', error);
            setStatus({ type: 'error', text: t('admin.saveError') });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ maxWidth: 1000 }}>
            <Box sx={{ mb: 4 }}>
                <Typography variant="h5" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Sparkles size={24} color="#1661af" />
                    {t('admin.betaProgramTitle')}
                </Typography>
                <Typography color="textSecondary">
                    {t('admin.betaProgramDesc')}
                </Typography>
            </Box>

            {status && (
                <Alert severity={status.type} sx={{ mb: 3, borderRadius: 2 }}>
                    {status.text}
                </Alert>
            )}

            <Card sx={{ borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                <Box sx={{ p: 2, bgcolor: '#f8f9fa', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <ToggleButtonGroup
                        value={viewMode}
                        exclusive
                        onChange={(_, val) => val && setViewMode(val)}
                        size="small"
                        sx={{ bgcolor: 'white' }}
                    >
                        <ToggleButton value="edit" sx={{ px: 2, py: 0.5 }}>
                            <Edit3 size={16} style={{ marginRight: 8 }} />
                            {t('common.edit')}
                        </ToggleButton>
                        <ToggleButton value="preview" sx={{ px: 2, py: 0.5 }}>
                            <Eye size={16} style={{ marginRight: 8 }} />
                            {t('common.preview')}
                        </ToggleButton>
                    </ToggleButtonGroup>

                    <Button
                        variant="contained"
                        startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <Save size={18} />}
                        onClick={handleSave}
                        disabled={saving}
                        sx={{ borderRadius: 2, px: 3 }}
                    >
                        {saving ? t('common.saving') : t('common.save')}
                    </Button>
                </Box>

                <CardContent sx={{ p: 0 }}>
                    {viewMode === 'edit' ? (
                        <TextField
                            multiline
                            fullWidth
                            rows={15}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder={t('inventory.notes') + ' (Markdown supporté)...'}
                            variant="standard"
                            sx={{
                                '& .MuiInputBase-root': {
                                    p: 3,
                                    fontFamily: 'monospace',
                                    fontSize: '0.95rem',
                                    alignItems: 'flex-start'
                                },
                                '& .MuiInput-underline:before, & .MuiInput-underline:after': {
                                    display: 'none'
                                }
                            }}
                        />
                    ) : (
                        <Box sx={{ p: 4, minHeight: 400, bgcolor: 'white' }}>
                            <Typography variant="h6" color="primary" gutterBottom>
                                {t('admin.emailSubjectPrefix')}
                            </Typography>
                            <Divider sx={{ my: 2 }} />
                            <Box className="markdown-body" sx={{ 
                                '& p': { mb: 2 },
                                '& h1, & h2, & h3': { mt: 3, mb: 1 },
                                '& ul, & ol': { mb: 2, pl: 3 }
                            }}>
                                <ReactMarkdown>{message || '*Aucun contenu. Écrivez quelque chose dans l\'onglet Éditeur.*'}</ReactMarkdown>
                            </Box>
                            <Box sx={{ mt: 4, p: 2, bgcolor: '#f0f7ff', borderRadius: 2, border: '1px dashed #1661af' }}>
                                <Typography variant="caption" color="primary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Info size={14} /> {t('admin.emailTemplateNote')}
                                </Typography>
                            </Box>
                        </Box>
                    )}
                </CardContent>
            </Card>

            <Box sx={{ mt: 3 }}>
                <Paper sx={{ p: 2, borderRadius: 2, bgcolor: '#fff4e5', border: '1px solid #ffe2b3' }}>
                    <Stack direction="row" spacing={2} alignItems="center">
                        <Box sx={{ color: '#b26a00' }}>
                            <Info size={24} />
                        </Box>
                        <Box>
                            <Typography variant="subtitle2" fontWeight="bold">
                                {t('common.howItWorks')}
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                                {t('admin.betaHowItWorks')}
                            </Typography>
                        </Box>
                    </Stack>
                </Paper>
            </Box>
        </Box>
    );
}
