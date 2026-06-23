import { type ReactNode, useCallback, useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Stack,
  Snackbar,
  Alert,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Avatar,
  Tooltip,
  Divider,
  Badge,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Link, useLocation } from 'react-router-dom';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import TranslateRoundedIcon from '@mui/icons-material/TranslateRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import DevicesOtherRoundedIcon from '@mui/icons-material/DevicesOtherRounded';
import RouteRoundedIcon from '@mui/icons-material/RouteRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import LeaderboardRoundedIcon from '@mui/icons-material/LeaderboardRounded';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import SpeedRoundedIcon from '@mui/icons-material/SpeedRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import PsychologyRoundedIcon from '@mui/icons-material/PsychologyRounded';
import ManageAccountsRoundedIcon from '@mui/icons-material/ManageAccountsRounded';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import TodayRoundedIcon from '@mui/icons-material/TodayRounded';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import AssignmentRoundedIcon from '@mui/icons-material/AssignmentRounded';
import Hub from '@mui/icons-material/HubRounded';
import { useAuth } from '../auth/AuthContext';
import { useT } from '../i18n';
import { api } from '../api/client';
import { Link as RouterLink } from 'react-router-dom';

const DRAWER_WIDTH = 252;

function initials(name?: string) {
  if (!name) return '?';
  const p = name.trim().split(/\s+/);
  return (p[0]?.[0] ?? '') + (p[1]?.[0] ?? '');
}

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { t, lang, setLang } = useT();
  const loc = useLocation();
  const theme = useTheme();
  const mdUp = useMediaQuery(theme.breakpoints.up('md'));
  const isAdmin = user?.role === 'admin';
  const isCloser = user?.role === 'closer';
  const isManager = isAdmin || isCloser;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnread = useCallback(() => {
    api.get('/notifications/my/unread-count').then(r => setUnreadCount(r.data?.count ?? 0)).catch(() => {});
  }, []);
  useEffect(() => { if (user) { loadUnread(); const id = setInterval(loadUnread, 60000); return () => clearInterval(id); } }, [user, loadUnread]);

  // แจ้งเตือนงานเมื่อ sale/closer เข้าระบบ (ครั้งเดียวต่อ session)
  const [loginMsg, setLoginMsg] = useState('');
  useEffect(() => {
    if (!user || isManager) return;
    if (sessionStorage.getItem('loginNotified')) return;
    sessionStorage.setItem('loginNotified', '1');
    api.get('/scheduling/my-day').then((r) => {
      const d = r.data;
      if (d?.error) return;
      const n = d.visits?.length ?? 0;
      const office = d.inOffice ? (lang === 'th' ? ' (วันนี้เวรออฟฟิศ)' : ' (office duty)') : '';
      setLoginMsg(
        lang === 'th'
          ? `สวัสดี ${user.name} — วันนี้มี ${n} นัดเยี่ยม${office}`
          : `Hi ${user.name} — ${n} visits today${office}`,
      );
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const baseManagerNav = [
    { to: '/', label: t('nav.dashboard'), icon: <DashboardRoundedIcon /> },
    { to: '/agencies', label: t('nav.agency'), icon: <StorefrontRoundedIcon /> },
    { to: '/employees', label: t('nav.employees'), icon: <GroupsRoundedIcon /> },
    { to: '/plans', label: t('nav.plans'), icon: <EventNoteRoundedIcon /> },
    { to: '/posm', label: t('nav.posm'), icon: <CampaignRoundedIcon /> },
    { to: '/products', label: t('nav.products'), icon: <Inventory2RoundedIcon /> },
    { to: '/models', label: t('nav.models'), icon: <DevicesOtherRoundedIcon /> },
    { to: '/route', label: t('nav.route'), icon: <RouteRoundedIcon /> },
    { to: '/scheduling', label: t('nav.scheduling'), icon: <ScheduleRoundedIcon /> },
    { to: '/calendar', label: t('nav.calendar'), icon: <CalendarMonthRoundedIcon /> },
    { to: '/seller-performance', label: t('nav.sellerPerf'), icon: <LeaderboardRoundedIcon /> },
    { to: '/pipeline', label: t('nav.pipeline'), icon: <AccountTreeRoundedIcon /> },
    { to: '/kpi', label: t('nav.kpi'), icon: <SpeedRoundedIcon /> },
  ];
  const navItems = isAdmin
    ? [
        ...baseManagerNav,
        { to: '/tasks', label: t('nav.tasks'), icon: <AssignmentRoundedIcon /> },
        { to: '/auto-assign', label: t('nav.autoassign'), icon: <AutoAwesomeRoundedIcon /> },
        { to: '/analytics', label: t('nav.ai'), icon: <PsychologyRoundedIcon /> },
        { to: '/users', label: t('nav.users'), icon: <ManageAccountsRoundedIcon /> },
      ]
    : isCloser
    ? [...baseManagerNav, { to: '/tasks', label: t('nav.tasks'), icon: <AssignmentRoundedIcon /> }]
    : [
        { to: '/', label: t('nav.myWork'), icon: <HomeRoundedIcon /> },
        { to: '/my-day', label: t('nav.myDay'), icon: <TodayRoundedIcon /> },
        { to: '/calendar', label: t('nav.calendar'), icon: <CalendarMonthRoundedIcon /> },
        { to: '/route', label: t('nav.route'), icon: <RouteRoundedIcon /> },
        { to: '/tasks', label: t('nav.tasks'), icon: <AssignmentRoundedIcon /> },
      ];

  const hour = new Date().getHours();
  const greet =
    lang === 'th'
      ? hour < 12 ? 'สวัสดีตอนเช้า' : hour < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น'
      : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr = new Date().toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 1.5 }}>
      {/* Logo */}
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: 1, py: 1.5, mb: 1 }}>
        <Box sx={{
          width: 42, height: 42, borderRadius: 3, flexShrink: 0,
          background: 'linear-gradient(135deg, #8b7ff5, #5b4fd6)',
          display: 'grid', placeItems: 'center',
          boxShadow: '0 10px 24px -8px rgba(124,111,240,0.7)',
        }}>
          <Hub sx={{ color: '#fff', fontSize: 24 }} />
        </Box>
        <Box sx={{ lineHeight: 1 }}>
          <Typography sx={{ fontWeight: 900, fontSize: 18, lineHeight: 1 }}>AGENCY</Typography>
          <Typography sx={{ color: 'primary.light', fontWeight: 800, fontSize: 12, letterSpacing: 3 }}>
            CARE
          </Typography>
        </Box>
      </Stack>

      {/* Nav */}
      <List sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', px: 0.5, py: 0,
        '&::-webkit-scrollbar': { width: 5 } }}>
        {navItems.map((n) => {
          const active = loc.pathname === n.to;
          return (
            <ListItemButton
              key={n.to}
              component={Link}
              to={n.to}
              selected={active}
              onClick={() => setMobileOpen(false)}
              sx={{
                mb: 0.5, py: 0.9,
                color: active ? '#fff' : 'text.secondary',
                background: active
                  ? 'linear-gradient(90deg, rgba(124,111,240,0.30), rgba(124,111,240,0.04))'
                  : 'transparent',
                '&.Mui-selected': { background: 'linear-gradient(90deg, rgba(124,111,240,0.30), rgba(124,111,240,0.04))' },
                '&.Mui-selected:hover': { background: 'linear-gradient(90deg, rgba(124,111,240,0.38), rgba(124,111,240,0.08))' },
                '&:hover': { background: 'rgba(255,255,255,0.05)', color: '#fff' },
              }}
            >
              <ListItemIcon sx={{ minWidth: 36, color: active ? 'primary.light' : 'inherit' }}>
                {n.icon}
              </ListItemIcon>
              <ListItemText
                primary={n.label}
                primaryTypographyProps={{ fontSize: 14, fontWeight: active ? 700 : 500, noWrap: true }}
              />
            </ListItemButton>
          );
        })}
      </List>

      {/* User card */}
      <Divider sx={{ my: 1 }} />
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{
        p: 1.2, borderRadius: 3, background: 'rgba(255,255,255,0.04)',
      }}>
        <Avatar sx={{ width: 38, height: 38, bgcolor: 'primary.dark', fontSize: 14, fontWeight: 700 }}>
          {initials(user?.name)}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={700} noWrap>{user?.name}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ textTransform: 'capitalize' }}>
            {user?.role}
          </Typography>
        </Box>
        <Tooltip title={t('common.logout')}>
          <IconButton size="small" onClick={logout} sx={{ color: 'text.secondary' }}>
            <LogoutRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        {mdUp ? (
          <Drawer
            variant="permanent"
            open
            PaperProps={{
              sx: {
                width: DRAWER_WIDTH, border: 'none',
                background: '#100e1c',
                borderRight: '1px solid rgba(255,255,255,0.06)',
              },
            }}
          >
            {drawer}
          </Drawer>
        ) : (
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={() => setMobileOpen(false)}
            ModalProps={{ keepMounted: true }}
            PaperProps={{
              sx: {
                width: DRAWER_WIDTH, border: 'none',
                background: '#100e1c',
              },
            }}
          >
            {drawer}
          </Drawer>
        )}
      </Box>

      {/* Main */}
      <Box sx={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Top bar */}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ px: { xs: 2, md: 3.5 }, pt: { xs: 2, md: 3 }, pb: 1.5, gap: 1 }}
        >
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
            {!mdUp && (
              <IconButton onClick={() => setMobileOpen(true)} sx={{ color: 'text.primary' }}>
                <MenuRoundedIcon />
              </IconButton>
            )}
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h5" noWrap sx={{ lineHeight: 1.15 }}>
                {greet}, {user?.name?.split(' ')[0]} 👋
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap sx={{ textTransform: 'capitalize' }}>
                {dateStr}
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" alignItems="center" spacing={1}>
            <Tooltip title={lang === 'th' ? 'English' : 'ภาษาไทย'}>
              <IconButton
                onClick={() => setLang(lang === 'th' ? 'en' : 'th')}
                sx={{
                  color: 'text.secondary', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 2.5, px: 1, gap: 0.5,
                }}
              >
                <TranslateRoundedIcon fontSize="small" />
                <Typography variant="caption" fontWeight={700}>{lang === 'th' ? 'TH' : 'EN'}</Typography>
              </IconButton>
            </Tooltip>
            <Tooltip title={t('nav.notifications')}>
              <IconButton component={RouterLink} to="/notifications" sx={{ color: 'text.secondary' }}>
                <Badge badgeContent={unreadCount > 0 ? unreadCount : undefined} color="error" max={99}>
                  <NotificationsRoundedIcon />
                </Badge>
              </IconButton>
            </Tooltip>
            <Avatar sx={{ width: 38, height: 38, bgcolor: 'primary.main', fontSize: 14, fontWeight: 700 }}>
              {initials(user?.name)}
            </Avatar>
          </Stack>
        </Stack>

        {/* Page content */}
        <Box sx={{ flex: 1, px: { xs: 2, md: 3.5 }, pb: 5, pt: 1 }}>{children}</Box>
      </Box>

      <Snackbar
        open={!!loginMsg}
        autoHideDuration={6000}
        onClose={() => setLoginMsg('')}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity="info" variant="filled" onClose={() => setLoginMsg('')} sx={{ width: '100%' }}>
          🔔 {loginMsg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
