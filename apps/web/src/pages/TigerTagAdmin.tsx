import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { BASE_URL } from '../api';
import {
    Box,
    Typography,
    Paper,
    Tabs,
    Tab,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TableSortLabel,
    Chip,
    Alert,
    CircularProgress,
    Autocomplete,
    TextField,
    IconButton,
    Tooltip,
    Stack,
    Checkbox,
    LinearProgress
} from '@mui/material';
import {
    RefreshCw,
    Check,
    AlertCircle,
    Link as LinkIcon,
    Plus,
    Search,
    Trash2
} from 'lucide-react';

interface TigerBrandMapping {
    id: number;
    tigerId: number;
    tigerName: string;
    brandId: number | null;
    brand?: { id: number; name: string };
}

interface TigerMaterialMapping {
    id: number;
    tigerId: number;
    tigerName: string;
    materialId: number | null;
    material?: { id: number; name: string };
}

interface TigerTypeMapping {
    id: number;
    tigerId: number;
    tigerName: string;
    typeId: number | null;
    type?: { id: number; name: string };
}

interface Brand {
    id: number;
    name: string;
}

interface Material {
    id: number;
    name: string;
}

interface FilamentType {
    id: number;
    name: string;
}

export default function TigerTagAdminPage() {
    const { t } = useTranslation();
    const { token } = useAuth();


    const [activeTab, setActiveTab] = useState(0); // 0: Brands, 1: Materials, 2: Types
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Mappings
    const [brandMappings, setBrandMappings] = useState<TigerBrandMapping[]>([]);
    const [materialMappings, setMaterialMappings] = useState<TigerMaterialMapping[]>([]);
    const [typeMappings, setTypeMappings] = useState<TigerTypeMapping[]>([]);

    // Reference data
    const [brands, setBrands] = useState<Brand[]>([]);
    const [materials, setMaterials] = useState<Material[]>([]);
    const [types, setTypes] = useState<FilamentType[]>([]);

    // Filter States
    const [brandFilter, setBrandFilter] = useState('');
    const [materialFilter, setMaterialFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');

    // Sorting State
    const [sortField, setSortField] = useState<string>('tigerName');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

    const handleSort = (field: string) => {
        setSortDir(sortField === field && sortDir === 'asc' ? 'desc' : 'asc');
        setSortField(field);
    };

    const [selectedIds, setSelectedIds] = useState<number[]>([]);

    useEffect(() => {
        setSelectedIds([]);
    }, [activeTab]);

    useEffect(() => {
        fetchReferenceData();
        fetchMappings();
    }, []);

    const fetchReferenceData = async () => {
        try {
            const [brandsRes, materialsRes, typesRes] = await Promise.all([
                fetch(`${BASE_URL}/reference-data/brands`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch(`${BASE_URL}/reference-data/materials`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch(`${BASE_URL}/reference-data/types`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ]);

            if (brandsRes.ok) setBrands(await brandsRes.json());
            if (materialsRes.ok) setMaterials(await materialsRes.json());
            if (typesRes.ok) setTypes(await typesRes.json());
        } catch (err) {
            console.error('Failed to fetch reference data:', err);
        }
    };

    const fetchMappings = async () => {
        setLoading(true);
        try {
            const [brandsRes, materialsRes, typesRes] = await Promise.all([
                fetch(`${BASE_URL}/tigertag/mappings/brands?admin=true`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${BASE_URL}/tigertag/mappings/materials?admin=true`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${BASE_URL}/tigertag/mappings/types?admin=true`, { headers: { 'Authorization': `Bearer ${token}` } })
            ]);

                if (brandsRes.ok) setBrandMappings(await brandsRes.json());
                if (materialsRes.ok) setMaterialMappings(await materialsRes.json());
                if (typesRes.ok) setTypeMappings(await typesRes.json());
            } catch (err) {
                setError(t('tigerTagAdmin.errorLoadingMappings', 'Failed to fetch mappings'));
            } finally {
                setLoading(false);
            }
        };

    const waitForTigerTagSync = async (jobId: string | number) => {
        for (let attempt = 0; attempt < 600; attempt++) {
            const response = await fetch(`${BASE_URL}/tigertag/sync/job/${jobId}`, {
                headers: { 'Authorization': `Bearer ${token}` },
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error('Failed to fetch TigerTag sync job');
            }

            const job = await response.json();
            const progress = typeof job.progress === 'number' ? job.progress : 0;
            setSyncProgress(progress);

            if (job.status === 'completed') {
                setSyncProgress(100);
                return job.result;
            }
            if (job.status === 'failed') {
                throw new Error(job.error || 'TigerTag sync failed');
            }

            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        throw new Error('TigerTag sync timeout');
    };

    const syncTigerTagData = async (type: 'brands' | 'materials' | 'aspects') => {
        setSyncing(true);
        setSyncProgress(0);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch(`${BASE_URL}/tigertag/sync/${type}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                credentials: 'include',
            });

            if (response.ok) {
                const queued = await response.json();
                const result = queued?.jobId ? await waitForTigerTagSync(queued.jobId) : queued;
                setSuccess(t('tigerTagAdmin.syncSuccess', 'Synchronized {{count}} {{type}}', { count: result.count, type }));
                fetchMappings();
            } else {
                setError(t('tigerTagAdmin.syncError', 'Failed to sync {{type}}', { type }));
            }
        } catch (err) {
            setError(t('tigerTagAdmin.syncError', 'Error syncing {{type}}', { type }));
        } finally {
            setSyncing(false);
            setSyncProgress(null);
        }
    };

    const updateMapping = async (
        mappingId: number,
        localId: number | null,
        type: 'brands' | 'materials' | 'types'
    ) => {
        // Optimistic Update
        const updateState = (prev: any[]) => prev.map(m => m.id === mappingId ? {
            ...m,
            [type === 'brands' ? 'brandId' : type === 'materials' ? 'materialId' : 'typeId']: localId
        } : m);

        if (type === 'brands') setBrandMappings(prev => updateState(prev));
        else if (type === 'materials') setMaterialMappings(prev => updateState(prev));
        else setTypeMappings(prev => updateState(prev));

        try {
            const body = type === 'brands' ? { brandId: localId } : type === 'materials' ? { materialId: localId } : { typeId: localId };
            const response = await fetch(`${BASE_URL}/tigertag/mappings/${type}/${mappingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                setError(t('tigerTagAdmin.updateError'));
                fetchMappings();
            } else {
                setSuccess(t('tigerTagAdmin.mappingUpdated'));
                setTimeout(() => setSuccess(null), 2000);
            }
        } catch (err) {
            setError(t('tigerTagAdmin.updateError'));
        }
    };

    const unmapItem = async (mappingId: number, type: 'brands' | 'materials' | 'types') => {
        if (!confirm(t('tigerTagAdmin.removeMappingConfirm'))) return;
        await updateMapping(mappingId, null, type);
    };



    const performCreateAndMap = async (mapping: any, type: 'brands' | 'materials' | 'types') => {
        const endpoint = type === 'brands' ? 'brands' : type === 'materials' ? 'materials' : 'types';
        const existingList = type === 'brands' ? brands : type === 'materials' ? materials : types;
        const existing = existingList.find(e => e.name.toLowerCase() === mapping.tigerName.toLowerCase());

        let localId: number;

        if (existing) {
            localId = existing.id;
        } else {
            const createRes = await fetch(`${BASE_URL}/reference-data/${endpoint}?admin=true`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ name: mapping.tigerName })
            });

            if (!createRes.ok) throw new Error('Failed to create entity');
            const created = await createRes.json();

            // Optimistically add to reference lists
            if (type === 'brands') setBrands(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
            else if (type === 'materials') setMaterials(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
            else setTypes(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));

            localId = created.id;
        }

        // 2. Update mapping
        await updateMapping(mapping.id, localId, type);
        return localId;
    };

    const createFromTigerTag = async (mapping: any, type: 'brands' | 'materials' | 'types') => {
        if (!confirm(t('tigerTagAdmin.createConfirm', { type: type.slice(0, -1), name: mapping.tigerName }))) return;

        try {
            await performCreateAndMap(mapping, type);
            setSuccess(t('tigerTagAdmin.createSuccess', { name: mapping.tigerName }));
        } catch (error) {
            console.error(error);
            setError(t('tigerTagAdmin.updateError'));
        }
    };

    const handleBulkCreateAndMap = async (filteredData: any[], type: 'brands' | 'materials' | 'types') => {
        const toProcess = filteredData.filter(m => selectedIds.includes(m.id) && !(type === 'brands' ? m.brandId : type === 'materials' ? m.materialId : m.typeId));

        if (toProcess.length === 0) {
            setError(t('tigerTagAdmin.unmappedSelectedError'));
            return;
        }

        if (!confirm(t('tigerTagAdmin.bulkConfirm', { count: toProcess.length }))) return;

        setLoading(true);
        let successCount = 0;
        let failCount = 0;

        for (const mapping of toProcess) {
            try {
                await performCreateAndMap(mapping, type);
                successCount++;
            } catch (err) {
                console.error(`Failed to map ${mapping.tigerName}:`, err);
                failCount++;
            }
        }

        setLoading(false);
        setSelectedIds([]);

        if (failCount === 0) {
            setSuccess(t('tigerTagAdmin.bulkSuccess', { count: successCount }));
        } else {
            setError(t('tigerTagAdmin.bulkError', { count: successCount, failCount }));
        }
    };

    const toggleSelectAll = (filteredData: any[]) => {
        const allFilteredIds = filteredData.map(m => m.id);
        const allSelected = allFilteredIds.every(id => selectedIds.includes(id));

        if (allSelected) {
            setSelectedIds(prev => prev.filter(id => !allFilteredIds.includes(id)));
        } else {
            setSelectedIds(prev => Array.from(new Set([...prev, ...allFilteredIds])));
        }
    };

    const toggleSelectRow = (id: number) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const renderTable = (
        data: any[],
        filter: string,
        setFilter: (v: string) => void,
        type: 'brands' | 'materials' | 'types',
        options: any[]
    ) => {
        const filteredData = data
            .filter(item => item.tigerName.toLowerCase().includes(filter.toLowerCase()))
            .sort((a, b) => {
                let valA: any = a[sortField];
                let valB: any = b[sortField];
                if (sortField === 'status') {
                    const idKey = type === 'brands' ? 'brandId' : type === 'materials' ? 'materialId' : 'typeId';
                    valA = a[idKey] ? 'mapped' : 'unmapped';
                    valB = b[idKey] ? 'mapped' : 'unmapped';
                }
                if (typeof valA === 'string') valA = valA.toLowerCase();
                if (typeof valB === 'string') valB = valB.toLowerCase();
                if (valA == null) valA = '';
                if (valB == null) valB = '';
                if (valA < valB) return sortDir === 'asc' ? -1 : 1;
                if (valA > valB) return sortDir === 'asc' ? 1 : -1;
                return 0;
            });

        return (
            <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, gap: 2 }}>
                    <Stack direction="row" spacing={2} alignItems="center">
                        <TextField
                            placeholder={t('tigerTagAdmin.searchPlaceholder')}
                            size="small"
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            InputProps={{
                                startAdornment: <Search size={18} style={{ marginRight: 8, color: 'gray' }} />
                            }}
                            sx={{ width: 300 }}
                        />
                        {selectedIds.length > 0 && (
                            <Button
                                variant="outlined"
                                color="primary"
                                startIcon={<Plus size={18} />}
                                onClick={() => handleBulkCreateAndMap(filteredData, type)}
                            >
                                {t('tigerTagAdmin.mapSelected', { count: selectedIds.filter(id => {
                                    const m = data.find(item => item.id === id);
                                    const idKey = type === 'brands' ? 'brandId' : type === 'materials' ? 'materialId' : 'typeId';
                                    return m && !m[idKey];
                                }).length })}
                            </Button>
                        )}
                    </Stack>
                    <Button
                        variant="contained"
                        startIcon={syncing ? <CircularProgress size={16} color="inherit" /> : <RefreshCw size={18} />}
                        onClick={() => syncTigerTagData(type === 'types' ? 'aspects' : type)}
                        disabled={syncing}
                    >
                        {syncing && syncProgress !== null
                            ? `${t('tigerTagAdmin.syncButton', { type: type === 'brands' ? t('inventory.brand') : type === 'materials' ? t('inventory.material') : t('inventory.type') })} ${Math.round(syncProgress)}%`
                            : t('tigerTagAdmin.syncButton', { type: type === 'brands' ? t('inventory.brand') : type === 'materials' ? t('inventory.material') : t('inventory.type') })}
                    </Button>
                </Box>

                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell padding="checkbox">
                                    <Checkbox
                                        indeterminate={selectedIds.length > 0 && selectedIds.length < filteredData.length}
                                        checked={filteredData.length > 0 && filteredData.every(m => selectedIds.includes(m.id))}
                                        onChange={() => toggleSelectAll(filteredData)}
                                    />
                                </TableCell>
                                <TableCell>
                                    <TableSortLabel active={sortField === 'tigerId'} direction={sortField === 'tigerId' ? sortDir : 'asc'} onClick={() => handleSort('tigerId')}>
                                        {t('tigerTagAdmin.tableTigerId')}
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell>
                                    <TableSortLabel active={sortField === 'tigerName'} direction={sortField === 'tigerName' ? sortDir : 'asc'} onClick={() => handleSort('tigerName')}>
                                        {t('tigerTagAdmin.tableTigerName')}
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell>
                                    <TableSortLabel active={sortField === 'status'} direction={sortField === 'status' ? sortDir : 'asc'} onClick={() => handleSort('status')}>
                                        {t('tigerTagAdmin.tableStatus')}
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell sx={{ width: 300 }}>{t('tigerTagAdmin.tableLocalEntity')}</TableCell>
                                <TableCell align="right">{t('tigerTagAdmin.tableActions')}</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredData.map((mapping) => {
                                const currentId = type === 'brands' ? mapping.brandId : type === 'materials' ? mapping.materialId : mapping.typeId;
                                const isMapped = !!currentId;

                                return (
                                    <TableRow key={mapping.id} hover selected={selectedIds.includes(mapping.id)}>
                                        <TableCell padding="checkbox">
                                            <Checkbox
                                                checked={selectedIds.includes(mapping.id)}
                                                onChange={() => toggleSelectRow(mapping.id)}
                                            />
                                        </TableCell>
                                        <TableCell>{mapping.tigerId}</TableCell>
                                        <TableCell sx={{ fontWeight: 500 }}>{mapping.tigerName}</TableCell>
                                        <TableCell>
                                            {isMapped ? (
                                                <Chip icon={<Check size={14} />} label={t('tigerTagAdmin.statusMapped')} color="success" size="small" />
                                            ) : (
                                                <Chip icon={<AlertCircle size={14} />} label={t('tigerTagAdmin.statusUnmapped')} color="warning" size="small" />
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Autocomplete
                                                size="small"
                                                options={options}
                                                getOptionLabel={(option) => option.name}
                                                value={options.find(opt => opt.id === currentId) || null}
                                                onChange={(_, newValue) => updateMapping(mapping.id, newValue ? newValue.id : null, type)}
                                                renderInput={(params) => <TextField {...params} variant="outlined" placeholder={t('common.selectOrg', 'Select...')} />}
                                                disableClearable={false}
                                            />
                                        </TableCell>
                                        <TableCell align="right">
                                            <Stack direction="row" spacing={1} justifyContent="flex-end">
                                                {!isMapped && (
                                                    <Tooltip title={t('tigerTagAdmin.tooltipCreate', { name: mapping.tigerName })}>
                                                        <IconButton
                                                            size="small"
                                                            color="primary"
                                                            onClick={() => createFromTigerTag(mapping, type)}
                                                        >
                                                            <Plus size={18} />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                                {isMapped && (
                                                    <Tooltip title={t('tigerTagAdmin.tooltipRemove')}>
                                                        <IconButton
                                                            size="small"
                                                            color="error"
                                                            onClick={() => unmapItem(mapping.id, type)}
                                                        >
                                                            <Trash2 size={18} />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                            </Stack>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                            {filteredData.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>{t('tigerTagAdmin.noItems')}</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Box>
        );
    };

    return (
        <Box sx={{ p: 4, maxWidth: 1400, mx: 'auto' }}>
            <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 3 }}>
                <img src="/tigertag_logo.jpg" alt="TigerTag Logo" style={{ width: 80, height: 80, borderRadius: 12 }} />
                <Box>
                    <Typography variant="h3" fontWeight="bold" gutterBottom>
                        {t('tigerTagAdmin.title')}
                    </Typography>
                    <Typography color="textSecondary">
                        {t('tigerTagAdmin.subtitle')}
                    </Typography>
                </Box>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>{success}</Alert>}
            {syncing && (
                <Alert severity="info" sx={{ mb: 3 }}>
                    <Stack spacing={1}>
                        <Typography variant="body2">
                            {t('tigerTagAdmin.syncInProgress', 'Synchronisation en cours')}
                            {syncProgress !== null ? ` - ${Math.round(syncProgress)}%` : ''}
                        </Typography>
                        <LinearProgress
                            variant={syncProgress !== null ? 'determinate' : 'indeterminate'}
                            value={syncProgress ?? 0}
                        />
                    </Stack>
                </Alert>
            )}

            <Paper sx={{ mb: 3 }}>
                <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <Tab
                        icon={<LinkIcon size={18} />}
                        iconPosition="start"
                        label={t('tigerTagAdmin.tabBrandsCount', { name: t('inventory.brand'), mapped: brandMappings.filter(m => m.brandId).length, total: brandMappings.length })}
                    />
                    <Tab
                        icon={<LinkIcon size={18} />}
                        iconPosition="start"
                        label={t('tigerTagAdmin.tabMaterialsCount', { name: t('inventory.material'), mapped: materialMappings.filter(m => m.materialId).length, total: materialMappings.length })}
                    />
                    <Tab
                        icon={<LinkIcon size={18} />}
                        iconPosition="start"
                        label={t('tigerTagAdmin.tabTypesCount', { name: t('inventory.type'), mapped: typeMappings.filter(m => m.typeId).length, total: typeMappings.length })}
                    />
                </Tabs>
            </Paper>

            {loading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                    <CircularProgress />
                </Box>
            )}

            {!loading && (
                <Box sx={{ mt: 3 }}>
                    {activeTab === 0 && renderTable(brandMappings, brandFilter, setBrandFilter, 'brands', brands)}
                    {activeTab === 1 && renderTable(materialMappings, materialFilter, setMaterialFilter, 'materials', materials)}
                    {activeTab === 2 && renderTable(typeMappings, typeFilter, setTypeFilter, 'types', types)}
                </Box>
            )}
        </Box>
    );
}
