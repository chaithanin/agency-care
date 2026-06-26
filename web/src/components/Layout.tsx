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
  Menu,
  MenuItem,
  Button,
  Chip,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import TranslateRoundedIcon from '@mui/icons-material/TranslateRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded';
import RouteRoundedIcon from '@mui/icons-material/RouteRounded';
import SpeedRoundedIcon from '@mui/icons-material/SpeedRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import PsychologyRoundedIcon from '@mui/icons-material/PsychologyRounded';
import TodayRoundedIcon from '@mui/icons-material/TodayRounded';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import AssignmentRoundedIcon from '@mui/icons-material/AssignmentRounded';
import SummarizeRoundedIcon from '@mui/icons-material/SummarizeRounded';
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import DirectionsWalkRoundedIcon from '@mui/icons-material/DirectionsWalkRounded';
import BeachAccessRoundedIcon from '@mui/icons-material/BeachAccessRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import FolderSpecialRoundedIcon from '@mui/icons-material/FolderSpecialRounded';
import Hub from '@mui/icons-material/HubRounded';
import HowToVoteRoundedIcon from '@mui/icons-material/HowToVoteRounded';
import ManageSearchRoundedIcon from '@mui/icons-material/ManageSearchRounded';
import StorageRoundedIcon from '@mui/icons-material/StorageRounded';
import AccountCircleRoundedIcon from '@mui/icons-material/AccountCircleRounded';
import { useAuth, type Role } from '../auth/AuthContext';
import { useT } from '../i18n';
import { api } from '../api/client';

const DRAWER_WIDTH = 252;

function initials(name?: string) {
  if (!name) return '?';
  const p = name.trim().split(/\s+/);
  return (p[0]?.[0] ?? '') + (p[1]?.[0] ?? '');
}

