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
import { useT } from '../i18n';

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { t, lang, setLang } = useT();
  const loc = useLocation();
  const isManager = user?.role === 'admin' || user?.role === 'manager';

  const navItems = isManager
    ? [
        { to: '/', label: t('nav.dashboard') },
        { to: '/agencies', label: t('nav.agency') },
        { to: '/employees', label: t('nav.employees') },
        { to: '/plans', label: t('nav.plans') },
        { to: '/posm', label: t('nav.posm') },
        { to: '/products', label: t('nav.products') },
        { to: '/models', label: t('nav.models') },
        { to: '/route', label: t('nav.route') },
        { to: '/scheduling', label: t('nav.scheduling') },
        { to: '/seller-performance', label: t('nav.sellerPerf') },
        { to: '/kpi', label: t('nav.kpi') },
        { to: '/auto-assign', label: t('nav.autoassign') },
        { to: '/analytics', label: t('nav.ai') },
      ]
    : [
        { to: '/', label: t('nav.myWork') },
        { to: '/my-day', label: t('nav.myDay') },
        { to: '/route', label: t('nav.route') },
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
          <Button
            color="inherit"
            size="small"
            onClick={() => setLang(lang === 'th' ? 'en' : 'th')}
            sx={{ mr: 1, border: '1px solid rgba(255,255,255,0.5)', minWidth: 44 }}
          >
            {lang === 'th' ? 'EN' : 'ไทย'}
          </Button>
          <Typography variant="body2" sx={{ mr: 2, opacity: 0.9 }}>
            {user?.name}
          </Typography>
          <Button color="inherit" size="small" onClick={logout}>
            {t('common.logout')}
          </Button>
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ py: 2 }}>
        {children}
      </Container>
    </Box>
  );
}
