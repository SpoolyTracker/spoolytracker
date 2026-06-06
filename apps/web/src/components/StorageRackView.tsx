import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    IconButton,
    MenuItem,
    Stack,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import { QRCodeSVG } from 'qrcode.react';
import { Archive, Box as BoxIcon, Boxes, Check, Copy, Edit2, PackageOpen, Plus, Printer, QrCode, RefreshCw, Rows3, Star, Trash2, X } from 'lucide-react';
import { api, type Filament, type StorageUnit, type StorageUnitKind } from '../api';
import ColorIndicator from './ColorIndicator';
import { getFilamentTitle } from '../utils/filament-utils';

type Placement = {
    unitId: number;
    level: number;
    slot: number;
};

type Preset = {
    id: string;
    levels: number;
    slotsPerLevel: number;
};

const presets: Preset[] = [
    { id: 'small', levels: 3, slotsPerLevel: 5 },
    { id: 'standard', levels: 4, slotsPerLevel: 6 },
    { id: 'large', levels: 5, slotsPerLevel: 8 },
];

const storageKinds: StorageUnitKind[] = ['shelf', 'cabinet', 'display', 'bin'];

const getSafeColors = (filament: Filament): string[] => {
    const colors = Array.isArray(filament.colors) && filament.colors.length > 0 ? filament.colors : [filament.color || '#ff6b1a'];
    return colors.filter(Boolean);
};

const makeSlotKey = (unitId: number, level: number, slot: number) => `${unitId}:${level}:${slot}`;
const getSlotLabel = (level: number, slot: number) => `${String.fromCharCode(65 + level)}${slot + 1}`;
const getUnitTagId = (unit: StorageUnit) => unit.tagId || `STORAGE-${unit.id}`;
const getAreaKey = (unit: StorageUnit) => unit.location?.trim() || '__no_area__';
const getUnitTagPayload = (unit: StorageUnit, organizationId?: number | string | null) => JSON.stringify({
    type: 'storage_unit',
    organizationId: organizationId || null,
    unitId: unit.id,
    tagId: getUnitTagId(unit),
    name: unit.name,
    location: unit.location || '',
});

const getStorageLocationLabel = (filament: Filament, units: StorageUnit[], placements: Record<number, Placement>): string => {
    const placement = placements[filament.id];
    const unit = placement ? units.find(item => item.id === placement.unitId) : filament.storageUnit;
    if (!placement && !unit) return '';
    const slotLabel = placement
        ? getSlotLabel(placement.level, placement.slot)
        : filament.storageLevel !== null && filament.storageLevel !== undefined && filament.storageSlot !== null && filament.storageSlot !== undefined
            ? getSlotLabel(Number(filament.storageLevel), Number(filament.storageSlot))
            : '';
    return [unit?.location, unit?.name, slotLabel].filter(Boolean).join(' / ');
};

const formatRange = (min?: number | null, max?: number | null, suffix = '') => {
    if (min === null || min === undefined) return max === null || max === undefined ? '' : `${Math.round(max)}${suffix}`;
    if (max === null || max === undefined || min === max) return `${Math.round(min)}${suffix}`;
    return `${Math.round(min)}-${Math.round(max)}${suffix}`;
};

const cleanTextValue = (value?: string | null) => {
    const text = value?.trim();
    return text && text.toLowerCase() !== 'null' ? text : '';
};

const formatPrice = (value?: number | null) => (
    typeof value === 'number' && Number.isFinite(value) ? `${value}€` : ''
);

const setSpoolDragImage = (event: React.DragEvent, filament: Filament) => {
    const preview = document.createElement('div');
    const color = getSafeColors(filament)[0] || '#1661af';
    preview.textContent = getFilamentTitle(filament);
    preview.style.position = 'fixed';
    preview.style.top = '-1000px';
    preview.style.left = '-1000px';
    preview.style.maxWidth = '220px';
    preview.style.padding = '8px 12px 8px 30px';
    preview.style.border = '1px solid rgba(22, 97, 175, 0.35)';
    preview.style.borderRadius = '999px';
    preview.style.background = '#ffffff';
    preview.style.color = '#1f2937';
    preview.style.boxShadow = '0 10px 24px rgba(15, 23, 42, 0.18)';
    preview.style.font = '700 12px Arial, sans-serif';
    preview.style.whiteSpace = 'nowrap';
    preview.style.overflow = 'hidden';
    preview.style.textOverflow = 'ellipsis';

    const dot = document.createElement('span');
    dot.style.position = 'absolute';
    dot.style.left = '10px';
    dot.style.top = '50%';
    dot.style.width = '14px';
    dot.style.height = '14px';
    dot.style.borderRadius = '50%';
    dot.style.background = color;
    dot.style.transform = 'translateY(-50%)';
    preview.appendChild(dot);

    document.body.appendChild(preview);
    event.dataTransfer.setDragImage(preview, 24, 18);
    window.setTimeout(() => preview.remove(), 0);
};

const getPlacementsFromFilaments = (filaments: Filament[]): Record<number, Placement> => (
    Object.fromEntries(
        filaments
            .filter(filament => filament.storageUnitId && filament.storageLevel !== null && filament.storageLevel !== undefined && filament.storageSlot !== null && filament.storageSlot !== undefined)
            .map(filament => [
                filament.id,
                {
                    unitId: Number(filament.storageUnitId),
                    level: Number(filament.storageLevel),
                    slot: Number(filament.storageSlot),
                },
            ]),
    )
);

type DraftStorageUnit = Omit<StorageUnit, 'id'> & { id?: number };

interface StorageRackViewProps {
    filaments: Filament[];
    organizationId?: number | string | null;
    onEdit: (filament: Filament) => void;
    onLogConsumption: (filament: Filament) => void;
    onRefresh: () => void | Promise<void>;
}

