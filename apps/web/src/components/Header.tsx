
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import {
    AppBar,
    Box,
    Toolbar,
    IconButton,
    Typography,
    Menu,
    MenuItem,
    Avatar,
    ListItemIcon,
    Divider,
    ButtonBase,
    useTheme as useMuiTheme,
    Tooltip
} from '@mui/material';
import {
    Menu as MenuIcon,
    Moon,
    Sun,
    LogOut,
    Globe,
    User,
    Settings,
    Radio,
    LifeBuoy
} from 'lucide-react';
import NotificationBell from './NotificationBell';
import { useNFCBridge } from '../hooks/useNFCBridge';
import PrinterStatusMenu from './PrinterStatusMenu';
import SupportModal from './SupportModal';
import AiEngineStatus from './AiEngineStatus';
import { OrganizationSwitcher } from './OrganizationSwitcher';

interface HeaderProps {
    handleDrawerToggle: () => void;
}

export default function Header({ handleDrawerToggle }: HeaderProps) {
    const { user, logout } = useAuth();
    const { mode, toggleTheme } = useTheme();
    const { t, i18n } = useTranslation();
    const theme = useMuiTheme();
    const navigate = useNavigate();

    const nfc = useNFCBridge((tag) => {
        console.log('Tag Read via Bridge:', tag);
    });

    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [supportOpen, setSupportOpen] = useState(false);
    const open = Boolean(anchorEl);

    const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const toggleLanguage = () => {
        const newLang = i18n.language === 'en' ? 'fr' : 'en';
        i18n.changeLanguage(newLang);
    };

    const handleProfileClick = () => {
        handleMenuClose();
        navigate('/settings');
    };

    const getLandingUrl = () => {
        const host = window.location.hostname;
        if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:4321';
        if (host.includes('test')) return 'https://test.spoolytracker.com';
        return 'https://spoolytracker.com';
    };

    return (
        <AppBar
            position="fixed"
            color="inherit"
            elevation={0}
            sx={{
                bgcolor: 'background.paper', // Or transparent if you want true floating in body
                backdropFilter: 'blur(8px)',
                // Sidebar-alongside-Header layout
                width: '100%',
                borderBottom: `1px solid ${theme.palette.divider}`,
                zIndex: (theme) => theme.zIndex.drawer + 1 // Keep high to float above page content, but Sidebar (persistent) is side-by-side.
            }}
        >
            <Toolbar sx={{ height: '80px' }}>
                <Box sx={{ width: 260, display: 'flex', alignItems: 'center', gap: 1.5, pl: 2 }}>
                    <Box 
                        component="a" 
                        href={getLandingUrl()}
                        sx={{
                            height: 40,
                            borderRadius: '12px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'primary.main',
                            textDecoration: 'none',
                            cursor: 'pointer'
                        }}
                    >
                        <img src={mode === 'dark' ? '/logo/logo-horizontal-dark.png' : '/logo/logo-horizontal-light.png'} alt='logo-spoolytracker' style={{ height: 40 }}></img>
                    </Box>
                </Box>

                <IconButton
                    color="inherit"
                    aria-label="open drawer"
                    edge="start"
                    onClick={handleDrawerToggle}
                    sx={{
                        ml: 1,
                        bgcolor: 'primary.light',
                        color: 'primary.main',
                        borderRadius: '8px',
                        '&:hover': { bgcolor: 'secondary.light' }
                    }}
                >
                    <MenuIcon />
                </IconButton>

                <Box sx={{ flexGrow: 1 }} />

                <Box sx={{ display: { xs: 'none', sm: 'block' }, mr: 1 }}>
                    <OrganizationSwitcher variant="compact" />
                </Box>

                <AiEngineStatus />

                <Box sx={{ mr: 1 }}>
                    <NotificationBell />
                </Box>

                {/* Support & Help */}
                <Box sx={{ mr: 1 }}>
                    <Tooltip title={t('support.title', 'Help & Feedback')}>
                        <IconButton
                            onClick={() => setSupportOpen(true)}
                            sx={{
                                bgcolor: 'primary.light',
                                color: 'primary.main',
                                borderRadius: '8px',
                                '&:hover': { bgcolor: 'secondary.light' }
                            }}
                        >
                            <LifeBuoy size={20} />
                        </IconButton>
                    </Tooltip>
                </Box>

                {/* Theme Toggle */}
                <Box sx={{ mr: 1 }}>
                    <IconButton
                        onClick={toggleTheme}
                        sx={{
                            bgcolor: 'primary.light',
                            color: 'primary.main',
                            borderRadius: '8px',
                            '&:hover': { bgcolor: 'primary.light' }
                        }}
                    >
                        {mode === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                    </IconButton>
                </Box>

                {/* Desktop NFC Bridge Status */}
                <Tooltip title={nfc.connected ? `NFC Reader: ${nfc.readerName || 'Active'}` : 'Click to Retry Connection'}>
                    <ButtonBase
                        onClick={() => !nfc.connected && nfc.reconnect()}
                        sx={{
                            mr: 1,
                            borderRadius: '12px',
                            p: 0.5,
                            border: nfc.connected ? '1px solid #4ade80' : '1px dashed #9ca3af',
                            bgcolor: nfc.connected ? '#f0fdf4' : 'transparent',
                            transition: 'all 0.2s',
                            '&:hover': { bgcolor: nfc.connected ? '#dcfce7' : '#f3f4f6' }
                        }}
                    >
                        <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <img
                                src="/logo/logo-picto.png"
                                alt="Spooly NFC"
                                style={{
                                    width: 24,
                                    height: 24,
                                    opacity: nfc.connected ? 1 : 0.5,
                                    filter: nfc.connected ? 'none' : 'grayscale(100%)'
                                }}
                            />
                            <Box sx={{
                                position: 'absolute',
                                bottom: -4,
                                right: -4,
                                bgcolor: 'background.paper',
                                borderRadius: '50%',
                                padding: '2px',
                                display: 'flex'
                            }}>
                                <Radio
                                    size={12}
                                    color={nfc.connected ? '#16a34a' : '#9ca3af'}
                                    fill={nfc.connected ? '#16a34a' : 'none'}
                                />
                            </Box>
                        </Box>
                    </ButtonBase>
                </Tooltip>

                {/* Printer Status */}
                <PrinterStatusMenu />

                {/* User Profile */}
                <ButtonBase
                    onClick={handleMenuClick}
                    sx={{
                        bgcolor: 'primary.light',
                        borderRadius: '24px',
                        p: '6px 16px 6px 6px',
                        transition: 'all 0.2s',
                        '&:hover': { bgcolor: 'secondary.light' }
                    }}
                    data-tour="tour-profile"
                >
                    <Avatar
                        sx={{
                            width: 34,
                            height: 34,
                            bgcolor: 'primary.main',
                            mr: 1
                        }}
                    >
                        {(user?.displayName || user?.username || '?').charAt(0).toUpperCase()}
                    </Avatar>
                    <Settings size={20} color={theme.palette.primary.main} />
                </ButtonBase>

                <Menu
                    anchorEl={anchorEl}
                    open={open}
                    onClose={handleMenuClose}
                    onClick={handleMenuClose}
                    PaperProps={{
                        elevation: 0,
                        sx: {
                            overflow: 'visible',
                            filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
                            mt: 1.5,
                            width: 280,
                            borderRadius: '12px',
                            '& .MuiAvatar-root': {
                                width: 32,
                                height: 32,
                                ml: -0.5,
                                mr: 1,
                            },
                        },
                    }}
                    transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                    anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                >
                    <Box sx={{ p: 2, px: 3 }}>
                        <Typography variant="h6">{t('sidebar.welcome', 'Good Morning,')}</Typography>
                        <Typography variant="h4">{user?.displayName || user?.username}</Typography>
                        <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5 }}>
                            Role: {user?.systemRole ? (t(`common.${user.systemRole}`) || user.systemRole) : 'User'}
                        </Typography>
                    </Box>
                    <Divider />
                    <MenuItem onClick={toggleLanguage}>
                        <ListItemIcon>
                            <Globe size={20} />
                        </ListItemIcon>
                        {i18n.language === 'en' ? 'Français' : 'English'}
                    </MenuItem>
                    <MenuItem onClick={handleProfileClick}>
                        <ListItemIcon>
                            <User size={20} />
                        </ListItemIcon>
                        {t('settings.tabs.profile')}
                    </MenuItem>
                    <Divider />
                    <MenuItem onClick={logout} sx={{ color: 'error.main' }}>
                        <ListItemIcon sx={{ color: 'error.main' }}>
                            <LogOut size={20} />
                        </ListItemIcon>
                        {t('sidebar.logout')}
                    </MenuItem>
                </Menu>

                {/* Support Modal */}
                <SupportModal
                    open={supportOpen}
                    onClose={() => setSupportOpen(false)}
                />
            </Toolbar>
        </AppBar>
    );
}
