import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Typography, Button, TextField, Chip, IconButton, Alert, Dialog, DialogTitle, DialogContent, Grid, Card, CardContent, LinearProgress, Paper } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import type { GridColDef, GridRenderCellParams, GridSortModel, GridPaginationModel } from '@mui/x-data-grid';
import { frFR } from '@mui/x-data-grid/locales';
import type { Filament } from '../api';
import { BASE_URL } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { Search, Eye, Trash2, Building2, Tag, Scale, MapPin, DollarSign, Calendar, Info, Thermometer, X } from 'lucide-react';
import { useDebounce } from '../hooks/useDebounce';
import ColorIndicator from '../components/ColorIndicator';

// Assuming BASE_URL is defined elsewhere, e.g., in a config file or environment variables
// For this example, I'll define a placeholder. In a real app, you'd import it.


export default function SuperAdminFilaments() {
    const { t } = useTranslation();
    const { user, token } = useAuth(); // Get token from useAuth
    const [filaments, setFilaments] = useState<Filament[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [viewingFilament, setViewingFilament] = useState<Filament | null>(null);

    // DataGrid States
    const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
        page: 0,
        pageSize: 10,
    });
    const [sortModel, setSortModel] = useState<GridSortModel>([
        { field: 'id', sort: 'desc' }
    ]);
    const [searchQuery, setSearchQuery] = useState('');
    const [filters, setFilters] = useState({
        brand: '',
        material: '',
        type: ''
    });

    // Debounce search and filters
    const debouncedSearchQuery = useDebounce(searchQuery, 500);
    const debouncedFilters = useDebounce(filters, 500);

    useEffect(() => {
        fetchFilaments();
    }, [paginationModel, sortModel, debouncedSearchQuery, debouncedFilters]);

    const handleFilterChange = (field: 'brand' | 'material' | 'type') => (event: React.ChangeEvent<HTMLInputElement>) => {
        setFilters(prev => ({ ...prev, [field]: event.target.value }));
        setPaginationModel(prev => ({ ...prev, page: 0 }));
    };

    const fetchFilaments = async () => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams();
            params.append('page', (paginationModel.page + 1).toString());
            params.append('limit', paginationModel.pageSize.toString());

            if (debouncedSearchQuery) params.append('search', debouncedSearchQuery);
            if (debouncedFilters.brand) params.append('brand', debouncedFilters.brand);
            if (debouncedFilters.material) params.append('material', debouncedFilters.material);
            if (debouncedFilters.type) params.append('type', debouncedFilters.type);

            if (sortModel.length > 0) {
                params.append('sortBy', sortModel[0].field);
                params.append('sortOrder', (sortModel[0].sort || 'desc').toUpperCase());
            }

            const response = await fetch(`${BASE_URL}/admin/filaments?${params.toString()}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                // If 404/500, ensures we don't crash but show error
                if (response.status === 404) {
                    setFilaments([]);
                    setTotal(0);
                    return;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();

            if (data.items && Array.isArray(data.items)) {
                setFilaments(data.items);
                setTotal(data.total);
            } else if (Array.isArray(data)) {
                // Fallback for non-paginated (legacy)
                setFilaments(data);
                setTotal(data.length);
            } else {
                setFilaments([]);
                setTotal(0);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to fetch filaments');
            console.error('Failed to fetch filaments', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm(t('super_admin.filaments.delete_confirm', 'Are you sure you want to delete this filament?'))) return;
        try {
            const response = await fetch(`${BASE_URL}/filaments/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                fetchFilaments(); // Re-fetch filaments after deletion
            } else {
                throw new Error(`Failed to delete filament: ${response.statusText}`);
            }
        } catch (error: any) {
            setError(error.message || 'Failed to delete filament');
            console.error('Failed to delete', error);
        }
    };

    const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(event.target.value);
        setPaginationModel(prev => ({ ...prev, page: 0 }));
    };

    const columns = useMemo<GridColDef<Filament>[]>(() => [
        {
            field: 'id',
            headerName: 'ID',
            width: 80,
            renderCell: (params: GridRenderCellParams<Filament>) => `#${params.value}`
        },
        {
            field: 'organization',
            headerName: t('filament.organization', 'Organization'),
            flex: 1,
            minWidth: 150,
            valueGetter: (_, row: Filament) => row.organization?.name || t('common.unknown', 'Unknown'),
            renderCell: (params: GridRenderCellParams<Filament>) => (
                <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                    <Chip
                        label={params.value}
                        size="small"
                        variant="outlined"
                    />
                </Box>
            )
        },
        {
            field: 'brand',
            headerName: t('filament.brand', 'Brand'),
            flex: 1,
            minWidth: 120,
            valueGetter: (_, row: Filament) => row.brand?.name
        },
        {
            field: 'material',
            headerName: t('filament.material', 'Material'),
            width: 100,
            valueGetter: (_, row: Filament) => row.material?.name
        },
        {
            field: 'type',
            headerName: t('filament.type', 'Type'),
            width: 120,
            valueGetter: (_, row: Filament) => row.types?.map(t => t.name).join(', ')
        },
        {
            field: 'color',
            headerName: t('filament.color', 'Color'),
            width: 120,
            renderCell: (params: GridRenderCellParams<Filament>) => (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, height: '100%' }}>
                    <Box
                        sx={{
                            width: 16,
                            height: 16,
                            borderRadius: '50%',
                            bgcolor: params.value as string,
                            border: '1px solid rgba(0,0,0,0.1)'
                        }}
                    />
                    {params.value as string}
                </Box>
            )
        },
        {
            field: 'weightRemaining',
            headerName: t('filament.weight', 'Weight'),
            width: 150,
            renderCell: (params: GridRenderCellParams<Filament>) => (
                <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                    <Typography variant="body2">
                        {(params.row.weightRemaining / 1000).toFixed(1)}kg / {(params.row.weightInitial / 1000).toFixed(1)}kg
                    </Typography>
                </Box>
            )
        },
        {
            field: 'actions',
            headerName: t('common.actions', 'Actions'),
            width: 100,
            sortable: false,
            align: 'right',
            headerAlign: 'right',
            renderCell: (params: GridRenderCellParams<Filament>) => (
                <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: 0.5 }}>
                    <IconButton size="small" onClick={() => setViewingFilament(params.row)}>
                        <Eye size={18} />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleDelete(params.row.id)} color="error">
                        <Trash2 size={16} />
                    </IconButton>
                </Box>
            )
        }
    ], [t]);

    if (!(user as any)?.isSuperAdmin) {
        return <Typography color="error">Access Denied</Typography>;
    }

    return (
        <Box sx={{ p: 4, maxWidth: 1400, mx: 'auto' }}>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
                {t('super_admin.filaments.title', 'Global Inventory')}
            </Typography>
            <Typography color="textSecondary" sx={{ mb: 4 }}>
                {t('super_admin.filaments.subtitle', 'Manage all filaments across all organizations.')}
            </Typography>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <TextField
                    placeholder={t('super_admin.filaments.search_placeholder', 'Search all...')}
                    size="small"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    InputProps={{
                        startAdornment: <Search size={18} style={{ marginRight: 8, color: 'gray' }} />,
                    }}
                    sx={{ width: 250 }}
                />
                {/* NEW FILTERS */}
                <TextField
                    label={t('super_admin.filaments.filter_brand', 'Filter Brand')}
                    size="small"
                    value={filters.brand}
                    onChange={handleFilterChange('brand')}
                    sx={{ width: 150 }}
                />
                <TextField
                    label={t('super_admin.filaments.filter_material', 'Filter Material')}
                    size="small"
                    value={filters.material}
                    onChange={handleFilterChange('material')}
                    sx={{ width: 150 }}
                />
                <TextField
                    label={t('super_admin.filaments.filter_type', 'Filter Type')}
                    size="small"
                    value={filters.type}
                    onChange={handleFilterChange('type')}
                    sx={{ width: 150 }}
                />
                <Button variant="outlined" onClick={fetchFilaments}>{t('common.refresh', 'Refresh')}</Button>
            </Box>

            <Paper sx={{ p: 0, borderRadius: '12px', overflow: 'hidden', mb: 8 }}>
                <DataGrid
                    rows={filaments}
                    columns={columns}
                    autoHeight
                    loading={loading}
                    rowCount={total}
                    paginationMode="server"
                    sortingMode="server"
                    paginationModel={paginationModel}
                    onPaginationModelChange={setPaginationModel}
                    sortModel={sortModel}
                    onSortModelChange={setSortModel}
                    pageSizeOptions={[10, 25, 50, 100]}
                    disableRowSelectionOnClick
                    showToolbar
                    rowHeight={52}
                    localeText={frFR.components.MuiDataGrid.defaultProps.localeText}
                    sx={{
                        border: 'none',
                        '& .MuiDataGrid-cell:focus': { outline: 'none' },
                        '& .MuiDataGrid-footerContainer': {
                            borderTop: '1px solid #eee',
                        }
                    }}
                />
            </Paper>

            <Dialog open={!!viewingFilament} onClose={() => setViewingFilament(null)} maxWidth="md" fullWidth>
                {viewingFilament && (
                    <>
                        <DialogTitle sx={{ m: 0, p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: 'background.default', borderBottom: 1, borderColor: 'divider' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <ColorIndicator colors={[viewingFilament.color, ...(viewingFilament.colors || [])]} size={40} />
                                <Box>
                                    <Typography variant="h6" fontWeight="bold">
                                        {viewingFilament.brand?.name} {viewingFilament.material?.name}
                                    </Typography>
                                    <Typography variant="body2" color="textSecondary">
                                        ID: #{viewingFilament.id} • {viewingFilament.types?.map(t => t.name).join(', ')} • {viewingFilament.colorName || t('admin.noColorName')}
                                    </Typography>
                                </Box>
                            </Box>
                            <IconButton onClick={() => setViewingFilament(null)} sx={{ color: 'text.secondary' }}>
                                <X size={20} />
                            </IconButton>
                        </DialogTitle>
                        <DialogContent dividers sx={{ p: 3, bgcolor: 'background.default' }}>
                            <Grid container spacing={3}>
                                {/* Left Column */}
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <Card variant="outlined" sx={{ height: '100%' }}>
                                        <CardContent>
                                            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                                <Info size={18} /> {t('admin.generalInfo')}
                                            </Typography>
                                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                    <Building2 size={16} style={{ color: 'gray' }} />
                                                    <Box>
                                                        <Typography variant="caption" color="textSecondary" display="block">{t('common.organization')}</Typography>
                                                        <Typography variant="body2">{viewingFilament.organization?.name || t('admin.globalSystem')}</Typography>
                                                    </Box>
                                                </Box>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                    <Tag size={16} style={{ color: 'gray' }} />
                                                    <Box>
                                                        <Typography variant="caption" color="textSecondary" display="block">{t('admin.brandAndRef')}</Typography>
                                                        <Typography variant="body2">{viewingFilament.brand?.name} {viewingFilament.spoolReference ? `(Ref: ${viewingFilament.spoolReference})` : ''}</Typography>
                                                    </Box>
                                                </Box>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                    <MapPin size={16} style={{ color: 'gray' }} />
                                                    <Box>
                                                        <Typography variant="caption" color="textSecondary" display="block">{t('admin.nfcTagId')}</Typography>
                                                        <Typography variant="body2">{viewingFilament.nfcTagId || t('admin.notLinked')}</Typography>
                                                    </Box>
                                                </Box>
                                            </Box>
                                        </CardContent>
                                    </Card>
                                </Grid>

                                {/* Right Column */}
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <Card variant="outlined" sx={{ height: '100%' }}>
                                        <CardContent>
                                            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                                <Scale size={18} /> {t('admin.spoolStatus')}
                                            </Typography>

                                            <Box sx={{ mb: 2 }}>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                                    <Typography variant="body2">{t('admin.weightRemaining')}</Typography>
                                                    <Typography variant="body2" fontWeight="bold">
                                                        {viewingFilament.weightRemaining.toFixed(0)}g / {viewingFilament.weightInitial.toFixed(0)}g
                                                    </Typography>
                                                </Box>
                                                <LinearProgress
                                                    variant="determinate"
                                                    value={Math.min(100, Math.max(0, (viewingFilament.weightRemaining / viewingFilament.weightInitial) * 100)) || 0}
                                                    color={viewingFilament.weightRemaining < 100 ? 'error' : 'primary'}
                                                    sx={{ height: 8, borderRadius: 4 }}
                                                />
                                            </Box>

                                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                    <DollarSign size={16} style={{ color: 'gray' }} />
                                                    <Box>
                                                        <Typography variant="caption" color="textSecondary" display="block">{t('admin.priceAndVendor')}</Typography>
                                                        <Typography variant="body2">{viewingFilament.price != null ? `${viewingFilament.price}€` : '-'} {viewingFilament.vendor ? `from ${viewingFilament.vendor}` : ''}</Typography>
                                                    </Box>
                                                </Box>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                    <Calendar size={16} style={{ color: 'gray' }} />
                                                    <Box>
                                                        <Typography variant="caption" color="textSecondary" display="block">{t('admin.purchaseDate')}</Typography>
                                                        <Typography variant="body2">{viewingFilament.purchaseDate ? new Date(viewingFilament.purchaseDate).toLocaleDateString() : t('common.unknown')}</Typography>
                                                    </Box>
                                                </Box>
                                            </Box>
                                        </CardContent>
                                    </Card>
                                </Grid>

                                {/* Full Width Bottom */}
                                <Grid size={{ xs: 12 }}>
                                    <Card variant="outlined">
                                        <CardContent>
                                            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                                <Thermometer size={18} /> {t('admin.printSettings')}
                                            </Typography>
                                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                                {(viewingFilament.nozzleTempMin != null || viewingFilament.nozzleTempMax != null) ? (
                                                    <Chip icon={<Thermometer size={14} />} label={`${t('inventory.nozzle')}: ${viewingFilament.nozzleTempMin ?? '?'} - ${viewingFilament.nozzleTempMax ?? '?'}°C`} />
                                                ) : <Typography variant="body2" color="textSecondary">{t('admin.noPrintSettings')}</Typography>}
                                                {(viewingFilament.bedTempMin != null || viewingFilament.bedTempMax != null || viewingFilament.bedTemp != null) && (
                                                    <Chip icon={<Thermometer size={14} />} label={`${t('inventory.bed')}: ${viewingFilament.bedTempMin ?? viewingFilament.bedTemp ?? '?'} - ${viewingFilament.bedTempMax ?? '?'}°C`} />
                                                )}
                                                {viewingFilament.densityGcm3 && <Chip label={`${t('admin.density')}: ${viewingFilament.densityGcm3} g/cm³`} />}
                                                {viewingFilament.diameterMm && <Chip label={`${t('admin.diameter')}: ${viewingFilament.diameterMm} mm`} />}
                                            </Box>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            </Grid>
                        </DialogContent>
                    </>
                )}
            </Dialog>
        </Box>
    );
}
