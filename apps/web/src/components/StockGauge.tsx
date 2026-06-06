import { Box, Typography, useTheme, Tooltip } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface StockGaugeProps {
    value: number; // 0 to 100
    plannedValue?: number; // 0 to 100 (reservation amount)
    label: string;
    subLabel?: string;
    color?: string;
    colors?: string[];
    size?: number;
    physicalWeight?: number;
    plannedWeightRaw?: number;
}


export default function StockGauge({ 
    value, 
    plannedValue = 0, 
    label, 
    subLabel, 
    color = '#6366f1', 
    colors = [], 
    size = 120,
    physicalWeight,
    plannedWeightRaw
}: StockGaugeProps) {
    const theme = useTheme();
    const { t } = useTranslation();
    const strokeWidth = 10;
    const radius = (size - strokeWidth) / 2;
    const safeValue = isNaN(value) ? 0 : Math.min(100, Math.max(0, value));
    const safePlanned = isNaN(plannedValue) ? 0 : Math.min(100, Math.max(0, plannedValue));
    const displayColors = colors.length > 0 ? colors : [color];
    const isMultiColor = displayColors.length > 1;

    // Gradient colors based on value if no specific color provided
    const getKeyColor = (val: number) => {
        if (color !== '#6366f1') return color; // Custom color overrides
        if (val < 20) return '#ef4444'; // Red
        if (val < 50) return '#f59e0b'; // Orange
        return '#10b981'; // Green
    };

    const finalColor = getKeyColor(value);
    const actualColors = isMultiColor ? displayColors : [finalColor];

    const circumference = radius * 2 * Math.PI;

    // Helper to determine if a color is dark
    const isDarkColor = (hex: string) => {
        if (!hex || hex.startsWith('url')) return false;
        let c = hex.substring(1);      // strip #
        if (c.length === 3) c = c.split('').map(s => s + s).join('');
        const rgb = parseInt(c, 16);   // convert rrggbb to decimal
        const r = (rgb >> 16) & 0xff;  // extract red
        const g = (rgb >>  8) & 0xff;  // extract green
        const b = (rgb >>  0) & 0xff;  // extract blue
        const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b; // per ITU-R BT.709
        return luma < 128;
    };

    const isDark = isDarkColor(finalColor);

    const tooltipContent = (
        <Box sx={{ p: 0.5 }}>
            <Typography variant="body2" fontWeight="bold">
                {label}
            </Typography>
            {physicalWeight !== undefined && (
                <Typography variant="caption" display="block">
                    {t('dashboard.realShort', 'Réel')}: {physicalWeight.toFixed(2)}g
                </Typography>
            )}
            {plannedWeightRaw !== undefined && plannedWeightRaw > 0 && (
                <Typography variant="caption" display="block" color="warning.main">
                    {t('dashboard.plannedShort', 'Planifié')}: {plannedWeightRaw.toFixed(2)}g
                </Typography>
            )}
            {physicalWeight !== undefined && plannedWeightRaw !== undefined && (
                <Typography variant="caption" display="block" sx={{ mt: 0.5, opacity: 0.8 }}>
                    {t('dashboard.availableShort', 'Libre')}: {(physicalWeight - plannedWeightRaw).toFixed(2)}g
                </Typography>
            )}
        </Box>
    );

    return (
        <Tooltip title={tooltipContent} arrow placement="top">
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
                <Box sx={{ position: 'relative', width: size, height: size }}>
                    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}>
                        <defs>
                            {/* No pattern needed for sleek design */}
                        </defs>
                        {/* Background Circle */}
                        <circle
                            cx={size / 2}
                            cy={size / 2}
                            r={radius}
                            fill="none"
                            stroke={theme.palette.divider}
                            strokeWidth={strokeWidth}
                            strokeOpacity={0.2}
                        />
                        {/* Foreground Circles (Concentric if multi-color) */}
                        {actualColors.map((c: string, index: number) => {
                            const ringStrokeWidth = strokeWidth / actualColors.length;
                            const ringRadius = (size / 2) - (ringStrokeWidth / 2) - (index * ringStrokeWidth);
                            const ringCircumference = ringRadius * 2 * Math.PI;
                            const ringOffset = ringCircumference - (safeValue / 100) * ringCircumference;

                            return (
                                <circle
                                    key={index}
                                    cx={size / 2}
                                    cy={size / 2}
                                    r={ringRadius}
                                    fill="none"
                                    stroke={c}
                                    strokeWidth={ringStrokeWidth}
                                    strokeDasharray={ringCircumference}
                                    strokeDashoffset={ringOffset}
                                    strokeLinecap="round"
                                    style={{ transition: 'stroke-dashoffset 0.5s ease-in-out' }}
                                />
                            );
                        })}
                        {/* Planned Reservation Overlay with Sleek Glass Look */}
                        {safePlanned > 0 && (
                            <>
                                <circle
                                    cx={size / 2}
                                    cy={size / 2}
                                    r={radius}
                                    fill="none"
                                    stroke={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)'}
                                    strokeWidth={strokeWidth}
                                    strokeDasharray={`${(safePlanned / 100) * circumference} ${circumference}`}
                                    strokeDashoffset={-((safeValue - safePlanned) / 100) * circumference}
                                    strokeLinecap="butt"
                                    style={{ transition: 'all 0.5s ease-in-out' }}
                                />
                                {/* Marker line at separation */}
                                <circle
                                    cx={size / 2}
                                    cy={size / 2}
                                    r={radius}
                                    fill="none"
                                    stroke={isDark ? 'white' : 'black'}
                                    strokeWidth={strokeWidth}
                                    strokeDasharray={`2 ${circumference - 2}`}
                                    strokeDashoffset={-((safeValue - safePlanned) / 100) * circumference}
                                    style={{ transition: 'all 0.5s ease-in-out' }}
                                />
                            </>
                        )}
                    </svg>
                    {/* Text Centered */}
                    <Box sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <Typography variant="h6" fontWeight="bold" color="text.primary">
                            {Math.round(value)}%
                        </Typography>
                    </Box>
                </Box>
                <Box sx={{ marginTop: '8px', textAlign: 'center' }}>
                    <Typography variant="subtitle2" fontWeight="600" color="text.primary">
                        {label}
                    </Typography>
                    {subLabel && (
                        <Typography variant="caption" color="text.secondary">
                            {subLabel}
                        </Typography>
                    )}
                </Box>
            </Box>
        </Tooltip>
    );
}
