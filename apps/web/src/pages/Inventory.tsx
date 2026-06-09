import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
    Box,
    Button,
    Card,
    CardContent,
    TextField,
    Typography,
    IconButton,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableRow,
    Grid,
    Chip,
    InputAdornment,
    Divider,
    Select,
    MenuItem,
    Menu,
    LinearProgress,
    Alert,
    CircularProgress,
    Checkbox,
    Tooltip,
    useTheme
} from '@mui/material';
import {
    Plus,
    Search,
    LayoutGrid,
    List as ListIcon,
    Edit2,
    Trash2,
    Copy,
    PencilRuler,
    Filter,
    Table as TableIcon,
    X,
    Eye,
    EyeOff,
    ArrowDown,
    ArrowUp,
    Link as LinkIcon,
    CheckSquare,
    FileJson,
    Scale,
    Lock,
    Printer,
    Package,
    ChevronDown,
    ChevronRight,
    Archive,
    Star,
    MoreHorizontal
} from 'lucide-react';
import InventoryDataGrid from '../components/InventoryDataGrid';
import { generateOrcaProfile } from '../utils/orcaProfileGenerator';
import LabelGenerator from '../components/LabelGenerator';

import { api } from '../api';
import type { Filament, Brand, FilamentType, FilamentMaterial } from '../api';
import { useAuth } from '../contexts/AuthContext';
import ConsumptionModal from '../components/ConsumptionModal';
import AddFilamentModal from '../components/AddFilamentModal';
import HistoryModal from '../components/HistoryModal';
import { InventoryFilters, type FilterState } from '../components/InventoryFilters';
import ColorIndicator from '../components/ColorIndicator';
import { getFilamentTitle, getFilamentChips, checkIsLowStock } from '../utils/filament-utils';
import BulkEditModal from '../components/BulkEditModal';
import PageHeader from '../components/PageHeader';
import StatsBanner from '../components/StatsBanner';
import StorageRackView from '../components/StorageRackView';


// Helper for Robust Color Parsing
const getSafeColors = (f: Filament | { color: string, colors?: string[] }): string[] => {
    let colors = f.colors;
    if (typeof colors === 'string') {
        // Handle potential simple-array string return from API
        colors = (colors as string).split(',');
    }
    if (Array.isArray(colors) && colors.length > 0) {
        return colors;
    }
    return [f.color || '#000000'];
};

const hasPositiveValue = (value: unknown) => Number(value || 0) > 0;
const hasPositivePrice = (price: unknown) => Number(price || 0) > 0;
const temperatureRangeLabel = (prefix: string, min?: number | null, max?: number | null, fallbackMin?: number | null) => (
    `${prefix}: ${min || fallbackMin || '?'} - ${max || '?'}°C`
);
const technicalChipSx = { cursor: 'pointer' };
const secondaryActionSx = {
    width: 34,
    height: 34,
    color: 'text.secondary',
    '&:hover': { color: 'primary.main', bgcolor: 'action.hover' },
};
const primaryActionSx = {
    width: 38,
    height: 38,
    bgcolor: 'action.hover',
};
const overflowActionButtonSx = {
    ...secondaryActionSx,
    display: { xs: 'inline-flex', xl: 'none' },
};
const inlineSecondaryActionSx = {
    ...secondaryActionSx,
    display: { xs: 'none', xl: 'inline-flex' },
};
const getStorageLocationLabel = (f: Filament): string | null => {
    if (!f.storageUnit && !f.storageUnitId) return null;
    const slotLabel = f.storageLevel !== null && f.storageLevel !== undefined && f.storageSlot !== null && f.storageSlot !== undefined
        ? `${String.fromCharCode(65 + Number(f.storageLevel))}${Number(f.storageSlot) + 1}`
        : null;
    const parts = [
        f.storageUnit?.location,
        f.storageUnit?.name || (f.storageUnitId ? `#${f.storageUnitId}` : null),
        slotLabel,
    ].filter(Boolean);
    return parts.length ? parts.join(' / ') : null;
};
const viewButtonSx = (active: boolean) => ({
    width: 38,
    height: 38,
    borderRadius: 1.5,
    border: '1px solid',
    borderColor: active ? 'primary.main' : 'divider',
    bgcolor: active ? 'primary.main' : 'background.paper',
    color: active ? 'primary.contrastText' : 'text.secondary',
    boxShadow: active ? '0 6px 14px rgba(22, 97, 175, 0.24)' : 'none',
    '&:hover': {
        bgcolor: active ? 'primary.dark' : 'action.hover',
        borderColor: 'primary.main',
        color: active ? 'primary.contrastText' : 'primary.main',
    },
});

