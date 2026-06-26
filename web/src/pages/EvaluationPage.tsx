import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent, Chip, Table, TableHead,
  TableRow, TableCell, TableBody, Button, TextField, Select, MenuItem,
  FormControl, InputLabel, Dialog, DialogTitle, DialogContent, DialogActions,
  Alert, IconButton, CircularProgress, LinearProgress, Slider,
} from '@mui/material';
import { Add, Refresh, Edit, Delete, Assessment } from '@mui/icons-material';
import { api, errMsg } from '../api/client';

const GRADE_COLOR: Record<string,string> = { A:'#16A34A', B:'#2563EB', C:'#D97706', D:'#DC2626' };
const MONTH_TH = ['','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

interface Eval {
  id: string; month: number; year: number;
  kpiScore?: number; behaviorScore?: number; overallScore?: number; grade?: string;
  strengths?: string; improvements?: string; goals?: string;
  employee: { id: string; name: string; code: string; position: string };
  evaluatedBy: { name: string };
}

const EMPTY = {
  employeeId: '', month: new Date().getMonth() + 1, year: new Date().getFullYear(),
  kpiScore: 80, behaviorScore: 80, overallScore: 80, grade: 'B',
  strengths: '', improvements: '', goals: '',
};

function gradeFromScore(score: number) {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  return 'D';
}

export default function EvaluationPage() {
  const [items, setItems] = useState<Eval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editItem, setEditItem] = useState<typeof EMPTY & { id?: string } | null>(null);
  const [employees, setEmployees] = useState<{ id: string; name: string; code: string; position: string }[]>([]);
  const [filterEmp, setFilterEmp] = useState('');
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ year: String(filterYear) });
      if (filterEmp) params.set('employeeId', filterEmp);
      const res = await api.get<Eval[]>(`/evaluations?${params}`);
      setItems(res.data ?? []);
    } catch (e) { setError(errMsg(e)); }
    setLoading(false);
  };

  useEffect(() => {
    load();
    api.get<typeof employees>('/employees').then(r => setEmployees(r.data ?? [])).catch(() => {});
  }, [filterEmp, filterYear]);

  const save = async () => {
    if (!editItem) return;
    setError('');
    try {
      if (editItem.id) await api.patch(`/evaluations/${editItem.id}`, editItem);
      else await api.post('/evaluations', editItem);
      setSuccess(editItem.id ? 'บันทึกสำเร็จ' : 'สร้างการประเมินสำเร็จ');
      setEditItem(null);
      load();
    } catch (e) { setError(errMsg(e)); }
    setTimeout(() => setSuccess(''), 3000);
  };

  const remove = async (id: string) => {
    if (!confirm('ลบบันทึกการประเมินนี้?')) return;
    try { await api.delete(`/evaluations/${id}`); load(); } catch (e) { setError(errMsg(e)); }
  };

  const byGrade = (g: string) => items.filter(e => e.grade === g).length;
  const avgScore = items.length ? Math.round(items.reduce((s, e) => s + (e.overallScore ?? 0), 0) / items.length) : 0;

  const updateScore = (field: 'kpiScore' | 'behaviorScore', val: number) => {
    setEditItem(p => {
      if (!p) return p;
      const updated = { ...p, [field]: val };
      const overall = Math.round((updated.kpiScore * 0.6) + (updated.behaviorScore * 0.4));
      return { ...updated, overallScore: overall, grade: gradeFromScore(overall) };
    });
  };

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Box display="flex" alignItems="center" gap={1}><Assessment sx={{ color:'#4F46E5' }} /><Typography variant="h5" fontWeight={700}>Employee Evaluation</Typography></Box>
          <Typography variant="body2" color="text.secondary">ผลการประเมินพนักงานรายเดือน</Typography>
        </Box>
        <Box display="flex" gap={1}>
          <IconButton onClick={load}><Refresh /></IconButton>
          <Button startIcon={<Add />} variant="contained" onClick={() => setEditItem({ ...EMPTY })}>สร้างการประเมิน</Button>
        </Box>
      </Box>

      {success && <Alert severity="success" sx={{ mb:2 }}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ mb:2 }}>{error}</Alert>}

      <Grid container spacing={2} mb={2}>
        {(['A','B','C','D'] as const).map(g => (
          <Grid item xs={6} sm={2.4} key={g}>
            <Card variant="outlined" sx={{ borderTop:`4px solid ${GRADE_COLOR[g]}`, textAlign:'center' }}>
              <CardContent sx={{ py:1.5, px:2, '&:last-child':{pb:1.5} }}>
                <Typography variant="h4" fontWeight={900} sx={{ color:GRADE_COLOR[g] }}>{g}</Typography>
                <Typography fontWeight={700}>{byGrade(g)}</Typography>
                <Typography variant="caption" color="text.secondary">คน</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
        <Grid item xs={12} sm={2.4}>
          <Card variant="outlined" sx={{ borderTop:'4px solid #7C3AED', textAlign:'center' }}>
            <CardContent sx={{ py:1.5, px:2, '&:last-child':{pb:1.5} }}>
              <Typography variant="h4" fontWeight={900} sx={{ color:'#7C3AED' }}>{avgScore}</Typography>
              <Typography variant="caption" color="text.secondary">คะแนนเฉลี่ย</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Paper sx={{ p:2, mb:2 }}>
        <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
          <FormControl size="small" sx={{ minWidth:200 }}>
            <InputLabel>พนักงาน</InputLabel>
            <Select value={filterEmp} label="พนักงาน" onChange={e => setFilterEmp(e.target.value)}>
              <MenuItem value="">ทั้งหมด</MenuItem>
              {employees.map(e=><MenuItem key={e.id} value={e.id}>{e.name}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField size="small" label="ปี" type="number" value={filterYear} onChange={e=>setFilterYear(Number(e.target.value))} sx={{ width:100 }} />
        </Box>
      </Paper>

      <Paper>
        {loading ? <Box p={6} textAlign="center"><CircularProgress /></Box> : (
          <Table size="small">
            <TableHead><TableRow sx={{ bgcolor:'#F8FAFC' }}>
              {['พนักงาน','เดือน','KPI (60%)','พฤติกรรม (40%)','รวม','เกรด','ประเมินโดย','จัดการ'].map(h=>(
                <TableCell key={h} sx={{ fontWeight:700 }}>{h}</TableCell>
              ))}
            </TableRow></TableHead>
            <TableBody>
              {items.length === 0 ? (
                <TableRow><TableCell colSpan={8} align="center" sx={{ py:6, color:'text.secondary' }}>ไม่มีผลการประเมิน</TableCell></TableRow>
              ) : items.map(e => (
                <TableRow key={e.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={700}>{e.employee?.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{e.employee?.code} · {e.employee?.position}</Typography>
                  </TableCell>
                  <TableCell>{MONTH_TH[e.month]} {e.year + 543}</TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="body2">{e.kpiScore ?? '—'}</Typography>
                      {e.kpiScore != null && <LinearProgress variant="determinate" value={e.kpiScore} sx={{ height:4, borderRadius:2, bgcolor:'#E2E8F0' }} />}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="body2">{e.behaviorScore ?? '—'}</Typography>
                      {e.behaviorScore != null && <LinearProgress variant="determinate" value={e.behaviorScore} sx={{ height:4, borderRadius:2, bgcolor:'#E2E8F0' }} />}
                    </Box>
                  </TableCell>
                  <TableCell><Typography fontWeight={700}>{e.overallScore ?? '—'}</Typography></TableCell>
                  <TableCell>
                    <Chip label={e.grade ?? '—'} size="small" sx={{ bgcolor: GRADE_COLOR[e.grade??'']??'#E2E8F0', color: GRADE_COLOR[e.grade??'']?'#fff':'inherit', fontWeight:700 }} />
                  </TableCell>
                  <TableCell>{e.evaluatedBy?.name ?? '—'}</TableCell>
                  <TableCell>
                    <Box display="flex" gap={0.5}>
                      <IconButton size="small" onClick={() => setEditItem({ ...e, employeeId: e.employee?.id ?? '' } as typeof EMPTY & {id:string})}><Edit fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" onClick={() => remove(e.id)}><Delete fontSize="small" /></IconButton>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      {/* Form Dialog */}
      <Dialog open={!!editItem} onClose={() => setEditItem(null)} maxWidth="md" fullWidth>
        <DialogTitle>{editItem?.id ? 'แก้ไข' : 'สร้าง'}การประเมิน</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt:0.5 }}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>พนักงาน *</InputLabel>
                <Select value={editItem?.employeeId??''} label="พนักงาน *" onChange={e => setEditItem(f=>({...f!, employeeId:e.target.value}))}>
                  {employees.map(e=><MenuItem key={e.id} value={e.id}>{e.name} ({e.code})</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={3}>
              <FormControl fullWidth size="small">
                <InputLabel>เดือน</InputLabel>
                <Select value={editItem?.month??1} label="เดือน" onChange={e => setEditItem(f=>({...f!, month:Number(e.target.value)}))}>
                  {MONTH_TH.filter(Boolean).map((m,i)=><MenuItem key={i+1} value={i+1}>{m}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField size="small" label="ปี" type="number" fullWidth value={editItem?.year??2024} onChange={e=>setEditItem(f=>({...f!, year:Number(e.target.value)}))} />
            </Grid>

            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle2" gutterBottom>คะแนน KPI (60%): {editItem?.kpiScore}</Typography>
              <Slider value={editItem?.kpiScore??80} min={0} max={100} onChange={(_, v) => updateScore('kpiScore', v as number)} marks step={5} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle2" gutterBottom>คะแนนพฤติกรรม (40%): {editItem?.behaviorScore}</Typography>
              <Slider value={editItem?.behaviorScore??80} min={0} max={100} onChange={(_, v) => updateScore('behaviorScore', v as number)} marks step={5} />
            </Grid>

            <Grid item xs={6} textAlign="center">
              <Typography variant="caption" color="text.secondary">คะแนนรวม</Typography>
              <Typography variant="h3" fontWeight={700} sx={{ color: GRADE_COLOR[editItem?.grade??'B']??'#666' }}>{editItem?.overallScore}</Typography>
            </Grid>
            <Grid item xs={6} textAlign="center">
              <Typography variant="caption" color="text.secondary">เกรด</Typography>
              <Typography variant="h2" fontWeight={900} sx={{ color: GRADE_COLOR[editItem?.grade??'B']??'#666' }}>{editItem?.grade}</Typography>
            </Grid>

            <Grid item xs={12}>
              <TextField label="จุดแข็ง (Strengths)" multiline rows={2} fullWidth size="small" value={editItem?.strengths??''} onChange={e=>setEditItem(f=>({...f!, strengths:e.target.value}))} />
            </Grid>
            <Grid item xs={12}>
              <TextField label="จุดที่ต้องพัฒนา (Improvements)" multiline rows={2} fullWidth size="small" value={editItem?.improvements??''} onChange={e=>setEditItem(f=>({...f!, improvements:e.target.value}))} />
            </Grid>
            <Grid item xs={12}>
              <TextField label="เป้าหมายเดือนหน้า (Goals)" multiline rows={2} fullWidth size="small" value={editItem?.goals??''} onChange={e=>setEditItem(f=>({...f!, goals:e.target.value}))} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditItem(null)}>ยกเลิก</Button>
          <Button variant="contained" onClick={save} disabled={!editItem?.employeeId}>บันทึก</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
