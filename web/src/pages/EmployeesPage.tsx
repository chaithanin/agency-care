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
  MenuItem,
  FormControlLabel,
  Checkbox,
  IconButton,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import { api, errMsg } from '../api/client';
import { useT } from '../i18n';

interface Employee {
  id: string;
  code: string;
  name: string;
  phone?: string;
  zone?: string;
  position?: string;
  teamId?: string | null;
  inTraining?: boolean;
  isActive: boolean;
  lineUserId?: string;
  user?: { email: string; role: string } | null;
  team?: { id: string; name: string } | null;
  _count: { assignments: number };
}
interface Team { id: string; name: string }

const emptyCreate = { code: '', name: '', phone: '', zone: '', lineUserId: '', email: '', password: '' };

export default function EmployeesPage() {
  const { t } = useT();
  const [rows, setRows] = useState<Employee[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyCreate });
  const [edit, setEdit] = useState<Employee | null>(null);
  const [error, setError] = useState('');
  const [notifyMsg, setNotifyMsg] = useState('');
  const [notifying, setNotifying] = useState(false);

  const load = () => api.get('/employees').then((r) => setRows(r.data));
  useEffect(() => {
    load();
    api.get('/scheduling/teams').then((r) => setTeams(r.data)).catch(() => {});
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

  const create = async () => {
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
      setCreateOpen(false);
      setForm({ ...emptyCreate });
      load();
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const saveEdit = async () => {
    if (!edit) return;
    setError('');
    try {
      await api.patch(`/employees/${edit.id}`, {
        name: edit.name,
        phone: edit.phone || undefined,
        zone: edit.zone || undefined,
        lineUserId: edit.lineUserId || undefined,
        position: edit.position,
        teamId: edit.teamId ?? '',
        inTraining: edit.inTraining,
        isActive: edit.isActive,
      });
      setEdit(null);
      load();
    } catch (e) {
      setError(errMsg(e));
    }
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={700}>{t('page.employees')}</Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={runNotify} disabled={notifying}>
            {notifying ? t('emp.notifying') : t('emp.notify')}
          </Button>
          <Button variant="contained" onClick={() => { setError(''); setCreateOpen(true); }}>
            {t('emp.add')}
          </Button>
        </Stack>
      </Stack>

      {notifyMsg && (
        <Alert severity="info" sx={{ mb: 2 }} onClose={() => setNotifyMsg('')}>{notifyMsg}</Alert>
      )}

      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('c.code')}</TableCell>
              <TableCell>{t('c.name')}</TableCell>
              <TableCell>{t('c.position')}</TableCell>
              <TableCell>{t('c.team')}</TableCell>
              <TableCell>{t('c.zone')}</TableCell>
              <TableCell>{t('emp.loginAcct')}</TableCell>
              <TableCell align="right">Agency</TableCell>
              <TableCell align="center">{t('common.edit')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((e) => (
              <TableRow key={e.id} sx={{ opacity: e.isActive ? 1 : 0.5 }}>
                <TableCell>{e.code}</TableCell>
                <TableCell>{e.name}{e.inTraining ? ' 🎓' : ''}</TableCell>
                <TableCell>
                  <Chip size="small" label={e.position === 'closer' ? 'Closer' : 'Sales'} color={e.position === 'closer' ? 'secondary' : 'primary'} variant="outlined" />
                </TableCell>
                <TableCell>{e.team?.name ?? '-'}</TableCell>
                <TableCell>{e.zone || '-'}</TableCell>
                <TableCell>
                  {e.user ? <Chip size="small" color="success" label={e.user.email} /> : <Chip size="small" label={t('c.none')} />}
                </TableCell>
                <TableCell align="right">{e._count.assignments}</TableCell>
                <TableCell align="center">
                  <IconButton size="small" onClick={() => { setError(''); setEdit({ ...e }); }}><EditIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      {/* ---- เพิ่มพนักงาน ---- */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('emp.addTitle')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            {error && <Alert severity="error">{error}</Alert>}
            <Stack direction="row" spacing={2}>
              <TextField label={t('emp.empCode')} placeholder="SALE-001" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required sx={{ flex: 1 }} />
              <TextField label={t('c.zone')} value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })} sx={{ flex: 1 }} />
            </Stack>
            <TextField label={t('d.fullName')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <TextField label={t('c.phone')} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <TextField label="LINE User ID" value={form.lineUserId} onChange={(e) => setForm({ ...form, lineUserId: e.target.value })} placeholder="Uxxxxxxxx..." />
            <Typography variant="subtitle2" color="text.secondary">{t('emp.loginHint')}</Typography>
            <TextField label={t('usr.email')} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <TextField label={t('d.password')} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={create}>{t('common.save')}</Button>
        </DialogActions>
      </Dialog>

      {/* ---- แก้ไขพนักงาน ---- */}
      <Dialog open={!!edit} onClose={() => setEdit(null)} fullWidth maxWidth="sm">
        <DialogTitle>{t('emp.editTitle')}: {edit?.code}</DialogTitle>
        <DialogContent>
          {edit && (
            <Stack spacing={2} mt={1}>
              {error && <Alert severity="error">{error}</Alert>}
              <TextField label={t('d.fullName')} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
              <Stack direction="row" spacing={2}>
                <TextField label={t('c.phone')} value={edit.phone ?? ''} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} sx={{ flex: 1 }} />
                <TextField label={t('c.zone')} value={edit.zone ?? ''} onChange={(e) => setEdit({ ...edit, zone: e.target.value })} sx={{ flex: 1 }} />
              </Stack>
              <Stack direction="row" spacing={2}>
                <TextField select label={t('c.position')} value={edit.position ?? 'sales'} onChange={(e) => setEdit({ ...edit, position: e.target.value })} sx={{ flex: 1 }}>
                  <MenuItem value="sales">Sales</MenuItem>
                  <MenuItem value="closer">Closer</MenuItem>
                </TextField>
                <TextField select label={t('c.team')} value={edit.teamId ?? ''} onChange={(e) => setEdit({ ...edit, teamId: e.target.value })} sx={{ flex: 1 }}>
                  <MenuItem value="">{t('emp.noTeam')}</MenuItem>
                  {teams.map((tm) => <MenuItem key={tm.id} value={tm.id}>{tm.name}</MenuItem>)}
                </TextField>
              </Stack>
              <TextField label="LINE User ID" value={edit.lineUserId ?? ''} onChange={(e) => setEdit({ ...edit, lineUserId: e.target.value })} placeholder="Uxxxxxxxx..." />
              <Stack direction="row" spacing={2}>
                <FormControlLabel control={<Checkbox checked={!!edit.inTraining} onChange={(e) => setEdit({ ...edit, inTraining: e.target.checked })} />} label={t('emp.training2')} />
                <FormControlLabel control={<Checkbox checked={edit.isActive} onChange={(e) => setEdit({ ...edit, isActive: e.target.checked })} />} label={t('emp.activeUse')} />
              </Stack>
              {edit.user && <Typography variant="caption" color="text.secondary">{t('emp.loginAcct')}: {edit.user.email}</Typography>}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEdit(null)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={saveEdit}>{t('common.save')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
