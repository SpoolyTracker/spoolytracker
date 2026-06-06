import { useState, useEffect } from 'react';
import {
    Box,
    Autocomplete,
    Typography,
    Tabs,
    Tab,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    TableSortLabel,
    Paper,
    Chip,
    IconButton,
    TextField,
    MenuItem,
    Select,
    FormControl,
    InputLabel,
    InputAdornment,
    Stack,
    Alert,
    LinearProgress
} from '@mui/material';
import {
    Plus,
    Edit2,
    Trash2,
    Database,
    Globe,
    Building2,
    ArrowUpCircle,
    GitMerge,
    Search
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';

import BrandCatalogModal from '../components/BrandCatalogModal';
import MergeReferenceDataModal from '../components/MergeReferenceDataModal';
import SpoolmanImportModal from '../components/SpoolmanImportModal';
import PageHeader from '../components/PageHeader';
import ColorIndicator from '../components/ColorIndicator';


interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;
    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`ref-tabpanel-${index}`}
            aria-labelledby={`ref-tab-${index}`}
            {...other}
        >
            {value === index && (
                <Box sx={{ p: 3 }}>
                    {children}
                </Box>
            )}
        </div>
    );
}

export default function ReferenceData() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState(0);
    const [viewScope, setViewScope] = useState<'all' | 'global' | 'local'>('all');

    // Data State
    const [brands, setBrands] = useState<any[]>([]);
    const [materials, setMaterials] = useState<any[]>([]);
    const [types, setTypes] = useState<any[]>([]);
    const [options, setOptions] = useState<any[]>([]);
    const [brandCatalog, setBrandCatalog] = useState<any[]>([]);
    const [colorReferences, setColorReferences] = useState<any[]>([]);

    // Modals & Editing
    const [isBrandCatalogModalOpen, setIsBrandCatalogModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<any | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editType, setEditType] = useState<string>(''); // 'brand', 'material', 'type', 'option', 'catalog'
    const [isGlobalCreate, setIsGlobalCreate] = useState(false);
    const [isGlobalCatalog, setIsGlobalCatalog] = useState(false);

    // Edit Form State
    const [editName, setEditName] = useState('');
    const [editCategory, setEditCategory] = useState('');

    // Catalog Edit State
    const [editDensity, setEditDensity] = useState<number | ''>('');
    const [editNozzleMin, setEditNozzleMin] = useState<number | ''>('');
    const [editNozzleMax, setEditNozzleMax] = useState<number | ''>('');
    const [editBedMin, setEditBedMin] = useState<number | ''>('');
    const [editBedMax, setEditBedMax] = useState<number | ''>('');
    const [editBrandId, setEditBrandId] = useState<number | ''>('');
    const [editMaterialId, setEditMaterialId] = useState<number | ''>('');
    const [editTypeId, setEditTypeId] = useState<number | ''>('');
    const [editColorHex, setEditColorHex] = useState('#000000');
    const [editColorHexes, setEditColorHexes] = useState('');

    // Merge State
    const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
    const [mergeSource, setMergeSource] = useState<any>(null);
    const [mergeType, setMergeType] = useState<'brand' | 'material' | 'type'>('brand');

    // Spoolman Import State
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [missingImportData, setMissingImportData] = useState<{
        brands: string[],
        materials: string[],
        combinations: Array<{ brandName: string; materialName: string }>,
        conflicts: any[]
    }>({ brands: [], materials: [], combinations: [], conflicts: [] });
    const [syncing, setSyncing] = useState(false);
    const [syncingColors, setSyncingColors] = useState(false);
    const [spoolmanProgress, setSpoolmanProgress] = useState<number | null>(null);

    // Sorting & Search State
    const [sortField, setSortField] = useState<string>('name');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [searchQuery, setSearchQuery] = useState('');
    const [colorBrandFilter, setColorBrandFilter] = useState<any | null>(null);
    const [colorMaterialFilter, setColorMaterialFilter] = useState<any | null>(null);
    const [colorTypeFilter, setColorTypeFilter] = useState<any | null>(null);
    const [colorSourceFilter, setColorSourceFilter] = useState<'all' | 'manual' | 'spoolman'>('all');
    const [colorPage, setColorPage] = useState(0);
    const [colorRowsPerPage, setColorRowsPerPage] = useState(25);
    const [colorColumnWidths, setColorColumnWidths] = useState<Record<string, number>>({
        name: 260,
        brand: 160,
        material: 140,
        type: 130,
        color: 260,
        source: 110,
        organization: 130,
        scope: 100,
        actions: 112,
    });

    const handleSort = (field: string) => {
        setSortDir(sortField === field && sortDir === 'asc' ? 'desc' : 'asc');
        setSortField(field);
    };

    const startColorColumnResize = (key: string, event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();

        const startX = event.clientX;
        const startWidth = colorColumnWidths[key] || 120;

        const onMouseMove = (moveEvent: MouseEvent) => {
            const nextWidth = Math.max(80, startWidth + moveEvent.clientX - startX);
            setColorColumnWidths(prev => ({ ...prev, [key]: nextWidth }));
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    const renderResizableColorHeader = (key: string, label: React.ReactNode, align: 'left' | 'right' = 'left') => (
        <TableCell
            align={align}
            sx={{
                width: colorColumnWidths[key],
                minWidth: colorColumnWidths[key],
                maxWidth: colorColumnWidths[key],
                position: 'relative',
                pr: 2,
            }}
        >
            {label}
            <Box
                onMouseDown={(event) => startColorColumnResize(key, event)}
                sx={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    width: 8,
                    height: '100%',
                    cursor: 'col-resize',
                    zIndex: 1,
                    '&:hover': {
                        bgcolor: 'primary.main',
                        opacity: 0.25,
                    },
                }}
            />
        </TableCell>
    );

    // Helper to filter data
    const filterData = (data: any[]) => {
        if (viewScope === 'global') return data.filter(d => !d.organizationId);
        if (viewScope === 'local') return data.filter(d => !!d.organizationId);
        return data;
    };

    const sortAndFilter = (data: any[]) => {
        let filtered = filterData(data);
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(row =>
                (row.name || '').toLowerCase().includes(q) ||
                (row.category || '').toLowerCase().includes(q) ||
                (row.brand?.name || '').toLowerCase().includes(q) ||
                (row.material?.name || '').toLowerCase().includes(q) ||
                (row.type?.name || '').toLowerCase().includes(q) ||
                (row.primaryHex || '').toLowerCase().includes(q) ||
                (row.organization?.name || '').toLowerCase().includes(q)
            );
        }
        return [...filtered].sort((a, b) => {
            let valA: any = a[sortField] ?? a[sortField];
            let valB: any = b[sortField] ?? b[sortField];
            // Handle nested fields
            if (sortField === 'organization') { valA = a.organization?.name || ''; valB = b.organization?.name || ''; }
            if (sortField === 'scope') { valA = a.organizationId ? 'custom' : 'global'; valB = b.organizationId ? 'custom' : 'global'; }
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();
            if (valA < valB) return sortDir === 'asc' ? -1 : 1;
            if (valA > valB) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });
    };

    const getFilteredColorReferences = () => sortAndFilter(colorReferences).filter(row => {
        if (colorBrandFilter && row.brandId !== colorBrandFilter.id) return false;
        if (colorMaterialFilter && row.materialId !== colorMaterialFilter.id) return false;
        if (colorTypeFilter && row.typeId !== colorTypeFilter.id) return false;
        if (colorSourceFilter !== 'all' && row.source !== colorSourceFilter) return false;
        return true;
    });
    const filteredColorReferences = getFilteredColorReferences();
    const paginatedColorReferences = filteredColorReferences.slice(
        colorPage * colorRowsPerPage,
        colorPage * colorRowsPerPage + colorRowsPerPage
    );
    const colorTableWidth = Object.values(colorColumnWidths).reduce((sum, width) => sum + width, 0);

    const fetchData = async () => {
        try {
            const [b, m, t, o, catalog, colors] = await Promise.all([
                api.getBrands(),
                api.getMaterials(),
                api.getTypes(),
                api.getOptions(),
                api.getBrandCatalog(),
                api.getColorReferences()
            ]);
            setBrands(b);
            setMaterials(m);
            setTypes(t);
            // Options comes as grouped object?
            const flatOptions: any[] = [];
            Object.keys(o).forEach(key => {
                // @ts-ignore
                flatOptions.push(...o[key]);
            });
            setOptions(flatOptions);
            setBrandCatalog(catalog);
            setColorReferences(colors);
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        setColorPage(0);
    }, [searchQuery, viewScope, colorBrandFilter, colorMaterialFilter, colorTypeFilter, colorSourceFilter]);

    const waitForSpoolmanSync = async (jobId: string | number) => {
        for (let attempt = 0; attempt < 600; attempt++) {
            const job = await api.getSpoolmanSyncJob(jobId);
            const progress = typeof job.progress === 'number' ? job.progress : 0;
            setSpoolmanProgress(progress);

            if (job.status === 'completed') {
                setSpoolmanProgress(100);
                return job.result;
            }
            if (job.status === 'failed') {
                throw new Error(job.error || 'Spoolman sync failed');
            }

            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        throw new Error('Spoolman sync timeout');
    };

    const runQueuedSpoolmanSync = async () => {
        setSpoolmanProgress(0);
        const queued = await api.syncSpoolman();
        if (!queued?.jobId) return queued;
        return waitForSpoolmanSync(queued.jobId);
    };

    const handleSyncSpoolman = async () => {
        if (!confirm(t('referenceData.confirmSync') || "Sync from SpoolmanDB?")) return;
        setSyncing(true);
        try {
            const analysis = await api.analyzeSpoolman();
            if (
                analysis.missingBrands.length > 0 ||
                analysis.missingMaterials.length > 0 ||
                analysis.missingCombinations.length > 0 ||
                (analysis.conflicts && analysis.conflicts.length > 0)
            ) {
                setMissingImportData({
                    brands: analysis.missingBrands,
                    materials: analysis.missingMaterials,
                    combinations: analysis.missingCombinations.map(c => ({ brandName: c.brandName, materialName: c.materialName })),
                    conflicts: analysis.conflicts || []
                });
                setIsImportModalOpen(true);
            } else {
                const result = await runQueuedSpoolmanSync();
                fetchData();
                const colorSync = result?.colorSync;
                if (colorSync) {
                    alert(t('referenceData.spoolmanColorsSyncedShort', { created: colorSync.created, updated: colorSync.updated }));
                } else {
                    alert(t('referenceData.upToDate') || "Spoolman data is already up to date.");
                }
            }
        } catch (e) {
            console.error(e);
            alert(t('referenceData.syncFailed') || "Sync failed");
        } finally {
            setSyncing(false);
            setSpoolmanProgress(null);
        }
    };

    const handleSyncSpoolmanColors = async () => {
        if (!confirm(t('referenceData.confirmSyncColors'))) return;
        setSyncingColors(true);
        try {
            const result = await runQueuedSpoolmanSync();
            await fetchData();
            const colorSync = result?.colorSync;
            alert(colorSync
                ? t('referenceData.spoolmanColorsSynced', { created: colorSync.created, updated: colorSync.updated, skipped: colorSync.skipped })
                : t('referenceData.colorSyncCompleted'));
        } catch (e) {
            console.error(e);
            alert(t('referenceData.colorSyncFailed'));
        } finally {
            setSyncingColors(false);
            setSpoolmanProgress(null);
        }
    };

    const handleEdit = (type: string, item: any) => {
        setEditType(type);
        setEditingItem(item);
        if (type === 'catalog') {
            setEditDensity(item.density_gcm3 || '');
            setEditNozzleMin(item.nozzle_temp_min || '');
            setEditNozzleMax(item.nozzle_temp_max || '');
            setEditBedMin(item.bed_temp_min || '');
            setEditBedMax(item.bed_temp_max || '');
        } else if (type === 'color') {
            setEditName(item.name || '');
            setEditBrandId(item.brandId || '');
            setEditMaterialId(item.materialId || '');
            setEditTypeId(item.typeId || '');
            setEditColorHex(item.primaryHex || '#000000');
            setEditColorHexes((item.hexes || [item.primaryHex]).filter(Boolean).join(', '));
        } else {
            setEditName(item.name || '');
            setEditCategory(item.category || '');
        }
        setIsEditModalOpen(true);
    };

    const handleCreate = (type: string, global: boolean) => {
        setEditType(type);
        setEditingItem(null);
        setEditName('');
        setEditCategory('');
        setEditDensity('');
        setEditNozzleMin('');
        setEditNozzleMax('');
        setEditBedMin('');
        setEditBedMax('');
        setEditBrandId('');
        setEditMaterialId('');
        setEditTypeId('');
        setEditColorHex('#000000');
        setEditColorHexes('');
        setIsGlobalCreate(global);
        setIsEditModalOpen(true);
    };

    const colorHexList = editColorHexes
        .split(',')
        .map(h => h.trim())
        .filter(Boolean);

    const setColorHexAt = (index: number, value: string) => {
        const next = colorHexList.length ? [...colorHexList] : [editColorHex];
        next[index] = value;
        setEditColorHexes(next.join(', '));
        if (index === 0) setEditColorHex(value);
    };

    const addColorHex = () => {
        const next = colorHexList.length ? [...colorHexList, '#cccccc'] : [editColorHex, '#cccccc'];
        setEditColorHexes(next.join(', '));
    };

    const removeColorHex = (index: number) => {
        const next = colorHexList.filter((_, i) => i !== index);
        const fallback = next.length ? next : ['#000000'];
        setEditColorHexes(fallback.join(', '));
        setEditColorHex(fallback[0]);
    };

    const handleSave = async () => {
        try {
            if (editType === 'brand') {
                if (editingItem) await api.updateBrand(editingItem.id, editName);
                else await api.createBrand(editName, isGlobalCreate);
            } else if (editType === 'material') {
                if (editingItem) await api.updateMaterial(editingItem.id, editName);
                else await api.createMaterial(editName, isGlobalCreate);
            } else if (editType === 'type') {
                if (editingItem) await api.updateType(editingItem.id, editName);
                else await api.createType(editName, isGlobalCreate);
            } else if (editType === 'option') {
                if (editingItem) await api.updateOption(editingItem.id, editName, editCategory);
                else await api.createOption(editName, editCategory, false, isGlobalCreate);
            } else if (editType === 'catalog' && editingItem) {
                await api.updateBrandCatalogEntry(editingItem.id, {
                    density: editDensity === '' ? undefined : Number(editDensity),
                    nozzle_min: editNozzleMin === '' ? undefined : Number(editNozzleMin),
                    nozzle_max: editNozzleMax === '' ? undefined : Number(editNozzleMax),
                    bed_min: editBedMin === '' ? undefined : Number(editBedMin),
                    bed_max: editBedMax === '' ? undefined : Number(editBedMax),
                });
            } else if (editType === 'color') {
                const hexes = editColorHexes.split(',').map(h => h.trim()).filter(Boolean);
                const payload = {
                    brandId: Number(editBrandId),
                    materialId: editMaterialId === '' ? null : Number(editMaterialId),
                    typeId: editTypeId === '' ? null : Number(editTypeId),
                    name: editName,
                    primaryHex: hexes[0] || editColorHex,
                    hexes: hexes.length ? hexes : [editColorHex],
                    source: editingItem?.source || 'manual',
                    isGlobal: isGlobalCreate,
                };
                if (editingItem) await api.updateColorReference(editingItem.id, payload);
                else await api.createColorReference(payload);
            }
            setIsEditModalOpen(false);
            fetchData();
        } catch (e) {
            console.error(e);
            alert(t('referenceData.saveFailed'));
        }
    };

    const handleDelete = async (type: string, id: number) => {
        if (!confirm(t('referenceData.deleteConfirm'))) return;
        try {
            if (type === 'brand') await api.deleteBrand(id);
            else if (type === 'material') await api.deleteMaterial(id);
            else if (type === 'type') await api.deleteType(id);
            else if (type === 'option') await api.deleteOption(id);
            else if (type === 'catalog') await api.deleteBrandCatalogEntry(id);
            else if (type === 'color') await api.deleteColorReference(id);
            fetchData();
        } catch (e) {
            console.error(e);
            alert(t('referenceData.deleteFailed'));
        }
    };

    const handlePromote = async (type: string, id: number) => {
        if (!window.confirm(t('referenceData.confirmPromote'))) return;

        try {
            if (type === 'brand') await api.promoteBrand(id);
            else if (type === 'material') await api.promoteMaterial(id);
            else if (type === 'type') await api.promoteType(id);
            else if (type === 'color') await api.promoteColorReference(id);
            // options promotion?

            fetchData();
        } catch (error) {
            console.error(error);
            alert(t('referenceData.promoteFailed'));
        }
    };

    const renderTable = (data: any[], type: string) => {
        const sorted = sortAndFilter(data);
        return (
            <TableContainer component={Paper}>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>
                                <TableSortLabel active={sortField === 'name'} direction={sortField === 'name' ? sortDir : 'asc'} onClick={() => handleSort('name')}>
                                    {t('referenceData.name')}
                                </TableSortLabel>
                            </TableCell>
                            <TableCell>
                                <TableSortLabel active={sortField === 'organization'} direction={sortField === 'organization' ? sortDir : 'asc'} onClick={() => handleSort('organization')}>
                                    {t('referenceData.organization')}
                                </TableSortLabel>
                            </TableCell>
                            <TableCell>
                                <TableSortLabel active={sortField === 'scope'} direction={sortField === 'scope' ? sortDir : 'asc'} onClick={() => handleSort('scope')}>
                                    {t('referenceData.scope')}
                                </TableSortLabel>
                            </TableCell>
                            <TableCell align="right">{t('referenceData.actions')}</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {sorted.map((row) => (
                            <TableRow key={row.id} hover>
                                <TableCell sx={{ fontWeight: 500 }}>{row.name}</TableCell>
                                <TableCell>{row.organization?.name || '-'}</TableCell>
                                <TableCell>
                                    {row.organizationId
                                        ? <Chip label={t('referenceData.custom')} size="small" variant="outlined" />
                                        : <Chip label={t('referenceData.global')} color="primary" size="small" variant="filled" />
                                    }
                                </TableCell>
                                <TableCell align="right">
                                    <IconButton size="small" onClick={() => handleEdit(type, row)}><Edit2 size={16} /></IconButton>
                                    {row.organizationId && ['brand', 'material', 'type'].includes(type) && (
                                        <>
                                            <IconButton size="small" color="primary" onClick={() => handlePromote(type, row.id)} title={t('referenceData.promote')}>
                                                <ArrowUpCircle size={16} />
                                            </IconButton>
                                            <IconButton size="small" color="warning" onClick={() => {
                                                setMergeType(type as any);
                                                setMergeSource(row);
                                                setIsMergeModalOpen(true);
                                            }} title={t('referenceData.merge')}>
                                                <GitMerge size={16} />
                                            </IconButton>
                                        </>
                                    )}
                                    <IconButton size="small" color="error" onClick={() => handleDelete(type, row.id)}><Trash2 size={16} /></IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                        {sorted.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.secondary' }}>{t('referenceData.noItems')}</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        );
    };

    const ScopeFilter = () => (
        <FormControl size="small" sx={{ minWidth: 120 }}>
            <Select
                value={viewScope}
                onChange={(e) => setViewScope(e.target.value as any)}
                displayEmpty
            >
                <MenuItem value="all">{t('referenceData.allScopes')}</MenuItem>
                <MenuItem value="global">{t('referenceData.globalOnly')}</MenuItem>
                <MenuItem value="local">{t('referenceData.personalOnly')}</MenuItem>
            </Select>
        </FormControl>
    );

    return (
        <Box sx={{ width: '100%', p: 3 }}>
            <PageHeader 
                title={t('referenceData.title', 'Reference Data')}
                icon={Database}
            />

            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
                    <Tab label={t('referenceData.tabBrands')} />
                    <Tab label={t('referenceData.tabMaterials')} />
                    <Tab label={t('referenceData.tabTypes')} />
                    <Tab label={t('referenceData.tabOptions')} />
                    <Tab label={t('referenceData.tabCatalog')} />
                    <Tab label={t('referenceData.tabColors')} />
                </Tabs>
            </Box>

            {(syncing || syncingColors) && (
                <Alert severity="info" sx={{ mx: 3, mb: 3 }}>
                    <Stack spacing={1}>
                        <Typography variant="body2">
                            {syncingColors ? t('referenceData.syncSpoolmanColors') : t('referenceData.syncSpoolman')}
                            {spoolmanProgress !== null ? ` - ${Math.round(spoolmanProgress)}%` : ''}
                        </Typography>
                        <LinearProgress
                            variant={spoolmanProgress !== null ? 'determinate' : 'indeterminate'}
                            value={spoolmanProgress ?? 0}
                        />
                    </Stack>
                </Alert>
            )}


            <Box sx={{ px: 3, mb: 3 }}>
                <Stack direction="row" justifyContent="flex-end" alignItems="center" spacing={2}>
                    <TextField
                        placeholder={t('common.search')}
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
                        sx={{ width: 280 }}
                    />
                    <ScopeFilter />
                </Stack>
            </Box>

            <TabPanel value={activeTab} index={0}>
                <Box sx={{ mb: 2, display: 'flex', gap: 2 }}>
                    <Button variant="contained" startIcon={<Plus />} onClick={() => handleCreate('brand', true)}>{t('referenceData.addGlobal')}</Button>
                    <Button variant="outlined" startIcon={<Plus />} onClick={() => handleCreate('brand', false)}>{t('referenceData.addCustom')}</Button>
                </Box>
                {renderTable(brands, 'brand')}
            </TabPanel>

            <TabPanel value={activeTab} index={1}>
                <Box sx={{ mb: 2, display: 'flex', gap: 2 }}>
                    <Button variant="contained" startIcon={<Plus />} onClick={() => handleCreate('material', true)}>{t('referenceData.addGlobal')}</Button>
                    <Button variant="outlined" startIcon={<Plus />} onClick={() => handleCreate('material', false)}>{t('referenceData.addCustom')}</Button>
                </Box>
                {renderTable(materials, 'material')}
            </TabPanel>

            <TabPanel value={activeTab} index={2}>
                <Box sx={{ mb: 2, display: 'flex', gap: 2 }}>
                    <Button variant="contained" startIcon={<Plus />} onClick={() => handleCreate('type', true)}>{t('referenceData.addGlobal')}</Button>
                    <Button variant="outlined" startIcon={<Plus />} onClick={() => handleCreate('type', false)}>{t('referenceData.addCustom')}</Button>
                </Box>
                {renderTable(types, 'type')}
            </TabPanel>

            <TabPanel value={activeTab} index={3}>
                <Box sx={{ mb: 2, display: 'flex', gap: 2 }}>
                    <Button variant="contained" startIcon={<Plus />} onClick={() => handleCreate('option', true)}>{t('referenceData.addGlobal')}</Button>
                    <Button variant="outlined" startIcon={<Plus />} onClick={() => handleCreate('option', false)}>{t('referenceData.addCustom')}</Button>
                </Box>
                <TableContainer component={Paper}>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>
                                    <TableSortLabel active={sortField === 'category'} direction={sortField === 'category' ? sortDir : 'asc'} onClick={() => handleSort('category')}>
                                        {t('referenceData.category')}
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell>
                                    <TableSortLabel active={sortField === 'name'} direction={sortField === 'name' ? sortDir : 'asc'} onClick={() => handleSort('name')}>
                                        {t('referenceData.name')}
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell>
                                    <TableSortLabel active={sortField === 'organization'} direction={sortField === 'organization' ? sortDir : 'asc'} onClick={() => handleSort('organization')}>
                                        {t('referenceData.organization')}
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell>
                                    <TableSortLabel active={sortField === 'scope'} direction={sortField === 'scope' ? sortDir : 'asc'} onClick={() => handleSort('scope')}>
                                        {t('referenceData.scope')}
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell align="right">{t('referenceData.actions')}</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {sortAndFilter(options).map((row) => (
                                <TableRow key={row.id} hover>
                                    <TableCell>
                                        <Chip label={row.category} size="small" variant="outlined" sx={{ textTransform: 'capitalize' }} />
                                    </TableCell>
                                    <TableCell sx={{ fontWeight: 500 }}>{row.name}</TableCell>
                                    <TableCell>{row.organization?.name || '-'}</TableCell>
                                    <TableCell>
                                        {row.organizationId
                                            ? <Chip label={t('referenceData.custom')} size="small" variant="outlined" />
                                            : <Chip label={t('referenceData.global')} color="primary" size="small" variant="filled" />
                                        }
                                    </TableCell>
                                    <TableCell align="right">
                                        <IconButton size="small" onClick={() => handleEdit('option', row)}><Edit2 size={16} /></IconButton>
                                        <IconButton size="small" color="error" onClick={() => handleDelete('option', row.id)}><Trash2 size={16} /></IconButton>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {sortAndFilter(options).length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>{t('referenceData.noItems')}</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </TabPanel>

            <TabPanel value={activeTab} index={4}>
                <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <Button variant="contained" startIcon={<Plus />} onClick={() => { setIsGlobalCatalog(true); setIsBrandCatalogModalOpen(true); }}>{t('referenceData.addGlobalEntry')}</Button>
                    <Button variant="outlined" startIcon={<Plus />} onClick={() => { setIsGlobalCatalog(false); setIsBrandCatalogModalOpen(true); }}>{t('referenceData.addPersonalEntry')}</Button>
                    <Box sx={{ flexGrow: 1 }} />
                    {(user?.isSuperAdmin || ['super_admin', 'admin', 'moderator'].includes(user?.systemRole || '')) && (
                        <Button variant="outlined" color="secondary" startIcon={<Database />} onClick={handleSyncSpoolman} disabled={syncing}>
                            {syncing && spoolmanProgress !== null
                                ? `${t('referenceData.syncSpoolman')} ${Math.round(spoolmanProgress)}%`
                                : t('referenceData.syncSpoolman')}
                        </Button>
                    )}
                </Box>
                <TableContainer component={Paper}>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>{t('referenceData.filterBrand') || "Brand"}</TableCell>
                                <TableCell>{t('referenceData.filterMaterial') || "Material"}</TableCell>
                                <TableCell>{t('referenceData.filterType') || "Type"}</TableCell>
                                <TableCell>{t('referenceData.density')}</TableCell>
                                <TableCell>{t('referenceData.nozzle')}</TableCell>
                                <TableCell>{t('referenceData.bed')}</TableCell>
                                <TableCell>
                                    <TableSortLabel active={sortField === 'organization'} direction={sortField === 'organization' ? sortDir : 'asc'} onClick={() => handleSort('organization')}>
                                        {t('referenceData.organization')}
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell>
                                    <TableSortLabel active={sortField === 'scope'} direction={sortField === 'scope' ? sortDir : 'asc'} onClick={() => handleSort('scope')}>
                                        {t('referenceData.scope')}
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell align="right">{t('referenceData.actions')}</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {sortAndFilter(brandCatalog).map((row) => (
                                <TableRow key={row.id} hover>
                                    <TableCell sx={{ fontWeight: 500 }}>{row.brand?.name}</TableCell>
                                    <TableCell>{row.material?.name}</TableCell>
                                    <TableCell>{row.type?.name}</TableCell>
                                    <TableCell>{row.density_gcm3 ?? '-'}</TableCell>
                                    <TableCell>{row.nozzle_temp_min}-{row.nozzle_temp_max}</TableCell>
                                    <TableCell>{row.bed_temp_min}-{row.bed_temp_max}</TableCell>
                                    <TableCell>{row.organization?.name || '-'}</TableCell>
                                    <TableCell>
                                        {row.organizationId
                                            ? <Chip label={t('referenceData.custom')} size="small" variant="outlined" />
                                            : <Chip label={t('referenceData.global')} color="primary" size="small" variant="filled" />
                                        }
                                    </TableCell>
                                    <TableCell align="right">
                                        <IconButton size="small" onClick={() => handleEdit('catalog', row)}><Edit2 size={16} /></IconButton>
                                        <IconButton size="small" color="error" onClick={() => handleDelete('catalog', row.id)}><Trash2 size={16} /></IconButton>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {sortAndFilter(brandCatalog).length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={9} align="center" sx={{ py: 4, color: 'text.secondary' }}>{t('referenceData.noItems')}</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </TabPanel>

            <TabPanel value={activeTab} index={5}>
                <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <Button variant="contained" startIcon={<Plus />} onClick={() => handleCreate('color', true)}>{t('referenceData.addGlobal')}</Button>
                    <Button variant="outlined" startIcon={<Plus />} onClick={() => handleCreate('color', false)}>{t('referenceData.addCustom')}</Button>
                    <Box sx={{ flexGrow: 1 }} />
                    {(user?.isSuperAdmin || ['super_admin', 'admin', 'moderator'].includes(user?.systemRole || '')) && (
                        <Button variant="outlined" color="secondary" startIcon={<Database />} onClick={handleSyncSpoolmanColors} disabled={syncingColors}>
                            {syncingColors && spoolmanProgress !== null
                                ? `${t('referenceData.syncSpoolmanColors')} ${Math.round(spoolmanProgress)}%`
                                : t('referenceData.syncSpoolmanColors')}
                        </Button>
                    )}
                </Box>

                <Box
                    sx={{
                        mb: 2,
                        display: 'grid',
                        gridTemplateColumns: {
                            xs: '1fr',
                            sm: 'repeat(2, minmax(0, 1fr))',
                            lg: 'repeat(4, minmax(0, 1fr))',
                        },
                        gap: 1.5,
                    }}
                >
                    <Autocomplete
                        size="small"
                        options={brands}
                        value={colorBrandFilter}
                        onChange={(_, value) => setColorBrandFilter(value)}
                        getOptionLabel={(option) => option?.name || ''}
                        renderInput={(params) => <TextField {...params} label={t('referenceData.brand')} />}
                    />
                    <Autocomplete
                        size="small"
                        options={materials}
                        value={colorMaterialFilter}
                        onChange={(_, value) => setColorMaterialFilter(value)}
                        getOptionLabel={(option) => option?.name || ''}
                        renderInput={(params) => <TextField {...params} label={t('referenceData.material')} />}
                    />
                    <Autocomplete
                        size="small"
                        options={types}
                        value={colorTypeFilter}
                        onChange={(_, value) => setColorTypeFilter(value)}
                        getOptionLabel={(option) => option?.name || ''}
                        renderInput={(params) => <TextField {...params} label={t('referenceData.type')} />}
                    />
                    <FormControl size="small">
                        <InputLabel>{t('referenceData.source')}</InputLabel>
                        <Select value={colorSourceFilter} label={t('referenceData.source')} onChange={(e) => setColorSourceFilter(e.target.value as any)}>
                            <MenuItem value="all">{t('referenceData.allSources')}</MenuItem>
                            <MenuItem value="manual">{t('referenceData.manual')}</MenuItem>
                            <MenuItem value="spoolman">Spoolman</MenuItem>
                        </Select>
                    </FormControl>
                </Box>

                <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
                    <Table size="small" sx={{ tableLayout: 'fixed', width: colorTableWidth, minWidth: '100%' }}>
                        <colgroup>
                            {['name', 'brand', 'material', 'type', 'color', 'source', 'organization', 'scope', 'actions'].map(key => (
                                <col key={key} style={{ width: colorColumnWidths[key] }} />
                            ))}
                        </colgroup>
                        <TableHead>
                            <TableRow>
                                {renderResizableColorHeader('name', t('referenceData.name'))}
                                {renderResizableColorHeader('brand', t('referenceData.brand'))}
                                {renderResizableColorHeader('material', t('referenceData.material'))}
                                {renderResizableColorHeader('type', t('referenceData.type'))}
                                {renderResizableColorHeader('color', t('referenceData.color'))}
                                {renderResizableColorHeader('source', t('referenceData.source'))}
                                {renderResizableColorHeader('organization', t('referenceData.organization'))}
                                {renderResizableColorHeader('scope', t('referenceData.scope'))}
                                {renderResizableColorHeader('actions', t('referenceData.actions'), 'right')}
                            </TableRow>
                            <TableRow>
                                <TableCell>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        placeholder={t('common.search')}
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </TableCell>
                                <TableCell>
                                    <Autocomplete
                                        fullWidth
                                        size="small"
                                        options={brands}
                                        value={colorBrandFilter}
                                        onChange={(_, value) => setColorBrandFilter(value)}
                                        getOptionLabel={(option) => option?.name || ''}
                                        renderInput={(params) => <TextField {...params} placeholder={t('referenceData.brand')} />}
                                    />
                                </TableCell>
                                <TableCell>
                                    <Autocomplete
                                        fullWidth
                                        size="small"
                                        options={materials}
                                        value={colorMaterialFilter}
                                        onChange={(_, value) => setColorMaterialFilter(value)}
                                        getOptionLabel={(option) => option?.name || ''}
                                        renderInput={(params) => <TextField {...params} placeholder={t('referenceData.material')} />}
                                    />
                                </TableCell>
                                <TableCell>
                                    <Autocomplete
                                        fullWidth
                                        size="small"
                                        options={types}
                                        value={colorTypeFilter}
                                        onChange={(_, value) => setColorTypeFilter(value)}
                                        getOptionLabel={(option) => option?.name || ''}
                                        renderInput={(params) => <TextField {...params} placeholder={t('referenceData.type')} />}
                                    />
                                </TableCell>
                                <TableCell />
                                <TableCell>
                                    <FormControl size="small" fullWidth>
                                        <Select value={colorSourceFilter} onChange={(e) => setColorSourceFilter(e.target.value as any)} displayEmpty>
                                            <MenuItem value="all">{t('referenceData.allSources')}</MenuItem>
                                            <MenuItem value="manual">{t('referenceData.manual')}</MenuItem>
                                            <MenuItem value="spoolman">Spoolman</MenuItem>
                                        </Select>
                                    </FormControl>
                                </TableCell>
                                <TableCell />
                                <TableCell>
                                    <ScopeFilter />
                                </TableCell>
                                <TableCell />
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {paginatedColorReferences.map((row) => {
                                const hexes = row.hexes?.length ? row.hexes : [row.primaryHex];
                                return (
                                    <TableRow key={row.id} hover>
                                        <TableCell sx={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</TableCell>
                                        <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.brand?.name}</TableCell>
                                        <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.material?.name || '-'}</TableCell>
                                        <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.type?.name || '-'}</TableCell>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                                                <ColorIndicator colors={hexes} size={24} />
                                                <Typography variant="body2" noWrap sx={{ minWidth: 0 }}>
                                                    {hexes.join(', ')}
                                                </Typography>
                                            </Box>
                                        </TableCell>
                                        <TableCell><Chip label={row.source || 'manual'} size="small" variant="outlined" sx={{ maxWidth: '100%', '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }} /></TableCell>
                                        <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.organization?.name || '-'}</TableCell>
                                        <TableCell>
                                            {row.organizationId
                                                ? <Chip label={t('referenceData.custom')} size="small" variant="outlined" />
                                                : <Chip label={t('referenceData.global')} color="primary" size="small" variant="filled" />
                                            }
                                        </TableCell>
                                        <TableCell align="right">
                                            <IconButton size="small" onClick={() => handleEdit('color', row)}><Edit2 size={16} /></IconButton>
                                            {row.organizationId && (
                                                <IconButton size="small" color="primary" onClick={() => handlePromote('color', row.id)} title={t('referenceData.promote')}>
                                                    <ArrowUpCircle size={16} />
                                                </IconButton>
                                            )}
                                            <IconButton size="small" color="error" onClick={() => handleDelete('color', row.id)}><Trash2 size={16} /></IconButton>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                            {filteredColorReferences.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={9} align="center" sx={{ py: 4, color: 'text.secondary' }}>{t('referenceData.noItems')}</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                    <TablePagination
                        component="div"
                        count={filteredColorReferences.length}
                        page={colorPage}
                        onPageChange={(_, page) => setColorPage(page)}
                        rowsPerPage={colorRowsPerPage}
                        onRowsPerPageChange={(event) => {
                            setColorRowsPerPage(Number(event.target.value));
                            setColorPage(0);
                        }}
                        rowsPerPageOptions={[10, 25, 50, 100]}
                    />
                </TableContainer>
            </TabPanel>

            {/* Modals */}
            <SpoolmanImportModal
                open={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onImport={async (brands, materials, importCombinations, updates) => {
                    await api.importSpoolman(brands, materials, importCombinations, updates);
                    fetchData();
                }}
                missingBrands={missingImportData.brands}
                missingMaterials={missingImportData.materials}
                missingCombinations={missingImportData.combinations}
                conflicts={missingImportData.conflicts}
            />

            <BrandCatalogModal
                open={isBrandCatalogModalOpen}
                onClose={() => setIsBrandCatalogModalOpen(false)}
                onSubmit={async (data) => {
                    try {
                        const tasks = [];
                        for (const mId of data.materialIds) {
                            for (const tId of data.typeIds) {
                                tasks.push(api.createBrandCatalogEntry(data.brandId, mId, tId, data.isGlobal, undefined));
                            }
                        }
                        await Promise.all(tasks);
                        fetchData();
                    } catch (e) {
                        console.error(e);
                        alert(t('referenceData.errorCreatingEntries'));
                    }
                }}
                brands={brands}
                materials={materials}
                types={types}
                isGlobal={isGlobalCatalog}
            />

            <Dialog open={isEditModalOpen} onClose={() => setIsEditModalOpen(false)}>
                <DialogTitle>{editingItem ? t('referenceData.editItem', { type: t(`referenceData.${editType}`, editType) }) : t('referenceData.createItem', { type: t(`referenceData.${editType}`, editType) })}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        {/* Show scope notice */}
                        {!editingItem && (
                            <Alert severity={isGlobalCreate ? "info" : "success"} icon={isGlobalCreate ? <Globe size={16} /> : <Building2 size={16} />}>
                                {isGlobalCreate ? t('referenceData.creatingGlobal') : t('referenceData.creatingPersonal')}
                            </Alert>
                        )}

                        {editType === 'catalog' ? (
                            <>
                                <Typography variant="subtitle2">{editingItem?.brand?.name} - {editingItem?.material?.name} ({editingItem?.type?.name})</Typography>
                                <TextField label={t('referenceData.densityWithUnit')} type="number" fullWidth value={editDensity} onChange={(e) => setEditDensity(e.target.value as any)} />
                                <Stack direction="row" spacing={2}>
                                    <TextField label={t('referenceData.nozzleMin')} type="number" fullWidth value={editNozzleMin} onChange={(e) => setEditNozzleMin(e.target.value as any)} />
                                    <TextField label={t('referenceData.nozzleMax')} type="number" fullWidth value={editNozzleMax} onChange={(e) => setEditNozzleMax(e.target.value as any)} />
                                </Stack>
                                <Stack direction="row" spacing={2}>
                                    <TextField label={t('referenceData.bedMin')} type="number" fullWidth value={editBedMin} onChange={(e) => setEditBedMin(e.target.value as any)} />
                                    <TextField label={t('referenceData.bedMax')} type="number" fullWidth value={editBedMax} onChange={(e) => setEditBedMax(e.target.value as any)} />
                                </Stack>
                            </>
                        ) : editType === 'color' ? (
                            <>
                                <TextField label={t('referenceData.name')} fullWidth value={editName} onChange={(e) => setEditName(e.target.value)} />
                                <Autocomplete
                                    options={brands}
                                    value={brands.find(brand => brand.id === editBrandId) || null}
                                    onChange={(_, value) => setEditBrandId(value?.id || '')}
                                    getOptionLabel={(option) => option?.name || ''}
                                    renderInput={(params) => <TextField {...params} label={t('referenceData.brand')} />}
                                />
                                <Autocomplete
                                    options={materials}
                                    value={materials.find(material => material.id === editMaterialId) || null}
                                    onChange={(_, value) => setEditMaterialId(value?.id || '')}
                                    getOptionLabel={(option) => option?.name || ''}
                                    renderInput={(params) => <TextField {...params} label={t('referenceData.materialOptional')} />}
                                />
                                <Autocomplete
                                    options={types}
                                    value={types.find(type => type.id === editTypeId) || null}
                                    onChange={(_, value) => setEditTypeId(value?.id || '')}
                                    getOptionLabel={(option) => option?.name || ''}
                                    renderInput={(params) => <TextField {...params} label={t('referenceData.typeOptional')} />}
                                />
                                <Stack spacing={1}>
                                    {(colorHexList.length ? colorHexList : [editColorHex]).map((hex, index) => (
                                        <Box
                                            key={index}
                                            sx={{
                                                display: 'grid',
                                                gridTemplateColumns: '52px minmax(0, 1fr) auto',
                                                gap: 1,
                                                alignItems: 'center',
                                            }}
                                        >
                                            <Box
                                                component="input"
                                                type="color"
                                                value={/^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '#000000'}
                                                onChange={(e: any) => setColorHexAt(index, e.target.value)}
                                                sx={{ width: 48, height: 48, p: 0.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
                                            />
                                            <TextField
                                                label={index === 0 ? t('referenceData.primaryHex') : t('referenceData.hexNumber', { number: index + 1 })}
                                                fullWidth
                                                value={hex}
                                                onChange={(e) => setColorHexAt(index, e.target.value)}
                                            />
                                            <IconButton
                                                size="small"
                                                color="error"
                                                disabled={(colorHexList.length ? colorHexList.length : 1) <= 1}
                                                onClick={() => removeColorHex(index)}
                                            >
                                                <Trash2 size={16} />
                                            </IconButton>
                                        </Box>
                                    ))}
                                    <Button variant="outlined" startIcon={<Plus />} onClick={addColorHex}>
                                        {t('referenceData.addColor')}
                                    </Button>
                                </Stack>
                            </>
                        ) : (
                            <>
                                    <TextField label={t('referenceData.name')} fullWidth value={editName} onChange={(e) => setEditName(e.target.value)} />
                                {editType === 'option' && (
                                    <FormControl fullWidth>
                                        <InputLabel>{t('referenceData.category')}</InputLabel>
                                        <Select value={editCategory} label={t('referenceData.category')} onChange={(e) => setEditCategory(e.target.value)}>
                                            <MenuItem value="color">{t('referenceData.color')}</MenuItem>
                                            <MenuItem value="material">{t('referenceData.material')}</MenuItem>
                                            <MenuItem value="finish">{t('inventory.finish')}</MenuItem>
                                        </Select>
                                    </FormControl>
                                )}
                            </>
                        )}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setIsEditModalOpen(false)}>{t('common.cancel')}</Button>
                    <Button variant="contained" onClick={handleSave}>{t('common.save')}</Button>
                </DialogActions>
            </Dialog>

            <MergeReferenceDataModal
                open={isMergeModalOpen}
                onClose={() => setIsMergeModalOpen(false)}
                sourceItem={mergeSource}
                type={mergeType}
                onSuccess={() => { fetchData(); }}
            />

        </Box>
    );
}
