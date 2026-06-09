import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Typography, Button, Paper, Grid, Card, CardContent,
    TextField, IconButton, Chip, Tabs, Tab, Box,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TableSortLabel,
    LinearProgress, Checkbox, FormControlLabel, useTheme, Dialog, DialogTitle, DialogContent, DialogActions, CardActions,
    List, ListItem, ListItemText, Snackbar, Alert, MenuItem, Select, InputLabel, FormControl, Tooltip, Menu,
    Autocomplete, createFilterOptions
} from '@mui/material';
import {
    ArrowBack, Edit, Delete, Save, Add, CloudUpload, Calculate,
    History as HistoryIcon, Layers, Inventory2, Description,
    CloudDownload, Assessment, Star, StarBorder, Print as PrinterIcon,
    AttachMoney, FolderOpen, EventNote, Refresh
} from '@mui/icons-material';
import { api, ProjectStatus, BASE_URL } from '../api';
import type { Project, ProjectItem, ProjectFile, Filament } from '../api';
import ProjectItemModal from '../components/ProjectItemModal';
import GCodeAnalysisDialog from '../components/GCodeAnalysisDialog';
import ProjectEditDialog from '../components/ProjectEditDialog';
import { useTranslation } from 'react-i18next';
import { usePrinterBridge } from '../contexts/PrinterBridgeContext';
import { useAuth } from '../contexts/AuthContext';
import { SecureImage } from '../components/SecureImage';
import ColorIndicator from '../components/ColorIndicator';
import { getFilamentTitle } from '../utils/filament-utils';
import { normalizeNumericInput } from '../utils/number-utils';

