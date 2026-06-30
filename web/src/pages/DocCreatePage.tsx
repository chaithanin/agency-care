import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Box, Typography, Paper, Button, TextField, Select, MenuItem, FormControl, InputLabel,
  Grid, Table, TableHead, TableRow, TableCell, TableBody, IconButton, Alert, CircularProgress,
  Divider, Chip, Accordion, AccordionSummary, AccordionDetails,
} from '@mui/material';
import { ArrowBack, Add, Delete, AutoAwesome, ExpandMore, Save } from '@mui/icons-material';
import { api, errMsg } from '../api/client';
import { useAuth } from '../auth/AuthContext';

const MONTH_TH = ['','มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
  'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

const DOC_TITLE: Record<string, string> = {
  sva: 'Site Visit Assignment', svr: 'Site Visit Completion Report', mpa: 'Monthly Performance Acknowledgement',
};

interface Employee { id: string; name: string; code: string; position: string; zone?: string }
interface User { id: string; name: string }
interface Agency { id: string; name: string; code: string; province?: string; level?: string }

interface ScheduleRow {
  visitDate: string; visitTime: string; agencyName: string; contactPerson: string;
  province: string; visitType: string; priority: string; note: string;
}

const VISIT_TYPES = ['site_visit','follow_up','training','new_agency'];
const VISIT_TYPE_TH: Record<string, string> = {
  site_visit: 'Site Visit', follow_up: 'Follow-up', training: 'Training', new_agency: 'New Agency',
};
const PRIORITIES = ['high','medium','low'];
const LEVELS = ['VIP','A','B','C','D'];

export default function DocCreatePage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  useAuth();
  const docType = (searchParams.get('type') ?? 'sva') as 'sva' | 'svr' | 'mpa';
  const isEdit = Boolean(id);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [generating, setGenerating] = useState(false);

  // Form state
  const [form, setForm] = useState({
    employeeId: '', supervisorId: '', closerId: '',
    month: new Date().getMonth() + 1, year: new Date().getFullYear(),
    companyName: 'บริษัท ทีทีจี โฮลดิ้ง จำกัด',
    kpiSiteVisit: '', kpiFollowup: '', kpiNewAgency: '', kpiTraining: '', kpiSales: '',
    notes: '',
    declaration: 'ข้าพเจ้ารับทราบแผนการปฏิบัติงาน Site Visit และจะดำเนินงานตามแผนที่ได้รับมอบหมาย',
  });

  // SVA schedule rows
  const [rows, setRows] = useState<ScheduleRow[]>([
    { visitDate: '', visitTime: '09:00', agencyName: '', contactPerson: '', province: '', visitType: 'site_visit', priority: 'medium', note: '' },
  ]);

  // AI generate: selected agencies with levels
  const [selectedAgencies, setSelectedAgencies] = useState<Array<{ id?: string; name: string; province: string; level: string; contactPerson: string }>>([]);
  const [docId, setDocId] = useState<string | null>(null);

  useEffect(() => {
    fetchEmployees();
    fetchUsers();
    fetchAgencies();
    if (isEdit && id) fetchDoc(id);
  }, [id]);

  const fetchEmployees = async () => {
    try { const r = await api.get<{ items: Employee[] }>('/employees?limit=200'); setEmployees(r.data.items ?? []); } catch { /* ignore */ }
  };
  const fetchUsers = async () => {
    try { const r = await api.get<{ items: User[] }>('/users?limit=200'); setUsers(r.data.items ?? []); } catch { /* ignore */ }
  };
  const fetchAgencies = async () => {
    try { const r = await api.get<{ items: Agency[] }>('/agencies?limit=500&status=active'); setAgencies(r.data.items ?? []); } catch { /* ignore */ }
  };
  const fetchDoc = async (docId: string) => {
    try {
      const r = await api.get<{ employeeId: string; supervisorId?: string; closerId?: string; month: number; year: number; companyName: string; kpiSiteVisit?: number; kpiFollowup?: number; kpiNewAgency?: number; kpiTraining?: number; kpiSales?: number; notes?: string; declaration?: string; rows: ScheduleRow[] }>(`/docs/${docId}`);
      const d = r.data;
      setForm({
        employeeId: d.employeeId, supervisorId: d.supervisorId ?? '', closerId: d.closerId ?? '',
        month: d.month, year: d.year, companyName: d.companyName,
        kpiSiteVisit: d.kpiSiteVisit?.toString() ?? '', kpiFollowup: d.kpiFollowup?.toString() ?? '',
        kpiNewAgency: d.kpiNewAgency?.toString() ?? '', kpiTraining: d.kpiTraining?.toString() ?? '',
        kpiSales: d.kpiSales?.toString() ?? '', notes: d.notes ?? '', declaration: d.declaration ?? '',
      });
      if (d.rows?.length) setRows(d.rows as ScheduleRow[]);
    } catch { setError('Failed to load data'); }
  };

  const setF = (k: string, v: string | number) => setForm(p => ({ ...p, [k]: v }));

  const addRow = () => setRows(p => [...p, { visitDate: '', visitTime: '09:00', agencyName: '', contactPerson: '', province: '', visitType: 'site_visit', priority: 'medium', note: '' }]);
  const removeRow = (i: number) => setRows(p => p.filter((_, idx) => idx !== i));
  const setRow = (i: number, k: string, v: string) => setRows(p => p.map((r, idx) => idx === i ? { ...r, [k]: v } : r));

  const handleSubmit = async () => {
    if (!form.employeeId || !form.month || !form.year) { setError('Please fill in all required fields'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        docType, ...form,
        month: Number(form.month), year: Number(form.year),
        kpiSiteVisit: form.kpiSiteVisit ? Number(form.kpiSiteVisit) : undefined,
        kpiFollowup: form.kpiFollowup ? Number(form.kpiFollowup) : undefined,
        kpiNewAgency: form.kpiNewAgency ? Number(form.kpiNewAgency) : undefined,
        kpiTraining: form.kpiTraining ? Number(form.kpiTraining) : undefined,
        kpiSales: form.kpiSales ? Number(form.kpiSales) : undefined,
        supervisorId: form.supervisorId || undefined,
        closerId: form.closerId || undefined,
      } as Record<string, unknown>;
      let newId: string;
      if (isEdit && id) {
        await api.patch(`/docs/${id}`, payload);
        newId = id;
      } else {
        const r = await api.post<{ id: string }>('/docs', payload);
        newId = r.data.id;
        setDocId(newId);
        // Add SVA schedule rows
        if (docType === 'sva') {
          for (const row of rows.filter(r => r.agencyName)) {
            await api.post(`/docs/${newId}/rows`, { rowType: 'schedule', ...row });
          }
        }
      }
      navigate(`/docs/${newId}`);
    } catch (e) { setError(errMsg(e)); }
    finally { setSaving(false); }
  };

  const addAgency = (ag: Agency) => {
    if (!selectedAgencies.find(a => a.id === ag.id)) {
      setSelectedAgencies(p => [...p, { id: ag.id, name: ag.name, province: ag.province ?? '', level: ag.level ?? 'C', contactPerson: '' }]);
    }
  };

  const generateSchedule = async () => {
    if (!docId && !isEdit) { setError('Please save the document first before generating a schedule'); return; }
    if (!selectedAgencies.length) { setError('Please select at least one Agency'); return; }
    setGenerating(true);
    try {
      const targetId = docId ?? id!;
      await api.post(`/docs/${targetId}/generate-schedule`, { agencies: selectedAgencies });
      navigate(`/docs/${targetId}`);
    } catch (e) { setError(errMsg(e)); }
    finally { setGenerating(false); }
  };

  return (
    <Box p={3} maxWidth={960} mx="auto">
      <Box display="flex" alignItems="center" gap={1} mb={3}>
        <IconButton onClick={() => navigate('/docs')}><ArrowBack /></IconButton>
        <Box>
          <Typography variant="h5" fontWeight={700}>{isEdit ? 'Edit' : 'Create'} {DOC_TITLE[docType]}</Typography>
          <Chip label={docType.toUpperCase()} size="small" variant="outlined" sx={{ mt: 0.5 }} />
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Basic Info */}
      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={700} mb={2}>Document Information</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField label="Company" value={form.companyName} onChange={e => setF('companyName', e.target.value)} fullWidth />
          </Grid>
          <Grid item xs={6} sm={3}>
            <FormControl fullWidth required>
              <InputLabel>Month</InputLabel>
              <Select value={form.month} label="Month" onChange={e => setF('month', e.target.value as number)}>
                {MONTH_TH.slice(1).map((m, i) => <MenuItem key={i + 1} value={i + 1}>{m}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField label="Year" type="number" value={form.year} onChange={e => setF('year', e.target.value)} fullWidth required />
          </Grid>
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth required>
              <InputLabel>Employee</InputLabel>
              <Select value={form.employeeId} label="Employee" onChange={e => setF('employeeId', e.target.value as string)}>
                {employees.map(e => <MenuItem key={e.id} value={e.id}>{e.name} ({e.code})</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth>
              <InputLabel>Supervisor</InputLabel>
              <Select value={form.supervisorId} label="Supervisor" onChange={e => setF('supervisorId', e.target.value as string)}>
                <MenuItem value="">— Not specified —</MenuItem>
                {users.map(u => <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth>
              <InputLabel>Closer</InputLabel>
              <Select value={form.closerId} label="Closer" onChange={e => setF('closerId', e.target.value as string)}>
                <MenuItem value="">— Not specified —</MenuItem>
                {users.map(u => <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* KPI */}
      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={700} mb={2}>Monthly KPI</Typography>
        <Grid container spacing={2}>
          {[['kpiSiteVisit','Site Visit (times)'],['kpiFollowup','Follow-up (times)'],
            ['kpiNewAgency','New Agency (count)'],['kpiTraining','Training (times)'],['kpiSales','Sales Target (฿)']].map(([k,l]) => (
            <Grid item xs={6} sm={4} md={2.4} key={k}>
              <TextField label={l} type="number" value={(form as Record<string,unknown>)[k] as string} onChange={e => setF(k, e.target.value)} fullWidth size="small" />
            </Grid>
          ))}
        </Grid>
      </Paper>

      {/* SVA: Schedule */}
      {docType === 'sva' && (
        <Paper sx={{ p: 3, mb: 2 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="subtitle1" fontWeight={700}>Schedule Plan</Typography>
            <Box display="flex" gap={1}>
              <Button size="small" startIcon={<Add />} onClick={addRow}>Add Row</Button>
            </Box>
          </Box>
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                  {['Date','Time','Agency','Contact Person','Province','Type','Priority','Notes',''].map(h => (
                    <TableCell key={h} sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell><TextField size="small" type="date" value={row.visitDate} onChange={e => setRow(i,'visitDate',e.target.value)} sx={{ width: 130 }} InputLabelProps={{ shrink: true }} /></TableCell>
                    <TableCell><TextField size="small" type="time" value={row.visitTime} onChange={e => setRow(i,'visitTime',e.target.value)} sx={{ width: 100 }} /></TableCell>
                    <TableCell><TextField size="small" value={row.agencyName} onChange={e => setRow(i,'agencyName',e.target.value)} sx={{ width: 140 }} /></TableCell>
                    <TableCell><TextField size="small" value={row.contactPerson} onChange={e => setRow(i,'contactPerson',e.target.value)} sx={{ width: 120 }} /></TableCell>
                    <TableCell><TextField size="small" value={row.province} onChange={e => setRow(i,'province',e.target.value)} sx={{ width: 110 }} /></TableCell>
                    <TableCell>
                      <Select size="small" value={row.visitType} onChange={e => setRow(i,'visitType',e.target.value)} sx={{ width: 120 }}>
                        {VISIT_TYPES.map(t => <MenuItem key={t} value={t}>{VISIT_TYPE_TH[t]}</MenuItem>)}
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select size="small" value={row.priority} onChange={e => setRow(i,'priority',e.target.value)} sx={{ width: 100 }}>
                        {PRIORITIES.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                      </Select>
                    </TableCell>
                    <TableCell><TextField size="small" value={row.note} onChange={e => setRow(i,'note',e.target.value)} sx={{ width: 120 }} /></TableCell>
                    <TableCell><IconButton size="small" onClick={() => removeRow(i)} disabled={rows.length === 1}><Delete fontSize="small" /></IconButton></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>

          {/* AI Generate Section */}
          <Divider sx={{ my: 3 }} />
          <Accordion variant="outlined">
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Box display="flex" alignItems="center" gap={1}>
                <AutoAwesome sx={{ color: '#7C3AED' }} />
                <Typography fontWeight={600}>AI Schedule Generator — Select agencies and let the system build the schedule</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Box mb={2}>
                <Typography variant="body2" color="text.secondary" mb={1}>Select agencies to visit:</Typography>
                <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
                  {agencies.slice(0, 50).map(ag => (
                    <Chip key={ag.id} label={`${ag.name} (${ag.level ?? 'C'})`} size="small"
                      onClick={() => addAgency(ag)}
                      color={selectedAgencies.find(a => a.id === ag.id) ? 'primary' : 'default'}
                      variant={selectedAgencies.find(a => a.id === ag.id) ? 'filled' : 'outlined'} />
                  ))}
                </Box>
                {selectedAgencies.length > 0 && (
                  <Box mb={2}>
                    <Typography variant="body2" mb={1} fontWeight={600}>Selected Agencies ({selectedAgencies.length}):</Typography>
                    {selectedAgencies.map((ag, i) => (
                      <Box key={i} display="flex" gap={1} mb={0.5} alignItems="center">
                        <Typography variant="body2" sx={{ minWidth: 160 }}>{ag.name}</Typography>
                        <Select size="small" value={ag.level} sx={{ width: 80 }} onChange={e => setSelectedAgencies(p => p.map((a, idx) => idx === i ? { ...a, level: e.target.value } : a))}>
                          {LEVELS.map(l => <MenuItem key={l} value={l}>{l}</MenuItem>)}
                        </Select>
                        <TextField size="small" placeholder="Province" value={ag.province} onChange={e => setSelectedAgencies(p => p.map((a, idx) => idx === i ? { ...a, province: e.target.value } : a))} sx={{ width: 120 }} />
                        <IconButton size="small" onClick={() => setSelectedAgencies(p => p.filter((_, idx) => idx !== i))}><Delete fontSize="small" /></IconButton>
                      </Box>
                    ))}
                  </Box>
                )}
                <Button variant="contained" startIcon={generating ? <CircularProgress size={16} color="inherit" /> : <AutoAwesome />}
                  onClick={generateSchedule} disabled={generating || !selectedAgencies.length}
                  sx={{ bgcolor: '#7C3AED', '&:hover': { bgcolor: '#6D28D9' } }}>
                  {generating ? 'Generating...' : 'AI Generate Schedule'}
                </Button>
              </Box>
            </AccordionDetails>
          </Accordion>
        </Paper>
      )}

      {/* Notes & Declaration */}
      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={700} mb={2}>Notes & Declaration</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField label="Notes" value={form.notes} onChange={e => setF('notes', e.target.value)} fullWidth multiline rows={3} />
          </Grid>
          <Grid item xs={12}>
            <TextField label="Declaration Text" value={form.declaration} onChange={e => setF('declaration', e.target.value)} fullWidth multiline rows={2} />
          </Grid>
        </Grid>
      </Paper>

      {/* Actions */}
      <Box display="flex" gap={2} justifyContent="flex-end">
        <Button variant="outlined" onClick={() => navigate('/docs')}>Cancel</Button>
        <Button variant="contained" startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />} onClick={handleSubmit} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </Box>
    </Box>
  );
}
