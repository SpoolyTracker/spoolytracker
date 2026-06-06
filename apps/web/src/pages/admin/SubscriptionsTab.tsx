import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { BASE_URL } from '../../api';
import type { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { DataGrid } from '@mui/x-data-grid';
import { frFR } from '@mui/x-data-grid/locales';
import {
    Box,
    Paper,
    IconButton,
    Chip,
    Tooltip,
    Typography,
    Snackbar,
    Alert
} from '@mui/material';
import {
    Trash2
} from 'lucide-react';
import ReasonDialog from '../../components/ReasonDialog';
import type { Subscription } from './types';

export default function SubscriptionsTab() {
    const { t } = useTranslation();
    const { token } = useAuth();

    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [loading, setLoading] = useState(true);
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });
    const [reasonDialog, setReasonDialog] = useState<{ open: boolean; onConfirm: (reason: string) => void; title?: string }>({ open: false, onConfirm: () => {} });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${BASE_URL}/admin/subscriptions`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (response.ok) {
                setSubscriptions(await response.json());
            }
        } catch (error) {
            console.error('Failed to fetch subscriptions:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteSubscription = (subId: number) => {
        setReasonDialog({
            open: true,
            title: 'Delete Subscription Record',
            onConfirm: async (reason) => {
                try {
                    const response = await fetch(`${BASE_URL}/admin/subscriptions/${subId}`, {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({ reason }),
                    });
                    if (response.ok) {
                        setSnackbar({ open: true, message: 'Subscription deleted from database', severity: 'success' });
                        fetchData();
                    } else {
                        setSnackbar({ open: true, message: 'Failed to delete subscription', severity: 'error' });
                    }
                } catch (e) {
                    setSnackbar({ open: true, message: 'Network error', severity: 'error' });
                }
                setReasonDialog(prev => ({ ...prev, open: false }));
            }
        });
    };

    const columns: GridColDef[] = useMemo(() => [
        { field: 'id', headerName: 'ID', width: 70 },
        { field: 'stripeSubscriptionId', headerName: 'Stripe Sub ID', flex: 1.5, minWidth: 200, renderCell: (params: GridRenderCellParams) => <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{params.value}</Typography> },
        {
            field: 'organization',
            headerName: 'Organization',
            flex: 1.5,
            minWidth: 150,
            valueGetter: (_, row) => row.organization?.name || `Org ID: ${row.organizationId}`
        },
        {
            field: 'status',
            headerName: 'Status',
            width: 110,
            renderCell: (params: GridRenderCellParams) => (
                <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                    <Chip
                        label={(params.value || 'unknown').toString().toUpperCase()}
                        size="small"
                        color={params.value === 'active' ? 'success' : 'warning'}
                        variant="outlined"
                    />
                </Box>
            )
        },
        { field: 'planId', headerName: 'Plan/Price ID', flex: 1, minWidth: 130, renderCell: (params: GridRenderCellParams) => <Typography variant="caption">{params.value}</Typography> },
        {
            field: 'currentPeriodEnd',
            headerName: 'Period End',
            width: 120,
            valueFormatter: (value) => value ? new Date(value as string).toLocaleDateString() : '-'
        },
        {
            field: 'actions',
            headerName: 'Actions',
            width: 80,
            sortable: false,
            filterable: false,
            align: 'right',
            headerAlign: 'right',
            renderCell: (params: GridRenderCellParams) => (
                <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                    <Tooltip title="Delete from Database">
                        <IconButton size="small" onClick={() => handleDeleteSubscription(params.row.id)} color="error">
                            <Trash2 size={16} />
                        </IconButton>
                    </Tooltip>
                </Box>
            )
        }
    ], [t]);

    return (
        <Box>
            <Paper sx={{ borderRadius: 3, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                <DataGrid
                    rows={subscriptions}
                    columns={columns}
                    autoHeight
                    loading={loading}
                    pageSizeOptions={[10, 25, 50, 100]}
                    initialState={{
                        pagination: { paginationModel: { pageSize: 10, page: 0 } }
                    }}
                    disableRowSelectionOnClick
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
