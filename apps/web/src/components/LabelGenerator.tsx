import { Box, Typography, Button, Dialog, DialogContent, DialogActions, Paper, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from 'react-i18next';
import { Printer, X, LayoutGrid, Type } from 'lucide-react';
import { useState } from 'react';

interface LabelGeneratorProps {
    open: boolean;
    onClose: () => void;
    filaments: any[];
}

type LabelFormat = 'standard' | 'compact';

export default function LabelGenerator({ open, onClose, filaments }: LabelGeneratorProps) {
    const { t } = useTranslation();
    const [format, setFormat] = useState<LabelFormat>(() => {
        const saved = localStorage.getItem('label_format');
        return (saved as LabelFormat) || 'standard';
    });

    const handleFormatChange = (_: any, newFormat: LabelFormat | null) => {
        if (newFormat !== null) {
            setFormat(newFormat);
            localStorage.setItem('label_format', newFormat);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    if (!filaments || filaments.length === 0) return null;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth scroll="paper">
            <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'center', bgcolor: 'background.paper' }}>
                <ToggleButtonGroup
                    value={format}
                    exclusive
                    onChange={handleFormatChange}
                    size="small"
                    color="primary"
                >
                    <ToggleButton value="standard" sx={{ gap: 1 }}>
                        <LayoutGrid size={16} />
                        Standard (50x30)
                    </ToggleButton>
                    <ToggleButton value="compact" sx={{ gap: 1 }}>
                        <Type size={16} />
                        Compact (40x12)
                    </ToggleButton>
                </ToggleButtonGroup>
            </Box>

            <DialogContent sx={{ p: 4, bgcolor: 'action.hover' }}>
                <Box id="printable-area">
                    {filaments.map((filament) => {
                        const isDev = window.location.hostname === 'localhost' || window.location.hostname.startsWith('192.168.') || window.location.hostname.startsWith('127.0.0.');
                        const scheme = isDev ? 'spoolydev' : 'spooly';
                        const qrValue = `${scheme}://${filament.spoolReference || filament.id}`;

                        if (format === 'compact') {
                            return (
                                <Paper
                                    key={filament.id}
                                    className="printable-label"
                                    elevation={0}
                                    sx={{
                                        width: '151px', // 40mm at 96dpi
                                        height: '45px', // 12mm at 96dpi
                                        bgcolor: 'white',
                                        border: '1.2px solid black',
                                        borderRadius: '0px',
                                        p: '2px',
                                        display: 'flex',
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        position: 'relative',
                                        overflow: 'hidden',
                                        color: 'black',
                                        mb: 2,
                                        mx: 'auto',
                                        boxSizing: 'border-box',
                                        zoom: '200%',
                                        gap: '4px',
                                        fontFamily: "'Inter', sans-serif",
                                        '@media print': {
                                            zoom: '100%',
                                            border: '1.2px solid black',
                                            m: 0,
                                            p: '2px',
                                            width: '40mm',
                                            height: '12mm',
                                            pageBreakAfter: 'always',
                                            borderRadius: 0,
                                        }
                                    }}
                                >
                                    {/* Left: QR Code */}
                                    <Box sx={{ bgcolor: 'white', p: '1px', border: '1px solid #eee', flexShrink: 0, lineHeight: 0 }}>
                                        <QRCodeSVG value={qrValue} size={37} level="L" includeMargin={false} />
                                    </Box>

                                    {/* Right: Info */}
                                    <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                        <Typography noWrap sx={{ fontWeight: 900, fontSize: '8.5px', lineHeight: 1, textTransform: 'uppercase', mb: '1px', pr: '18px' }}>
                                            {(filament.brand?.name || 'Generic').toUpperCase()}
                                        </Typography>
                                        <Typography noWrap sx={{ fontWeight: 700, fontSize: '7.5px', color: '#333', textTransform: 'uppercase', lineHeight: 1, mb: '2px', pr: '18px' }}>
                                            {(filament.material?.name || 'PLA').toUpperCase()} {filament.types?.[0]?.name || ''}{filament.colorName ? ` - ${filament.colorName}` : ''}
                                        </Typography>
                                        <Box sx={{ display: 'flex', gap: '4px', borderTop: '0.5px solid #ddd', pt: '1px' }}>
                                            <Typography noWrap sx={{ fontWeight: 800, fontSize: '6.5px', lineHeight: 1, color: '#666' }}>
                                                N: {filament.nozzleTempMin > 0 ? `${filament.nozzleTempMin}${filament.nozzleTempMax ? `-${filament.nozzleTempMax}` : ''}°C` : '...'}
                                            </Typography>
                                            <Typography noWrap sx={{ fontWeight: 800, fontSize: '6.5px', lineHeight: 1, color: '#666' }}>
                                                B: {(filament.bedTempMin > 0 || filament.bedTemp > 0) ? `${filament.bedTempMin || filament.bedTemp}${filament.bedTempMax ? `-${filament.bedTempMax}` : ''}°C` : '...'}
                                            </Typography>
                                        </Box>
                                    </Box>

                                    {/* Spooly Picto in top right */}
                                    <Box
                                        component="img"
                                        src="/logo/logo-picto-light.png"
                                        sx={{
                                            position: 'absolute',
                                            top: '2px',
                                            right: '2px',
                                            height: '16px',
                                            width: '16px',
                                            filter: 'grayscale(1) brightness(0)',
                                            opacity: 0.9
                                        }}
                                    />
                                </Paper>
                            );
                        }

                        // Standard 50x30 Layout
                        return (
                            <Paper
                                key={filament.id}
                                className="printable-label"
                                elevation={0}
                                sx={{
                                    width: '189px', // 50mm at 96dpi
                                    height: '113px', // 30mm at 96dpi
                                    bgcolor: 'white',
                                    border: '1.5px solid black',
                                    borderRadius: '0px',
                                    p: '4px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    position: 'relative',
                                    overflow: 'hidden',
                                    color: 'black',
                                    mb: 2,
                                    mx: 'auto',
                                    boxSizing: 'border-box',
                                    zoom: '150%',
                                    fontFamily: "'Inter', sans-serif",
                                    '@media print': {
                                        zoom: '100%',
                                        border: '1.5px solid black',
                                        m: 0,
                                        p: '4px',
                                        width: '50mm',
                                        height: '30mm',
                                        pageBreakAfter: 'always',
                                        borderRadius: 0,
                                    }
                                }}
                            >
                                {/* Header */}
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: '4px', flexShrink: 0 }}>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography noWrap sx={{ fontWeight: 900, fontSize: '15px', lineHeight: '15px', textTransform: 'uppercase' }}>
                                            {(filament.brand?.name || 'Generic').toUpperCase()}
                                        </Typography>
                                        <Typography noWrap sx={{ fontWeight: 800, fontSize: '10px', color: '#333', textTransform: 'uppercase', mt: '1px', lineHeight: 1 }}>
                                            {(filament.material?.name || 'PLA').toUpperCase()} {filament.types?.[0]?.name || ''}{filament.colorName ? ` - ${filament.colorName}` : ''}
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', ml: '4px' }}>
                                        <Box
                                            component="img"
                                            src="/logo/logo-picto-light.png"
                                            sx={{
                                                height: '20px',
                                                width: '20px',
                                                filter: 'grayscale(1) brightness(0)',
                                            }}
                                        />
                                    </Box>
                                </Box>

                                {/* Body */}
                                <Box sx={{ display: 'flex', gap: '6px', alignItems: 'center', flex: 1, minHeight: 0 }}>
                                    <Box sx={{ bgcolor: 'white', p: '2px', border: '1px solid black', flexShrink: 0, lineHeight: 0 }}>
                                        <QRCodeSVG value={qrValue} size={54} level="H" includeMargin={false} />
                                    </Box>
                                    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                            {/* Nozzle */}
                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                <Typography noWrap sx={{ fontSize: '7px', fontWeight: 800, textTransform: 'uppercase', color: '#666', lineHeight: 1 }}>
                                                    {t('inventory.label.nozzleTemp')}
                                                </Typography>
                                                <Typography noWrap sx={{ fontWeight: 900, fontSize: '10px', lineHeight: 1.1 }}>
                                                    {filament.nozzleTempMin > 0 ? `${filament.nozzleTempMin}${filament.nozzleTempMax ? `-${filament.nozzleTempMax}` : ''}°C` : '... °C'}
                                                </Typography>
                                            </Box>
                                            {/* Bed */}
                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                <Typography noWrap sx={{ fontSize: '7px', fontWeight: 800, textTransform: 'uppercase', color: '#666', lineHeight: 1 }}>
                                                    {t('inventory.label.bedTemp')}
                                                </Typography>
                                                <Typography noWrap sx={{ fontWeight: 900, fontSize: '10px', lineHeight: 1.1 }}>
                                                    {(filament.bedTempMin > 0 || filament.bedTemp > 0) ? `${filament.bedTempMin || filament.bedTemp}${filament.bedTempMax ? `-${filament.bedTempMax}` : ''}°C` : '... °C'}
                                                </Typography>
                                            </Box>
                                        </Box>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                            {/* Weight */}
                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                <Typography noWrap sx={{ fontSize: '7px', fontWeight: 800, textTransform: 'uppercase', color: '#666', lineHeight: 1 }}>
                                                    {t('inventory.label.weight')}
                                                </Typography>
                                                <Typography noWrap sx={{ fontWeight: 900, fontSize: '10px', lineHeight: 1.1 }}>
                                                    {filament.weightInitial > 0 ? `${Math.round(filament.weightInitial)}g` : '... g'}
                                                </Typography>
                                            </Box>
                                            {/* ID */}
                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                <Typography noWrap sx={{ fontSize: '7px', fontWeight: 800, textTransform: 'uppercase', color: '#666', lineHeight: 1 }}>
                                                    {t('inventory.label.id')}
                                                </Typography>
                                                <Typography noWrap sx={{ fontWeight: 900, fontSize: '10px', lineHeight: 1.1 }}>
                                                    #{filament.id}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </Box>
                                </Box>

                                {/* Bottom Info */}
                                {filament.spoolReference && (
                                    <Box sx={{ mt: '4px', pt: '1px', borderTop: '1px solid #000', flexShrink: 0 }}>
                                        <Typography sx={{ fontSize: '9px', fontWeight: 700, textAlign: 'center', lineHeight: 1 }} noWrap>
                                            {filament.spoolReference}
                                        </Typography>
                                    </Box>
                                )}

                                {/* Watermark Background */}
                                <Typography
                                    sx={{
                                        position: 'absolute',
                                        right: -5,
                                        bottom: -5,
                                        opacity: 0.03,
                                        fontSize: '24px',
                                        fontWeight: 900,
                                        transform: 'rotate(-15deg)',
                                        pointerEvents: 'none',
                                        zIndex: 0
                                    }}
                                >
                                    SPOOLY
                                </Typography>
                            </Paper>
                        );
                    })}
                </Box>

                <style>
                    {`
                        @media print {
                            body * {
                                visibility: hidden;
                            }
                            #printable-area, #printable-area * {
                                visibility: visible;
                            }
                            #printable-area {
                                position: absolute;
                                left: 0;
                                top: 0;
                                width: 100%;
                            }
                            @page {
                                margin: 0;
                                size: auto;
                            }
                            .printable-label {
                                page-break-after: always;
                                break-after: page;
                            }
                        }
                    `}
                </style>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} startIcon={<X size={18} />}>
                    {t('common.close')}
                </Button>
                <Button onClick={handlePrint} variant="contained" color="primary" startIcon={<Printer size={18} />}>
                    {t('common.print')} ({filaments.length})
                </Button>
            </DialogActions>
        </Dialog>
    );
}
