import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent, Chip, Table, TableHead,
  TableRow, TableCell, TableBody, Button, TextField, Select, MenuItem,
  FormControl, InputLabel, Dialog, DialogTitle, DialogContent, DialogActions,
  Alert, IconButton, Tooltip, CircularProgress,
} from '@mui/material';
import { Add, Refresh, CheckCircle, Cancel, Receipt } from '@mui/icons-material';
import { api, errMsg } from '../api/client';
import { useAuth } from '../auth/AuthContext';

const CATEGORIES = ['fuel','food','accommodation','other'];
const CAT_LABELS: Record<string,string> = { fuel:'น้ำมัน', food:'อาหาร', accommodation:'ที่พัก', other:'อื่นๆ' };

interface Expense {
  id: string; date: string; category: string; amount: number; description?: string;
  status: string; employee: { name: string; code: string }; approvedBy?: { name: string }; approvedAt?: string;
}

const EMPTY_FORM = { employeeId: '', date: '', category: 'fuel', amount: '', description: '' };

export default function ExpensePage() {
  const { user } = useAuth();
  const isManager = (user?.activeRole ?? user?.role) !== 'sales';
  const [items, setItems] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [employees, setEmployees] = useState<{ id: string; name: string; code: string }[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      const expRes = await api.get<Expense[]>(`/expenses?${params}`);
      setItems(expRes.data ?? []);
    } catch (e) { setError(errMsg(e)); }
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (isManager) api.get<{id:string;name:string;code:string}[]>('/employees').then(r => setEmployees(r.data ?? [])).catch(() => {});
  }, [filterStatus]);

  const submit = async () => {
    setError('');
    try {
      await api.post('/expenses', { ...form, amount: Number(form.amount) });
      setSuccess('บันทึกค่าใช้จ่ายสำเร็จ');
      setShowForm(false);
      setForm(EMPTY_FORM);
      load();
    } catch (e) { setError(errMsg(e)); }
    setTimeout(() => setSuccess(''), 3000);
  };

  const doApprove = async (id: string, action: 'approve' | 'reject') => {
    try {
      await api.patch(`/expenses/${id}/approve`, { action });
      setSuccess(action === 'approve' ? 'อนุมัติแล้ว' : 'ปฏิเสธแล้ว');
      load();
    } catch (e) { setError(errMsg(e)); }
    setTimeout(() => setSuccess(''), 3000);
  };

  const totalAmount = items.reduce((s, e) => s + Number(e.amount), 0);
  const pending = items.filter(e => e.status === 'pending').length;

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>ค่าใช้จ่ายภาคสนาม</Typography>
          <Typography variant="body2" color="text.secondary">Expense Report — {items.length} รายการ</Typography>
        </Box>
        <Box display="flex" gap={1}>
          <IconButton onClick={load}><Refresh /></IconButton>
          <Button startIcon={<Add />} variant="contained" onClick={() => setShowForm(true)}>เพิ่มค่าใช้จ่าย</Button>
        </Box>
      </Box>

      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Summary */}
      <Grid container spacing={2} mb={2}>
        {([
          ['รวมทั้งหมด', `฿${totalAmount.toLocaleString()}`, '#4F46E5'],
          ['รออนุมัติ', pending, '#D97706'],
          ['อนุมัติแล้ว', items.filter(e=>e.status==='approved').length, '#16A34A'],
          ['ปฏิเสธ', items.filter(e=>e.status==='rejected').length, '#DC2626'],
        ] as [string, string|number, string][]).map(([l,v,c]) => (
          <Grid item xs={6} sm={3} key={String(l)}>
            <Card variant="outlined" sx={{ borderTop: `3px solid ${c}`, textAlign: 'center' }}>
              <CardContent sx={{ py:1.5, px:2, '&:last-child':{pb:1.5} }}>
                <Typography variant="h5" fontWeight={700} sx={{ color: c }}>{v}</Typography>
                <Typography variant="caption" color="text.secondary">{l}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Filter */}
      <Paper sx={{ p:2, mb:2 }}>
        <Box display="flex" gap={2} alignItems="center">
          <FormControl size="small" sx={{ minWidth:140 }}>
            <InputLabel>สถานะ</InputLabel>
            <Select value={filterStatus} label="สถานะ" onChange={e => setFilterStatus(e.target.value)}>
              <MenuItem value="">ทั้งหมด</MenuItem>
              {['pending','approved','rejected'].map(s=><MenuItem key={s} value={s}>{s}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>
      </Paper>

      {/* Table */}
      <Paper>
        {loading ? <Box p={6} textAlign="center"><CircularProgress /></Box> : (
          <Table size="small">
            <TableHead><TableRow sx={{ bgcolor:'#F8FAFC' }}>
              {['วันที่','พนักงาน','ประเภท','จำนวน','รายละเอียด','สถานะ',isManager?'จัดการ':''].filter(Boolean).map(h=><TableCell key={h} sx={{ fontWeight:700 }}>{h}</TableCell>)}
            </TableRow></TableHead>
            <TableBody>
              {items.length === 0 ? (
                <TableRow><TableCell colSpan={7} align="center" sx={{ py:6, color:'text.secondary' }}>ไม่มีรายการ</TableCell></TableRow>
              ) : items.map(e => (
                <TableRow key={e.id} hover>
                  <TableCell>{new Date(e.date).toLocaleDateString('th-TH')}</TableCell>
                  <TableCell>
                    <Typography variant="body2">{e.employee?.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{e.employee?.code}</Typography>
                  </TableCell>
                  <TableCell><Chip label={CAT_LABELS[e.category]??e.category} size="small" /></TableCell>
                  <TableCell><Typography fontWeight={600}>฿{Number(e.amount).toLocaleString()}</Typography></TableCell>
                  <TableCell>{e.description??'—'}</TableCell>
                  <TableCell>
                    <Chip label={e.status==='approved'?'อนุมัติ':e.status==='rejected'?'ปฏิเสธ':'รออนุมัติ'} size="small"
                      color={e.status==='approved'?'success':e.status==='rejected'?'error':'warning'} />
                  </TableCell>
                  {isManager && (
                    <TableCell>
                      {e.status === 'pending' && (
                        <Box display="flex" gap={0.5}>
                          <Tooltip title="อนุมัติ">
                            <IconButton size="small" color="success" onClick={() => doApprove(e.id,'approve')}><CheckCircle fontSize="small" /></IconButton>
                          </Tooltip>
                          <Tooltip title="ปฏิเสธ">
                            <IconButton size="small" color="error" onClick={() => doApprove(e.id,'reject')}><Cancel fontSize="small" /></IconButton>
                          </Tooltip>
                        </Box>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      {/* Add Form Dialog */}
      <Dialog open={showForm} onClose={() => setShowForm(false)} maxWidth="sm" fullWidth>
        <DialogTitle><Receipt sx={{ mr:1, verticalAlign:'middle' }} />เพิ่มค่าใช้จ่าย</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt:0.5 }}>
            {isManager && (
              <Grid item xs={12}>
                <FormControl fullWidth size="small">
                  <InputLabel>พนักงาน</InputLabel>
                  <Select value={form.employeeId} label="พนักงาน" onChange={e => setForm(f=>({...f, employeeId: e.target.value}))}>
                    {employees.map(e => <MenuItem key={e.id} value={e.id}>{e.name} ({e.code})</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            )}
            <Grid item xs={12} sm={6}>
              <TextField label="วันที่" type="date" fullWidth size="small" value={form.date} onChange={e => setForm(f=>({...f, date:e.target.value}))} InputLabelProps={{ shrink:true }} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>ประเภท</InputLabel>
                <Select value={form.category} label="ประเภท" onChange={e => setForm(f=>({...f, category:e.target.value}))}>
                  {CATEGORIES.map(c=><MenuItem key={c} value={c}>{CAT_LABELS[c]}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="จำนวนเงิน (฿)" type="number" fullWidth size="small" value={form.amount} onChange={e => setForm(f=>({...f, amount:e.target.value}))} />
            </Grid>
            <Grid item xs={12}>
              <TextField label="รายละเอียด" multiline rows={2} fullWidth size="small" value={form.description} onChange={e => setForm(f=>({...f, description:e.target.value}))} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowForm(false)}>ยกเลิก</Button>
          <Button variant="contained" onClick={submit} disabled={!form.date || !form.amount}>บันทึก</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
