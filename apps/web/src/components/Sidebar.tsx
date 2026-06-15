
import { SiDiscord } from '@icons-pack/react-simple-icons'; // We use simple-icons for brand logos like Discord
import { Box, Drawer, List, Typography, useMediaQuery } from '@mui/material';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import { useTheme } from '@mui/material/styles';
import { BarChart3, Database, FileSearch, Folder, LayoutDashboard, LineChart, Package, Scale, Settings, Smartphone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router-dom';
import packageJson from '../../package.json';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import GCodeAnalysisDialog from './GCodeAnalysisDialog';
import { MobileDownloadModal } from './modals/MobileDownloadModal';

const drawerWidth = 260;
const DISCORD_INVITE_URL = import.meta.env.VITE_DISCORD_URL || 'https://discord.gg/vQMf6pds';

interface SidebarProps {
    drawerOpen: boolean;
    drawerToggle: () => void;
}

export default function Sidebar({ drawerOpen, drawerToggle }: SidebarProps) {
    const theme = useTheme();
    const matchUpMd = useMediaQuery(theme.breakpoints.up('md'));
    const { t } = useTranslation();
    const { user } = useAuth();
    const location = useLocation();
    const [isGCodeDialogOpen, setIsGCodeDialogOpen] = useState(false);
    const [isMobileModalOpen, setIsMobileModalOpen] = useState(false);
    const [_organization, setOrganization] = useState<any>(null);

    useEffect(() => {
        const fetchOrg = async () => {
            try {
                // Fetch current organization data to check plan
                const org = await api.getOrgData();
                setOrganization(org);
            } catch (e) {
                console.error('Failed to fetch org details for sidebar', e);
            }
        };
        fetchOrg();
    }, []);

    const showMobileLink = true;

    const mainNavItems = [
        { icon: LayoutDashboard, label: t('sidebar.dashboard'), path: '/dashboard', tourId: 'tour-dashboard' },
        { icon: LineChart, label: t('sidebar.analytics', 'Analytique'), path: '/analytics', tourId: 'tour-analytics' },
        { icon: Package, label: t('sidebar.inventory'), path: '/inventory', tourId: 'tour-inventory' },
        { icon: BarChart3, label: t('sidebar.consumption') || 'Consumption', path: '/consumption', tourId: 'tour-consumption' },
        { icon: Folder, label: t('sidebar.projects') || 'Projects', path: '/projects', tourId: 'tour-projects' },
        { icon: Database, label: t('sidebar.customData') || 'Reference Data', path: '/reference-data', tourId: 'tour-refdata' },
    ];

    const adminNavItems: any[] = [];

    if ((user as any)?.isSuperAdmin || user?.systemRole === 'admin') {
        adminNavItems.push({
            icon: Settings,
            label: t('sidebar.admin'),
            path: '/admin'
        });
        adminNavItems.push({
            icon: Package,
            label: t('sidebar.globalInventory'),
            path: '/admin/filaments'
        });
        adminNavItems.push({
            // @ts-ignore
            image: '/tigertag_logo.jpg',
            label: t('sidebar.tigerTagData'),
            path: '/admin/tigertag'
        });
    }

    const renderNavList = (items: any[]) => (
        <List sx={{ pt: 1 }}>
            {items.map((item: any) => {
                const isSelected = location.pathname === item.path;
                return (
                    <ListItemButton
                        key={item.path}
                        component={NavLink}
                        to={item.path}
                        selected={isSelected}
                        sx={{
                            mb: 0.5,
                            borderRadius: '12px',
                            justifyContent: drawerOpen ? 'flex-start' : 'center',
                            px: drawerOpen ? 2 : 1,
                            ...(isSelected && {
                                bgcolor: 'primary.light',
                                color: 'primary.main',
                                '&:hover': { bgcolor: 'primary.light' },
                                '& .MuiListItemIcon-root': { color: 'primary.main' }
                            })
                        }}
                        data-tour={item.tourId}
                    >
                        <ListItemIcon sx={{ minWidth: drawerOpen ? 36 : 0, color: 'inherit', mr: drawerOpen ? 2 : 0, justifyContent: 'center' }}>
                            {item.image ? (
                                <img src={item.image} alt="icon" style={{ width: 24, height: 24, borderRadius: 4, objectFit: 'contain' }} />
                            ) : (
                                <item.icon size={20} />
                            )}
                        </ListItemIcon>
                        {drawerOpen && <ListItemText primary={<Typography variant="body2" fontWeight={500}>{item.label}</Typography>} />}
                    </ListItemButton>
                );
            })}
        </List>
    );

    const drawerContent = (
        <>
            <Box sx={{ px: 2, py: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
                {drawerOpen && (
                    <Typography variant="caption" sx={{ fontWeight: 600, pl: 1.5, pb: 0, display: 'block', color: 'text.secondary', opacity: 0.7 }}>
                        {t('sidebar.menu')}
                    </Typography>
                )}
                {renderNavList(mainNavItems)}

                {showMobileLink && (
                    <>
                        {drawerOpen && (
                            <Typography variant="caption" sx={{ fontWeight: 600, pl: 1.5, pt: 3, pb: 0, display: 'block', color: 'text.secondary', opacity: 0.7 }}>
                                {t('sidebar.mobile')}
                            </Typography>
                        )}
                        <List sx={{ pt: 1 }}>
                            {/* Mobile Hub Button (Opens Modal) */}
                            <ListItemButton
                                onClick={() => setIsMobileModalOpen(true)}
                                sx={{
                                    mb: 0.5,
                                    borderRadius: '12px',
                                    justifyContent: drawerOpen ? 'flex-start' : 'center',
                                    px: drawerOpen ? 2 : 1,
                                    background: 'linear-gradient(90deg, rgba(76, 175, 80, 0.08) 0%, rgba(33, 150, 243, 0.08) 100%)',
                                    color: muiTheme => muiTheme.palette.mode === 'dark' ? '#90caf9' : '#1976d2',
                                    position: 'relative',
                                    overflow: 'hidden',
                                    '&:hover': {
                                        background: 'linear-gradient(90deg, rgba(76, 175, 80, 0.15) 0%, rgba(33, 150, 243, 0.15) 100%)',
                                    },
                                    '&::after': (_organization?.plan?.toLowerCase() === 'beta') ? {
                                        content: '"BETA"',
                                        position: 'absolute',
                                        top: '6px',
                                        right: '-18px',
                                        background: '#ff9800',
                                        color: 'white',
                                        fontSize: '0.6rem',
                                        fontWeight: 900,
                                        padding: '2px 20px',
                                        transform: 'rotate(45deg)',
                                    } : {}
                                }}
                            >
                                <ListItemIcon sx={{ minWidth: drawerOpen ? 36 : 0, color: 'inherit', mr: drawerOpen ? 2 : 0, justifyContent: 'center' }}>
                                    <Smartphone size={20} />
                                </ListItemIcon>
                                {drawerOpen && (
                                    <ListItemText
                                        primary={<Typography variant="body2" fontWeight={700}>Application Mobile</Typography>}
                                        secondary={<Typography variant="caption" sx={{ fontSize: '0.65rem', opacity: 0.8 }}>Installer sur iOS / Android</Typography>}
                                    />
                                )}
                            </ListItemButton>
                        </List>
                    </>
                )}

                {/* GCode Analysis Promo Card */}
                <Box sx={{ px: drawerOpen ? 2 : 1, mt: 3, mb: 1 }}>
                    <Box
                        onClick={() => setIsGCodeDialogOpen(true)}
                        sx={{
                            p: drawerOpen ? 2 : 1,
                            borderRadius: '20px',
                            background: 'linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 100%)',
                            cursor: 'pointer',
                            position: 'relative',
                            overflow: 'hidden',
                            transition: 'all 0.2s',
                            border: '1px solid #90CAF9',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            flexDirection: drawerOpen ? 'column' : 'row',
                            '&:hover': {
                                transform: 'translateY(-2px)',
                                boxShadow: '0 8px 20px rgba(33, 150, 243, 0.15)'
                            }
                        }}
                        data-tour="tour-gcode-analysis"
                    >
                        {/* Decorative Circle - Only show when open or adjust */}
                        {drawerOpen && <Box sx={{
                            position: 'absolute',
                            top: -20,
                            right: -20,
                            width: 80,
                            height: 80,
                            borderRadius: '50%',
                            bgcolor: 'primary.main',
                            opacity: 0.1
                        }} />}

                        <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: drawerOpen ? 1.5 : 0 }}>
                            <Box sx={{
                                bgcolor: 'white',
                                p: 1,
                                borderRadius: '12px',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                                color: 'primary.main',
                                display: 'flex'
                            }}>
                                <FileSearch size={24} />
                            </Box>
                        </Box>

                        {drawerOpen && (
                            <>
                                <Typography variant="subtitle1" fontWeight="bold" color="primary.dark" gutterBottom sx={{ lineHeight: 1.2 }}>
                                    {t('sidebar.gcodeAnalysis')}
                                </Typography>
                                <Typography variant="caption" color="primary.main" sx={{ opacity: 0.9, lineHeight: 1.3, display: 'block' }}>
                                    {t('sidebar.gcodeSubtitle')}
                                </Typography>
                            </>
                        )}
                    </Box>
                </Box>

                {adminNavItems.length > 0 && (
                    <>
                        {drawerOpen && (
                            <Typography variant="caption" sx={{ fontWeight: 600, pl: 1.5, pt: 3, pb: 0, display: 'block', color: 'text.secondary', opacity: 0.7 }}>
                                {t('sidebar.administration')}
                            </Typography>
                        )}
                        {renderNavList(adminNavItems)}
                    </>
                )}
                <Box sx={{ mt: 'auto', pt: 2, borderTop: drawerOpen ? `1px solid ${theme.palette.divider}` : 'none' }}>
                    <ListItemButton
                        component={NavLink}
                        to="/legal"
                        sx={{
                            borderRadius: '12px',
                            justifyContent: drawerOpen ? 'flex-start' : 'center',
                            px: drawerOpen ? 2 : 1,
                            color: 'text.secondary',
                            '&.active': { color: 'primary.main', bgcolor: 'action.hover' }
                        }}
                    >
                        <ListItemIcon sx={{ minWidth: drawerOpen ? 36 : 0, color: 'inherit', mr: drawerOpen ? 2 : 0, justifyContent: 'center' }}>
                            <Scale size={20} />
                        </ListItemIcon>
                        {drawerOpen && <ListItemText primary={<Typography variant="body2">{t('sidebar.legal')}</Typography>} />}
                    </ListItemButton>
                    <Box sx={{ py: 1, textAlign: 'center', opacity: 0.5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                        <Box
                            component="a"
                            href={DISCORD_INVITE_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{
                                color: 'inherit',
                                textDecoration: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                transition: 'color 0.2s',
                                '&:hover': {
                                    color: '#5865F2', // Discord Brand Color
                                    opacity: 1
                                }
                            }}
                        >
                            <SiDiscord size={drawerOpen ? 20 : 16} />
                        </Box>
                        {drawerOpen ? (
                            <Typography variant="caption" display="block">
                                v{packageJson.version}
                            </Typography>
                        ) : (
                            <Typography variant="caption" sx={{ fontSize: '0.6rem' }}>
                                v{packageJson.version}
                            </Typography>
                        )}
                    </Box>
                </Box>
            </Box>
            <GCodeAnalysisDialog
                isOpen={isGCodeDialogOpen}
                onClose={() => setIsGCodeDialogOpen(false)}
            />
            <MobileDownloadModal
                open={isMobileModalOpen}
                onClose={() => setIsMobileModalOpen(false)}
                plan={_organization?.plan}
                isSuperAdmin={(user as any)?.isSuperAdmin || (user as any)?.systemRole === 'super_admin'}
            />
        </>
    );

    const miniDrawerWidth = 80;

    return (
        <Box component="nav" sx={{ flexShrink: { md: 0 }, width: matchUpMd ? (drawerOpen ? drawerWidth : miniDrawerWidth) : 'auto' }} aria-label="mailbox folders">
            <Drawer
                variant={matchUpMd ? 'permanent' : 'temporary'}
                anchor="left"
                open={drawerOpen}
                onClose={drawerToggle}
                sx={{
                    '& .MuiDrawer-paper': {
                        width: matchUpMd ? (drawerOpen ? drawerWidth : miniDrawerWidth) : drawerWidth,
                        overflowX: 'hidden',
                        background: theme.palette.background.default,
                        color: theme.palette.text.primary,
                        borderRight: 'none',
                        transition: theme.transitions.create('width', {
                            easing: theme.transitions.easing.sharp,
                            duration: theme.transitions.duration.enteringScreen,
                        }),
                        [theme.breakpoints.up('md')]: {
                            top: '80px', // Below header
                            height: 'calc(100% - 80px)'
                        }
                    }
                }}
                ModalProps={{ keepMounted: true }}
                color="inherit"
            >
                {drawerContent}
            </Drawer>
        </Box>
    );
}