export default function StorageRackView({ filaments, organizationId, onEdit, onLogConsumption, onRefresh }: StorageRackViewProps) {
    const { t } = useTranslation();
    const [units, setUnits] = useState<StorageUnit[]>([]);
    const [placements, setPlacements] = useState<Record<number, Placement>>(() => getPlacementsFromFilaments(filaments));
    const [selectedFilamentId, setSelectedFilamentId] = useState<number | null>(null);
    const [targetSlot, setTargetSlot] = useState<Placement | null>(null);
    const [draggingFilamentId, setDraggingFilamentId] = useState<number | null>(null);
    const [isUnstoreTargetActive, setUnstoreTargetActive] = useState(false);
    const [unstoredSearch, setUnstoredSearch] = useState('');
    const [activeFilament, setActiveFilament] = useState<Filament | null>(null);
    const [tagUnit, setTagUnit] = useState<StorageUnit | null>(null);
    const [selectedArea, setSelectedArea] = useState('all');
    const [isUnitDialogOpen, setUnitDialogOpen] = useState(false);
    const [editingUnitId, setEditingUnitId] = useState<number | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [draftUnit, setDraftUnit] = useState<DraftStorageUnit>({
        name: t('inventory.storage.defaultUnitName', { count: 1 }),
        location: '',
        kind: 'shelf',
        levels: 4,
        slotsPerLevel: 6,
        favorite: false,
    });

    const refreshRackData = async () => {
        const items = await api.getStorageUnits();
        setUnits(items);
        await onRefresh();
    };

    const handleManualRefresh = async () => {
        setIsRefreshing(true);
        try {
            await refreshRackData();
        } finally {
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        let cancelled = false;
        api.getStorageUnits()
            .then(items => {
                if (!cancelled) setUnits(items);
            })
            .catch(() => {
                if (!cancelled) setUnits([]);
            });
        return () => {
            cancelled = true;
        };
    }, [organizationId]);

    useEffect(() => {
        setPlacements(getPlacementsFromFilaments(filaments));
    }, [filaments]);

    const areaOptions = useMemo(() => {
        const areas = new Map<string, string>();
        units.forEach(unit => {
            const areaKey = getAreaKey(unit);
            areas.set(areaKey, unit.location?.trim() || t('inventory.storage.noArea'));
        });
        return Array.from(areas.entries()).map(([value, label]) => ({ value, label }));
    }, [t, units]);

    useEffect(() => {
        if (selectedArea !== 'all' && !areaOptions.some(area => area.value === selectedArea)) {
            setSelectedArea('all');
        }
    }, [areaOptions, selectedArea]);

    const visibleUnits = useMemo(() => (
        (selectedArea === 'all' ? units : units.filter(unit => getAreaKey(unit) === selectedArea))
            .slice()
            .sort((a, b) => Number(Boolean(b.favorite)) - Number(Boolean(a.favorite)) || a.name.localeCompare(b.name))
    ), [selectedArea, units]);

    const visibleUnitIds = useMemo(() => new Set(visibleUnits.map(unit => unit.id)), [visibleUnits]);
    const targetSlotUnit = useMemo(() => targetSlot ? units.find(unit => unit.id === targetSlot.unitId) || null : null, [targetSlot, units]);
    const targetSlotLabel = targetSlot ? [targetSlotUnit?.location, targetSlotUnit?.name, getSlotLabel(targetSlot.level, targetSlot.slot)].filter(Boolean).join(' / ') : '';

    const filamentsById = useMemo(() => new Map(filaments.map(filament => [filament.id, filament])), [filaments]);
    const occupiedSlots = useMemo(() => {
        const slots = new Map<string, Filament>();
        Object.entries(placements).forEach(([filamentId, placement]) => {
            const filament = filamentsById.get(Number(filamentId));
            if (filament) {
                slots.set(makeSlotKey(placement.unitId, placement.level, placement.slot), filament);
            }
        });
        return slots;
    }, [filamentsById, placements]);

    const totalSlots = visibleUnits.reduce((sum, unit) => sum + unit.levels * unit.slotsPerLevel, 0);
    const storedCount = filaments.filter(filament => placements[filament.id] && visibleUnitIds.has(placements[filament.id].unitId)).length;
    const notStored = filaments.filter(filament => !placements[filament.id]);
    const filteredNotStored = useMemo(() => {
        const query = unstoredSearch.trim().toLowerCase();
        if (!query) return notStored;
        return notStored.filter(filament => (
            getFilamentTitle(filament).toLowerCase().includes(query) ||
            filament.brand?.name?.toLowerCase().includes(query) ||
            filament.material?.name?.toLowerCase().includes(query) ||
            filament.colorName?.toLowerCase().includes(query) ||
            filament.types?.some(type => type.name.toLowerCase().includes(query)) ||
            String(Math.round(filament.weightRemaining || 0)).includes(query)
        ));
    }, [notStored, unstoredSearch]);
    const freeSlots = Math.max(0, totalSlots - storedCount);

    const placeFilamentInSlot = async (filamentId: number, unitId: number, level: number, slot: number) => {
        setPlacements(prev => ({ ...prev, [filamentId]: { unitId, level, slot } }));
        setSelectedFilamentId(null);
        setTargetSlot(null);
        setDraggingFilamentId(null);
        await api.placeFilament(filamentId, {
            storageUnitId: unitId,
            storageLevel: level,
            storageSlot: slot,
        });
        onRefresh();
    };

    const assignToSlot = async (unitId: number, level: number, slot: number, filamentId?: number) => {
        const occupant = occupiedSlots.get(makeSlotKey(unitId, level, slot));
        if (occupant) {
            setActiveFilament(occupant);
            return;
        }
        const targetFilamentId = filamentId || selectedFilamentId;
        if (!targetFilamentId) {
            setTargetSlot({ unitId, level, slot });
            setSelectedFilamentId(null);
            return;
        }
        await placeFilamentInSlot(targetFilamentId, unitId, level, slot);
    };

    const removePlacement = async (filamentId: number) => {
        setPlacements(prev => {
            const next = { ...prev };
            delete next[filamentId];
            return next;
        });
        await api.placeFilament(filamentId, { storageUnitId: null, storageLevel: null, storageSlot: null });
        setDraggingFilamentId(null);
        setUnstoreTargetActive(false);
        onRefresh();
    };

    const autoPlace = async () => {
        const availableSlots = visibleUnits.flatMap(unit => (
            Array.from({ length: unit.levels * unit.slotsPerLevel }).map((_, index) => ({
                unitId: unit.id,
                level: Math.floor(index / unit.slotsPerLevel),
                slot: index % unit.slotsPerLevel,
            }))
        )).filter(slot => !occupiedSlots.has(makeSlotKey(slot.unitId, slot.level, slot.slot)));
        const next: Record<number, Placement> = { ...placements };
        const filamentsToPlace = filteredNotStored.slice(0, availableSlots.length);
        filamentsToPlace.forEach((filament, index) => {
            next[filament.id] = availableSlots[index];
        });
        setPlacements(next);
        await Promise.all(filamentsToPlace.map((filament, index) => api.placeFilament(filament.id, {
            storageUnitId: availableSlots[index].unitId,
            storageLevel: availableSlots[index].level,
            storageSlot: availableSlots[index].slot,
        })));
        onRefresh();
    };

    const openCreateUnit = () => {
        setEditingUnitId(null);
        setDraftUnit({
            name: t('inventory.storage.defaultUnitName', { count: units.length + 1 }),
            location: '',
            kind: 'shelf',
            levels: 4,
            slotsPerLevel: 6,
            favorite: false,
        });
        setUnitDialogOpen(true);
    };

    const openEditUnit = (unit: StorageUnit) => {
        setEditingUnitId(unit.id);
        setDraftUnit(unit);
        setUnitDialogOpen(true);
    };

    const saveUnit = async () => {
        try {
            if (editingUnitId) {
                const nextLevels = Math.max(1, Number(draftUnit.levels || 1));
                const nextSlotsPerLevel = Math.max(1, Number(draftUnit.slotsPerLevel || 1));
                const saved = await api.updateStorageUnit(editingUnitId, {
                    name: draftUnit.name.trim(),
                    location: draftUnit.location?.trim() || '',
                    kind: draftUnit.kind,
                    levels: nextLevels,
                    slotsPerLevel: nextSlotsPerLevel,
                    tagId: draftUnit.tagId || null,
                    favorite: draftUnit.favorite ?? false,
                });
                setUnits(prev => prev.map(unit => unit.id === editingUnitId ? saved : unit));
                setPlacements(prev => {
                    const next: Record<number, Placement> = {};
                    Object.entries(prev).forEach(([filamentId, placement]) => {
                        if (
                            placement.unitId !== editingUnitId ||
                            (placement.level < nextLevels && placement.slot < nextSlotsPerLevel)
                        ) {
                            next[Number(filamentId)] = placement;
                        }
                    });
                    return next;
                });
                setEditingUnitId(null);
                setUnitDialogOpen(false);
                await refreshRackData();
                return;
            }

            const unit = await api.createStorageUnit({
                name: draftUnit.name.trim() || t('inventory.storage.defaultUnitName', { count: units.length + 1 }),
                location: draftUnit.location?.trim() || '',
                kind: draftUnit.kind,
                levels: Math.max(1, Number(draftUnit.levels || 1)),
                slotsPerLevel: Math.max(1, Number(draftUnit.slotsPerLevel || 1)),
                tagId: draftUnit.tagId || null,
                favorite: draftUnit.favorite ?? false,
            });
            setUnits(prev => [...prev, unit]);
            setDraftUnit({
                name: t('inventory.storage.defaultUnitName', { count: units.length + 2 }),
                location: '',
                kind: 'shelf',
                levels: 4,
                slotsPerLevel: 6,
                favorite: false,
            });
            setUnitDialogOpen(false);
            await refreshRackData();
        } catch (error: any) {
            console.error('Failed to save storage unit', {
                id: editingUnitId,
                status: error?.status,
                message: error?.message,
                error,
            });
            alert(error?.message || t('common.error', 'Erreur'));
        }
    };

    const toggleUnitFavorite = async (unit: StorageUnit) => {
        const favorite = !unit.favorite;
        setUnits(prev => prev.map(item => item.id === unit.id ? { ...item, favorite } : item));
        try {
            const saved = await api.updateStorageUnit(unit.id, { favorite });
            setUnits(prev => prev.map(item => item.id === unit.id ? saved : item));
        } catch (error) {
            console.error('Failed to update storage unit favorite', error);
            setUnits(prev => prev.map(item => item.id === unit.id ? { ...item, favorite: unit.favorite } : item));
        }
    };

    const deleteUnit = async (unitId: number) => {
        const unit = units.find(item => item.id === unitId);
        const confirmed = window.confirm(
            t(
                'inventory.storage.confirmDeleteUnit',
                { name: unit?.name || t('inventory.storage.title') },
            ),
        );
        if (!confirmed) return;

        try {
            await api.deleteStorageUnit(unitId);
            setUnits(prev => prev.filter(unit => unit.id !== unitId));
            setPlacements(prev => {
                const next: Record<number, Placement> = {};
                Object.entries(prev).forEach(([filamentId, placement]) => {
                    if (placement.unitId !== unitId) {
                        next[Number(filamentId)] = placement;
                    }
                });
                return next;
            });
            await refreshRackData();
        } catch (error: any) {
            console.error('Failed to delete storage unit', {
                id: unitId,
                status: error?.status,
                message: error?.message,
                error,
            });
            alert(error?.message || t('common.error', 'Erreur'));
        }
    };

    const printUnitTag = (unit: StorageUnit) => {
        const payload = getUnitTagPayload(unit, organizationId);
        const qrMarkup = document.getElementById(`storage-tag-qr-${unit.id}`)?.innerHTML || '';
        const printWindow = window.open('', '_blank', 'width=420,height=560');
        if (!printWindow) {
            return;
        }
        printWindow.document.write(`
            <html>
                <head>
                    <title>${unit.name}</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 0; padding: 24px; color: #111827; }
                        .label { width: 320px; border: 1px solid #d1d5db; border-radius: 12px; padding: 16px; text-align: center; }
                        .title { font-size: 20px; font-weight: 800; margin-bottom: 4px; }
                        .location { font-size: 13px; color: #4b5563; margin-bottom: 12px; }
                        .qr { margin: 10px auto; width: 180px; height: 180px; }
                        .tag { font-size: 9px; line-height: 1.3; word-break: break-all; color: #374151; border-top: 1px solid #e5e7eb; padding-top: 10px; margin-top: 12px; }
                        @media print {
                            body { padding: 0; }
                            .label { border: 1px solid #000; page-break-inside: avoid; }
                        }
                    </style>
                </head>
                <body>
                    <div class="label">
                        <div class="title">${unit.name}</div>
                        <div class="location">${unit.location || ''}</div>
                        <div class="qr">${qrMarkup}</div>
                        <div class="tag">${payload}</div>
                    </div>
                    <script>setTimeout(function() { window.print(); }, 200);</script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    return (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1fr) 330px' }, gap: 2, alignItems: 'start' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Card variant="outlined" sx={{ borderRadius: 2 }}>
                    <CardContent sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                        <Button variant="contained" startIcon={<Plus size={16} />} onClick={openCreateUnit}>
                            {t('inventory.storage.newUnit')}
                        </Button>
                        <TextField
                            select
                            size="small"
                            label={t('inventory.storage.area')}
                            value={selectedArea}
                            onChange={(event) => setSelectedArea(event.target.value)}
                            sx={{ minWidth: 180 }}
                        >
                            <MenuItem value="all">{t('inventory.storage.allAreas')}</MenuItem>
                            {areaOptions.map(area => (
                                <MenuItem key={area.value} value={area.value}>{area.label}</MenuItem>
                            ))}
                        </TextField>
                        <StorageStat value={visibleUnits.length} label={t('inventory.storage.units')} />
                        <StorageStat value={`${storedCount}/${totalSlots}`} label={t('inventory.storage.placed')} />
                        <StorageStat value={freeSlots} label={t('inventory.storage.free')} />
                        <Chip color={notStored.length ? 'warning' : 'success'} label={t('inventory.storage.notStoredCount', { count: notStored.length })} />
                        <Box sx={{ flexGrow: 1 }} />
                        <Tooltip title={t('common.refresh')}>
                            <span>
                                <IconButton
                                    color="primary"
                                    onClick={handleManualRefresh}
                                    disabled={isRefreshing}
                                    sx={{
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        bgcolor: 'background.paper',
                                    }}
                                >
                                    <RefreshCw size={18} style={{ animation: isRefreshing ? 'spin 0.9s linear infinite' : undefined }} />
                                </IconButton>
                            </span>
                        </Tooltip>
                        <Button variant="outlined" startIcon={<Boxes size={16} />} onClick={autoPlace}>
                            {t('inventory.storage.autoPlace')}
                        </Button>
                    </CardContent>
                </Card>

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(320px, 1fr))' }, gap: 2 }}>
                    {visibleUnits.map(unit => (
                        <StorageUnitCard
                            key={unit.id}
                            unit={unit}
                            occupiedSlots={occupiedSlots}
                            selectedFilamentId={selectedFilamentId}
                            targetSlot={targetSlot}
                            draggingFilamentId={draggingFilamentId}
                            onSlotClick={assignToSlot}
                            onDragFilament={(filamentId) => {
                                setDraggingFilamentId(filamentId);
                                if (!filamentId) setUnstoreTargetActive(false);
                            }}
                            onDelete={deleteUnit}
                            onEdit={openEditUnit}
                            onToggleFavorite={toggleUnitFavorite}
                            onOpenTag={setTagUnit}
                            canDelete={units.length > 1}
                        />
                    ))}
                    {visibleUnits.length === 0 && (
                        <Alert severity="info">{t('inventory.storage.noUnitInArea')}</Alert>
                    )}
                </Box>
            </Box>

            <Card
                variant="outlined"
                onDragOver={(event) => {
                    if (draggingFilamentId && placements[draggingFilamentId]) {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = 'move';
                        setUnstoreTargetActive(true);
                    }
                }}
                onDragLeave={() => setUnstoreTargetActive(false)}
                onDrop={(event) => {
                    event.preventDefault();
                    const filamentId = Number(event.dataTransfer.getData('text/plain') || draggingFilamentId);
                    if (filamentId && placements[filamentId]) {
                        removePlacement(filamentId);
                    }
                    setUnstoreTargetActive(false);
                }}
                sx={{
                    borderRadius: 2,
                    position: { xl: 'sticky' },
                    top: { xl: 88 },
                    borderColor: isUnstoreTargetActive ? 'warning.main' : targetSlot ? 'primary.main' : 'divider',
                    bgcolor: isUnstoreTargetActive ? 'rgba(255, 152, 0, 0.08)' : targetSlot ? 'rgba(22, 97, 175, 0.06)' : 'background.paper',
                    transition: 'background-color 120ms ease, border-color 120ms ease',
                }}
            >
                <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <PackageOpen size={18} />
                        <Typography variant="h6" fontWeight={800}>{t('inventory.storage.toStore')}</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                        {targetSlot
                            ? t('inventory.storage.chooseForSlot', { slot: targetSlotLabel || getSlotLabel(targetSlot.level, targetSlot.slot), defaultValue: `Choisis une bobine pour ${targetSlotLabel || getSlotLabel(targetSlot.level, targetSlot.slot)}.` })
                            : draggingFilamentId && placements[draggingFilamentId]
                                ? t('inventory.storage.dropToUnstore')
                                : t('inventory.storage.toStoreHelp')}
                    </Typography>
                    {targetSlot && (
                        <Chip
                            size="small"
                            color="primary"
                            variant="outlined"
                            onDelete={() => setTargetSlot(null)}
                            label={targetSlotLabel || getSlotLabel(targetSlot.level, targetSlot.slot)}
                            sx={{ mb: 1.5 }}
                        />
                    )}
                    <TextField
                        size="small"
                        fullWidth
                        value={unstoredSearch}
                        onChange={(event) => setUnstoredSearch(event.target.value)}
                        placeholder={t('inventory.storage.searchUnstored')}
                        sx={{ mb: 1.5 }}
                    />
                    <Stack spacing={1.25} divider={<Divider flexItem />}>
                        {filteredNotStored.slice(0, 12).map(filament => (
                            <Box
                                key={filament.id}
                                draggable
                                onDragStart={(event) => {
                                    event.dataTransfer.effectAllowed = 'move';
                                    event.dataTransfer.setData('text/plain', String(filament.id));
                                    setSpoolDragImage(event, filament);
                                    setDraggingFilamentId(filament.id);
                                }}
                                onDragEnd={() => {
                                    setDraggingFilamentId(null);
                                    setUnstoreTargetActive(false);
                                }}
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1,
                                    opacity: draggingFilamentId === filament.id ? 0.5 : 1,
                                    cursor: 'grab',
                                    '&:active': { cursor: 'grabbing' },
                                }}
                            >
                                <ColorIndicator colors={getSafeColors(filament)} size={30} />
                                <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                                    <Typography variant="body2" fontWeight={700} noWrap title={getFilamentTitle(filament)}>
                                        {getFilamentTitle(filament)}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {t('inventory.storage.remaining', { weight: Math.round(filament.weightRemaining || 0) })}
                                    </Typography>
                                </Box>
                                <Button
                                    size="small"
                                    variant={targetSlot || selectedFilamentId === filament.id ? 'contained' : 'outlined'}
                                    color={selectedFilamentId === filament.id && !targetSlot ? 'warning' : 'primary'}
                                    onClick={() => {
                                        if (targetSlot) {
                                            placeFilamentInSlot(filament.id, targetSlot.unitId, targetSlot.level, targetSlot.slot);
                                            return;
                                        }
                                        setSelectedFilamentId(prev => prev === filament.id ? null : filament.id);
                                    }}
                                >
                                    {targetSlot ? t('inventory.storage.choose', 'Choisir') : selectedFilamentId === filament.id ? t('common.cancel') : t('inventory.storage.place')}
                                </Button>
                            </Box>
                        ))}
                        {notStored.length === 0 && (
                            <Typography variant="body2" color="text.secondary">{t('inventory.storage.allPlaced')}</Typography>
                        )}
                        {notStored.length > 0 && filteredNotStored.length === 0 && (
                            <Typography variant="body2" color="text.secondary">{t('inventory.storage.noUnstoredMatch')}</Typography>
                        )}
                        {filteredNotStored.length > 12 && (
                            <Typography variant="caption" color="text.secondary">
                                {t('inventory.storage.moreHidden', { count: filteredNotStored.length - 12 })}
                            </Typography>
                        )}
                    </Stack>
                </CardContent>
            </Card>

            <Dialog open={isUnitDialogOpen} onClose={() => setUnitDialogOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {editingUnitId ? t('inventory.storage.editUnit') : t('inventory.storage.newUnit')}
                    <IconButton onClick={() => setUnitDialogOpen(false)}><X size={18} /></IconButton>
                </DialogTitle>
                <DialogContent>
                    <TextField
                        label={t('common.name')}
                        value={draftUnit.name}
                        onChange={(event) => setDraftUnit(prev => ({ ...prev, name: event.target.value }))}
                        fullWidth
                        sx={{ mt: 1, mb: 2 }}
                    />
                    <TextField
                        select
                        label={t('inventory.storage.storageType')}
                        value={draftUnit.kind}
                        onChange={(event) => setDraftUnit(prev => ({ ...prev, kind: event.target.value as StorageUnitKind }))}
                        fullWidth
                        sx={{ mb: 2 }}
                    >
                        {storageKinds.map(kind => (
                            <MenuItem key={kind} value={kind}>{t(`inventory.storage.kind.${kind}`)}</MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        label={t('inventory.storage.location')}
                        placeholder={t('inventory.storage.locationPlaceholder')}
                        value={draftUnit.location || ''}
                        onChange={(event) => setDraftUnit(prev => ({ ...prev, location: event.target.value }))}
                        fullWidth
                        sx={{ mb: 2 }}
                    />
                    <Stack spacing={1} sx={{ mb: 2 }}>
                        {presets.map(preset => (
                            <Button
                                key={preset.id}
                                variant={draftUnit.levels === preset.levels && draftUnit.slotsPerLevel === preset.slotsPerLevel ? 'contained' : 'outlined'}
                                onClick={() => setDraftUnit(prev => ({ ...prev, levels: preset.levels, slotsPerLevel: preset.slotsPerLevel }))}
                                sx={{ justifyContent: 'space-between' }}
                            >
                                <span>{t(`inventory.storage.preset.${preset.id}`)}</span>
                                <span>{t('inventory.storage.capacitySlots', { count: preset.levels * preset.slotsPerLevel })}</span>
                            </Button>
                        ))}
                    </Stack>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                        <TextField
                            label={t('inventory.storage.levels')}
                            type="number"
                            value={draftUnit.levels}
                            onChange={(event) => setDraftUnit(prev => ({ ...prev, levels: Number(event.target.value) }))}
                        />
                        <TextField
                            label={t('inventory.storage.slotsPerLevel')}
                            type="number"
                            value={draftUnit.slotsPerLevel}
                            onChange={(event) => setDraftUnit(prev => ({ ...prev, slotsPerLevel: Number(event.target.value) }))}
                        />
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 3, pt: 0 }}>
                    <Button variant="contained" fullWidth onClick={saveUnit}>
                        {editingUnitId ? t('common.save') : t('common.create')}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={Boolean(activeFilament)} onClose={() => setActiveFilament(null)} maxWidth="xs" fullWidth>
                {activeFilament && (
                    <>
                        <DialogTitle>{getFilamentTitle(activeFilament)}</DialogTitle>
                        <DialogContent>
                            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 1.5 }}>
                                <ColorIndicator colors={getSafeColors(activeFilament)} size={42} />
                                <Box sx={{ minWidth: 0 }}>
                                    <Typography fontWeight={800}>{activeFilament.brand?.name || t('inventory.storage.unknownBrand')}</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {Math.round(activeFilament.weightRemaining || 0)}g / {Math.round(activeFilament.weightInitial || 0)}g
                                    </Typography>
                                    {activeFilament.weightInitial > 0 && (
                                        <Box sx={{ mt: 0.75, width: 150, maxWidth: '100%', height: 6, borderRadius: 999, bgcolor: 'action.hover', overflow: 'hidden' }}>
                                            <Box
                                                sx={{
                                                    width: `${Math.max(0, Math.min(100, ((activeFilament.weightRemaining || 0) / activeFilament.weightInitial) * 100))}%`,
                                                    height: '100%',
                                                    bgcolor: 'primary.main',
                                                }}
                                            />
                                        </Box>
                                    )}
                                </Box>
                            </Box>

                            <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mb: 2 }}>
                                <Chip
                                    size="small"
                                    icon={<BoxIcon size={14} />}
                                    label={getStorageLocationLabel(activeFilament, units, placements) || t('inventory.storage.notStored')}
                                />
                                {activeFilament.spoolReference && <Chip size="small" label={`Ref: ${activeFilament.spoolReference}`} />}
                                {activeFilament.colorName && <Chip size="small" label={activeFilament.colorName} />}
                            </Stack>

                            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                                <InfoTile label={t('inventory.material')} value={activeFilament.material?.name || '-'} />
                                <InfoTile label={t('inventory.type')} value={activeFilament.type?.name || activeFilament.types?.map(type => type.name).join(', ') || '-'} />
                                <InfoTile label={t('inventory.nozzleTemp', 'Nozzle')} value={formatRange(activeFilament.nozzleTempMin, activeFilament.nozzleTempMax, '°C') || '-'} />
                                <InfoTile label={t('inventory.bedTemp', 'Bed')} value={formatRange(activeFilament.bedTempMin, activeFilament.bedTempMax ?? activeFilament.bedTemp, '°C') || '-'} />
                                <InfoTile label={t('inventory.dryTemp', 'Drying')} value={activeFilament.dryTemp ? `${Math.round(activeFilament.dryTemp)}°C${activeFilament.dryTime ? ` / ${activeFilament.dryTime}h` : ''}` : '-'} />
                                <InfoTile label={t('inventory.speed', 'Speed')} value={formatRange(activeFilament.printSpeedMin, activeFilament.printSpeedMax, ' mm/s') || '-'} />
                                {(cleanTextValue(activeFilament.vendor) || formatPrice(activeFilament.price)) && (
                                    <InfoTile label={t('inventory.vendor', 'Vendor')} value={[cleanTextValue(activeFilament.vendor), formatPrice(activeFilament.price)].filter(Boolean).join(' · ') || '-'} />
                                )}
                                {activeFilament.updatedAt && (
                                    <InfoTile label={t('common.updated', 'Updated')} value={new Date(activeFilament.updatedAt).toLocaleDateString()} />
                                )}
                            </Box>
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={() => onLogConsumption(activeFilament)}>{t('inventory.logConsumption')}</Button>
                            <Button onClick={() => onEdit(activeFilament)}>{t('common.edit')}</Button>
                            <Button color="warning" onClick={() => { removePlacement(activeFilament.id); setActiveFilament(null); }}>
                                {t('inventory.storage.unstore')}
                            </Button>
                        </DialogActions>
                    </>
                )}
            </Dialog>

            <Dialog open={Boolean(tagUnit)} onClose={() => setTagUnit(null)} maxWidth="xs" fullWidth>
                {tagUnit && (
                    <>
                        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            {t('inventory.storage.tagTitle')}
                            <IconButton onClick={() => setTagUnit(null)}><X size={18} /></IconButton>
                        </DialogTitle>
                        <DialogContent>
                            <Box
                                sx={{
                                    border: '1px dashed',
                                    borderColor: 'divider',
                                    borderRadius: 2,
                                    p: 2,
                                    textAlign: 'center',
                                    bgcolor: 'background.paper',
                                }}
                            >
                                <Typography fontWeight={900}>{tagUnit.name}</Typography>
                                {tagUnit.location && (
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                        {tagUnit.location}
                                    </Typography>
                                )}
                                <Box id={`storage-tag-qr-${tagUnit.id}`} sx={{ display: 'inline-flex', p: 1.5, bgcolor: '#fff', borderRadius: 1.5, my: 1 }}>
                                    <QRCodeSVG value={getUnitTagPayload(tagUnit, organizationId)} size={164} level="M" includeMargin={false} />
                                </Box>
                                <Typography variant="caption" color="text.secondary" display="block">
                                    {t('inventory.storage.qrHelp')}
                                </Typography>
                            </Box>

                            <Box sx={{ mt: 2 }}>
                                <Typography variant="caption" color="text.secondary" fontWeight={800}>
                                    {t('inventory.storage.nfcValue')}
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.75 }}>
                                    <TextField
                                        value={getUnitTagPayload(tagUnit, organizationId)}
                                        size="small"
                                        fullWidth
                                        multiline
                                        minRows={2}
                                        InputProps={{ readOnly: true }}
                                    />
                                    <Tooltip title={t('inventory.storage.copyTag')}>
                                        <IconButton onClick={() => navigator.clipboard?.writeText(getUnitTagPayload(tagUnit, organizationId))}>
                                            <Copy size={18} />
                                        </IconButton>
                                    </Tooltip>
                                </Box>
                                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.75 }}>
                                    {t('inventory.storage.nfcHelp')}
                                </Typography>
                            </Box>
                        </DialogContent>
                        <DialogActions sx={{ px: 3, pb: 3 }}>
                            <Button startIcon={<Printer size={16} />} variant="contained" fullWidth onClick={() => printUnitTag(tagUnit)}>
                                {t('inventory.storage.printTag')}
                            </Button>
                        </DialogActions>
                    </>
                )}
            </Dialog>
        </Box>
    );
}

function InfoTile({ label, value }: { label: string; value: string }) {
    return (
        <Box sx={{ borderRadius: 1.5, bgcolor: 'action.hover', px: 1.25, py: 0.85, minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary" textTransform="uppercase" fontWeight={800}>
                {label}
            </Typography>
            <Typography variant="body2" fontWeight={800} noWrap title={value}>
                {value}
            </Typography>
        </Box>
    );
}

function StorageStat({ value, label }: { value: number | string; label: string }) {
    return (
        <Box sx={{ px: 1.5, py: 0.75, minWidth: 74, borderRadius: 1.5, bgcolor: 'action.hover' }}>
            <Typography fontWeight={900} lineHeight={1}>{value}</Typography>
            <Typography variant="caption" color="text.secondary" textTransform="uppercase">{label}</Typography>
        </Box>
    );
}

function StorageUnitCard({
    unit,
    occupiedSlots,
    selectedFilamentId,
    targetSlot,
    draggingFilamentId,
    onSlotClick,
    onDragFilament,
    onDelete,
    onEdit,
    onToggleFavorite,
    onOpenTag,
    canDelete,
}: {
    unit: StorageUnit;
    occupiedSlots: Map<string, Filament>;
    selectedFilamentId: number | null;
    targetSlot: Placement | null;
    draggingFilamentId: number | null;
    onSlotClick: (unitId: number, level: number, slot: number, filamentId?: number) => void;
    onDragFilament: (filamentId: number | null) => void;
    onDelete: (unitId: number) => void;
    onEdit: (unit: StorageUnit) => void;
    onToggleFavorite: (unit: StorageUnit) => void;
    onOpenTag: (unit: StorageUnit) => void;
    canDelete: boolean;
}) {
    const { t } = useTranslation();
    const stored = Array.from(occupiedSlots.keys()).filter(key => key.startsWith(`${unit.id}:`)).length;
    const Icon = unit.kind === 'cabinet' ? Archive : unit.kind === 'bin' ? Boxes : unit.kind === 'display' ? PackageOpen : Rows3;

    return (
        <Card
            variant="outlined"
            sx={{
                borderRadius: 2,
                overflow: 'hidden',
                bgcolor: 'background.paper',
                borderColor: unit.favorite ? 'rgba(245,179,1,0.35)' : unit.kind === 'display' ? 'rgba(22,97,175,0.24)' : 'divider',
                boxShadow: unit.favorite ? '0 10px 28px rgba(245,179,1,0.08)' : '0 10px 28px rgba(15,23,42,0.06)',
            }}
        >
            <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Icon size={19} />
                    <Box sx={{ minWidth: 0 }}>
                        <Typography fontWeight={900} noWrap>{unit.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                            {t(`inventory.storage.kind.${unit.kind}`)} · {stored}/{unit.levels * unit.slotsPerLevel}
                        </Typography>
                        {unit.location && (
                            <Typography variant="caption" color="text.secondary" display="block" noWrap title={unit.location}>
                                {unit.location}
                            </Typography>
                        )}
                    </Box>
                    <Box sx={{ flexGrow: 1 }} />
                    <Tooltip title={unit.favorite ? t('inventory.storage.removeFavorite', 'Retirer des favoris') : t('inventory.storage.addFavorite', 'Ajouter aux favoris')}>
                        <IconButton
                            size="small"
                            onClick={() => onToggleFavorite(unit)}
                            sx={{ color: unit.favorite ? '#f5b301' : 'text.disabled' }}
                        >
                            <Star size={16} fill={unit.favorite ? 'currentColor' : 'none'} />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title={t('inventory.storage.editUnit')}>
                        <IconButton size="small" onClick={() => onEdit(unit)}>
                            <Edit2 size={16} />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title={t('inventory.storage.openTag')}>
                        <IconButton size="small" onClick={() => onOpenTag(unit)}>
                            <QrCode size={16} />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title={t('inventory.storage.deleteUnit')}>
                        <span>
                            <IconButton size="small" color="error" onClick={() => onDelete(unit.id)} disabled={!canDelete}>
                                <Trash2 size={16} />
                            </IconButton>
                        </span>
                    </Tooltip>
                </Box>

                <Box
                    sx={{
                        position: 'relative',
                        p: unit.kind === 'bin' ? 1.4 : unit.kind === 'display' ? 2.3 : unit.kind === 'cabinet' ? 1.8 : 1.6,
                        borderRadius: unit.kind === 'bin' ? 2.5 : 3,
                        bgcolor: '#f4f7fa',
                        background: unit.kind === 'display'
                            ? 'linear-gradient(180deg, #fbfdff 0%, #eef4fa 58%, #dfe8f1 100%)'
                            : unit.kind === 'bin'
                                ? 'linear-gradient(180deg, #f8fafc 0%, #edf1f5 100%)'
                                : 'linear-gradient(180deg, #fbfcfd 0%, #f0f3f7 100%)',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.95), inset 0 -18px 28px rgba(100,116,139,0.10)',
                        overflow: 'hidden',
                    }}
                >
                    <StorageFrame unit={unit} />
                    <Box sx={{
                        position: 'relative',
                        zIndex: 1,
                        pt: unit.kind === 'display' ? 0.6 : unit.kind === 'bin' ? 0.2 : 0.4,
                        pb: unit.kind === 'display' ? 0.8 : unit.kind === 'bin' ? 0.1 : 0.4,
                    }}>
                        {Array.from({ length: unit.levels }).map((_, level) => (
                            <ShelfRow
                                key={level}
                                unit={unit}
                                level={level}
                                occupiedSlots={occupiedSlots}
                                selectedFilamentId={selectedFilamentId}
                                targetSlot={targetSlot}
                                draggingFilamentId={draggingFilamentId}
                                onSlotClick={onSlotClick}
                                onDragFilament={onDragFilament}
                            />
                        ))}
                    </Box>
                </Box>
            </CardContent>
        </Card>
    );
}

function StorageFrame({ unit }: { unit: StorageUnit }) {
    const railYs = Array.from({ length: unit.levels }, (_, index) => 34 + ((index + 1) * 232) / Math.max(unit.levels, 1));
    const idPrefix = `storage-frame-${unit.id}`;

    return (
        <Box
            component="svg"
            viewBox="0 0 600 320"
            preserveAspectRatio="none"
            sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }}
        >
            <defs>
                <linearGradient id={`${idPrefix}-plastic`} x1="0" x2="1" y1="0" y2="1">
                    <stop offset="0%" stopColor="#f8fafc" />
                    <stop offset="52%" stopColor="#dfe6ee" />
                    <stop offset="100%" stopColor="#bfc9d5" />
                </linearGradient>
                <linearGradient id={`${idPrefix}-edge`} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#f9fbfd" />
                    <stop offset="100%" stopColor="#aebac8" />
                </linearGradient>
                <linearGradient id={`${idPrefix}-shadow`} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#c7d1dc" />
                    <stop offset="100%" stopColor="#94a3b3" />
                </linearGradient>
            </defs>

            {unit.kind === 'display' && (
                <>
                    <path d="M88 54 H520 L558 286 H42 Z" fill={`url(#${idPrefix}-plastic)`} opacity="0.52" />
                    <path d="M88 54 L42 286 H72 L118 54 Z" fill="#d3dbe5" opacity="0.74" />
                    <path d="M520 54 L558 286 H528 L490 54 Z" fill="#c3cdd8" opacity="0.68" />
                    {railYs.map((y, index) => (
                        <g key={index}>
                            <path d={`M${74 - index * 5} ${y - 5} H${532 + index * 5} Q${548 + index * 3} ${y - 5} ${552 + index * 3} ${y + 8} L${548 + index * 3} ${y + 16} H${66 - index * 5} Q${52 - index * 2} ${y + 16} ${58 - index * 2} ${y + 2} Z`} fill={`url(#${idPrefix}-edge)`} />
                            <path d={`M${76 - index * 5} ${y + 12} H${544 + index * 3}`} stroke="#9aa8b7" strokeWidth="5" strokeLinecap="round" opacity="0.38" />
                            <path d={`M${86 - index * 4} ${y - 5} H${520 + index * 4}`} stroke="#ffffff" strokeWidth="4" strokeLinecap="round" opacity="0.5" />
                        </g>
                    ))}
                    <path d="M42 286 H558 L574 306 H26 Z" fill="#b3bfcd" opacity="0.56" />
                    <path d="M88 54 H520 L558 286 H42 Z" fill="none" stroke="#a9b6c5" strokeWidth="5" opacity="0.28" />
                    <path d="M118 72 L78 266" stroke="#ffffff" strokeWidth="8" opacity="0.18" />
                    <path d="M490 72 L528 266" stroke="#ffffff" strokeWidth="8" opacity="0.14" />
                </>
            )}

            {unit.kind === 'shelf' && (
                <>
                    <rect x="36" y="22" width="528" height="274" rx="28" fill="#eef2f6" opacity="0.46" />
                    <rect x="42" y="26" width="24" height="270" rx="12" fill={`url(#${idPrefix}-shadow)`} />
                    <rect x="534" y="26" width="24" height="270" rx="12" fill={`url(#${idPrefix}-shadow)`} />
                    <rect x="76" y="30" width="14" height="260" rx="7" fill="#d7dee7" opacity="0.9" />
                    <rect x="510" y="30" width="14" height="260" rx="7" fill="#d7dee7" opacity="0.9" />
                    {railYs.map((y, index) => (
                        <g key={index}>
                            <rect x="48" y={y - 7} width="504" height="18" rx="9" fill={`url(#${idPrefix}-edge)`} />
                            <rect x="58" y={y + 8} width="484" height="9" rx="5" fill="#9eacbb" opacity="0.55" />
                            <rect x="66" y={y - 7} width="468" height="4" rx="2" fill="#ffffff" opacity="0.48" />
                        </g>
                    ))}
                    <rect x="36" y="292" width="528" height="14" rx="7" fill="#aebac8" opacity="0.7" />
                </>
            )}

            {unit.kind === 'cabinet' && (
                <>
                    <rect x="22" y="16" width="556" height="288" rx="26" fill={`url(#${idPrefix}-plastic)`} opacity="0.88" />
                    <rect x="38" y="34" width="524" height="250" rx="18" fill="#f8fafc" opacity="0.62" />
                    <rect x="38" y="34" width="524" height="250" rx="18" fill="none" stroke="#c4ceda" strokeWidth="5" opacity="0.86" />
                    {railYs.map((y, index) => (
                        <g key={index}>
                            <rect x="50" y={y - 18} width="500" height="40" rx="13" fill="#edf2f7" opacity="0.78" />
                            <rect x="58" y={y + 14} width="484" height="8" rx="4" fill="#b4bfcc" opacity="0.62" />
                            {index < unit.levels - 1 && <path d={`M52 ${y + 30} H548`} stroke="#d6dee8" strokeWidth="3" opacity="0.85" />}
                        </g>
                    ))}
                    <rect x="22" y="286" width="556" height="18" rx="9" fill="#aebac8" opacity="0.55" />
                </>
            )}

            {unit.kind === 'bin' && (
                <>
                    <path d="M42 72 H558 L534 270 H66 Z" fill={`url(#${idPrefix}-plastic)`} opacity="0.78" />
                    <path d="M42 72 H558 L544 114 H56 Z" fill="#f8fafc" opacity="0.7" />
                    <path d="M54 86 H546" stroke="#c1cbd7" strokeWidth="20" strokeLinecap="round" opacity="0.72" />
                    <path d="M66 270 H534 L558 302 H42 Z" fill="#aab6c5" opacity="0.58" />
                    <path d="M42 72 H558 L534 270 H66 Z" fill="none" stroke="#b7c2cf" strokeWidth="6" opacity="0.72" />
                    {railYs.map((y, index) => (
                        <path key={index} d={`M72 ${Math.min(y + 8, 250)} H528`} stroke="#d6dee8" strokeWidth="4" strokeLinecap="round" opacity={index % 2 === 0 ? 0.72 : 0.45} />
                    ))}
                </>
            )}
        </Box>
    );
}

