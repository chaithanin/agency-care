import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, FormControl, FormControlLabel, IconButton,
  InputLabel, LinearProgress, MenuItem, Paper, Select, Stack, Switch, Tab, Table,
  TableBody, TableCell, TableHead, TableRow, Tabs, TextField, Tooltip, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import RepeatIcon from '@mui/icons-material/Repeat';
import { api, errMsg } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useT } from '../i18n';

interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'done' | 'overdue';
  type: 'manual' | 'auto' | 'ai';
  tag?: string | null;
  customerName?: string | null;
  isRecurring?: boolean;
  assignedTo: { id: string; name: string; code: string };
  agency?: { id: string; name: string } | null;
}

interface FollowUp {
  id: string; title: string; detail?: string | null;
  dueDate?: string | null; status: string;
  agencyName?: string | null; assigneeName?: string | null;
}

interface Opt { id: string; code: string; name: string; }
interface Summary { pending: number; inProgress: number; done: number; overdue: number; total: number }

const priorityColor = (p: string) => p === 'high' ? 'error' : p === 'medium' ? 'warning' : 'default';
const statusColor = (s: string) => s === 'done' ? 'success' : s === 'overdue' ? 'error' : s === 'in_progress' ? 'info' : 'default';
const typeIcon = (tp: string) => tp === 'ai' ? <SmartToyIcon fontSize="small" /> : tp === 'auto' ? <AutoAwesomeIcon fontSize="small" /> : <PersonIcon fontSize="small" />;

const TASK_TAGS = ['call', 'visit', 'orientation', 'customer', 'followup', 'delivery', 'event', 'other'];

