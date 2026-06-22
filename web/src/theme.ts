import { createTheme } from '@mui/material/styles';

const violet = '#7c6ff0';
const surface = 'rgba(26, 23, 43, 0.66)';

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: violet, light: '#9d93f5', dark: '#5b4fd6' },
    secondary: { main: '#4fc3f7' },
    success: { main: '#34d399' },
    warning: { main: '#fbbf24' },
    error: { main: '#f87171' },
    info: { main: '#60a5fa' },
    background: { default: '#0a0913', paper: surface },
    text: { primary: '#ECEBF5', secondary: '#9B99B8' },
    divider: 'rgba(255,255,255,0.07)',
  },
  typography: {
    fontFamily: '"Sarabun", "Inter", "Roboto", "Helvetica", sans-serif',
    h4: { fontWeight: 800, letterSpacing: -0.5 },
    h5: { fontWeight: 800, letterSpacing: -0.3 },
    h6: { fontWeight: 700 },
    button: { fontWeight: 600 },
  },
  shape: { borderRadius: 16 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          minHeight: '100vh',
          background:
            'radial-gradient(1100px 700px at 82% -12%, rgba(91,79,214,0.28) 0%, rgba(91,79,214,0) 55%),' +
            'radial-gradient(900px 600px at -10% 110%, rgba(79,195,247,0.10) 0%, rgba(79,195,247,0) 55%),' +
            'linear-gradient(180deg, #0b0a17 0%, #08070f 100%)',
          backgroundRepeat: 'no-repeat',
        },
        '*::-webkit-scrollbar': { width: 8, height: 8 },
        '*::-webkit-scrollbar-track': { background: 'transparent' },
        '*::-webkit-scrollbar-thumb': {
          background: 'rgba(255,255,255,0.12)',
          borderRadius: 8,
        },
        '*::-webkit-scrollbar-thumb:hover': { background: 'rgba(255,255,255,0.2)' },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: surface,
          border: '1px solid rgba(255,255,255,0.06)',
        },
        elevation0: { border: 'none', backgroundColor: 'transparent' },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: surface,
          border: '1px solid rgba(255,255,255,0.06)',
        },
      },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0, color: 'transparent' },
      styleOverrides: {
        root: { backgroundColor: 'transparent', backgroundImage: 'none', boxShadow: 'none' },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', borderRadius: 12, fontWeight: 600 },
        containedPrimary: {
          background: 'linear-gradient(135deg, #8b7ff5 0%, #6a5be0 100%)',
          boxShadow: '0 8px 22px -8px rgba(124,111,240,0.7)',
          '&:hover': { background: 'linear-gradient(135deg, #9a8ff7 0%, #7468e6 100%)' },
        },
      },
    },
    MuiChip: { styleOverrides: { root: { borderRadius: 9, fontWeight: 600 } } },
    MuiListItemButton: { styleOverrides: { root: { borderRadius: 12 } } },
    MuiTableCell: {
      styleOverrides: {
        root: { borderColor: 'rgba(255,255,255,0.06)' },
        head: { color: '#9B99B8', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4 },
      },
    },
    MuiTooltip: {
      styleOverrides: { tooltip: { backgroundColor: '#241f3a', fontSize: 12, borderRadius: 8 } },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          backgroundColor: 'rgba(255,255,255,0.03)',
        },
      },
    },
  },
});
