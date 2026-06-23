import { useEffect, useState } from 'react';
import {
  Box, Button, Typography, Paper, Stack, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, Alert, IconButton,
  Tooltip, LinearProgress, Tabs, Tab, Table, TableHead, TableRow,
  TableCell, TableBody, CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';
import EditIcon from '@mui/icons-material/Edit';
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
  assignedTo: { id: string; name: string; code: string };
  agency?: { id: string; name: string } | null;
}

interface FollowUp {
  id: string;
  title: string;
  detail?: string | null;
  dueDate?: string | null;
  status: string;
  agencyName?: string | null;
  assigneeName?: string | null;
}

interface Summary { pending: number; inProgress: number; done: number; overdue: number; total: number }

const priorityColor = (p: string) => p === 'high' ? 'error' : p === 'medium' ? 'warning' : 'default';
const statusColor   = (s: string) => s === 'done' ? 'success' : s === 'overdue' ? 'error' : s === 'in_progress' ? 'info' : 'default';
const typeIcon = (t: string) => t === 'ai' ? <SmartToyIcon fontSize="small" /> : t === 'auto' ? <AutoAwesomeIcon fontSize="small" /> : <PersonIcon fontSize="small" />;

export default function TasksPage() {
  const { user } = useAuth();
  const { t } = useT();

  // Main tab state
  const [tab, setTab] = useState(0);

  // Tasks state
  const [tasks, setTasks]     = useState<Task[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [filter, setFilter]   = useState('');
  const [msg, setMsg]         = useState('');

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm]       = useState({ title: '', description: '', dueDate: '', priority: 'medium' });
  const [createError, setCreateError] = useState('');

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', dueDate: '', priority: 'medium' });
  const [editError, setEditError] = useState('');

  // AI generate
  const [aiLoading, setAiLoading] = useState(false);

  // Follow-ups state
  const [followups, setFollowups] = useState<FollowUp[]>([]);
  const [followupMsg, setFollowupMsg] = useState('');

  const load = async () => {
    const [tk, s] = await Promise.all([api.get('/tasks'), api.get('/tasks/summary')]);
    setTasks(tk.data);
    setSummary(s.data);
  };

  const loadFollowups = async () => {
    try {
      const res = await api.get('/followups');
      setFollowups(res.data);
    } catch (e) {
      setFollowupMsg(errMsg(e));
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { if (tab === 1) loadFollowups(); }, [tab]);

  const filtered = filter ? tasks.filter(tk => tk.status === filter) : tasks;

  // Create task
  const create = async () => {
    setCreateError('');
    try {
      await api.post('/tasks', { ...form, dueDate: form.dueDate || undefined });
      setCreateOpen(false);
      setForm({ title: '', description: '', dueDate: '', priority: 'medium' });
      load();
    } catch (e) { setCreateError(errMsg(e)); }
  };

  // Open edit dialog
  const openEdit = (tk: Task) => {
    setEditTask(tk);
    setEditForm({
      title: tk.title,
      description: tk.description ?? '',
      dueDate: tk.dueDate ? tk.dueDate.slice(0, 10) : '',
      priority: tk.priority,
    });
    setEditError('');
    setEditOpen(true);
  };

  // Save edit
  const saveEdit = async () => {
    if (!editTask) return;
    setEditError('');
    try {
      await api.patch(`/tasks/${editTask.id}`, {
        title: editForm.title,
        description: editForm.description || undefined,
        dueDate: editForm.dueDate || undefined,
        priority: editForm.priority,
      });
      setEditOpen(false);
      setEditTask(null);
      load();
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

  // AI generate tasks
  const generateAiTasks = async () => {
    setAiLoading(true);
    setMsg('');
    try {
      const res = await api.post('/tasks/ai-generate');
      setMsg(`Generated ${res.data?.created ?? 0} AI tasks`);
      load();
    } catch (e) {
      setMsg(errMsg(e));
    } finally {
      setAiLoading(false);
    }
  };

  // Mark followup done
  const markFollowupDone = async (id: string) => {
    try {
      await api.patch(`/followups/${id}/done`);
      loadFollowups();
    } catch (e) {
      setFollowupMsg(errMsg(e));
    }
  };

  const isAdmin = user?.role === 'admin';
  const isCloser = user?.role === 'closer';

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={700}>{t('tk.title')}</Typography>
        <Stack direction="row" spacing={1}>
          {(isAdmin || isCloser) && (
            <Button
              variant="outlined"
              startIcon={aiLoading ? <CircularProgress size={16} /> : <SmartToyIcon />}
              onClick={generateAiTasks}
              disabled={aiLoading}
            >
              {t('tk.generateAi')}
            </Button>
          )}
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setCreateError(''); setCreateOpen(true); }}>
            {t('tk.add')}
          </Button>
        </Stack>
      </Stack>

      {msg && <Alert severity={msg.startsWith('Generated') ? 'success' : 'error'} sx={{ mb: 2 }} onClose={() => setMsg('')}>{msg}</Alert>}

      {/* Tabs */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={t('tk.tabTasks')} />
        <Tab label={t('tk.tabFollowups')} />
      </Tabs>

      {/* ===== Tasks Tab ===== */}
      {tab === 0 && (
        <>
          {/* Summary cards */}
          {summary && (
            <Stack direction="row" spacing={2} mb={3} flexWrap="wrap" useFlexGap>
              {[
                { label: t('tk.pending'),     value: summary.pending,    color: '#6366f1', key: 'pending' },
                { label: t('tk.in_progress'), value: summary.inProgress, color: '#0ea5e9', key: 'in_progress' },
                { label: t('tk.done'),        value: summary.done,       color: '#22c55e', key: 'done' },
                { label: t('tk.overdue'),     value: summary.overdue,    color: '#ef4444', key: 'overdue' },
              ].map(c => (
                <Paper key={c.key} sx={{ p: 2, minWidth: 120, flex: '1 1 120px', cursor: 'pointer', borderTop: `3px solid ${c.color}` }}
                  onClick={() => setFilter(f => f === c.key ? '' : c.key)}
                >
                  <Typography variant="h4" fontWeight={700} color={c.color}>{c.value}</Typography>
                  <Typography variant="caption" color="text.secondary">{c.label}</Typography>
                </Paper>
              ))}
            </Stack>
          )}

          {/* Filter chips */}
          <Stack direction="row" spacing={1} mb={2} flexWrap="wrap">
            {(['', 'pending', 'in_progress', 'done', 'overdue'] as const).map(f => (
              <Chip key={f} label={f === '' ? t('c.all') : t(`tk.${f}`)} variant={filter === f ? 'filled' : 'outlined'} color={filter === f ? 'primary' : 'default'} onClick={() => setFilter(f)} size="small" />
            ))}
          </Stack>

          {/* Task list */}
          <Stack spacing={1.5}>
            {filtered.length === 0 && (
              <Paper sx={{ p: 4, textAlign: 'center' }}>
                <Typography color="text.secondary">{t('tk.noTask')}</Typography>
              </Paper>
            )}
            {filtered.map(tk => (
              <Paper key={tk.id} sx={{ p: 2, opacity: tk.status === 'done' ? 0.6 : 1 }}>
                <Stack direction="row" alignItems="flex-start" spacing={1.5}>
                  <Box sx={{ color: 'text.secondary', mt: 0.3 }}>{typeIcon(tk.type)}</Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                      <Typography fontWeight={600} sx={{ textDecoration: tk.status === 'done' ? 'line-through' : 'none' }}>
                        {tk.title}
                      </Typography>
                      <Chip size="small" label={t(`tk.${tk.priority}`)} color={priorityColor(tk.priority)} />
                      <Chip size="small" label={t(`tk.${tk.status}`)} color={statusColor(tk.status)} variant="outlined" />
                      <Chip size="small" label={t(`tk.${tk.type}`)} variant="outlined" />
                    </Stack>
                    {tk.description && <Typography variant="body2" color="text.secondary" mt={0.5}>{tk.description}</Typography>}
                    <Stack direction="row" spacing={2} mt={0.5} flexWrap="wrap">
                      <Typography variant="caption" color="text.secondary">{t('tk.assignTo')}: {tk.assignedTo.name}</Typography>
                      {tk.agency && <Typography variant="caption" color="text.secondary">🏪 {tk.agency.name}</Typography>}
                      {tk.dueDate && <Typography variant="caption" color={tk.status === 'overdue' ? 'error' : 'text.secondary'}>📅 {tk.dueDate.slice(0, 10)}</Typography>}
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
                    {(tk.type === 'manual' || isAdmin || isCloser) && (
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
                {followups.map(fu => (
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

      {/* Create dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('tk.addTitle')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            {createError && <Alert severity="error">{createError}</Alert>}
            <TextField label={t('tk.taskName')} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required autoFocus />
            <TextField label={t('tk.desc')} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} multiline rows={2} />
            <TextField label={t('tk.due')} type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} InputLabelProps={{ shrink: true }} />
            <TextField select label={t('tk.priority')} value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
              <MenuItem value="high">{t('tk.high')}</MenuItem>
              <MenuItem value="medium">{t('tk.medium')}</MenuItem>
              <MenuItem value="low">{t('tk.low')}</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={create} disabled={!form.title}>{t('common.save')}</Button>
        </DialogActions>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('tk.editTitle')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            {editError && <Alert severity="error">{editError}</Alert>}
            <TextField
              label={t('tk.taskName')}
              value={editForm.title}
              onChange={e => setEditForm({ ...editForm, title: e.target.value })}
              required
              autoFocus
            />
            <TextField
              label={t('tk.desc')}
              value={editForm.description}
              onChange={e => setEditForm({ ...editForm, description: e.target.value })}
              multiline
              rows={2}
            />
            <TextField
              label={t('tk.due')}
              type="date"
              value={editForm.dueDate}
              onChange={e => setEditForm({ ...editForm, dueDate: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              select
              label={t('tk.priority')}
              value={editForm.priority}
              onChange={e => setEditForm({ ...editForm, priority: e.target.value })}
            >
              <MenuItem value="high">{t('tk.high')}</MenuItem>
              <MenuItem value="medium">{t('tk.medium')}</MenuItem>
              <MenuItem value="low">{t('tk.low')}</MenuItem>
            </TextField>
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
