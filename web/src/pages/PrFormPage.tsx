import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Typography, Paper, Button, TextField, Select, MenuItem,
  FormControl, InputLabel, Grid, IconButton, Table, TableHead,
  TableRow, TableCell, TableBody, Alert, CircularProgress,
} from '@mui/material';
import { Add, Delete, ArrowBack, Save } from '@mui/icons-material';
import { useT } from '../i18n';
import { api, errMsg } from '../api/client';

interface Employee { id: string; name: string; code: string }
interface User { id: string; name: string }
interface PrItem { id?: string; name: string; detail?: string; qty: number; unit: string; budget?: number; neededBy?: string }

const DEPARTMENTS = ['IT', 'การตลาด', 'ขาย', 'HR', 'การเงิน', 'บัญชี', 'ปฏิบัติการ', 'จัดซื้อ', 'อื่นๆ'];
const PR_TYPES = ['ซื้อสินค้า', 'บริการ', 'ซ่อมแซม', 'เช่า', 'อบรม', 'โฆษณา', 'เทคโนโลยี', 'อื่นๆ'];
const UNITS = ['ชิ้น', 'ชุด', 'กล่อง', 'ใบ', 'ครั้ง', 'เดือน', 'ปี', 'อื่นๆ'];

export default function PrFormPage() {
  const { t } = useT();
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [form, setForm] = useState({
    department: '',
    prType: '',
    priority: 'medium',
    title: '',
    description: '',
    note: '',
    budgetTotal: '',
    dueDate: '',
    responsibleId: '',
    approverId: '',
  });

  const [items, setItems] = useState<PrItem[]>([{ name: '', qty: 1, unit: 'ชิ้น' }]);

  useEffect(() => {
    fetchEmployees();
    fetchUsers();
    if (isEdit && id) fetchPr(id);
  }, [id]);

  const fetchEmployees = async () => {
    try {
      const res = await api.get<{ items: Employee[] }>('/employees?limit=200');
      setEmployees(res.data.items ?? []);
    } catch { /* ignore */ }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get<{ items: User[] }>('/users?limit=200');
      setUsers(res.data.items ?? []);
    } catch { /* ignore */ }
  };

  const fetchPr = async (prId: string) => {
    try {
      const res = await api.get<{ id: string; department: string; prType: string; priority: string; title: string; description?: string; note?: string; budgetTotal?: number; dueDate?: string; responsibleId?: string; approverId?: string; items: PrItem[] }>(`/pr/${prId}`);
      const pr = res.data;
      setForm({
        department: pr.department,
        prType: pr.prType,
        priority: pr.priority,
        title: pr.title,
        description: pr.description ?? '',
        note: pr.note ?? '',
        budgetTotal: pr.budgetTotal?.toString() ?? '',
        dueDate: pr.dueDate ? pr.dueDate.slice(0, 10) : '',
        responsibleId: pr.responsibleId ?? '',
        approverId: pr.approverId ?? '',
      });
      setItems(pr.items.length ? pr.items.map((i) => ({ ...i, qty: Number(i.qty), budget: i.budget ? Number(i.budget) : undefined })) : [{ name: '', qty: 1, unit: 'ชิ้น' }]);
    } catch { setError('โหลดข้อมูลไม่สำเร็จ'); }
  };

  const setF = (key: string, val: string) => setForm((p) => ({ ...p, [key]: val }));

  const setItem = (i: number, key: keyof PrItem, val: string | number) =>
    setItems((prev) => prev.map((item, idx) => idx === i ? { ...item, [key]: val } : item));

  const addItem = () => setItems((p) => [...p, { name: '', qty: 1, unit: 'ชิ้น' }]);
  const removeItem = (i: number) => setItems((p) => p.filter((_, idx) => idx !== i));

  const handleSubmit = async () => {
    if (!form.department || !form.prType || !form.title) {
      setError('กรุณากรอกข้อมูลที่จำเป็น'); return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        budgetTotal: form.budgetTotal ? Number(form.budgetTotal) : undefined,
        dueDate: form.dueDate || undefined,
        responsibleId: form.responsibleId || undefined,
        approverId: form.approverId || undefined,
        items: items.filter((i) => i.name.trim()),
      };
      if (isEdit && id) {
        await api.patch(`/pr/${id}`, payload);
      } else {
        const res = await api.post<{ id: string }>('/pr', payload);
        navigate(`/pr/${res.data.id}`);
        return;
      }
      navigate(`/pr/${id}`);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const totalBudget = items.reduce((s, i) => s + (i.budget ?? 0) * (i.qty ?? 0), 0);

  return (
    <Box p={3} maxWidth={900} mx="auto">
      <Box display="flex" alignItems="center" gap={1} mb={3}>
        <IconButton onClick={() => navigate('/pr')}><ArrowBack /></IconButton>
        <Typography variant="h5" fontWeight={700}>{isEdit ? t('prt.edit') : t('prt.create')}</Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* General Info */}
      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={700} mb={2}>ข้อมูลทั่วไป</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField label={t('prt.title')} value={form.title} onChange={(e) => setF('title', e.target.value)} fullWidth required />
          </Grid>
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth required>
              <InputLabel>{t('prt.department')}</InputLabel>
              <Select value={form.department} label={t('prt.department')} onChange={(e) => setF('department', e.target.value)}>
                {DEPARTMENTS.map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth required>
              <InputLabel>{t('prt.type')}</InputLabel>
              <Select value={form.prType} label={t('prt.type')} onChange={(e) => setF('prType', e.target.value)}>
                {PR_TYPES.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth>
              <InputLabel>{t('prt.priority')}</InputLabel>
              <Select value={form.priority} label={t('prt.priority')} onChange={(e) => setF('priority', e.target.value)}>
                <MenuItem value="low">{t('prt.priorityLow')}</MenuItem>
                <MenuItem value="medium">{t('prt.priorityMedium')}</MenuItem>
                <MenuItem value="high">{t('prt.priorityHigh')}</MenuItem>
                <MenuItem value="urgent">{t('prt.priorityUrgent')}</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField label={t('prt.dueDate')} type="date" value={form.dueDate} onChange={(e) => setF('dueDate', e.target.value)} fullWidth InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField label={`${t('prt.budget')} (รวม)`} type="number" value={form.budgetTotal} onChange={(e) => setF('budgetTotal', e.target.value)} fullWidth InputProps={{ inputProps: { min: 0 } }} />
          </Grid>
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth>
              <InputLabel>{t('prt.responsible')}</InputLabel>
              <Select value={form.responsibleId} label={t('prt.responsible')} onChange={(e) => setF('responsibleId', e.target.value)}>
                <MenuItem value="">— ไม่ระบุ —</MenuItem>
                {employees.map((e) => <MenuItem key={e.id} value={e.id}>{e.name} ({e.code})</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth>
              <InputLabel>{t('prt.approver')}</InputLabel>
              <Select value={form.approverId} label={t('prt.approver')} onChange={(e) => setF('approverId', e.target.value)}>
                <MenuItem value="">— ไม่ระบุ —</MenuItem>
                {users.map((u) => <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <TextField label={t('prt.description')} value={form.description} onChange={(e) => setF('description', e.target.value)} fullWidth multiline rows={3} />
          </Grid>
          <Grid item xs={12}>
            <TextField label={t('prt.note')} value={form.note} onChange={(e) => setF('note', e.target.value)} fullWidth multiline rows={2} />
          </Grid>
        </Grid>
      </Paper>

      {/* Line Items */}
      <Paper sx={{ p: 3, mb: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="subtitle1" fontWeight={700}>{t('prt.items')}</Typography>
          <Button startIcon={<Add />} size="small" onClick={addItem}>{t('prt.addItem')}</Button>
        </Box>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#F8FAFC' }}>
              <TableCell sx={{ width: '30%' }}>{t('prt.itemName')}</TableCell>
              <TableCell>รายละเอียด</TableCell>
              <TableCell sx={{ width: 80 }}>{t('prt.qty')}</TableCell>
              <TableCell sx={{ width: 100 }}>{t('prt.unit')}</TableCell>
              <TableCell sx={{ width: 130 }}>{t('prt.itemBudget')} (฿)</TableCell>
              <TableCell sx={{ width: 130 }}>{t('prt.neededBy')}</TableCell>
              <TableCell sx={{ width: 40 }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item, i) => (
              <TableRow key={i}>
                <TableCell><TextField size="small" fullWidth value={item.name} onChange={(e) => setItem(i, 'name', e.target.value)} placeholder="ชื่อรายการ *" /></TableCell>
                <TableCell><TextField size="small" fullWidth value={item.detail ?? ''} onChange={(e) => setItem(i, 'detail', e.target.value)} /></TableCell>
                <TableCell><TextField size="small" type="number" value={item.qty} onChange={(e) => setItem(i, 'qty', Number(e.target.value))} inputProps={{ min: 0.01, step: 0.01 }} /></TableCell>
                <TableCell>
                  <Select size="small" value={item.unit} onChange={(e) => setItem(i, 'unit', e.target.value)} fullWidth>
                    {UNITS.map((u) => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                  </Select>
                </TableCell>
                <TableCell><TextField size="small" type="number" value={item.budget ?? ''} onChange={(e) => setItem(i, 'budget', Number(e.target.value))} inputProps={{ min: 0 }} /></TableCell>
                <TableCell><TextField size="small" type="date" value={item.neededBy ?? ''} onChange={(e) => setItem(i, 'neededBy', e.target.value)} InputLabelProps={{ shrink: true }} /></TableCell>
                <TableCell><IconButton size="small" onClick={() => removeItem(i)} disabled={items.length === 1}><Delete fontSize="small" /></IconButton></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {totalBudget > 0 && (
          <Box mt={1} textAlign="right">
            <Typography variant="body2" color="text.secondary">
              รวมงบประมาณรายการ: <strong>{new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0 }).format(totalBudget)}</strong>
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Actions */}
      <Box display="flex" gap={2} justifyContent="flex-end">
        <Button variant="outlined" onClick={() => navigate('/pr')}>ยกเลิก</Button>
        <Button variant="contained" startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />} onClick={handleSubmit} disabled={saving}>
          {saving ? 'กำลังบันทึก…' : 'บันทึก'}
        </Button>
      </Box>
    </Box>
  );
}
