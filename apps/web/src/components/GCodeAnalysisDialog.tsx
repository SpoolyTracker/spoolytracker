import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { useState, useEffect, useMemo, useRef } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Box,
    CircularProgress,
    Alert,
    Stepper,
    Step,
    StepLabel,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Autocomplete,
    TextField,
    Checkbox,
    FormControlLabel,
    Chip,
    createFilterOptions
} from '@mui/material';
import { api, BASE_URL } from '../api';
import type { Filament } from '../api';
import ColorIndicator from './ColorIndicator';
import { t } from 'i18next';
import { getFilamentTitle } from '../utils/filament-utils';
import { useAuth } from '../contexts/AuthContext';
import { useJobStore } from '../store/useJobStore';


interface GCodeAnalysisDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onAnalysisComplete?: (grams: number) => void;
    initialFilamentId?: number; // Optional pre-selected filament for T0
    projectId?: number; // Optional: If present, adds to Project BOM
    preSelectedFile?: File | null; // Optional: If present, skips upload step
    preAnalyzedResult?: any; // Optional: If present, skips inspection and goes to mapping
    jobId?: string; // Optional: For duplicate detection
    fileName?: string; // Optional: For pre-analyzed results
}

type FilamentOption = Filament & {
    isGroup?: boolean;
    displayName?: string;
    items?: Filament[];
};

type FilamentSelectionValue = number | string;

const filamentOptionFilter = createFilterOptions<FilamentOption>({
    stringify: (option) => [
        option.displayName,
        getFilamentTitle(option),
        option.brand?.name,
        option.material?.name,
        option.types?.map(t => t.name).join(' '),
        option.type?.name,
        option.colorName,
        option.color,
        option.spoolReference
    ].filter(Boolean).join(' ')
});