const roleLabel: Record<Role, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  closer: 'Closer',
  sales: 'Sales',
};

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout, switchRole, stopImpersonation } = useAuth();
  const navigate = useNavigate();
  const [profileMenuAnchor, setProfileMenuAnchor] = useState<null | HTMLElement>(null);
  const { t, lang, setLang } = useT();
  const loc = useLocation();
  const theme = useTheme();
  const mdUp = useMediaQuery(theme.breakpoints.up('md'));

  const isAdmin = ['super_admin', 'admin'].includes(user?.activeRole ?? '');
  const isCloser = user?.activeRole === 'closer';
  const isManager = isAdmin || isCloser;

  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [roleMenuAnchor, setRoleMenuAnchor] = useState<null | HTMLElement>(null);
  const [switchingRole, setSwitchingRole] = useState(false);

  const loadUnread = useCallback(() => {
    api.get('/notifications/my/unread-count').then(r => setUnreadCount(r.data?.count ?? 0)).catch(() => {});
  }, []);
  useEffect(() => { if (user) { loadUnread(); const id = setInterval(loadUnread, 60000); return () => clearInterval(id); } }, [user, loadUnread]);

  // Role switching
  const availableRoles: Role[] = user ? [user.role, ...((user.additionalRoles ?? []) as Role[])] : [];
  const canSwitchRole = availableRoles.length > 1 && !user?.isImpersonated;

  const handleSwitchRole = async (role: Role) => {
    setRoleMenuAnchor(null);
    if (role === user?.activeRole) return;
    setSwitchingRole(true);
    try {
      await switchRole(role);
    } finally {
      setSwitchingRole(false);
    }
  };

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
      const office = d.inOffice ? t('lay.officeDutyParens') : '';
      setLoginMsg(
        `${t('lay.loginHello')} ${user.name} — ${n} ${t('lay.loginApptPost')}${office}`,
      );
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const managerNav = [
    { to: '/', label: 'Dashboard', icon: <DashboardRoundedIcon /> },
    { to: '/agencies', label: 'Agency', icon: <StorefrontRoundedIcon /> },
    { to: '/auto-assign', label: 'Monthly Planning', icon: <EventNoteRoundedIcon /> },
    { to: '/quick-assign', label: 'Auto Assignment', icon: <AutoAwesomeRoundedIcon /> },
    { to: '/plans', label: 'Site Visit', icon: <DirectionsWalkRoundedIcon /> },
    { to: '/site-visit-report', label: 'Site Visit Report', icon: <SummarizeRoundedIcon /> },
    { to: '/tasks', label: 'Task', icon: <AssignmentRoundedIcon /> },
    { to: '/analytics', label: 'AI Insight', icon: <PsychologyRoundedIcon /> },
    { to: '/kpi', label: 'KPI', icon: <SpeedRoundedIcon /> },
    {
      to: '/notifications',
      label: 'Notification',
      icon: (
        <Badge badgeContent={unreadCount > 0 ? unreadCount : undefined} color="error" max={99}>
          <NotificationsRoundedIcon />
        </Badge>
      ),
    },
    { to: '/reports', label: 'Reports', icon: <AssessmentRoundedIcon /> },
    { to: '/leave', label: t('nav.leave'), icon: <BeachAccessRoundedIcon /> },
    { to: '/pr', label: 'PR Tracking', icon: <ReceiptLongRoundedIcon /> },
    { to: '/docs', label: 'Documents', icon: <FolderSpecialRoundedIcon /> },
    { to: '/approvals', label: 'Approvals', icon: <HowToVoteRoundedIcon /> },
    { to: '/expenses', label: 'Expenses', icon: <ReceiptLongRoundedIcon /> },
    { to: '/training', label: 'Training', icon: <StorageRoundedIcon /> },
    { to: '/agency-scores', label: 'Agency Score', icon: <ManageSearchRoundedIcon /> },
    { to: '/evaluations', label: 'Evaluation', icon: <HowToVoteRoundedIcon /> },
    { to: '/ai-center', label: 'AI Center', icon: <ManageSearchRoundedIcon /> },
    { to: '/audit', label: 'Audit', icon: <ManageSearchRoundedIcon /> },
    { to: '/master-data', label: 'Master Data', icon: <StorageRoundedIcon /> },
    { to: '/notification-center', label: 'Notifications', icon: <CampaignRoundedIcon /> },
    { to: '/broadcast', label: 'LINE Broadcast', icon: <CampaignRoundedIcon sx={{ color: '#06C755' }} /> },
    { to: '/settings', label: 'Settings', icon: <SettingsRoundedIcon /> },
  ];
  const navItems = isManager
    ? managerNav
    : [
        { to: '/', label: 'Site Visit', icon: <DirectionsWalkRoundedIcon /> },
        { to: '/my-day', label: 'My Day', icon: <TodayRoundedIcon /> },
        { to: '/route', label: 'Route', icon: <RouteRoundedIcon /> },
        { to: '/tasks', label: 'Task', icon: <AssignmentRoundedIcon /> },
        { to: '/leave', label: t('nav.leave'), icon: <BeachAccessRoundedIcon /> },
        {
          to: '/notifications',
          label: 'Notification',
          icon: (
            <Badge badgeContent={unreadCount > 0 ? unreadCount : undefined} color="error" max={99}>
              <NotificationsRoundedIcon />
            </Badge>
          ),
        },
      ];

  const hour = new Date().getHours();
  const greet =
    hour < 12 ? t('lay.goodMorning') : hour < 17 ? t('lay.goodAfternoon') : t('lay.goodEvening');
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
            {user?.activeRole ? roleLabel[user.activeRole] : user?.role}
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
    <Box sx={{ display: 'flex', minHeight: '100vh', flexDirection: 'column' }}>
      {/* Impersonation banner */}
      {user?.isImpersonated && (
        <Box sx={{
          bgcolor: 'warning.main', color: 'warning.contrastText',
          px: 2, py: 0.75, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0, zIndex: 1300,
        }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <VisibilityRoundedIcon fontSize="small" />
            <Typography variant="body2" fontWeight={600}>
              {`${t('lay.viewingAsBanner')} "${user.name}" (${roleLabel[user.activeRole]})`}
            </Typography>
            {user.impersonatorName && (
              <Chip
                size="small"
                label={`${t('lay.byUser')} ${user.impersonatorName}`}
                sx={{ bgcolor: 'rgba(0,0,0,0.12)' }}
              />
            )}
          </Stack>
          <Button
            size="small"
            variant="outlined"
            onClick={stopImpersonation}
            sx={{ color: 'inherit', borderColor: 'rgba(0,0,0,0.3)', fontWeight: 700 }}
          >
            {t('lay.exitView')}
          </Button>
        </Box>
      )}

      <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
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
                  top: user?.isImpersonated ? '40px' : 0,
                  height: user?.isImpersonated ? 'calc(100vh - 40px)' : '100vh',
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
              {/* Switch Role dropdown */}
              {canSwitchRole && (
                <>
                  <Tooltip title={t('lay.switchRole')}>
                    <Button
                      size="small"
                      startIcon={<SwapHorizRoundedIcon />}
                      onClick={(e) => setRoleMenuAnchor(e.currentTarget)}
                      disabled={switchingRole}
                      sx={{
                        color: 'text.secondary',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 2.5, px: 1.5, gap: 0.5, textTransform: 'none',
                      }}
                    >
                      <Typography variant="caption" fontWeight={700}>
                        {user?.activeRole ? roleLabel[user.activeRole] : ''}
                      </Typography>
                    </Button>
                  </Tooltip>
                  <Menu
                    anchorEl={roleMenuAnchor}
                    open={Boolean(roleMenuAnchor)}
                    onClose={() => setRoleMenuAnchor(null)}
                  >
                    {availableRoles.map((r) => (
                      <MenuItem
                        key={r}
                        selected={r === user?.activeRole}
                        onClick={() => handleSwitchRole(r)}
                        sx={{ minWidth: 140 }}
                      >
                        {roleLabel[r]}
                        {r === user?.activeRole && (
                          <Chip size="small" label="Active" color="primary" sx={{ ml: 1 }} />
                        )}
                      </MenuItem>
                    ))}
                  </Menu>
                </>
              )}

              <Tooltip title={t('lay.switchLang')}>
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
              <Tooltip title="Profile">
                <Avatar
                  sx={{ width: 38, height: 38, bgcolor: 'primary.main', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
                  onClick={(e) => setProfileMenuAnchor(e.currentTarget)}
                >
                  {initials(user?.name)}
                </Avatar>
              </Tooltip>
              <Menu anchorEl={profileMenuAnchor} open={Boolean(profileMenuAnchor)} onClose={() => setProfileMenuAnchor(null)}>
                <MenuItem onClick={() => { setProfileMenuAnchor(null); navigate('/profile'); }} sx={{ gap: 1 }}>
                  <AccountCircleRoundedIcon fontSize="small" /> Profile & LINE Link
                </MenuItem>
                <Divider />
                <MenuItem onClick={() => { setProfileMenuAnchor(null); logout(); }} sx={{ gap: 1, color: 'error.main' }}>
                  <LogoutRoundedIcon fontSize="small" /> {t('common.logout')}
                </MenuItem>
              </Menu>
            </Stack>
          </Stack>

          {/* Page content */}
          <Box sx={{ flex: 1, px: { xs: 2, md: 3.5 }, pb: 5, pt: 1 }}>{children}</Box>
        </Box>
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
