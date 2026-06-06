import { useState } from 'react';
import { usePrinterBridge } from '../contexts/PrinterBridgeContext';
import {
    Box,
    IconButton,
    Menu,
    Typography,
    Button,
    Badge,
    CircularProgress,
    Divider,
    Tooltip
} from '@mui/material';
import { Printer as PrinterIcon, Download, Activity } from 'lucide-react';
import GCodeAnalysisDialog from './GCodeAnalysisDialog';

export default function PrinterStatusMenu() {
    const { isConnected, printers, downloadFile } = usePrinterBridge();
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [loading, setLoading] = useState(false);

    // GCode Analysis State
    const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);
    const [analysisFile, setAnalysisFile] = useState<File | null>(null);
    const [analysisJobId, setAnalysisJobId] = useState<string | undefined>(undefined);

    const open = Boolean(anchorEl);

    // Filter connected printers or just show all
    const printerList = Object.values(printers);
    const isPrinting = printerList.some(p => p.data?.state === 'RUNNING');

    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleDownloadAndAnalyze = async (serial: string, filename: string, jobId: string) => {
        if (!filename) return;

        try {
            setLoading(true);
            const blob = await downloadFile(serial, filename);
            // Ensure filename has a valid extension for the backend filter
            let finalName = filename;
            if (!finalName.toLowerCase().match(/\.(gcode|gc|3mf)$/)) {
                finalName = `${finalName}.gcode`;
            }
            const file = new File([blob], finalName, { type: 'application/octet-stream' });

            setAnalysisFile(file);
            setAnalysisJobId(jobId);
            setIsAnalysisOpen(true);
            handleClose();
        } catch (e) {
            console.error('Download failed', e);
            alert('Failed to download G-Code from printer');
        } finally {
            setLoading(false);
        }
    };

    // if (!isConnected && printerList.length === 0) return null; // Always show icon

    return (
        <>
            <Tooltip title="Printers">
                <IconButton
                    onClick={handleClick}
                    sx={{
                        mr: 1,
                        bgcolor: !isConnected ? 'error.light' : (isPrinting ? 'success.light' : 'action.hover'),
                        color: !isConnected ? 'error.main' : (isPrinting ? 'success.main' : 'text.secondary'),
                        borderRadius: '12px',
                        '&:hover': { bgcolor: !isConnected ? 'error.light' : (isPrinting ? 'success.light' : 'action.selected') }
                    }}
                >
                    <Badge variant="dot" color={!isConnected ? "error" : "success"} invisible={!isPrinting && isConnected}>
                        <PrinterIcon size={20} />
                    </Badge>
                </IconButton>
            </Tooltip>

            <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                PaperProps={{
                    elevation: 0,
                    sx: {
                        overflow: 'visible',
                        filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
                        mt: 1.5,
                        width: 320,
                        borderRadius: '12px',
                    },
                }}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
                <Box sx={{ p: 2 }}>
                    <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PrinterIcon size={20} /> Printers
                        {isConnected ?
                            <Badge variant="dot" color="success" sx={{ ml: 1 }}> </Badge> :
                            <Badge variant="dot" color="error" sx={{ ml: 1 }}> </Badge>
                        }
                    </Typography>
                </Box>
                <Divider />

                {printerList.length === 0 && (
                    <Box sx={{ p: 3, textAlign: 'center' }}>
                        <Typography color="text.secondary">No printers connected</Typography>
                    </Box>
                )}

                {printerList.map((p) => (
                    <Box key={p.serial} sx={{ p: 2, borderBottom: '1px solid #eee' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Typography variant="subtitle2" fontWeight="bold">
                                {p.name || p.serial}
                            </Typography>
                            <Box sx={{
                                px: 1, py: 0.5, borderRadius: 1, fontSize: '0.75rem', fontWeight: 'bold',
                                bgcolor: p.data?.state === 'RUNNING' ? 'success.light' : 'action.hover',
                                color: p.data?.state === 'RUNNING' ? 'success.dark' : 'text.secondary'
                            }}>
                                {p.data?.state || p.status}
                            </Box>
                        </Box>

                        {p.data && (
                            <>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                    <Activity size={14} className="opacity-50" />
                                    <Typography variant="caption" noWrap sx={{ maxWidth: 200 }}>
                                        {p.data.file || 'No Active File'}
                                    </Typography>
                                </Box>

                                <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                                    <Box>
                                        <Typography variant="caption" color="text.secondary">Nozzle</Typography>
                                        <Typography variant="body2" fontWeight="bold">{p.data.nozzleTemp}°C</Typography>
                                    </Box>
                                    <Box>
                                        <Typography variant="caption" color="text.secondary">Bed</Typography>
                                        <Typography variant="body2" fontWeight="bold">{p.data.bedTemp}°C</Typography>
                                    </Box>
                                    <Box>
                                        <Typography variant="caption" color="text.secondary">Progress</Typography>
                                        <Typography variant="body2" fontWeight="bold">{p.data.progress}%</Typography>
                                    </Box>
                                </Box>

                                {p.data.file && (
                                    <Button
                                        variant="contained"
                                        size="small"
                                        fullWidth
                                        startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Download size={16} />}
                                        disabled={loading}
                                        onClick={() => handleDownloadAndAnalyze(p.serial, p.data!.file, p.data!.jobId)}
                                        sx={{
                                            bgcolor: 'primary.main',
                                            '&:hover': { bgcolor: 'primary.dark' }
                                        }}
                                    >
                                        Track Consumption
                                    </Button>
                                )}
                            </>
                        )}
                    </Box>
                ))}
            </Menu>

            <GCodeAnalysisDialog
                isOpen={isAnalysisOpen}
                onClose={() => {
                    setIsAnalysisOpen(false);
                    setAnalysisFile(null);
                    setAnalysisJobId(undefined);
                }}
                preSelectedFile={analysisFile}
                jobId={analysisJobId}
            />
        </>
    );
}
