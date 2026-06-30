import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Avatar, Chip, Button, Divider, Stack,
  Alert, CircularProgress, IconButton, Tooltip,
} from '@mui/material';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PersonIcon from '@mui/icons-material/Person';
import { useAuth } from '../auth/AuthContext';
import { api, errMsg } from '../api/client';

interface MeData {
  id: string; name: string; email: string; role: string; activeRole: string;
  employee?: { id: string; code: string; zone?: string; lineUserId?: string };
}

export default function ProfilePage() {
  const { user } = useAuth();
  const [me, setMe] = useState<MeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get<MeData>('/auth/me');
      setMe(r.data);
    } catch (e) { setErr(errMsg(e)); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleLinkLine = async () => {
    setLinking(true); setErr(''); setMsg('');
    try {
      const r = await api.get<{ liffUrl: string; alreadyLinked: boolean }>('/auth/line-link-token');
      // เปิด LIFF URL ในแท็บใหม่ / LINE in-app browser
      window.open(r.data.liffUrl, '_blank');
      setMsg('LINE opened. Please return to this app after linking is complete.');
      // poll ทุก 3 วินาทีเป็นเวลา 2 นาที เพื่อ detect เมื่อ link สำเร็จ
      let tries = 0;
      const timer = setInterval(async () => {
        tries++;
        const fresh = await api.get<MeData>('/auth/me').catch(() => null);
        if (fresh?.data?.employee?.lineUserId) {
          clearInterval(timer);
          setMe(fresh.data);
          setMsg('LINE account linked successfully!');
        }
        if (tries >= 40) clearInterval(timer);
      }, 3000);
    } catch (e) { setErr(errMsg(e)); }
    setLinking(false);
  };

  const handleUnlinkLine = async () => {
    if (!confirm('Unlink LINE account?')) return;
    setErr(''); setMsg('');
    try {
      await api.delete('/auth/unlink-line');
      setMsg('LINE account unlinked successfully.');
      load();
    } catch (e) { setErr(errMsg(e)); }
  };

  if (loading) return <Box p={6} textAlign="center"><CircularProgress /></Box>;

  const roleLabel: Record<string, string> = {
    manager: 'Manager', super_admin: 'Super Admin', admin: 'Admin', closer: 'Closer', sales: 'Sales',
  };

  const isLinked = !!me?.employee?.lineUserId;

  return (
    <Box p={3} maxWidth={600} mx="auto">
      <Typography variant="h5" fontWeight={700} mb={3}>Profile</Typography>

      {msg && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMsg('')}>{msg}</Alert>}
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr('')}>{err}</Alert>}

      {/* User Info Card */}
      <Paper sx={{ p: 3, mb: 2, borderRadius: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center" mb={2}>
          <Avatar sx={{ width: 64, height: 64, bgcolor: '#4F46E5', fontSize: 26 }}>
            {(me?.name ?? user?.name ?? 'U')[0].toUpperCase()}
          </Avatar>
          <Box>
            <Typography variant="h6" fontWeight={700}>{me?.name ?? user?.name}</Typography>
            <Typography variant="body2" color="text.secondary">{me?.email}</Typography>
            <Stack direction="row" spacing={1} mt={0.5}>
              <Chip label={roleLabel[me?.activeRole ?? ''] ?? me?.activeRole} size="small" color="primary" />
              {me?.employee?.code && (
                <Chip icon={<PersonIcon />} label={me.employee.code} size="small" variant="outlined" />
              )}
            </Stack>
          </Box>
        </Stack>

        {me?.employee?.zone && (
          <Typography variant="body2" color="text.secondary">Zone: {me.employee.zone}</Typography>
        )}
      </Paper>

      {/* LINE Linking Card */}
      <Paper sx={{ p: 3, borderRadius: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1} mb={2}>
          <Box sx={{ width: 32, height: 32, borderRadius: 1, bgcolor: '#06C755', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 56 56" fill="none">
              <path d="M46 25.6C46 17.6 38.8 11 28 11C17.2 11 10 17.6 10 25.6C10 32.8 16.4 38.8 25.2 39.8L25.6 43.6C25.6 44 26 44.2 26.4 44L31.2 41.2C32.4 41 33.6 40.6 34.8 40.2C41.6 38.2 46 32.4 46 25.6Z" fill="white"/>
            </svg>
          </Box>
          <Typography variant="subtitle1" fontWeight={700}>LINE Notifications</Typography>
          {isLinked
            ? <Chip label="Connected" size="small" color="success" sx={{ ml: 'auto' }} />
            : <Chip label="Not Connected" size="small" color="default" sx={{ ml: 'auto' }} />}
        </Stack>

        <Typography variant="body2" color="text.secondary" mb={2}>
          {isLinked
            ? `Linked to LINE UID: ${me?.employee?.lineUserId?.slice(0, 12)}...`
            : 'Link your account to receive notifications from Agency Care Bot on LINE.'}
        </Typography>

        <Divider sx={{ mb: 2 }} />

        <Stack direction="row" spacing={1}>
          {!isLinked ? (
            <Button
              variant="contained"
              startIcon={linking ? <CircularProgress size={16} color="inherit" /> : <LinkIcon />}
              onClick={handleLinkLine}
              disabled={linking || !me?.employee}
              sx={{ bgcolor: '#06C755', '&:hover': { bgcolor: '#00A846' } }}
            >
              Link LINE Account
            </Button>
          ) : (
            <>
              <Button
                variant="outlined" startIcon={<LinkIcon />}
                onClick={handleLinkLine} disabled={linking}
                sx={{ color: '#06C755', borderColor: '#06C755' }}
              >
                Change LINE Account
              </Button>
              <Tooltip title="Unlink LINE">
                <IconButton color="error" onClick={handleUnlinkLine}><LinkOffIcon /></IconButton>
              </Tooltip>
            </>
          )}
          <Tooltip title="Open LINE OA">
            <IconButton onClick={() => window.open('https://lin.ee/agency-care', '_blank')}>
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>

        {!me?.employee && (
          <Alert severity="info" sx={{ mt: 2 }} icon={false}>
            This account is not linked to an employee record — please contact Admin to create an employee profile.
          </Alert>
        )}
      </Paper>
    </Box>
  );
}
