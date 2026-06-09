import { SiAndroid, SiApple, SiFirebase } from '@icons-pack/react-simple-icons';
import {
    Box,
    Button,
    Dialog,
    DialogContent,
    DialogTitle,
    Divider,
    Grid,
    IconButton,
    Paper,
    Tooltip,
    Typography,
} from '@mui/material';
import { Download, ExternalLink, Info, Smartphone, X, Zap } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface MobileDownloadModalProps {
    open: boolean;
    onClose: () => void;
    plan?: string;
    isSuperAdmin?: boolean;
}

const PLAY_STORE_URL = import.meta.env.VITE_PLAYSTORE_URL || "https://play.google.com/store/apps/details?id=com.spoolytracker.mobile";
const FIREBASE_URL = import.meta.env.VITE_FIREBASE_URL || "https://appdistribution.firebase.dev/i/4d0485d45aad61c5";
const BETA_OPTIN_URL = "https://play.google.com/apps/testing/com.spoolytracker.mobile";
const IOS_APP_URL = import.meta.env.VITE_APPSTORE_URL || "https://apps.apple.com/app/id6760127825";

export const MobileDownloadModal: React.FC<MobileDownloadModalProps> = ({ open, onClose, plan, isSuperAdmin }) => {
    const { t } = useTranslation();
    const [activeOs, setActiveOs] = React.useState<'android' | 'ios'>('android');
    const isBetaUser = plan?.toLowerCase() === 'beta' || isSuperAdmin;

    const qrValue = activeOs === 'android' ? PLAY_STORE_URL : IOS_APP_URL;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: '24px',
                    backgroundImage: 'none',
                    bgcolor: muiTheme => muiTheme.palette.mode === 'dark' ? '#1a223f' : '#ffffff',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
                    border: '1px solid var(--border)',
                    position: 'relative',
                }
            }}
        >
            {/* Header with gradient - Absolute positioning for perfect fit */}
            <Box sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '6px',
                background: 'linear-gradient(90deg, #4CAF50 0%, #2196F3 100%)',
                zIndex: 1
            }} />

            <DialogTitle sx={{ m: 0, p: 4, pb: 3, mt: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5 }}>
                    <Box sx={{
                        p: 1.5,
                        borderRadius: '16px',
                        bgcolor: 'rgba(33, 150, 243, 0.15)',
                        color: '#2196F3',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        width: 56,
                        height: 56
                    }}>
                        <Smartphone size={32} />
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <Typography variant="h5" fontWeight={900} sx={{ color: 'var(--text-primary)', lineHeight: 1, mb: 0.8 }}>
                            {t('mobileHub.title', 'Centre Mobile SpoolyTracker')}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'var(--text-secondary)', fontWeight: 600, opacity: 0.75, lineHeight: 1.2 }}>
                            {t('mobileHub.subtitle', 'Ammenez votre gestion de filaments partout')}
                        </Typography>
                    </Box>
                </Box>
                <IconButton onClick={onClose} sx={{ color: 'text.secondary', bgcolor: 'rgba(0,0,0,0.03)', '&:hover': { bgcolor: 'rgba(0,0,0,0.08)' } }}>
                    <X size={20} />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ p: 4, pt: 1, bgcolor: 'inherit' }}>
                <Grid container spacing={4}>
                    {/* QR Code Section */}
                    <Grid size={{ xs: 12, md: 5 }}>
                        <Paper elevation={0} sx={{
                            p: 3,
                            borderRadius: '20px',
                            bgcolor: muiTheme => muiTheme.palette.mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            border: '1px dashed var(--border)',
                        }}>
                            {/* OS Switcher for QR Code */}
                            <Box sx={{
                                display: 'flex',
                                p: 0.5,
                                bgcolor: muiTheme => muiTheme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                                borderRadius: '12px',
                                mb: 3,
                                width: '100%'
                            }}>
                                <Button
                                    fullWidth
                                    onClick={() => setActiveOs('android')}
                                    sx={{
                                        borderRadius: '10px',
                                        py: 1,
                                        bgcolor: activeOs === 'android' ? (muiTheme => muiTheme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'white') : 'transparent',
                                        color: activeOs === 'android' ? '#4CAF50' : 'text.secondary',
                                        boxShadow: activeOs === 'android' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                                        '&:hover': { bgcolor: activeOs === 'android' ? (muiTheme => muiTheme.palette.mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'white') : 'rgba(0,0,0,0.02)' }
                                    }}
                                    startIcon={<SiAndroid size={16} />}
                                >
                                    Android
                                </Button>
                                <Button
                                    fullWidth
                                    onClick={() => setActiveOs('ios')}
                                    sx={{
                                        borderRadius: '10px',
                                        py: 1,
                                        bgcolor: activeOs === 'ios' ? (muiTheme => muiTheme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'white') : 'transparent',
                                        color: activeOs === 'ios' ? '#2196F3' : 'text.secondary',
                                        boxShadow: activeOs === 'ios' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                                        '&:hover': { bgcolor: activeOs === 'ios' ? (muiTheme => muiTheme.palette.mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'white') : 'rgba(0,0,0,0.02)' }
                                    }}
                                    startIcon={<SiApple size={16} />}
                                >
                                    iOS
                                </Button>
                            </Box>

                            <Box sx={{
                                p: 2,
                                bgcolor: 'white',
                                borderRadius: '16px',
                                boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                                mb: 3
                            }}>
                                <QRCodeSVG value={qrValue} size={160} />
                            </Box>
                            <Typography variant="subtitle2" fontWeight={800} textAlign="center">
                                {t('mobileHub.scanTitle', 'Scanner pour télécharger')}
                            </Typography>
                            <Typography variant="caption" textAlign="center" color="textSecondary" sx={{ mt: 1, maxWidth: '200px' }}>
                                {activeOs === 'android'
                                    ? t('mobileHub.scanTextAndroid', 'Ouvre le Google Play Store')
                                    : t('mobileHub.scanTextIos', 'Ouvre l\'Apple App Store')}
                            </Typography>
                        </Paper>
                    </Grid>

                    {/* Links Section */}
                    <Grid size={{ xs: 12, md: 7 }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

                            {/* Android Stable */}
                            <Paper variant="outlined" sx={{
                                p: 2.5,
                                borderRadius: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 3,
                                transition: 'all 0.2s',
                                '&:hover': {
                                    borderColor: '#4CAF50',
                                    bgcolor: 'rgba(76, 175, 80, 0.02)',
                                    transform: 'translateY(-2px)'
                                }
                            }}>
                                <Box sx={{ color: '#4CAF50' }}><SiAndroid size={32} /></Box>
                                <Box sx={{ flex: 1 }}>
                                    <Typography variant="subtitle1" fontWeight={700}>Google Play Store</Typography>
                                    <Typography variant="body2" color="textSecondary">Version stable officielle</Typography>
                                </Box>
                                <Button
                                    variant="contained"
                                    component="a"
                                    href={PLAY_STORE_URL}
                                    target="_blank"
                                    size="small"
                                    sx={{
                                        borderRadius: '8px',
                                        bgcolor: '#4CAF50',
                                        '&:hover': { bgcolor: '#388E3C' }
                                    }}
                                >
                                    {t('common.open', 'Ouvrir')}
                                </Button>
                            </Paper>

                            {/* iOS App Store */}
                            <Paper variant="outlined" sx={{
                                p: 2.5,
                                borderRadius: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 3,
                                transition: 'all 0.2s',
                                '&:hover': {
                                    borderColor: '#2196F3',
                                    bgcolor: 'rgba(33, 150, 243, 0.02)',
                                    transform: 'translateY(-2px)'
                                }
                            }}>
                                <Box sx={{ color: muiTheme => muiTheme.palette.mode === 'dark' ? '#ffffff' : '#000000' }}><SiApple size={32} /></Box>
                                <Box sx={{ flex: 1 }}>
                                    <Typography variant="subtitle1" fontWeight={700}>Apple App Store</Typography>
                                    <Typography variant="body2" color="textSecondary">Version officielle iOS</Typography>
                                </Box>
                                <Button
                                    variant="contained"
                                    component="a"
                                    href={IOS_APP_URL}
                                    target="_blank"
                                    size="small"
                                    disableElevation
                                    sx={{
                                        borderRadius: '8px',
                                        bgcolor: '#1c1c1e',
                                        color: '#ffffff',
                                        fontWeight: 700,
                                        '&:hover': { bgcolor: '#000000' }
                                    }}
                                >
                                    {t('common.open', 'Ouvrir')}
                                </Button>
                            </Paper>

                            <Divider sx={{ my: 1 }}>
                                <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 600, px: 2 }}>
                                    {t('mobileHub.advancedOptions', 'OPTIONS AVANCÉES')}
                                </Typography>
                            </Divider>

                            {/* Beta Access (Conditional) */}
                            {isBetaUser && (
                                <Paper variant="outlined" sx={{
                                    p: 2,
                                    borderRadius: '16px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 2,
                                    borderStyle: 'dashed',
                                    borderColor: '#2196F3',
                                    bgcolor: muiTheme => muiTheme.palette.mode === 'dark' ? 'rgba(33, 150, 243, 0.05)' : 'rgba(33, 150, 243, 0.02)'
                                }}>
                                    <Box sx={{ color: '#2196F3' }}><Zap size={24} /></Box>
                                    <Box sx={{ flex: 1 }}>
                                        <Typography variant="subtitle2" fontWeight={700}>Programme Beta</Typography>
                                        <Typography variant="caption" color="textSecondary">Devenez testeur officiel</Typography>
                                    </Box>
                                    <Tooltip title={t('mobileHub.betaTooltip', 'Nécessite d\'avoir été ajouté à la liste par l\'administration')}>
                                        <Button
                                            color="primary"
                                            size="small"
                                            component="a"
                                            href={BETA_OPTIN_URL}
                                            target="_blank"
                                            endIcon={<ExternalLink size={14} />}
                                            sx={{ fontWeight: 700 }}
                                        >
                                            {t('mobileHub.optIn', 'S\'inscrire')}
                                        </Button>
                                    </Tooltip>
                                </Paper>
                            )}

                            {/* Firebase/APK */}
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1, mt: 1 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <SiFirebase size={16} color="#FFCA28" />
                                    <Typography variant="body2" fontWeight={600} sx={{ color: 'var(--text-secondary)' }}>
                                        Installation directe (Android)
                                    </Typography>
                                </Box>
                                <Button
                                    size="small"
                                    component="a"
                                    href={FIREBASE_URL}
                                    target="_blank"
                                    sx={{ fontSize: '0.75rem', fontWeight: 700 }}
                                    startIcon={<Download size={14} />}
                                >
                                    Fichier APK
                                </Button>
                            </Box>

                        </Box>
                    </Grid>
                </Grid>
            </DialogContent>

            <Box sx={{ p: 3, bgcolor: 'rgba(0,0,0,0.01)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'center' }}>
                <Typography variant="caption" color="textDisabled" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Info size={12} />
                    {t('mobileHub.footer', 'Version 1.0.0-rc recommandée pour une expérience optimale')}
                </Typography>
            </Box>
        </Dialog>
    );
};
