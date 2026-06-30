import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Button, Stack, Alert, CircularProgress,
  Card, CardContent, Divider, Chip, IconButton, Tooltip,
} from '@mui/material';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { api, errMsg } from '../api/client';

interface MeData {
  id: string; name: string; email: string;
  employee?: { id: string; code: string; lineUserId?: string };
}

export default function LineConnectionPage() {
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
      const r = await api.get<{ liffUrl: string }>('/auth/line-link-token');
      window.open(r.data.liffUrl, '_blank');
      setMsg('LINE opened. Please return to this app after linking is complete.');

      // poll ทุก 2 วินาทีเป็นเวลา 5 นาที
      let tries = 0;
      const timer = setInterval(async () => {
        tries++;
        const fresh = await api.get<MeData>('/auth/me').catch(() => null);
        if (fresh?.data?.employee?.lineUserId) {
          clearInterval(timer);
          setMe(fresh.data);
          setMsg('LINE account linked successfully!');
        }
        if (tries >= 150) clearInterval(timer);
      }, 2000);
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

  const handleAddLineOA = () => {
    // Open LINE chat with the OA
    window.open('https://lin.ee/agency-care', '_blank');
  };

  if (loading) return <Box p={6} textAlign="center"><CircularProgress /></Box>;

  const isLinked = !!me?.employee?.lineUserId;

  return (
    <Box p={3} maxWidth={700} mx="auto">
      <Typography variant="h5" fontWeight={700} mb={3}>LINE Connection</Typography>

      {msg && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMsg('')}>{msg}</Alert>}
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr('')}>{err}</Alert>}

      {/* Step 1: Add LINE OA */}
      <Card sx={{ mb: 3, border: '2px solid #06C755' }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={2} mb={2}>
            <Box sx={{
              width: 40, height: 40, borderRadius: 2, bgcolor: '#06C755',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 700
            }}>1</Box>
            <Typography variant="subtitle1" fontWeight={700}>Add LINE OA as Friend</Typography>
            {isLinked && <Chip icon={<CheckCircleOutlineIcon />} label="Done" color="success" size="small" />}
          </Stack>

          <Typography variant="body2" color="text.secondary" mb={2}>
            เพิ่มเพื่อน LINE Official Account "Agency Care Bot" เพื่อรับการแจ้งเตือน
          </Typography>

          <Button
            variant="contained"
            startIcon={<PersonAddIcon />}
            onClick={handleAddLineOA}
            sx={{ bgcolor: '#06C755', '&:hover': { bgcolor: '#00A846' } }}
          >
            Add LINE OA Friend
          </Button>
        </CardContent>
      </Card>

      <Divider sx={{ my: 2 }} />

      {/* Step 2: Link LINE Account */}
      <Card sx={{ border: '2px solid #0369A1' }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={2} mb={2}>
            <Box sx={{
              width: 40, height: 40, borderRadius: 2, bgcolor: '#0369A1',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 700
            }}>2</Box>
            <Typography variant="subtitle1" fontWeight={700}>Link Your LINE Account</Typography>
            {isLinked ? (
              <Chip icon={<CheckCircleOutlineIcon />} label="Linked" color="success" size="small" />
            ) : (
              <Chip icon={<ErrorOutlineIcon />} label="Not Linked" color="error" size="small" />
            )}
          </Stack>

          <Typography variant="body2" color="text.secondary" mb={2}>
            {isLinked
              ? `ลิงก์ไป: ${me?.employee?.lineUserId?.slice(0, 12)}...`
              : 'ลิงก์บัญชี LINE ของคุณเพื่อรับการแจ้งเตือนในแอป'}
          </Typography>

          <Stack direction="row" spacing={1}>
            <Button
              variant={isLinked ? 'outlined' : 'contained'}
              startIcon={linking ? <CircularProgress size={16} color="inherit" /> : <LinkIcon />}
              onClick={handleLinkLine}
              disabled={linking || !me?.employee}
              sx={{
                bgcolor: isLinked ? 'transparent' : '#0369A1',
                color: '#0369A1',
                borderColor: '#0369A1',
                '&:hover': { bgcolor: isLinked ? '#f0f0f0' : '#025a96' },
              }}
            >
              {isLinked ? 'Change Account' : 'Link Account'}
            </Button>

            {isLinked && (
              <Tooltip title="Unlink LINE">
                <IconButton color="error" onClick={handleUnlinkLine}><LinkOffIcon /></IconButton>
              </Tooltip>
            )}
          </Stack>

          {!me?.employee && (
            <Alert severity="info" sx={{ mt: 2 }} icon={false}>
              This account is not linked to an employee record — please contact Admin
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Info Section */}
      <Paper sx={{ p: 2, mt: 3, bgcolor: '#f5f5f5' }}>
        <Typography variant="subtitle2" fontWeight={700} mb={1}>ข้อมูลการเชื่อมต่อ LINE</Typography>
        <Stack spacing={1}>
          <Typography variant="body2">
            <strong>ขั้นตอนที่ 1:</strong> คลิก "Add LINE OA Friend" เพื่อเพิ่มบอตลงใน LINE
          </Typography>
          <Typography variant="body2">
            <strong>ขั้นตอนที่ 2:</strong> คลิก "Link Account" เพื่อเชื่อมต่อบัญชีของคุณ
          </Typography>
          <Typography variant="body2">
            <strong>ผลลัพธ์:</strong> เมื่อทำเสร็จแล้ว คุณจะได้รับการแจ้งเตือนใน LINE
          </Typography>
        </Stack>
      </Paper>
    </Box>
  );
}
