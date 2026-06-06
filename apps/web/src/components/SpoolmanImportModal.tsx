import { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Stack,
    Chip,
    Checkbox,
    FormControlLabel,
    Tabs,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Switch
} from '@mui/material';
import { useTranslation } from 'react-i18next';

interface Props {
    open: boolean;
    onClose: () => void;
    onImport: (brands: string[], materials: string[], importCombinations: boolean, updates: any[]) => Promise<void>;
    missingBrands: string[];
    missingMaterials: string[];
    missingCombinations: Array<{ brandName: string; materialName: string }>;
    conflicts?: Array<{
        id: number;
        brandName: string;
        materialName: string;
        current: any;
        new: any;
    }>;
}

export default function SpoolmanImportModal({
    open,
    onClose,
    onImport,
    missingBrands,
    missingMaterials,
    missingCombinations,
    conflicts = []
}: Props) {
    const { t } = useTranslation();
    const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
    const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
    const [importCombinations, setImportCombinations] = useState(true);
    const [selectedUpdates, setSelectedUpdates] = useState<number[]>([]);
    const [tab, setTab] = useState(0);

    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        if (open) {
            setSelectedBrands(missingBrands);
            setSelectedMaterials(missingMaterials);
            setImportCombinations(true);
            setSelectedUpdates([]);
            setTab(0);
        }
    }, [open, missingBrands, missingMaterials]);

    const handleImport = async () => {
        setProcessing(true);
        try {
            // Build updates payload
            const updatesPayload = conflicts
                ? conflicts.filter(c => selectedUpdates.includes(c.id)).map(c => ({
                    id: c.id,
                    ...c.new
                }))
                : [];

            await onImport(selectedBrands, selectedMaterials, importCombinations, updatesPayload);
            onClose();
        } catch (e) {
            console.error(e);
        } finally {
            setProcessing(false);
        }
    };

    const hasUpdates = conflicts && conflicts.length > 0;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>{t('spoolman.importTitle') || "Spoolman Import"}</DialogTitle>
            <DialogContent>
                <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                    <Tabs value={tab} onChange={(_, v) => setTab(v)}>
                        <Tab label={(t('spoolman.tabNewItems') || "New Items") + ` (${missingBrands.length + missingMaterials.length + missingCombinations.length})`} />
                        <Tab label={(t('spoolman.tabUpdates') || "Updates") + ` (${conflicts?.length || 0})`} disabled={!hasUpdates} />
                    </Tabs>
                </Box>

                {tab === 0 && (
                    <Box>
                        <Stack spacing={2}>
                            {/* Brands Section */}
                            {missingBrands.length > 0 && (
                                <Box>
                                    <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 1 }}>
                                        <Typography variant="h6">{t('spoolman.missingBrands') || "Missing Brands"} ({missingBrands.length})</Typography>
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    size="small"
                                                    checked={selectedBrands.length === missingBrands.length}
                                                    indeterminate={selectedBrands.length > 0 && selectedBrands.length < missingBrands.length}
                                                    onChange={(e) => {
                                                        setSelectedBrands(e.target.checked ? missingBrands : []);
                                                    }}
                                                />
                                            }
                                            label={<Typography variant="caption">{t('selectAll') || "Select All"}</Typography>}
                                        />
                                    </Stack>
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                        {missingBrands.map(b => (
                                            <Chip
                                                key={b}
                                                label={b}
                                                color={selectedBrands.includes(b) ? "primary" : "default"}
                                                onClick={() => {
                                                    setSelectedBrands(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b]);
                                                }}
                                            />
                                        ))}
                                    </Box>
                                </Box>
                            )}

                            {/* Materials Section */}
                            {missingMaterials.length > 0 && (
                                <Box>
                                    <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 1 }}>
                                        <Typography variant="h6">{t('spoolman.missingMaterials') || "Missing Materials"} ({missingMaterials.length})</Typography>
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    size="small"
                                                    checked={selectedMaterials.length === missingMaterials.length}
                                                    indeterminate={selectedMaterials.length > 0 && selectedMaterials.length < missingMaterials.length}
                                                    onChange={(e) => {
                                                        setSelectedMaterials(e.target.checked ? missingMaterials : []);
                                                    }}
                                                />
                                            }
                                            label={<Typography variant="caption">{t('selectAll') || "Select All"}</Typography>}
                                        />
                                    </Stack>
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                        {missingMaterials.map(m => (
                                            <Chip
                                                key={m}
                                                label={m}
                                                color={selectedMaterials.includes(m) ? "secondary" : "default"}
                                                onClick={() => {
                                                    setSelectedMaterials(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
                                                }}
                                            />
                                        ))}
                                    </Box>
                                </Box>
                            )}

                            {/* Combinations Section */}
                            <Box sx={{ mt: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                                <FormControlLabel
                                    control={<Switch checked={importCombinations} onChange={e => setImportCombinations(e.target.checked)} />}
                                    label={
                                        <Box>
                                            <Typography variant="subtitle1">{t('spoolman.importCombinations') || "Import Combinations"}</Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {t('spoolman.importCombinationsDesc', { count: missingCombinations.length }) || `Import ${missingCombinations.length} missing brand/material combinations`}
                                            </Typography>
                                        </Box>
                                    }
                                />
                                {importCombinations && missingCombinations.length > 0 && (
                                    <Box sx={{ mt: 1, maxHeight: 150, overflow: 'auto' }}>
                                        {missingCombinations.map((c, i) => (
                                            <Typography key={i} variant="body2" color="text.secondary">
                                                • {c.brandName} - {c.materialName}
                                            </Typography>
                                        ))}
                                    </Box>
                                )}
                            </Box>
                        </Stack>
                    </Box>
                )}

                {tab === 1 && conflicts && (
                    <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            {t('spoolman.updatesDesc') || "The following local catalog entries differ from SpoolmanDB. Select the ones you want to update."}
                        </Typography>
                        <TableContainer component={Paper} variant="outlined">
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell padding="checkbox">
                                            <Checkbox
                                                checked={conflicts.length > 0 && selectedUpdates.length === conflicts.length}
                                                indeterminate={selectedUpdates.length > 0 && selectedUpdates.length < conflicts.length}
                                                onChange={(e) => {
                                                    if (e.target.checked) setSelectedUpdates(conflicts.map(c => c.id));
                                                    else setSelectedUpdates([]);
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell>Entry</TableCell>
                                        <TableCell>Changes</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {conflicts.map(c => {
                                        const changes = [];
                                        if (c.new.density !== undefined) changes.push({ name: 'Density', old: c.current.density, new: c.new.density });
                                        if (c.new.nozzle_min !== undefined) changes.push({ name: 'Nozzle Min', old: c.current.nozzle_min, new: c.new.nozzle_min });
                                        if (c.new.nozzle_max !== undefined) changes.push({ name: 'Nozzle Max', old: c.current.nozzle_max, new: c.new.nozzle_max });
                                        if (c.new.bed_min !== undefined) changes.push({ name: 'Bed Min', old: c.current.bed_min, new: c.new.bed_min });
                                        if (c.new.bed_max !== undefined) changes.push({ name: 'Bed Max', old: c.current.bed_max, new: c.new.bed_max });

                                        return (
                                            <TableRow key={c.id}>
                                                <TableCell padding="checkbox">
                                                    <Checkbox
                                                        checked={selectedUpdates.includes(c.id)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) setSelectedUpdates(prev => [...prev, c.id]);
                                                            else setSelectedUpdates(prev => prev.filter(id => id !== c.id));
                                                        }}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="subtitle2">{c.brandName}</Typography>
                                                    <Typography variant="caption">{c.materialName}</Typography>
                                                </TableCell>
                                                <TableCell style={{ padding: 0 }}>
                                                    <Table size="small" sx={{ '& td, & th': { border: 0 } }}>
                                                        <TableBody>
                                                            {changes.map((change, i) => (
                                                                <TableRow key={i}>
                                                                    <TableCell sx={{ width: '30%' }}>{change.name}</TableCell>
                                                                    <TableCell sx={{ width: '35%', color: 'text.secondary', textDecoration: 'line-through' }}>{change.old ?? '-'}</TableCell>
                                                                    <TableCell sx={{ width: '35%', color: 'success.main', fontWeight: 'bold' }}>{change.new}</TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Box>
                )}

            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{t('common.cancel')}</Button>
                <Button onClick={handleImport} variant="contained" disabled={processing}>
                    {t('common.import') || "Import"}
                    {selectedBrands.length + selectedMaterials.length + (importCombinations ? missingCombinations.length : 0) > 0 &&
                        ` (${selectedBrands.length + selectedMaterials.length + (importCombinations ? missingCombinations.length : 0)} ${t('common.new')})`}
                    {selectedUpdates.length > 0 && ` + ${selectedUpdates.length} ${t('common.update')})`}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