function ShelfRow({
    unit,
    level,
    occupiedSlots,
    selectedFilamentId,
    targetSlot,
    draggingFilamentId,
    onSlotClick,
    onDragFilament,
}: {
    unit: StorageUnit;
    level: number;
    occupiedSlots: Map<string, Filament>;
    selectedFilamentId: number | null;
    targetSlot: Placement | null;
    draggingFilamentId: number | null;
    onSlotClick: (unitId: number, level: number, slot: number, filamentId?: number) => void;
    onDragFilament: (filamentId: number | null) => void;
}) {
    const [hoveredDropSlot, setHoveredDropSlot] = useState<string | null>(null);

    return (
        <Box sx={{ mb: level === unit.levels - 1 ? 0 : 1.1 }}>
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${unit.slotsPerLevel}, minmax(26px, 1fr))`,
                    gap: 0.75,
                    alignItems: 'end',
                    px: unit.kind === 'bin' ? 0.8 : unit.kind === 'display' ? 2.4 : unit.kind === 'cabinet' ? 1.2 : 1.6,
                    transform: unit.kind === 'display' ? `translateX(${(unit.levels - level - 1) * 10}px)` : 'none',
                    maxWidth: unit.kind === 'display' ? `calc(100% - ${(unit.levels - level - 1) * 10}px)` : 'none',
                }}
            >
                {Array.from({ length: unit.slotsPerLevel }).map((_, slot) => {
                    const label = getSlotLabel(level, slot);
                    const slotKey = makeSlotKey(unit.id, level, slot);
                    const filament = occupiedSlots.get(makeSlotKey(unit.id, level, slot));
                    const colors = filament ? getSafeColors(filament) : [];
                    const canClickPlace = !filament && Boolean(selectedFilamentId);
                    const isDropHover = hoveredDropSlot === slotKey && !filament && Boolean(draggingFilamentId);
                    const isTargetSlot = !filament && targetSlot?.unitId === unit.id && targetSlot.level === level && targetSlot.slot === slot;
                    return (
                        <Tooltip key={slot} title={filament ? `${label} - ${getFilamentTitle(filament)}` : label}>
                            <Box
                                draggable={Boolean(filament)}
                                onDragStart={(event) => {
                                    if (!filament) return;
                                    event.dataTransfer.effectAllowed = 'move';
                                    event.dataTransfer.setData('text/plain', String(filament.id));
                                    setSpoolDragImage(event, filament);
                                    onDragFilament(filament.id);
                                }}
                                onDragEnd={() => {
                                    setHoveredDropSlot(null);
                                    onDragFilament(null);
                                }}
                                onClick={() => onSlotClick(unit.id, level, slot)}
                                onDragOver={(event) => {
                                    if (!filament) {
                                        event.preventDefault();
                                        event.dataTransfer.dropEffect = 'move';
                                        setHoveredDropSlot(slotKey);
                                    }
                                }}
                                onDragLeave={() => setHoveredDropSlot(prev => prev === slotKey ? null : prev)}
                                onDrop={(event) => {
                                    event.preventDefault();
                                    setHoveredDropSlot(null);
                                    if (filament) return;
                                    const rawFilamentId = event.dataTransfer.getData('text/plain');
                                    const filamentId = Number(rawFilamentId);
                                    if (filamentId) {
                                        onSlotClick(unit.id, level, slot, filamentId);
                                    }
                                }}
                                sx={{
                                    height: unit.kind === 'bin' ? 34 : unit.kind === 'display' ? 42 : unit.kind === 'cabinet' ? 44 : 48,
                                    borderRadius: unit.kind === 'bin' ? '8px 8px 10px 10px' : unit.kind === 'display' ? '14px 14px 8px 8px' : unit.kind === 'cabinet' ? '10px' : '14px 14px 7px 7px',
                                    border: '1px solid',
                                    borderColor: filament ? 'transparent' : isDropHover || canClickPlace || isTargetSlot ? 'primary.main' : 'rgba(148,163,184,0.38)',
                                    bgcolor: filament ? colors[0] : '#eef3f7',
                                    background: !filament && unit.kind === 'display'
                                        ? 'linear-gradient(180deg, #f9fbfd 0%, #e8eef5 70%, #d2dce7 100%)'
                                        : !filament && unit.kind === 'cabinet'
                                            ? 'linear-gradient(180deg, #f9fbfd 0%, #e5ebf2 100%)'
                                            : !filament && unit.kind === 'bin'
                                                ? 'linear-gradient(180deg, #f4f7fa 0%, #e3e9ef 100%)'
                                                : !filament
                                                    ? 'linear-gradient(180deg, #f8fafc 0%, #e7edf3 100%)'
                                                    : undefined,
                                    '&::before': !filament ? {
                                        content: '""',
                                        position: 'absolute',
                                        left: 7,
                                        right: 7,
                                        top: 5,
                                        height: 5,
                                        borderRadius: 999,
                                        background: 'rgba(255,255,255,0.72)',
                                    } : undefined,
                                    '&::after': !filament && (unit.kind === 'cabinet' || unit.kind === 'display') ? {
                                        content: '""',
                                        position: 'absolute',
                                        left: unit.kind === 'display' ? 8 : 10,
                                        right: unit.kind === 'display' ? 8 : 10,
                                        bottom: 6,
                                        height: unit.kind === 'display' ? 5 : 4,
                                        borderRadius: 999,
                                        background: 'rgba(148,163,184,0.26)',
                                    } : undefined,
                                    backgroundImage: colors.length > 1 ? `linear-gradient(135deg, ${colors.join(', ')})` : undefined,
                                    cursor: filament || selectedFilamentId || draggingFilamentId ? 'pointer' : 'default',
                                    position: 'relative',
                                    overflow: 'hidden',
                                    boxShadow: filament
                                        ? unit.kind === 'display'
                                            ? 'inset 0 -10px 0 rgba(0,0,0,0.18), 0 8px 14px rgba(15,23,42,0.18)'
                                            : 'inset 0 -8px 0 rgba(0,0,0,0.16), 0 3px 8px rgba(15,23,42,0.10)'
                                        : isDropHover || isTargetSlot
                                            ? 'inset 0 0 0 2px rgba(22,97,175,0.26), 0 8px 16px rgba(22,97,175,0.12)'
                                            : canClickPlace
                                                ? 'inset 0 0 0 2px rgba(22,97,175,0.16), 0 0 0 3px rgba(22,97,175,0.05)'
                                                : unit.kind === 'display'
                                                    ? 'inset 0 -6px 0 rgba(100,116,139,0.10), inset 0 0 0 1px rgba(255,255,255,0.72), 0 3px 7px rgba(15,23,42,0.07)'
                                                    : 'inset 0 -6px 0 rgba(100,116,139,0.08), inset 0 0 0 1px rgba(255,255,255,0.74)',
                                    transition: 'transform 120ms ease, border-color 120ms ease, box-shadow 120ms ease',
                                    '&:hover': {
                                        transform: filament || selectedFilamentId ? 'translateY(-2px)' : 'none',
                                        borderColor: 'primary.main',
                                    },
                                }}
                            >
                                {filament && (
                                    <Check size={12} style={{ position: 'absolute', right: 5, bottom: 4, color: '#fff', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.45))' }} />
                                )}
                            </Box>
                        </Tooltip>
                    );
                })}
            </Box>
            {unit.kind !== 'bin' && (
                <Box
                    sx={{
                        mx: unit.kind === 'display' ? 1.8 : unit.kind === 'cabinet' ? 1 : 1.35,
                        height: unit.kind === 'display' ? 10 : unit.kind === 'cabinet' ? 8 : 9,
                        borderRadius: unit.kind === 'display' ? '6px 6px 12px 12px' : 1.5,
                        bgcolor: unit.kind === 'display' ? '#c0cad6' : '#c7d0db',
                        background: unit.kind === 'display'
                            ? 'linear-gradient(180deg, #eef2f7 0%, #c1ccd8 76%, #a3afbf 100%)'
                            : 'linear-gradient(180deg, #edf2f7 0%, #c5ced9 100%)',
                        boxShadow: unit.kind === 'display'
                            ? '0 5px 10px rgba(15,23,42,0.10), inset 0 -2px 0 rgba(100,116,139,0.18)'
                            : '0 4px 8px rgba(15,23,42,0.08), inset 0 -2px 0 rgba(100,116,139,0.16)',
                        transform: unit.kind === 'display' ? `translateX(${(unit.levels - level - 1) * 10}px)` : 'none',
                        maxWidth: unit.kind === 'display' ? `calc(100% - ${(unit.levels - level - 1) * 10}px)` : 'none',
                    }}
                />
            )}
        </Box>
    );
}
