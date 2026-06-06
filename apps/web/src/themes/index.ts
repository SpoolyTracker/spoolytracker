import { createTheme, type ThemeOptions } from '@mui/material/styles';
import { frFR as coreFrFR } from '@mui/material/locale';
import { frFR as dataGridFrFR } from '@mui/x-data-grid/locales';
import { palette } from './palette';
import { typography } from './typography';
import { components } from './components';

export const theme = (mode: 'light' | 'dark') => {
    const themeOptions: ThemeOptions = {
        direction: 'ltr',
        palette: palette(mode),
        typography: typography,
        shape: {
            borderRadius: 12
        }
    };

    const themes = createTheme(themeOptions, coreFrFR, dataGridFrFR);
    themes.components = { ...themes.components, ...components(themes) };

    return themes;
};

export default theme;
