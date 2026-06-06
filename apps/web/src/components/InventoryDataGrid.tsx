import { useState, useMemo } from 'react';
import { DataGrid } from '@mui/x-data-grid';
import type { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { frFR } from '@mui/x-data-grid/locales';
import { Box, Typography, Chip, IconButton, Tooltip, Button, Checkbox } from '@mui/material';
import { Edit2, Trash2, Copy, PencilRuler, ChevronRight, ChevronDown, Lock, Printer as PrinterIcon, FileJson, Star } from 'lucide-react';
import ColorIndicator from './ColorIndicator';
import { getFilamentTitle, getFilamentChips, groupFilaments, checkIsLowStock } from '../utils/filament-utils';
import type { Filament } from '../api';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';

interface InventoryDataGridProps {
    filaments: Filament[];
    onEdit: (filament: Filament) => void;
    onDelete: (id: number) => void;
    onLogConsumption: (filament: Filament) => void;
    onClone: (id: number) => void;
    organization: any;
    associateTagId?: string | null;
    onAssociate?: (filament: Filament) => void;
    selectionModel?: any[];
    onSelectionChange?: (ids: any[]) => void;
    isSelectionMode?: boolean;
    onPrintLabel?: (filament: Filament) => void;
    onExportProfile?: (filament: Filament) => void;
    onToggleFavorite?: (filament: Filament) => void;
    onToggleGroupFavorite?: (filaments: Filament[]) => void;
}

interface GroupRow {
    id: string;
    isGroup: true;
    brandName: string;
    type: string;
    color: string;
    colors: string[];
    displayName: string;
    weightRemaining: number;
    weightInitial: number;
    plannedWeight: number;
    virtualWeightRemaining: number;
    favorite: boolean;
    itemsCount: number;
    children: Filament[];
}

type GridRow = Filament | GroupRow;

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

export default function InventoryDataGrid({
    filaments,
    onEdit,
    onDelete,
    onLogConsumption,
    onClone,
    organization,
    associateTagId,
    onAssociate,
    selectionModel,
    onSelectionChange,
    isSelectionMode = false,
    onPrintLabel,
    onExportProfile,
    onToggleFavorite,
    onToggleGroupFavorite,
}: InventoryDataGridProps) {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

    const toggleGroup = (groupId: string) => {
        setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
    };

    const rows = useMemo(() => {
        const groups = groupFilaments(filaments);
        const gridRows: GridRow[] = [];

        groups.forEach(group => {
            const groupId = `group-${group.key}`;
            const isExpanded = expandedGroups[groupId];

            // Parent Row
            gridRows.push({
                id: groupId,
                isGroup: true,
                brandName: group.brandName,
                type: group.type,
                color: group.color,
                colors: group.colors,
                displayName: group.displayName,
                weightRemaining: group.totalWeight,
                weightInitial: group.items.reduce((sum, i) => sum + i.weightInitial, 0),
                plannedWeight: group.items.reduce((sum, i) => sum + (i.plannedWeight || 0), 0),
                virtualWeightRemaining: group.items.reduce((sum, i) => sum + (i.virtualWeightRemaining || i.weightRemaining), 0),
                favorite: group.items.every(item => item.favorite),
                itemsCount: group.items.length,
                children: group.items
            } as GroupRow);

            // Children Rows
            if (isExpanded) {
                group.items.forEach(item => {
                    gridRows.push(item);
                });
            }
        });
        return gridRows;
    }, [filaments, expandedGroups]);

    const columns: GridColDef[] = [
        {
            field: 'expand',
            headerName: '',
            width: 40,
            sortable: false,
            renderCell: (params: GridRenderCellParams<GridRow>) => {
                if ('isGroup' in params.row) {
                    return (
                        <IconButton size="small" onClick={() => toggleGroup(params.row.id as string)}>
                            {expandedGroups[params.row.id] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </IconButton>
                    );
                }
                return null;
            }
        },
        {
            field: 'favorite',
            headerName: '',
            width: 48,
            sortable: true,
            valueGetter: (_, row) => 'isGroup' in row ? row.favorite : Boolean(row.favorite),
            renderCell: (params: GridRenderCellParams<GridRow>) => {
                const row = params.row;
                const isGroup = 'isGroup' in row;
                const favorite = isGroup ? row.favorite : Boolean((row as Filament).favorite);
                const disabled = isGroup ? !onToggleGroupFavorite : !onToggleFavorite;
                return (
                    <Tooltip title={favorite ? t('inventory.removeFavorite', 'Retirer des favoris') : t('inventory.addFavorite', 'Ajouter aux favoris')}>
                        <span>
                            <IconButton
                                size="small"
                                disabled={disabled}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    if (isGroup) {
                                        onToggleGroupFavorite?.(row.children);
                                    } else {
                                        onToggleFavorite?.(row as Filament);
                                    }
                                }}
                                sx={{ color: favorite ? '#f5b301' : 'text.disabled' }}
                            >
                                <Star size={16} fill={favorite ? 'currentColor' : 'none'} />
                            </IconButton>
                        </span>
                    </Tooltip>
                );
            }
        },
        ...(isSelectionMode ? [{
            field: 'selection',
            headerName: '',
            width: 50,
            sortable: false,
            renderCell: (params: GridRenderCellParams<GridRow>) => {
                if ('isGroup' in params.row) return null;
                const f = params.row as Filament;
                // Cast to array to safely use includes
                const selectedIds = (selectionModel || []) as any[];
                const isSelected = selectedIds.includes(f.id);
                return (
                    <Checkbox
                        checked={isSelected}
                        onChange={(e) => {
                            if (!onSelectionChange) return;
                            const id = f.id;
                            if (e.target.checked) {
                                onSelectionChange([...selectedIds, id]);
                            } else {
                                onSelectionChange(selectedIds.filter(item => item !== id));
                            }
                        }}
                        onClick={(e) => e.stopPropagation()}
                    />
                );
            }
        }] : []),
        {
            field: 'status',
            headerName: '',
            width: 50,
            align: 'center',
            renderCell: (params: GridRenderCellParams<GridRow>) => {
                if ('isGroup' in params.row) return null;
                const f = params.row as Filament;
                const isLowStock = checkIsLowStock(f, organization);
                return (
                    <Box sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: isLowStock ? 'error.main' : 'success.main',
                    }} />
                );
            }
        },
        {
            field: 'brand',
            headerName: t('inventory.brand'),
            width: 120,
            valueGetter: (_, row) => 'isGroup' in row ? row.brandName : row.brand?.name
        },
        {
            field: 'type',
            headerName: t('inventory.type'),
            width: 100,
            renderCell: (params) => {
                if ('isGroup' in params.row) {
                    return params.row.type && params.row.type !== 'Unknown' ? <Chip label={params.row.type} size="small" variant="outlined" sx={{ fontWeight: 'bold' }} /> : null;
                } else if (params.row.type) {
                    return <Chip label={params.row.type?.name} size="small" />;
                }
                return '';
            }
        },
        {
            field: 'name',
            headerName: t('common.name'),
            flex: 1,
            minWidth: 250,
            renderCell: (params) => {
                const row = params.row;
                if ('isGroup' in row) {
                    return (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <ColorIndicator colors={row.colors && row.colors.length > 0 ? row.colors : [row.color]} size={20} />
                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                                {row.displayName.replace(`${row.brandName} ${row.type}`, '').trim() || row.type}
                            </Typography>
                            <Chip label={`${row.itemsCount}`} size="small" sx={{ height: 20, minWidth: 20, bgcolor: 'action.selected' }} />
                        </Box>
                    );
                }
                return (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pl: 2 }}>
                        {/* Indentation for child */}
                        <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'text.disabled' }} />
                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                            <Typography variant="body2" noWrap>{getFilamentTitle(row).replace(`${row.brand?.name} ${row.type?.name}`, '').trim() || row.type?.name}</Typography>
                            {row.colorName && <Typography variant="caption" color="textSecondary">{row.colorName}</Typography>}
                        </Box>
                    </Box>
                );
            }
        },
        {
            field: 'weight',
            headerName: t('inventory.weight'),
            width: 180,
            align: 'right',
            headerAlign: 'right',
            renderCell: (params) => {
                const row = params.row;
                const weightRemaining = row.weightRemaining;
                const weightInitial = row.weightInitial || 1000;
                const plannedWeight = (row as any).plannedWeight || 0;
                const virtualWeightRemaining = (row as any).virtualWeightRemaining || weightRemaining;

                const percentage = Math.min(100, Math.max(0, (weightRemaining / weightInitial) * 100));
                const virtualPercentage = Math.min(100, Math.max(0, (virtualWeightRemaining / weightInitial) * 100));
                const plannedPercentage = Math.min(100, Math.max(0, (plannedWeight / weightInitial) * 100));

                return (
                    <Box sx={{ width: '100%', textAlign: 'right' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mb: 0.5, alignItems: 'baseline' }}>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                {Math.round(weightRemaining)}g
                                {plannedWeight > 0 && (
                                    <Box component="span" sx={{ fontSize: '0.75rem', color: 'text.secondary', ml: 0.5 }}>
                                        ({Math.round(virtualWeightRemaining)}g)
                                    </Box>
                                )}
                            </Typography>
                        </Box>
                        <Box sx={{
                            height: 4,
                            borderRadius: 2,
                            bgcolor: 'rgba(0,0,0,0.05)',
                            position: 'relative',
                            overflow: 'hidden',
                            width: '100%'
                        }}>
                            <Box sx={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                height: '100%',
                                width: `${percentage}%`,
                                bgcolor: percentage < 20 ? 'error.main' : 'primary.main'
                            }} />
                            {plannedWeight > 0 && (
                                <Box sx={{
                                    position: 'absolute',
                                    left: `${virtualPercentage}%`,
                                    top: 0,
                                    height: '100%',
                                    width: `${plannedPercentage}%`,
                                    bgcolor: 'rgba(255,255,255,0.4)',
                                    backgroundImage: 'linear-gradient(45deg, rgba(0,0,0,0.1) 25%, transparent 25%, transparent 50%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.1) 75%, transparent 75%, transparent)',
                                    backgroundSize: '8px 8px'
                                }} />
                            )}
                        </Box>
                    </Box>
                );
            }
        },
        {
            field: 'tags',
            headerName: 'Tags',
            width: 200,
            renderCell: (params) => {
                if ('isGroup' in params.row) return null;
                return (
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'nowrap', overflow: 'hidden', height: '100%', alignItems: 'center' }}>
                        {getFilamentChips(params.row).map((opt: any) => (
                            <Chip key={opt.id} label={opt.name} size="small" variant="outlined" sx={{ fontSize: '0.65rem', height: 20 }} />
                        ))}
                        {getStorageLocationLabel(params.row as Filament) && (
                            <Chip label={getStorageLocationLabel(params.row as Filament) || ''} size="small" color="primary" variant="outlined" sx={{ fontSize: '0.65rem', height: 20 }} />
                        )}
                        {Number(params.row.price || 0) > 0 && <Chip label={`${params.row.price}€`} size="small" color="success" variant="outlined" sx={{ fontSize: '0.65rem', height: 20 }} />}
                        {(params.row as Filament).isLocked && (
                            <Chip icon={<Lock size={12} />} label="Locked" size="small" color="error" sx={{ fontSize: '0.65rem', height: 20 }} />
                        )}
                    </Box>
                );
            }
        },
        {
            field: 'actions',
            headerName: t('common.actions'),
            width: 210,
            sortable: false,
            align: 'center',
            headerAlign: 'center',
            renderCell: (params) => {
                if ('isGroup' in params.row) return null;

                if (associateTagId && onAssociate) {
                    return (
                        <Button
                            variant="contained"
                            size="small"
                            onClick={() => onAssociate(params.row as Filament)}
                        >
                            Link
                        </Button>
                    )
                }

                const f = params.row as Filament;
                return (
                    <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end', width: '100%' }}>
                        <Tooltip title={f.isLocked ? t('common.lockedQuota') : t('inventory.logConsumption')}>
                            <span style={{ display: 'inline-block' }}>
                                <IconButton size="small" onClick={() => onLogConsumption(f)} disabled={f.isLocked} sx={{ width: 34, height: 34, color: 'text.secondary' }}>
                                    <PencilRuler size={18} />
                                </IconButton>
                            </span>
                        </Tooltip>
                        <Tooltip title={(f.isLocked || (organization?.stats && organization.stats.limits.maxSpoolsPerOrg && organization.stats.activeSpoolsCount >= organization.stats.limits.maxSpoolsPerOrg && !(user?.isSuperAdmin || ['super_admin', 'admin', 'moderator'].includes(user?.systemRole || '')))) ? t('common.quotaReached', 'Quota atteint') : t('common.clone')}>
                            <span>
                                <IconButton size="small" onClick={() => onClone(f.id as number)} disabled={f.isLocked || (organization?.stats && organization.stats.limits.maxSpoolsPerOrg && organization.stats.activeSpoolsCount >= organization.stats.limits.maxSpoolsPerOrg && !(user?.isSuperAdmin || ['super_admin', 'admin', 'moderator'].includes(user?.systemRole || '')))} sx={{ width: 34, height: 34, color: 'text.secondary' }}>
                                    <Copy size={18} />
                                </IconButton>
                            </span>
                        </Tooltip>
                        {onPrintLabel && (
                            <Tooltip title={t('common.printLabel', 'Print label')}>
                                <span>
                                    <IconButton size="small" onClick={() => onPrintLabel(f)} sx={{ width: 34, height: 34, color: 'text.secondary' }}>
                                        <PrinterIcon size={18} />
                                    </IconButton>
                                </span>
                            </Tooltip>
                        )}
                        {onExportProfile && (
                            <Tooltip title={t('common.exportProfile', 'Export profile')}>
                                <span>
                                    <IconButton size="small" onClick={() => onExportProfile(f)} sx={{ width: 34, height: 34, color: 'text.secondary' }}>
                                        <FileJson size={18} />
                                    </IconButton>
                                </span>
                            </Tooltip>
                        )}
                        <Tooltip title={f.isLocked ? t('common.lockedQuota') : t('common.edit')}>
                            <span style={{ display: 'inline-block' }}>
                                <IconButton size="small" onClick={() => onEdit(f)} disabled={f.isLocked} color="primary" sx={{ width: 38, height: 38, bgcolor: 'action.hover' }}>
                                    <Edit2 size={21} />
                                </IconButton>
                            </span>
                        </Tooltip>
                        {f.isLocked && (
                            <Tooltip title={t('common.unlock', 'Unlock')}>
                                <span style={{ display: 'inline-block' }}>
                                    <IconButton size="small" color="warning" sx={{ width: 34, height: 34 }} onClick={(e) => {
                                        e.stopPropagation();
                                        // Dispatch a custom event to trigger unlock in parent, or pass a handler
                                        // Easiest is to dispatch a custom event on the window to be caught by Inventory.tsx
                                        // or better, add an onUnlock prop to InventoryDataGridProps
                                        const event = new CustomEvent('unlock-filament', { detail: f });
                                        window.dispatchEvent(event);
                                    }}>
                                        <Lock size={18} />
                                    </IconButton>
                                </span>
                            </Tooltip>
                        )}
                        <Tooltip title={t('common.delete')}>
                            <span style={{ display: 'inline-block' }}>
                                <IconButton size="small" color="error" onClick={() => onDelete(f.id as number)} sx={{ width: 38, height: 38, bgcolor: 'rgba(211, 47, 47, 0.08)' }}>
                                    <Trash2 size={21} />
                                </IconButton>
                            </span>
                        </Tooltip>
                    </Box>
                );
            }
        }
    ];

    return (
        <Box sx={{ height: 'calc(100vh - 250px)', width: '100%', bgcolor: 'background.paper', borderRadius: 1, overflow: 'hidden' }}>
            <DataGrid
                rows={rows}
                columns={columns}
                showToolbar
                localeText={frFR.components.MuiDataGrid.defaultProps.localeText}
                initialState={{
                    pagination: { paginationModel: { pageSize: 25 } },
                }}
                pageSizeOptions={[10, 25, 50, 100]}
                disableRowSelectionOnClick
                rowHeight={52}
                getRowClassName={(params) =>
                    ('isGroup' in params.row) ? 'group-row' : ''
                }
                sx={{
                    border: 'none',
                    '& .group-row': {
                        bgcolor: 'action.hover',
                        '&:hover': {
                            bgcolor: 'action.selected',
                        },
                        '& .MuiDataGrid-cell': {
                            borderBottom: 'none'
                        }
                    },
                    '& .MuiDataGrid-cell': {
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        display: 'flex',
                        alignItems: 'center'
                    },
                    '& .MuiDataGrid-columnHeaders': {
                        bgcolor: 'background.default',
                        borderBottom: '2px solid',
                        borderColor: 'divider'
                    }
                }}
            />
        </Box>
    );
}