export default function GCodeAnalysisDialog({
    isOpen,
    onClose,
    onAnalysisComplete,
    initialFilamentId,
    projectId,
    preSelectedFile,
    preAnalyzedResult,
    jobId,
    fileName: initialFileName
}: GCodeAnalysisDialogProps) {
    const [activeStep, setActiveStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const { token } = useAuth();
    const [organization, setOrganization] = useState<any>(null);
    const [uploadedJobId, setUploadedJobId] = useState<string | null>(null);
 
    const [tools, setTools] = useState<string[]>([]);
    const [filaments, setFilaments] = useState<Filament[]>([]);

    // Mapping: Global Defaults { "T0": filamentId }
    const [globalDefaults, setGlobalDefaults] = useState<Record<string, FilamentSelectionValue>>({});

    // Plate Mapping: { plateIndex: { "T0": filamentId } }
    const [plateMapping, setPlateMapping] = useState<Record<number, Record<string, FilamentSelectionValue>>>({});

    // Multi-plate results (Computed locally now)
    const [selectedPlates, setSelectedPlates] = useState<Record<number, boolean>>({});

    // Filename for report
    const [fileName, setFileName] = useState<string>('');
    // Full inspection result
    const [inspectionResult, setInspectionResult] = useState<any>(null);

    // Job Store
    const { jobs, addJob, removeJob, removeJobsByName } = useJobStore();
    // Default to the specific uploadedJobId if we have one, otherwise fallback to any 'inspect' job (e.g. if opened with jobId prop)
    const activeInspectJob = Object.values(jobs).find(j => (uploadedJobId || jobId ? j.id === (uploadedJobId || jobId) : j.name === 'inspect') && (j.status === 'waiting' || j.status === 'active' || j.status === 'completed' || j.status === 'failed'));

    // Fetch filaments on open
    const openedRef = useRef(false);
    useEffect(() => {
        if (!isOpen) {
            openedRef.current = false;
            return;
        }
        if (openedRef.current) return; // déjà initialisé pour cette ouverture
        openedRef.current = true;

        resetState();
        fetchFilaments();

        // If no specifically requested jobId, clear old inspect jobs for a "clean slate" ( virgin modal )
        if (!jobId && !preAnalyzedResult) {
            removeJobsByName('inspect');
        }

        if (preAnalyzedResult) {
            handleInspectionResult(preAnalyzedResult, initialFileName || 'Analyzed GCode');
        } else if (preSelectedFile) {
            processFile(preSelectedFile);
        }

        // Fetch Organization for Limits
        const orgId = localStorage.getItem('organization_id') || '1';
        fetch(`${BASE_URL}/organizations/${orgId}`, {
            headers: { 'Authorization': `Bearer ${token}`, 'x-organization-id': orgId },
        }).then(r => r.ok ? r.json() : null)
            .then(setOrganization)
            .catch(err => console.error("Failed to fetch organization", err));
    }, [isOpen, token]);

    // Handle job completion
    useEffect(() => {
        if (!isOpen) return;

        if (activeInspectJob) {
            if (activeInspectJob.status === 'completed' && activeInspectJob.result) {
                console.log('Inspection Job Completed:', activeInspectJob.result);
                try {
                    handleInspectionResult(activeInspectJob.result, activeInspectJob.filename);
                    removeJob(activeInspectJob.id);
                } catch (err) {
                    console.error('Failed to process inspection result:', err);
                    alert('Error processing GCode data. The file might be corrupted or in an unsupported format.');
                    setLoading(false);
                    removeJob(activeInspectJob.id);
                }
            } else if (activeInspectJob.status === 'failed') {
                console.error('Job Failed:', activeInspectJob.error);
                alert(`Analysis failed: ${activeInspectJob.error || 'Unknown error'}`);
                removeJob(activeInspectJob.id);
                setLoading(false);
            } else if (activeInspectJob.status === 'waiting' || activeInspectJob.status === 'active') {
                setLoading(true);
            }
        }
    }, [activeInspectJob?.status, activeInspectJob?.result, isOpen]);

    const fetchFilaments = async () => {
        try {
            const data = await api.getAll();
            setFilaments((data || [])
                .filter((f: Filament) => (f.weightRemaining || 0) > 0)
                .sort((a: Filament, b: Filament) => {
                const aUsable = (a.weightRemaining || 0) > 0 && !a.isLocked;
                const bUsable = (b.weightRemaining || 0) > 0 && !b.isLocked;
                if (aUsable !== bUsable) return aUsable ? -1 : 1;
                return getFilamentTitle(a).localeCompare(getFilamentTitle(b));
            }));
        } catch (err) {
            console.error('Failed to fetch filaments', err);
        }
    };

    const filamentOptions = useMemo<FilamentOption[]>(() => {
        const standalone: FilamentOption[] = [];
        const fullSpools: Record<string, Filament[]> = {};

        filaments.forEach(f => {
            const isFull = (f.weightRemaining || 0) >= (f.weightInitial || 0);
            if (isFull) {
                const typeKey = (f.types || []).map(t => t.id).sort().join(',');
                const key = `${f.brandId}-${f.materialId}-${typeKey}-${f.color}-${(f.colors || []).join(',')}`;
                if (!fullSpools[key]) fullSpools[key] = [];
                fullSpools[key].push(f);
            } else {
                standalone.push(f);
            }
        });

        Object.values(fullSpools).forEach(items => {
            if (items.length >= 2) {
                const first = items[0];
                standalone.push({
                    ...first,
                    id: `group-${first.id}` as any,
                    isGroup: true,
                    displayName: `${getFilamentTitle(first)} (${t('inventory.group', 'Groupe')} - ${items.length})`,
                    weightRemaining: items.reduce((sum, f) => sum + (f.weightRemaining || 0), 0),
                    weightInitial: items.reduce((sum, f) => sum + (f.weightInitial || 0), 0),
                    items
                });
            } else {
                standalone.push(...items);
            }
        });

        return standalone;
    }, [filaments, t]);

    const resetState = () => {
        setActiveStep(0);
        setLoading(false);
        setUploadProgress(null);
        setUploadedJobId(null);
        setTools([]);
        setGlobalDefaults({});
        setPlateMapping({});
        setSelectedPlates({});
        setInspectionResult(null);
        setFileName('');
    };

    const processFile = async (file: File) => {
        setFileName(file.name);
        setLoading(true);
        setUploadProgress(0);

        // Force React to paint the 'Uploading 0%' UI state before the browser initiates disk reading/scanning
        await new Promise(resolve => setTimeout(resolve, 50));

        try {
            const res = await api.inspectGCode(file, (pct) => setUploadProgress(pct));
            console.log('Inspection Job Enqueued:', res);
            setUploadProgress(null);
            setUploadedJobId(res.jobId);
            addJob(res.jobId, 'inspect', file.name);
        } catch (err) {
            console.error(err);
            alert('Failed to start GCode inspection');
            setLoading(false);
            setUploadProgress(null);
        }
    };

    const handleInspectionResult = (res: any, originalName: string) => {
        setFileName(originalName);
        setInspectionResult(res);
        
        const foundTools = res.tools || [];
        setTools(foundTools);

        // Initialize Global Defaults
        const defaults: Record<string, FilamentSelectionValue> = {};
        foundTools.forEach((t: string) => {
            if (t === 'T0' && initialFilamentId) {
                defaults[t] = initialFilamentId;
            }
        });
        setGlobalDefaults(defaults);

        // Initialize Plate Mapping
        const mapping: Record<number, Record<string, FilamentSelectionValue>> = {};
        const initialSelection: Record<number, boolean> = {};

        if (res.plates && Array.isArray(res.plates)) {
            res.plates.forEach((plate: any, idx: number) => {
                mapping[idx] = {};
                plate.tools.forEach((t: string) => {
                    mapping[idx][t] = defaults[t] || 0;
                });
                initialSelection[idx] = true;
            });
        } else {
            // Single file/plate fallback
            mapping[0] = {};
            foundTools.forEach((t: string) => mapping[0][t] = defaults[t] || 0);
            initialSelection[0] = true;
        }
        setPlateMapping(mapping);
        setSelectedPlates(initialSelection);

        setLoading(false);
        setActiveStep(1);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            const maxMb = organization?.stats?.limits?.maxFileUploadSizeMb || 10;
            const maxBytes = maxMb * 1024 * 1024;
            if (selectedFile.size > maxBytes) {
                alert(`File size limit is ${maxMb}MB for your plan`);
                return;
            }
            await processFile(selectedFile);
        }
        e.target.value = ""; 
    };

    const handleGlobalDefaultChange = (tool: string, value: FilamentSelectionValue) => {
        setGlobalDefaults(prev => ({ ...prev, [tool]: value }));
        // Update all plates that haven't been manually changed? 
        // For simplicity, let's update ALL plates to match default for now
        setPlateMapping(prev => {
            const next = { ...prev };
            Object.keys(next).forEach((plateIdx: any) => {
                if (next[plateIdx][tool] !== undefined) {
                    next[plateIdx][tool] = value;
                }
            });
            return next;
        });
    };

    const handlePlateMappingChange = (plateIdx: number, tool: string, value: FilamentSelectionValue) => {
        setPlateMapping(prev => ({
            ...prev,
            [plateIdx]: {
                ...prev[plateIdx],
                [tool]: value
            }
        }));
    };

    const getSelectedOption = (value: FilamentSelectionValue | undefined): FilamentOption | undefined => {
        if (!value) return undefined;
        return filamentOptions.find(option => String(option.id) === String(value));
    };

    const getRepresentativeFilament = (value: FilamentSelectionValue | undefined): Filament | undefined => {
        const option = getSelectedOption(value);
        if (!option) return undefined;
        return option.isGroup ? option.items?.[0] : option;
    };

    const getSelectionValueForSuggestedFilament = (filamentId?: number): FilamentSelectionValue | undefined => {
        if (!filamentId) return undefined;

        const directOption = filamentOptions.find(option => !option.isGroup && String(option.id) === String(filamentId));
        if (directOption) return directOption.id;

        const groupOption = filamentOptions.find(option =>
            option.isGroup && option.items?.some(item => String(item.id) === String(filamentId))
        );
        return groupOption?.id;
    };

    const getToolSuggestion = (tool: string) => {
        return inspectionResult?.matching?.toolSuggestions?.find((suggestion: any) => suggestion.tool === tool);
    };

    const getBestSelectionForTool = (tool: string): FilamentSelectionValue | undefined => {
        const suggestion = getToolSuggestion(tool);
        const best = suggestion?.candidates?.[0];
        return getSelectionValueForSuggestedFilament(best?.filamentId);
    };

    const applyAllSuggestions = (overwrite = true) => {
        if (!inspectionResult?.plates) return;

        setPlateMapping(prev => {
            const next = { ...prev };
            inspectionResult.plates.forEach((plate: any, plateIdx: number) => {
                next[plateIdx] = { ...(next[plateIdx] || {}) };
                plate.tools?.forEach((tool: string) => {
                    const value = getBestSelectionForTool(tool);
                    if (value && (overwrite || !next[plateIdx][tool])) next[plateIdx][tool] = value;
                });
            });
            return next;
        });

        setGlobalDefaults(prev => {
            const next = { ...prev };
            tools.forEach(tool => {
                const value = getBestSelectionForTool(tool);
                if (value && (overwrite || !next[tool])) next[tool] = value;
            });
            return next;
        });
    };

    // Calculate usage dynamically based on mapping
    const computedPlates = useMemo(() => {
        if (!inspectionResult?.plates) return [];

        return inspectionResult.plates.map((plate: any, idx: number) => {
            const usage: any[] = [];
            let totalGram = 0;
            let totalLength = 0;
            let totalCost = 0;

            const pMap = plateMapping[idx] || {};

            plate.tools.forEach((tool: string) => {
                const filId = pMap[tool];
                const selectedOption = getSelectedOption(filId);
                const filament = getRepresentativeFilament(filId);
                const density = filament?.densityGcm3 || 1.24;

                const volMm3 = plate.perTool?.[tool]?.volumeMm3 || 0;
                const lengthMm = plate.perTool?.[tool]?.lengthMm || 0;

                // Priority: Use gram if directly provided by slicer, else compute from volume/density
                let weight = (volMm3 / 1000) * density;
                
                // If the slicer metadata provides length in meters (common in OctoPrint/Orca), 
                // we can also compute it from density and cross-section (PI * r^2)
                const diameter = filament?.diameterMm || 1.75;
                const crossSectionMm2 = Math.PI * Math.pow(diameter / 2, 2);
                
                // Length-based fallback (often more accurate for OctoPrint users)
                if (lengthMm > 0 && weight <= 0) {
                   weight = (lengthMm * crossSectionMm2 / 1000) * density;
                }

                const length = lengthMm / 1000;

                if (weight > 0) {
                    usage.push({
                        tool,
                        filamentId: filId,
                        selectedOption,
                        gram: weight,
                        length,
                        filament
                    });
                    totalGram += weight;
                    totalLength += length;

                    if (filament) {
                        const weightInfo = (filament.weightInitial || 1000);
                        const price = filament.price || 0;
                        totalCost += (weight * (price / weightInfo));
                    }
                }
            });

            return {
                name: plate.name,
                usage,
                totalGram,
                totalLength,
                totalCost
            };
        });
    }, [inspectionResult, plateMapping, filaments]);

    // Derived totals
    const selectionTotals = useMemo(() => {
        let totalWeight = 0;
        let totalCost = 0;

        computedPlates.forEach((plate: any, idx: number) => {
            if (selectedPlates[idx]) {
                totalWeight += plate.totalGram;
                totalCost += plate.totalCost;
            }
        });

        return { totalWeight, totalCost };
    }, [computedPlates, selectedPlates]);


    const handleFinish = async () => {
        setLoading(true);
        try {
            const platesToLog = computedPlates.filter((_: any, idx: number) => selectedPlates[idx]);

            // 1. Log Consumption
            for (const plate of platesToLog) {
                // For each usage in the plate
                for (const u of plate.usage) {
                    if (u.filamentId) {
                        const note = `GCode Analysis: ${plate.name} (${u.tool})`;
                        if (u.selectedOption?.isGroup) {
                            await api.consumeGroup({
                                brandId: u.selectedOption.items[0]?.brandId || u.selectedOption.items[0]?.brand?.id,
                                materialId: u.selectedOption.items[0]?.materialId || u.selectedOption.items[0]?.material?.id,
                                typeId: u.selectedOption.items[0]?.types?.[0]?.id,
                                color: u.selectedOption.color,
                                amount: u.gram,
                                type: 'PRINT',
                                notes: note
                            });
                        } else if (projectId) {
                            await api.addProjectConsumption(projectId, {
                                filamentId: u.filamentId,
                                amount: u.gram,
                                type: 'PRINT',
                                notes: note
                            });
                        } else {
                            await api.logConsumption(u.filamentId, u.gram, 'PRINT', note, undefined, jobId);
                        }
                    }
                }
            }

            // Apprentissage gcode->bobine (no-op côté serveur si plan non éligible)
            const mappings: Array<{ hint: any; filamentId: number }> = [];
            for (const plate of platesToLog) {
                for (const u of plate.usage) {
                    if (u.filamentId && !u.selectedOption?.isGroup) {
                        const hint =
                            inspectionResult?.toolHints?.[u.tool] ||
                            inspectionResult?.matching?.toolSuggestions?.find((s: any) => s.tool === u.tool)?.hint;
                        if (hint) mappings.push({ hint, filamentId: u.filamentId });
                    }
                }
            }
            if (mappings.length > 0) {
                try { await api.confirmGcodeMappings(mappings); } catch { /* apprentissage best-effort */ }
            }

            // 2. Add to Project BOM (if projectId provided)
            if (projectId) {
                const bomUpdates: Record<number, number> = {}; // filamentId -> totalWeight

                for (const plate of platesToLog) {
                    for (const u of plate.usage) {
                        if (u.filamentId && !u.selectedOption?.isGroup) {
                            bomUpdates[u.filamentId] = (bomUpdates[u.filamentId] || 0) + u.gram;
                        }
                    }
                }

                for (const [filId, weight] of Object.entries(bomUpdates)) {
                    // We add a new item or we could check if exists. 
                    // To keep it simple and robust, we just add a new item. The UI shows them as list.
                    await api.addProjectItem(projectId, {
                        filamentId: Number(filId),
                        weight_required_g: weight
                    });
                }
            }

            // Notify other components of data changes
            window.dispatchEvent(new CustomEvent('inventory-updated'));

            if (onAnalysisComplete) {
                onAnalysisComplete(selectionTotals.totalWeight);
            }
            onClose();
        } catch (err) {
            console.error(err);
            alert('Failed to log consumption');
        } finally {
            setLoading(false);
        }
    };

    const togglePlate = (idx: number) => {
        setSelectedPlates(prev => ({ ...prev, [idx]: !prev[idx] }));
    };

    const toggleAll = (checked: boolean) => {
        const sel: Record<number, boolean> = {};
        if (inspectionResult?.plates) {
            inspectionResult.plates.forEach((_: any, idx: number) => sel[idx] = checked);
        }
        setSelectedPlates(sel);
    };

    const handleExport = async () => {
        const workbook = new ExcelJS.Workbook();
        const summarySheet = workbook.addWorksheet('Summary');
        const detailsSheet = workbook.addWorksheet('Details');

        // --- Sheet 1: Summary ---

        // 0. Load Logo
        try {
            const logoResponse = await fetch('/logo/logo-horizontal-light.png');
            const logoBlob = await logoResponse.arrayBuffer();
            const logoId = workbook.addImage({
                buffer: logoBlob,
                extension: 'png',
            });
            summarySheet.addImage(logoId, {
                tl: { col: 0, row: 1 },
                ext: { width: 220, height: 45 } // Adjusted ratio to avoid squashing
            });
        } catch (e) {
            console.warn("Could not load logo", e);
        }

        // Title Row (Merged) - Start at row 5 to leave room for Logo
        summarySheet.mergeCells('A5:E5');
        const titleCell = summarySheet.getCell('A5');
        titleCell.value = t('gcode.report.title');
        titleCell.font = { size: 16, bold: true };
        titleCell.alignment = { horizontal: 'center' };

        // Metadata
        summarySheet.getCell('A7').value = t('gcode.report.projectFile');
        summarySheet.getCell('B7').value = fileName;
        summarySheet.getCell('A8').value = t('gcode.report.generatedOn');
        summarySheet.getCell('B8').value = new Date().toLocaleString();

        summarySheet.getCell('A9').value = t('gcode.report.totalPlates');
        summarySheet.getCell('B9').value = computedPlates.length;

        summarySheet.getCell('A10').value = t('gcode.report.selectedPlates');
        summarySheet.getCell('B10').value = Object.values(selectedPlates).filter(Boolean).length;

        summarySheet.getCell('D9').value = t('gcode.report.totalWeight');
        summarySheet.getCell('E9').value = `${selectionTotals.totalWeight.toFixed(2)}g`;
        summarySheet.getCell('E9').font = { bold: true };

        summarySheet.getCell('D10').value = t('gcode.report.totalCost');
        summarySheet.getCell('E10').value = `${selectionTotals.totalCost.toFixed(2)}€`;
        summarySheet.getCell('E10').font = { bold: true };

        // Global Summarry Header
        summarySheet.getRow(12).values = [t('gcode.report.globalSummary')];
        summarySheet.mergeCells('A12:E12');
        summarySheet.getCell('A12').font = { bold: true, size: 12 };

        const globalHeaderRow = summarySheet.getRow(13);
        globalHeaderRow.values = [
            t('gcode.report.colBrand'),
            t('gcode.report.colType'),
            t('gcode.report.colName'),
            t('gcode.report.colWeight'),
            t('gcode.report.colCost')
        ];
        globalHeaderRow.font = { bold: true };
        globalHeaderRow.eachCell((cell) => {
            cell.border = { bottom: { style: 'thin' } };
        });

        // 1. Group usage by Filament ID (Strict grouping)
        const usageById: Record<number, { filament: Filament, weight: number, cost: number }> = {};
        let unknownWeight = 0;

        computedPlates.forEach((plate: any, idx: number) => {
            if (!selectedPlates[idx]) return;
            plate.usage.forEach((u: any) => {
                if (u.filament) {
                    if (!usageById[u.filament.id]) {
                        usageById[u.filament.id] = {
                            filament: u.filament,
                            weight: 0,
                            cost: 0
                        };
                    }
                    const info = u.filament.weightInitial || 1000;
                    const price = u.filament.price || 0;
                    usageById[u.filament.id].weight += u.gram;
                    usageById[u.filament.id].cost += (u.gram * (price / info));
                } else {
                    unknownWeight += u.gram;
                }
            });
        });

        let currentRow = 14;
        Object.values(usageById).forEach(item => {
            const row = summarySheet.getRow(currentRow++);
            row.values = [
                item.filament.brand?.name || 'Unknown Brand',
                item.filament.type?.name || 'Unknown Type',
                getFilamentTitle(item.filament),
                parseFloat(item.weight.toFixed(2)),
                parseFloat(item.cost.toFixed(2))
            ];
        });

        if (unknownWeight > 0) {
            const row = summarySheet.getRow(currentRow++);
            row.values = ['Unknown', 'Unknown', 'Unassigned / ID 0', parseFloat(unknownWeight.toFixed(2)), 0];
        }

        // Plate Breakdown Header
        currentRow += 2; // Spacer
        summarySheet.mergeCells(`A${currentRow}:E${currentRow}`);
        summarySheet.getCell(`A${currentRow}`).value = t('gcode.report.plateBreakdown');
        summarySheet.getCell(`A${currentRow}`).font = { bold: true, size: 12 };
        currentRow++;

        const plateHeader = summarySheet.getRow(currentRow++);
        plateHeader.values = [
            t('gcode.report.colPlate'),
            t('gcode.report.colStatus'),
            t('gcode.report.colAssigned'),
            t('gcode.report.colWeight'),
            t('gcode.report.colCost')
        ];
        plateHeader.font = { bold: true };
        plateHeader.eachCell(cell => cell.border = { bottom: { style: 'thin' } });

        // 2. Plate Summary
        computedPlates.forEach((plate: any, idx: number) => {
            const isSelected = !!selectedPlates[idx];
            const filamentsList = plate.usage.map((u: any) => {
                return `${u.tool}: ${u.filament ? getFilamentTitle(u.filament) : 'Unknown'}`;
            }).join(' | ');

            const row = summarySheet.getRow(currentRow++);
            row.values = [
                plate.name,
                isSelected ? t('gcode.report.statusSelected') : t('gcode.report.statusExcluded'),
                filamentsList,
                parseFloat(plate.totalGram.toFixed(2)),
                parseFloat(plate.totalCost.toFixed(2))
            ];
            if (!isSelected) {
                row.font = { color: { argb: 'FF999999' }, italic: true };
            }
        });

        // Column Widths
        summarySheet.columns = [
            { width: 25 }, // Brand
            { width: 15 }, // Type
            { width: 45 }, // Name
            { width: 15 }, // Weight
            { width: 15 }, // Cost
        ];

        // --- Sheet 2: Details ---
        const detailsHeaderRow = detailsSheet.getRow(1);
        detailsHeaderRow.values = [
            t('gcode.report.colPlate'),
            t('gcode.report.colTool'),
            t('gcode.report.colFilamentId'),
            t('gcode.report.colBrand'),
            t('gcode.report.colType'),
            t('gcode.report.colName'),
            t('gcode.report.colWeight'),
            t('gcode.report.colLength'),
            t('gcode.report.colCost')
        ];
        detailsHeaderRow.font = { bold: true };

        computedPlates.forEach((plate: any, idx: number) => {
            if (!selectedPlates[idx]) return;
            plate.usage.forEach((u: any) => {
                let cost = 0;
                if (u.filament) {
                    const weightInfo = (u.filament.weightInitial || 1000);
                    const price = u.filament.price || 0;
                    cost = (u.gram * (price / weightInfo));
                }

                detailsSheet.addRow([
                    plate.name,
                    u.tool,
                    u.filament?.id || 0,
                    u.filament?.brand?.name || '-',
                    u.filament?.type?.name || '-',
                    u.filament ? getFilamentTitle(u.filament) : 'Unknown',
                    parseFloat(u.gram.toFixed(2)),
                    parseFloat((u.length || 0).toFixed(2)),
                    parseFloat(cost.toFixed(2))
                ]);
            });
        });

        detailsSheet.columns = [
            { width: 20 }, { width: 10 }, { width: 10 }, { width: 15 }, { width: 10 }, { width: 30 }, { width: 12 }, { width: 12 }, { width: 12 }
        ];

        // Save file
        const buffer = await workbook.xlsx.writeBuffer();
        const safeName = fileName.replace(/\.[^/.]+$/, "") || "analysis";
        saveAs(new Blob([buffer]), `${safeName}_report_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    const getCandidateSummary = (filamentId: number) => {
        const filament = filaments.find(f => f.id === filamentId);
        if (!filament) {
            return {
                label: `Filament #${filamentId}`,
                colorName: t('gcode.unknownColor'),
                color: '#9ca3af',
                colors: []
            };
        }

        const brand = filament.brand?.name || t('gcode.unknownBrand');
        const material = filament.material?.name || t('gcode.unknownMaterial');
        const type = filament.types?.map(type => type.name).filter(Boolean).join(' ');
        const colorName = filament.colorName || (filament as any).colorReference?.name || filament.color || t('gcode.unknownColor');

        return {
            label: [brand, material, type, colorName].filter(Boolean).join(' • '),
            colorName,
            color: filament.color,
            colors: filament.colors || []
        };
    };

    const getIntentLabel = (intent: string) => {
        const labels: Record<string, string> = {
            decorative: t('gcode.intent.decorative'),
            technical: t('gcode.intent.technical'),
            heat_resistant: t('gcode.intent.heatResistant'),
            flexible: t('gcode.intent.flexible'),
            unknown: t('gcode.intent.unknown')
        };
        return labels[intent] || intent;
    };

    const getMatchingWarningLabel = (warning: string) => {
        const labels: Record<string, string> = {
            'Material differs from the slicer hint': t('gcode.matchingWarnings.materialMismatch'),
            'Not enough filament remaining': t('gcode.matchingWarnings.insufficientStock'),
            'Filament is locked by quota or plan': t('gcode.matchingWarnings.locked'),
            'Filament is empty': t('gcode.matchingWarnings.empty')
        };
        return labels[warning] || warning;
    };

    return (
        <Dialog open={isOpen} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>{t('gcode.dialogTitle')}</DialogTitle>
            <DialogContent>
                <Stepper activeStep={activeStep} sx={{ mb: 3, pt: 1 }}>
                    <Step><StepLabel>{t('gcode.step.upload')}</StepLabel></Step>
                    <Step><StepLabel>{t('gcode.step.mapping')}</StepLabel></Step>
                    <Step><StepLabel>{t('gcode.step.confirm')}</StepLabel></Step>
                </Stepper>

                {activeStep === 0 && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 4 }}>
                        {activeInspectJob ? (
                            <Box sx={{ width: '100%', textAlign: 'center' }}>
                                <Typography variant="h6" gutterBottom>
                                    {t('gcode.processingFile', { filename: activeInspectJob.filename })}
                                </Typography>
                                <Typography variant="body2" color="textSecondary" gutterBottom>
                                    {t('gcode.processingHint')}
                                </Typography>
                                <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                    <CircularProgress variant="determinate" value={activeInspectJob.progress} size={60} />
                                    <Typography variant="caption">{activeInspectJob.progress}%</Typography>
                                </Box>
                            </Box>
                        ) : (
                            <>
                                <Typography color="textSecondary">{t('gcode.fileExtensionSelection')}</Typography>
                                <Button
                                    variant="contained"
                                    size="large"
                                    disabled={loading}
                                    component="label"
                                >
                                    {loading ? (
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <CircularProgress size={20} color="inherit" />
                                            <span>{uploadProgress !== null ? `Envoi... ${uploadProgress}%` : 'Traitement...'}</span>
                                        </Box>
                                    ) : <span>{t('gcode.uploadGcode')}</span>}
                                    <input
                                        type="file"
                                        hidden
                                        onChange={handleFileUpload}
                                    />
                                </Button>
                            </>
                        )}
                    </Box>
                )}

                {activeStep === 1 && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {inspectionResult?.meta?.isFallback && (
                            <Alert severity="info" sx={{ mb: 1 }}>
                                <strong>Note:</strong> Detailed move-scanning failed for this file. 
                                We are using usage data directly reported by your slicer (Bambu/Orca/Prusa) as a fallback.
                            </Alert>
                        )}
                        {/* Global Defaults Section */}
                        <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
                            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>{t('gcode.defaultFilaments')}</Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                                {tools.map(tool => (
                                    <Box key={tool} sx={{ minWidth: 200 }}>
                                        <Typography variant="caption" sx={{ fontWeight: 'bold' }}>{tool}</Typography>
                                        <Autocomplete
                                            key={`global-${tool}-${String(globalDefaults[tool] || 'empty')}`}
                                            options={filamentOptions}
                                            filterOptions={filamentOptionFilter}
                                            getOptionLabel={(option) => {
                                                return option.displayName || getFilamentTitle(option);
                                            }}
                                            isOptionEqualToValue={(option, value) => String(option.id) === String(value.id)}
                                            value={getSelectedOption(globalDefaults[tool]) ?? undefined}
                                            onChange={(_, newValue) => handleGlobalDefaultChange(tool, newValue ? newValue.id : 0)}
                                            renderOption={(props, option) => {
                                                const { key, ...otherProps } = props;
                                                return (
                                                    <li key={key} {...otherProps}>
                                                        <Box sx={{ mr: 1, display: 'inline-flex' }}>
                                                            <ColorIndicator colors={[option.color, ...(option.colors || [])]} size={12} />
                                                        </Box>
                                                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                                            <Typography variant="body2">
                                                                {option.displayName || getFilamentTitle(option)}
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary">
                                                                {option.isGroup
                                                                    ? `${option.items?.length || 0} ${t('inventory.spools', 'bobines')} • ${Math.round(option.weightRemaining || 0)}g`
                                                                    : `${option.colorName || option.color || t('gcode.unknownColor')} • ${Math.round(option.weightRemaining || 0)}g`}
                                                            </Typography>
                                                        </Box>
                                                    </li>
                                                );
                                            }}
                                            renderInput={(params) => <TextField {...params} variant="standard" placeholder={t('gcode.selectFilament')} />}
                                            size="small"
                                            noOptionsText={t('gcode.noFilamentsAvailable')}
                                            disablePortal={false}
                                            slotProps={{ popper: { sx: { zIndex: 9999 } } }}
                                        />
                                    </Box>
                                ))}
                            </Box>
                        </Paper>

                        <Alert severity="info" sx={{ py: 0 }}>
                            {t('gcode.uploadConfirmation', { toolsLength: computedPlates.length, s: computedPlates.length === 1 ? '' : 's' })}
                        </Alert>

                        {inspectionResult?.matching && (
                            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
                                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                                    {t('gcode.suggestions.title')}
                                </Typography>
                                {inspectionResult.matching.printIntent && (
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mb: 1.5 }}>
                                        <Chip
                                            size="small"
                                            label={`${t('gcode.suggestions.probableUse')}: ${getIntentLabel(inspectionResult.matching.printIntent.intent)}`}
                                            color={inspectionResult.matching.printIntent.confidence === 'high' ? 'success' : 'default'}
                                        />
                                        {(inspectionResult.matching.printIntent.recommendedMaterials || []).map((material: string) => (
                                            <Chip key={material} size="small" variant="outlined" label={material} />
                                        ))}
                                    </Box>
                                )}
                                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
                                    <Button size="small" variant="outlined" onClick={() => applyAllSuggestions()}>
                                        {t('gcode.suggestions.prefillFields')}
                                    </Button>
                                </Box>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    {(inspectionResult.matching.toolSuggestions || []).map((suggestion: any) => {
                                        const best = suggestion.candidates?.[0];
                                        const bestSummary = best ? getCandidateSummary(best.filamentId) : null;
                                        const hintBits = [
                                            suggestion.hint?.material,
                                            suggestion.hint?.colorHex || suggestion.hint?.colorName,
                                            suggestion.requiredWeightG ? `${Math.round(suggestion.requiredWeightG)}g` : null
                                        ].filter(Boolean);

                                        return (
                                            <Box key={suggestion.tool} sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                                <Typography variant="caption" sx={{ fontWeight: 700, minWidth: 28 }}>{suggestion.tool}</Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {hintBits.length ? hintBits.join(' • ') : t('gcode.suggestions.limitedHints')}
                                                </Typography>
                                                {best && bestSummary ? (
                                                    <>
                                                        <Chip
                                                            size="small"
                                                            color={best.confidence === 'high' ? 'success' : best.confidence === 'medium' ? 'warning' : 'default'}
                                                            label={`${t('gcode.suggestions.score')} ${best.score}`}
                                                        />
                                                        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, border: '1px solid', borderColor: 'divider', borderRadius: 1, px: 1, py: 0.35, bgcolor: 'background.paper' }}>
                                                            <ColorIndicator colors={bestSummary.colors} primaryColor={bestSummary.color} size={16} />
                                                            <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                                                {bestSummary.label}
                                                            </Typography>
                                                        </Box>
                                                        {best.warnings?.slice(0, 1).map((warning: string) => (
                                                            <Chip key={warning} size="small" color="error" variant="outlined" label={getMatchingWarningLabel(warning)} />
                                                        ))}
                                                    </>
                                                ) : (
                                                    <Chip size="small" variant="outlined" label={t('gcode.suggestions.noCandidate')} />
                                                )}
                                            </Box>
                                        );
                                    })}
                                </Box>
                            </Paper>
                        )}

                        <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 500 }}>
                            <Table size="small" stickyHeader>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>{t('gcode.table.plateFile')}</TableCell>
                                        <TableCell>{t('gcode.table.usage')}</TableCell>
                                        <TableCell>{t('gcode.table.filamentAssignment')}</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {inspectionResult?.plates?.map((plate: any, plateIdx: number) => {
                                        const computed = computedPlates[plateIdx];
                                        return (
                                            <TableRow key={plateIdx}>
                                                <TableCell sx={{ fontWeight: 'bold', width: '20%' }}>
                                                    {plate.name}
                                                </TableCell>
                                                <TableCell sx={{ width: '20%' }}>
                                                    {computed ? (
                                                        <Box>
                                                            <Typography variant="body2" fontWeight="bold">
                                                                {computed.totalLength.toFixed(2)}m
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary">
                                                                {computed.totalCost.toFixed(2)}€
                                                            </Typography>
                                                        </Box>
                                                    ) : '-'}
                                                </TableCell>
                                                <TableCell>
                                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                                        {plate.tools.map((tool: string) => (
                                                            <Box key={tool} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                <Typography variant="caption" sx={{ width: 30, fontWeight: 'bold' }}>{tool}:</Typography>
                                                                <Autocomplete
                                                                    key={`plate-${plateIdx}-${tool}-${String(plateMapping[plateIdx]?.[tool] || 'empty')}`}
                                                                    options={filamentOptions}
                                                                    filterOptions={filamentOptionFilter}
                                                                    getOptionLabel={(option) => `${option.displayName || getFilamentTitle(option)} (${(option.weightRemaining || 0).toFixed(2)}g)`}
                                                                    isOptionEqualToValue={(option, value) => String(option.id) === String(value.id)}
                                                                    value={getSelectedOption(plateMapping[plateIdx]?.[tool]) ?? undefined}
                                                                    onChange={(_, newValue) => handlePlateMappingChange(plateIdx, tool, newValue ? newValue.id : 0)}
                                                                    size="small"
                                                                    fullWidth
                                                                    renderOption={(props, option) => {
                                                                        const { key, ...otherProps } = props;
                                                                        return (
                                                                            <li key={key} {...otherProps}>
                                                                                <Box sx={{ mr: 1, display: 'inline-flex' }}>
                                                                                    <ColorIndicator colors={[option.color, ...(option.colors || [])]} size={12} />
                                                                                </Box>
                                                                                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                                                                    <Typography variant="body2">
                                                                                        {option.displayName || getFilamentTitle(option)}
                                                                                    </Typography>
                                                                                    <Typography variant="caption" color="text.secondary">
                                                                                        {option.isGroup
                                                                                            ? `${option.items?.length || 0} ${t('inventory.spools', 'bobines')} • ${Math.round(option.weightRemaining || 0)}g`
                                                                                            : `${option.colorName || option.color || t('gcode.unknownColor')} • ${(option.weightRemaining || 0).toFixed(2)}g`}
                                                                                    </Typography>
                                                                                </Box>
                                                                            </li>
                                                                        );
                                                                    }}
                                                                    renderInput={(params) => <TextField {...params} variant="outlined" size="small" />}
                                                                    noOptionsText={t('gcode.noFilamentsAvailable')}
                                                                    disablePortal={false}
                                                                    slotProps={{ popper: { sx: { zIndex: 9999 } } }}
                                                                />
                                                                {plate.perTool?.[tool] && (
                                                                    <Typography variant="caption" sx={{ minWidth: 60, textAlign: 'right', color: 'text.secondary' }}>
                                                                        {computed?.usage.find((u: any) => u.tool === tool)?.length.toFixed(2)}m
                                                                    </Typography>
                                                                )}
                                                            </Box>
                                                        ))}
                                                    </Box>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Box>
                )}

                {activeStep === 2 && (
                    <Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Typography variant="h6">{t('gcode.summaryOfConsumption')}</Typography>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={computedPlates.length > 0 && computedPlates.every((_: any, idx: number) => selectedPlates[idx])}
                                        indeterminate={computedPlates.some((_: any, idx: number) => selectedPlates[idx]) && !computedPlates.every((_: any, idx: number) => selectedPlates[idx])}
                                        onChange={(e) => toggleAll(e.target.checked)}
                                    />
                                }
                                label={t('gcode.logAllPlates')}
                            />
                        </Box>

                        <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 400 }}>
                            <Table size="small" stickyHeader>
                                <TableHead>
                                    <TableRow>
                                        <TableCell padding="checkbox">Selected</TableCell>
                                        <TableCell>{t('gcode.table.plateFile')}</TableCell>
                                        <TableCell>{t('gcode.table.filamentDetails')}</TableCell>
                                        <TableCell align="right">{t('gcode.table.weight')}</TableCell>
                                        <TableCell align="right">{t('gcode.table.cost')}</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {computedPlates.map((plate: any, idx: number) => (
                                        <TableRow key={idx} selected={selectedPlates[idx]}>
                                            <TableCell padding="checkbox">
                                                <Checkbox
                                                    checked={!!selectedPlates[idx]}
                                                    onChange={() => togglePlate(idx)}
                                                />
                                            </TableCell>
                                            <TableCell sx={{ fontWeight: 'bold' }}>{plate.name}</TableCell>
                                            <TableCell>
                                                {plate.usage.map((u: any, i: number) => (
                                                    <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                                        <ColorIndicator colors={u.filament ? [u.filament.color, ...(u.filament.colors || [])] : []} size={12} />
                                                        <Typography variant="caption" noWrap>
                                                            {u.filament ? getFilamentTitle(u.filament) : u.tool} ({u.gram.toFixed(2)}g)
                                                        </Typography>
                                                    </Box>
                                                ))}
                                            </TableCell>
                                            <TableCell align="right">{plate.totalGram.toFixed(2)}g</TableCell>
                                            <TableCell align="right">{plate.totalCost.toFixed(2)}€</TableCell>
                                        </TableRow>
                                    ))}

                                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                                        <TableCell colSpan={3} sx={{ fontWeight: 'bold', textAlign: 'right' }}>{t('gcode.totalSelected')}</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>{selectionTotals.totalWeight.toFixed(2)}g</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>{selectionTotals.totalCost.toFixed(2)}€</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="inherit" disabled={loading}>{t('common.cancel')}</Button>

                {activeStep === 1 && (
                    <Button onClick={() => setActiveStep(2)} variant="contained" disabled={loading}>
                        {t('common.next')}
                    </Button>
                )}

                {activeStep === 2 && (
                    <>
                        <Button onClick={() => setActiveStep(1)} color="inherit" disabled={loading}>
                            {t('common.back')}
                        </Button>
                        <Button onClick={handleExport} variant="outlined" disabled={loading}>
                            {t('gcode.downloadExcel')}
                        </Button>
                        <Button onClick={handleFinish} variant="contained" color="success" disabled={loading || Object.keys(selectedPlates).filter(k => selectedPlates[parseInt(k)]).length === 0}>
                            {loading ? <CircularProgress size={20} /> : <span>{t('gcode.actions.logSelected', { count: Object.values(selectedPlates).filter(Boolean).length })}</span>}
                        </Button>
                    </>
                )}
            </DialogActions>
        </Dialog>
    );
}
