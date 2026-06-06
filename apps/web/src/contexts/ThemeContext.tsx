import { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { CssBaseline, StyledEngineProvider } from '@mui/material';
import theme from '../themes';

type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
    mode: ThemeMode;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [mode, setMode] = useState<ThemeMode>(() => {
        const saved = localStorage.getItem('theme');
        return (saved as ThemeMode) || 'light';
    });

    useEffect(() => {
        localStorage.setItem('theme', mode);
        if (mode === 'dark') {
            document.body.classList.add('dark');
        } else {
            document.body.classList.remove('dark');
        }
    }, [mode]);

    const toggleTheme = () => {
        setMode(prev => (prev === 'light' ? 'dark' : 'light'));
    };

    const themeConfig = useMemo(() => theme(mode), [mode]);

    return (
        <ThemeContext.Provider value={{ mode, toggleTheme }}>
            <StyledEngineProvider injectFirst>
                <MuiThemeProvider theme={themeConfig}>
                    <CssBaseline />
                    {children}
                </MuiThemeProvider>
            </StyledEngineProvider>
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
