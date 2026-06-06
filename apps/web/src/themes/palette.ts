import type { PaletteOptions } from '@mui/material/styles';

declare module '@mui/material/styles' {
    interface Palette {
        custom?: {
            background: string;
            darkConfig: string;
        }
    }
    interface PaletteOptions {
        custom?: {
            background: string;
            darkConfig: string;
        }
    }
}

export const palette = (mode: 'light' | 'dark'): PaletteOptions => {
    return {
        mode,
        primary: {
            light: '#e3f2fd',
            main: '#1661af',
            dark: '#0b67b8',
            contrastText: '#fff'
        },
        secondary: {
            light: '#ede9fe',
            main: '#7c3aed',
            dark: '#5b21b6',
            contrastText: '#fff'
        },
        background: {
            default: mode === 'dark' ? '#111936' : '#eef2f6', // Berry signature bg
            paper: mode === 'dark' ? '#1a223f' : '#ffffff'
        },
        text: {
            primary: mode === 'dark' ? '#d7dcec' : '#364152',
            secondary: mode === 'dark' ? '#8492c4' : '#697586'
        },
        custom: {
            background: mode === 'dark' ? '#1a223f' : '#ffffff',
            darkConfig: mode === 'dark' ? '#111936' : '#f8f9fa'
        }
    };
};
