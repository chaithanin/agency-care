import { useCallback, useEffect, useMemo, useState } from 'react';
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
  FormControl,
  FormControlLabel,
  InputLabel,
  Select,
  Checkbox,
  Divider,
  IconButton,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
  LinearProgress,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import LinkIcon from '@mui/icons-material/Link';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { api, errMsg } from '../api/client';
import { useT } from '../i18n';

interface UserOption {
  id: string;
  email: string;
  name: string;
  role: string;
  employee: { id: string; code: string; name: string } | null;
}

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

type LinkMode = 'none' | 'existing' | 'new';
const emptyCreate = {
  code: '', name: '', phone: '', zone: '', lineUserId: '',
  email: '', password: '',
  linkMode: 'none' as LinkMode,
  userId: '',
};
const thisYM = () => new Date().toISOString().slice(0, 7);

const DOW_TH = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
const DOW_EN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function EmployeesPage() {
  const { t, lang } = useT();
  const [rows, setRows] = useState<Employee[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyCreate });
  const [edit, setEdit] = useState<Employee | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editLinkUserId, setEditLinkUserId] = useState('');
  const [error, setError] = useState('');
  const [notifyMsg, setNotifyMsg] = useState('');
  const [notifying, setNotifying] = useState(false);

  // ── Leave management ──────────────────────────────────────────────────────
  const [leaveEmp, setLeaveEmp] = useState<Employee | null>(null);
  const [leaveMonth, setLeaveMonth] = useState(thisYM());
  const [leaveDates, setLeaveDates] = useState<Set<string>>(new Set());
  const [leaveLoading, setLeaveLoading] = useState(false);

  const loadLeaves = useCallback(async (emp: Employee, ym: string) => {
    const [y, m] = ym.split('-').map(Number);
    setLeaveLoading(true);
    try {
      const r = await api.get('/scheduling/holidays', { params: { employeeId: emp.id, year: y, month: m } });
      setLeaveDates(new Set(r.data as string[]));
    } finally { setLeaveLoading(false); }
  }, []);

  useEffect(() => {
    if (leaveEmp) loadLeaves(leaveEmp, leaveMonth);
  }, [leaveEmp, leaveMonth, loadLeaves]);

  const toggleLeave = async (ds: string) => {
    if (!leaveEmp) return;
    await api.post('/scheduling/holidays/toggle', { employeeId: leaveEmp.id, date: ds });
    loadLeaves(leaveEmp, leaveMonth);
  };

  const openLeave = (emp: Employee) => {
    setLeaveMonth(thisYM());
    setLeaveEmp(emp);
  };

  // build calendar cells for the leave dialog
  const leaveCells = useMemo(() => {
    const [y, m] = leaveMonth.split('-').map(Number);
    const dim = new Date(y, m, 0).getDate();
    const lead = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
    const cells: (string | null)[] = Array(lead).fill(null);
    for (let d = 1; d <= dim; d++) {
      cells.push(`${leaveMonth}-${String(d).padStart(2, '0')}`);
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [leaveMonth]);

  const prevMonth = () => {
    const [y, m] = leaveMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    setLeaveMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  const nextMonth = () => {
    const [y, m] = leaveMonth.split('-').map(Number);
    const d = new Date(y, m, 1);
    setLeaveMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  // ──────────────────────────────────────────────────────────────────────────

  const load = () => api.get('/employees').then((r) => setRows(r.data));
  const loadUsers = () => api.get('/users').then((r) => setUsers(r.data)).catch(() => {});
  useEffect(() => {
    load();
    loadUsers();
    api.get('/scheduling/teams').then((r) => setTeams(r.data)).catch(() => {});
  }, []);

  const runNotify = async () => {
    setNotifying(true);
    setNotifyMsg('');
    try {
      const { data } = await api.post('/notifications/run', {});
      const sent = data.results.filter((r: { sent: boolean }) => r.sent).length;
      setNotifyMsg(`${t('emp.notifyOk')} ${sent}/${data.totalEmployees} ${t('emp.notifyPeopleSuffix')} ${data.date})`);
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
        ...(form.linkMode === 'existing' && form.userId
          ? { userId: form.userId }
          : form.linkMode === 'new'
          ? { email: form.email || undefined, password: form.password || undefined }
          : {}),
      });
      setCreateOpen(false);
      setForm({ ...emptyCreate });
      load();
      loadUsers();
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
        ...(edit.user && editEmail ? { email: editEmail } : {}),
        ...(!edit.user && editLinkUserId ? { userId: editLinkUserId } : {}),
      });
      setEdit(null);
      load();
      loadUsers();
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const DOW = lang === 'en' ? DOW_EN : DOW_TH;

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
              <TableCell align="center">{t('emp.dayOff')}</TableCell>
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
                  <Tooltip title={t('emp.manageLeave')}>
                    <IconButton size="small" color="error" onClick={() => openLeave(e)}>
                      <EventBusyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
                <TableCell align="center">
                  <IconButton size="small" onClick={() => { setError(''); setEditEmail(e.user?.email ?? ''); setEditLinkUserId(''); setEdit({ ...e }); }}><EditIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      {/* ---- วันหยุดพนักงาน ---- */}
      <Dialog open={!!leaveEmp} onClose={() => setLeaveEmp(null)} fullWidth maxWidth="sm">
        <DialogTitle>
          {t('emp.manageLeave')} — {leaveEmp?.name}
        </DialogTitle>
        <DialogContent>
          {leaveLoading && <LinearProgress sx={{ mb: 1 }} />}
          <Stack direction="row" alignItems="center" justifyContent="center" spacing={1} mb={1.5}>
            <IconButton size="small" onClick={prevMonth}><ChevronLeftIcon /></IconButton>
            <Typography fontWeight={600}>{leaveMonth}</Typography>
            <IconButton size="small" onClick={nextMonth}><ChevronRightIcon /></IconButton>
          </Stack>

          {/* Day headers */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 0.5, mb: 0.5 }}>
            {DOW.map((d) => (
              <Typography key={d} variant="caption" fontWeight={700} textAlign="center" color="text.secondary">{d}</Typography>
            ))}
          </Box>

          {/* Calendar cells */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 0.5 }}>
            {leaveCells.map((ds, i) => ds ? (
              <Box
                key={ds}
                onClick={() => toggleLeave(ds)}
                sx={{
                  height: 44, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', borderRadius: 1,
                  border: 1, borderColor: leaveDates.has(ds) ? 'error.main' : 'divider',
                  bgcolor: leaveDates.has(ds) ? 'error.50' : 'background.paper',
                  cursor: 'pointer',
                  '&:hover': { bgcolor: leaveDates.has(ds) ? 'error.100' : 'action.hover' },
                }}
              >
                <Typography variant="body2" fontWeight={leaveDates.has(ds) ? 700 : 400}>
                  {Number(ds.slice(8))}
                </Typography>
                {leaveDates.has(ds) && (
                  <Typography variant="caption" sx={{ fontSize: 9, color: 'error.main', lineHeight: 1 }}>
                    {t('cal.holiday')}
                  </Typography>
                )}
              </Box>
            ) : <Box key={i} />)}
          </Box>

          <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
            {t('emp.leaveHint')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLeaveEmp(null)}>{t('common.close')}</Button>
        </DialogActions>
      </Dialog>

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

            <Divider />
            <Typography variant="subtitle2" fontWeight={700}>บัญชี Login</Typography>
            <ToggleButtonGroup
              value={form.linkMode}
              exclusive
              size="small"
              onChange={(_, v) => { if (v) setForm({ ...form, linkMode: v as LinkMode, userId: '', email: '', password: '' }); }}
              fullWidth
            >
              <ToggleButton value="none">ไม่มีบัญชี</ToggleButton>
              <ToggleButton value="existing">
                <LinkIcon fontSize="small" sx={{ mr: 0.5 }} />
                เลือก User ที่มีอยู่
              </ToggleButton>
              <ToggleButton value="new">สร้างบัญชีใหม่</ToggleButton>
            </ToggleButtonGroup>

            {form.linkMode === 'existing' && (
              <FormControl size="small" fullWidth>
                <InputLabel>User (ยังไม่มี Staff Profile)</InputLabel>
                <Select
                  value={form.userId}
                  label="User (ยังไม่มี Staff Profile)"
                  onChange={(e) => setForm({ ...form, userId: e.target.value })}
                >
                  <MenuItem value=""><em>— เลือก User —</em></MenuItem>
                  {users.filter((u) => !u.employee).map((u) => (
                    <MenuItem key={u.id} value={u.id}>
                      {u.name} &lt;{u.email}&gt; [{u.role}]
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {form.linkMode === 'new' && (
              <>
                <TextField label={t('usr.email')} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} size="small" />
                <TextField label={t('d.password')} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} size="small" helperText={t('d.minChars')} />
              </>
            )}
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
              {edit.user ? (
                <TextField
                  label={t('emp.emailEdit')}
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                />
              ) : (
                <Box sx={{ p: 1.5, border: '1px dashed', borderColor: 'divider', borderRadius: 1 }}>
                  <Stack direction="row" alignItems="center" gap={1} mb={1}>
                    <LinkIcon fontSize="small" color="action" />
                    <Typography variant="subtitle2">เชื่อมกับ User ที่มีอยู่</Typography>
                  </Stack>
                  <FormControl size="small" fullWidth>
                    <InputLabel>เลือก User (ยังไม่มี Staff Profile)</InputLabel>
                    <Select
                      value={editLinkUserId}
                      label="เลือก User (ยังไม่มี Staff Profile)"
                      onChange={(e) => setEditLinkUserId(e.target.value)}
                    >
                      <MenuItem value=""><em>— ไม่เชื่อม —</em></MenuItem>
                      {users.filter((u) => !u.employee).map((u) => (
                        <MenuItem key={u.id} value={u.id}>
                          {u.name} &lt;{u.email}&gt; [{u.role}]
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
              )}
              <Stack direction="row" spacing={2}>
                <FormControlLabel control={<Checkbox checked={!!edit.inTraining} onChange={(e) => setEdit({ ...edit, inTraining: e.target.checked })} />} label={t('emp.training2')} />
                <FormControlLabel control={<Checkbox checked={edit.isActive} onChange={(e) => setEdit({ ...edit, isActive: e.target.checked })} />} label={t('emp.activeUse')} />
              </Stack>
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
