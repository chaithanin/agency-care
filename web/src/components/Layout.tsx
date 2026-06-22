import { type ReactNode } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Button,
  Container,
  Stack,
} from '@mui/material';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const isManager = user?.role === 'admin' || user?.role === 'manager';

  const navItems = isManager
    ? [
        { to: '/', label: 'Dashboard' },
        { to: '/agencies', label: 'Agency' },
        { to: '/employees', label: 'พนักงาน' },
        { to: '/plans', label: 'แผนเยี่ยม' },
        { to: '/posm', label: 'POSM' },
        { to: '/products', label: 'สินค้า' },
        { to: '/models', label: 'อุปกรณ์' },
        { to: '/route', label: 'เส้นทาง' },
        { to: '/scheduling', label: 'ตารางงาน' },
        { to: '/kpi', label: 'KPI' },
        { to: '/auto-assign', label: 'จัดทีม' },
        { to: '/analytics', label: 'AI' },
      ]
    : [
        { to: '/', label: 'งานของฉัน' },
        { to: '/my-day', label: 'ตารางของฉัน' },
        { to: '/route', label: 'เส้นทาง' },
      ];

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <AppBar position="sticky">
        <Toolbar variant="dense">
          <Typography variant="h6" sx={{ fontWeight: 700, mr: 3 }}>
            Agency Care
          </Typography>
          <Stack direction="row" spacing={1} sx={{ flexGrow: 1 }}>
            {navItems.map((n) => (
              <Button
                key={n.to}
                component={Link}
                to={n.to}
                size="small"
                sx={{
                  color: 'white',
                  fontWeight: loc.pathname === n.to ? 700 : 400,
                  borderBottom: loc.pathname === n.to ? '2px solid white' : '2px solid transparent',
                  borderRadius: 0,
                }}
              >
                {n.label}
              </Button>
            ))}
          </Stack>
          <Typography variant="body2" sx={{ mr: 2, opacity: 0.9 }}>
            {user?.name}
          </Typography>
          <Button color="inherit" size="small" onClick={logout}>
            ออก
          </Button>
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ py: 2 }}>
        {children}
      </Container>
    </Box>
  );
}
