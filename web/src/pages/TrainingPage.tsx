import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent, Chip, Table, TableHead,
  TableRow, TableCell, TableBody, Button, TextField, Select, MenuItem,
  FormControl, InputLabel, Dialog, DialogTitle, DialogContent, DialogActions,
  Alert, IconButton, CircularProgress, Switch, FormControlLabel,
} from '@mui/material';
import { Add, Refresh, Edit, Delete, School } from '@mui/icons-material';
import { api, errMsg } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { ExportPdfButton } from '../components/ExportPdfButton';

interface Training {
  id: string; trainingName: string; description?: string; trainingDate: string;
  hours?: number; score?: number; passed: boolean; certificate?: string; notes?: string;
  employee: { id: string; name: string; code: string };
  createdBy: { name: string };
}

const EMPTY = { employeeId: '', trainingName: '', description: '', trainingDate: '', hours: '', score: '', passed: false, notes: '' };

export default function TrainingPage() {
  const { user } = useAuth();
  const isManager = (user?.activeRole ?? user?.role) !== 'sales';
  const [items, setItems] = useState<Training[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editItem, setEditItem] = useState<typeof EMPTY & { id?: string } | null>(null);
  const [employees, setEmployees] = useState<{ id: string; name: string; code: string }[]>([]);
  const [filterEmp, setFilterEmp] = useState('');
  const [searchText, setSearchText] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'passed' | 'failed'>('all');

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterEmp) params.set('employeeId', filterEmp);
      const res = await api.get<Training[]>(`/training?${params}`);
      setItems(res.data ?? []);
    } catch (e) { setError(errMsg(e)); }
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (isManager) api.get<typeof employees>('/employees').then(r => setEmployees(r.data ?? [])).catch(() => {});
  }, [filterEmp]);

  const filteredItems = items.filter(item => {
    // Search filter: search across training name, description, employee name, and code
    const searchLower = searchText.toLowerCase();
    const matchesSearch = !searchText ||
      item.trainingName.toLowerCase().includes(searchLower) ||
      item.description?.toLowerCase().includes(searchLower) ||
      item.employee?.name.toLowerCase().includes(searchLower) ||
      item.employee?.code.toLowerCase().includes(searchLower);

    // Status filter: filter by passed/failed
    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'passed' && item.passed) ||
      (filterStatus === 'failed' && !item.passed);

    return matchesSearch && matchesStatus;
  });

  const hasActiveFilters = searchText !== '' || filterStatus !== 'all';

  const save = async () => {
    if (!editItem) return;
    setError('');
    try {
      const body = { ...editItem, hours: editItem.hours ? Number(editItem.hours) : undefined, score: editItem.score ? Number(editItem.score) : undefined };
      if (editItem.id) await api.patch(`/training/${editItem.id}`, body);
      else await api.post('/training', body);
      setSuccess(editItem.id ? 'Saved successfully' : 'Added successfully');
      setEditItem(null);
      load();
    } catch (e) { setError(errMsg(e)); }
    setTimeout(() => setSuccess(''), 3000);
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this training record?')) return;
    try { await api.delete(`/training/${id}`); load(); } catch (e) { setError(errMsg(e)); }
  };

  const total = filteredItems.length;
  const passed = filteredItems.filter(t => t.passed).length;
  const totalHours = filteredItems.reduce((s, t) => s + (t.hours ?? 0), 0);
  const avgScore = total ? Math.round(filteredItems.reduce((s, t) => s + (t.score ?? 0), 0) / total) : 0;

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Training History</Typography>
          <Typography variant="body2" color="text.secondary">Employee training records</Typography>
        </Box>
        <Box display="flex" gap={1}>
          <IconButton onClick={load}><Refresh /></IconButton>
          <ExportPdfButton tableId="training-table" filename="training" title="Training" size="small" variant="outlined" />
          {isManager && <Button startIcon={<Add />} variant="contained" onClick={() => setEditItem({ ...EMPTY })}>Add Training</Button>}
        </Box>
      </Box>

      {success && <Alert severity="success" sx={{ mb:2 }}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ mb:2 }}>{error}</Alert>}

      <Grid container spacing={2} mb={2}>
        {([
          ['Total Trainings', total, '#4F46E5'],
          ['Passed', passed, '#16A34A'],
          ['Total Hours', totalHours, '#2563EB'],
          ['Avg. Score', avgScore ? `${avgScore}%` : '—', '#D97706'],
        ] as [string, string|number, string][]).map(([l,v,c]) => (
          <Grid item xs={6} sm={3} key={String(l)}>
            <Card variant="outlined" sx={{ borderTop:`3px solid ${c}`, textAlign:'center' }}>
              <CardContent sx={{ py:1.5, px:2, '&:last-child':{pb:1.5} }}>
                <Typography variant="h5" fontWeight={700} sx={{ color:c }}>{v}</Typography>
                <Typography variant="caption" color="text.secondary">{l}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Paper sx={{ p:2, mb:2 }}>
        <Box display="flex" flexDirection={{ xs: 'column', sm: 'row' }} gap={2} alignItems={{ xs: 'stretch', sm: 'flex-end' }} flexWrap="wrap">
          {/* Search TextField */}
          <TextField
            size="small"
            placeholder="Search by course, employee, or description..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            sx={{ minWidth: 250, flexGrow: 1 }}
          />

          {/* Status Filter */}
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select value={filterStatus} label="Status" onChange={e => setFilterStatus(e.target.value as 'all' | 'passed' | 'failed')}>
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="passed">Passed</MenuItem>
              <MenuItem value="failed">Failed</MenuItem>
            </Select>
          </FormControl>

          {/* Employee Filter - Manager only */}
          {isManager && (
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Filter Employee</InputLabel>
              <Select value={filterEmp} label="Filter Employee" onChange={e => setFilterEmp(e.target.value)}>
                <MenuItem value="">All Employees</MenuItem>
                {employees.map(e => <MenuItem key={e.id} value={e.id}>{e.name}</MenuItem>)}
              </Select>
            </FormControl>
          )}

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <Button
              size="small"
              onClick={() => {
                setSearchText('');
                setFilterStatus('all');
              }}
              sx={{ whiteSpace: 'nowrap' }}
            >
              Clear Filters
            </Button>
          )}
        </Box>

        {/* Results count */}
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
          Showing {total} of {items.length} training record{items.length !== 1 ? 's' : ''}
          {hasActiveFilters && ` (filtered)`}
        </Typography>
      </Paper>

      <Paper>
        {loading ? <Box p={6} textAlign="center"><CircularProgress /></Box> : (
          <Table id="training-table" size="small">
            <TableHead><TableRow sx={{ bgcolor:'#F8FAFC' }}>
              {['Course','Employee','Date','Hours','Score','Passed','Actions'].map(h=><TableCell key={h} sx={{ fontWeight:700 }}>{h}</TableCell>)}
            </TableRow></TableHead>
            <TableBody>
              {filteredItems.length === 0 ? (
                <TableRow><TableCell colSpan={7} align="center" sx={{ py:6, color:'text.secondary' }}>{items.length === 0 ? 'No training records found' : 'No matching records found'}</TableCell></TableRow>
              ) : filteredItems.map(t => (
                <TableRow key={t.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{t.trainingName}</Typography>
                    {t.description && <Typography variant="caption" color="text.secondary">{t.description}</Typography>}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{t.employee?.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{t.employee?.code}</Typography>
                  </TableCell>
                  <TableCell>{new Date(t.trainingDate).toLocaleDateString('th-TH')}</TableCell>
                  <TableCell>{t.hours ? `${t.hours} hrs` : '—'}</TableCell>
                  <TableCell>{t.score ? `${t.score}%` : '—'}</TableCell>
                  <TableCell><Chip label={t.passed?'Passed':'Failed'} size="small" color={t.passed?'success':'error'} /></TableCell>
                  <TableCell>
                    {isManager && (
                      <Box display="flex" gap={0.5}>
                        <IconButton size="small" onClick={() => setEditItem({ ...EMPTY, ...t, employeeId: t.employee?.id ?? '', hours: String(t.hours??''), score: String(t.score??''), id: t.id } as unknown as typeof EMPTY & {id:string})}><Edit fontSize="small" /></IconButton>
                        <IconButton size="small" color="error" onClick={() => remove(t.id)}><Delete fontSize="small" /></IconButton>
                      </Box>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      {/* Form Dialog */}
      <Dialog open={!!editItem} onClose={() => setEditItem(null)} maxWidth="sm" fullWidth>
        <DialogTitle><School sx={{ mr:1, verticalAlign:'middle' }} />{editItem?.id ? 'Edit' : 'Add'} Training</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt:0.5 }}>
            {isManager && (
              <Grid item xs={12}>
                <FormControl fullWidth size="small">
                  <InputLabel>Employee</InputLabel>
                  <Select value={editItem?.employeeId??''} label="Employee" onChange={e => setEditItem(f=>({...f!, employeeId:e.target.value}))}>
                    {employees.map(e=><MenuItem key={e.id} value={e.id}>{e.name} ({e.code})</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            )}
            <Grid item xs={12}>
              <TextField label="Course Name" fullWidth size="small" value={editItem?.trainingName??''} onChange={e=>setEditItem(f=>({...f!, trainingName:e.target.value}))} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Training Date" type="date" fullWidth size="small" value={editItem?.trainingDate??''} onChange={e=>setEditItem(f=>({...f!, trainingDate:e.target.value}))} InputLabelProps={{ shrink:true }} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField label="Hours" type="number" fullWidth size="small" value={editItem?.hours??''} onChange={e=>setEditItem(f=>({...f!, hours:e.target.value}))} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField label="Score (%)" type="number" fullWidth size="small" value={editItem?.score??''} onChange={e=>setEditItem(f=>({...f!, score:e.target.value}))} />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Details" multiline rows={2} fullWidth size="small" value={editItem?.description??''} onChange={e=>setEditItem(f=>({...f!, description:e.target.value}))} />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel control={<Switch checked={editItem?.passed??false} onChange={e=>setEditItem(f=>({...f!, passed:e.target.checked}))} />} label="Passed Training" />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditItem(null)}>Cancel</Button>
          <Button variant="contained" onClick={save} disabled={!editItem?.trainingName || !editItem?.trainingDate}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
