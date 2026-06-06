import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Box,
    Typography,
    Paper,
    TextField,
    InputAdornment,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Chip,
    Tooltip,
    Card,
    CardContent,
    IconButton
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import type { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { frFR } from '@mui/x-data-grid/locales';
import {
    Search,
    User as UserIcon,
    Terminal,
    Info,
    ChevronDown,
    ChevronUp,
    Activity,
    Users,
    Shield,
    History
} from 'lucide-react';
import { api } from '../../api';
import type { AuditLog, AuditLogStats } from './types';

interface GroupedAuditLog extends AuditLog {
    actions: string[];
    metadatas: any[];
    groupCount: number;
}

export default function AuditLogTab() {
    const { t, i18n } = useTranslation();

    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [total, setTotal] = useState(0);
    const [stats, setStats] = useState<AuditLogStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 25 });
    const [filters, setFilters] = useState({
        search: '',
        action: '',
        targetType: '',
        startDate: '',
        endDate: ''
    });

    const [expandedRow, setExpandedRow] = useState<number | null>(null);

    const formatDate = (dateString: string) => {
        try {
            return new Intl.DateTimeFormat(i18n.language, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }).format(new Date(dateString));
        } catch (e) {
            return dateString;
        }
    };

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const result = await api.getAuditLogStats();
                setStats(result);
            } catch (error) {
                console.error('Failed to fetch audit stats:', error);
            }
        };
        fetchStats();
    }, []);

    const groupLogs = (rawLogs: AuditLog[]): GroupedAuditLog[] => {
        if (rawLogs.length === 0) return [];
        
        const grouped: GroupedAuditLog[] = [];
        let currentGroup: GroupedAuditLog | null = null;

        rawLogs.forEach(log => {
            if (!currentGroup) {
                currentGroup = { ...log, actions: [log.action], metadatas: [log.metadata], groupCount: 1 };
                return;
            }

            const timeDiff = Math.abs(new Date(log.createdAt).getTime() - new Date(currentGroup.createdAt).getTime());
            const sameTarget = log.targetId === currentGroup.targetId && log.targetType === currentGroup.targetType;
            const sameAdmin = log.performedById === currentGroup.performedById;
            const sameReason = log.reason === currentGroup.reason;

            if (timeDiff < 5000 && sameTarget && sameAdmin && sameReason) {
                currentGroup.actions.push(log.action);
                currentGroup.metadatas.push(log.metadata);
                currentGroup.groupCount++;
            } else {
                grouped.push(currentGroup);
                currentGroup = { ...log, actions: [log.action], metadatas: [log.metadata], groupCount: 1 };
            }
        });

        if (currentGroup) grouped.push(currentGroup);
        return grouped;
    };

    useEffect(() => {
        const fetchLogs = async () => {
            setLoading(true);
            try {
                const result = await api.getAuditLogs({
                    page: paginationModel.page + 1,
                    limit: paginationModel.pageSize,
                    ...filters
                });
                setLogs(groupLogs(result.items));
                setTotal(result.total);
            } catch (error) {
                console.error('Failed to fetch audit logs:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, [paginationModel, filters]);

    const getActionColor = (action: string) => {
        if (action.includes('DELETE')) return 'error';
        if (action.includes('CREATE')) return 'success';
        if (action.includes('UPDATE') || action.includes('CHANGE')) return 'warning';
        if (action.includes('BATCH')) return 'secondary';
        return 'primary';
    };

    const columns: GridColDef[] = useMemo(() => [
        {
            field: 'createdAt',
            headerName: t('common.date'),
            width: 180,
            renderCell: (params: GridRenderCellParams) => (
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {formatDate(params.value as string)}
                </Typography>
            )
        },
        {
            field: 'performedByUsername',
            headerName: t('common.admin'),
            width: 150,
            renderCell: (params: GridRenderCellParams) => (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <UserIcon size={14} color="#64748b" />
                    <Typography variant="body2">{params.value}</Typography>
                </Box>
            )
        },
        {
            field: 'action',
            headerName: t('common.action'),
            width: 200,
            renderCell: (params: GridRenderCellParams<GroupedAuditLog>) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {(params.row.actions || [params.value as string]).map((action, idx) => (
                        <Chip
                            key={idx}
                            label={action}
                            size="small"
                            color={getActionColor(action)}
                            variant="outlined"
                            sx={{ fontWeight: 'bold', fontSize: '0.65rem' }}
                        />
                    ))}
                </Box>
            )
        },
        {
            field: 'targetLabel',
            headerName: t('common.target'),
            flex: 1,
            minWidth: 150,
            renderCell: (params: GridRenderCellParams<GroupedAuditLog>) => (
                <Box sx={{ py: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                        {params.value || '-'}
                    </Typography>
                    {params.row.targetType && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1 }}>
                            {params.row.targetType} #{params.row.targetId}
                        </Typography>
                    )}
                </Box>
            )
        },
        {
            field: 'reason',
            headerName: t('admin.audit.reason'),
            flex: 1.5,
            minWidth: 200,
            renderCell: (params: GridRenderCellParams) => (
                <Tooltip title={params.value?.toString() || ''} arrow>
                    <Typography variant="body2" sx={{ 
                        fontStyle: params.value ? 'normal' : 'italic',
                        color: params.value ? 'text.primary' : 'text.disabled',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                    }}>
                        {params.value ? params.value.toString() : t('admin.audit.no_reason', 'Aucune justification')}
                    </Typography>
                </Tooltip>
            )
        },
        {
            field: 'details',
            headerName: '',
            width: 50,
            sortable: false,
            renderCell: (params: GridRenderCellParams) => (
                <IconButton size="small" onClick={() => setExpandedRow(expandedRow === params.row.id ? null : params.row.id)}>
                    {expandedRow === params.row.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </IconButton>
            )
        }
    ], [t, i18n.language, expandedRow]);

    return (
        <Box>
            {/* Stats Cards */}
            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
                <Card sx={{ flex: '1 1 200px', borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                    <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'primary.50', color: 'primary.main' }}>
                            <Activity size={24} />
                        </Box>
                        <Box>
                            <Typography variant="h6" sx={{ fontWeight: 700 }}>{stats?.today || 0}</Typography>
                            <Typography variant="caption" color="text.secondary">{t('admin.audit.actions_today', 'Aujourd\'hui')}</Typography>
                        </Box>
                    </CardContent>
                </Card>
                <Card sx={{ flex: '1 1 200px', borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                    <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'success.50', color: 'success.main' }}>
                            <History size={24} />
                        </Box>
                        <Box>
                            <Typography variant="h6" sx={{ fontWeight: 700 }}>{stats?.thisWeek || 0}</Typography>
                            <Typography variant="caption" color="text.secondary">{t('admin.audit.actions_this_week', 'Cette semaine')}</Typography>
                        </Box>
                    </CardContent>
                </Card>
                <Card sx={{ flex: '1 1 200px', borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                    <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'warning.50', color: 'warning.main' }}>
                            <Users size={24} />
                        </Box>
                        <Box>
                            <Typography variant="h6" sx={{ fontWeight: 700 }}>{stats?.total || 0}</Typography>
                            <Typography variant="caption" color="text.secondary">{t('admin.audit.total_actions', 'Total historique')}</Typography>
                        </Box>
                    </CardContent>
                </Card>
                <Card sx={{ flex: '1 1 200px', borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                    <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'info.50', color: 'info.main' }}>
                            <Shield size={24} />
                        </Box>
                        <Box>
                            <Typography variant="h6" sx={{ fontWeight: 700 }}>{stats?.topAdmins?.[0]?.username || '-'}</Typography>
                            <Typography variant="caption" color="text.secondary">{t('admin.audit.most_active_admin', 'Admin le plus actif')}</Typography>
                        </Box>
                    </CardContent>
                </Card>
            </Box>

            {/* Filters */}
            <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                <TextField
                    placeholder={t('common.search')}
                    size="small"
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <Search size={18} />
                            </InputAdornment>
                        ),
                    }}
                    sx={{ width: 250, bgcolor: 'white' }}
                />
                <FormControl size="small" sx={{ minWidth: 150, bgcolor: 'white' }}>
                    <InputLabel>{t('common.action')}</InputLabel>
                    <Select
                        value={filters.action}
                        label={t('common.action')}
                        onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                    >
                        <MenuItem value="">{t('common.all')}</MenuItem>
                        <MenuItem value="USER_CREATE">USER_CREATE</MenuItem>
                        <MenuItem value="USER_UPDATE">USER_UPDATE</MenuItem>
                        <MenuItem value="USER_DELETE">USER_DELETE</MenuItem>
                        <MenuItem value="ORG_CREATE">ORG_CREATE</MenuItem>
                        <MenuItem value="ORG_UPDATE">ORG_UPDATE</MenuItem>
                        <MenuItem value="ORG_DELETE">ORG_DELETE</MenuItem>
                        <MenuItem value="ORG_PLAN_CHANGE">ORG_PLAN_CHANGE</MenuItem>
                    </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 150, bgcolor: 'white' }}>
                    <InputLabel>{t('common.type')}</InputLabel>
                    <Select
                        value={filters.targetType}
                        label={t('common.type')}
                        onChange={(e) => setFilters({ ...filters, targetType: e.target.value })}
                    >
                        <MenuItem value="">{t('common.all')}</MenuItem>
                        <MenuItem value="user">User</MenuItem>
                        <MenuItem value="organization">Organization</MenuItem>
                        <MenuItem value="subscription">Subscription</MenuItem>
                    </Select>
                </FormControl>
                <TextField
                    type="date"
                    label={t('admin.audit.start_date', 'Date début')}
                    size="small"
                    value={filters.startDate}
                    onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                    InputLabelProps={{ shrink: true }}
                    sx={{ width: 160, bgcolor: 'white' }}
                />
                <TextField
                    type="date"
                    label={t('admin.audit.end_date', 'Date fin')}
                    size="small"
                    value={filters.endDate}
                    onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                    InputLabelProps={{ shrink: true }}
                    sx={{ width: 160, bgcolor: 'white' }}
                />
            </Box>

            {/* Data Grid */}
            <Paper sx={{ borderRadius: 3, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                <DataGrid
                    rows={logs}
                    columns={columns}
                    autoHeight
                    loading={loading}
                    paginationMode="server"
                    rowCount={total}
                    paginationModel={paginationModel}
                    onPaginationModelChange={setPaginationModel}
                    pageSizeOptions={[10, 25, 50, 100]}
                    disableRowSelectionOnClick
                    rowHeight={64}
                    localeText={i18n.language === 'fr' ? frFR.components.MuiDataGrid.defaultProps.localeText : undefined}
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
                
                {/* Expandable Details Container */}
                {expandedRow && (
                    <Box sx={{ p: 2, bgcolor: '#fdfdfd', borderTop: '1px solid #eee' }}>
                        <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Terminal size={16} /> {t('admin.audit.metadata', 'Détails techniques (Metadata)')}
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {(logs.find(l => l.id === expandedRow) as GroupedAuditLog)?.metadatas.map((meta, idx) => (
                                <Box key={idx}>
                                    <Typography variant="caption" color="primary.main" sx={{ fontWeight: 'bold', mb: 0.5, display: 'block' }}>
                                        Action #{idx + 1}: {(logs.find(l => l.id === expandedRow) as GroupedAuditLog).actions[idx]}
                                    </Typography>
                                    <Paper component="pre" sx={{ p: 2, bgcolor: '#1e293b', color: '#f1f5f9', borderRadius: 2, overflowX: 'auto', fontSize: '0.8rem', mt: 0.5 }}>
                                        {JSON.stringify(meta, null, 2)}
                                    </Paper>
                                </Box>
                            ))}
                        </Box>
                        <Box sx={{ mt: 2, display: 'flex', gap: 4 }}>
                            <Box>
                                <Typography variant="caption" color="text.secondary" display="block">{t('admin.audit.ip_address', 'Adresse IP')}</Typography>
                                <Typography variant="body2">{logs.find(l => l.id === expandedRow)?.ipAddress || '-'}</Typography>
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary" display="block">{t('admin.audit.log_id', 'Audit Log ID')}</Typography>
                                <Typography variant="body2">#{expandedRow}</Typography>
                            </Box>
                        </Box>
                    </Box>
                )}
            </Paper>

            <Box sx={{ mt: 3, display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
                <Info size={16} />
                <Typography variant="caption">
                    {t('admin.audit.retention_info', 'Les logs d\'audit sont conservés pendant une période de 2 ans conformément à la politique de sécurité.')}
                </Typography>
            </Box>
        </Box>
    );
}
