import { createContext, useContext, useState, useEffect } from 'react';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';

type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  mode: ThemeMode;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function AppThemeProvider({ children }: ThemeProviderProps) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    // Load from localStorage
    const saved = localStorage.getItem('theme-mode');
    return (saved as ThemeMode) || 'light';
  });

  useEffect(() => {
    // Save to localStorage
    localStorage.setItem('theme-mode', mode);
  }, [mode]);

  const theme = createTheme({
    palette: {
      mode,
      ...(mode === 'light'
        ? {
            // Runwai monochrome system: pure black for primary actions
            primary: { main: '#000000', light: '#1a1a1a', dark: '#000000' },
            secondary: { main: '#404040', light: '#676f7b', dark: '#030303' },
            // Monochrome ladder (no accent colors)
            success: { main: '#030303', light: '#404040', dark: '#000000' },
            error: { main: '#030303', light: '#404040', dark: '#000000' },
            warning: { main: '#030303', light: '#404040', dark: '#000000' },
            info: { main: '#030303', light: '#404040', dark: '#000000' },
            // Tonal surfaces
            background: { default: '#FFFFFF', paper: '#FEFEFE' },
            text: { primary: '#030303', secondary: '#404040', disabled: '#999999' },
            divider: '#e7eaf0',
            action: {
              active: '#000000',
              hover: '#F9FAFB',
              selected: '#f0f0f0',
              disabled: '#999999',
              disabledBackground: '#f5f5f5',
            },
          }
        : {
            primary: { main: '#3B82F6', light: '#60A5FA', dark: '#1E40AF' },
            secondary: { main: '#A78BFA', light: '#D8B4FE', dark: '#7C3AED' },
            success: { main: '#22C55E', light: '#86EFAC', dark: '#16A34A' },
            error: { main: '#EF4444', light: '#F87171', dark: '#DC2626' },
            warning: { main: '#FBBF24', light: '#FCD34D', dark: '#D97706' },
            info: { main: '#38BDF8', light: '#7DD3FC', dark: '#0284C7' },
            background: { default: '#1F2937', paper: '#111827' },
            text: { primary: '#F1F5F9', secondary: '#CBD5E1', disabled: '#6B7280' },
            divider: '#374151',
            action: {
              active: '#F1F5F9',
              hover: '#374151',
              selected: '#1F2937',
              disabled: '#6B7280',
              disabledBackground: '#374151',
            },
          }),
    },
    typography: {
      fontFamily: '"Segoe UI", "Roboto", "Helvetica", "Arial", sans-serif',
      // Runwai: tight negative tracking on display sizes
      h1: { letterSpacing: '-0.02em', fontWeight: 400 },
      h2: { letterSpacing: '-0.015em', fontWeight: 400 },
      h3: { letterSpacing: '-0.01em', fontWeight: 400 },
      h4: { fontWeight: 400 },
      h5: { fontWeight: 400 },
      h6: { fontWeight: 400 },
      body1: { fontWeight: 400 },
      button: { fontWeight: 600, letterSpacing: '0em' },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          contained: {
            ...(mode === 'light'
              ? {
                  backgroundColor: '#000000',
                  color: '#FFFFFF',
                  '&:hover': { backgroundColor: '#1a1a1a' },
                }
              : {}),
          },
          outlined: {
            ...(mode === 'light'
              ? {
                  borderColor: '#000000',
                  color: '#000000',
                  '&:hover': { backgroundColor: '#f9fafb', borderColor: '#000000' },
                }
              : {}),
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            ...(mode === 'light'
              ? {
                  backgroundColor: '#FFFFFF',
                  color: '#030303',
                  borderRight: '1px solid #e7eaf0',
                }
              : {
                  backgroundColor: '#111827',
                  color: '#F1F5F9',
                  borderRight: '1px solid #374151',
                }),
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            ...(mode === 'light'
              ? {
                  backgroundColor: '#FFFFFF',
                  color: '#030303',
                  borderBottom: '1px solid #e7eaf0',
                }
              : {
                  backgroundColor: '#1F2937',
                  color: '#F1F5F9',
                  borderBottom: '1px solid #374151',
                }),
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            ...(mode === 'light'
              ? {
                  '&:hover': { backgroundColor: '#F9FAFB' },
                  '&.Mui-selected': {
                    backgroundColor: '#f0f0f0',
                    color: '#000000',
                    '&:hover': { backgroundColor: '#f0f0f0' },
                  },
                }
              : {}),
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            ...(mode === 'light'
              ? {
                  backgroundImage: 'none',
                  borderColor: '#e7eaf0',
                }
              : {}),
          },
        },
      },
      MuiDivider: {
        styleOverrides: {
          root: {
            ...(mode === 'light'
              ? { borderColor: '#e7eaf0' }
              : {}),
          },
        },
      },
    },
  });

  const toggleTheme = () => {
    setMode((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeContext.Provider>
  );
}