export default function TasksPage() {
  const { user } = useAuth();
  const { t } = useT();
  const isAdmin = ['manager', 'super_admin', 'admin'].includes(user?.activeRole ?? '');
  const isCloser = user?.activeRole === 'closer';
  const isManager = isAdmin || isCloser;

  const [tab, setTab] = useState(0);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [employees, setEmployees] = useState<Opt[]>([]);
  const [msg, setMsg] = useState('');

  // ─── Filters ─────────────────────────────────────────────────────────────
  const [filterStatus, setFilterStatus] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterAgency, setFilterAgency] = useState('');

  // ─── Create dialog ────────────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', dueDate: '', priority: 'medium',
    tag: '', customerName: '', agencyId: '', assignedToId: '',
    isRecurring: false, recurringFreq: 'weekly', recurringUntil: '',
  });
  const [createError, setCreateError] = useState('');

  // ─── Edit dialog ──────────────────────────────────────────────────────────
  const [editOpen, setEditOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', dueDate: '', priority: 'medium', tag: '', customerName: '', assignedToId: '' });
  const [editError, setEditError] = useState('');

  const [aiLoading, setAiLoading] = useState(false);
  const [followups, setFollowups] = useState<FollowUp[]>([]);
  const [followupMsg, setFollowupMsg] = useState('');

  const load = useCallback(async () => {
    const params: Record<string, string> = {};
    if (filterStatus) params.status = filterStatus;
    if (filterEmployee) params.assignedToId = filterEmployee;
    if (filterTag) params.tag = filterTag;
    if (filterCustomer) params.customerName = filterCustomer;
    if (filterFrom) params.from = filterFrom;
    if (filterTo) params.to = filterTo;
    const [tk, s] = await Promise.all([
      api.get('/tasks', { params }),
      api.get('/tasks/summary'),
    ]);
    setTasks(tk.data);
    setSummary(s.data);
  }, [filterStatus, filterEmployee, filterTag, filterCustomer, filterFrom, filterTo]);

  const loadFollowups = async () => {
    try { const res = await api.get('/followups'); setFollowups(res.data); }
    catch (e) { setFollowupMsg(errMsg(e)); }
  };

  useEffect(() => {
    load();
    if (isManager) api.get('/employees').then((r) => setEmployees(r.data));
  }, [load, isManager]);

  useEffect(() => { if (tab === 1) loadFollowups(); }, [tab]);

  // Client-side agency filter (for quick text search without extra API)
  const filtered = tasks.filter((tk) => {
    if (filterAgency && !tk.agency?.name.toLowerCase().includes(filterAgency.toLowerCase())) return false;
    return true;
  });

  const create = async () => {
    setCreateError('');
    try {
      await api.post('/tasks', {
        title: form.title,
        description: form.description || undefined,
        dueDate: form.dueDate || undefined,
        priority: form.priority,
        tag: form.tag || undefined,
        customerName: form.customerName || undefined,
        agencyId: form.agencyId || undefined,
        assignedToId: form.assignedToId || undefined,
        isRecurring: form.isRecurring,
        recurringFreq: form.isRecurring ? form.recurringFreq : undefined,
        recurringUntil: form.isRecurring ? form.recurringUntil : undefined,
      });
      setCreateOpen(false);
      setForm({ title: '', description: '', dueDate: '', priority: 'medium', tag: '', customerName: '', agencyId: '', assignedToId: '', isRecurring: false, recurringFreq: 'weekly', recurringUntil: '' });
      load();
    } catch (e) { setCreateError(errMsg(e)); }
  };

  const openEdit = (tk: Task) => {
    setEditTask(tk);
    setEditForm({
      title: tk.title, description: tk.description ?? '',
      dueDate: tk.dueDate ? tk.dueDate.slice(0, 10) : '',
      priority: tk.priority, tag: tk.tag ?? '', customerName: tk.customerName ?? '',
      assignedToId: tk.assignedTo?.id ?? '',
    });
    setEditError(''); setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editTask) return;
    setEditError('');
    try {
      await api.patch(`/tasks/${editTask.id}`, {
        title: editForm.title, description: editForm.description || undefined,
        dueDate: editForm.dueDate || undefined, priority: editForm.priority,
        tag: editForm.tag || undefined, customerName: editForm.customerName || undefined,
        assignedToId: editForm.assignedToId || undefined,
      });
      setEditOpen(false); setEditTask(null); load();
    } catch (e) { setEditError(errMsg(e)); }
  };

  const setStatus = async (id: string, status: string) => {
    try { await api.patch(`/tasks/${id}`, { status }); load(); }
    catch (e) { setMsg(errMsg(e)); }
  };

  const remove = async (id: string) => {
    try { await api.delete(`/tasks/${id}`); load(); }
    catch (e) { setMsg(errMsg(e)); }
  };

  const generateAiTasks = async () => {
    setAiLoading(true); setMsg('');
    try {
      const res = await api.post('/tasks/ai-generate');
      setMsg(`Generated ${res.data?.created ?? 0} AI tasks`);
      load();
    } catch (e) { setMsg(errMsg(e)); } finally { setAiLoading(false); }
  };

  const markFollowupDone = async (id: string) => {
    try { await api.patch(`/followups/${id}/done`); loadFollowups(); }
    catch (e) { setFollowupMsg(errMsg(e)); }
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={700}>{t('tk.title')}</Typography>
        <Stack direction="row" spacing={1}>
          {isManager && (
            <Button variant="outlined"
              startIcon={aiLoading ? <CircularProgress size={16} /> : <SmartToyIcon />}
              onClick={generateAiTasks} disabled={aiLoading}>
              {t('tk.generateAi')}
            </Button>
          )}
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setCreateError(''); setCreateOpen(true); }}>
            {t('tk.add')}
          </Button>
        </Stack>
      </Stack>

      {msg && <Alert severity={msg.startsWith('Generated') ? 'success' : 'error'} sx={{ mb: 2 }} onClose={() => setMsg('')}>{msg}</Alert>}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={t('tk.tabTasks')} />
        <Tab label={t('tk.tabFollowups')} />
      </Tabs>

      {/* ===== Tasks Tab ===== */}
      {tab === 0 && (
        <>
          {/* Summary cards */}
          {summary && (
            <Stack direction="row" spacing={2} mb={2} flexWrap="wrap" useFlexGap>
              {[
                { label: t('tk.pending'), value: summary.pending, color: '#6366f1', key: 'pending' },
                { label: t('tk.in_progress'), value: summary.inProgress, color: '#0ea5e9', key: 'in_progress' },
                { label: t('tk.done'), value: summary.done, color: '#22c55e', key: 'done' },
                { label: t('tk.overdue'), value: summary.overdue, color: '#ef4444', key: 'overdue' },
              ].map((c) => (
                <Paper key={c.key} sx={{ p: 2, minWidth: 110, flex: '1 1 110px', cursor: 'pointer', borderTop: `3px solid ${c.color}` }}
                  onClick={() => setFilterStatus((f) => (f === c.key ? '' : c.key))}>
                  <Typography variant="h4" fontWeight={700} color={c.color}>{c.value}</Typography>
                  <Typography variant="caption" color="text.secondary">{c.label}</Typography>
                </Paper>
              ))}
            </Stack>
          )}

          {/* Search filters */}
          <Paper sx={{ p: 2, mb: 2 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} flexWrap="wrap">
              <TextField size="small" label={t('tk.searchAgency')} value={filterAgency}
                onChange={(e) => setFilterAgency(e.target.value)}
                InputProps={{ startAdornment: <SearchIcon sx={{ mr: 0.5, color: 'text.disabled', fontSize: 18 }} /> }}
                sx={{ minWidth: 160 }} />
              <TextField size="small" label={t('tk.searchCustomer')} value={filterCustomer}
                onChange={(e) => setFilterCustomer(e.target.value)} sx={{ minWidth: 160 }} />
              {isManager && (
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>{t('c.seller')}</InputLabel>
                  <Select value={filterEmployee} label={t('c.seller')} onChange={(e) => setFilterEmployee(e.target.value)}>
                    <MenuItem value="">{t('pl.allSellers')}</MenuItem>
                    {employees.map((e) => <MenuItem key={e.id} value={e.id}>{e.name}</MenuItem>)}
                  </Select>
                </FormControl>
              )}
              <FormControl size="small" sx={{ minWidth: 130 }}>
                <InputLabel>{t('task.tag')}</InputLabel>
                <Select value={filterTag} label={t('task.tag')} onChange={(e) => setFilterTag(e.target.value)}>
                  <MenuItem value="">{t('c.all')}</MenuItem>
                  {TASK_TAGS.map((tg) => <MenuItem key={tg} value={tg}>{tg}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField size="small" type="date" label={t('pl.dateFrom')} value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
              <TextField size="small" type="date" label={t('pl.dateTo')} value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)} InputLabelProps={{ shrink: true }} />
              {(filterAgency || filterCustomer || filterEmployee || filterTag || filterFrom || filterTo || filterStatus) && (
                <Button size="small" onClick={() => {
                  setFilterAgency(''); setFilterCustomer(''); setFilterEmployee('');
                  setFilterTag(''); setFilterFrom(''); setFilterTo(''); setFilterStatus('');
                }}>
                  {t('task.clearFilters')}
                </Button>
              )}
            </Stack>
          </Paper>

          {/* Task list */}
          <Stack spacing={1.5}>
            {filtered.length === 0 && (
              <Paper sx={{ p: 4, textAlign: 'center' }}>
                <Typography color="text.secondary">{t('tk.noTask')}</Typography>
              </Paper>
            )}
            {filtered.map((tk) => (
              <Paper key={tk.id} sx={{ p: 2, opacity: tk.status === 'done' ? 0.6 : 1 }}>
                <Stack direction="row" alignItems="flex-start" spacing={1.5}>
                  <Box sx={{ color: 'text.secondary', mt: 0.3 }}>{typeIcon(tk.type)}</Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                      <Typography fontWeight={600} sx={{ textDecoration: tk.status === 'done' ? 'line-through' : 'none' }}>
                        {tk.title}
                      </Typography>
                      {tk.isRecurring && <Tooltip title={t('task.recurring')}><RepeatIcon fontSize="small" color="action" /></Tooltip>}
                      <Chip size="small" label={t(`tk.${tk.priority}`)} color={priorityColor(tk.priority) as any} />
                      <Chip size="small" label={t(`tk.${tk.status}`)} color={statusColor(tk.status) as any} variant="outlined" />
                      <Chip size="small" label={t(`tk.${tk.type}`)} variant="outlined" />
                      {tk.tag && <Chip size="small" label={tk.tag} variant="outlined" color="info" />}
                    </Stack>
                    {tk.description && <Typography variant="body2" color="text.secondary" mt={0.5}>{tk.description}</Typography>}
                    <Stack direction="row" spacing={2} mt={0.5} flexWrap="wrap">
                      <Typography variant="caption" color="text.secondary">{t('tk.assignTo')}: {tk.assignedTo.name}</Typography>
                      {tk.agency && <Typography variant="caption" color="text.secondary">🏪 {tk.agency.name}</Typography>}
                      {tk.customerName && <Typography variant="caption" color="text.secondary">👤 {tk.customerName}</Typography>}
                      {tk.dueDate && (
                        <Typography variant="caption" color={tk.status === 'overdue' ? 'error' : 'text.secondary'}>
                          📅 {tk.dueDate.slice(0, 10)}
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                  <Stack direction="row" spacing={0.5}>
                    <Tooltip title={t('tk.editTooltip')}>
                      <IconButton size="small" onClick={() => openEdit(tk)}><EditIcon fontSize="small" /></IconButton>
                    </Tooltip>
                    {tk.status === 'pending' && (
                      <Tooltip title={t('tk.in_progress')}>
                        <IconButton size="small" onClick={() => setStatus(tk.id, 'in_progress')}><PlayArrowIcon fontSize="small" /></IconButton>
                      </Tooltip>
                    )}
                    {tk.status !== 'done' && (
                      <Tooltip title={t('tk.done')}>
                        <IconButton size="small" color="success" onClick={() => setStatus(tk.id, 'done')}><CheckCircleOutlineIcon fontSize="small" /></IconButton>
                      </Tooltip>
                    )}
                    {(tk.type === 'manual' || isAdmin) && (
                      <Tooltip title={t('tk.delete')}>
                        <IconButton size="small" color="error" onClick={() => remove(tk.id)}><DeleteOutlineIcon fontSize="small" /></IconButton>
                      </Tooltip>
                    )}
                  </Stack>
                </Stack>
                {tk.status === 'in_progress' && <LinearProgress sx={{ mt: 1, borderRadius: 4, height: 4 }} />}
              </Paper>
            ))}
          </Stack>
        </>
      )}

      {/* ===== Follow-ups Tab ===== */}
      {tab === 1 && (
        <>
          {followupMsg && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setFollowupMsg('')}>{followupMsg}</Alert>}
          <Paper>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('tk.followupDueDate')}</TableCell>
                  <TableCell>{t('tk.followupTitle')}</TableCell>
                  <TableCell>{t('tk.followupAgency')}</TableCell>
                  <TableCell>{t('tk.followupAssignee')}</TableCell>
                  <TableCell>{t('tk.followupStatus')}</TableCell>
                  <TableCell align="right">{t('tk.followupAction')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {followups.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography color="text.secondary" py={2}>{t('tk.noFollowup')}</Typography>
                    </TableCell>
                  </TableRow>
                )}
                {followups.map((fu) => (
                  <TableRow key={fu.id} sx={{ opacity: fu.status === 'done' ? 0.5 : 1 }}>
                    <TableCell>{fu.dueDate ? fu.dueDate.slice(0, 10) : '—'}</TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600} sx={{ textDecoration: fu.status === 'done' ? 'line-through' : 'none' }}>
                        {fu.title}
                      </Typography>
                      {fu.detail && <Typography variant="caption" color="text.secondary">{fu.detail}</Typography>}
                    </TableCell>
                    <TableCell>{fu.agencyName ?? '—'}</TableCell>
                    <TableCell>{fu.assigneeName ?? '—'}</TableCell>
                    <TableCell>
                      <Chip size="small" label={fu.status} color={fu.status === 'done' ? 'success' : 'default'} variant="outlined" />
                    </TableCell>
                    <TableCell align="right">
                      {fu.status !== 'done' && (
                        <Tooltip title={t('tk.markDone')}>
                          <IconButton size="small" color="success" onClick={() => markFollowupDone(fu.id)}>
                            <CheckCircleOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </>
      )}

      {/* ─── Create dialog ─── */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('tk.addTitle')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            {createError && <Alert severity="error">{createError}</Alert>}
            <TextField label={t('tk.taskName')} value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })} required autoFocus size="small" />
            <TextField label={t('tk.desc')} value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} multiline rows={2} size="small" />
            <Stack direction="row" spacing={2}>
              <TextField label={t('tk.due')} type="date" value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                InputLabelProps={{ shrink: true }} size="small" fullWidth />
              <TextField select label={t('tk.priority')} value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })} size="small" fullWidth>
                <MenuItem value="high">{t('tk.high')}</MenuItem>
                <MenuItem value="medium">{t('tk.medium')}</MenuItem>
                <MenuItem value="low">{t('tk.low')}</MenuItem>
              </TextField>
            </Stack>
            <Stack direction="row" spacing={2}>
              <FormControl size="small" fullWidth>
                <InputLabel>{t('task.tag')}</InputLabel>
                <Select value={form.tag} label={t('task.tag')}
                  onChange={(e) => setForm({ ...form, tag: e.target.value })}>
                  <MenuItem value="">{t('c.none')}</MenuItem>
                  {TASK_TAGS.map((tg) => <MenuItem key={tg} value={tg}>{tg}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField size="small" label={t('task.customerName')} value={form.customerName}
                onChange={(e) => setForm({ ...form, customerName: e.target.value })} fullWidth />
            </Stack>

            {isManager && employees.length > 0 && (
              <FormControl size="small" fullWidth>
                <InputLabel>Assign to</InputLabel>
                <Select value={form.assignedToId} label="Assign to"
                  onChange={(e) => setForm({ ...form, assignedToId: e.target.value })}>
                  <MenuItem value="">— ไม่ระบุ (ตัวเอง) —</MenuItem>
                  {employees.map((e) => <MenuItem key={e.id} value={e.id}>{e.name} ({e.code})</MenuItem>)}
                </Select>
              </FormControl>
            )}

            <Divider />
            <FormControlLabel
              control={<Switch checked={form.isRecurring} onChange={(e) => setForm({ ...form, isRecurring: e.target.checked })} />}
              label={<Stack direction="row" spacing={0.5} alignItems="center"><RepeatIcon fontSize="small" /><span>{t('task.recurring')}</span></Stack>}
            />
            {form.isRecurring && (
              <Stack direction="row" spacing={2}>
                <TextField select label={t('task.recurringFreq')} value={form.recurringFreq}
                  onChange={(e) => setForm({ ...form, recurringFreq: e.target.value })} size="small" fullWidth>
                  <MenuItem value="daily">{t('task.recurringDaily')}</MenuItem>
                  <MenuItem value="weekly">{t('task.recurringWeekly')}</MenuItem>
                </TextField>
                <TextField type="date" label={t('task.recurringUntil')} value={form.recurringUntil}
                  onChange={(e) => setForm({ ...form, recurringUntil: e.target.value })}
                  InputLabelProps={{ shrink: true }} size="small" fullWidth />
              </Stack>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={create} disabled={!form.title}>{t('common.save')}</Button>
        </DialogActions>
      </Dialog>

      {/* ─── Edit dialog ─── */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('tk.editTitle')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            {editError && <Alert severity="error">{editError}</Alert>}
            <TextField label={t('tk.taskName')} value={editForm.title}
              onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} required autoFocus size="small" />
            <TextField label={t('tk.desc')} value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} multiline rows={2} size="small" />
            <Stack direction="row" spacing={2}>
              <TextField label={t('tk.due')} type="date" value={editForm.dueDate}
                onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
                InputLabelProps={{ shrink: true }} size="small" fullWidth />
              <TextField select label={t('tk.priority')} value={editForm.priority}
                onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })} size="small" fullWidth>
                <MenuItem value="high">{t('tk.high')}</MenuItem>
                <MenuItem value="medium">{t('tk.medium')}</MenuItem>
                <MenuItem value="low">{t('tk.low')}</MenuItem>
              </TextField>
            </Stack>
            <Stack direction="row" spacing={2}>
              <FormControl size="small" fullWidth>
                <InputLabel>{t('task.tag')}</InputLabel>
                <Select value={editForm.tag} label={t('task.tag')}
                  onChange={(e) => setEditForm({ ...editForm, tag: e.target.value })}>
                  <MenuItem value="">{t('c.none')}</MenuItem>
                  {TASK_TAGS.map((tg) => <MenuItem key={tg} value={tg}>{tg}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField size="small" label={t('task.customerName')} value={editForm.customerName}
                onChange={(e) => setEditForm({ ...editForm, customerName: e.target.value })} fullWidth />
            </Stack>
            {isManager && employees.length > 0 && (
              <FormControl size="small" fullWidth>
                <InputLabel>Assign to</InputLabel>
                <Select value={editForm.assignedToId} label="Assign to"
                  onChange={(e) => setEditForm({ ...editForm, assignedToId: e.target.value })}>
                  <MenuItem value="">— ไม่เปลี่ยน —</MenuItem>
                  {employees.map((e) => <MenuItem key={e.id} value={e.id}>{e.name} ({e.code})</MenuItem>)}
                </Select>
              </FormControl>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={saveEdit} disabled={!editForm.title}>{t('common.save')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