const InventoryRow = ({
    f,
    isSelectionMode,
    selectionModel,
    setSelectionModel,
    associateTagId,
    handleAssociate,
    handleEdit,
    handleDelete,
    handleClone,
    handleUnlock,
    handleConsumption,
    handleMarkAsEmpty,
    handleHistory,
    handlePrintLabel,
    handleExportProfile,
    handleToggleFavorite,
    organization,
    isChild = false
}: {
    f: Filament;
    isSelectionMode: boolean;
    selectionModel: any[];
    setSelectionModel: (val: any) => void;
    associateTagId: string | null;
    handleAssociate: (f: Filament) => void;
    handleEdit: (f: Filament) => void;
    handleDelete: (id: number) => void;
    handleClone: (id: number) => void;
    handleUnlock: (f: Filament) => void;
    handleConsumption: (f: Filament) => void;
    handleMarkAsEmpty: (f: Filament) => void;
    handleHistory: (f: Filament) => void;
    handlePrintLabel: (f: Filament) => void;
    handleExportProfile: (f: Filament) => void;
    handleToggleFavorite: (f: Filament) => void;
    organization: any;
    isChild?: boolean;
}) => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const usageStats = organization?.stats;
    const [actionsAnchorEl, setActionsAnchorEl] = useState<HTMLElement | null>(null);
    const canClone = !(f.isLocked || (usageStats && usageStats.limits.maxSpoolsPerOrg && usageStats.spoolsCount >= usageStats.limits.maxSpoolsPerOrg && !(user?.isSuperAdmin || ['super_admin', 'admin', 'moderator'].includes(user?.systemRole || ''))));
    const closeActionsMenu = () => setActionsAnchorEl(null);

    return (
        <TableRow key={f.id} hover sx={{ bgcolor: isChild ? 'action.hover' : 'inherit' }}>
            {isSelectionMode && (
                <TableCell padding="checkbox">
                    <Checkbox
                        checked={selectionModel.includes(f.id)}
                        onChange={(event) => {
                            const id = f.id;
                            if (event.target.checked) {
                                setSelectionModel((prev: any[]) => [...prev, id]);
                            } else {
                                setSelectionModel((prev: any[]) => prev.filter(item => item !== id));
                            }
                        }}
                        onClick={(e) => e.stopPropagation()}
                    />
                </TableCell>
            )}
            <TableCell sx={{ width: 28 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: checkIsLowStock(f, organization) ? 'error.main' : 'success.main' }} />
                    {/* Recent Update Indicator - Reactivate later
                    {f.updatedAt && (new Date().getTime() - new Date(f.updatedAt).getTime() < 48 * 60 * 60 * 1000) && (
                        <Tooltip title={t('common.updatedRecently')}>
                            <Box sx={{ 
                                width: 6, 
                                height: 6, 
                                borderRadius: '50%', 
                                bgcolor: 'info.main',
                                animation: 'pulse 2s infinite ease-in-out',
                                '@keyframes pulse': {
                                    '0%': { opacity: 0.4, transform: 'scale(0.8)' },
                                    '50%': { opacity: 1, transform: 'scale(1.2)' },
                                    '100%': { opacity: 0.4, transform: 'scale(0.8)' }
                                }
                            }} />
                        </Tooltip>
                    )} */}
                </Box>
            </TableCell>
            <TableCell sx={{ minWidth: 200, width: 250 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, pr: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" fontWeight="bold">
                            {Math.round(f.weightRemaining)}g
                            {f.plannedWeight !== undefined && f.plannedWeight > 0 && (
                                <Box component="span" sx={{ color: 'text.secondary', fontWeight: 'normal', ml: 0.5 }}>
                                    ({Math.round(f.virtualWeightRemaining || 0)}g dispos)
                                </Box>
                            )}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">/ {Math.round(f.weightInitial || 1000)}g</Typography>
                        {
                            f.organization && (
                                <Chip key={f.organization?.id} label={f.organization?.name} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
                            )
                        }
                        {f.isLocked && (
                            <Chip icon={<Lock size={12} />} label="Locked" size="small" color="error" sx={{ height: 20, fontSize: '0.65rem' }} />
                        )}
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{
                            flexGrow: 1,
                            height: 6,
                            borderRadius: 3,
                            bgcolor: 'rgba(0,0,0,0.05)',
                            position: 'relative',
                            overflow: 'hidden',
                            border: '1px solid rgba(0,0,0,0.05)'
                        }}>
                            <Box sx={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                height: '100%',
                                width: `${Math.min(100, (f.weightRemaining / (f.weightInitial || 1000)) * 100)}%`,
                                bgcolor: checkIsLowStock(f, organization) ? 'error.main' : 'primary.main',
                                transition: 'width 0.3s ease'
                            }} />
                            {f.plannedWeight !== undefined && f.plannedWeight > 0 && (
                                <Box sx={{
                                    position: 'absolute',
                                    left: `${Math.max(0, Math.min(100, ((f.virtualWeightRemaining || 0) / (f.weightInitial || 1000)) * 100))}%`,
                                    top: 0,
                                    height: '100%',
                                    width: `${Math.min(100, ((f.plannedWeight || 0) / (f.weightInitial || 1000)) * 100)}%`,
                                    bgcolor: 'rgba(255,255,255,0.4)',
                                    backgroundImage: 'linear-gradient(45deg, rgba(0,0,0,0.1) 25%, transparent 25%, transparent 50%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.1) 75%, transparent 75%, transparent)',
                                    backgroundSize: '8px 8px',
                                    transition: 'all 0.3s ease'
                                }} />
                            )}
                        </Box>
                    </Box>
                    <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.65rem' }}>
                        {((f.weightRemaining / (f.weightInitial || 1000)) * 100).toFixed(1).replace('.0', '')}% total
                        {f.plannedWeight !== undefined && f.plannedWeight > 0 && ` • ${((f.virtualWeightRemaining || 0) / (f.weightInitial || 1000) * 100).toFixed(1).replace('.0', '')}% dispo`}
                    </Typography>
                </Box>
            </TableCell>
            <TableCell>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {getFilamentChips(f).map((opt: any) => (
                        <Chip key={opt.id} label={opt.name} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
                    ))}
                    {f.spoolReference && <Chip label={`Ref: ${f.spoolReference}`} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />}
                    {getStorageLocationLabel(f) && (
                        <Chip label={`${t('inventory.storage.title')}: ${getStorageLocationLabel(f)}`} size="small" color="primary" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
                    )}
                    {(hasPositiveValue(f.nozzleTempMin) || hasPositiveValue(f.nozzleTempMax)) && (
                        <Tooltip title={t('inventory.nozzle')}>
                            <Chip label={temperatureRangeLabel('N', f.nozzleTempMin, f.nozzleTempMax)} size="small" color="secondary" variant="outlined" sx={{ height: 20, fontSize: '0.65rem', ...technicalChipSx }} />
                        </Tooltip>
                    )}
                    {(hasPositiveValue(f.bedTempMin) || hasPositiveValue(f.bedTempMax) || hasPositiveValue((f as any).bedTemp)) && (
                        <Tooltip title={t('inventory.bed')}>
                            <Chip label={temperatureRangeLabel('B', f.bedTempMin, f.bedTempMax, (f as any).bedTemp)} size="small" color="secondary" variant="outlined" sx={{ height: 20, fontSize: '0.65rem', ...technicalChipSx }} />
                        </Tooltip>
                    )}
                    {(hasPositiveValue(f.chamberTempMin) || hasPositiveValue(f.chamberTempMax)) && (
                        <Tooltip title={t('inventory.filamentModal.chamber')}>
                            <Chip label={temperatureRangeLabel('C', f.chamberTempMin, f.chamberTempMax)} size="small" color="secondary" variant="outlined" sx={{ height: 20, fontSize: '0.65rem', ...technicalChipSx }} />
                        </Tooltip>
                    )}
                    {(hasPositiveValue(f.dryTemp) || hasPositiveValue(f.dryTime)) && (
                        <Tooltip title={t('inventory.filamentModal.drying')}>
                            <Chip label={`Dry: ${f.dryTemp || '?'}°C${hasPositiveValue(f.dryTime) ? ` / ${f.dryTime}h` : ''}`} size="small" color="secondary" variant="outlined" sx={{ height: 20, fontSize: '0.65rem', ...technicalChipSx }} />
                        </Tooltip>
                    )}
                    {hasPositivePrice(f.price) && (
                        <Chip label={`${f.price}€`} size="small" color="success" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
                    )}
                    {f.vendor && <Chip label={f.vendor} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />}
                    {f.nfcTagId && (
                        <Tooltip title={f.nfcTagId}>
                            <Chip icon={<LinkIcon size={12} />} label="NFC" size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
                        </Tooltip>
                    )}
                </Box>
            </TableCell>
            <TableCell align="right" sx={{ verticalAlign: 'middle', minWidth: { xs: 142, xl: 310 } }}>
                {associateTagId ? (
                    <Button
                        variant="contained"
                        size="small"
                        startIcon={<LinkIcon size={16} />}
                        onClick={() => handleAssociate(f)}
                        color="primary"
                    >
                        Link
                    </Button>
                ) : (
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: { xs: 0.25, xl: 0.5 } }}>
                        <Tooltip title={f.favorite ? t('inventory.removeFavorite', 'Retirer des favoris') : t('inventory.addFavorite', 'Ajouter aux favoris')}>
                            <IconButton
                                size="small"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleFavorite(f);
                                }}
                                sx={{ ...inlineSecondaryActionSx, color: f.favorite ? '#f5b301' : 'text.secondary' }}
                            >
                                <Star size={20} fill={f.favorite ? 'currentColor' : 'none'} />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title={f.isLocked ? t('common.lockedQuota') : t('inventory.logConsumption')}>
                            <span>
                                <IconButton size="small" onClick={() => handleConsumption(f)} disabled={f.isLocked} sx={inlineSecondaryActionSx}>
                                    <PencilRuler size={18} />
                                </IconButton>
                            </span>
                        </Tooltip>
                        <Tooltip title={t('inventory.markAsEmpty', 'Marquer comme vide')}>
                            <span>
                                <IconButton size="small" onClick={() => handleMarkAsEmpty(f)} disabled={f.isLocked || f.weightRemaining <= 0} sx={inlineSecondaryActionSx}>
                                    <Archive size={18} />
                                </IconButton>
                            </span>
                        </Tooltip>
                        <Tooltip title={!canClone ? t('common.quotaReached', 'Quota atteint') : t('common.clone')}>
                            <span>
                                <IconButton
                                    size="small"
                                    onClick={() => handleClone(f.id)}
                                    disabled={!canClone}
                                    sx={inlineSecondaryActionSx}
                                >
                                    <Copy size={18} />
                                </IconButton>
                            </span>
                        </Tooltip>
                        <Tooltip title={t('common.exportProfile', 'Exporter le profil')}>
                            <IconButton size="small" onClick={() => handleExportProfile(f)} sx={inlineSecondaryActionSx}>
                                <FileJson size={18} />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title={t('common.printLabel', 'Imprimer l’étiquette')}>
                            <IconButton size="small" onClick={() => handlePrintLabel(f)} sx={inlineSecondaryActionSx}>
                                <Printer size={18} />
                            </IconButton>
                        </Tooltip>
                        {f.isLocked && (
                            <Tooltip title={t('common.unlock', 'Déverrouiller')}>
                                <IconButton size="small" onClick={() => handleUnlock(f)} color="warning" sx={inlineSecondaryActionSx}>
                                    <Lock size={18} />
                                </IconButton>
                            </Tooltip>
                        )}
                        <Tooltip title={t('common.actions')}>
                            <IconButton size="small" onClick={(event) => setActionsAnchorEl(event.currentTarget)} sx={overflowActionButtonSx}>
                                <MoreHorizontal size={20} />
                            </IconButton>
                        </Tooltip>
                        <Menu
                            anchorEl={actionsAnchorEl}
                            open={Boolean(actionsAnchorEl)}
                            onClose={closeActionsMenu}
                            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                        >
                            <MenuItem onClick={() => { handleToggleFavorite(f); closeActionsMenu(); }}>
                                <Star size={17} fill={f.favorite ? 'currentColor' : 'none'} style={{ marginRight: 10, color: f.favorite ? '#f5b301' : 'currentColor' }} />
                                {f.favorite ? t('inventory.removeFavorite', 'Retirer des favoris') : t('inventory.addFavorite', 'Ajouter aux favoris')}
                            </MenuItem>
                            <MenuItem disabled={f.isLocked} onClick={() => { handleConsumption(f); closeActionsMenu(); }}>
                                <PencilRuler size={17} style={{ marginRight: 10 }} />
                                {t('inventory.logConsumption')}
                            </MenuItem>
                            <MenuItem disabled={f.isLocked || f.weightRemaining <= 0} onClick={() => { handleMarkAsEmpty(f); closeActionsMenu(); }}>
                                <Archive size={17} style={{ marginRight: 10 }} />
                                {t('inventory.markAsEmpty', 'Marquer comme vide')}
                            </MenuItem>
                            <MenuItem disabled={!canClone} onClick={() => { handleClone(f.id); closeActionsMenu(); }}>
                                <Copy size={17} style={{ marginRight: 10 }} />
                                {t('common.clone')}
                            </MenuItem>
                            <MenuItem onClick={() => { handleExportProfile(f); closeActionsMenu(); }}>
                                <FileJson size={17} style={{ marginRight: 10 }} />
                                {t('common.exportProfile', 'Exporter le profil')}
                            </MenuItem>
                            <MenuItem onClick={() => { handlePrintLabel(f); closeActionsMenu(); }}>
                                <Printer size={17} style={{ marginRight: 10 }} />
                                {t('common.printLabel', 'Imprimer etiquette')}
                            </MenuItem>
                            {f.isLocked && (
                                <MenuItem onClick={() => { handleUnlock(f); closeActionsMenu(); }}>
                                    <Lock size={17} style={{ marginRight: 10 }} />
                                    {t('common.unlock', 'Déverrouiller')}
                                </MenuItem>
                            )}
                        </Menu>
                        <Tooltip title={f.isLocked ? t('common.lockedQuota') : t('common.edit')}>
                            <span>
                                <IconButton size="small" onClick={() => handleEdit(f)} disabled={f.isLocked} color="primary" sx={{ ...primaryActionSx, width: { xs: 34, xl: 38 }, height: { xs: 34, xl: 38 } }}>
                                    <Edit2 size={20} />
                                </IconButton>
                            </span>
                        </Tooltip>
                        <Tooltip title={t('common.history')}>
                            <IconButton size="small" onClick={() => handleHistory(f)} color="info" sx={{ ...primaryActionSx, width: { xs: 34, xl: 38 }, height: { xs: 34, xl: 38 } }}>
                                <Eye size={20} />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title={t('common.delete')}>
                            <IconButton size="small" color="error" onClick={() => handleDelete(f.id)} sx={{ ...primaryActionSx, width: { xs: 34, xl: 38 }, height: { xs: 34, xl: 38 }, bgcolor: 'rgba(211, 47, 47, 0.08)' }}>
                                <Trash2 size={20} />
                            </IconButton>
                        </Tooltip>
                    </Box>
                )}
            </TableCell>
        </TableRow>
    );
};

