import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { BASE_URL } from '../../api';
import type { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { DataGrid } from '@mui/x-data-grid';
import { frFR } from '@mui/x-data-grid/locales';
import {
    Box,
    Typography,
    Paper,
    Button,
    IconButton,
    Chip,
    TextField,
    InputAdornment,
    FormControl,
    InputLabel,
    Select,
    Tooltip,
    Snackbar,
    Alert,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    FormGroup,
    FormControlLabel as MuiFormControlLabel,
    Checkbox as MuiCheckbox
} from '@mui/material';
import {
    Plus,
    Edit2,
    Trash2,
    Search,
    RotateCcw,
    CheckSquare,
    XSquare,
    CheckCircle2,
    XCircle,
    Smartphone,
    ShieldCheck,
    Shield,
    User as UserIcon,
    Mail,
    Key,
    MoreVertical,
    Building2,
    Download
} from 'lucide-react';
import UserModal from '../../components/UserModal';
import AdminDeleteDialog from './AdminDeleteDialog';
import ReasonDialog from '../../components/ReasonDialog';
import type { User, Organization } from './types';

export default function UsersTab() {
    const { t } = useTranslation();
    const { token } = useAuth();

    const [users, setUsers] = useState<User[]>([]);
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filters, setFilters] = useState({ role: '', status: '', emailVerified: '' });
    const [selectedIds, setSelectedIds] = useState<{ type: 'include' | 'exclude'; ids: Set<number> }>({ type: 'include', ids: new Set() });

    // Modal State
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; item: User | null }>({ open: false, item: null });
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });
    const [actionMenu, setActionMenu] = useState<{ anchorEl: HTMLElement | null; user: User | null }>({ anchorEl: null, user: null });
    const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
    const [exportPlans, setExportPlans] = useState<string[]>(['beta']);
    const [reasonDialog, setReasonDialog] = useState<{ open: boolean; onConfirm: (reason: string) => void; title?: string }>({ open: false, onConfirm: () => {} });

    useEffect(() => {
        fetchData();
        fetchOrganizations();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${BASE_URL}/admin/users`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (response.ok) {
                setUsers(await response.json());
            }
        } catch (error) {
            console.error('Failed to fetch users:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchOrganizations = async () => {
        try {
            const response = await fetch(`${BASE_URL}/admin/organizations?admin=true`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (response.ok) {
                setOrganizations(await response.json());
            }
        } catch (error) {
            console.error('Failed to fetch organizations:', error);
        }
    };

    const handleDeactivateUser = (userId: number, currentStatus: boolean) => {
        setReasonDialog({
            open: true,
            title: currentStatus ? 'Deactivate User' : 'Activate User',
            onConfirm: async (reason) => {
                try {
                    const payload: any = { isActive: !currentStatus, reason };
                    if (!currentStatus) {
                        payload.isEmailVerified = true;
                    }
                    const response = await fetch(`${BASE_URL}/admin/users/${userId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify(payload),
                    });
                    if (response.ok) {
                        setSnackbar({ open: true, message: currentStatus ? 'User deactivated' : 'User activated', severity: 'success' });
                        fetchData();
                    }
                } catch (e) {
                    setSnackbar({ open: true, message: 'Network error', severity: 'error' });
                }
                setReasonDialog(prev => ({ ...prev, open: false }));
            }
        });
    };

    const handleVerifyEmail = (userId: number) => {
        setReasonDialog({
            open: true,
            title: "Valider l'email manuellement",
            onConfirm: async (reason) => {
                try {
                    const response = await fetch(`${BASE_URL}/admin/users/${userId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({ isEmailVerified: true, reason }),
                    });
                    if (response.ok) {
                        setSnackbar({ open: true, message: 'Email validé avec succès', severity: 'success' });
                        fetchData();
                    }
                } catch (e) {
                    setSnackbar({ open: true, message: 'Erreur réseau', severity: 'error' });
                }
                setReasonDialog(prev => ({ ...prev, open: false }));
            }
        });
    };

    const handleClearTokens = (userId: number) => {
        setReasonDialog({
            open: true,
            title: 'Clear Session Tokens',
            onConfirm: async (reason) => {
                try {
                    // API implementation for clearUserTokens needs to be updated to accept reason if it logs
                    // but usually it's a POST without body in some versions. Let's assume it supports it or we use fetch.
                    const response = await fetch(`${BASE_URL}/fcm/clear-tokens/${userId}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({ reason }),
                    });
                    if (response.ok) {
                        setSnackbar({ open: true, message: 'Tokens supprimés avec succès', severity: 'success' });
                        fetchData();
                    }
                } catch (error: any) {
                    setSnackbar({ open: true, message: error.message || 'Erreur lors de la suppression des tokens', severity: 'error' });
                }
                setReasonDialog(prev => ({ ...prev, open: false }));
            }
        });
    };

    const handleResetTour = (user: User) => {
        setReasonDialog({
            open: true,
            title: 'Reset User Tour',
            onConfirm: async (reason) => {
                try {
                    const res = await fetch(`${BASE_URL}/admin/users/${user.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({ introSeen: false, reason }),
                    });
                    if (res.ok) {
                        setSnackbar({ open: true, message: 'Tour reset successfully', severity: 'success' });
                        fetchData();
                    }
                } catch (e) {
                    setSnackbar({ open: true, message: 'Failed to reset tour', severity: 'error' });
                }
                setReasonDialog(prev => ({ ...prev, open: false }));
            }
        });
    };

    const handleSaveUser = async (data: any) => {
        let payload = { ...data };
        if (data.organizationId === 'create_new' && data.newOrganizationName) {
            const orgResponse = await fetch(`${BASE_URL}/admin/organizations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ name: data.newOrganizationName }),
            });
            if (orgResponse.ok) {
                const newOrg = await orgResponse.json();
                payload.organizationId = newOrg.id;
            }
        }

        const url = editingUser ? `${BASE_URL}/admin/users/${editingUser.id}` : `${BASE_URL}/admin/users`;
        const method = editingUser ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload),
        });

        if (response.ok) {
            setSearchQuery('');
            fetchData();
        } else {
            throw new Error('Failed to save user');
        }
    };

    const handleDeleteConfirm = async (transferToOrgId: number | null) => {
        if (!deleteDialog.item) return;
        setReasonDialog({
            open: true,
            title: 'Delete User',
            onConfirm: async (reason) => {
                const url = `${BASE_URL}/admin/users/${deleteDialog.item?.id}${transferToOrgId ? `?transferToOrgId=${transferToOrgId}` : ''}`;
                const response = await fetch(url, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reason }),
                });

                if (response.ok) {
                    fetchData();
                    setSnackbar({ open: true, message: 'User deleted', severity: 'success' });
                    setDeleteDialog({ open: false, item: null });
                } else {
                    setSnackbar({ open: true, message: 'Delete failed', severity: 'error' });
                }
                setReasonDialog(prev => ({ ...prev, open: false }));
            }
        });
    };

    const handleMassUpdate = (updates: { isActive?: boolean; isEmailVerified?: boolean }) => {
        setReasonDialog({
            open: true,
            title: 'Mass Update Users',
            onConfirm: async (reason) => {
                try {
                    const response = await fetch(`${BASE_URL}/admin/users/batch`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({ ids: Array.from(selectedIds.ids), updates, reason }),
                    });
                    if (response.ok) {
                        const result = await response.json();
                        setSnackbar({ open: true, message: `${result.updated} user(s) updated`, severity: 'success' });
                        setSelectedIds({ type: 'include', ids: new Set() });
                        fetchData();
                    }
                } catch (e) {
                    setSnackbar({ open: true, message: 'Network error', severity: 'error' });
                }
                setReasonDialog(prev => ({ ...prev, open: false }));
            }
        });
    };

    const handleResendVerification = async (userId: number) => {
        try {
            const res = await fetch(`${BASE_URL}/admin/users/${userId}/resend-verification`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                setSnackbar({ open: true, message: 'Email de vérification envoyé', severity: 'success' });
            } else {
                const err = await res.json();
                setSnackbar({ open: true, message: err.message || 'Échec de l\'envoi', severity: 'error' });
            }
        } catch (e) {
            setSnackbar({ open: true, message: 'Erreur réseau', severity: 'error' });
        }
    };

    const handleResendPasswordReset = async (userId: number) => {
        try {
            const res = await fetch(`${BASE_URL}/admin/users/${userId}/resend-password-reset`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                setSnackbar({ open: true, message: 'Email de réinitialisation envoyé', severity: 'success' });
            } else {
                setSnackbar({ open: true, message: 'Échec de l\'envoi', severity: 'error' });
            }
        } catch (e) {
            setSnackbar({ open: true, message: 'Erreur réseau', severity: 'error' });
        }
    };

    const handleMassResendVerification = () => {
        const ids = Array.from(selectedIds.ids);
        setReasonDialog({
            open: true,
            title: 'Mass Resend Verification Emails',
            onConfirm: async (reason) => {
                setSnackbar({ open: true, message: `Envoi en cours pour ${ids.length} utilisateurs...`, severity: 'success' });
                let successCount = 0;
                for (const id of ids) {
                    try {
                        const res = await fetch(`${BASE_URL}/admin/users/${id}/resend-verification`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                            body: JSON.stringify({ reason })
                        });
                        if (res.ok) successCount++;
                    } catch (e) { }
                }
                setSnackbar({ open: true, message: `${successCount} emails de vérification envoyés`, severity: 'success' });
                setSelectedIds({ type: 'include', ids: new Set() });
                setReasonDialog(prev => ({ ...prev, open: false }));
            }
        });
    };

    const handleMassResendPasswordReset = () => {
        const ids = Array.from(selectedIds.ids);
        setReasonDialog({
            open: true,
            title: 'Mass Resend Password Reset Emails',
            onConfirm: async (reason) => {
                setSnackbar({ open: true, message: `Envoi en cours pour ${ids.length} utilisateurs...`, severity: 'success' });
                let successCount = 0;
                for (const id of ids) {
                    try {
                        const res = await fetch(`${BASE_URL}/admin/users/${id}/resend-password-reset`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                            body: JSON.stringify({ reason })
                        });
                        if (res.ok) successCount++;
                    } catch (e) { }
                }
                setSnackbar({ open: true, message: `${successCount} emails de réinitialisation envoyés`, severity: 'success' });
                setSelectedIds({ type: 'include', ids: new Set() });
                setReasonDialog(prev => ({ ...prev, open: false }));
            }
        });
    };

    const handleActionMenuOpen = (event: React.MouseEvent<HTMLElement>, user: User) => {
        setActionMenu({ anchorEl: event.currentTarget, user });
    };

    const handleActionMenuClose = () => {
        setActionMenu({ anchorEl: null, user: null });
    };

    const handleExport = async () => {
        setIsExportDialogOpen(false);
        try {
            const planParam = exportPlans.join(',');
            const url = `${BASE_URL}/admin/users/export${planParam ? `?plan=${planParam}` : ''}`;
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (response.ok) {
                const data = await response.json();
                if (data.length === 0) {
                    setSnackbar({ open: true, message: 'Aucune donnée à exporter pour ces plans', severity: 'error' });
                    return;
                }

                const headers = ['idorga', 'orga', 'plan', 'iduser', 'username', 'nom', 'prenom', 'email'];
                const csvRows = [
                    headers.join(','),
                    ...data.map((row: any) => headers.map(header => {
                        const val = row[header] ?? '';
                        return `"${String(val).replace(/"/g, '""')}"`;
                    }).join(','))
                ];
                const csvContent = "\ufeff" + csvRows.join('\n'); // Add BOM for Excel UTF-8 support

                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                const fileName = `export_users_${exportPlans.length > 0 ? exportPlans.join('_') : 'all'}_${new Date().toISOString().split('T')[0]}.csv`;
                link.href = URL.createObjectURL(blob);
                link.setAttribute('download', fileName);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                setSnackbar({ open: true, message: `Export CSV réussi (${data.length} lignes)`, severity: 'success' });
            } else {
                setSnackbar({ open: true, message: 'Erreur lors de l\'export', severity: 'error' });
            }
        } catch (error) {
            console.error('Export failed:', error);
            setSnackbar({ open: true, message: 'Erreur réseau', severity: 'error' });
        }
    };

    const columns: GridColDef[] = useMemo(() => [
        {
            field: 'username',
            headerName: t('common.username'),
            flex: 1,
            minWidth: 120,
            renderCell: (params: GridRenderCellParams) => (
                <Tooltip title={`ID: ${params.row.id}${params.row.googleId ? ' (Google Account)' : params.row.appleId ? ' (Apple Account)' : ''}`} arrow>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {params.row.googleId && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                            </svg>
                        )}
                        {params.row.appleId && (
                            <svg width="14" height="14" viewBox="0 0 384 512" fill="currentColor">
                                <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 21.8-88.5 21.8-14.7 0-51.4-22.2-84.6-20.6-53 1.1-102.3 31.2-126.3 76.8-42.2 79.9-10.9 199 29.1 259.8 19.5 29.7 44.1 57.9 76.2 56.7 31.3-1.1 43.1-20.5 81.2-20.5 37.5 0 49.3 20.5 81.8 19.9 33.1-.6 54.4-25.3 74.4-54.1 23.2-34.1 32.8-67.1 33.1-68.8-.7-.3-63.5-24.8-63.8-91.5zM232.1 105.9c33.3-40.6 30.2-76.1 27.8-92.7-27.1 1.4-62.7 19.8-83.3 43.7-18.8 21.2-35.4 57.4-30.8 90.3 30.1 2.3 62-18.7 86.3-45.3z"/>
                            </svg>
                        )}
                        <Typography variant="body2" sx={{ cursor: 'help' }}>
                            {params.value}
                        </Typography>
                    </Box>
                </Tooltip>
            )
        },
        { field: 'email', headerName: t('common.email'), flex: 1.4, minWidth: 180 },
        {
            field: 'fullName',
            headerName: t('common.name'),
            flex: 1,
            minWidth: 130,
            valueGetter: (_, row) => {
                const first = row.firstName || '';
                const last = row.lastName || '';
                const full = `${first} ${last}`.trim();
                return full || row.username;
            }
        },
        {
            field: 'systemRole',
            headerName: t('common.role'),
            width: 120,
            renderCell: (params: GridRenderCellParams) => (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, height: '100%' }}>
                    {params.row.isSuperAdmin ? (
                        <Chip icon={<ShieldCheck size={14} />} label="S.ADMIN" color="error" size="small" variant="outlined" />
                    ) : params.row.systemRole === 'admin' ? (
                        <Chip icon={<Shield size={14} />} label="ADMIN" color="primary" size="small" variant="outlined" />
                    ) : (
                        <Chip icon={<UserIcon size={14} />} label="USER" size="small" variant="outlined" />
                    )}
                </Box>
            )
        },
        {
            field: 'isActive',
            headerName: t('common.status'),
            width: 90,
            renderCell: (params: GridRenderCellParams) => (
                <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                    {params.value ? (
                        <Chip label={t('common.active')} color="success" size="small" variant="outlined" />
                    ) : (
                        <Chip label={t('common.inactive')} color="default" size="small" variant="outlined" />
                    )}
                </Box>
            )
        },
        {
            field: 'isEmailVerified',
            headerName: t('admin.verified'),
            width: 75,
            align: 'center',
            renderCell: (params: GridRenderCellParams) => (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                    {params.value ? <CheckCircle2 size={18} color="#10b981" /> : <XCircle size={18} color="#ef4444" />}
                </Box>
            )
        },
        {
            field: 'mobile',
            headerName: t('admin.mobile'),
            width: 90,
            renderCell: (params: GridRenderCellParams) => (
                <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', height: '100%' }}>
                    {params.row.pushTokens?.length > 0 && (
                        <Tooltip title={params.row.pushTokens.map((t: any) => t.deviceName || 'Appareil inconnu').join(', ')}>
                            <Smartphone size={16} color="#6366f1" style={{ cursor: 'help' }} />
                        </Tooltip>
                    )}
                    <Typography variant="caption">{params.row.pushTokens?.length || 0}</Typography>
                </Box>
            )
        },
        {
            field: 'userOrganizations',
            headerName: t('common.organizations'),
            flex: 1,
            minWidth: 140,
            renderCell: (params: GridRenderCellParams) => {
                const orgs = params.row.userOrganizations || [];
                if (orgs.length === 0) return null;

                const tooltipTitle = (
                    <Box sx={{ p: 0.5 }}>
                        {orgs.map((uo: any, idx: number) => (
                            <Box key={idx} sx={{ display: 'flex', flexDirection: 'column', mb: idx === orgs.length - 1 ? 0 : 1 }}>
                                <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block' }}>
                                    {uo.organization?.name || 'Unknown'}
                                </Typography>
                                <Typography variant="caption" sx={{ opacity: 0.8, fontSize: '0.65rem' }}>
                                    ID: {uo.organization?.id}
                                </Typography>
                            </Box>
                        ))}
                    </Box>
                );

                return (
                    <Tooltip title={tooltipTitle} arrow placement="top">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'help' }}>
                            <Building2 size={16} color="#64748b" />
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {orgs.length}
                            </Typography>
                        </Box>
                    </Tooltip>
                );
            }
        },
        {
            field: 'lastLoginAt',
            headerName: t('admin.lastLogin', 'Dernière connexion'),
            width: 145,
            valueFormatter: (value) => value ? new Date(value).toLocaleString() : t('common.never', 'Jamais')
        },
        {
            field: 'actions',
            headerName: t('common.actions'),
            width: 95,
            sortable: false,
            filterable: false,
            align: 'right',
            headerAlign: 'right',
            renderCell: (params: GridRenderCellParams) => (
                <Box sx={{ display: 'flex', gap: 0.25, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                    <Tooltip title={t('common.edit')}>
                        <IconButton size="small" onClick={() => { setEditingUser(params.row); setIsUserModalOpen(true); }}><Edit2 size={16} /></IconButton>
                    </Tooltip>
                    <Tooltip title={t('common.more_actions', 'Plus d\'actions')}>
                        <IconButton size="small" onClick={(e) => handleActionMenuOpen(e, params.row)}>
                            <MoreVertical size={16} />
                        </IconButton>
                    </Tooltip>
                </Box>
            )
        }
    ], [t]);

    const filteredUsers = useMemo(() => {
        let data = users.filter(u =>
            u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (u.firstName + ' ' + u.lastName).toLowerCase().includes(searchQuery.toLowerCase())
        );
        if (filters.role) data = data.filter(u => u.systemRole === filters.role || (filters.role === 'super_admin' && u.isSuperAdmin));
        if (filters.status === 'active') data = data.filter(u => u.isActive);
        if (filters.status === 'inactive') data = data.filter(u => !u.isActive);
        if (filters.emailVerified === 'verified') data = data.filter(u => u.isEmailVerified);
        if (filters.emailVerified === 'unverified') data = data.filter(u => !u.isEmailVerified);
        return data;
    }, [users, searchQuery, filters]);

    return (
        <Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                        <TextField
                            placeholder="Search users..."
                            size="small"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <Search size={18} />
                                    </InputAdornment>
                                ),
                            }}
                            sx={{ width: 300, bgcolor: 'white' }}
                        />
                        <FormControl size="small" sx={{ minWidth: 120, bgcolor: 'white' }}>
                            <InputLabel>Role</InputLabel>
                            <Select
                                value={filters.role}
                                label="Role"
                                onChange={(e) => setFilters({ ...filters, role: e.target.value })}
                            >
                                <MenuItem value="">All</MenuItem>
                                <MenuItem value="super_admin">Super Admin</MenuItem>
                                <MenuItem value="admin">Admin</MenuItem>
                                <MenuItem value="moderator">Moderator</MenuItem>
                                <MenuItem value="user">User</MenuItem>
                            </Select>
                        </FormControl>
                        <FormControl size="small" sx={{ minWidth: 120, bgcolor: 'white' }}>
                            <InputLabel>Status</InputLabel>
                            <Select
                                value={filters.status}
                                label="Status"
                                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                            >
                                <MenuItem value="">All</MenuItem>
                                <MenuItem value="active">Active</MenuItem>
                                <MenuItem value="inactive">Inactive</MenuItem>
                            </Select>
                        </FormControl>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                            variant="outlined"
                            startIcon={<Download size={18} />}
                            onClick={() => setIsExportDialogOpen(true)}
                            sx={{ borderRadius: 2 }}
                        >
                            Exporter
                        </Button>
                        <Button
                            variant="contained"
                            startIcon={<Plus size={20} />}
                            onClick={() => { setEditingUser(null); setIsUserModalOpen(true); }}
                            sx={{ px: 3, borderRadius: 2 }}
                        >
                            {t('admin.addUser')}
                        </Button>
                    </Box>
                </Box>

                {selectedIds.ids.size > 0 && (
                    <Paper sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 2, bgcolor: 'primary.50', border: '1px solid', borderColor: 'primary.100', borderRadius: 2 }} elevation={0}>
                        <Typography variant="subtitle2" sx={{ ml: 1, color: 'primary.700', fontWeight: 600 }}>
                            {selectedIds.ids.size} selected
                        </Typography>
                        <Box sx={{ flexGrow: 1 }} />
                        <Button size="small" onClick={() => handleMassUpdate({ isActive: true, isEmailVerified: true })} startIcon={<CheckSquare size={16} />} color="success" variant="outlined">
                            Activate
                        </Button>
                        <Button size="small" onClick={() => handleMassUpdate({ isActive: false })} startIcon={<XSquare size={16} />} color="error" variant="outlined">
                            Deactivate
                        </Button>
                        <Button size="small" onClick={() => handleMassUpdate({ isEmailVerified: true })} startIcon={<CheckCircle2 size={16} />} color="success" variant="outlined">
                            Validate Email
                        </Button>
                        <Button size="small" onClick={handleMassResendVerification} startIcon={<Mail size={16} />} color="primary" variant="outlined">
                            Verification
                        </Button>
                        <Button size="small" onClick={handleMassResendPasswordReset} startIcon={<Key size={16} />} color="primary" variant="outlined">
                            Reset Pwd
                        </Button>
                    </Paper>
                )}
            </Box>

            <Paper sx={{ borderRadius: 1, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                <DataGrid
                    rows={filteredUsers}
                    columns={columns}
                    autoHeight
                    loading={loading}
                    pageSizeOptions={[10, 25, 50, 100]}
                    initialState={{
                        pagination: { paginationModel: { pageSize: 10 } }
                    }}
                    disableRowSelectionOnClick
                    checkboxSelection
                    onRowSelectionModelChange={(newSelection: any) => setSelectedIds(newSelection)}
                    rowSelectionModel={selectedIds}
                    rowHeight={56}
                    localeText={frFR.components.MuiDataGrid.defaultProps.localeText}
                    sx={(theme) => ({
                        border: 'none',
                        borderRadius: 1,
                        '& .MuiDataGrid-cell:focus': { outline: 'none' },
                        '& .MuiDataGrid-columnHeaders': {
                            backgroundColor: theme.palette.mode === 'dark' ? '#27304d' : '#f8f9fa',
                            fontWeight: 'bold',
                        },
                        '& .MuiDataGrid-cell': {
                            minWidth: 0,
                        },
                        '& .MuiDataGrid-cell[data-field="email"], & .MuiDataGrid-cell[data-field="lastLoginAt"]': {
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        },
                    })}
                />
            </Paper>

            <UserModal
                open={isUserModalOpen}
                onClose={() => setIsUserModalOpen(false)}
                onSubmit={handleSaveUser}
                initialData={editingUser}
                organizations={organizations}
            />

            <AdminDeleteDialog
                open={deleteDialog.open}
                type="user"
                item={deleteDialog.item}
                organizations={organizations}
                onClose={() => setDeleteDialog({ open: false, item: null })}
                onConfirm={handleDeleteConfirm}
            />

            <ReasonDialog
                open={reasonDialog.open}
                onClose={() => setReasonDialog(prev => ({ ...prev, open: false }))}
                onConfirm={reasonDialog.onConfirm}
                title={reasonDialog.title}
            />

            <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
                <Alert onClose={() => setSnackbar(s => ({ ...s, open: false }))} severity={snackbar.severity} sx={{ width: '100%', borderRadius: 2 }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>

            {/* Export Selection Dialog */}
            <Dialog open={isExportDialogOpen} onClose={() => setIsExportDialogOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ fontWeight: 'bold' }}>Exporter les emails</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" sx={{ mb: 2 }}>
                        Sélectionnez les plans d'organisation à inclure dans l'export CSV.
                    </Typography>
                    <FormGroup>
                        {['beta', 'pro', 'enterprise', 'free'].map((plan) => (
                            <MuiFormControlLabel
                                key={plan}
                                control={
                                    <MuiCheckbox
                                        checked={exportPlans.includes(plan)}
                                        onChange={(e) => {
                                            if (e.target.checked) setExportPlans([...exportPlans, plan]);
                                            else setExportPlans(exportPlans.filter(p => p !== plan));
                                        }}
                                    />
                                }
                                label={plan.charAt(0).toUpperCase() + plan.slice(1)}
                            />
                        ))}
                    </FormGroup>
                    <Typography variant="caption" color="textSecondary" sx={{ mt: 2, display: 'block' }}>
                        * Si aucun n'est sélectionné, l'export inclura tous les utilisateurs.
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ p: 2.5 }}>
                    <Button onClick={() => setIsExportDialogOpen(false)} color="inherit">Annuler</Button>
                    <Button onClick={handleExport} variant="contained" startIcon={<Download size={18} />}>
                        Télécharger CSV
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Additional Actions Menu */}
            <Menu
                anchorEl={actionMenu.anchorEl}
                open={Boolean(actionMenu.anchorEl)}
                onClose={handleActionMenuClose}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
                {actionMenu.user && !actionMenu.user.isEmailVerified && (
                    <MenuItem onClick={() => { handleResendVerification(actionMenu.user!.id); handleActionMenuClose(); }}>
                        <ListItemIcon><Mail size={18} /></ListItemIcon>
                        <ListItemText primary="Renvoyer vérification" />
                    </MenuItem>
                )}
                {actionMenu.user && !actionMenu.user.isEmailVerified && (
                    <MenuItem onClick={() => { handleVerifyEmail(actionMenu.user!.id); handleActionMenuClose(); }}>
                        <ListItemIcon><CheckCircle2 size={18} color="#10b981" /></ListItemIcon>
                        <ListItemText primary="Valider l'email manuellement" />
                    </MenuItem>
                )}
                {actionMenu.user && (
                    <MenuItem onClick={() => { handleResendPasswordReset(actionMenu.user!.id); handleActionMenuClose(); }}>
                        <ListItemIcon><Key size={18} /></ListItemIcon>
                        <ListItemText primary="Reset mot de passe" />
                    </MenuItem>
                )}
                <MenuItem onClick={() => { handleClearTokens(actionMenu.user!.id); handleActionMenuClose(); }}>
                    <ListItemIcon><Smartphone size={18} color="#ed6c02" /></ListItemIcon>
                    <ListItemText primary="Nettoyer tokens mobiles" />
                </MenuItem>
                <MenuItem onClick={() => { handleResetTour(actionMenu.user!); handleActionMenuClose(); }} disabled={actionMenu.user?.introSeen === false}>
                    <ListItemIcon><RotateCcw size={18} /></ListItemIcon>
                    <ListItemText primary={t('admin.resetTour')} />
                </MenuItem>
                <MenuItem onClick={() => { handleDeactivateUser(actionMenu.user!.id, actionMenu.user!.isActive); handleActionMenuClose(); }}>
                    <ListItemIcon>{actionMenu.user?.isActive ? <XSquare size={18} color="#ed6c02" /> : <CheckSquare size={18} color="#2e7d32" />}</ListItemIcon>
                    <ListItemText primary={actionMenu.user?.isActive ? t('common.deactivate') : t('common.activate')} />
                </MenuItem>
                <MenuItem onClick={() => { setDeleteDialog({ open: true, item: actionMenu.user }); handleActionMenuClose(); }} sx={{ color: 'error.main' }}>
                    <ListItemIcon><Trash2 size={18} color="#d32f2f" /></ListItemIcon>
                    <ListItemText primary={t('common.delete')} />
                </MenuItem>
            </Menu>
        </Box>
    );
}
