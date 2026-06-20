import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    primary: { main: '#1565c0' },
    secondary: { main: '#00897b' },
    background: { default: '#f4f6f8' },
  },
  typography: {
    fontFamily: '"Sarabun", "Roboto", "Helvetica", sans-serif',
  },
  shape: { borderRadius: 10 },
});
