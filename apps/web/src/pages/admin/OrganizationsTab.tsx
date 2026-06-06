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
    Select,
    MenuItem,
    Tooltip,
    TextField,
    InputAdornment,
    Snackbar,
    Alert
} from '@mui/material';
import {
    Plus,
    Edit2,
    Trash2,
    Search,
    Shield,
    RotateCcw,
    CreditCard
} from 'lucide-react';

import OrganizationModal from '../../components/OrganizationModal';
import OrgUsersModal from '../../components/OrgUsersModal';
import AdminDeleteDialog from './AdminDeleteDialog';
import ReasonDialog from '../../components/ReasonDialog';
import type { Organization } from './types';

export default function OrganizationsTab() {
    const { t } = useTranslation();
    const { token } = useAuth();

    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState<{ type: 'include' | 'exclude'; ids: Set<number> }>({ type: 'include', ids: new Set() });
    const [massActionPlan, setMassActionPlan] = useState('');


    // Modal State
    const [isOrgModalOpen, setIsOrgModalOpen] = useState(false);
    const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
    const [isOrgUsersModalOpen, setIsOrgUsersModalOpen] = useState(false);
    const [viewingOrgUsers, setViewingOrgUsers] = useState<{ id: number, name: string } | null>(null);
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; item: Organization | null }>({ open: false, item: null });
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });
    const [reasonDialog, setReasonDialog] = useState<{ open: boolean; onConfirm: (reason: string) => void; title?: string }>({ open: false, onConfirm: () => {} });

    useEffect(() => {
        fetchData();
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const response = await fetch(`${BASE_URL}/admin/users`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (response.ok) {
                setUsers(await response.json());
            }
        } catch (error) {
            console.error('Failed to fetch users:', error);
        }
    };


    const fetchData = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${BASE_URL}/admin/organizations?admin=true`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (response.ok) {
                setOrganizations(await response.json());
            }
        } catch (error) {
            console.error('Failed to fetch organizations:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveOrg = async (data: any) => {
        const title = editingOrg ? 'Edit Organization' : 'Create Organization';

        setReasonDialog({
            open: true,
            title,
            onConfirm: async (reason) => {
                try {
                    let response;
                    if (editingOrg) {
                        // 1. Update basic details
                        response = await fetch(`${BASE_URL}/admin/organizations/${editingOrg.id}?admin=true`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                            body: JSON.stringify({ name: data.name, slug: data.slug, reason }),
                        });
                    } else {
                        // 1. Create new organization
                        response = await fetch(`${BASE_URL}/admin/organizations`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                            body: JSON.stringify({ name: data.name, ownerId: data.ownerId, reason }),
                        });
                    }

                    
                    if (!response.ok) {
                        const errData = await response.json().catch(() => ({}));
                        throw new Error(errData.message || `Failed to ${editingOrg ? 'update' : 'create'} organization`);
                    }

                    const savedOrg = await response.json();

                    // 2. Update Plan and End Date
                    if (data.plan) {
                        const planPayload: any = { 
                            plan: data.plan, 
                            reason,
                            endDate: data.manualPlanEndDate || '' 
                        };
                        const planResponse = await fetch(`${BASE_URL}/admin/organizations/${savedOrg.id}/plan?admin=true`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                            body: JSON.stringify(planPayload),
                        });
                        if (!planResponse.ok) {
                            throw new Error('Failed to update organization plan');
                        }
                    }
                    
                    setSnackbar({ open: true, message: `Organization ${editingOrg ? 'updated' : 'created'} successfully`, severity: 'success' });
                    setIsOrgModalOpen(false);
                    fetchData();
                } catch (error: any) {
                    setSnackbar({ open: true, message: error.message || 'Update failed', severity: 'error' });
                }
                setReasonDialog(prev => ({ ...prev, open: false }));
            }
        });
    };


    const handleClearStripeData = (orgId: number) => {
        setReasonDialog({
            open: true,
            title: 'Clear Stripe Data',
            onConfirm: async (reason) => {
                try {
                    const response = await fetch(`${BASE_URL}/admin/organizations/${orgId}/clear-stripe`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({ reason }),
                    });
                    if (response.ok) {
                        setSnackbar({ open: true, message: 'Stripe data cleared', severity: 'success' });
                        fetchData();
                    }
                } catch (e) {
                    setSnackbar({ open: true, message: 'Network error', severity: 'error' });
                }
                setReasonDialog(prev => ({ ...prev, open: false }));
            }
        });
    };

    const handleEmulate = (orgId: number) => {
        if (confirm('Emulate this organization? You will see the app as an admin of this organization.')) {
            localStorage.setItem('emulated_organization_id', orgId.toString());
            window.location.href = '/';
        }
    };

    const handleDeleteConfirm = async (transferToOrgId: number | null) => {
        if (!deleteDialog.item) return;
        setReasonDialog({
            open: true,
            title: 'Delete Organization',
            onConfirm: async (reason) => {
                const url = `${BASE_URL}/admin/organizations/${deleteDialog.item?.id}${transferToOrgId ? `?transferToOrgId=${transferToOrgId}` : ''}`;
                const response = await fetch(url, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reason }),
                });

                if (response.ok) {
                    fetchData();
                    setSnackbar({ open: true, message: 'Organization deleted', severity: 'success' });
                    setDeleteDialog({ open: false, item: null });
                } else {
                    setSnackbar({ open: true, message: 'Delete failed', severity: 'error' });
                }
                setReasonDialog(prev => ({ ...prev, open: false }));
            }
        });
    };

    const handleMassUpdate = () => {
        setReasonDialog({
            open: true,
            title: 'Mass Update Organizations',
            onConfirm: async (reason) => {
                try {
                    const response = await fetch(`${BASE_URL}/admin/organizations/batch`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({ ids: Array.from(selectedIds.ids), updates: { plan: massActionPlan }, reason }),
                    });
                    if (response.ok) {
                        const result = await response.json();
                        setSnackbar({ open: true, message: `${result.updated} organization(s) updated`, severity: 'success' });
                        setSelectedIds({ type: 'include', ids: new Set() });
                        setMassActionPlan('');
                        fetchData();
                    }
                } catch (e) {
                    setSnackbar({ open: true, message: 'Network error', severity: 'error' });
                }
                setReasonDialog(prev => ({ ...prev, open: false }));
            }
        });
    };

    const columns: GridColDef[] = useMemo(() => [
        { 
            field: 'name', 
            headerName: t('common.name'), 
            flex: 1, 
            minWidth: 150,
            renderCell: (params: GridRenderCellParams) => (
                <Tooltip title={`ID: ${params.row.id}`} arrow>
                    <Typography variant="body2" sx={{ cursor: 'help' }}>
                        {params.value}
                    </Typography>
                </Tooltip>
            )
        },
        { field: 'slug', headerName: 'Slug', flex: 1, minWidth: 120 },
        {
            field: 'plan',
            headerName: t('common.plan'),
            width: 110,
            renderCell: (params: GridRenderCellParams) => (
                <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                    <Chip
                        label={(params.value || 'free').toString().toUpperCase()}
                        color={params.value === 'pro' ? 'primary' : params.value === 'enterprise' ? 'secondary' : params.value === 'beta' ? 'info' : 'default'}
                        size="small"
                        variant={params.value === 'free' ? 'outlined' : 'filled'}
                    />
                </Box>
            )
        },
        {
            field: 'manualPlanEndDate',
            headerName: t('admin.grantEnd') || 'Date de fin',
            width: 140,
            renderCell: (params: GridRenderCellParams) => {
                if (!params.value) return <Typography variant="body2" color="text.secondary">-</Typography>;
                
                const date = new Date(params.value);
                const isExpired = date < new Date();
                
                return (
                    <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                        <Chip
                            label={date.toLocaleDateString()}
                            size="small"
                            color={isExpired ? 'error' : 'warning'}
                            variant={isExpired ? 'filled' : 'outlined'}
                            sx={{ fontWeight: 'bold' }}
                        />
                    </Box>
                );
            }
        },
        {
            field: 'stripe',
            headerName: 'Stripe',
            flex: 1,
            minWidth: 150,
            renderCell: (params: GridRenderCellParams) => (
                <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
                    {params.row.stripeCustomerId && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <CreditCard size={12} />
                            <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{params.row.stripeCustomerId}</Typography>
                        </Box>
                    )}
                    {params.row.stripeSubscriptionId && (
                        <Typography variant="caption" color="textSecondary" sx={{ fontFamily: 'monospace' }}>{params.row.stripeSubscriptionId}</Typography>
                    )}
                </Box>
            )
        },
        {
            field: 'usersCount',
            headerName: t('common.users'),
            width: 120,
            align: 'center',
            renderCell: (params: GridRenderCellParams) => (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, height: '100%' }}>
                    <Chip
                        label={params.row.usersCount || params.row.userCount || 0}
                        size="small"
                        variant="outlined"
                        onClick={() => {
                            setViewingOrgUsers({ id: params.row.id, name: params.row.name });
                            setIsOrgUsersModalOpen(true);
                        }}
                        sx={{ cursor: 'pointer' }}
                    />
                </Box>
            )
        },
        {
            field: 'createdAt',
            headerName: t('common.createdAt') || 'Créé le',
            width: 140,
            renderCell: (params: GridRenderCellParams) => (
                <Typography variant="body2" color="textSecondary">
                    {new Date(params.value).toLocaleDateString()}
                </Typography>
            )
        },
        {
            field: 'actions',
            headerName: t('common.actions'),
            width: 180,
            sortable: false,
            filterable: false,
            align: 'right',
            headerAlign: 'right',
            renderCell: (params: GridRenderCellParams) => (
                <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                    <Tooltip title="Emulate Organization">
                        <IconButton size="small" onClick={() => handleEmulate(params.row.id)} color="success">
                            <Shield size={16} />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Clear Stripe Data">
                        <IconButton size="small" onClick={() => handleClearStripeData(params.row.id)} color="warning">
                            <RotateCcw size={16} />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title={t('common.edit')}>
                        <IconButton size="small" onClick={() => { setEditingOrg(params.row); setIsOrgModalOpen(true); }}><Edit2 size={16} /></IconButton>
                    </Tooltip>
                    <Tooltip title={t('common.delete')}>
                        <IconButton size="small" onClick={() => setDeleteDialog({ open: true, item: params.row })} color="error"><Trash2 size={16} /></IconButton>
                    </Tooltip>
                </Box>
            )
        }
    ], [t]);

    const filteredOrgs = useMemo(() => {
        return organizations.filter(org =>
            org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            org.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (org.stripeSubscriptionId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (org.stripeCustomerId || '').toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [organizations, searchQuery]);

    return (
        <Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <TextField
                        placeholder="Search organizations..."
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
                    <Button
                        variant="contained"
                        startIcon={<Plus size={20} />}
                        onClick={() => { setEditingOrg(null); setIsOrgModalOpen(true); }}
                        sx={{ px: 3, borderRadius: 2 }}
                    >
                        {t('admin.addOrg')}
                    </Button>
                </Box>

                
                {selectedIds.ids.size > 0 && (
                    <Paper sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 2, bgcolor: 'primary.50', border: '1px solid', borderColor: 'primary.100', borderRadius: 2 }} elevation={0}>
                        <Typography variant="subtitle2" sx={{ ml: 1, color: 'primary.700', fontWeight: 600 }}>
                            {selectedIds.ids.size} selected
                        </Typography>
                        <Box sx={{ flexGrow: 1 }} />
                        <Select
                            size="small"
                            displayEmpty
                            value={massActionPlan}
                            onChange={(e) => setMassActionPlan(e.target.value)}
                            sx={{ minWidth: 150, bgcolor: 'white' }}
                        >
                            <MenuItem value="" disabled>Select Plan...</MenuItem>
                            <MenuItem value="free">Free</MenuItem>
                            <MenuItem value="pro">Pro</MenuItem>
                            <MenuItem value="beta">Beta</MenuItem>
                            <MenuItem value="enterprise">Enterprise</MenuItem>
                        </Select>
                        <Button size="small" disabled={!massActionPlan} onClick={handleMassUpdate} variant="contained">
                            Apply
                        </Button>
                    </Paper>
                )}
            </Box>

            <Paper sx={{ borderRadius: 3, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                <DataGrid
                    rows={filteredOrgs}
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
                    sx={{
                        border: 'none',
                        '& .MuiDataGrid-cell:focus': { outline: 'none' },
                        '& .MuiDataGrid-columnHeaders': {
                            backgroundColor: '#f8f9fa',
                            color: '#495057',
                            fontWeight: 'bold',
                        }
                    }}
                />
            </Paper>

            <OrganizationModal
                open={isOrgModalOpen}
                onClose={() => setIsOrgModalOpen(false)}
                onSubmit={handleSaveOrg}
                initialData={editingOrg}
                users={users}
            />


            <OrgUsersModal
                open={isOrgUsersModalOpen}
                onClose={() => setIsOrgUsersModalOpen(false)}
                orgId={viewingOrgUsers?.id || null}
                orgName={viewingOrgUsers?.name || ''}
                allUsers={users}
            />


            <AdminDeleteDialog
                open={deleteDialog.open}
                type="organization"
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
        </Box>
    );
}
