import { Box, Typography, Button, Dialog, DialogContent, DialogActions, Paper, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from 'react-i18next';
import { Printer, X, LayoutGrid, Type } from 'lucide-react';
import { useState, type ReactNode } from 'react';

interface LabelGeneratorProps {
    open: boolean;
    onClose: () => void;
    filaments: any[];
}

type LabelFormat = 'standard' | 'compact';

// Single source of truth for each format's physical size.
// px values are the true CSS pixel size at 96dpi (1mm = 3.7795px) and drive
// the on-screen layout; `previewScale` only magnifies the preview (via CSS
// transform, NOT `zoom`, so centering stays correct); print uses the mm size 1:1.
const FORMATS: Record<LabelFormat, { wmm: number; hmm: number; wpx: number; hpx: number; previewScale: number }> = {
    standard: { wmm: 50, hmm: 30, wpx: 189, hpx: 113, previewScale: 2.4 },
    compact: { wmm: 40, hmm: 12, wpx: 151, hpx: 45, previewScale: 3 },
};

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

    const fmt = FORMATS[format];

    // Wraps a true-size label in a box that reserves the *scaled* footprint so
    // `mx: auto` centering and vertical spacing stay correct (the old `zoom`
    // hack reserved the unscaled box, which is why zoomed labels drifted).
    const ScaleWrap = ({ children }: { children: ReactNode }) => (
        <Box
            className="label-scale-wrap"
            sx={{
                width: `${fmt.wpx * fmt.previewScale}px`,
                height: `${fmt.hpx * fmt.previewScale}px`,
                mx: 'auto',
                mb: 3,
                '@media print': {
                    width: 'auto',
                    height: 'auto',
                    m: 0,
                },
            }}
        >
            <Box
                sx={{
                    transformOrigin: 'top left',
                    transform: `scale(${fmt.previewScale})`,
                    '@media print': { transform: 'none' },
                }}
            >
                {children}
            </Box>
        </Box>
    );

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth scroll="paper">
            <Box className="no-print" sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'center', bgcolor: 'background.paper' }}>
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
                                <ScaleWrap key={filament.id}>
                                    <Paper
                                        className="printable-label"
                                        elevation={0}
                                        sx={{
                                            width: `${fmt.wpx}px`,
                                            height: `${fmt.hpx}px`,
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
                                            boxSizing: 'border-box',
                                            gap: '4px',
                                            fontFamily: "'Inter', sans-serif",
                                            '@media print': {
                                                border: '1.2px solid black',
                                                m: 0,
                                                p: '2px',
                                                width: `${fmt.wmm}mm`,
                                                height: `${fmt.hmm}mm`,
                                                borderRadius: 0,
                                            },
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
                                                opacity: 0.9,
                                            }}
                                        />
                                    </Paper>
                                </ScaleWrap>
                            );
                        }

                        // Standard 50x30 Layout
                        return (
                            <ScaleWrap key={filament.id}>
                                <Paper
                                    className="printable-label"
                                    elevation={0}
                                    sx={{
                                        width: `${fmt.wpx}px`,
                                        height: `${fmt.hpx}px`,
                                        bgcolor: 'white',
                                        border: '1.5px solid black',
                                        borderRadius: '0px',
                                        p: '4px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        position: 'relative',
                                        overflow: 'hidden',
                                        color: 'black',
                                        boxSizing: 'border-box',
                                        fontFamily: "'Inter', sans-serif",
                                        '@media print': {
                                            border: '1.5px solid black',
                                            m: 0,
                                            p: '4px',
                                            width: `${fmt.wmm}mm`,
                                            height: `${fmt.hmm}mm`,
                                            borderRadius: 0,
                                        },
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
                                            zIndex: 0,
                                        }}
                                    >
                                        SPOOLY
                                    </Typography>
                                </Paper>
                            </ScaleWrap>
                        );
                    })}
                </Box>

                <style>
                    {`
                        @media print {
                            /* Pull the whole app out of the print flow — otherwise its
                               (hidden) layout still paginates into ~20 blank pages. */
                            #root {
                                display: none !important;
                            }
                            .MuiBackdrop-root {
                                display: none !important;
                            }
                            /* Dialog chrome (format toggle + action buttons) */
                            .no-print {
                                display: none !important;
                            }
                            /* Neutralise the dialog's fixed/scroll container so the
                               labels flow in normal document order across pages. */
                            .MuiDialog-root,
                            .MuiDialog-container,
                            .MuiDialog-paper,
                            .MuiDialogContent-root {
                                position: static !important;
                                overflow: visible !important;
                                height: auto !important;
                                max-height: none !important;
                                box-shadow: none !important;
                                margin: 0 !important;
                                padding: 0 !important;
                                background: #fff !important;
                                /* Span the whole page so centering is relative to the
                                   sheet, not the (sm) dialog width. */
                                width: 100% !important;
                                max-width: none !important;
                                min-width: 0 !important;
                                left: 0 !important;
                                right: 0 !important;
                            }
                            /* Center the label horizontally on the sheet and keep the
                               wrappers shrunk to the label width (otherwise the full-
                               width block left-aligns the label and clips it). */
                            #printable-area {
                                background: #fff;
                                display: flex;
                                flex-direction: column;
                                align-items: center;
                                justify-content: center;
                                min-height: 100vh;
                                width: 100%;
                                box-sizing: border-box;
                            }
                            .label-scale-wrap {
                                width: fit-content !important;
                                max-width: 100%;
                                margin: 0 auto !important;
                                transform: none !important;
                            }
                            /* Kill the preview scale transform for real at print time
                               (the sx @media override isn't always honored), and keep
                               the inner box shrunk + centered to the label. */
                            .label-scale-wrap > * {
                                transform: none !important;
                                width: fit-content !important;
                                margin: 0 auto !important;
                            }
                            /* Only break BETWEEN labels — no trailing blank page. */
                            .label-scale-wrap {
                                break-inside: avoid;
                            }
                            .label-scale-wrap:not(:last-child) {
                                page-break-after: always;
                                break-after: page;
                            }
                            /* Match the media to the selected label so it prints 1:1
                               (no manual scale/paper size in the browser dialog). */
                            @page {
                                margin: 0;
                                size: ${fmt.wmm}mm ${fmt.hmm}mm;
                            }
                        }
                    `}
                </style>
            </DialogContent>
            <DialogActions className="no-print">
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
