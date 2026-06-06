import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Box,
    Typography,
    Paper,
    Tabs,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    Grid,
    Card,
    CardContent,
    TextField,
    Button,
    LinearProgress,
    Alert,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    IconButton,
    Tooltip
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import type { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { frFR } from '@mui/x-data-grid/locales';
import {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    Bar,
    ComposedChart,
    Line,
    Legend
} from 'recharts';
import {
    History,
    Calculator,
    TrendingUp,
    AlertTriangle,
    CheckCircle,
    Plus,
    Edit2,
    Trash2,
    Lock,
    LockIcon
} from 'lucide-react';
import { api } from '../api';
import ConsumptionModal from '../components/ConsumptionModal';
import { getFilamentTitle } from '../utils/filament-utils';
import ColorIndicator from '../components/ColorIndicator';
import PageHeader from '../components/PageHeader';
import { t } from 'i18next';


const LockedView = () => (
    <Box sx={{ p: 4, textAlign: 'center', mt: 8 }}>
        <Paper sx={{ p: 4, maxWidth: 500, mx: 'auto' }}>
            <Typography variant="h5" gutterBottom>
                {t('consumption.analyticLocked')} <LockIcon size={20}></LockIcon>
            </Typography>
            <Typography color="text.secondary" paragraph>
                {t('consumption.upgradeToProDetail')}
            </Typography>
            <Button variant="contained" color="primary" href="/settings">
                {t('consumption.upgradeToProButton')}
            </Button>
        </Paper>
    </Box>
);

const Consumption = () => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState(0);
    const [data, setData] = useState<{ logs: any[], analytics: any, forecasts: any[], restricted?: boolean } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Modal State
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [logToEdit, setLogToEdit] = useState<any | null>(null);

    const handleEdit = (log: any) => {
        setLogToEdit(log);
        setIsAddModalOpen(true);
    };

    const handleDelete = async (id: number, amount: number) => {
        if (window.confirm(t('consumption.confirmDelete', { amount }) || `Delete this log? ${amount}g will be credited back.`)) {
            try {
                await api.deleteConsumption(id);
                fetchData();
            } catch (error) {
                console.error(error);
                alert(t('common.error'));
            }
        }
    };

    // Simulator State
    const [simFilaments, setSimFilaments] = useState<{ id: number; weight: number }[]>([{ id: 0, weight: 0 }]);
    const [simResult, setSimResult] = useState<any[] | null>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const result = await api.getConsumptionStats();
            setData(result);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // ─── DataGrid Column Definitions ─────────────────────────────
    const logColumns: GridColDef[] = useMemo(() => [
        {
            field: 'date',
            headerName: t('common.date', 'Date'),
            width: 160,
            type: 'dateTime' as const,
            valueGetter: (_: any, row: any) => new Date(row.date),
            renderCell: (params: GridRenderCellParams) => {
                const d = new Date(params.row.date);
                return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
            }
        },
        {
            field: 'filament',
            headerName: t('inventory.filament', 'Filament'),
            flex: 1,
            minWidth: 200,
            valueGetter: (_: any, row: any) => getFilamentTitle(row.filament),
            renderCell: (params: GridRenderCellParams) => (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, height: '100%' }}>
                    <ColorIndicator colors={[params.row.filament?.color, ...(params.row.filament?.colors || [])]} size={12} />
                    <Typography variant="body2">{getFilamentTitle(params.row.filament)}</Typography>
                </Box>
            )
        },
        {
            field: 'amount',
            headerName: t('consumption.amount', 'Quantité (g)'),
            width: 120,
            type: 'number' as const,
            align: 'right' as const,
            headerAlign: 'right' as const,
            renderCell: (params: GridRenderCellParams) => (
                <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
                    <Typography sx={{ fontWeight: 600 }}>{params.row.amount.toFixed(2)}g</Typography>
                    {params.row.filament?.price > 0 && params.row.filament?.weightInitial > 0 && (
                        <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
                            ~{((params.row.amount * params.row.filament.price) / params.row.filament.weightInitial).toFixed(2)}€
                        </Typography>
                    )}
                </Box>
            )
        },
        {
            field: 'type',
            headerName: t('common.type', 'Type'),
            width: 150,
            type: 'singleSelect' as const,
            valueOptions: ['PRINT', 'MANUAL', 'FAIL'],
            renderCell: (params: GridRenderCellParams) => (
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center', height: '100%' }}>
                    {params.row.is_planned && (
                        <Chip label={t('consumption.isPlanned', 'Plannifiée')} size="small" variant="outlined"
                            sx={{ height: 22, fontSize: '0.7rem', borderStyle: 'dashed', borderColor: '#6366f1', color: '#4f46e5', bgcolor: 'rgba(99,102,241,0.05)' }} />
                    )}
                    <Chip
                        label={
                            params.row.type === 'PRINT' ? t('consumption.typePrint', 'Impression') :
                            params.row.type === 'MANUAL' ? t('consumption.typeManual', 'Manuel') :
                            params.row.type === 'FAIL' ? t('consumption.typeFail', 'Échec') : params.row.type
                        }
                        size="small"
                        color={params.row.type === 'PRINT' ? 'primary' : params.row.type === 'MANUAL' ? 'info' : params.row.type === 'FAIL' ? 'error' : 'default'}
                        variant="outlined"
                        sx={{ height: 22, fontSize: '0.7rem' }}
                    />
                </Box>
            )
        },
        {
            field: 'notes',
            headerName: t('common.notes', 'Notes'),
            flex: 1,
            minWidth: 120,
            renderCell: (params: GridRenderCellParams) => (
                <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                    {params.row.notes || '-'}
                </Box>
            )
        },
        {
            field: 'actions',
            headerName: t('common.actions', 'Actions'),
            width: 80,
            sortable: false,
            filterable: false,
            align: 'right' as const,
            headerAlign: 'right' as const,
            renderCell: (params: GridRenderCellParams) => (
                <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', height: '100%' }}>
                    <Tooltip title={t('common.edit', 'Modifier')}>
                        <IconButton size="small" onClick={() => handleEdit(params.row)} sx={{ color: 'text.secondary' }}>
                            <Edit2 size={16} />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title={t('common.delete', 'Supprimer')}>
                        <IconButton size="small" onClick={() => handleDelete(params.row.id, params.row.amount)} sx={{ color: 'error.main' }}>
                            <Trash2 size={16} />
                        </IconButton>
                    </Tooltip>
                </Box>
            )
        }
    ], [t]);

    const logRows = useMemo(() => data?.logs || [], [data]);

    const handleSimulate = () => {
        if (!data) return;
        const results = simFilaments.map(sim => {
            const filament = data.forecasts.find(f => f.id === sim.id);
            if (!filament) return null;
            return {
                ...filament,
                reqWeight: sim.weight,
                sufficient: filament.weightRemaining >= sim.weight,
                remainingAfter: filament.weightRemaining - sim.weight
            };
        }).filter(Boolean);
        setSimResult(results);
    };

    if (loading) return <LinearProgress />;

    if (error) return <Alert severity="error">{error}</Alert>;
    if (!data) return null;


    return (
        <Box sx={{ p: 3 }}>
            <PageHeader 
                title={t('consumption.title', 'Consommation & Prévisions')}
                icon={History}
                actions={
                    <Button
                        variant="contained"
                        startIcon={<Plus />}
                        onClick={() => setIsAddModalOpen(true)}
                        data-tour="consumption-add-btn"
                    >
                        {t('consumption.addLog', 'Ajouter')}
                    </Button>
                }
            />


            <Paper sx={{ mb: 3 }} data-tour="consumption-tabs">
                <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} variant="fullWidth">
                    <Tab icon={<History size={20} />} label={t('consumption.history', 'Historique')} iconPosition="start" />
                    <Tab
                        icon={data.restricted ? <Lock size={20} /> : <TrendingUp size={20} />}
                        label={t('consumption.analytics', 'Analyses & Prévisions')}
                        iconPosition="start"
                    />
                    <Tab
                        icon={data.restricted ? <Lock size={20} /> : <Calculator size={20} />}
                        label={t('consumption.simulator', 'Simulateur Projet')}
                        iconPosition="start"
                    />
                </Tabs>
            </Paper>

            {/* TAB 0: LOGS */}
            {activeTab === 0 && (
                <Paper sx={{ p: 0, borderRadius: '12px' }}>
                    <DataGrid
                        rows={logRows}
                        columns={logColumns}
                        autoHeight
                        showToolbar
                        localeText={frFR.components.MuiDataGrid.defaultProps.localeText}
                        initialState={{
                            sorting: { sortModel: [{ field: 'date', sort: 'desc' }] },
                            pagination: { paginationModel: { pageSize: 25 } },
                        }}
                        pageSizeOptions={[10, 25, 50, 100]}
                        disableRowSelectionOnClick
                        rowHeight={52}
                        sx={{
                            border: 'none',
                            '& .MuiDataGrid-cell:focus': { outline: 'none' },
                            '& .MuiDataGrid-footerContainer': {
                                borderTop: '1px solid #eee',
                            }
                        }}
                    />
                </Paper>
            )}

            {/* TAB 1: ANALYTICS */}
            {activeTab === 1 && (
                data.restricted ? <LockedView /> :
                    <Grid container spacing={3}>
                        {/* TOP: CHARTS */}
                        <Grid size={{ xs: 12 }}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom>{t('consumption.dailyUsage', 'Usage Journalier (30 derniers jours)')}</Typography>
                                    <Box sx={{ height: 300 }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <ComposedChart data={data.analytics.dailyUsage}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="date" />
                                                <YAxis yAxisId="left" orientation="left" stroke="#3b82f6" label={{ value: t('consumption.grams', 'Grammes (g)'), angle: -90, position: 'insideLeft' }} />
                                                <YAxis yAxisId="right" orientation="right" stroke="#10b981" label={{ value: t('consumption.cost', 'Coût (€)'), angle: 90, position: 'insideRight' }} />
                                                <RechartsTooltip />
                                                <Legend />
                                                <Bar yAxisId="left" dataKey="amount" fill="#3b82f6" name={t('consumption.grams', 'Grammes')} stackId="a" />
                                                <Bar yAxisId="left" dataKey="plannedAmount" fill="#a5b4fc" name={t('consumption.gramsPlanned', 'Grammes (Planifié)')} stackId="a" />
                                                <Line yAxisId="right" type="monotone" dataKey="cost" stroke="#10b981" name={t('consumption.cost', 'Coût')} strokeWidth={2} dot={false} />
                                                <Line yAxisId="right" type="monotone" dataKey="plannedCost" stroke="#6ee7b7" name={t('consumption.costPlanned', 'Coût (Planifié)')} strokeWidth={2} strokeDasharray="5 5" dot={false} />
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>

                        {/* BOTTOM: FORECAST TABLE */}
                        <Grid size={{ xs: 12 }}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom>{t('consumption.predictions', 'Prévisions de Stock')}</Typography>
                                    <TableContainer>
                                        <Table size="small">
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell>{t('inventory.filament', 'Filament')}</TableCell>
                                                    <TableCell align="center">{t('inventory.remaining', 'Restant')}</TableCell>
                                                    <TableCell align="center">{t('inventory.calculatedRemaining', 'Disponible')}</TableCell>
                                                    <TableCell align="center">{t('consumption.dailyRate', 'Débit Journalier')}</TableCell>
                                                    <TableCell align="center">{t('consumption.daysLeft', 'Jours Restants Est.')}</TableCell>
                                                    <TableCell align="center">{t('consumption.depletionDate', 'Date de Fin')}</TableCell>
                                                    <TableCell align="center">{t('consumption.status', 'Santé')}</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {data.forecasts.map(f => (
                                                    <TableRow key={f.id}>
                                                        <TableCell>
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                <ColorIndicator colors={[f?.color, ...(f?.colors || [])]} size={12} />
                                                                {/* <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: f.color }} /> */}
                                                                {getFilamentTitle(f)}
                                                            </Box>
                                                        </TableCell>
                                                        <TableCell align="center">{Math.round(f.weightRemaining)}g</TableCell>
                                                        <TableCell align="center" sx={{ color: f.plannedWeight > 0 ? 'primary.main' : 'inherit', fontWeight: f.plannedWeight > 0 ? 'bold' : 'normal' }}>
                                                            {Math.round(f.virtualWeightRemaining ?? f.weightRemaining)}g
                                                        </TableCell>
                                                        <TableCell align="center">{f.dailyUsage > 0 ? `${f.dailyUsage}g/jour` : '-'}</TableCell>
                                                        <TableCell align="center">
                                                            {f.daysRemaining === Infinity ? '∞' : f.daysRemaining}
                                                        </TableCell>
                                                        <TableCell align="center">
                                                            {f.estimatedDepletionDate
                                                                ? new Date(f.estimatedDepletionDate).toLocaleDateString()
                                                                : '-'
                                                            }
                                                        </TableCell>
                                                        <TableCell align="center">
                                                            {f.status === 'insufficient_data' ? (
                                                                <Chip label="Aucune data" size="small" />
                                                            ) : (
                                                                <Chip
                                                                    label={f.status.toUpperCase()}
                                                                    color={f.status === 'critical' ? 'error' : f.status === 'warning' ? 'warning' : 'success'}
                                                                    size="small"
                                                                />
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>
            )}

            {/* TAB 2: SIMULATOR */}
            {activeTab === 2 && (
                data.restricted ? <LockedView /> :
                    <Grid container spacing={3}>
                        <Grid size={{ xs: 12, md: 4 }}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom>{t('consumption.planner', 'Planificateur Job')}</Typography>
                                    {simFilaments.map((sim, idx) => (
                                        <Box key={idx} sx={{ mb: 2, p: 2, border: '1px solid #eee', borderRadius: 2 }}>
                                            <FormControl fullWidth size="small" sx={{ mb: 1 }}>
                                                <InputLabel>Filament</InputLabel>
                                                <Select
                                                    label="Filament"
                                                    value={sim.id}
                                                    onChange={(e) => {
                                                        const newSims = [...simFilaments];
                                                        newSims[idx].id = Number(e.target.value);
                                                        setSimFilaments(newSims);
                                                    }}
                                                >
                                                    <MenuItem value={0}><em>{t('common.selectFilament', 'Choisir filament...')}</em></MenuItem>
                                                    {data.forecasts.map(f => (
                                                        <MenuItem key={f.id} value={f.id}>
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: f.color }} />
                                                                {getFilamentTitle(f)} ({Math.round(f.weightRemaining)}g)
                                                            </Box>
                                                        </MenuItem>
                                                    ))}
                                                </Select>
                                            </FormControl>
                                            <TextField
                                                fullWidth
                                                size="small"
                                                label={t('consumption.estWeight') || 'Estimated Weight (g)'}
                                                type="number"
                                                value={sim.weight}
                                                onChange={(e) => {
                                                    const newSims = [...simFilaments];
                                                    newSims[idx].weight = Number(e.target.value);
                                                    setSimFilaments(newSims);
                                                }}
                                            />
                                        </Box>
                                    ))}
                                    <Button
                                        fullWidth
                                        startIcon={<Plus />}
                                        onClick={() => setSimFilaments([...simFilaments, { id: 0, weight: 0 }])}
                                        sx={{ mb: 2 }}
                                    >
                                        {t('inventory.addFilament')}
                                    </Button>
                                    <Button
                                        fullWidth
                                        variant="contained"
                                        size="large"
                                        onClick={handleSimulate}
                                    >
                                        {t('consumption.checkStock', 'Vérifier Stock')}
                                    </Button>
                                </CardContent>
                            </Card>
                        </Grid>

                        <Grid size={{ xs: 12, md: 8 }}>
                            {simResult && (
                                <Card>
                                    <CardContent>
                                        <Typography variant="h6" gutterBottom>{t('consumption.results', 'Résultats Simulation')}</Typography>
                                        <TableContainer>
                                            <Table>
                                                <TableHead>
                                                    <TableRow>
                                                        <TableCell>{t('inventory.filament', 'Filament')}</TableCell>
                                                        <TableCell>{t('consumption.required', 'Requis')}</TableCell>
                                                        <TableCell>{t('inventory.remaining', 'En Stock')}</TableCell>
                                                        <TableCell>{t('common.status', 'Statut')}</TableCell>
                                                        <TableCell>{t('consumption.afterJob', 'Après Job')}</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {simResult.map((res, i) => (
                                                        <TableRow key={i}>
                                                            <TableCell>{getFilamentTitle(res)}</TableCell>
                                                            <TableCell>{res.reqWeight}g</TableCell>
                                                            <TableCell>{Math.round(res.weightRemaining)}g</TableCell>
                                                            <TableCell>
                                                                {res.sufficient ? (
                                                                    <Chip icon={<CheckCircle size={14} />} label="OK" color="success" size="small" />
                                                                ) : (
                                                                    <Chip icon={<AlertTriangle size={14} />} label="INSUFFICIENT" color="error" size="small" />
                                                                )}
                                                            </TableCell>
                                                            <TableCell sx={{ color: res.remainingAfter < 0 ? 'error.main' : 'text.primary', fontWeight: 'bold' }}>
                                                                {Math.round(res.remainingAfter)}g
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </TableContainer>
                                        {simResult.some(r => !r.sufficient) && (
                                            <Alert severity="warning" sx={{ mt: 2 }}>
                                                Attention: Some filaments do not have enough stock for this job!
                                            </Alert>
                                        )}
                                    </CardContent>
                                </Card>
                            )}
                        </Grid>
                    </Grid>
            )}

            {/* Modal "Add Consumption" Unified */}
            <ConsumptionModal
                isOpen={isAddModalOpen}
                onClose={() => {
                    setIsAddModalOpen(false);
                    setLogToEdit(null);
                }}
                editLog={logToEdit}
                // If editing, we might need to pass filament details if expected, 
                // but ConsumptionModal logic for Global Mode tries to handle it.
                // However, logToEdit.filament has data.
                // In Global Mode (Consumption Page), proper initialization of selectedFilament might be needed.
                // But for now let's pass the log and see.
                onSuccess={() => {
                    fetchData();
                    setIsAddModalOpen(false);
                    setLogToEdit(null);
                }}
            />
        </Box>
    );
};

export default Consumption;
// Force rebuild
