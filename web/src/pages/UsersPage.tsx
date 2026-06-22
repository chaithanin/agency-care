import { useEffect, useState } from 'react';
import {
  Box, Button, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Stack, Chip, Alert,
  MenuItem, FormControlLabel, Checkbox, IconButton,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import KeyIcon from '@mui/icons-material/Key';
import { api, errMsg } from '../api/client';
import { useT } from '../i18n';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  employee?: { id: string; code: string; name: string } | null;
}
const ROLES = ['admin', 'manager', 'sales'];
const roleColor = (r: string) => (r === 'admin' ? 'error' : r === 'manager' ? 'warning' : 'primary');
const emptyCreate = { email: '', name: '', password: '', role: 'sales' };

export default function UsersPage() {
  const { t } = useT();
  const [rows, setRows] = useState<User[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyCreate });
  const [edit, setEdit] = useState<User | null>(null);
  const [pwFor, setPwFor] = useState<User | null>(null);
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = () => api.get('/users').then((r) => setRows(r.data));
  useEffect(() => { load(); }, []);

  const create = async () => {
    setError('');
    try {
      await api.post('/users', form);
      setCreateOpen(false); setForm({ ...emptyCreate }); load();
    } catch (e) { setError(errMsg(e)); }
  };
  const saveEdit = async () => {
    if (!edit) return;
    setError('');
    try {
      await api.patch(`/users/${edit.id}`, { name: edit.name, role: edit.role, isActive: edit.isActive });
      setEdit(null); load();
    } catch (e) { setError(errMsg(e)); }
  };
  const resetPw = async () => {
    if (!pwFor) return;
    setError('');
    try {
      await api.post(`/users/${pwFor.id}/reset-password`, { password: pw });
      setMsg(`รีเซ็ตรหัสผ่าน ${pwFor.email} แล้ว`); setPwFor(null); setPw('');
    } catch (e) { setError(errMsg(e)); }
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={700}>{t('nav.users')}</Typography>
        <Button variant="contained" onClick={() => { setError(''); setCreateOpen(true); }}>+ เพิ่มผู้ใช้</Button>
      </Stack>

      {msg && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMsg('')}>{msg}</Alert>}

      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>อีเมล</TableCell>
              <TableCell>ชื่อ</TableCell>
              <TableCell>สิทธิ์</TableCell>
              <TableCell>พนักงาน</TableCell>
              <TableCell align="center">สถานะ</TableCell>
              <TableCell align="center">จัดการ</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((u) => (
              <TableRow key={u.id} sx={{ opacity: u.isActive ? 1 : 0.5 }}>
                <TableCell>{u.email}</TableCell>
                <TableCell>{u.name}</TableCell>
                <TableCell><Chip size="small" color={roleColor(u.role)} label={u.role} /></TableCell>
                <TableCell>{u.employee ? `${u.employee.name} (${u.employee.code})` : '-'}</TableCell>
                <TableCell align="center">
                  <Chip size="small" label={u.isActive ? 'ใช้งาน' : 'ปิด'} color={u.isActive ? 'success' : 'default'} />
                </TableCell>
                <TableCell align="center">
                  <IconButton size="small" title="แก้ไข" onClick={() => { setError(''); setEdit({ ...u }); }}><EditIcon fontSize="small" /></IconButton>
                  <IconButton size="small" title="รีเซ็ตรหัสผ่าน" onClick={() => { setError(''); setPwFor(u); setPw(''); }}><KeyIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      {/* เพิ่มผู้ใช้ */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>เพิ่มผู้ใช้</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField label="อีเมล" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            <TextField label="ชื่อ-สกุล" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <TextField select label="สิทธิ์" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {ROLES.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
            </TextField>
            <TextField label="รหัสผ่าน" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required helperText="อย่างน้อย 6 ตัว" />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>ยกเลิก</Button>
          <Button variant="contained" onClick={create}>บันทึก</Button>
        </DialogActions>
      </Dialog>

      {/* แก้ไขผู้ใช้ */}
      <Dialog open={!!edit} onClose={() => setEdit(null)} fullWidth maxWidth="xs">
        <DialogTitle>แก้ไข: {edit?.email}</DialogTitle>
        <DialogContent>
          {edit && (
            <Stack spacing={2} mt={1}>
              {error && <Alert severity="error">{error}</Alert>}
              <TextField label="ชื่อ-สกุล" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
              <TextField select label="สิทธิ์" value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value })}>
                {ROLES.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
              </TextField>
              <FormControlLabel control={<Checkbox checked={edit.isActive} onChange={(e) => setEdit({ ...edit, isActive: e.target.checked })} />} label="เปิดใช้งาน" />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEdit(null)}>ยกเลิก</Button>
          <Button variant="contained" onClick={saveEdit}>บันทึก</Button>
        </DialogActions>
      </Dialog>

      {/* รีเซ็ตรหัสผ่าน */}
      <Dialog open={!!pwFor} onClose={() => setPwFor(null)} fullWidth maxWidth="xs">
        <DialogTitle>รีเซ็ตรหัสผ่าน: {pwFor?.email}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField label="รหัสผ่านใหม่" type="password" value={pw} onChange={(e) => setPw(e.target.value)} helperText="อย่างน้อย 6 ตัว" autoFocus />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPwFor(null)}>ยกเลิก</Button>
          <Button variant="contained" color="warning" onClick={resetPw} disabled={pw.length < 6}>รีเซ็ต</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
