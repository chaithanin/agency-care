import { useEffect, useState } from 'react';
import {
  Box, Button, Typography, Paper, Stack, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, Alert, IconButton,
  Tooltip, LinearProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';
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

interface Summary { pending: number; inProgress: number; done: number; overdue: number; total: number }

const priorityColor = (p: string) => p === 'high' ? 'error' : p === 'medium' ? 'warning' : 'default';
const statusColor   = (s: string) => s === 'done' ? 'success' : s === 'overdue' ? 'error' : s === 'in_progress' ? 'info' : 'default';
const typeIcon = (t: string) => t === 'ai' ? <SmartToyIcon fontSize="small" /> : t === 'auto' ? <AutoAwesomeIcon fontSize="small" /> : <PersonIcon fontSize="small" />;

export default function TasksPage() {
  const { user } = useAuth();
  const { t } = useT();
  const [tasks, setTasks]     = useState<Task[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [filter, setFilter]   = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm]       = useState({ title: '', description: '', dueDate: '', priority: 'medium' });
  const [error, setError]     = useState('');
  const [msg, setMsg]         = useState('');

  const load = async () => {
    const [t, s] = await Promise.all([api.get('/tasks'), api.get('/tasks/summary')]);
    setTasks(t.data);
    setSummary(s.data);
  };
  useEffect(() => { load(); }, []);

  const filtered = filter ? tasks.filter(tk => tk.status === filter) : tasks;

  const create = async () => {
    setError('');
    try {
      await api.post('/tasks', { ...form, dueDate: form.dueDate || undefined });
      setCreateOpen(false);
      setForm({ title: '', description: '', dueDate: '', priority: 'medium' });
      load();
    } catch (e) { setError(errMsg(e)); }
  };

  const setStatus = async (id: string, status: string) => {
    try { await api.patch(`/tasks/${id}`, { status }); load(); }
    catch (e) { setMsg(errMsg(e)); }
  };

  const remove = async (id: string) => {
    try { await api.delete(`/tasks/${id}`); load(); }
    catch (e) { setMsg(errMsg(e)); }
  };

  const isAdmin = user?.role === 'admin';
  const isCloser = user?.role === 'closer';

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={700}>{t('tk.title')}</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setError(''); setCreateOpen(true); }}>
          {t('tk.add')}
        </Button>
      </Stack>

      {msg && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setMsg('')}>{msg}</Alert>}

      {/* Summary cards */}
      {summary && (
        <Stack direction="row" spacing={2} mb={3} flexWrap="wrap" useFlexGap>
          {[
            { label: t('tk.pending'),     value: summary.pending,    color: '#6366f1' },
            { label: t('tk.in_progress'), value: summary.inProgress, color: '#0ea5e9' },
            { label: t('tk.done'),        value: summary.done,       color: '#22c55e' },
            { label: t('tk.overdue'),     value: summary.overdue,    color: '#ef4444' },
          ].map(c => (
            <Paper key={c.label} sx={{ p: 2, minWidth: 120, flex: '1 1 120px', cursor: 'pointer', borderTop: `3px solid ${c.color}` }}
              onClick={() => setFilter(f => f === c.label.toLowerCase() ? '' : c.label === t('tk.pending') ? 'pending' : c.label === t('tk.in_progress') ? 'in_progress' : c.label === t('tk.done') ? 'done' : 'overdue')}
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

      {/* Create dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('tk.addTitle')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            {error && <Alert severity="error">{error}</Alert>}
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
    </Box>
  );
}