export default function ProjectDetailsPage() {
    const { id: projectId } = useParams();
    const navigate = useNavigate();
    const theme = useTheme();
    const { t, i18n } = useTranslation();
    const { printers, downloadFile } = usePrinterBridge();
    const { token } = useAuth();
    const [organization, setOrganization] = useState<any>(null);
    const [printerMenuAnchor, setPrinterMenuAnchor] = useState<null | HTMLElement>(null);

    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [tabValue, setTabValue] = useState(0);
    const [isAddMaterialOpen, setIsAddMaterialOpen] = useState(false);
    const [simConfig, setSimConfig] = useState<{ [key: string]: number | string }>({
        print_time_h: 0,
        labor_time_h: 0,
        machine_hourly_rate: 0,
        labor_hourly_rate: 0,
        printer_power_kw: 0,
        electricity_cost_kwh: 0,
        misc_costs: 0
    });
    const [savingSim, setSavingSim] = useState(false);

    // New State for GCode Workflow
    const [uploadChoiceOpen, setUploadChoiceOpen] = useState(false);
    const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);
    const [isGCodeAnalysisOpen, setIsGCodeAnalysisOpen] = useState(false);
    const [pendingAnalysisResult, setPendingAnalysisResult] = useState<any>(null);
    const [pendingFileName, setPendingFileName] = useState<string>('');

    // New Features State
    const [tags, setTags] = useState<string[]>([]);
    const [targetPrice, setTargetPrice] = useState<number | string>('');
    const [notes, setNotes] = useState('');
    const [savingGlobal, setSavingGlobal] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleteConsumptions, setDeleteConsumptions] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false); // Used for editing project details if needed

    // Feasibility State
    const [feasibility, setFeasibility] = useState<{
        overallStatus: 'OK' | 'RISK' | 'CRITICAL' | 'RESTRICTED';
        items: any[];
    } | null>(null);

    // Manual Log State
    const [manualLogOpen, setManualLogOpen] = useState(false);
    const [editingLogId, setEditingLogId] = useState<number | null>(null);
    const [manualLogData, setManualLogData] = useState({ filamentId: '', amount: '', type: 'PRINT', notes: '', is_planned: false });
    const [selectedLogFilament, setSelectedLogFilament] = useState<Filament | null>(null);
    const [allFilaments, setAllFilaments] = useState<Filament[]>([]);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
    const [convertDialogOpen, setConvertDialogOpen] = useState(false);
    const [pendingStatusUpdates, setPendingStatusUpdates] = useState<Partial<Project> | null>(null);
    const [converting, setConverting] = useState(false);

    // Table Sorting State
    const [order, setOrder] = useState<'asc' | 'desc'>('desc');
    const [orderBy, setOrderBy] = useState<string>('date');

    const handleRequestSort = (property: string) => {
        const isAsc = orderBy === property && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(property);
    };

    const sortedConsumptions = project?.consumptionLogs ? [...project.consumptionLogs].sort((a, b) => {
        let valA: any = a[orderBy as keyof typeof a];
        let valB: any = b[orderBy as keyof typeof b];

        // Handle nested properties or special cases
        if (orderBy === 'date') {
            valA = new Date(a.date).getTime();
            valB = new Date(b.date).getTime();
        } else if (orderBy === 'filament') {
            valA = getFilamentTitle(a.filament).toLowerCase();
            valB = getFilamentTitle(b.filament).toLowerCase();
        }

        if (valA < valB) return order === 'asc' ? -1 : 1;
        if (valA > valB) return order === 'asc' ? 1 : -1;
        return 0;
    }) : [];

    useEffect(() => {
        if (manualLogOpen) {
            api.getAll().then(setAllFilaments).catch(console.error);
            if (!editingLogId && project) {
                setManualLogData(prev => ({ ...prev, is_planned: project.status === ProjectStatus.PLANNING }));
            }
        }
    }, [manualLogOpen, project, editingLogId]);

    const handleSaveManualLog = async () => {
        if (!project || !manualLogData.filamentId || !manualLogData.amount) return;
        try {
            if (editingLogId) {
                await api.updateProjectConsumption(project.id, editingLogId, {
                    ...manualLogData,
                    amount: Number(manualLogData.amount),
                    filamentId: Number(manualLogData.filamentId)
                });
                setSnackbar({ open: true, message: 'Consumption log updated', severity: 'success' });
            } else {
                await api.addProjectConsumption(project.id, {
                    ...manualLogData,
                    amount: Number(manualLogData.amount),
                    filamentId: Number(manualLogData.filamentId)
                });
                setSnackbar({ open: true, message: 'Consumption log added', severity: 'success' });
            }
            setManualLogOpen(false);
            setEditingLogId(null);
            setManualLogData({ filamentId: '', amount: '', type: 'PRINT', notes: '', is_planned: false });
            setSelectedLogFilament(null);
            loadProject(project.id);
        } catch (e) {
            console.error(e);
            setSnackbar({ open: true, message: 'Failed to save log', severity: 'error' });
        }
    };

    const handleDeleteLog = async (logId: number) => {
        if (!project || !confirm(t('common.confirmDelete', 'Are you sure?'))) return;
        try {
            await api.deleteProjectConsumption(project.id, logId);
            setSnackbar({ open: true, message: 'Log deleted', severity: 'success' });
            loadProject(project.id);
        } catch (e) {
            console.error(e);
            setSnackbar({ open: true, message: 'Failed to delete log', severity: 'error' });
        }
    };

    const handleEditLog = (log: any) => {
        setEditingLogId(log.id);
        setSelectedLogFilament(log.filament || null);
        setManualLogData({
            filamentId: log.filament?.id.toString() || '',
            amount: log.amount.toString(),
            type: log.type,
            notes: log.notes || '',
            is_planned: !!log.is_planned
        });
        setManualLogOpen(true);
    };

    useEffect(() => {
        if (projectId) {
            loadProject(Number(projectId));
            // Fetch Feasibility
            api.checkProjectFeasibility(Number(projectId))
                .then(setFeasibility)
                .catch(err => console.error("Feasibility check failed", err));

            // Fetch Organization for Limits
            const orgId = localStorage.getItem('organization_id') || '1';
            fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/organizations/${orgId}`, {
                headers: { 'Authorization': `Bearer ${token}`, 'x-organization-id': orgId },
            }).then(r => r.ok ? r.json() : null)
                .then(setOrganization)
                .catch(err => console.error("Failed to fetch organization", err));
        }
    }, [projectId, token]);

    // Refresh feasibility when project changes (e.g. items added/removed)
    // We can hook into loadProject to refresh feasibility too

    useEffect(() => {
        if (project) {
            setSimConfig({
                print_time_h: (project.print_time_seconds || 0) / 3600,
                labor_time_h: (project.labor_time_seconds || 0) / 3600,
                machine_hourly_rate: project.machine_hourly_rate || 0,
                labor_hourly_rate: project.labor_hourly_rate || 0,
                printer_power_kw: project.printer_power_kw || 0,
                electricity_cost_kwh: project.electricity_cost_kwh || 0,
                misc_costs: project.misc_costs || 0
            });
            // Update New Features
            setTags(project.tags || []);
            setTargetPrice(project.target_selling_price || '');
            setNotes(project.notes || '');
        }
    }, [project]);

    // Derived States
    const totalCost = project ? (
        (project.items?.reduce((acc, item) => {
            // Simulating price fetching logic roughly
            const pricePerG = (item.filament?.price || 20) / (item.filament?.weightInitial || 1000);
            return acc + (item.weight_required_g * pricePerG);
        }, 0) || 0) +
        (Number(simConfig.print_time_h) * Number(simConfig.machine_hourly_rate)) +
        (Number(simConfig.labor_time_h) * Number(simConfig.labor_hourly_rate)) +
        (Number(simConfig.print_time_h) * Number(simConfig.printer_power_kw) * Number(simConfig.electricity_cost_kwh)) +
        Number(simConfig.misc_costs)
    ) : 0;

    const marginValue = targetPrice ? (Number(targetPrice) - totalCost) : 0;
    const marginPercent = targetPrice ? ((marginValue / Number(targetPrice)) * 100) : 0;

    const handleSaveGlobal = async () => {
        if (!project) return;
        setSavingGlobal(true);
        try {
            await api.updateProject(project.id, {
                tags,
                target_selling_price: Number(targetPrice) || 0,
                notes
            });
            // Also save sim config as currently implemented separately but good to sync
            await loadProject(project.id, true);
            setSnackbar({ open: true, message: 'Project settings saved', severity: 'success' });
        } catch (err) {
            console.error(err);
            setSnackbar({ open: true, message: 'Failed to save settings', severity: 'error' });
        } finally {
            setSavingGlobal(false);
        }
    };

    const handleSetCover = async (file: ProjectFile) => {
        if (!project) return;
        try {
            if (!file.file_url) return;
            const safePath = file.file_url.replace(/\\/g, '/');
            const imageUrl = safePath.startsWith('/') ? safePath : `/${safePath}`;
            await api.updateProject(project.id, { image_url: imageUrl });
            setSnackbar({ open: true, message: 'Cover image updated', severity: 'success' });
            await loadProject(project.id, true);
        } catch (e) {
            console.error(e);
            setSnackbar({ open: true, message: 'Failed to update cover', severity: 'error' });
        }
    };

    const handleSaveConfig = async () => {
        if (!project) return;
        try {
            setSavingSim(true);
            await api.updateProject(project.id, {
                print_time_seconds: Number(simConfig.print_time_h) * 3600,
                labor_time_seconds: Number(simConfig.labor_time_h) * 3600,
                machine_hourly_rate: Number(simConfig.machine_hourly_rate),
                labor_hourly_rate: Number(simConfig.labor_hourly_rate),
                printer_power_kw: Number(simConfig.printer_power_kw),
                electricity_cost_kwh: Number(simConfig.electricity_cost_kwh),
                misc_costs: Number(simConfig.misc_costs),
                target_selling_price: Number(targetPrice) || 0
            });
            await loadProject(project.id, true);
            setSnackbar({ open: true, message: t('projects.configSaved', 'Configuration saved successfully'), severity: 'success' });
        } catch (err) {
            console.error(err);
            setSnackbar({ open: true, message: t('projects.configSaveError', 'Failed to save configuration'), severity: 'error' });
        } finally {
            setSavingSim(false);
        }
    };

    const handleAnalyzeFile = async (file: ProjectFile) => {
        if (file.analysis_metadata) {
            setPendingAnalysisResult(file.analysis_metadata);
            setPendingFileName(file.file_name);
            setIsGCodeAnalysisOpen(true);
            return;
        }

        if (!file.file_url) {
            setSnackbar({ open: true, message: 'File is no longer available on disk', severity: 'error' });
            return;
        }

        try {
            const apiUrl = BASE_URL.replace(/\/$/, '');
            let path = file.file_url.replace(/\\/g, '/');
            if (path.startsWith('/')) path = path.slice(1);

            const url = (path.startsWith('http') || path.startsWith('blob'))
                ? path
                : `${apiUrl}/${path}`;

            const isLocalApi = url.startsWith(apiUrl);
            const headers: Record<string, string> = {};
            if (isLocalApi && token) {
                headers['Authorization'] = `Bearer ${token}`;
                const orgId = localStorage.getItem('organization_id');
                if (orgId) headers['x-organization-id'] = orgId;
            }

            const response = await fetch(url, { headers });
            if (!response.ok) throw new Error("Failed to fetch file");

            const blob = await response.blob();
            // Create a File object (needed by GCodeAnalysisDialog)
            const fileObj = new File([blob], file.file_name, { type: 'text/x-gcode' });

            setPendingUploadFile(fileObj);
            setPendingFileName(file.file_name);
            setIsGCodeAnalysisOpen(true);
        } catch (e) {
            console.error(e);
            setSnackbar({ open: true, message: 'Failed to retrieve file for analysis', severity: 'error' });
        }
    };

    const handleManualRerunAnalysis = async (fileId: number) => {
        if (!window.confirm("This will analyze the file, store metadata, and DELETE the physical file from the server. Continue?")) return;
        try {
            setSavingGlobal(true);
            await api.analyzeProjectFile(parseInt(projectId!), fileId);
            setSnackbar({ open: true, message: 'Analysis completed successfully. File converted to metadata.', severity: 'success' });
            await loadProject(parseInt(projectId!), true);
        } catch (error) {
            console.error("Manual analysis failed", error);
            setSnackbar({ open: true, message: 'Failed to rerun analysis.', severity: 'error' });
        } finally {
            setSavingGlobal(false);
        }
    };

    const loadProject = async (projectId: number, silent = false) => {
        try {
            if (!silent) setLoading(true);
            const data = await api.getProject(projectId);
            setProject(data);
        } catch (error) {
            console.error(error);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const handleRemoveItem = async (itemId: number) => {
        if (!project || !confirm(t('common.confirmDelete'))) return;
        try {
            await api.removeProjectItem(project.id, itemId);
            await loadProject(project.id, true);
        } catch (error) {
            console.error(error);
        }
    };

    const handleFileSelect = (file: File) => {
        const ext = file.name.split('.').pop()?.toLowerCase();
        const limits = organization?.stats?.limits;
        const maxMb = (limits?.maxFileUploadSizeMb === null) ? 5120 : (limits?.maxFileUploadSizeMb || 10);
        const maxBytes = maxMb * 1024 * 1024;

        // Check total file limit (New)
        const currentFileCount = project?.files?.length || 0;
        const maxFiles = (limits?.maxFilesPerProject === null || limits?.maxFilesPerProject === undefined) 
            ? Infinity 
            : limits.maxFilesPerProject;

        if (maxFiles !== Infinity && currentFileCount >= maxFiles) {
            setSnackbar({ 
                open: true, 
                message: `Limite de fichiers atteinte pour votre plan (${maxFiles}). Veuillez supprimer un fichier existant.`, 
                severity: 'error' 
            });
            return;
        }

        // Size Limit check
        if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext || '')) {
            if (file.size > 5 * 1024 * 1024) {
                setSnackbar({ open: true, message: 'Image size limit is 5MB', severity: 'error' });
                return;
            }
        } else {
            // Check dynamic size limit for GCode/Models/etc
            if (file.size > maxBytes) {
                setSnackbar({ open: true, message: `File size limit is ${maxMb}MB for your plan`, severity: 'error' });
                return;
            }
        }

        if (['gcode', 'gc', '3mf'].includes(ext || '')) {
            setPendingUploadFile(file);
            setUploadChoiceOpen(true);
        } else {
            // Normal upload
            doUpload(file);
        }
    };

    const doUpload = async (file: File) => {
        if (!project) return;
        try {
            setLoading(true);
            await api.uploadProjectFile(project.id, file);
            await loadProject(project.id, true);
            setLoading(false);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    const handleUploadChoice = (mode: 'simple' | 'production') => {
        setUploadChoiceOpen(false);
        if (!pendingUploadFile) return;

        if (mode === 'simple') {
            doUpload(pendingUploadFile);
        } else {
            // Production: Upload Check file AND Open Analysis
            // We should upload the file first so it's in the project
            doUpload(pendingUploadFile).then(() => {
                // Then open wizard for consumption/BOM
                setIsGCodeAnalysisOpen(true);
            });
        }
    };

    const handleDeleteFile = async (fileId: number) => {
        if (!project || !confirm(t('common.confirmDelete'))) return;
        try {
            await api.deleteProjectFile(project.id, fileId);
            await loadProject(project.id, true);
        } catch (e) {
            console.error("Failed to delete file", e);
        }
    };

    const handleImportFromPrinter = async (serial: string, filename: string) => {
        try {
            setLoading(true);
            const blob = await downloadFile(serial, filename);
            // Ensure filename has a valid extension for the backend filter
            let finalName = filename;
            if (!finalName.toLowerCase().match(/\.(gcode|gc|3mf)$/)) {
                finalName = `${finalName}.gcode`;
            }
            const file = new File([blob], finalName, { type: 'text/x-gcode' }); // Assume GCode

            // 1. Upload to Project
            await doUpload(file);

            // 2. Open Analysis
            setPendingUploadFile(file);
            setIsGCodeAnalysisOpen(true);

            setSnackbar({ open: true, message: 'Imported from printer', severity: 'success' });
        } catch (e) {
            console.error(e);
            setSnackbar({ open: true, message: 'Failed to import from printer', severity: 'error' });
            setLoading(false);
        }
    };

    const handleUpdateProject = async (updates: Partial<Project>) => {
        if (!project) return;

        // If status is changing to COMPLETED and we have planned consumptions
        if (updates.status === ProjectStatus.COMPLETED && project.status !== ProjectStatus.COMPLETED) {
            const hasPlanned = project.consumptionLogs?.some(l => l.is_planned);
            if (hasPlanned) {
                setPendingStatusUpdates(updates);
                setConvertDialogOpen(true);
                return; // Wait for dialog
            }
        }

        try {
            await api.updateProject(project.id, updates);
            await loadProject(project.id, true);
        } catch (error) {
            console.error(error);
        }
    };

    const handleConfirmConversion = async (shouldConvert: boolean) => {
        if (!project || !pendingStatusUpdates) return;
        setConvertDialogOpen(false);
        setConverting(true);

        try {
            if (shouldConvert) {
                await api.convertProjectConsumptions(project.id);
                setSnackbar({ open: true, message: 'Consommations converties en consommations réelles', severity: 'success' });
            }
            // In both cases, update the project status
            await api.updateProject(project.id, pendingStatusUpdates);
            await loadProject(project.id, true);
        } catch (error) {
            console.error(error);
            setSnackbar({ open: true, message: 'Erreur lors de la mise à jour', severity: 'error' });
        } finally {
            setConverting(false);
            setPendingStatusUpdates(null);
        }
    };

    const handleDeleteProject = async () => {
        if (!project) return;
        try {
            await api.deleteProject(project.id, deleteConsumptions);
            setSnackbar({ open: true, message: 'Project deleted', severity: 'success' });
            navigate('/projects');
        } catch (err) {
            console.error(err);
            setSnackbar({ open: true, message: 'Failed to delete project', severity: 'error' });
        } finally {
            setDeleteDialogOpen(false);
        }
    };

    if (loading) return <LinearProgress />;
    if (!project) return <Typography>{t('projects.notFound')}</Typography>;

    const getStatusColor = (status: ProjectStatus) => {
        switch (status) {
            case ProjectStatus.PLANNING: return 'info';
            case ProjectStatus.IN_PROGRESS: return 'warning';
            case ProjectStatus.COMPLETED: return 'success';
            case ProjectStatus.ARCHIVED: return 'default';
            default: return 'default';
        }
    };

    const getHealthColor = (status: string) => {
        switch (status) {
            case 'OK': return 'success';
            case 'RISK': return 'warning';
            case 'CRITICAL': return 'error';
            default: return 'default';
        }
    };

    // Function to render Health Badge
    const renderHealthBadge = () => {
        if (!feasibility) return null;
        if (feasibility.overallStatus === 'RESTRICTED') {
            return (
                <Tooltip title={t('dashboard.upgradeToProRisk')}>
                    <Chip
                        label="👑 Pro"
                        size="small"
                        sx={{ fontWeight: 'bold', bgcolor: 'rgba(79, 70, 229, 0.1)', color: '#4F46E5' }}
                    />
                </Tooltip>
            );
        }
        return (
            <Tooltip title={feasibility.overallStatus === 'OK' ? t('projects.stockVerified') : t('projects.stockIssues')}>
                <Chip
                    label={feasibility.overallStatus === 'OK' ? t('projects.stockOk') : (feasibility.overallStatus === 'RISK' ? t('projects.lowStock') : t('projects.missingStock'))}
                    color={getHealthColor(feasibility.overallStatus) as any}
                    variant={feasibility.overallStatus === 'OK' ? 'outlined' : 'filled'}
                    size="small"
                    icon={feasibility.overallStatus === 'OK' ? <Inventory2 fontSize='small' /> : <Assessment fontSize='small' />}
                    sx={{ fontWeight: 'bold' }}
                />
            </Tooltip>
        );
    };

    const totalMaterialCost = (project.items || []).reduce((sum, item) => {
        const filament = item.filament;
        if (!filament) return sum;
        const price = filament.price || 0;
        const weight = filament.weightInitial || 1000;
        if (weight === 0) return sum;
        return sum + ((item.weight_required_g / weight) * price);
    }, 0);

    const displayCost = project.global_cost || totalMaterialCost;

    return (
        <Box sx={{ p: 3, maxWidth: 1600, mx: 'auto' }}>
            {/* Header */}
            <Button
                startIcon={<ArrowBack />}
                onClick={() => navigate('/projects')}
                sx={{ mb: 2, color: 'text.secondary' }}
            >
                {t('common.back')}
            </Button>

            <Grid container spacing={4}>
                <Grid size={{ xs: 12 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                        <Box>
                            <Box display="flex" alignItems="center" gap={2}>
                                <Typography variant="h4" component="h1">
                                    {project.name}
                                </Typography>
                                <Chip
                                    label={t(`projects.status_${project.status}`)}
                                    color={getStatusColor(project.status) as any}
                                    size="small"
                                    sx={{ fontWeight: 600 }}
                                />
                                {renderHealthBadge()}
                                {/* <IconButton size="small" onClick={() => setIsEditOpen(true)}>
                                    <Edit fontSize="small" />
                                </IconButton>
                                <IconButton size="small" onClick={() => setDeleteDialogOpen(true)}>
                                    <Delete fontSize="small" />
                                </IconButton> */}
                            </Box>
                            {/* <Box mt={1} display="flex" alignItems="center" gap={1}>
                                <Autocomplete
                                    multiple
                                    freeSolo
                                    options={[]}
                                    value={tags}
                                    onChange={(_, newValue) => {
                                        setTags(newValue);
                                        // Auto-save tags for better UX? or wait for manual save
                                    }}
                                    renderTags={(value: readonly string[], getTagProps) =>
                                        value.map((option: string, index: number) => (
                                            <Chip variant="outlined" size="small" label={option} {...getTagProps({ index })} />
                                        ))
                                    }
                                    renderInput={(params) => (
                                        <TextField {...params} variant="standard" placeholder="Add Tags..." sx={{ minWidth: 200 }} />
                                    )}
                                />
                                <IconButton onClick={handleSaveGlobal} color="primary" disabled={savingGlobal}>
                                    <Save />
                                </IconButton>
                            </Box> */}
                        </Box>
                        <Box display="flex" gap={1}>
                            <Button
                                startIcon={<Edit />}
                                variant="contained"
                                size="small"
                                onClick={() => setIsEditOpen(true)}
                            >
                                {t('projects.edit')}
                            </Button>
                            <Button
                                startIcon={<Assessment />}
                                variant="outlined"
                                size="small"
                                onClick={async () => {
                                    if (!project) return;
                                    try {
                                        setSnackbar({ open: true, message: 'Generating report...', severity: 'success' });
                                        const blob = await api.getProjectReport(project.id, i18n.language);
                                        const url = window.URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `project_report_${project.id}.xlsx`;
                                        document.body.appendChild(a);
                                        a.click();
                                        window.URL.revokeObjectURL(url);
                                        document.body.removeChild(a);
                                        setSnackbar({ open: true, message: 'Report downloaded', severity: 'success' });
                                    } catch (e) {
                                        console.error(e);
                                        setSnackbar({ open: true, message: 'Failed to generate report', severity: 'error' });
                                    }
                                }}
                            >
                                {t('projects.exportReport', 'Export Report')}
                            </Button>
                            <Button
                                startIcon={<Delete />}
                                variant="outlined"
                                color="error"
                                size="small"
                                onClick={() => setDeleteDialogOpen(true)}
                            >
                                {t('common.delete')}
                            </Button>
                        </Box>
                    </Box>
                    <Paper elevation={0} sx={{ border: `1px solid ${theme.palette.divider} `, borderRadius: 3, overflow: 'hidden' }}>
                        <Tabs
                            value={tabValue}
                            onChange={(_, v) => setTabValue(v)}
                            variant="scrollable"
                            scrollButtons="auto"
                            sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
                        >
                            <Tab label={t('projects.overview')} icon={<Layers />} iconPosition="start" />
                            <Tab label={t('projects.bom')} icon={<Inventory2 />} iconPosition="start" />
                            <Tab label={t('projects.files')} icon={<Description />} iconPosition="start" />
                            <Tab label={t('projects.history')} icon={<HistoryIcon />} iconPosition="start" />
                            <Tab label={t('projects.costSimulator')} icon={<Calculate />} iconPosition="start" />

                        </Tabs>

                        <Box sx={{ p: 3 }}>
                            {/* TAB 0: Overview */}
                            {tabValue === 0 && (
                                <Box>
                                    {/* Feasibility Alert */}
                                    {feasibility && feasibility.overallStatus !== 'OK' && feasibility.overallStatus !== 'RESTRICTED' && (
                                        <Alert severity={feasibility.overallStatus === 'CRITICAL' ? 'error' : 'warning'} sx={{ mb: 3, borderRadius: 2 }}>
                                            <Typography variant="subtitle2" fontWeight="bold">
                                                {feasibility.overallStatus === 'CRITICAL' ? t('projects.stockShortage') : t('projects.stockWarning')}
                                            </Typography>
                                            <List dense>
                                                {feasibility.items.filter(i => i.status !== 'OK').map(item => (
                                                    <ListItem key={item.itemId} disablePadding>
                                                        <ListItemText
                                                            primary={`Missing ${Math.round(item.remainingNeeded - item.stockAvailable)}g for ${item.formattedName}`}
                                                            secondary={`Available: ${Math.round(item.stockAvailable)}g / Required: ${Math.round(item.remainingNeeded)}g`}
                                                        />
                                                    </ListItem>
                                                ))}
                                            </List>
                                        </Alert>
                                    )}

                                    {/* Stat Cards Row */}
                                    <Grid container spacing={2} sx={{ mb: 3 }}>
                                        <Grid size={{ xs: 6, md: 3 }}>
                                            <Card variant="outlined" sx={{ borderRadius: 2, height: '100%' }}>
                                                <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', py: 2.5 }}>
                                                    <Box sx={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'primary.main', color: 'white', mb: 1 }}>
                                                        <AttachMoney fontSize="small" />
                                                    </Box>
                                                    <Typography variant="caption" color="text.secondary">{t('projects.totalCost')}</Typography>
                                                    <Typography variant="h5" fontWeight="bold" color="primary.main">
                                                        {displayCost > 0 ? `${displayCost.toFixed(2)}€` : '-'}
                                                    </Typography>
                                                    {!project.global_cost && displayCost > 0 && <Typography variant="caption" color="text.disabled">({t('projects.estMaterial')})</Typography>}
                                                </CardContent>
                                            </Card>
                                        </Grid>
                                        <Grid size={{ xs: 6, md: 3 }}>
                                            <Card variant="outlined" sx={{ borderRadius: 2, height: '100%' }}>
                                                <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', py: 2.5 }}>
                                                    <Box sx={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'success.main', color: 'white', mb: 1 }}>
                                                        <Inventory2 fontSize="small" />
                                                    </Box>
                                                    <Typography variant="caption" color="text.secondary">{t('projects.materials')}</Typography>
                                                    <Typography variant="h5" fontWeight="bold">{project.items?.length || 0}</Typography>
                                                </CardContent>
                                            </Card>
                                        </Grid>
                                        <Grid size={{ xs: 6, md: 3 }}>
                                            <Card variant="outlined" sx={{ borderRadius: 2, height: '100%' }}>
                                                <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', py: 2.5 }}>
                                                    <Box sx={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'info.main', color: 'white', mb: 1 }}>
                                                        <FolderOpen fontSize="small" />
                                                    </Box>
                                                    <Typography variant="caption" color="text.secondary">{t('projects.files')}</Typography>
                                                    <Typography variant="h5" fontWeight="bold">{project.files?.length || 0}</Typography>
                                                </CardContent>
                                            </Card>
                                        </Grid>
                                        <Grid size={{ xs: 6, md: 3 }}>
                                            <Card variant="outlined" sx={{ borderRadius: 2, height: '100%' }}>
                                                <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', py: 2.5 }}>
                                                    <Box sx={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'warning.main', color: 'white', mb: 1 }}>
                                                        <EventNote fontSize="small" />
                                                    </Box>
                                                    <Typography variant="caption" color="text.secondary">{t('projects.dates')}</Typography>
                                                    <Typography variant="body1" fontWeight="bold">
                                                        {project.start_date ? new Date(project.start_date).toLocaleDateString() : '-'}
                                                    </Typography>
                                                    {project.end_date && (
                                                        <Typography variant="caption" color="text.secondary">
                                                            → {new Date(project.end_date).toLocaleDateString()}
                                                        </Typography>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        </Grid>
                                    </Grid>

                                    {/* Description */}
                                    {project.description && (
                                        <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2, bgcolor: 'action.hover' }}>
                                            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>{project.description}</Typography>
                                        </Paper>
                                    )}

                                    <Grid container spacing={3}>
                                        {/* Notes Card */}
                                        <Grid size={{ xs: 12, md: 6 }}>
                                            <Paper sx={{ p: 2.5, height: '100%', borderRadius: 2 }} variant="outlined">
                                                <Typography variant="subtitle2" gutterBottom fontWeight="bold">{t('projects.projectNotes')}</Typography>
                                                <TextField
                                                    multiline
                                                    minRows={3}
                                                    maxRows={6}
                                                    fullWidth
                                                    value={notes}
                                                    onChange={(e) => setNotes(e.target.value)}
                                                    placeholder={t('projects.notesPlaceholder')}
                                                    variant="outlined"
                                                    size="small"
                                                />
                                                <Box mt={1.5} display="flex" justifyContent="flex-end">
                                                    <Button size="small" variant="outlined" startIcon={<Save />} onClick={handleSaveGlobal} disabled={savingGlobal}>
                                                        {t('common.save')}
                                                    </Button>
                                                </Box>
                                            </Paper>
                                        </Grid>

                                        {/* Gallery */}
                                        <Grid size={{ xs: 12, md: 6 }}>
                                            <Paper sx={{ p: 2.5, height: '100%', borderRadius: 2 }} variant="outlined">
                                                <Typography variant="subtitle2" gutterBottom fontWeight="bold">{t('projects.gallery')}</Typography>
                                                <Grid container spacing={1.5}>
                                                    {project.files?.filter(f => ['IMAGE', 'jpg', 'png', 'webp'].includes(f.file_type) || f.file_name.match(/\.(jpg|jpeg|png|webp)$/i))
                                                        .map((file) => (
                                                            <Grid size={{ xs: 6 }} key={file.id}>
                                                                <Card sx={{ position: 'relative', borderRadius: 2, overflow: 'hidden' }}>
                                                                    {(() => {
                                                                        const apiUrl = BASE_URL.replace(/\/$/, '');
                                                                        const pathRaw = file.file_url || '';
                                                                        let path = pathRaw.replace(/\\/g, '/');
                                                                        if (path.startsWith('/')) path = path.slice(1);
                                                                        const url = (path.startsWith('http') || path.startsWith('blob'))
                                                                            ? path
                                                                            : `${apiUrl}/${path}`;
                                                                        return (
                                                                            <SecureImage
                                                                                src={url}
                                                                                alt={file.file_name}
                                                                                style={{ width: '100%', height: 120, objectFit: 'cover' }}
                                                                            />
                                                                        );
                                                                    })()}
                                                                    <CardActions sx={{ position: 'absolute', top: 4, right: 4, p: 0 }}>
                                                                        <IconButton
                                                                            size="small"
                                                                            onClick={() => handleSetCover(file)}
                                                                            title="Set as Cover"
                                                                            sx={{ bgcolor: 'rgba(255,255,255,0.85)', '&:hover': { bgcolor: 'white' }, boxShadow: 1 }}
                                                                        >
                                                                            {project.image_url === file.file_url ? <Star color="primary" fontSize="small" /> : <StarBorder fontSize="small" />}
                                                                        </IconButton>
                                                                    </CardActions>
                                                                </Card>
                                                            </Grid>
                                                        ))}
                                                    {(!project.files?.some(f => ['IMAGE', 'jpg', 'png', 'webp'].includes(f.file_type) || f.file_name.match(/\.(jpg|jpeg|png|webp)$/i))) && (
                                                        <Grid size={{ xs: 12 }}>
                                                            <Typography variant="body2" color="text.secondary" align="center" py={3} sx={{ bgcolor: 'action.hover', borderRadius: 2 }}>
                                                                {t('projects.noImages')}
                                                            </Typography>
                                                        </Grid>
                                                    )}
                                                </Grid>
                                            </Paper>
                                        </Grid>
                                    </Grid>

                                    <ProjectEditDialog
                                        open={isEditOpen}
                                        onClose={() => setIsEditOpen(false)}
                                        project={project}
                                        onSave={handleUpdateProject}
                                    />
                                </Box>
                            )}

                            {tabValue === 1 && (
                                <Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                                        <Typography variant="h6">{t('projects.bom')}</Typography>
                                        <Button
                                            startIcon={<Add />}
                                            variant="outlined"
                                            size="small"
                                            onClick={() => setIsAddMaterialOpen(true)}
                                        >
                                            {t('projects.addMaterial')}
                                        </Button>
                                    </Box>
                                    <List>
                                        {((project.items as ProjectItem[]) || []).map((item) => (
                                            <ListItem
                                                key={item.id}
                                                divider
                                                secondaryAction={
                                                    <>
                                                        <IconButton edge="end" aria-label="delete" onClick={() => handleRemoveItem(item.id)} color="error">
                                                            <Delete fontSize="small" />
                                                        </IconButton>
                                                    </>
                                                }
                                            >
                                                <Box sx={{ mr: 1.5, display: 'inline-flex' }}>
                                                    <ColorIndicator colors={[item.filament?.color || '#ccc', ...(item.filament?.colors || [])]} size={18} />
                                                </Box>
                                                <ListItemText
                                                    primary={item.filament ? getFilamentTitle(item.filament) : 'Unknown Filament'}
                                                    secondary={`${item.weight_required_g}g • ${((item.weight_required_g / (item.filament?.weightInitial || 1000)) * (item.filament?.price || 0)).toFixed(2)}€`}
                                                />
                                            </ListItem>
                                        ))}
                                        {(!project.items || project.items.length === 0) && (
                                            <Typography color="text.secondary">{t('projects.noItems')}</Typography>
                                        )}
                                    </List>
                                </Box>
                            )}

                            {tabValue === 2 && (() => {
                                const limits = organization?.stats?.limits;
                                const maxFiles = (limits?.maxFilesPerProject === null || limits?.maxFilesPerProject === undefined) ? Infinity : limits.maxFilesPerProject;
                                const currentCount = project.files?.length || 0;
                                const percent = maxFiles === Infinity ? 0 : (currentCount / maxFiles) * 100;
                                const isFull = maxFiles !== Infinity && currentCount >= maxFiles;

                                return (
                                    <Box>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                                            <Typography variant="h6">{t('projects.files')}</Typography>
                                            <Box display="flex" gap={1}>
                                                <Button
                                                    variant="outlined"
                                                    size="small"
                                                    startIcon={<PrinterIcon />}
                                                    onClick={(e) => setPrinterMenuAnchor(e.currentTarget)}
                                                    disabled={Object.keys(printers).length === 0}
                                                >
                                                    Import from Printer
                                                </Button>
                                                <Button
                                                    component="label"
                                                    startIcon={<CloudUpload />}
                                                    variant="outlined"
                                                    size="small"
                                                    disabled={isFull}
                                                >
                                                    {t('projects.uploadFile')}
                                                    <input
                                                        type="file"
                                                        hidden
                                                        onChange={(e) => {
                                                            if (e.target.files && e.target.files[0]) {
                                                                handleFileSelect(e.target.files[0]);
                                                            }
                                                            e.target.value = '';
                                                        }}
                                                    />
                                                </Button>
                                            </Box>
                                            <Menu
                                                anchorEl={printerMenuAnchor}
                                                open={Boolean(printerMenuAnchor)}
                                                onClose={() => setPrinterMenuAnchor(null)}
                                            >
                                                {Object.values(printers).map(p => (
                                                    <MenuItem
                                                        key={p.serial}
                                                        onClick={() => {
                                                            if (p.data?.file) {
                                                                handleImportFromPrinter(p.serial, p.data.file);
                                                            }
                                                            setPrinterMenuAnchor(null);
                                                        }}
                                                        disabled={!p.data?.file}
                                                    >
                                                        <Box>
                                                            <Typography variant="body2" fontWeight="bold">
                                                                {p.name || p.serial}
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary" display="block">
                                                                {p.data?.file || "No active file"}
                                                            </Typography>
                                                        </Box>
                                                    </MenuItem>
                                                ))}
                                            </Menu>
                                        </Box>

                                        {/* Quota Indicator */}
                                        <Box sx={{ mb: 3, p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
                                            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                                                <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                                    {t('projects.fileQuota', 'Quota de fichiers')} ({currentCount} / {maxFiles === Infinity ? '∞' : maxFiles})
                                                </Typography>
                                                {maxFiles !== Infinity && (
                                                    <Typography variant="caption" fontWeight="bold" color={isFull ? 'error.main' : 'text.secondary'}>
                                                        {Math.round(percent)}%
                                                    </Typography>
                                                )}
                                            </Box>
                                            {maxFiles !== Infinity && (
                                                <LinearProgress 
                                                    variant="determinate" 
                                                    value={percent > 100 ? 100 : percent} 
                                                    color={isFull ? 'error' : percent > 80 ? 'warning' : 'primary'}
                                                    sx={{ height: 6, borderRadius: 3 }}
                                                />
                                            )}
                                            {isFull && (
                                                <Typography variant="caption" color="error.main" sx={{ mt: 1, display: 'block', fontWeight: 500 }}>
                                                    {t('projects.quotaReached', 'Limite atteinte. Veuillez supprimer un fichier pour en ajouter un nouveau.')}
                                                </Typography>
                                            )}
                                        </Box>

                                        <List>
                                            {((project.files as ProjectFile[]) || []).map((file) => (
                                                <ListItem
                                                    key={file.id}
                                                    divider
                                                    secondaryAction={
                                                        <IconButton size="small" onClick={() => handleDeleteFile(file.id)}>
                                                            <Delete fontSize="small" />
                                                        </IconButton>
                                                    }
                                                >
                                                    <ListItemText
                                                        primary={file.file_name}
                                                        secondary={`${file.file_type} • ${((file.file_size || 0) / 1024).toFixed(1)} KB`}
                                                    />
                                                    <IconButton
                                                        size="small"
                                                        disabled={!file.file_url}
                                                        component="a"
                                                        href={file.file_url ? (() => {
                                                            const apiUrl = BASE_URL.replace(/\/$/, '');
                                                            let path = file.file_url.replace(/\\/g, '/');
                                                            if (path.startsWith('/')) path = path.slice(1);
                                                            return (path.startsWith('http') || path.startsWith('blob')) ? path : `${apiUrl}/${path}`;
                                                        })() : undefined}
                                                        target="_blank"
                                                        title={file.file_url ? "Download/View File" : "File deleted after analysis"}
                                                    >
                                                        <CloudDownload sx={{ fontSize: 16, opacity: file.file_url ? 1 : 0.3 }} />
                                                    </IconButton>
                                                    {(file.file_type === 'GCODE' || file.analysis_metadata || file.file_name.toLowerCase().endsWith('.gcode') || file.file_name.toLowerCase().endsWith('.gc') || file.file_name.toLowerCase().endsWith('.3mf')) && (
                                                        <Box sx={{ display: 'flex' }}>
                                                            <IconButton size="small" onClick={() => handleAnalyzeFile(file)} title="Analyze Consumption">
                                                                <Assessment sx={{ fontSize: 16 }} />
                                                            </IconButton>
                                                            {file.file_url && (
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() => handleManualRerunAnalysis(file.id)}
                                                                    title="Rerun Analysis (Save to Cloud & Delete Local)"
                                                                >
                                                                    <Refresh sx={{ fontSize: 16 }} />
                                                                </IconButton>
                                                            )}
                                                        </Box>
                                                    )}
                                                </ListItem>
                                            ))}
                                            {(!project.files || project.files.length === 0) && (
                                                <Typography color="text.secondary">{t('projects.noFiles')}</Typography>
                                            )}
                                        </List>
                                    </Box>
                                );
                            })()}

                            {tabValue === 4 && (() => {
                                const machineCost = Number(simConfig.print_time_h) * Number(simConfig.machine_hourly_rate);
                                const laborCost = Number(simConfig.labor_time_h) * Number(simConfig.labor_hourly_rate);
                                const electricityCost = Number(simConfig.print_time_h) * Number(simConfig.printer_power_kw) * Number(simConfig.electricity_cost_kwh);
                                const otherCosts = machineCost + laborCost + electricityCost + Number(simConfig.misc_costs);
                                const grandTotal = totalMaterialCost + otherCosts;

                                return (
                                    <Box>
                                        {/* Summary Cards Row */}
                                        <Grid container spacing={2} sx={{ mb: 3 }}>
                                            <Grid size={{ xs: 12, md: 4 }}>
                                                <Card variant="outlined" sx={{ borderRadius: 2, height: '100%' }}>
                                                    <CardContent sx={{ textAlign: 'center', py: 2.5 }}>
                                                        <Box sx={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'primary.main', color: 'white', mb: 1, mx: 'auto' }}>
                                                            <Inventory2 fontSize="small" />
                                                        </Box>
                                                        <Typography variant="caption" color="text.secondary">{t('projects.materialCost')}</Typography>
                                                        <Typography variant="h5" fontWeight="bold" color="primary.main">{totalMaterialCost.toFixed(2)}€</Typography>
                                                        <Typography variant="caption" color="text.disabled">
                                                            {t('projects.basedOnItems', { count: project.items?.length || 0 })}
                                                        </Typography>
                                                    </CardContent>
                                                </Card>
                                            </Grid>
                                            <Grid size={{ xs: 12, md: 4 }}>
                                                <Card variant="outlined" sx={{ borderRadius: 2, height: '100%' }}>
                                                    <CardContent sx={{ textAlign: 'center', py: 2.5 }}>
                                                        <Box sx={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'warning.main', color: 'white', mb: 1, mx: 'auto' }}>
                                                            <Calculate fontSize="small" />
                                                        </Box>
                                                        <Typography variant="caption" color="text.secondary">{t('projects.laborCost')}</Typography>
                                                        <Typography variant="h5" fontWeight="bold" color="warning.main">{otherCosts.toFixed(2)}€</Typography>
                                                    </CardContent>
                                                </Card>
                                            </Grid>
                                            <Grid size={{ xs: 12, md: 4 }}>
                                                <Card variant="outlined" sx={{ borderRadius: 2, height: '100%', borderColor: 'success.main', borderWidth: 2 }}>
                                                    <CardContent sx={{ textAlign: 'center', py: 2.5 }}>
                                                        <Box sx={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'success.main', color: 'white', mb: 1, mx: 'auto' }}>
                                                            <AttachMoney fontSize="small" />
                                                        </Box>
                                                        <Typography variant="caption" color="text.secondary">{t('projects.estimatedTotal')}</Typography>
                                                        <Typography variant="h4" fontWeight="bold" color="success.main">{grandTotal.toFixed(2)}€</Typography>
                                                    </CardContent>
                                                </Card>
                                            </Grid>
                                        </Grid>

                                        {/* Cost Breakdown */}
                                        <Paper variant="outlined" sx={{ borderRadius: 2, mb: 3, overflow: 'hidden' }}>
                                            <Table size="small">
                                                <TableHead>
                                                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                                                        <TableCell sx={{ fontWeight: 'bold' }}>{t('common.type', 'Type')}</TableCell>
                                                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>{t('consumption.amount', 'Amount')}</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    <TableRow>
                                                        <TableCell>{t('projects.materialCost')}</TableCell>
                                                        <TableCell align="right">{totalMaterialCost.toFixed(2)}€</TableCell>
                                                    </TableRow>
                                                    {machineCost > 0 && (
                                                        <TableRow>
                                                            <TableCell>{t('projects.machineCostLine')} ({simConfig.print_time_h}h × {simConfig.machine_hourly_rate}€/h)</TableCell>
                                                            <TableCell align="right">{machineCost.toFixed(2)}€</TableCell>
                                                        </TableRow>
                                                    )}
                                                    {electricityCost > 0 && (
                                                        <TableRow>
                                                            <TableCell>{t('projects.electricityCost')} ({simConfig.print_time_h}h × {simConfig.printer_power_kw}kW × {simConfig.electricity_cost_kwh}€)</TableCell>
                                                            <TableCell align="right">{electricityCost.toFixed(2)}€</TableCell>
                                                        </TableRow>
                                                    )}
                                                    {laborCost > 0 && (
                                                        <TableRow>
                                                            <TableCell>{t('projects.laborCostLine')} ({simConfig.labor_time_h}h × {simConfig.labor_hourly_rate}€/h)</TableCell>
                                                            <TableCell align="right">{laborCost.toFixed(2)}€</TableCell>
                                                        </TableRow>
                                                    )}
                                                    {Number(simConfig.misc_costs) > 0 && (
                                                        <TableRow>
                                                            <TableCell>{t('projects.miscCostLine')}</TableCell>
                                                            <TableCell align="right">{Number(simConfig.misc_costs).toFixed(2)}€</TableCell>
                                                        </TableRow>
                                                    )}
                                                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                                                        <TableCell sx={{ fontWeight: 'bold' }}>{t('projects.totalCost')}</TableCell>
                                                        <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{grandTotal.toFixed(2)}€</TableCell>
                                                    </TableRow>
                                                </TableBody>
                                            </Table>
                                        </Paper>

                                        {/* Selling Price & Margin */}
                                        <Paper variant="outlined" sx={{ borderRadius: 2, p: 2.5, mb: 3 }}>
                                            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>{t('projects.margin')}</Typography>
                                            <Grid container spacing={2} alignItems="center">
                                                <Grid size={{ xs: 12, md: 4 }}>
                                                    <TextField
                                                        label={t('projects.sellingPrice')}
                                                        type="text"
                                                        fullWidth
                                                        size="small"
                                                        value={targetPrice}
                                                        onChange={(e) => setTargetPrice(normalizeNumericInput(e.target.value))}
                                                    />
                                                </Grid>
                                                <Grid size={{ xs: 12, md: 8 }}>
                                                    {targetPrice && Number(targetPrice) > 0 ? (
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                                            <Box>
                                                                <Typography variant="caption" color="text.secondary">{t('projects.margin')}</Typography>
                                                                <Typography variant="h5" fontWeight="bold" color={marginValue > 0 ? "success.main" : "error.main"}>
                                                                    {marginValue.toFixed(2)}€
                                                                </Typography>
                                                            </Box>
                                                            <Chip
                                                                label={`${marginPercent.toFixed(1)}%`}
                                                                color={marginPercent > 20 ? 'success' : marginPercent > 0 ? 'warning' : 'error'}
                                                                size="small"
                                                                sx={{ fontWeight: 'bold', fontSize: '0.9rem' }}
                                                            />
                                                        </Box>
                                                    ) : (
                                                        <Typography variant="body2" color="text.disabled" sx={{ fontStyle: 'italic' }}>
                                                            {t('projects.sellingPrice')}...
                                                        </Typography>
                                                    )}
                                                </Grid>
                                            </Grid>
                                        </Paper>

                                        {/* Configuration Form */}
                                        <Paper variant="outlined" sx={{ borderRadius: 2, p: 2.5 }}>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                                <Typography variant="subtitle2" fontWeight="bold">{t('projects.configuration')}</Typography>
                                                <Button
                                                    variant="contained"
                                                    onClick={handleSaveConfig}
                                                    disabled={savingSim}
                                                    startIcon={<Save />}
                                                    size="small"
                                                >
                                                    {savingSim ? t('common.loading') : t('common.save')}
                                                </Button>
                                            </Box>
                                            <Grid container spacing={2}>
                                                <Grid size={{ xs: 6, md: 3 }}>
                                                    <TextField
                                                        label={t('projects.printTime') + " (h)"}
                                                        type="text"
                                                        fullWidth
                                                        size="small"
                                                        value={simConfig.print_time_h}
                                                        onChange={(e) => setSimConfig({ ...simConfig, print_time_h: normalizeNumericInput(e.target.value) })}
                                                    />
                                                </Grid>
                                                <Grid size={{ xs: 6, md: 3 }}>
                                                    <TextField
                                                        label={t('projects.machineRate')}
                                                        type="text"
                                                        fullWidth
                                                        size="small"
                                                        value={simConfig.machine_hourly_rate}
                                                        onChange={(e) => setSimConfig({ ...simConfig, machine_hourly_rate: normalizeNumericInput(e.target.value) })}
                                                    />
                                                </Grid>
                                                <Grid size={{ xs: 6, md: 3 }}>
                                                    <TextField
                                                        label={t('projects.power')}
                                                        type="text"
                                                        fullWidth
                                                        size="small"
                                                        value={simConfig.printer_power_kw}
                                                        onChange={(e) => setSimConfig({ ...simConfig, printer_power_kw: normalizeNumericInput(e.target.value) })}
                                                    />
                                                </Grid>
                                                <Grid size={{ xs: 6, md: 3 }}>
                                                    <TextField
                                                        label={t('projects.electricityRate')}
                                                        type="text"
                                                        fullWidth
                                                        size="small"
                                                        value={simConfig.electricity_cost_kwh}
                                                        onChange={(e) => setSimConfig({ ...simConfig, electricity_cost_kwh: normalizeNumericInput(e.target.value) })}
                                                    />
                                                </Grid>
                                                <Grid size={{ xs: 6, md: 3 }}>
                                                    <TextField
                                                        label={t('projects.laborTime')}
                                                        type="text"
                                                        fullWidth
                                                        size="small"
                                                        value={simConfig.labor_time_h}
                                                        onChange={(e) => setSimConfig({ ...simConfig, labor_time_h: normalizeNumericInput(e.target.value) })}
                                                    />
                                                </Grid>
                                                <Grid size={{ xs: 6, md: 3 }}>
                                                    <TextField
                                                        label={t('projects.laborRate')}
                                                        type="text"
                                                        fullWidth
                                                        size="small"
                                                        value={simConfig.labor_hourly_rate}
                                                        onChange={(e) => setSimConfig({ ...simConfig, labor_hourly_rate: normalizeNumericInput(e.target.value) })}
                                                    />
                                                </Grid>
                                                <Grid size={{ xs: 6, md: 3 }}>
                                                    <TextField
                                                        label={t('projects.miscCosts')}
                                                        type="text"
                                                        fullWidth
                                                        size="small"
                                                        value={simConfig.misc_costs}
                                                        onChange={(e) => setSimConfig({ ...simConfig, misc_costs: normalizeNumericInput(e.target.value) })}
                                                    />
                                                </Grid>
                                            </Grid>
                                        </Paper>
                                    </Box>
                                );
                            })()}





                            {/* TAB 3: History (was 6) */}
                            {tabValue === 3 && (
                                <Box mt={3}>
                                    <Box display="flex" justifyContent="flex-end" mb={2}>
                                        <Button startIcon={<Add />} variant="outlined" onClick={() => setManualLogOpen(true)}>
                                            {t('consumption.addLog', 'Add Manual Entry')}
                                        </Button>
                                    </Box>
                                    <TableContainer component={Paper}>
                                        <Table>
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell sx={{ fontWeight: 'bold' }}>
                                                        <TableSortLabel
                                                            active={orderBy === 'date'}
                                                            direction={orderBy === 'date' ? order : 'asc'}
                                                            onClick={() => handleRequestSort('date')}
                                                        >
                                                            {t('common.date', 'Date')}
                                                        </TableSortLabel>
                                                    </TableCell>
                                                    <TableCell sx={{ fontWeight: 'bold' }}>
                                                        <TableSortLabel
                                                            active={orderBy === 'filament'}
                                                            direction={orderBy === 'filament' ? order : 'asc'}
                                                            onClick={() => handleRequestSort('filament')}
                                                        >
                                                            {t('inventory.filament', 'Filament')}
                                                        </TableSortLabel>
                                                    </TableCell>
                                                    <TableCell sx={{ fontWeight: 'bold' }}>
                                                        <TableSortLabel
                                                            active={orderBy === 'amount'}
                                                            direction={orderBy === 'amount' ? order : 'asc'}
                                                            onClick={() => handleRequestSort('amount')}
                                                        >
                                                            {t('consumption.amount', 'Amount')}
                                                        </TableSortLabel>
                                                    </TableCell>
                                                    <TableCell sx={{ fontWeight: 'bold' }}>
                                                        <TableSortLabel
                                                            active={orderBy === 'type'}
                                                            direction={orderBy === 'type' ? order : 'asc'}
                                                            onClick={() => handleRequestSort('type')}
                                                        >
                                                            {t('common.type', 'Type')}
                                                        </TableSortLabel>
                                                    </TableCell>
                                                    <TableCell sx={{ fontWeight: 'bold' }}>{t('common.notes', 'Notes')}</TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>{t('common.actions', 'Actions')}</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {sortedConsumptions?.map((log) => (
                                                    <TableRow key={log.id}>
                                                        <TableCell>{new Date(log.date).toLocaleDateString()} {new Date(log.date).toLocaleTimeString()}</TableCell>
                                                        <TableCell>
                                                            {log.filament ? (
                                                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                                    <Box component="span" sx={{
                                                                        width: 12, height: 12, borderRadius: '50%',
                                                                        bgcolor: log.filament.color || '#ccc',
                                                                        border: '1px solid #ddd',
                                                                        mr: 1,
                                                                        flexShrink: 0
                                                                    }} />
                                                                    {`${log.filament.brand?.name} ${log.filament.material?.name} ${log.filament.colorName || ''}`}
                                                                </Box>
                                                            ) : 'Unknown'}
                                                        </TableCell>
                                                        <TableCell>{log.amount.toFixed(1)}g</TableCell>
                                                        <TableCell>
                                                            <Chip
                                                                label={
                                                                    log.type === 'PRINT' ? t('consumption.typePrint', 'Print') :
                                                                        log.type === 'FAIL' ? t('consumption.typeFail', 'Failure') :
                                                                            t('consumption.typeManual', 'Manual')
                                                                }
                                                                size="small"
                                                                color={log.type === 'FAIL' ? 'error' : log.type === 'PRINT' ? 'success' : 'default'}
                                                            />
                                                            {log.is_planned && (
                                                                <Chip
                                                                    label={t('consumption.planned', 'Planned')}
                                                                    size="small"
                                                                    variant="outlined"
                                                                    sx={{ ml: 1, borderStyle: 'dotted' }}
                                                                />
                                                            )}
                                                        </TableCell>
                                                        <TableCell>{log.notes}</TableCell>
                                                        <TableCell align="right" sx={{ verticalAlign: 'middle' }}>
                                                                <IconButton size="small" onClick={() => handleEditLog(log)}>
                                                                    <Edit fontSize="small" />
                                                                </IconButton>
                                                            <IconButton size="small" color="error" onClick={() => handleDeleteLog(log.id)}>
                                                                <Delete fontSize="small" />
                                                            </IconButton>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                                {(!project.consumptionLogs || project.consumptionLogs.length === 0) && (
                                                    <TableRow>
                                                        <TableCell colSpan={6} align="center">{t('consumption.noLogs', 'No history yet.')}</TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                </Box>
                            )}
                        </Box>
                    </Paper>
                </Grid>


            </Grid>

            {
                project && (
                    <ProjectItemModal
                        open={isAddMaterialOpen}
                        onClose={() => setIsAddMaterialOpen(false)}
                        projectId={project.id}
                        onSuccess={() => loadProject(project.id)}
                    />
                )
            }

            {/* Upload Choice Dialog */}
            <Dialog open={uploadChoiceOpen} onClose={() => setUploadChoiceOpen(false)}>
                <DialogTitle>{t('projects.uploadChoiceTitle', 'GCode Detected')}</DialogTitle>
                <DialogContent>
                    <Typography gutterBottom>
                        {t('projects.uploadChoiceMessage', 'How do you want to handle this file?')}
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => handleUploadChoice('simple')}>
                        {t('projects.uploadSimple', 'Reference Only')}
                    </Button>
                    <Button variant="contained" onClick={() => handleUploadChoice('production')}>
                        {t('projects.uploadProduction', 'Analyze & Track')}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* GCode Analysis Wizard */}
            {
                project && (
                    <GCodeAnalysisDialog
                        isOpen={isGCodeAnalysisOpen}
                        onClose={() => {
                            setIsGCodeAnalysisOpen(false);
                            setPendingAnalysisResult(null);
                            setPendingFileName('');
                            setPendingUploadFile(null);
                        }}
                        projectId={project.id}
                        preSelectedFile={pendingUploadFile}
                        preAnalyzedResult={pendingAnalysisResult}
                        fileName={pendingFileName}
                        onAnalysisComplete={() => {
                            loadProject(project.id);
                            setPendingUploadFile(null);
                            setPendingAnalysisResult(null);
                            setPendingFileName('');
                        }}
                    />
                )
            }

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
                <DialogTitle>{t('common.delete')} Project?</DialogTitle>
                <DialogContent>
                    <Typography gutterBottom>Are you sure you want to delete this project? This action cannot be undone.</Typography>
                    <FormControlLabel
                        control={<Checkbox checked={deleteConsumptions} onChange={(e) => setDeleteConsumptions(e.target.checked)} />}
                        label="Also restore stock & delete consumption history"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialogOpen(false)}>{t('common.cancel')}</Button>
                    <Button onClick={handleDeleteProject} color="error" variant="contained">{t('common.delete')}</Button>
                </DialogActions>
            </Dialog>

            <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
                <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%' }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>

            {/* Manual Log Dialog */}
            <Dialog open={manualLogOpen} onClose={() => { setManualLogOpen(false); setEditingLogId(null); setManualLogData({ filamentId: '', amount: '', type: 'PRINT', notes: '', is_planned: false }); setSelectedLogFilament(null); }} maxWidth="sm" fullWidth>
                <DialogTitle>{editingLogId ? t('consumption.editLog', 'Edit Consumption Log') : t('consumption.addLog', 'Add Consumption Log')}</DialogTitle>
                <DialogContent sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2.5, minWidth: 400 }}>
                    <Autocomplete
                        options={allFilaments}
                        getOptionLabel={(option) => {
                            const title = getFilamentTitle(option);
                            return `${title} (${Math.round(option.weightRemaining)}g)`;
                        }}
                        filterOptions={createFilterOptions({
                            limit: 30,
                            stringify: (option) => `${getFilamentTitle(option)} ${option.brand?.name || ''} ${option.material?.name || ''} ${option.colorName || ''} ${option.spoolReference || ''}`
                        })}
                        value={selectedLogFilament}
                        onChange={(_, newValue) => {
                            setSelectedLogFilament(newValue);
                            setManualLogData({ ...manualLogData, filamentId: newValue ? String(newValue.id) : '' });
                        }}
                        isOptionEqualToValue={(option, value) => option.id === value.id}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label={t('inventory.filament', 'Filament')}
                                placeholder={t('inventory.search', 'Search') + '...'}
                                size="small"
                            />
                        )}
                        renderOption={(props, option) => {
                            const { key, ...otherProps } = props;
                            return (
                                <li key={key} {...otherProps}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                                        <ColorIndicator colors={[option.color || '#ccc', ...(option.colors || [])]} size={18} />
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Typography variant="body2" noWrap>{getFilamentTitle(option)}</Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {Math.round(option.weightRemaining)}g {t('inventory.remaining', 'remaining')}
                                                {option.spoolReference && ` • Ref: ${option.spoolReference}`}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </li>
                            );
                        }}
                        size="small"
                        sx={{ mt: 1 }}
                    />
                    <TextField
                        label={t('consumption.amount', 'Amount (g)')}
                        type="text"
                        size="small"
                        fullWidth
                        value={manualLogData.amount}
                        onChange={(e) => setManualLogData({ ...manualLogData, amount: normalizeNumericInput(e.target.value) })}
                    />
                    <FormControl fullWidth size="small">
                        <InputLabel>{t('common.type', 'Type')}</InputLabel>
                        <Select
                            value={manualLogData.type}
                            label={t('common.type', 'Type')}
                            onChange={(e) => setManualLogData({ ...manualLogData, type: e.target.value as any })}
                        >
                            <MenuItem value="PRINT">{t('consumption.typePrint', 'Print')}</MenuItem>
                            <MenuItem value="MANUAL">{t('consumption.typeManual', 'Manual')}</MenuItem>
                            <MenuItem value="FAIL">{t('consumption.typeFail', 'Failure')}</MenuItem>
                        </Select>
                    </FormControl>
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={manualLogData.is_planned}
                                onChange={(e) => setManualLogData({ ...manualLogData, is_planned: e.target.checked })}
                                color="primary"
                            />
                        }
                        label={
                            <Box>
                                <Typography variant="body2">{t('consumption.isPlanned', 'Consommation planifiée (Réservation)')}</Typography>
                                <Typography variant="caption" color="text.secondary">Ne déduit pas physiquement du stock réel</Typography>
                            </Box>
                        }
                    />
                    <TextField
                        label={t('common.notes', 'Notes')}
                        size="small"
                        fullWidth
                        multiline
                        minRows={2}
                        value={manualLogData.notes}
                        onChange={(e) => setManualLogData({ ...manualLogData, notes: e.target.value })}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => { setManualLogOpen(false); setSelectedLogFilament(null); }}>{t('common.cancel', 'Cancel')}</Button>
                    <Button onClick={handleSaveManualLog} variant="contained" disabled={!manualLogData.filamentId || !manualLogData.amount}>
                        {editingLogId ? t('common.save', 'Save') : t('common.add', 'Add')}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Project Conversion Dialog */}
            <Dialog open={convertDialogOpen} onClose={() => handleConfirmConversion(false)}>
                <DialogTitle>{t('projects.convertPlannedTitle', 'Consommations planifiées détectées')}</DialogTitle>
                <DialogContent>
                    <Typography>
                        Ce projet contient des consommations planifiées. Voulez-vous les convertir en consommations réelles ? 
                        Cela mettra à jour le poids restant de vos bobines.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => handleConfirmConversion(false)} color="inherit" disabled={converting}>
                        Ne pas convertir
                    </Button>
                    <Button onClick={() => handleConfirmConversion(true)} variant="contained" color="primary" disabled={converting}>
                        {converting ? 'Conversion...' : 'Convertir et Terminer'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
            >
                <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%', borderRadius: 2 }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
}
