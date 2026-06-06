import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    Typography,
    Box,
    Alert,
    CircularProgress
} from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { UserCheck, Building } from 'lucide-react';

interface CompleteSignupModalProps {
    open: boolean;
}

export const CompleteSignupModal: React.FC<CompleteSignupModalProps> = ({ open }) => {
    const { t } = useTranslation();
    const { completeSocialSignup, user, activeOrganizationId } = useAuth();
    const [username, setUsername] = useState(user?.username || '');
    const [organizationName, setOrganizationName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    React.useEffect(() => {
        if (user?.username && !user.needsUsername) {
            setUsername(user.username);
        }
    }, [user]);

    const isMissingOrgOnly = user && !user.needsUsername && !activeOrganizationId;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username || !organizationName) {
            setError(t('common.fillAllFields', 'Veuillez remplir tous les champs'));
            return;
        }

        setLoading(true);
        setError('');
        try {
            await completeSocialSignup(username, organizationName);
            // On success, the modal will implicitly close as auth state updates
        } catch (err: any) {
            setError(err.message || 'Failed to complete signup');
        } finally {
            setLoading(false);
        }
    };


    return (
        <Dialog 
            open={open} 
            disableEscapeKeyDown
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: { borderRadius: '16px' }
            }}
        >
            <DialogTitle component="div" sx={{ textAlign: 'center', pt: 4 }}>
                <Typography variant="h5" fontWeight={800}>
                    🚀 {isMissingOrgOnly 
                        ? t('completeSignup.missingOrgTitle', 'Créez votre premier espace !')
                        : t('completeSignup.title', 'Bienvenue sur SpoolyTracker !')}
                </Typography>
                <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                    {isMissingOrgOnly
                        ? t('completeSignup.missingOrgSubtitle', 'Il semblerait que vous n\'ayez pas encore d\'organisation. Créez-en une pour commencer.')
                        : t('completeSignup.subtitle', 'Dernière étape avant de commencer : personnalisez votre compte.')}
                </Typography>
            </DialogTitle>
            
            <form onSubmit={handleSubmit}>
                <DialogContent sx={{ p: 4 }}>
                    {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
                    
                    {!isMissingOrgOnly && (
                        <Box sx={{ mb: 3 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <UserCheck size={18} color="#2196F3" />
                                <Typography variant="subtitle2" fontWeight={700}>
                                    {t('completeSignup.username', 'Nom d\'utilisateur')}
                                </Typography>
                            </Box>
                            <TextField
                                fullWidth
                                variant="outlined"
                                placeholder="ex: jean.dupont"
                                value={username}
                                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                                disabled={loading}
                            />
                            <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5, display: 'block' }}>
                                {t('completeSignup.usernameHint', 'C\'est ainsi que vous serez identifié sur la plateforme.')}
                            </Typography>
                        </Box>
                    )}

                    <Box sx={{ mb: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <Building size={18} color="#2196F3" />
                            <Typography variant="subtitle2" fontWeight={700}>
                                {t('completeSignup.organization', 'Nom de votre espace (Organisation)')}
                            </Typography>
                        </Box>
                        <TextField
                            fullWidth
                            variant="outlined"
                            placeholder="ex: Mon Atelier 3D"
                            value={organizationName}
                            onChange={(e) => setOrganizationName(e.target.value)}
                            disabled={loading}
                            autoFocus={!!isMissingOrgOnly}
                        />
                        <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5, display: 'block' }}>
                            {t('completeSignup.organizationHint', 'Vous pourrez changer ce nom plus tard ou inviter d\'autres membres.')}
                        </Typography>
                    </Box>
                </DialogContent>

                
                <DialogActions sx={{ p: 4, pt: 0 }}>
                    <Button 
                        fullWidth 
                        variant="contained" 
                        type="submit" 
                        disabled={loading}
                        sx={{ 
                            py: 1.5, 
                            borderRadius: '12px',
                            fontWeight: 700,
                            textTransform: 'none',
                            fontSize: '1rem',
                            bgcolor: '#2196F3',
                            '&:hover': { bgcolor: '#1976D2' }
                        }}
                    >
                        {loading ? <CircularProgress size={24} color="inherit" /> : t('completeSignup.submit', 'C\'est parti !')}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
};
