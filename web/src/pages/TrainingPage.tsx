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

  const save = async () => {
    if (!editItem) return;
    setError('');
    try {
      const body = { ...editItem, hours: editItem.hours ? Number(editItem.hours) : undefined, score: editItem.score ? Number(editItem.score) : undefined };
      if (editItem.id) await api.patch(`/training/${editItem.id}`, body);
      else await api.post('/training', body);
      setSuccess(editItem.id ? 'บันทึกสำเร็จ' : 'เพิ่มสำเร็จ');
      setEditItem(null);
      load();
    } catch (e) { setError(errMsg(e)); }
    setTimeout(() => setSuccess(''), 3000);
  };

  const remove = async (id: string) => {
    if (!confirm('ลบบันทึกการอบรมนี้?')) return;
    try { await api.delete(`/training/${id}`); load(); } catch (e) { setError(errMsg(e)); }
  };

  const total = items.length;
  const passed = items.filter(t => t.passed).length;
  const totalHours = items.reduce((s, t) => s + (t.hours ?? 0), 0);
  const avgScore = total ? Math.round(items.reduce((s, t) => s + (t.score ?? 0), 0) / total) : 0;

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Training Records</Typography>
          <Typography variant="body2" color="text.secondary">ประวัติการอบรมพนักงาน</Typography>
        </Box>
        <Box display="flex" gap={1}>
          <IconButton onClick={load}><Refresh /></IconButton>
          {isManager && <Button startIcon={<Add />} variant="contained" onClick={() => setEditItem({ ...EMPTY })}>เพิ่มการอบรม</Button>}
        </Box>
      </Box>

      {success && <Alert severity="success" sx={{ mb:2 }}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ mb:2 }}>{error}</Alert>}

      <Grid container spacing={2} mb={2}>
        {([
          ['จำนวนการอบรม', total, '#4F46E5'],
          ['ผ่าน', passed, '#16A34A'],
          ['รวมชั่วโมง', totalHours, '#2563EB'],
          ['คะแนนเฉลี่ย', avgScore ? `${avgScore}%` : '—', '#D97706'],
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

      {isManager && (
        <Paper sx={{ p:2, mb:2 }}>
          <FormControl size="small" sx={{ minWidth:200 }}>
            <InputLabel>กรองพนักงาน</InputLabel>
            <Select value={filterEmp} label="กรองพนักงาน" onChange={e => setFilterEmp(e.target.value)}>
              <MenuItem value="">ทั้งหมด</MenuItem>
              {employees.map(e => <MenuItem key={e.id} value={e.id}>{e.name}</MenuItem>)}
            </Select>
          </FormControl>
        </Paper>
      )}

      <Paper>
        {loading ? <Box p={6} textAlign="center"><CircularProgress /></Box> : (
          <Table size="small">
            <TableHead><TableRow sx={{ bgcolor:'#F8FAFC' }}>
              {['หลักสูตร','พนักงาน','วันที่','ชั่วโมง','คะแนน','ผ่าน','จัดการ'].map(h=><TableCell key={h} sx={{ fontWeight:700 }}>{h}</TableCell>)}
            </TableRow></TableHead>
            <TableBody>
              {items.length === 0 ? (
                <TableRow><TableCell colSpan={7} align="center" sx={{ py:6, color:'text.secondary' }}>ไม่มีประวัติการอบรม</TableCell></TableRow>
              ) : items.map(t => (
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
                  <TableCell>{t.hours ? `${t.hours} ชม.` : '—'}</TableCell>
                  <TableCell>{t.score ? `${t.score}%` : '—'}</TableCell>
                  <TableCell><Chip label={t.passed?'ผ่าน':'ไม่ผ่าน'} size="small" color={t.passed?'success':'error'} /></TableCell>
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
        <DialogTitle><School sx={{ mr:1, verticalAlign:'middle' }} />{editItem?.id ? 'แก้ไข' : 'เพิ่ม'}การอบรม</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt:0.5 }}>
            {isManager && (
              <Grid item xs={12}>
                <FormControl fullWidth size="small">
                  <InputLabel>พนักงาน</InputLabel>
                  <Select value={editItem?.employeeId??''} label="พนักงาน" onChange={e => setEditItem(f=>({...f!, employeeId:e.target.value}))}>
                    {employees.map(e=><MenuItem key={e.id} value={e.id}>{e.name} ({e.code})</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            )}
            <Grid item xs={12}>
              <TextField label="ชื่อหลักสูตร" fullWidth size="small" value={editItem?.trainingName??''} onChange={e=>setEditItem(f=>({...f!, trainingName:e.target.value}))} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="วันที่อบรม" type="date" fullWidth size="small" value={editItem?.trainingDate??''} onChange={e=>setEditItem(f=>({...f!, trainingDate:e.target.value}))} InputLabelProps={{ shrink:true }} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField label="ชั่วโมง" type="number" fullWidth size="small" value={editItem?.hours??''} onChange={e=>setEditItem(f=>({...f!, hours:e.target.value}))} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField label="คะแนน (%)" type="number" fullWidth size="small" value={editItem?.score??''} onChange={e=>setEditItem(f=>({...f!, score:e.target.value}))} />
            </Grid>
            <Grid item xs={12}>
              <TextField label="รายละเอียด" multiline rows={2} fullWidth size="small" value={editItem?.description??''} onChange={e=>setEditItem(f=>({...f!, description:e.target.value}))} />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel control={<Switch checked={editItem?.passed??false} onChange={e=>setEditItem(f=>({...f!, passed:e.target.checked}))} />} label="ผ่านการอบรม" />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditItem(null)}>ยกเลิก</Button>
          <Button variant="contained" onClick={save} disabled={!editItem?.trainingName || !editItem?.trainingDate}>บันทึก</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
