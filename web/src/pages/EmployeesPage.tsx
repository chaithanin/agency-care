import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
  Chip,
  Alert,
} from '@mui/material';
import { api, errMsg } from '../api/client';

interface Employee {
  id: string;
  code: string;
  name: string;
  phone?: string;
  zone?: string;
  isActive: boolean;
  user?: { email: string; role: string } | null;
  _count: { assignments: number };
}

const empty = { code: '', name: '', phone: '', zone: '', lineUserId: '', email: '', password: '' };

export default function EmployeesPage() {
  const [rows, setRows] = useState<Employee[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...empty });
  const [error, setError] = useState('');

  const [notifyMsg, setNotifyMsg] = useState('');
  const [notifying, setNotifying] = useState(false);

  const load = () => api.get('/employees').then((r) => setRows(r.data));
  useEffect(() => {
    load();
  }, []);

  const runNotify = async () => {
    setNotifying(true);
    setNotifyMsg('');
    try {
      const { data } = await api.post('/notifications/run', {});
      const sent = data.results.filter((r: { sent: boolean }) => r.sent).length;
      setNotifyMsg(`ส่งแจ้งเตือนสำเร็จ ${sent}/${data.totalEmployees} คน (งานค้าง ณ ${data.date})`);
    } catch (e) {
      setNotifyMsg(errMsg(e));
    } finally {
      setNotifying(false);
    }
  };

  const save = async () => {
    setError('');
    try {
      await api.post('/employees', {
        code: form.code,
        name: form.name,
        phone: form.phone || undefined,
        zone: form.zone || undefined,
        lineUserId: form.lineUserId || undefined,
        email: form.email || undefined,
        password: form.password || undefined,
      });
      setOpen(false);
      setForm({ ...empty });
      load();
    } catch (e) {
      setError(errMsg(e));
    }
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={700}>
          พนักงาน / เซลส์
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={runNotify} disabled={notifying}>
            {notifying ? 'กำลังส่ง...' : '🔔 แจ้งเตือนงานค้าง'}
          </Button>
          <Button variant="contained" onClick={() => setOpen(true)}>
            + เพิ่มพนักงาน
          </Button>
        </Stack>
      </Stack>

      {notifyMsg && (
        <Alert severity="info" sx={{ mb: 2 }} onClose={() => setNotifyMsg('')}>
          {notifyMsg}
        </Alert>
      )}

      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>รหัส</TableCell>
              <TableCell>ชื่อ</TableCell>
              <TableCell>โซน</TableCell>
              <TableCell>บัญชี login</TableCell>
              <TableCell align="right">Agency ที่ดูแล</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((e) => (
              <TableRow key={e.id}>
                <TableCell>{e.code}</TableCell>
                <TableCell>{e.name}</TableCell>
                <TableCell>{e.zone || '-'}</TableCell>
                <TableCell>
                  {e.user ? (
                    <Chip size="small" color="success" label={e.user.email} />
                  ) : (
                    <Chip size="small" label="ไม่มี" />
                  )}
                </TableCell>
                <TableCell align="right">{e._count.assignments}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>เพิ่มพนักงาน</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            {error && <Alert severity="error">{error}</Alert>}
            <Stack direction="row" spacing={2}>
              <TextField
                label="รหัสพนักงาน"
                placeholder="SALE-001"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                required
                sx={{ flex: 1 }}
              />
              <TextField
                label="โซน"
                value={form.zone}
                onChange={(e) => setForm({ ...form, zone: e.target.value })}
                sx={{ flex: 1 }}
              />
            </Stack>
            <TextField
              label="ชื่อ-สกุล"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <TextField
              label="เบอร์โทร"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <TextField
              label="LINE User ID (สำหรับแจ้งเตือน)"
              value={form.lineUserId}
              onChange={(e) => setForm({ ...form, lineUserId: e.target.value })}
              placeholder="Uxxxxxxxx..."
            />
            <Typography variant="subtitle2" color="text.secondary">
              บัญชีเข้าระบบ (ถ้าต้องการให้เซลส์ login บนมือถือ)
            </Typography>
            <TextField
              label="อีเมล"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <TextField
              label="รหัสผ่าน"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>ยกเลิก</Button>
          <Button variant="contained" onClick={save}>
            บันทึก
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