export default function InventoryPage() {
    const { t } = useTranslation();
    const { user, isLoading: authLoading } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const theme = useTheme();

    const associateTagId = searchParams.get('associateTag');
    const aiItemId = searchParams.get('aiItem');
    const aiOpen = searchParams.get('aiOpen');
    const aiDate = searchParams.get('aiDate');

    const searchInputRef = useRef<HTMLInputElement>(null);



    // Data State
    const [filaments, setFilaments] = useState<Filament[]>([]);
    const [brands, setBrands] = useState<Brand[]>([]);
    const [materials, setMaterials] = useState<FilamentMaterial[]>([]);
    const [types, setTypes] = useState<FilamentType[]>([]);
    const [options, setOptions] = useState<any>({});
    const [brandCatalog, setBrandCatalog] = useState<any[]>([]);

    // UI State
    const [loading, setLoading] = useState(true);
    // const [search, setSearch] = useState(''); // Removed simple search state for complex filter
    const [viewMode, setViewMode] = useState<'grouped' | 'flat' | 'datagrid' | 'storage'>('grouped');

    // Filter State
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [filterState, setFilterState] = useState<FilterState>({
        search: '',
        brandIds: [],
        materialIds: [],
        typeIds: [],
        minWeight: 0,
        lowStock: false,
        favoriteOnly: false,
    });

    // Toggle State
    const [showDepleted, setShowDepleted] = useState(false);

    // Modal State
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingFilament, setEditingFilament] = useState<Filament | null>(null);
    const [consumptionFilament, setConsumptionFilament] = useState<Filament | null>(null);
    const [consumptionGroup, setConsumptionGroup] = useState<any>(null);
    const [historyFilament, setHistoryFilament] = useState<Filament | null>(null);
    const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
    const [labelFilaments, setLabelFilaments] = useState<Filament[]>([]);

    const [organization, setOrganization] = useState<any>(null);
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
    const [bulkEditGroup, setBulkEditGroup] = useState<any>(null);

    const toggleGroupExpand = (subKey: string) => {
        setExpandedGroups(prev => ({ ...prev, [subKey]: !prev[subKey] }));
    };

    // Focus restore
    useEffect(() => {
        if (!isAddModalOpen && !editingFilament && !consumptionFilament && !consumptionGroup && !historyFilament) {
            // Short timeout to allow UI to settle
            setTimeout(() => {
                searchInputRef.current?.focus();
            }, 100);
        }
    }, [isAddModalOpen, editingFilament, consumptionFilament, consumptionGroup, historyFilament]);

    // Handle URL Actions (Associate / Create)
    const [addModalParams, setAddModalParams] = useState<any>(null);

    useEffect(() => {
        const action = searchParams.get('action');
        const viewId = searchParams.get('viewId');

        if (viewId && filaments.length > 0) {
            const filamentToView = filaments.find(f => f.id === Number(viewId));
            if (filamentToView) {
                setEditingFilament(filamentToView);
                // Clean up URL without reload
                setSearchParams(prev => {
                    const next = new URLSearchParams(prev);
                    next.delete('viewId');
                    return next;
                });
            }
        }

        if (action === 'create') {
            const params = {
                brandId: Number(searchParams.get('initialBrandId')) || undefined,
                materialId: Number(searchParams.get('initialMaterialId')) || undefined,
                typeId: Number(searchParams.get('initialTypeId')) || undefined,
                typeName: searchParams.get('initialTypeName') || undefined,
                nfcTagId: searchParams.get('nfcTagId') || undefined,

                // Extra TigerTag Data
                color: searchParams.get('initialColor') || undefined,
                nozzleTempMin: Number(searchParams.get('initialNozzleMin')) || undefined,
                nozzleTempMax: Number(searchParams.get('initialNozzleMax')) || undefined,
                bedTempMin: Number(searchParams.get('initialBedMin')) || undefined,
                bedTempMax: Number(searchParams.get('initialBedMax')) || undefined,
                weightInitial: Number(searchParams.get('initialWeight')) || undefined,
                weightRemaining: Number(searchParams.get('initialWeightRemaining')) || undefined,
                dryTemp: Number(searchParams.get('initialDryTemp')) || undefined,
                dryTime: Number(searchParams.get('initialDryTime')) || undefined,
                diameterMm: Number(searchParams.get('initialDiameter')) || undefined,

                tigerBrandId: Number(searchParams.get('tigerBrandId')) || undefined,
                tigerMaterialId: Number(searchParams.get('tigerMaterialId')) || undefined,
                tigerTypeId: Number(searchParams.get('tigerTypeId')) || undefined
            };
            setAddModalParams(params);
            setIsAddModalOpen(true);
        }
    }, [searchParams, filaments]); // Added filaments dep to ensure we can find it

    const [isSelectionMode, setIsSelectionMode] = useState(false);

    // Initial Load
    useEffect(() => {
        if (!authLoading && user) {
            fetchData();
        }

        const handleUpdate = () => fetchData();
        window.addEventListener('inventory-updated', handleUpdate);
        return () => window.removeEventListener('inventory-updated', handleUpdate);
    }, [authLoading, user]);

    // Selection State
    const [selectionModel, setSelectionModel] = useState<any[]>([]);
    const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);

    const fetchData = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const orgId = localStorage.getItem('organization_id') || '1';
            const [filamentsData, brandsData, materialsData, typesData, optionsData, orgData, brandCatalogData] = await Promise.all([
                api.getAll(),
                api.getBrands(),
                api.getMaterials(),
                api.getTypes(),
                api.getOptions(),
                api.getOrgData(orgId),
                api.getBrandCatalog()
            ]);
            setFilaments(filamentsData || []);
            setBrands(brandsData || []);
            setMaterials(materialsData || []);
            setTypes(typesData || []);
            setOptions(optionsData || {});
            setOrganization(orgData);
            setBrandCatalog(brandCatalogData || []);
        } catch (error) {
            console.error('Failed to load inventory:', error);
            try {
                const all = await api.getAll();
                setFilaments(all);
            } catch (e) {
                console.error("Critical failure loading filaments", e);
            }
        } finally {
            if (!silent) setLoading(false);
        }
    };

    // Actions
    const handleDelete = async (id: number) => {
        let hasLogs = false;
        try {
            const logs = await api.getConsumptionHistory(id);
            hasLogs = logs && logs.length > 0;
        } catch (e) {
            console.warn('Could not check logs before deletion', e);
        }

        const message = hasLogs ? t('inventory.confirmDeleteWithLogs') : t('common.confirmDelete');

        if (window.confirm(message)) {
            try {
                await api.delete(id);
                fetchData();
            } catch (error) {
                console.error('Failed to delete', error);
            }
        }
    };

    const handleMarkAsEmpty = async (spool: Filament) => {
        if (window.confirm(t('inventory.confirmMarkAsEmpty', 'Voulez-vous déclarer cette bobine comme épuisée ? Aucune consommation fictive ne sera générée, elle sera juste masquée.'))) {
            try {
                await api.update(spool.id, { weightRemaining: 0 } as any);
                fetchData();
            } catch (error) {
                console.error('Failed to mark as empty', error);
            }
        }
    };

    const handleBulkDelete = async () => {
        let hasLogs = false;
        try {
            // Check if any selected filament has logs
            const historyChecks = await Promise.all(selectionModel.map(id => api.getConsumptionHistory(Number(id))));
            hasLogs = historyChecks.some(logs => logs && logs.length > 0);
        } catch (e) {
            console.warn('Bulk delete log check failed', e);
        }

        const message = hasLogs
            ? t('inventory.confirmDeleteWithLogs')
            : (t('inventory.deleteMultipleSpools', { count: selectionModel.length }) || `Delete ${selectionModel.length} items?`);

        if (!window.confirm(message)) return;
        setBulkDeleteLoading(true);
        try {
            await Promise.all(selectionModel.map(id => api.delete(Number(id))));
            setSelectionModel([]);
            fetchData();
        } catch (err) {
            console.error('Bulk delete error', err);
            alert('Some items could not be deleted');
        } finally {
            setBulkDeleteLoading(false);
        }
    };

    const handleClone = async (id: number) => {
        try {
            await api.cloneFilament(id);
            fetchData();
        } catch (error) {
            console.error('Failed to clone', error);
        }
    };

    const handleToggleFavorite = async (spool: Filament) => {
        const favorite = !spool.favorite;
        setFilaments(prev => prev.map(item => item.id === spool.id ? { ...item, favorite } : item));
        try {
            await api.update(spool.id, { favorite } as any);
        } catch (error) {
            console.error('Failed to update favorite', error);
            setFilaments(prev => prev.map(item => item.id === spool.id ? { ...item, favorite: spool.favorite } : item));
        }
    };

    const handleToggleGroupFavorite = async (items: Filament[]) => {
        const ids = items.map(item => item.id);
        const favorite = !items.every(item => item.favorite);
        setFilaments(prev => prev.map(item => ids.includes(item.id) ? { ...item, favorite } : item));
        try {
            await api.bulkUpdate(ids, { favorite });
        } catch (error) {
            console.error('Failed to update group favorite', error);
            fetchData(true);
        }
    };

    const handleAssociate = async (spool: Filament) => {
        if (!associateTagId) return;

        if (window.confirm(`Associate NFC Tag ${associateTagId} with ${getFilamentTitle(spool)}?`)) {
            try {
                // We use the update API to set the nfcTagId
                await api.update(spool.id, { nfcTagId: associateTagId } as any);
                // Clear the param and refresh
                setSearchParams({});
                navigate('/inventory', { replace: true }); // Clear url
                fetchData();
                alert('Spool associated successfully!');
            } catch (error) {
                console.error('Failed to associate', error);
                alert('Failed to associate tag');
            }
        }
    };

    // Clear association mode
    const cancelAssociation = () => {
        setSearchParams({});
        navigate('/inventory', { replace: true });
    };

    const handleUnlock = async (spool: Filament) => {
        const orgId = localStorage.getItem('organization_id');
        if (!orgId) return;
        try {
            await api.update(spool.id, { isLocked: false } as any);
            fetchData();
        } catch (error: any) {
            console.error('Failed to unlock', error);
            // Show alert if limit reached
            alert(error.response?.data?.message || 'Failed to unlock spool. You may have reached your active spool limit.');
        }
    };

    // Filtering & Grouping
    const [sortBy, setSortBy] = useState<'brand' | 'weight'>('brand');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [brandSorts, setBrandSorts] = useState<Record<string, { by: 'name' | 'weight', order: 'asc' | 'desc' }>>({});

    const handleBrandSortToggle = (brandName: string, by: 'name' | 'weight') => {
        setBrandSorts(prev => {
            const current = prev[brandName] || { by: 'name', order: 'asc' };
            if (current.by === by) {
                return { ...prev, [brandName]: { by, order: current.order === 'asc' ? 'desc' : 'asc' } };
            }
            return { ...prev, [brandName]: { by, order: by === 'weight' ? 'desc' : 'asc' } };
        });
    };

    // globalThreshold is no longer needed since it's handled in checkIsLowStock

    // Usage Stats
    const usageStats = organization?.stats;

    const aiTargetFilament = useMemo(() => {
        if (!aiItemId) return null;
        return filaments.find(f => String(f.id) === aiItemId || f.spoolReference === aiItemId) || null;
    }, [aiItemId, filaments]);

    useEffect(() => {
        if (aiOpen !== 'history' || !aiTargetFilament) return;
        setHistoryFilament(aiTargetFilament);
        const next = new URLSearchParams(searchParams);
        next.delete('aiOpen');
        setSearchParams(next, { replace: true });
    }, [aiOpen, aiTargetFilament, searchParams, setSearchParams]);



    const filteredFilaments = useMemo(() => {
        return filaments.filter(f => {
            const searchLower = filterState.search.toLowerCase();
            const name = `${getFilamentTitle(f)} ${f.color}`.toLowerCase();

            // Search Text
            const matchesSearch =
                String(f.id).includes(searchLower) ||
                name.includes(searchLower) ||
                f.brand?.name?.toLowerCase().includes(searchLower) ||
                f.material?.name?.toLowerCase().includes(searchLower) ||
                f.types?.some(t => t.name.toLowerCase().includes(searchLower)) ||
                f.vendor?.toLowerCase().includes(searchLower) ||
                f.spoolReference?.toLowerCase().includes(searchLower) ||
                getStorageLocationLabel(f)?.toLowerCase().includes(searchLower);

            // Brand Filter
            const matchesBrand = filterState.brandIds.length === 0 || filterState.brandIds.includes(f.brand?.id || -1);

            // Material Filter
            const matchesMaterial = filterState.materialIds.length === 0 || filterState.materialIds.includes(f.material?.id || -1);

            // Type Filter
            const matchesType = filterState.typeIds.length === 0 || f.types?.some(t => filterState.typeIds.includes(t.id));

            // Weight Filter
            // Allows 0/negative weight if showDepleted is true, otherwise standard minWeight check
            const matchesWeight = (showDepleted && f.weightRemaining <= 0) || f.weightRemaining >= filterState.minWeight;

            // Low Stock Filter
            const matchesLowStock = !filterState.lowStock || checkIsLowStock(f, organization);

            // Favorite Filter
            const matchesFavorite = !filterState.favoriteOnly || Boolean(f.favorite);

            // Hide Depleted Filter
            const matchesDepleted = showDepleted || f.weightRemaining > 0;

            return matchesSearch && matchesBrand && matchesMaterial && matchesType && matchesWeight && matchesLowStock && matchesFavorite && matchesDepleted;
        });
    }, [filaments, filterState, organization, showDepleted]);

    const handleExportProfile = (filament: Filament) => {
        try {
            const profile = generateOrcaProfile(filament);
            const jsonString = JSON.stringify(profile, null, 4);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            const safeProfileName = String((profile as any).name || 'Filament preset').replace(/[<>:"/\\|?*#]+/g, '').trim();
            link.download = `${safeProfileName || 'Filament preset'}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Failed to export profile', error);
            alert('Failed to generate export profile');
        }
    };

    const handlePrintLabel = (filament: Filament | Filament[]) => {
        if (Array.isArray(filament)) {
            setLabelFilaments(filament);
        } else {
            setLabelFilaments([filament]);
        }
        setIsLabelModalOpen(true);
    };

    const groupedByBrand = useMemo(() => {
        // 1. Group by Brand
        const brandGroups: Record<string, {
            brandName: string,
            brandId: number,
            logoUrl?: string,
            totalWeight: number,
            subGroups: Record<string, {
                subKey: string,
                type: string,
                displayName: string,
                color: string,
                colors: string[],
                totalWeight: number,
                items: Filament[],
                startedItems: Filament[],
                stockSummary: {
                    count: number,
                    weightPerSpool: number,
                    items: Filament[]
                }
            }>
        }> = {};

        filteredFilaments.forEach(f => {
            const brandId = f.brand?.id || -1;
            const brandName = f.brand?.name || 'Unknown';
            const brandObj = brands.find(b => b.id === brandId);
            const logoUrl = brandObj?.logoUrl;

            if (!brandGroups[brandName]) {
                brandGroups[brandName] = {
                    brandName,
                    brandId,
                    logoUrl,
                    totalWeight: 0,
                    subGroups: {}
                };
            }

            const materialName = f.material?.name || 'Unknown';
            const typeNames = f.types?.map(t => t.name).join(' ') || '';
            const typeName = typeNames ? ` ${typeNames}` : '';
            const fullType = `${materialName}${typeName}`;
            const title = getFilamentTitle(f); // This might need update if it uses old type property
            // Remove Brand Name from title for smoother display in subgroup (optional, or just use full title)
            // Let's use full title for logic, maybe strip brand for display if redundancy is an issue.
            // Actually, visually: Brand Header -> SubHeader. SubHeader could just be "PLA Matte".
            // Let's store full title and optionally strip brand in render.

            const color = f.color || '#000000';
            const colors = getSafeColors(f);
            const subKey = `${brandName}-${title}-${color}-${colors.join(',')}`;

            if (!brandGroups[brandName].subGroups[subKey]) {
                brandGroups[brandName].subGroups[subKey] = {
                    subKey,
                    type: fullType,
                    displayName: title.replace(brandName, '').trim() || fullType,
                    color: color,
                    colors: colors,
                    totalWeight: 0,
                    items: [],
                    startedItems: [],
                    stockSummary: {
                        count: 0,
                        weightPerSpool: 0,
                        items: [] as Filament[]
                    }
                };
            }

            const subGroup = brandGroups[brandName].subGroups[subKey];
            const isNew = f.weightRemaining >= f.weightInitial;

            if (isNew) {
                subGroup.stockSummary.count++;
                subGroup.stockSummary.weightPerSpool = f.weightInitial;
                subGroup.stockSummary.items.push(f);
            } else {
                subGroup.startedItems.push(f);
            }

            subGroup.items.push(f);
            subGroup.totalWeight += f.weightRemaining;
            brandGroups[brandName].totalWeight += f.weightRemaining;
        });

        // 2. Threshold Check: Move single full spools to individual list
        Object.values(brandGroups).forEach(bg => {
            Object.values(bg.subGroups).forEach(sg => {
                if (sg.stockSummary.count === 1) {
                    const spool = sg.stockSummary.items[0];
                    sg.startedItems.push(spool);
                    sg.stockSummary.count = 0;
                    sg.stockSummary.items = [];
                    // Keep items array intact for other logic
                }
            });
        });

        // 3. Convert to Array and Sort
        const sortedBrands = Object.values(brandGroups).map(bg => {
            const bSort = brandSorts[bg.brandName] || { by: 'name', order: 'asc' };
            const subFactor = bSort.order === 'asc' ? 1 : -1;
            return {
                ...bg,
                subGroups: Object.values(bg.subGroups).sort((a, b) => {
                    if (bSort.by === 'weight') {
                        return (a.totalWeight - b.totalWeight) * subFactor;
                    }
                    return a.displayName.localeCompare(b.displayName) * subFactor;
                })
            };
        }).sort((a, b) => {
            const factor = sortOrder === 'asc' ? 1 : -1;
            if (sortBy === 'weight') {
                return (a.totalWeight - b.totalWeight) * factor;
            }
            return a.brandName.localeCompare(b.brandName) * factor;
        });

        return sortedBrands;
    }, [filteredFilaments, brands, sortBy, sortOrder, brandSorts]);

    const gridItems = useMemo(() => {
        if (viewMode !== 'flat' && viewMode !== 'datagrid') return [];

        // Strategy: Group by Brand + Title + Color
        // If we want it EXACTLY like grouped view but flattened
        const items: any[] = [];
        groupedByBrand.forEach(bg => {
            bg.subGroups.forEach(sg => {
                const totalCount = sg.items.length;
                if (totalCount > 1) {
                    items.push({
                        isGroup: true,
                        ...sg,
                        brand: { name: bg.brandName, id: bg.brandId },
                        brandName: bg.brandName
                    });
                } else {
                    items.push({ ...sg.items[0], isGroup: false });
                }
            });
        });
        return items;
    }, [groupedByBrand, viewMode]);


    if (loading) return <Box p={3}><Typography>{t('common.loading')}</Typography></Box>;

    return (
        <Box>
            {/* Header */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
                {aiItemId && (
                    <Alert
                        severity="info"
                        action={
                            <Button
                                color="inherit"
                                size="small"
                                onClick={() => {
                                    const next = new URLSearchParams(searchParams);
                                    next.delete('aiItem');
                                    next.delete('aiOpen');
                                    next.delete('aiDate');
                                    setSearchParams(next);
                                }}
                            >
                                Effacer
                            </Button>
                        }
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                            <span>
                                Ouvert depuis les détails IA pour{' '}
                                <strong>{aiTargetFilament ? getFilamentTitle(aiTargetFilament) : `la bobine #${aiItemId}`}</strong>.
                                {aiDate && <> Anomalie detectee le <strong>{aiDate}</strong>.</>}
                            </span>
                            {aiTargetFilament && (
                                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                    <Button
                                        color="inherit"
                                        size="small"
                                        variant="outlined"
                                        onClick={() => setHistoryFilament(aiTargetFilament)}
                                    >
                                        Historique
                                    </Button>
                                    <Button
                                        color="inherit"
                                        size="small"
                                        variant="outlined"
                                        onClick={() => setEditingFilament(aiTargetFilament)}
                                    >
                                        Ouvrir la fiche
                                    </Button>
                                    <Button
                                        color="inherit"
                                        size="small"
                                        variant="outlined"
                                        onClick={() => setFilterState(prev => ({ ...prev, search: String(aiTargetFilament.id) }))}
                                    >
                                        Isoler dans la liste
                                    </Button>
                                </Box>
                            )}
                        </Box>
                    </Alert>
                )}

            <PageHeader 
                title={t('inventory.title')}
                icon={Package}
                actions={
                    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                        {selectionModel.length > 0 && (
                            <Box sx={{ display: 'flex', gap: 1 }}>
                                <Button
                                    variant="contained"
                                    color="primary"
                                    size="small"
                                    startIcon={<Printer size={16} />}
                                    onClick={() => {
                                        const selected = filaments.filter(f => selectionModel.includes(f.id));
                                        handlePrintLabel(selected);
                                    }}
                                >
                                    {t('common.print', 'Print')} ({selectionModel.length})
                                </Button>
                                <Button
                                    variant="contained"
                                    color="error"
                                    size="small"
                                    startIcon={bulkDeleteLoading ? <CircularProgress size={16} color="inherit" /> : <Trash2 size={16} />}
                                    onClick={handleBulkDelete}
                                    disabled={bulkDeleteLoading}
                                >
                                    {t('common.delete')} ({selectionModel.length})
                                </Button>
                            </Box>
                        )}
                        <Button
                            variant="contained"
                            startIcon={<Plus size={20} />}
                            onClick={() => { setEditingFilament(null); setIsAddModalOpen(true); }}
                            data-tour="inventory-add-btn"
                            disabled={usageStats && usageStats.limits.maxSpoolsPerOrg && usageStats.spoolsCount >= usageStats.limits.maxSpoolsPerOrg && !(user?.isSuperAdmin || ['super_admin', 'admin', 'moderator'].includes(user?.systemRole || ''))}
                        >
                            {t('inventory.addFilament')}
                        </Button>
                    </Box>
                }
            >
                {usageStats && (
                    <StatsBanner 
                        variant="compact"
                        stats={[
                            {
                                label: t('common.spoolsUsed', 'Bobines utilisées'),
                                value: usageStats.activeSpoolsCount ?? usageStats.spoolsCount,
                                total: (usageStats.limits.maxSpoolsPerOrg === 999999 || usageStats.limits.maxSpoolsPerOrg === Infinity || usageStats.limits.maxSpoolsPerOrg === null) ? '∞' : usageStats.limits.maxSpoolsPerOrg,
                                icon: Package,
                                color: '#1661af',
                                chips: [
                                    ...(usageStats.lockedSpoolsCount > 0 ? [{ label: t('common.bloquees', { count: usageStats.lockedSpoolsCount }), color: 'error' as any, icon: Lock }] : [])
                                ]
                            },
                            {
                                label: t('common.emptySpools', 'Bobines vides'),
                                value: usageStats.depletedSpoolsCount || 0,
                                icon: EyeOff,
                                color: theme.palette.warning.main,
                            }
                        ]}
                    />
                )}
            </PageHeader>

            {associateTagId && (
                <Alert
                    severity="info"
                    icon={<LinkIcon />}
                    action={
                        <Button color="inherit" size="small" onClick={cancelAssociation}>
                            {t('common.cancel')}
                        </Button>
                    }
                    sx={{ mb: 3, boxShadow: 1, borderRadius: 2 }}
                >
                    <strong>{t('common.associationMode')}</strong> <code>{associateTagId}</code>
                </Alert>
            )}


            </Box>

            {/* Filter Toolbar */}
            <Card sx={{ mb: 3 }}>
                <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
                    <Grid container spacing={2} alignItems="center">
                        <Grid size={{ xs: 12, md: 6 }}>
                            <Box display="flex" gap={1}>
                                <TextField
                                    inputRef={searchInputRef}
                                    fullWidth
                                    autoFocus
                                    placeholder={t('common.search')}
                                    value={filterState.search}
                                    onChange={(e) => setFilterState(prev => ({ ...prev, search: e.target.value }))}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <Search size={20} />
                                            </InputAdornment>
                                        ),
                                        endAdornment: filterState.search ? (
                                            <InputAdornment position="end">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => setFilterState(prev => ({ ...prev, search: '' }))}
                                                >
                                                    <X size={16} />
                                                </IconButton>
                                            </InputAdornment>
                                        ) : null
                                    }}
                                    size="small"
                                    data-tour="inventory-search"
                                />
                                <Button
                                    variant="outlined"
                                    startIcon={<Filter size={20} />}
                                    onClick={() => setIsFilterOpen(true)}
                                    color={
                                        (filterState.brandIds.length > 0 ||
                                            filterState.typeIds.length > 0 ||
                                            filterState.lowStock ||
                                            filterState.favoriteOnly ||
                                            filterState.minWeight > 0) ? "primary" : "inherit" // Highlight if filters active
                                    }
                                    data-tour="inventory-filters"
                                >
                                    Filters
                                </Button>


                            </Box>
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                            {/* Sorting */}
                            <Select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as any)}
                                size="small"
                                sx={{ minWidth: 120 }}
                            >
                                <MenuItem value="brand">{t('inventory.brand')}</MenuItem>
                                <MenuItem value="weight">{t('inventory.totalWeight')}</MenuItem>
                            </Select>
                            <IconButton onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}>
                                {sortOrder === 'asc' ? (
                                    <Box component="span"><ArrowDown size={20} /></Box>
                                ) : (
                                    <Box component="span"><ArrowUp size={20} /></Box>
                                )}
                            </IconButton>

                            <Box sx={{ display: 'flex', gap: 1 }} data-tour="inventory-view-options">
                                <Box sx={{ display: 'flex', gap: 0.75, bgcolor: 'background.default', borderRadius: 2, p: 0.75, border: '1px solid', borderColor: 'divider' }}>
                                    <IconButton
                                        size="small"
                                        onClick={() => setShowDepleted(!showDepleted)}
                                        title={showDepleted ? t('inventory.hideDepleted') : t('inventory.showDepleted')}
                                        sx={viewButtonSx(showDepleted)}
                                    >
                                        {showDepleted ? <EyeOff size={20} strokeWidth={2.4} /> : <Eye size={20} strokeWidth={2.4} />}
                                    </IconButton>
                                    <IconButton
                                        size="small"
                                        onClick={() => {
                                            if (isSelectionMode) {
                                                setSelectionModel([]);
                                            }
                                            setIsSelectionMode(!isSelectionMode);
                                        }}
                                        title={isSelectionMode ? "Disable Selection" : "Enable Selection"}
                                        sx={viewButtonSx(isSelectionMode)}
                                    >
                                        <CheckSquare size={20} strokeWidth={2.4} />
                                    </IconButton>
                                </Box>
                                <Box sx={{ display: 'flex', gap: 0.75, bgcolor: 'background.default', borderRadius: 2, p: 0.75, border: '1px solid', borderColor: 'divider' }}>
                                    <Tooltip title={t('inventory.groupView')}>
                                        <IconButton size="small" onClick={() => setViewMode('grouped')} sx={viewButtonSx(viewMode === 'grouped')}>
                                            <ListIcon size={20} strokeWidth={2.4} />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title={t('inventory.storage.title', 'Storage')}>
                                        <IconButton size="small" onClick={() => setViewMode('storage')} sx={viewButtonSx(viewMode === 'storage')}>
                                            <Archive size={20} strokeWidth={2.4} />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Grid">
                                        <IconButton size="small" onClick={() => setViewMode('flat')} sx={viewButtonSx(viewMode === 'flat')}>
                                            <LayoutGrid size={20} strokeWidth={2.4} />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Table">
                                        <IconButton size="small" onClick={() => setViewMode('datagrid')} sx={viewButtonSx(viewMode === 'datagrid')}>
                                            <TableIcon size={20} strokeWidth={2.4} />
                                        </IconButton>
                                    </Tooltip>
                                </Box>
                            </Box>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>

            {/* Content View */}
            {viewMode === 'grouped' && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {groupedByBrand.map(brandGroup => (
                        <Box key={brandGroup.brandName}>
                            {/* Brand Header */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, pb: 1, borderBottom: '2px solid', borderColor: 'primary.main' }}>
                                {brandGroup.logoUrl ? (
                                    <Box component="img" src={brandGroup.logoUrl} sx={{ height: 40, width: 'auto', objectFit: 'contain' }} />
                                ) : (
                                    <Typography variant="h3" color="primary.main">{brandGroup.brandName}</Typography>
                                )}
                                {brandGroup.logoUrl && <Typography variant="h3" color="primary.main">{brandGroup.brandName}</Typography>}

                                <Box sx={{ display: 'flex', alignItems: 'center', ml: 'auto', gap: 1 }}>
                                    <IconButton
                                        size="small"
                                        onClick={() => handleBrandSortToggle(brandGroup.brandName, 'name')}
                                        color={(brandSorts[brandGroup.brandName]?.by || 'name') === 'name' ? 'primary' : 'default'}
                                        title={t('common.name', 'Nom')}
                                        sx={{ borderRadius: 1 }}
                                    >
                                        <Typography variant="caption" sx={{ fontWeight: 'bold' }}>A-Z</Typography>
                                        {(brandSorts[brandGroup.brandName]?.by || 'name') === 'name' && (
                                            (brandSorts[brandGroup.brandName]?.order || 'asc') === 'asc' ? <ArrowDown size={14} style={{ marginLeft: 2 }} /> : <ArrowUp size={14} style={{ marginLeft: 2 }} />
                                        )}
                                    </IconButton>
                                    <IconButton
                                        size="small"
                                        onClick={() => handleBrandSortToggle(brandGroup.brandName, 'weight')}
                                        color={brandSorts[brandGroup.brandName]?.by === 'weight' ? 'primary' : 'default'}
                                        title={t('inventory.totalWeight', 'Poids')}
                                        sx={{ borderRadius: 1 }}
                                    >
                                        <Scale size={16} />
                                        {brandSorts[brandGroup.brandName]?.by === 'weight' && (
                                            brandSorts[brandGroup.brandName]!.order === 'asc' ? <ArrowDown size={14} style={{ marginLeft: 2 }} /> : <ArrowUp size={14} style={{ marginLeft: 2 }} />
                                        )}
                                    </IconButton>
                                    <Chip label={`${(brandGroup.totalWeight / 1000).toFixed(2)} kg`} color="primary" variant="outlined" sx={{ ml: 1 }} />
                                </Box>
                            </Box>

                            {/* Sub Groups (Type + Color) */}
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {brandGroup.subGroups.map(subGroup => (
                                    <Card key={`${subGroup.type}-${subGroup.color}`}>
                                        <Box sx={{
                                            bgcolor: 'background.paper',
                                            px: 3, py: 1.5,
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            borderBottom: '1px solid', borderColor: 'divider'
                                        }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                <Tooltip title={subGroup.items.every(item => item.favorite) ? t('inventory.removeGroupFavorite', 'Retirer le groupe des favoris') : t('inventory.addGroupFavorite', 'Ajouter le groupe aux favoris')}>
                                                    <IconButton
                                                        size="small"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleToggleGroupFavorite(subGroup.items);
                                                        }}
                                                        sx={{ color: subGroup.items.every(item => item.favorite) ? '#f5b301' : 'text.disabled' }}
                                                    >
                                                        <Star size={18} fill={subGroup.items.every(item => item.favorite) ? 'currentColor' : 'none'} />
                                                    </IconButton>
                                                </Tooltip>
                                                <ColorIndicator colors={getSafeColors(subGroup)} size={24} />
                                                <Typography variant="h4">{subGroup.displayName}</Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                {subGroup.items.length > 1 && (
                                                    <Box sx={{ display: 'flex', gap: 1 }}>
                                                        <IconButton
                                                            size="small"
                                                            color="primary"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setConsumptionGroup(subGroup);
                                                            }}
                                                            sx={{ border: '1px solid', borderColor: 'primary.light', borderRadius: 2, px: 1 }}
                                                            title={t('inventory.consumeGroup')}
                                                        >
                                                            <PencilRuler size={16} />
                                                        </IconButton>
                                                        <IconButton
                                                            size="small"
                                                            color="secondary"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setBulkEditGroup(subGroup);
                                                            }}
                                                            sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, px: 1 }}
                                                            title={t('common.editGroup', 'Modifier le groupe')}
                                                        >
                                                            <Edit2 size={16} />
                                                        </IconButton>
                                                        <IconButton
                                                            size="small"
                                                            color="error"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const ids = subGroup.items.map(i => i.id);
                                                                const brandName = subGroup.items[0]?.brand?.name || 'Unknown';
                                                                const title = getFilamentTitle(subGroup.items[0]);
                                                                if (window.confirm(t('inventory.confirmDeleteGroup', { count: ids.length, name: `${brandName} ${title}` }) || `Delete all ${ids.length} spools in this group?`)) {
                                                                    setBulkDeleteLoading(true);
                                                                    Promise.all(ids.map(id => api.delete(id)))
                                                                        .then(() => {
                                                                            fetchData();
                                                                        })
                                                                        .catch(err => {
                                                                            console.error('Failed to delete group', err);
                                                                            alert('Some items could not be deleted');
                                                                        })
                                                                        .finally(() => setBulkDeleteLoading(false));
                                                                }
                                                            }}
                                                            title={t('common.deleteGroup', 'Supprimer le groupe')}
                                                        >
                                                            <Trash2 size={16} />
                                                        </IconButton>
                                                    </Box>
                                                )}
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Typography variant="subtitle2" color="textSecondary" fontWeight="500">
                                                        {t('common.spools', { count: subGroup.items.length })}
                                                    </Typography>
                                                    <Typography variant="subtitle2" color="textSecondary" sx={{ opacity: 0.5 }}>•</Typography>
                                                    <Typography variant="subtitle2" color="textSecondary" fontWeight="bold">
                                                        {(subGroup.totalWeight / 1000).toFixed(2)} kg
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        </Box>
                                        <TableContainer>
                                            <Table size="small">
                                                <TableBody>
                                                    {/* Started / Used Spools */}
                                                    {subGroup.startedItems.map(f => (
                                                        <InventoryRow
                                                            key={f.id}
                                                            f={f}
                                                            isSelectionMode={isSelectionMode}
                                                            selectionModel={selectionModel}
                                                            setSelectionModel={setSelectionModel}
                                                            associateTagId={associateTagId}
                                                            handleAssociate={handleAssociate}
                                                            handleEdit={(f) => setEditingFilament(f)}
                                                            handleDelete={handleDelete}
                                                            handleClone={handleClone}
                                                            handleUnlock={handleUnlock}
                                                            handleConsumption={(f) => setConsumptionFilament(f)}
                                                            handleMarkAsEmpty={handleMarkAsEmpty}
                                                            handleHistory={(f) => setHistoryFilament(f)}
                                                            handlePrintLabel={(f) => handlePrintLabel(f)}
                                                            handleExportProfile={(f) => handleExportProfile(f)}
                                                            handleToggleFavorite={handleToggleFavorite}
                                                            organization={organization}
                                                        />
                                                    ))}

                                                    {/* New Spools Summary */}
                                                    {subGroup.stockSummary.count > 0 && (
                                                        <>
                                                            <TableRow
                                                                sx={{
                                                                    bgcolor: 'rgba(99, 102, 241, 0.04)',
                                                                    cursor: 'pointer',
                                                                    transition: 'all 0.2s',
                                                                    '&:hover': { bgcolor: 'rgba(99, 102, 241, 0.08)' },
                                                                    borderLeft: '4px solid',
                                                                    borderColor: 'primary.main'
                                                                }}
                                                                onClick={() => toggleGroupExpand(subGroup.subKey)}
                                                            >
                                                                <TableCell sx={{ pl: isSelectionMode ? 2 : 1, py: 1.5 }} colSpan={isSelectionMode ? 4 : 3}>
                                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                                        <Box sx={{
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            width: 24, height: 24,
                                                                            borderRadius: 1,
                                                                            bgcolor: 'primary.main',
                                                                            color: 'white',
                                                                            ml: isSelectionMode ? 1 : 2
                                                                        }}>
                                                                            {expandedGroups[subGroup.subKey] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                                        </Box>

                                                                        <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 200 }}>
                                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                                <Typography variant="body2" fontWeight="700" sx={{ color: 'primary.main', whiteSpace: 'nowrap' }}>
                                                                                    {t('inventory.newSpools', { count: subGroup.stockSummary.count })} ({subGroup.stockSummary.weightPerSpool}g)
                                                                                </Typography>
                                                                                {/* Recent Update Indicator - Reactivate later
                                                                                {subGroup.stockSummary.items.some(f => f.updatedAt && (new Date().getTime() - new Date(f.updatedAt).getTime() < 48 * 60 * 60 * 1000)) && (
                                                                                    <Tooltip title={t('common.updatedRecently')}>
                                                                                        <Box sx={{ 
                                                                                            width: 6, 
                                                                                            height: 6, 
                                                                                            borderRadius: '50%', 
                                                                                            bgcolor: 'info.main',
                                                                                            animation: 'pulse 2s infinite ease-in-out',
                                                                                            '@keyframes pulse': {
                                                                                                '0%': { opacity: 0.4, transform: 'scale(0.8)' },
                                                                                                '50%': { opacity: 1, transform: 'scale(1.2)' },
                                                                                                '100%': { opacity: 0.4, transform: 'scale(0.8)' }
                                                                                            }
                                                                                        }} />
                                                                                    </Tooltip>
                                                                                )} */}
                                                                            </Box>
                                                                        </Box>

                                                                        <Box sx={{ flexGrow: 1, maxWidth: 300, ml: 4 }}>
                                                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.5 }}>
                                                                                <Typography variant="caption" fontWeight="bold">
                                                                                    {(subGroup.stockSummary.count * subGroup.stockSummary.weightPerSpool / 1000).toFixed(2)} kg
                                                                                </Typography>
                                                                                <Typography variant="caption" color="textSecondary">100%</Typography>
                                                                            </Box>
                                                                            <LinearProgress
                                                                                variant="determinate"
                                                                                value={100}
                                                                                sx={{ width: '100%', height: 6, borderRadius: 3 }}
                                                                                color="primary"
                                                                            />
                                                                        </Box>
                                                                    </Box>
                                                                </TableCell>
                                                                <TableCell align="right">
                                                                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                                                                        <IconButton
                                                                            size="small"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleToggleGroupFavorite(subGroup.stockSummary.items);
                                                                            }}
                                                                            sx={{
                                                                                border: '1px solid',
                                                                                borderColor: 'divider',
                                                                                borderRadius: 2,
                                                                                px: 1,
                                                                                color: subGroup.stockSummary.items.every((item: Filament) => item.favorite) ? '#f5b301' : 'text.disabled',
                                                                            }}
                                                                            title={subGroup.stockSummary.items.every((item: Filament) => item.favorite) ? t('inventory.removeGroupFavorite', 'Retirer le groupe des favoris') : t('inventory.addGroupFavorite', 'Ajouter le groupe aux favoris')}
                                                                        >
                                                                            <Star size={16} fill={subGroup.stockSummary.items.every((item: Filament) => item.favorite) ? 'currentColor' : 'none'} />
                                                                        </IconButton>
                                                                        <IconButton
                                                                            size="small"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handlePrintLabel(subGroup.stockSummary.items);
                                                                            }}
                                                                            color="primary"
                                                                            title={t('common.printAllLabels', 'Imprimer toutes les étiquettes')}
                                                                            sx={{ border: '1px solid', borderColor: 'primary.light', borderRadius: 2, px: 1 }}
                                                                        >
                                                                            <Printer size={16} />
                                                                        </IconButton>
                                                                        <IconButton
                                                                            size="small"
                                                                            color="error"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                const ids = subGroup.stockSummary.items.map((f: any) => f.id);
                                                                                if (window.confirm(t('inventory.confirmDeleteGroup', { count: ids.length, name: t('inventory.newSpools', { count: ids.length }) }) || `Delete all ${ids.length} spools in this group?`)) {
                                                                                    setBulkDeleteLoading(true);
                                                                                    Promise.all(ids.map((id: number) => api.delete(id)))
                                                                                        .then(() => fetchData())
                                                                                        .catch(() => alert('Failed to delete group'))
                                                                                        .finally(() => setBulkDeleteLoading(false));
                                                                                }
                                                                            }}
                                                                            title={t('common.delete')}
                                                                             
                                                                         >
                                                                            <Trash2 size={16} />
                                                                        </IconButton>
                                                                    </Box>
                                                                </TableCell>
                                                            </TableRow>

                                                            {/* Expanded New Spools */}
                                                            {expandedGroups[subGroup.subKey] && subGroup.stockSummary.items.map(f => (
                                                                <InventoryRow
                                                                    key={f.id}
                                                                    f={f}
                                                                    isSelectionMode={isSelectionMode}
                                                                    selectionModel={selectionModel}
                                                                    setSelectionModel={setSelectionModel}
                                                                    associateTagId={associateTagId}
                                                                    handleAssociate={handleAssociate}
                                                                    handleEdit={(f) => setEditingFilament(f)}
                                                                    handleDelete={handleDelete}
                                                                    handleClone={handleClone}
                                                                    handleUnlock={handleUnlock}
                                                                    handleConsumption={(f) => setConsumptionFilament(f)}
                                                                    handleMarkAsEmpty={handleMarkAsEmpty}
                                                                    handleHistory={(f) => setHistoryFilament(f)}
                                                                    handlePrintLabel={(f) => handlePrintLabel(f)}
                                                                    handleExportProfile={(f) => handleExportProfile(f)}
                                                                    handleToggleFavorite={handleToggleFavorite}
                                                                    organization={organization}
                                                                    isChild={true}
                                                                />
                                                            ))}
                                                        </>
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </TableContainer>
                                    </Card>
                                ))}
                            </Box>
                        </Box>
                    ))}
                    {groupedByBrand.length === 0 && (
                        <Typography textAlign="center" color="textSecondary">{t('inventory.noFilamentFound')}</Typography>
                    )}
                </Box>
            )}
            {viewMode === 'flat' && (
                <Grid container spacing={3}>
                    {gridItems.map((item: any) => {
                        if (item.isGroup) {
                            return (
                                <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={`group-${item.subKey}`}>
                                    <Card sx={{ border: '2px solid', borderColor: 'primary.main', height: '100%', display: 'flex', flexDirection: 'column' }}>
                                        <CardContent sx={{ flexGrow: 1 }}>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                                                <ColorIndicator colors={item.colors} size={40} />
                                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                                                    <Chip label={`${item.items.length} ${t('inventory.spools')}`} color="primary" size="small" />
                                                    {item.stockSummary.count > 0 && (
                                                        <Chip label={`${item.stockSummary.count} full`} color="success" size="small" variant="outlined" />
                                                    )}
                                                </Box>
                                            </Box>
                                            <Typography variant="h4" noWrap title={item.displayName}>{item.displayName}</Typography>
                                            <Typography variant="body2" color="textSecondary" gutterBottom>{item.brandName}</Typography>

                                            <Box sx={{ my: 2 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1 }}>
                                                    <Typography variant="h3">{(item.totalWeight / 1000).toFixed(2)}kg</Typography>
                                                    <Typography variant="caption" color="textSecondary">total</Typography>
                                                </Box>
                                                <LinearProgress
                                                    variant="determinate"
                                                    value={100}
                                                    sx={{ height: 6, borderRadius: 3 }}
                                                />
                                            </Box>

                                            <Box sx={{ display: 'flex', gap: 1, mt: 'auto', pt: 2 }}>
                                                <IconButton
                                                    size="small"
                                                    color="primary"
                                                    onClick={() => setConsumptionGroup(item)}
                                                    sx={{ border: '1px solid', borderColor: 'primary.light', borderRadius: 2, px: 1 }}
                                                    title={t('inventory.consumeGroup')}
                                                >
                                                    <PencilRuler size={16} />
                                                </IconButton>
                                                <IconButton
                                                    size="small"
                                                    color="secondary"
                                                    onClick={() => setBulkEditGroup(item)}
                                                    sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, px: 1 }}
                                                    title={t('common.editGroup', 'Modifier le groupe')}
                                                >
                                                    <Edit2 size={16} />
                                                </IconButton>
                                                <IconButton
                                                    size="small"
                                                    color="error"
                                                    onClick={() => {
                                                        const ids = item.items.map((i: any) => i.id);
                                                        if (window.confirm(t('inventory.confirmDeleteGroup', { count: ids.length, name: `${item.brandName} ${item.displayName}` }) || `Delete all ${ids.length} spools in this group?`)) {
                                                            setBulkDeleteLoading(true);
                                                            Promise.all(ids.map((id: number) => api.delete(id)))
                                                                .then(() => fetchData())
                                                                .catch(() => alert('Failed to delete group'))
                                                                .finally(() => setBulkDeleteLoading(false));
                                                        }
                                                    }}
                                                    
                                                    title={t('common.deleteGroup', 'Supprimer le groupe')}
                                                >
                                                    <Trash2 size={16} />
                                                </IconButton>
                                            </Box>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            );
                        }

                        const f = item;
                        return (
                            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={f.id}>
                                <Card>
                                    <CardContent>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                                            <ColorIndicator colors={getSafeColors(f)} size={40} />
                                            <Box>
                                                {f.types?.map((t: any) => (
                                                    <Chip key={t.id} label={t.name} size="small" sx={{ ml: 0.5 }} />
                                                ))}
                                                {f.isLocked && (
                                                    <Chip icon={<Lock size={12} />} label="Locked" size="small" color="error" sx={{ ml: 0.5 }} />
                                                )}
                                            </Box>
                                        </Box>
                                        <Typography variant="h4" noWrap title={getFilamentTitle(f)}>{getFilamentTitle(f)}</Typography>
                                        <Typography variant="body2" color="textSecondary" gutterBottom>{f.brand?.name}</Typography>

                                        <Box sx={{ my: 2 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1 }}>
                                                <Typography variant="h3">{f.weightRemaining}g</Typography>
                                                <Typography variant="caption" color="textSecondary">/ {f.weightInitial}g</Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                <Box sx={{
                                                    flexGrow: 1,
                                                    height: 6,
                                                    borderRadius: 3,
                                                    bgcolor: 'rgba(0,0,0,0.05)',
                                                    position: 'relative',
                                                    overflow: 'hidden',
                                                    border: '1px solid rgba(0,0,0,0.05)'
                                                }}>
                                                    <Box sx={{
                                                        position: 'absolute',
                                                        left: 0,
                                                        top: 0,
                                                        height: '100%',
                                                        width: `${Math.min(100, (f.weightRemaining / (f.weightInitial || 1000)) * 100)}%`,
                                                        bgcolor: checkIsLowStock(f, organization) ? 'error.main' : 'primary.main',
                                                        transition: 'width 0.3s ease'
                                                    }} />
                                                    {f.plannedWeight !== undefined && f.plannedWeight > 0 && (
                                                        <Box sx={{
                                                            position: 'absolute',
                                                            left: `${Math.max(0, Math.min(100, ((f.virtualWeightRemaining || 0) / (f.weightInitial || 1000)) * 100))}%`,
                                                            top: 0,
                                                            height: '100%',
                                                            width: `${Math.min(100, ((f.plannedWeight || 0) / (f.weightInitial || 1000)) * 100)}%`,
                                                            bgcolor: 'rgba(255,255,255,0.4)',
                                                            backgroundImage: 'linear-gradient(45deg, rgba(0,0,0,0.1) 25%, transparent 25%, transparent 50%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.1) 75%, transparent 75%, transparent)',
                                                            backgroundSize: '8px 8px',
                                                            transition: 'all 0.3s ease'
                                                        }} />
                                                    )}
                                                </Box>
                                                <Typography variant="caption" color={checkIsLowStock(f, organization) ? 'error.main' : 'textSecondary'} sx={{ fontWeight: 'bold', fontSize: '11px', minWidth: '28px', textAlign: 'right' }}>
                                                    {Math.round(Math.min(100, Math.max(0, (f.weightRemaining / f.weightInitial) * 100)) || 0)}%
                                                </Typography>
                                            </Box>
                                            {f.plannedWeight !== undefined && f.plannedWeight > 0 && (
                                                <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.65rem', mt: 0.5, display: 'block' }}>
                                                    {Math.round(f.virtualWeightRemaining || 0)}g disponible après planifs
                                                </Typography>
                                            )}
                                        </Box>

                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
                                            {(hasPositiveValue(f.nozzleTempMin) || hasPositiveValue(f.nozzleTempMax)) && (
                                                <Tooltip title={t('inventory.nozzle')}>
                                                    <Chip label={temperatureRangeLabel('N', f.nozzleTempMin, f.nozzleTempMax)} size="small" variant="outlined" sx={{ fontSize: '0.7rem', ...technicalChipSx }} />
                                                </Tooltip>
                                            )}
                                            {(hasPositiveValue(f.bedTempMin) || hasPositiveValue(f.bedTempMax) || hasPositiveValue((f as any).bedTemp)) && (
                                                <Tooltip title={t('inventory.bed')}>
                                                    <Chip label={temperatureRangeLabel('B', f.bedTempMin, f.bedTempMax, (f as any).bedTemp)} size="small" variant="outlined" sx={{ fontSize: '0.7rem', ...technicalChipSx }} />
                                                </Tooltip>
                                            )}
                                            {(hasPositiveValue(f.chamberTempMin) || hasPositiveValue(f.chamberTempMax)) && (
                                                <Tooltip title={t('inventory.filamentModal.chamber')}>
                                                    <Chip label={temperatureRangeLabel('C', f.chamberTempMin, f.chamberTempMax)} size="small" variant="outlined" sx={{ fontSize: '0.7rem', ...technicalChipSx }} />
                                                </Tooltip>
                                            )}
                                            {(hasPositiveValue(f.dryTemp) || hasPositiveValue(f.dryTime)) && (
                                                <Tooltip title={t('inventory.filamentModal.drying')}>
                                                    <Chip label={`Dry: ${f.dryTemp || '?'}°C${hasPositiveValue(f.dryTime) ? ` / ${f.dryTime}h` : ''}`} size="small" variant="outlined" sx={{ fontSize: '0.7rem', ...technicalChipSx }} />
                                                </Tooltip>
                                            )}
                                            {hasPositivePrice(f.price) && <Chip label={`${f.price}€`} size="small" color="success" variant="outlined" sx={{ fontSize: '0.7rem' }} />}
                                            {f.vendor && <Chip label={f.vendor} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />}
                                            {getStorageLocationLabel(f) && <Chip label={`${t('inventory.storage.title')}: ${getStorageLocationLabel(f)}`} size="small" color="primary" variant="outlined" sx={{ fontSize: '0.7rem' }} />}
                                        </Box>

                                        <Divider sx={{ my: 2 }} />

                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                                            {isSelectionMode && (
                                                <Checkbox
                                                    checked={selectionModel.includes(f.id)}
                                                    onChange={(e) => {
                                                        const id = f.id;
                                                        if (e.target.checked) {
                                                            setSelectionModel((prev: any[]) => [...prev, id]);
                                                        } else {
                                                            setSelectionModel((prev: any[]) => prev.filter(item => item !== id));
                                                        }
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            )}
                                            <Box sx={{ display: 'flex', gap: 0.5, ml: 'auto', justifyContent: 'flex-end', alignItems: 'center' }}>
                                                {associateTagId ? (
                                                    <Button
                                                        variant="contained"
                                                        size="small"
                                                        startIcon={<LinkIcon size={16} />}
                                                        onClick={() => handleAssociate(f)}
                                                        fullWidth
                                                    >
                                                        Link Spool
                                                    </Button>
                                                ) : (
                                                    <>
                                                        <Tooltip title={f.favorite ? t('inventory.removeFavorite', 'Retirer des favoris') : t('inventory.addFavorite', 'Ajouter aux favoris')}>
                                                            <IconButton size="small" onClick={() => handleToggleFavorite(f)} sx={{ ...secondaryActionSx, color: f.favorite ? '#f5b301' : 'text.secondary' }}>
                                                                <Star size={20} fill={f.favorite ? 'currentColor' : 'none'} />
                                                            </IconButton>
                                                        </Tooltip>
                                                        <Tooltip title={f.isLocked ? t('common.lockedQuota') : t('inventory.logConsumption')}>
                                                            <span><IconButton size="small" onClick={() => setConsumptionFilament(f)} disabled={f.isLocked} sx={secondaryActionSx}><PencilRuler size={18} /></IconButton></span>
                                                        </Tooltip>
                                                        <Tooltip title={t('inventory.markAsEmpty', 'Marquer comme vide')}>
                                                            <span><IconButton size="small" onClick={() => handleMarkAsEmpty(f)} disabled={f.isLocked || f.weightRemaining <= 0} sx={secondaryActionSx}><Archive size={18} /></IconButton></span>
                                                        </Tooltip>
                                                        <Tooltip title={t('common.exportProfile', 'Exporter le profil')}>
                                                            <IconButton size="small" onClick={() => handleExportProfile(f)} sx={secondaryActionSx}><FileJson size={18} /></IconButton>
                                                        </Tooltip>
                                                        <Tooltip title={t('common.printLabel', 'Imprimer l’étiquette')}>
                                                            <IconButton size="small" onClick={() => handlePrintLabel(f)} sx={secondaryActionSx}><Printer size={18} /></IconButton>
                                                        </Tooltip>
                                                        {f.isLocked && (
                                                            <Tooltip title={t('common.unlock', 'Déverrouiller')}>
                                                                <IconButton size="small" onClick={() => handleUnlock(f)} color="warning" sx={secondaryActionSx}>
                                                                    <Lock size={18} />
                                                                </IconButton>
                                                            </Tooltip>
                                                        )}
                                                        <Tooltip title={f.isLocked ? t('common.lockedQuota') : t('common.edit')}>
                                                            <span><IconButton size="small" onClick={() => setEditingFilament(f)} disabled={f.isLocked} color="primary" sx={primaryActionSx}><Edit2 size={21} /></IconButton></span>
                                                        </Tooltip>
                                                        <Tooltip title={t('common.history')}>
                                                            <IconButton size="small" onClick={() => setHistoryFilament(f)} color="info" sx={primaryActionSx}><Eye size={21} /></IconButton>
                                                        </Tooltip>
                                                        <Tooltip title={t('common.delete')}>
                                                            <IconButton size="small" color="error" onClick={() => handleDelete(f.id)} sx={{ ...primaryActionSx, bgcolor: 'rgba(211, 47, 47, 0.08)' }}><Trash2 size={21} /></IconButton>
                                                        </Tooltip>
                                                    </>
                                                )}
                                            </Box>
                                        </Box>
                                    </CardContent>
                                </Card>
                            </Grid>
                        );
                    })}
                </Grid>
            )}

            {viewMode === 'datagrid' && (
                <InventoryDataGrid
                    filaments={filteredFilaments}
                    onEdit={setEditingFilament}
                    onDelete={handleDelete}
                    onLogConsumption={setConsumptionFilament}
                    onClone={handleClone}
                    organization={organization}
                    selectionModel={selectionModel}
                    onSelectionChange={setSelectionModel}
                    isSelectionMode={isSelectionMode}
                    onPrintLabel={handlePrintLabel}
                    onExportProfile={handleExportProfile}
                    onToggleFavorite={handleToggleFavorite}
                    onToggleGroupFavorite={handleToggleGroupFavorite}
                />
            )}

            {viewMode === 'storage' && (
                <StorageRackView
                    filaments={filteredFilaments}
                    organizationId={organization?.id}
                    onEdit={setEditingFilament}
                    onLogConsumption={setConsumptionFilament}
                    onRefresh={() => fetchData(true)}
                />
            )}

            {/* Modals */}
            {
                isAddModalOpen && (
                    <AddFilamentModal
                        isOpen={isAddModalOpen}
                        onClose={() => setIsAddModalOpen(false)}
                        onSuccess={fetchData}
                        brands={brands}
                        materials={materials}
                        types={types}
                        options={options}
                        brandCatalog={brandCatalog}
                        initialData={addModalParams}
                    />
                )
            }

            {
                editingFilament && (
                    <AddFilamentModal
                        isOpen={!!editingFilament}
                        onClose={() => setEditingFilament(null)}
                        onSuccess={fetchData}
                        brands={brands}
                        materials={materials}
                        types={types}
                        options={options}
                        initialData={editingFilament}
                        isEditing
                        brandCatalog={brandCatalog}
                    />
                )
            }

            {
                consumptionFilament && (
                    <ConsumptionModal
                        isOpen={!!consumptionFilament}
                        onClose={() => setConsumptionFilament(null)}
                        onSuccess={fetchData}
                        filament={consumptionFilament}
                        filamentId={consumptionFilament.id}
                        filamentColor={consumptionFilament.color}
                        brandName={consumptionFilament.brand?.name}
                        typeName={consumptionFilament.types?.map(t => t.name).join(', ')}
                        weightRemaining={consumptionFilament.weightRemaining}
                        onUpdate={fetchData}
                    />
                )
            }

            {
                consumptionGroup && (
                    <ConsumptionModal
                        isOpen={!!consumptionGroup}
                        onClose={() => setConsumptionGroup(null)}
                        onSuccess={fetchData}
                        group={consumptionGroup}
                        onUpdate={fetchData}
                    />
                )
            }

            {
                historyFilament && (
                    <HistoryModal
                        isOpen={!!historyFilament}
                        onClose={() => setHistoryFilament(null)}
                        filamentId={historyFilament.id}
                        aiHighlightDate={aiItemId && String(historyFilament.id) === aiItemId ? aiDate : null}
                    />
                )
            }

            {
                bulkEditGroup && (
                    <BulkEditModal
                        isOpen={!!bulkEditGroup}
                        onClose={() => setBulkEditGroup(null)}
                        onSuccess={fetchData}
                        group={bulkEditGroup}
                    />
                )
            }

            <InventoryFilters
                open={isFilterOpen}
                onClose={() => setIsFilterOpen(false)}
                brands={brands}
                materials={materials}
                types={types}
                filters={filterState}
                onFilterChange={setFilterState}
                onReset={() => setFilterState({
                    search: '',
                    brandIds: [],
                    materialIds: [],
                    typeIds: [],
                    minWeight: 0,
                    lowStock: false,
                    favoriteOnly: false,
                })}
            />

            <LabelGenerator
                open={isLabelModalOpen}
                onClose={() => { setIsLabelModalOpen(false); setLabelFilaments([]); }}
                filaments={labelFilaments}
            />
        </Box >
    );
}
