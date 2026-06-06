import { Box, useTheme } from '@mui/material';

interface ColorIndicatorProps {
    colors?: string[];
    primaryColor?: string; // Fallback
    size?: number;
    border?: boolean;
}

export default function ColorIndicator({
    colors = [],
    primaryColor = '#ccc',
    size = 24,
    border = true
}: ColorIndicatorProps) {
    // Deduplicate colors (case-insensitive) then fallback to primaryColor
    const uniqueColors = [...new Set(colors.map(c => c?.toLowerCase()).filter(Boolean))];
    const displayColors = uniqueColors.length > 0 ? uniqueColors : [primaryColor];

    const theme = useTheme();
    const mode = theme.palette.mode;

    const getLuminance = (hex: string) => {
        if (!hex || !hex.startsWith('#')) return 0;
        const c = hex.substring(1);
        const rgb = parseInt(c, 16);
        const r = (rgb >> 16) & 0xff;
        const g = (rgb >> 8) & 0xff;
        const b = (rgb >> 0) & 0xff;
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };

    const isLight = (hex?: string) => {
        if (!hex) return true;
        return getLuminance(hex) > 128;
    };

    let background = '';
    let borderColor = 'transparent';

    if (mode === 'light') {
        // Light Mode
        const anyLight = displayColors.some(c => isLight(c));
        // Use darker border if any color is light (to contrast with white bg)
        borderColor = anyLight ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.5)';
    } else {
        // Dark Mode
        // If we have a dark color in dark mode, we really need a light border.
        const anyDark = displayColors.some(c => !isLight(c));
        borderColor = anyDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';
    }


    if (displayColors.length === 1) {
        if (displayColors[0].toLowerCase() === 'transparent') {
            background = 'repeating-conic-gradient(#e5e7eb 0% 25%, #ffffff 0% 50%) 50% / 12px 12px';
            borderColor = 'rgba(0,0,0,0.3)';
        } else {
            background = displayColors[0];
        }
    } else if (displayColors.length === 2) {
        // Net split
        background = `linear-gradient(90deg, ${displayColors[0]} 50%, ${displayColors[1]} 50%)`;
        border = false;
    } else {
        // Pie chart style using conic-gradient
        const gradientParts = displayColors.map((color, index) => {
            const start = index * (360 / displayColors.length);
            const end = (index + 1) * (360 / displayColors.length);
            return `${color} ${start}deg ${end}deg`;
        });
        background = `conic-gradient(${gradientParts.join(', ')})`;
        border = false;
    }

    return (
        <Box
            sx={{
                width: size,
                height: size,
                borderRadius: '50%',
                background: background,
                border: border ? '1px solid' : 'none',
                borderColor: borderColor,
                flexShrink: 0
            }}
        />
    );
}
