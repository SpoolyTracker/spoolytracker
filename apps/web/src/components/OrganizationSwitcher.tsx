import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Box,
    Button,
    ButtonBase,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    ListItemIcon,
    ListItemText,
    Menu,
    MenuItem,
    Stack,
    TextField,
    Typography,
    useTheme
} from '@mui/material';
import { Building2, Check, ChevronDown, Plus } from 'lucide-react';
import { api, BASE_URL } from '../api';
import type { UserOrganization } from '../api';
import { useAuth } from '../contexts/AuthContext';

type OrganizationSwitcherProps = {
    variant?: 'default' | 'compact';
};

export function OrganizationSwitcher({ variant = 'default' }: OrganizationSwitcherProps) {
    const { token } = useAuth();
    const { t } = useTranslation();
    const theme = useTheme();
    const [userOrgs, setUserOrgs] = useState<UserOrganization[]>([]);
    const [currentOrgId, setCurrentOrgId] = useState<number>(1);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newOrgName, setNewOrgName] = useState('');

    useEffect(() => {
        fetchOrganizations();
        const storedOrgId = localStorage.getItem('organization_id');
        if (storedOrgId) {
            setCurrentOrgId(parseInt(storedOrgId, 10));
        }
    }, []);

    const fetchOrganizations = async () => {
        try {
            const data = await api.getOrganizations();
            setUserOrgs(data);
        } catch (error) {
            console.error('Failed to fetch organizations:', error);
        }
    };

    const closeMenu = () => setAnchorEl(null);

    const switchOrganization = async (orgId: number) => {
        setCurrentOrgId(orgId);
        localStorage.setItem('organization_id', orgId.toString());
        closeMenu();
        try {
            await api.setActiveOrganization(orgId);
        } catch (error) {
            console.error('Failed to persist active organization:', error);
        }
        window.location.reload();
    };

    const handleAccept = async (e: React.MouseEvent, orgId: number) => {
        e.stopPropagation();
        try {
            await api.acceptInvitation(orgId);
            fetchOrganizations();
        } catch (error) {
            console.error('Failed to accept:', error);
        }
    };

    const handleDecline = async (e: React.MouseEvent, orgId: number) => {
        e.stopPropagation();
        if (!confirm(t('common.confirmDecline'))) return;
        try {
            await api.declineInvitation(orgId);
            fetchOrganizations();
        } catch (error) {
            console.error('Failed to decline:', error);
        }
    };

    const createOrganization = async () => {
        if (!newOrgName.trim()) return;

        try {
            const response = await fetch(`${BASE_URL}/organizations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ name: newOrgName }),
            });

            if (response.ok) {
                fetchOrganizations();
                setShowCreateModal(false);
                setNewOrgName('');
            }
        } catch (error) {
            console.error('Failed to create organization:', error);
        }
    };

    const currentOrgEntry = userOrgs.find((uo) => uo.organization.id === currentOrgId);
    const currentOrgName = currentOrgEntry ? currentOrgEntry.organization.name : t('common.selectOrg', 'Select Organization');
    const isCompact = variant === 'compact';

    return (
        <>
            <ButtonBase
                onClick={(event) => setAnchorEl(event.currentTarget)}
                sx={{
                    height: isCompact ? 38 : 40,
                    maxWidth: isCompact ? { sm: 180, md: 230 } : 320,
                    px: isCompact ? 1 : 1.5,
                    borderRadius: isCompact ? '999px' : '8px',
                    border: `1px solid ${theme.palette.divider}`,
                    bgcolor: isCompact ? 'background.paper' : 'action.hover',
                    color: 'text.primary',
                    gap: 0.75,
                    transition: 'all 0.2s',
                    '&:hover': {
                        borderColor: 'primary.main',
                        bgcolor: isCompact ? 'primary.light' : 'action.selected',
                    },
                }}
            >
                <Building2 size={isCompact ? 17 : 18} color={theme.palette.primary.main} />
                <Typography
                    variant="body2"
                    fontWeight={700}
                    noWrap
                    sx={{ minWidth: 0, maxWidth: isCompact ? { sm: 116, md: 168 } : 240 }}
                >
                    {currentOrgName}
                </Typography>
                <ChevronDown size={15} color={theme.palette.text.secondary} />
            </ButtonBase>

            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={closeMenu}
                PaperProps={{
                    elevation: 0,
                    sx: {
                        mt: 1,
                        width: 320,
                        maxWidth: 'calc(100vw - 24px)',
                        borderRadius: '10px',
                        border: `1px solid ${theme.palette.divider}`,
                        boxShadow: '0 12px 30px rgba(15, 23, 42, 0.18)',
                    },
                }}
                transformOrigin={{ horizontal: 'left', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'left', vertical: 'bottom' }}
            >
                {userOrgs.map((uo) => {
                    const isActive = uo.organization.id === currentOrgId;
                    const plan = uo.organization.plan ? uo.organization.plan.toUpperCase() : t('common.none', 'None');

                    return (
                        <MenuItem
                            key={uo.id}
                            onClick={() => uo.hasConfirmed && switchOrganization(uo.organization.id)}
                            disabled={!uo.hasConfirmed}
                            selected={isActive}
                            sx={{ alignItems: 'flex-start', py: 1.25, gap: 1 }}
                        >
                            <ListItemText
                                primary={uo.organization.name}
                                secondary={
                                    <Stack spacing={0.25}>
                                        <Typography variant="caption" color="text.secondary">
                                            {plan} - {uo.role.toUpperCase()}
                                        </Typography>
                                        {(uo.organization.manualPlanEndDate || uo.organization.stripeSubscriptionEndDate || uo.organization.trialEndsAt) && (
                                            <Typography variant="caption" color="text.disabled">
                                                {t('admin.manualPlanEndDate')}: {new Date(uo.organization.manualPlanEndDate || uo.organization.stripeSubscriptionEndDate || uo.organization.trialEndsAt!).toLocaleDateString()}
                                            </Typography>
                                        )}
                                        {!uo.hasConfirmed && (
                                            <Box sx={{ display: 'flex', gap: 1, pt: 0.5 }}>
                                                <Button
                                                    size="small"
                                                    variant="contained"
                                                    color="success"
                                                    onClick={(e) => handleAccept(e, uo.organization.id)}
                                                >
                                                    {t('common.accept', 'Accept')}
                                                </Button>
                                                <Button
                                                    size="small"
                                                    variant="outlined"
                                                    color="error"
                                                    onClick={(e) => handleDecline(e, uo.organization.id)}
                                                >
                                                    {t('common.decline', 'Decline')}
                                                </Button>
                                            </Box>
                                        )}
                                    </Stack>
                                }
                                primaryTypographyProps={{ fontWeight: 700, noWrap: true }}
                            />
                            {uo.hasConfirmed && isActive && (
                                <ListItemIcon sx={{ minWidth: 24, color: 'success.main', mt: 0.25 }}>
                                    <Check size={18} />
                                </ListItemIcon>
                            )}
                        </MenuItem>
                    );
                })}

                <Box sx={{ p: 1, borderTop: `1px solid ${theme.palette.divider}` }}>
                    <Button
                        fullWidth
                        variant="contained"
                        startIcon={<Plus size={16} />}
                        onClick={() => {
                            closeMenu();
                            setShowCreateModal(true);
                        }}
                    >
                        {t('common.createOrg', 'Create New Organization')}
                    </Button>
                </Box>
            </Menu>

            <Dialog open={showCreateModal} onClose={() => setShowCreateModal(false)} maxWidth="xs" fullWidth>
                <DialogTitle>{t('common.createOrg', 'Create New Organization')}</DialogTitle>
                <DialogContent>
                    <TextField
                        fullWidth
                        autoFocus
                        value={newOrgName}
                        onChange={(e) => setNewOrgName(e.target.value)}
                        label={t('settings.placeholders.organization', 'Organization name')}
                        onKeyDown={(e) => e.key === 'Enter' && createOrganization()}
                        sx={{ mt: 1 }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => {
                            setShowCreateModal(false);
                            setNewOrgName('');
                        }}
                    >
                        {t('common.cancel', 'Cancel')}
                    </Button>
                    <Button onClick={createOrganization} variant="contained">
                        {t('common.create', 'Create')}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
