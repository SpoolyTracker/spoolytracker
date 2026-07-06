import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    Button,
    TextField,
    Box,
    Typography,
    Tabs,
    Tab,
    List,
    ListItem,
    ListItemText,
    Chip,
    CircularProgress,
    IconButton,
    Alert,
    InputAdornment,
    Autocomplete,
    createFilterOptions,
    FormControlLabel,
    Switch
} from '@mui/material';
import { X, History, Plus, AlertCircle, Copy, Edit2, Trash2 } from 'lucide-react';
import { api } from '../api';
import type { ConsumptionLog, Filament } from '../api';

import GCodeAnalysisDialog from './GCodeAnalysisDialog';
import ColorIndicator from './ColorIndicator';
import { getFilamentTitle } from '../utils/filament-utils';
import { normalizeNumericInput } from '../utils/number-utils';

const getLocalDatetime = (d: Date = new Date()) => {
    const pad = (n: number) => n < 10 ? '0' + n : n;
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

interface ConsumptionModalProps {
    isOpen?: boolean;
    filamentId?: number;
    filamentColor?: string;
    filamentColors?: string[];
    brandName?: string;
    typeName?: string;
    weightRemaining?: number;
    unit?: string;
    onClose: () => void;
    onUpdate?: () => void;
    onSuccess?: () => void;
    filament?: any;
    group?: any;
    initialTab?: 'log' | 'history';
    editLog?: ConsumptionLog; // Prop to initialize edit mode
    aiHighlightDate?: string | null;
}

export default function ConsumptionModal({
    isOpen = true,
    filamentId: propFilamentId,
    filamentColor: propColor,
    filamentColors: propColors = [],
    brandName: propBrand,
    typeName: propType,
    weightRemaining: propWeight,
    unit = 'g',
    onClose,
    onUpdate,
    onSuccess,
    initialTab = 'log',
    editLog,
    aiHighlightDate,
    filament,
    group
}: ConsumptionModalProps) {
    const { t } = useTranslation();

    // Global Mode State
    const [allFilaments, setAllFilaments] = useState<Filament[]>([]);
    const [selectedFilament, setSelectedFilament] = useState<Filament | null>(null);
    const isGroupMode = !!group;
    const isGlobalMode = !propFilamentId && !isGroupMode;
    const activeFilamentId = isGlobalMode ? selectedFilament?.id : propFilamentId;
    const activeColor = isGroupMode ? group.color : (isGlobalMode ? selectedFilament?.color : propColor);
    const activeColors = isGroupMode ? group.colors : (isGlobalMode ? selectedFilament?.colors : propColors);
    const activeBrand = isGroupMode ? group.brand?.name : (isGlobalMode ? selectedFilament?.brand?.name : propBrand);
    const activeType = isGroupMode ? group.displayName : (isGlobalMode ? selectedFilament?.types?.map(t => t.name).join(' ') : propType);
    const activeWeight = isGroupMode ? group.totalWeight : (isGlobalMode ? selectedFilament?.weightRemaining : propWeight);
    const isLocked = isGroupMode ? false : (isGlobalMode ? selectedFilament?.isLocked : filament?.isLocked);
    const openedFromAi = Boolean(aiHighlightDate);

    const isAiHighlightedLog = (log: any) => {
        if (!aiHighlightDate || !log?.date) return false;
        return new Date(log.date).toISOString().slice(0, 10) === aiHighlightDate;
    };

    const displayOptions = useMemo(() => {
        const standalone: any[] = [];
        const fullSpools: Record<string, any[]> = {};

        allFilaments
            .filter(f => Number(f.weightRemaining || 0) > 0)
            .forEach(f => {
            const isFull = f.weightRemaining >= f.weightInitial;
            if (isFull) {
                const key = `${f.brandId}-${f.materialId}-${(f.types || []).map(t => t.id).sort().join(',')}-${f.color}`;
                if (!fullSpools[key]) fullSpools[key] = [];
                fullSpools[key].push(f);
            } else {
                standalone.push(f);
            }
        });

        // Add groups if 2+ full spools
        Object.values(fullSpools).forEach(items => {
            if (items.length >= 2) {
                const first = items[0];
                standalone.push({
                    id: `group-${first.id}`,
                    isGroup: true,
                    displayName: `${getFilamentTitle(first)} (${t('inventory.group', 'Groupe')})`,
                    brand: first.brand,
                    material: first.material,
                    types: first.types,
                    color: first.color,
                    colors: first.colors,
                    weightRemaining: items.reduce((sum, f) => sum + f.weightRemaining, 0),
                    items: items,
                    spoolReference: t('inventory.bulkSpools', '{{count}} bobines', { count: items.length })
                });
            } else {
                // If only 1 full spool, add it individually
                standalone.push(...items);
            }
        });

        return standalone;
    }, [allFilaments, t]);


    const [history, setHistory] = useState<ConsumptionLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'log' | 'history'>(initialTab);
    const [isGCodeDialogOpen, setIsGCodeDialogOpen] = useState(false);

    // Form State
    const [amount, setAmount] = useState<number | string>('');
    const [failureProgressPercent, setFailureProgressPercent] = useState<number | string>('');
    const [type, setType] = useState<'PRINT' | 'MANUAL' | 'FAIL'>('PRINT');
    const [notes, setNotes] = useState('');
    const [date, setDate] = useState(getLocalDatetime());
    const [isPlanned, setIsPlanned] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [keepOpen, setKeepOpen] = useState(false);
    const [editLogId, setEditLogId] = useState<number | null>(null);
    const isFailureMode = type === 'FAIL';
    const computedFailureAmount = isFailureMode && amount !== '' && failureProgressPercent !== ''
        ? Math.round(Number(amount) * (Number(failureProgressPercent) / 100) * 100) / 100
        : null;
    const previewAmount = computedFailureAmount !== null ? computedFailureAmount : Number(amount);

    const handleUpdate = onUpdate || onSuccess || (() => { });

    // Initialize from editLog prop if provided
    useEffect(() => {
        if (editLog) {
            setAmount(Number(Number(editLog.plannedPrintAmount ?? editLog.amount).toFixed(2)));
            setFailureProgressPercent(editLog.failureProgressPercent != null ? Number(Number(editLog.failureProgressPercent).toFixed(2)) : '');
            setType(editLog.type);
            setNotes(editLog.notes || '');
            try {
                const d = new Date(editLog.date);
                setDate(getLocalDatetime(d));
            } catch (_e) {
                setDate('');
            }
            setEditLogId(editLog.id);
            setIsPlanned(!!editLog.is_planned);
            setActiveTab('log');

            // Set the selected filament from the log data
            if (isGlobalMode && (editLog as any).filament) {
                setSelectedFilament((editLog as any).filament);
            }
        }
    }, [editLog, isGlobalMode]);

    // Reset all state when modal closes
    useEffect(() => {
        if (!isOpen) {
            setSelectedFilament(null);
            setAmount('');
            setFailureProgressPercent('');
            setType('PRINT');
            setNotes('');
            setDate(getLocalDatetime());
            setEditLogId(null);
            setIsPlanned(false);
            setActiveTab(initialTab);
        }
    }, [isOpen, initialTab]);

    useEffect(() => {
        if (isOpen && isGlobalMode) {
            api.getAll().then((data) => {
                // Deduplicate by ID to prevent multiple entries for same filament
                const unique = Array.from(new Map(data.map(item => [item.id, item])).values());
                setAllFilaments(unique);
            }).catch(console.error);
        }
    }, [isOpen, isGlobalMode]);

    // Aggressive Focus on Open
    useEffect(() => {
        if (isOpen && isGlobalMode) {
            // Short timeout to allow modal animation/mounting
            const timer = setTimeout(() => {
                const input = document.getElementById('filament-search-input');
                if (input) input.focus();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [isOpen, isGlobalMode]);

    useEffect(() => {
        if (activeTab === 'history' && activeFilamentId) {
            fetchHistory(activeFilamentId);
        }
    }, [activeTab, activeFilamentId]);

    const fetchHistory = async (id: number) => {
        setLoading(true);
        try {
            const data = await api.getConsumptionHistory(id);
            setHistory(data);
        } catch (_e) {
            // setError(t('consumption.deleteError') || 'Impossible de supprimer la consommation.'); // This line was not in the original code, but was in the instruction. Assuming it was meant to be added.
            console.error('Failed to fetch history', _e); // Keeping original console.error for now, as instruction was ambiguous about replacement.
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        const progress = Number(failureProgressPercent);
        if (isFailureMode && (failureProgressPercent === '' || !Number.isFinite(progress) || progress < 0 || progress > 100)) {
            alert(t('consumption.invalidFailureProgress', 'La progression doit etre entre 0 et 100%.'));
            return;
        }
        const amountToSave = computedFailureAmount !== null ? computedFailureAmount : Number(amount);
        if (!isGroupMode && (!activeFilamentId || !amountToSave || Number(amountToSave) <= 0)) return;
        if (computedFailureAmount !== null && (!Number.isFinite(computedFailureAmount) || computedFailureAmount <= 0)) return;
        if (isGroupMode && (!amountToSave || Number(amountToSave) <= 0)) return;

        if (editLogId) {
            setSubmitting(true);
            try {
                await api.updateConsumption(editLogId, {
                    amount: amountToSave,
                    type,
                    notes,
                    date: date ? new Date(date) : undefined,
                    is_planned: isPlanned,
                    printStatus: isFailureMode ? 'FAILED' : undefined,
                    plannedPrintAmount: isFailureMode && amount !== '' ? Number(amount) : null,
                    failureProgressPercent: isFailureMode && failureProgressPercent !== '' ? Number(failureProgressPercent) : null
                });

                const currentFilamentId = activeFilamentId;
                setAmount('');
                setFailureProgressPercent('');
                setNotes('');
                setDate(getLocalDatetime());
                setEditLogId(null);
                handleUpdate();
                
                if (keepOpen) {
                    setActiveTab('log');
                } else {
                    onClose();
                }

                if (activeTab === 'history' && currentFilamentId) fetchHistory(currentFilamentId);

                if (isGlobalMode && currentFilamentId) {
                    const updated = await api.get(currentFilamentId);
                    setSelectedFilament(updated);
                }
            } catch (error) {
                console.error(error);
                alert(t('common.error'));
            } finally {
                setSubmitting(false);
            }
            return;
        }

        // Check for insufficient stock (rollover logic)
        if (activeWeight !== undefined && Number(amountToSave) > activeWeight) {
            // Find compatible filaments for rollover
            // We need to fetch all filaments if we haven't already
            let candidates = allFilaments;
            if (candidates.length === 0) {
                try {
                    candidates = await api.getAll();
                    setAllFilaments(candidates);
                } catch (e) {
                    console.error("Could not fetch candidates for rollover", e);
                }
            }

            // Filter: Same Brand, Type, Color, but different ID and has stock
            const currentFilament = candidates.find(f => f.id === activeFilamentId) || (isGlobalMode ? selectedFilament : null);

            if (currentFilament) {
                const nextSpool = candidates.find(f =>
                    f.id !== activeFilamentId &&
                    f.brand?.id === currentFilament.brand?.id &&
                    f.material?.id === currentFilament.material?.id &&
                    JSON.stringify(f.types?.map(t => t.id).sort()) === JSON.stringify(currentFilament.types?.map(t => t.id).sort()) &&
                    f.color === currentFilament.color &&
                    f.weightRemaining > 0
                );

                if (nextSpool) {
                    const confirmRollover = window.confirm(
                        t('inventory.rolloverConfirm', {
                            current: Math.round(activeWeight),
                            requested: amountToSave,
                            nextSpool: `${getFilamentTitle(nextSpool)} (${Math.round(nextSpool.weightRemaining)}g)`
                        }) ||
                        `Insufficient stock (${Math.round(activeWeight)}g). Consume rest from next spool (${Math.round(nextSpool.weightRemaining)}g)?`
                    );

                    if (confirmRollover) {
                        setSubmitting(true);
                        try {
                            // 1. Deplete current spool
                            const remainingInCurrent = activeWeight;
                            const overflow = Number(amountToSave) - remainingInCurrent;

                            if (remainingInCurrent > 0 && activeFilamentId) {
                                await api.logConsumption(activeFilamentId, remainingInCurrent, type, `${notes} (Rollover: Depleted)`, date ? new Date(date).toISOString() : undefined, undefined, isPlanned);
                            }

                            // 2. Consume overflow from next spool
                            await api.logConsumption(nextSpool.id, overflow, type, `${notes} (Rollover: Continued)`, date ? new Date(date).toISOString() : undefined, undefined, isPlanned);

                            setAmount('');
                            setFailureProgressPercent('');
                            setNotes('');
                            setDate(getLocalDatetime());
                            handleUpdate();

                            if (!keepOpen) {
                                onClose();
                            } else {
                                setActiveTab('log');
                                if (activeTab === 'history' && activeFilamentId && typeof activeFilamentId === 'number') fetchHistory(activeFilamentId);
                            }

                            if (isGlobalMode && activeFilamentId && typeof activeFilamentId === 'number') {
                                const updated = await api.get(activeFilamentId);
                                setSelectedFilament(updated);
                            }
                        } catch (err) {
                            console.error(err);
                            alert(t('common.error'));
                        } finally {
                            setSubmitting(false);
                        }
                        return; // Exit normal submit
                    }
                }
            }
        }

        setSubmitting(true);
        try {
            if (isGroupMode || (selectedFilament as any)?.isGroup) {
                const targetGroup = isGroupMode ? group : selectedFilament;
                await api.consumeGroup({
                    brandId: targetGroup.items[0]?.brandId || targetGroup.items[0]?.brand?.id,
                    materialId: targetGroup.items[0]?.materialId || targetGroup.items[0]?.material?.id,
                    typeId: targetGroup.items[0]?.types?.[0]?.id, // Use first item's type as proxy
                    color: targetGroup.color,
                    amount: amountToSave,
                    type,
                    notes,
                    isPlanned,
                    date: date ? new Date(date).toISOString() : undefined,
                    printStatus: isFailureMode ? 'FAILED' : undefined,
                    plannedPrintAmount: isFailureMode && amount !== '' ? Number(amount) : null,
                    failureProgressPercent: isFailureMode && failureProgressPercent !== '' ? Number(failureProgressPercent) : null
                });
            } else if (activeFilamentId) {
                await api.logConsumption(activeFilamentId, amountToSave, type, notes, date ? new Date(date).toISOString() : undefined, undefined, isPlanned, {
                    printStatus: isFailureMode ? 'FAILED' : undefined,
                    plannedPrintAmount: isFailureMode && amount !== '' ? Number(amount) : null,
                    failureProgressPercent: isFailureMode && failureProgressPercent !== '' ? Number(failureProgressPercent) : null
                });
            }
            
            const currentFilamentId = activeFilamentId;

            setAmount('');
            setFailureProgressPercent('');
            setNotes('');
            setDate(getLocalDatetime());
            handleUpdate();

            if (!keepOpen) {
                onClose();
            } else {
                setActiveTab('log');
                if (!isGroupMode && currentFilamentId && typeof currentFilamentId === 'number') fetchHistory(currentFilamentId);
            }

            // Refresh data in global mode
            if (isGlobalMode) {
                // Always refresh the full list to update groups and availability
                api.getAll().then((data) => {
                    const unique = Array.from(new Map(data.map(item => [item.id, item])).values());
                    setAllFilaments(unique);
                }).catch(console.error);

                // Refresh the single selected filament if it's a real one (not a group)
                if (currentFilamentId && typeof currentFilamentId === 'number') {
                    api.get(currentFilamentId).then(setSelectedFilament).catch(console.error);
                }
            }

        } catch (error) {
            console.error(error);
            alert(t('common.error'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleDuplicate = (log: ConsumptionLog) => {
        setAmount(log.plannedPrintAmount != null ? Number(log.plannedPrintAmount) : log.amount);
        setFailureProgressPercent(log.failureProgressPercent != null ? Number(log.failureProgressPercent) : '');
        setType(log.type);
        setNotes(log.notes || '');
        setIsPlanned(!!log.is_planned);
        setEditLogId(null);
        setActiveTab('log');
    };

    const handleEdit = (log: ConsumptionLog) => {
        setAmount(Number((log.plannedPrintAmount ?? log.amount).toFixed(2)));
        setFailureProgressPercent(log.failureProgressPercent != null ? Number(log.failureProgressPercent.toFixed(2)) : '');
        setType(log.type);
        setNotes(log.notes || '');
        try {
            const d = new Date(log.date);
            setDate(getLocalDatetime(d));
        } catch (e) {
            setDate('');
        }
        setEditLogId(log.id);

        // Fix for global mode: set the selected filament so the Autocomplete doesn't clear
        if (isGlobalMode && log.filament) {
            setSelectedFilament(log.filament as any);
        }

        setActiveTab('log');
    };

    const handleDelete = async (id: number, logAmount: number) => {
        if (window.confirm(t('consumption.confirmDelete', { amount: logAmount }) || `Delete this log? ${logAmount}g will be credited back.`)) {
            try {
                await api.deleteConsumption(id);
                handleUpdate();
                if (activeFilamentId) fetchHistory(activeFilamentId);
            } catch (error) {
                console.error(error);
                alert(t('common.error'));
            }
        }
    };

    return (
        <>
            <Dialog open={isOpen} onClose={onClose} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                        {activeFilamentId ? (
                            <ColorIndicator colors={[activeColor || '#000', ...(activeColors || [])]} size={32} />
                        ) : (
                            <Box sx={{ width: 32, height: 32, bgcolor: 'action.hover', borderRadius: '50%' }} />
                        )}

                        <Box sx={{ flex: 1 }}>
                            {isGlobalMode ? (
                                <Autocomplete
                                    options={displayOptions}
                                    getOptionLabel={(option) => option.isGroup ? option.displayName : `${getFilamentTitle(option)}`}
                                    isOptionEqualToValue={(option, value) => option.id === value?.id}
                                    filterOptions={createFilterOptions({
                                        limit: 20,
                                        stringify: (option) => option.isGroup ? option.displayName : `${getFilamentTitle(option)} ${option.spoolReference || ''}`
                                    })}
                                    value={displayOptions.find(f => f.id === selectedFilament?.id) || selectedFilament || null}
                                    onChange={(_, newValue) => setSelectedFilament(newValue)}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            id="filament-search-input"
                                            variant="outlined"
                                            autoFocus
                                            placeholder={t('inventory.search') || "Search filament or Scan Barcode..."}
                                            fullWidth
                                            sx={{
                                                '& .MuiOutlinedInput-root': {
                                                    borderRadius: '50px',
                                                    paddingLeft: 2
                                                }
                                            }}
                                        />
                                    )}
                                    renderOption={(props, option) => {
                                        const { key, ...otherProps } = props;
                                        return (
                                            <li key={key} {...otherProps}>
                                                <Box sx={{ mr: 1, display: 'inline-flex' }}>
                                                    <ColorIndicator colors={[option.color, ...(option.colors || [])]} size={12} />
                                                </Box>
                                                <Box sx={{ flex: 1 }}>
                                                    <Typography variant="body2">
                                                        {option.isGroup ? option.displayName : getFilamentTitle(option)} {!option.isGroup && <Typography component="span" variant="caption" color="text.disabled">#{option.id}</Typography>}
                                                    </Typography>
                                                    <Typography variant="caption" color="textSecondary" display="block">
                                                        {Math.round(option.weightRemaining)}g
                                                        {option.spoolReference && ` • ${option.spoolReference}`}
                                                    </Typography>
                                                </Box>
                                            </li>
                                        );
                                    }}
                                    size="small"
                                />
                            ) : (
                                <>
                                    {activeBrand && <Typography variant="caption" display="block" color="textSecondary">{activeBrand} - {activeType}</Typography>}
                                    <Typography variant="h6">{isGroupMode ? `${t('inventory.group')} : ${activeBrand || ''} ${activeType || ''}` : t('inventory.manageStock')}</Typography>
                                </>
                            )}
                        </Box>
                    </Box>
                    <IconButton onClick={onClose} size="small" sx={{ ml: 2 }}><X /></IconButton>
                </DialogTitle>

                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} variant="fullWidth">
                        <Tab icon={<Plus size={16} />} iconPosition="start" label={editLogId ? (t('common.edit')) : (t('inventory.logConsumption'))} value="log" />
                        <Tab icon={<History size={16} />} iconPosition="start" label={t('inventory.history')} value="history" disabled={!activeFilamentId || isGroupMode} />
                    </Tabs>
                </Box>

                <DialogContent>
                    {activeTab === 'log' ? (
                        <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {activeFilamentId && (
                                <Alert icon={<AlertCircle size={20} />} severity="info" sx={{ alignItems: 'center' }}>
                                    <Typography variant="subtitle2">{t('inventory.remaining')}: <strong>{Math.round(activeWeight || 0)}{unit}</strong></Typography>
                                </Alert>
                            )}

                            {isLocked && (
                                <Alert severity="warning" sx={{ alignItems: 'center' }}>
                                    <Typography variant="subtitle2">{t('common.lockedQuota')}</Typography>
                                </Alert>
                            )}

                            <Box sx={{ display: 'flex', gap: 1 }}>
                                {/* GCode Analysis Button */}
                                <Button
                                    variant="outlined"
                                    color="secondary"
                                    startIcon={<span style={{ fontSize: '1.2em' }}>🪄</span>}
                                    onClick={() => setIsGCodeDialogOpen(true)}
                                    title={t('consumption.analyzeGCodeDesc')}
                                    fullWidth
                                >
                                    {t('consumption.analyzeGCode')}
                                </Button>
                            </Box>

                            <Box sx={{ display: 'flex', gap: 2 }}>
                                <TextField
                                    label={t('inventory.date')}
                                    type="datetime-local"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    fullWidth
                                    InputLabelProps={{ shrink: true }}
                                    disabled={!activeFilamentId && !isGlobalMode && !isGroupMode}
                                />
                                <TextField
                                    label={t('inventory.amount')}
                                    type="text"
                                    value={amount}
                                    onChange={(e) => setAmount(normalizeNumericInput(e.target.value))}
                                    fullWidth
                                    InputProps={{
                                        endAdornment: <InputAdornment position="end">{unit}</InputAdornment>,
                                    }}
                                />
                            </Box>

                            {!isLocked && previewAmount >= (activeWeight || 0) && (activeWeight || 0) > 0 && !isPlanned && (
                                <Alert severity="warning" sx={{ alignItems: 'center' }}>
                                    <Typography variant="subtitle2">
                                        {t('consumption.emptyWarning', "⚠️ Cette quantité épuisera la bobine. Celle-ci sera considérée comme vide et disparaîtra du stock actif.")}
                                    </Typography>
                                </Alert>
                            )}

                            <Box sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                p: 1.5,
                                border: '1px solid',
                                borderColor: isPlanned ? 'primary.main' : 'divider',
                                borderRadius: 1,
                                bgcolor: isPlanned ? 'primary.shimmer' : 'transparent',
                                transition: 'all 0.2s',
                                cursor: 'pointer'
                            }} onClick={() => setIsPlanned(!isPlanned)}>
                                <Box>
                                    <Typography variant="subtitle2" color={isPlanned ? 'primary.main' : 'textPrimary'}>
                                        {t('consumption.isPlanned', 'Consommation planifiée (Réservation)')}
                                    </Typography>
                                    <Typography variant="caption" color="textSecondary">
                                        {t('consumption.isPlannedDesc', 'Ne déduit pas physiquement du stock réel')}
                                    </Typography>
                                </Box>
                                <Chip
                                    label={isPlanned ? t('common.yes') : t('common.no')}
                                    color={isPlanned ? 'primary' : 'default'}
                                    size="small"
                                />
                            </Box>

                            <Box>
                                <Typography variant="subtitle2" gutterBottom>{t('common.type')}</Typography>
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    {['PRINT', 'MANUAL', 'FAIL'].map((tVal) => (
                                        <Chip
                                            key={tVal}
                                            label={
                                                tVal === 'PRINT' ? t('consumption.typePrint', 'Impression') :
                                                tVal === 'MANUAL' ? t('consumption.typeManual', 'Manuel') :
                                                t('consumption.typeFail', 'Échec')
                                            }
                                            onClick={() => setType(tVal as any)}
                                            color={type === tVal ? 'primary' : 'default'}
                                            variant={type === tVal ? 'filled' : 'outlined'}
                                            sx={{ flex: 1, cursor: 'pointer' }}
                                        />
                                    ))}
                                </Box>
                                {isFailureMode && (
                                    <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                        <TextField
                                            label={t('consumption.failureProgressPercent', 'Progression de l\'echec')}
                                            type="text"
                                            value={failureProgressPercent}
                                            onChange={(e) => setFailureProgressPercent(normalizeNumericInput(e.target.value))}
                                            fullWidth
                                            InputProps={{
                                                endAdornment: <InputAdornment position="end">%</InputAdornment>,
                                            }}
                                        />
                                        {computedFailureAmount !== null && Number.isFinite(computedFailureAmount) && (
                                            <Alert severity="info" sx={{ alignItems: 'center' }}>
                                                <Typography variant="subtitle2">
                                                    {t('consumption.computedFailureAmount', 'Conso qui sera loggee')}: <strong>{computedFailureAmount}{unit}</strong>
                                                </Typography>
                                            </Alert>
                                        )}
                                    </Box>
                                )}
                            </Box>

                            <TextField
                                label={t('inventory.notes')}
                                multiline
                                rows={3}
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                fullWidth
                            />

                            {!editLogId && (
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={keepOpen}
                                            onChange={(e) => setKeepOpen(e.target.checked)}
                                            color="primary"
                                        />
                                    }
                                    label={
                                        <Typography variant="body2" color="textSecondary">
                                            {t('consumption.keepOpen')}
                                        </Typography>
                                    }
                                    sx={{ ml: 0 }}
                                />
                            )}

                            <Button
                                variant="contained"
                                fullWidth
                                size="large"
                                disabled={!amount || submitting || (!activeFilamentId && !isGroupMode) || isLocked}
                                onClick={handleSubmit}
                            >
                                {submitting ? <CircularProgress size={24} /> : (editLogId ? (t('common.save') || "Save Changes") : t('inventory.logConsumption'))}
                            </Button>
                        </Box>
                    ) : (
                        <Box
                            sx={{
                                pt: 1,
                                ...(openedFromAi && {
                                    border: '2px solid',
                                    borderColor: 'error.main',
                                    borderRadius: 2,
                                    p: 1.5,
                                    bgcolor: 'rgba(211, 47, 47, 0.03)',
                                }),
                            }}
                        >
                            {openedFromAi && (
                                <Alert severity="error" icon={<AlertCircle size={18} />} sx={{ mb: 1.5 }}>
                                    Ouvert depuis une alerte IA. La consommation suspecte
                                    {aiHighlightDate ? ` du ${aiHighlightDate}` : ''} est mise en evidence si elle est presente dans l'historique.
                                </Alert>
                            )}
                            {loading ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
                            ) : history.length === 0 ? (
                                <Typography textAlign="center" color="textSecondary" sx={{ py: 4 }}>{t('common.noHistory')}</Typography>
                            ) : (
                                <List>
                                    {history.map((log: any) => {
                                        const highlighted = isAiHighlightedLog(log);
                                        return (
                                        <ListItem
                                            key={log.id}
                                            divider
                                            sx={{
                                                borderRadius: 1.5,
                                                ...(highlighted && {
                                                    border: '2px solid',
                                                    borderColor: 'error.main',
                                                    bgcolor: 'rgba(211, 47, 47, 0.08)',
                                                    mb: 1,
                                                    boxShadow: '0 0 0 3px rgba(211, 47, 47, 0.08)',
                                                }),
                                            }}
                                            secondaryAction={
                                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', mr: 2 }}>
                                                        <Typography color="error" fontWeight="bold">-{log.amount}{unit}</Typography>
                                                        {log.filament?.price > 0 && log.filament?.weightInitial > 0 && (
                                                            <Typography variant="caption" color="textSecondary">
                                                                ~{((log.amount * log.filament.price) / log.filament.weightInitial).toFixed(2)}€
                                                            </Typography>
                                                        )}
                                                    </Box>
                                                    <Box sx={{ display: 'flex' }}>
                                                        <IconButton
                                                            edge="end"
                                                            size="small"
                                                            disabled={isLocked}
                                                            onClick={() => handleDuplicate(log)}
                                                            title={t('common.duplicate')}
                                                            sx={{ color: 'primary.main', mr: 1 }}
                                                        >
                                                            <Copy size={16} />
                                                        </IconButton>
                                                        <IconButton
                                                            edge="end"
                                                            size="small"
                                                            disabled={isLocked}
                                                            onClick={() => handleEdit(log)}
                                                            title={t('common.edit') || 'Edit'}
                                                            sx={{ color: 'text.secondary', mr: 1 }}
                                                        >
                                                            <Edit2 size={16} />
                                                        </IconButton>
                                                        <IconButton
                                                            edge="end"
                                                            size="small"
                                                            disabled={isLocked}
                                                            onClick={() => handleDelete(log.id, log.amount)}
                                                            title={t('common.delete') || 'Delete'}
                                                            sx={{ color: 'error.main' }}
                                                        >
                                                            <Trash2 size={16} />
                                                        </IconButton>
                                                    </Box>
                                                </Box>
                                            }
                                        >
                                            <ListItemText
                                                sx={{ pr: 18 }}
                                                primary={
                                                    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.5, mb: 0.5 }}>
                                                        <Chip
                                                            label={
                                                                log.type === 'PRINT' ? t('consumption.typePrint', 'Impression') :
                                                                    log.type === 'MANUAL' ? t('consumption.typeManual', 'Manuel') :
                                                                        log.type === 'FAIL' ? t('consumption.typeFail', 'Échec') :
                                                                            log.type
                                                            }
                                                            size="small"
                                                            color={
                                                                log.type === 'PRINT' ? 'primary' :
                                                                    log.type === 'MANUAL' ? 'info' :
                                                                        log.type === 'FAIL' ? 'error' :
                                                                            'default'
                                                            }
                                                            variant="outlined"
                                                        />
                                                        {log.is_planned && (
                                                            <Chip
                                                                label={t('consumption.planned', 'Planifiée/Réservée')}
                                                                size="small"
                                                                color="info"
                                                                variant="outlined"
                                                                sx={{ borderStyle: 'dotted' }}
                                                            />
                                                        )}
                                                    </Box>
                                                }
                                                secondary={
                                                    <Box component="span">
                                                        <Typography variant="caption" display="block">
                                                            {new Date(log.date).toLocaleString()}
                                                        </Typography>
                                                        {log.notes && <Typography variant="caption" fontStyle="italic">"{log.notes}"</Typography>}
                                                    </Box>
                                                }
                                            />
                                        </ListItem>
                                    );
                                    })}
                                </List>
                            )}
                        </Box>
                    )}
                </DialogContent>
            </Dialog>

            <GCodeAnalysisDialog
                isOpen={isGCodeDialogOpen}
                onClose={() => setIsGCodeDialogOpen(false)}
                initialFilamentId={activeFilamentId}
                onAnalysisComplete={() => {
                    handleUpdate();
                    if (activeFilamentId) {
                        if (activeTab === 'history') {
                            fetchHistory(activeFilamentId);
                        } else {
                            setActiveTab('history');
                        }
                    }
                    setIsGCodeDialogOpen(false);
                }}
            />
        </>
    );
}
