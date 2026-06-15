import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Box, Button, Typography, Container, Grid, Paper } from '@mui/material';
import { ArrowRight, Database, Smartphone, ShieldCheck, Sparkles, LineChart, TrendingUp, ShoppingCart, AlertTriangle } from 'lucide-react';
import { useTheme } from '@mui/material/styles';

export default function LandingPage() {
    const { t } = useTranslation();
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    return (
        <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* Navbar */}
            <Box component="nav" sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: 1200, mx: 'auto', width: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <img src={isDark ? '/logo/logo-picto-dark.png' : '/logo/logo-picto-light.png'} alt='logo' style={{ width: 40, height: 40 }} />
                    <Typography variant="h5" fontWeight="700" color="primary">
                        SpoolyTracker
                    </Typography>
                </Box>
                <Box>
                    <Button component={Link} to="/login" variant="outlined" sx={{ mr: 1 }}>
                        {t('login.signIn') || 'Sign In'}
                    </Button>
                    <Button component={Link} to="/signup" variant="contained">
                        S'inscrire
                    </Button>
                </Box>
            </Box>

            {/* Hero Section */}
            <Container maxWidth="lg" sx={{ flex: 1, display: 'flex', alignItems: 'center', my: 4 }}>
                <Grid container spacing={4} alignItems="center">
                    <Grid size={{ xs: 12, md: 6 }}>
                        <Typography variant="h2" fontWeight="800" gutterBottom sx={{ background: 'linear-gradient(45deg, #2563eb 30%, #ec4899 90%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            Master Your Filament Inventory
                        </Typography>
                        <Typography variant="h5" color="text.secondary" paragraph>
                            The ultimate solution for 3D printing enthusiasts and professionals. Track consumption, manage spools, and sync across devices effortlessly.
                        </Typography>
                        <Box sx={{ mt: 4 }}>
                            <Button component={Link} to="/signup" variant="contained" size="large" endIcon={<ArrowRight />} sx={{ py: 1.5, px: 4, borderRadius: 2 }}>
                                Get Started Free
                            </Button>
                        </Box>
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <Box component="img" src={isDark ? '/logo/logo-picto-dark.png' : '/logo/logo-picto-light.png'} alt="Hero" sx={{ width: '100%', maxWidth: 400, display: 'block', mx: 'auto', filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.1))' }} />
                    </Grid>
                </Grid>
            </Container>

            {/* Features */}
            <Box sx={{ bgcolor: 'background.paper', py: 8 }}>
                <Container maxWidth="lg">
                    <Typography variant="h3" fontWeight="bold" textAlign="center" mb={6}>Why SpoolyTracker?</Typography>
                    <Grid container spacing={4}>
                        {[
                            { icon: Database, title: 'Smart Inventory', desc: 'Track weight, color, and material type for every spool.' },
                            { icon: Smartphone, title: 'Mobile Companion', desc: 'Scan NFC tags and update stock on the fly with our mobile app.' },
                            { icon: ShieldCheck, title: 'Secure & Private', desc: 'Your data is encrypted and safe. Self-hostable compatible.' }
                        ].map((feature, idx) => (
                            <Grid size={{ xs: 12, md: 4 }} key={idx}>
                                <Paper elevation={0} sx={{ p: 4, height: '100%', borderRadius: 4, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
                                    <Box sx={{ width: 48, height: 48, bgcolor: 'primary.light', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2, color: 'primary.main' }}>
                                        <feature.icon />
                                    </Box>
                                    <Typography variant="h5" fontWeight="bold" gutterBottom>{feature.title}</Typography>
                                    <Typography color="text.secondary">{feature.desc}</Typography>
                                </Paper>
                            </Grid>
                        ))}
                    </Grid>
                </Container>
            </Box>

            {/* IA & Analytique Spotlight */}
            <Box sx={{ py: 8 }}>
                <Container maxWidth="lg">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 0.5, borderRadius: 999, bgcolor: 'rgba(99,102,241,0.12)', color: 'primary.main', mb: 2, mx: 'auto', width: 'fit-content' }}>
                        <Sparkles size={16} />
                        <Typography variant="caption" fontWeight={700} sx={{ letterSpacing: 0.5 }}>NOUVEAU · PROPULSÉ PAR L'IA</Typography>
                    </Box>
                    <Typography variant="h3" fontWeight="bold" textAlign="center" mb={1}>
                        Anticipez, maîtrisez, visualisez
                    </Typography>
                    <Typography color="text.secondary" textAlign="center" mb={6} sx={{ maxWidth: 640, mx: 'auto' }}>
                        SpoolyTracker ne se contente pas de compter vos bobines : l'IA prévoit vos ruptures et une analytique complète éclaire chaque décision.
                    </Typography>

                    <Grid container spacing={4}>
                        {/* Carte Assistant IA */}
                        <Grid size={{ xs: 12, md: 6 }}>
                            <Paper elevation={0} sx={{ p: 4, height: '100%', borderRadius: 4, color: 'white', background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)', position: 'relative', overflow: 'hidden' }}>
                                <Box sx={{ position: 'absolute', top: -30, right: -30, opacity: 0.15 }}>
                                    <Sparkles size={160} color="white" />
                                </Box>
                                <Box sx={{ position: 'relative' }}>
                                    <Box sx={{ width: 48, height: 48, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                                        <Sparkles size={24} color="white" />
                                    </Box>
                                    <Typography variant="h5" fontWeight="bold" gutterBottom>Assistant IA</Typography>
                                    <Typography sx={{ opacity: 0.92, mb: 3 }}>
                                        Prévisions de rupture par bobine, détection d'anomalies de consommation et recommandations d'achat : ne tombez plus jamais à court au mauvais moment.
                                    </Typography>
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                        {[{ icon: TrendingUp, label: 'Prévisions de rupture' }, { icon: AlertTriangle, label: 'Anomalies' }, { icon: ShoppingCart, label: 'Recommandations d\'achat' }].map((c, i) => (
                                            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1.5, py: 0.5, borderRadius: 999, bgcolor: 'rgba(255,255,255,0.18)' }}>
                                                <c.icon size={14} color="white" />
                                                <Typography variant="caption" fontWeight={600}>{c.label}</Typography>
                                            </Box>
                                        ))}
                                    </Box>
                                </Box>
                            </Paper>
                        </Grid>

                        {/* Carte Analytique */}
                        <Grid size={{ xs: 12, md: 6 }}>
                            <Paper elevation={0} sx={{ p: 4, height: '100%', borderRadius: 4, color: 'white', background: 'linear-gradient(135deg, #0ea5e9 0%, #10b981 100%)', position: 'relative', overflow: 'hidden' }}>
                                <Box sx={{ position: 'absolute', top: -30, right: -30, opacity: 0.15 }}>
                                    <LineChart size={160} color="white" />
                                </Box>
                                <Box sx={{ position: 'relative' }}>
                                    <Box sx={{ width: 48, height: 48, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                                        <LineChart size={24} color="white" />
                                    </Box>
                                    <Typography variant="h5" fontWeight="bold" gutterBottom>Analytique avancée</Typography>
                                    <Typography sx={{ opacity: 0.92, mb: 3 }}>
                                        Des tableaux de bord personnalisables : consommation, coûts et stock en un coup d'œil. Affichez, masquez et réorganisez vos graphes comme vous voulez.
                                    </Typography>
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
                                        {['Consommation', 'Coûts & budget', 'Stock & prévisions'].map((label, i) => (
                                            <Box key={i} sx={{ px: 1.5, py: 0.5, borderRadius: 999, bgcolor: 'rgba(255,255,255,0.18)' }}>
                                                <Typography variant="caption" fontWeight={600}>{label}</Typography>
                                            </Box>
                                        ))}
                                    </Box>
                                    <Button component={Link} to="/signup" variant="contained" endIcon={<ArrowRight size={18} />} sx={{ bgcolor: 'white', color: '#0f766e', fontWeight: 700, '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' } }}>
                                        Découvrir l'analytique
                                    </Button>
                                </Box>
                            </Paper>
                        </Grid>
                    </Grid>
                </Container>
            </Box>

            {/* Footer */}
            <Box component="footer" sx={{ p: 4, textAlign: 'center', borderTop: '1px solid', borderColor: 'divider' }}>
                <Typography variant="body2" color="text.secondary">
                    © {new Date().getFullYear()} SpoolyTracker. All rights reserved.
                </Typography>
            </Box>
        </Box>
    );
}
