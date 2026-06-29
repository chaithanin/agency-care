import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent, Tabs, Tab, Button, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Select, MenuItem,
  FormControl, InputLabel, Chip, CircularProgress, Alert, Stack, Divider,
  Table, TableHead, TableBody, TableRow, TableCell, Tooltip,
  ToggleButton, ToggleButtonGroup, Autocomplete, Rating,
} from '@mui/material';
import {
  Add, CalendarMonth, ViewList, Dashboard as DashboardIcon,
  ChevronLeft, ChevronRight, Close, Business, Schedule, Person,
  MeetingRoom, Login as LoginIcon, Assignment, Edit, Refresh,
} from '@mui/icons-material';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';

// ─── Constants ───────────────────────────────────────────────────────────────

const MEETING_TYPES = [
  { key: 'project_presentation', label: 'Project Presentation', color: '#2563EB' },
  { key: 'orientation', label: 'Orientation', color: '#0891B2' },
  { key: 'agency_call', label: 'Call Agency', color: '#0D9488' },
  { key: 'visit_agency', label: 'We Visit Agency Office', color: '#16A34A' },
  { key: 'agency_visit_us', label: 'Agency Visit Us', color: '#7C3AED' },
  { key: 'sign_new_agency_contract', label: 'Sign New Agency Contract', color: '#DC2626' },
  { key: 'renew_contract', label: 'Renew Contract', color: '#9333EA' },
  { key: 'training', label: 'Training', color: '#D97706' },
  { key: 'follow_up', label: 'Follow-up', color: '#EA580C' },
  { key: 'contract', label: 'Contract', color: '#DC2626' },
  { key: 'marketing', label: 'Marketing', color: '#7C3AED' },
  { key: 'campaign', label: 'Campaign', color: '#9333EA' },
  { key: 'complaint', label: 'Complaint', color: '#BE123C' },
  { key: 'other', label: 'Other', color: '#64748B' },
];

const APPT_TYPES = [
  { key: 'showroom', label: 'Agency Visit Us' },
  { key: 'site_visit', label: 'We Visit Agency Office' },
  { key: 'call', label: 'Call' },
  { key: 'orientation', label: 'Orientation' },
  { key: 'contract', label: 'Contract' },
];

const MEETING_ROOMS = ['ห้องประชุม A', 'ห้องประชุม B', 'ห้องโชว์รูม 1', 'ห้องโชว์รูม 2', 'พื้นที่โชว์รูม'];

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending:    { label: 'รอยืนยัน',      color: '#D97706', bg: '#FEF3C7' },
  confirmed:  { label: 'ยืนยันแล้ว',    color: '#2563EB', bg: '#EFF6FF' },
  checked_in: { label: 'Check-in แล้ว', color: '#7C3AED', bg: '#F5F3FF' },
  completed:  { label: 'เสร็จสิ้น',     color: '#16A34A', bg: '#ECFDF5' },
  cancelled:  { label: 'ยกเลิก',        color: '#DC2626', bg: '#FEF2F2' },
  no_show:    { label: 'ไม่มาตามนัด',   color: '#6B7280', bg: '#F9FAFB' },
};

const DAY_ABBR = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
const MONTHS_TH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const SLOT_HEIGHT = 40;
const TIME_SLOTS = Array.from({ length: 28 }, (_, i) => {
  const h = Math.floor(i / 2) + 7;
  return `${String(h).padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}`;
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(d: Date) {
  return `${d.getDate()} ${MONTHS_TH[d.getMonth()]} ${d.getFullYear() + 543}`;
}
function fmtTime(isoStr?: string) {
  if (!isoStr) return '';
  try { return new Date(isoStr).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false }); } catch { return ''; }
}
function toBKKDate(d: Date) {
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' });
}
function makeBKK(date: string, time: string) {
  return `${date}T${time}:00+07:00`;
}
function getColor(apptType: string, meetingType?: string) {
  if (apptType === 'site_visit') return '#16A34A';
  return MEETING_TYPES.find(m => m.key === meetingType)?.color ?? '#2563EB';
}
function getMonthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: Date[] = [];
  for (let i = 0; i < startDay; i++) days.push(new Date(year, month, 1 - (startDay - i)));
  for (let d = 1; d <= daysInMonth; d++) days.push(new Date(year, month, d));
  while (days.length < 42) { const p = days[days.length - 1]; days.push(new Date(p.getFullYear(), p.getMonth(), p.getDate() + 1)); }
  return days;
}
function getWeekDays(date: Date): Date[] {
  const day = date.getDay();
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(date); d.setDate(date.getDate() - day + i); return d; });
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface CalendarEvent {
  id: string; sourceType: 'appointment' | 'site_visit';
  title: string; date: string; startTime?: string; endTime?: string;
  status: string; apptType: string; meetingType?: string;
  agencyId: string; agencyName: string; saleId?: string; saleName?: string;
  color: string; apptNo?: string; meetingRoom?: string;
}
interface Appointment {
  id: string; apptNo: string; status: string; apptType: string; meetingType: string;
  apptDate: string; startTime: string; endTime: string;
  agency: { id: string; name: string; code: string; phone?: string; type?: string; classification?: string; level?: string; tier?: string };
  sale?: { id: string; name: string };
  closer?: { id: string; name: string };
  createdBy?: { id: string; name: string };
  contactPerson?: string; contactPhone?: string; meetingRoom?: string;
  purpose?: string; participantIds?: string[]; notes?: string;
  checkInAt?: string; checkOutAt?: string; cancelReason?: string;
  receptionName?: string; meetingRoomActual?: string;
  report?: { topics?: string; promotions?: string; projects?: string; newLeads?: number; salesOpportunity?: string; interestScore?: number; nextApptDate?: string; remarks?: string };
}
interface DashboardData {
  total: number; confirmed: number; pending: number; cancelled: number;
  completed: number; noShow: number; todayItems: Appointment[];
}
interface AgencyOpt { id: string; name: string; code: string; phone?: string; managerName?: string; }
interface UserOpt { id: string; name: string; role: string; }

const blankForm = () => ({
  agencyId: '', agencyName: '', contactPerson: '', contactPhone: '',
  saleId: '', saleName: '', closerId: '', closerName: '',
  apptType: 'showroom', meetingType: 'project_presentation',
  meetingRoom: '', apptDate: toBKKDate(new Date()),
  startTime: '09:00', endTime: '10:00', purpose: '', notes: '',
});

// ─── Component ────────────────────────────────────────────────────────────────

export default function AppointmentPage() {
  const { user } = useAuth();
  const isAdmin = ['manager', 'super_admin', 'admin'].includes(user?.activeRole ?? '');
  const isCloser = ['manager', 'super_admin', 'admin', 'closer'].includes(user?.activeRole ?? '');

  const [view, setView] = useState<'dashboard' | 'calendar' | 'list'>('dashboard');
  const [calMode, setCalMode] = useState<'month' | 'week' | 'day'>('month');
  const [curDate, setCurDate] = useState(new Date());

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [apptTotal, setApptTotal] = useState(0);

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Appointment | null>(null);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const [form, setForm] = useState(blankForm());
  const [checkinForm, setCheckinForm] = useState({ receptionName: '', meetingRoomActual: '', notes: '' });
  const [reportForm, setReportForm] = useState({ topics: '', promotions: '', projects: '', newLeads: 0, salesOpportunity: '', interestScore: 3, nextApptDate: '', remarks: '' });

  const [filterStatus, setFilterStatus] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterSaleId, setFilterSaleId] = useState('');
  const [filterApptType, setFilterApptType] = useState('');
  const [filterMeetingType, setFilterMeetingType] = useState('');
  const [filterAgencyCategory, setFilterAgencyCategory] = useState('');

  const [agencyOpts, setAgencyOpts] = useState<AgencyOpt[]>([]);
  const [userOpts, setUserOpts] = useState<UserOpt[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try { const r = await api.get<DashboardData>('/appointments/dashboard'); setDashboard(r.data); } catch { /* ignore */ }
  }, []);

  const fetchEvents = useCallback(async () => {
    let from: Date, to: Date;
    if (calMode === 'month') { from = new Date(curDate.getFullYear(), curDate.getMonth(), 1); to = new Date(curDate.getFullYear(), curDate.getMonth() + 1, 0); }
    else if (calMode === 'week') { const w = getWeekDays(curDate); from = w[0]; to = w[6]; }
    else { from = to = curDate; }
    try {
      const r = await api.get<CalendarEvent[]>(`/appointments/calendar?from=${toBKKDate(from)}&to=${toBKKDate(to)}`);
      setEvents(r.data);
    } catch { /* ignore */ }
  }, [calMode, curDate]);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const p = new URLSearchParams({ limit: '50', offset: '0' });
      if (filterStatus) p.set('status', filterStatus);
      if (filterSearch) p.set('search', filterSearch);
      if (filterFrom) p.set('from', filterFrom);
      if (filterTo) p.set('to', filterTo);
      if (filterSaleId) p.set('saleId', filterSaleId);
      if (filterApptType) p.set('apptType', filterApptType);
      if (filterMeetingType) p.set('meetingType', filterMeetingType);
      if (filterAgencyCategory) p.set('agencyCategory', filterAgencyCategory);
      const r = await api.get<{ total: number; items: Appointment[] }>(`/appointments?${p}`);
      setAppts(r.data.items);
      setApptTotal(r.data.total);
    } catch { setError('โหลดข้อมูลไม่สำเร็จ'); }
    finally { setLoading(false); }
  }, [filterStatus, filterSearch, filterFrom, filterTo, filterSaleId, filterApptType, filterMeetingType, filterAgencyCategory]);

  const fetchDetail = useCallback(async (id: string) => {
    try { const r = await api.get<Appointment>(`/appointments/${id}`); setDetail(r.data); } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);
  useEffect(() => { if (view === 'calendar') fetchEvents(); }, [view, fetchEvents]);
  useEffect(() => { if (view === 'list') fetchList(); }, [view, fetchList]);
  useEffect(() => { if (detailId) fetchDetail(detailId); }, [detailId, fetchDetail]);

  const searchAgencies = useCallback(async (q: string) => {
    if (q.length < 1) return;
    try {
      const r = await api.get<{ items: AgencyOpt[] }>(`/agencies?search=${encodeURIComponent(q)}&limit=10`);
      setAgencyOpts(r.data.items);
    } catch { /* ignore */ }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const r = await api.get<{ users: UserOpt[] }>('/users?limit=200');
      setUserOpts(r.data.users);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { if (addOpen || editOpen || view === 'list') loadUsers(); }, [addOpen, editOpen, view, loadUsers]);

  const clearListFilters = () => {
    setFilterStatus('');
    setFilterSearch('');
    setFilterFrom('');
    setFilterTo('');
    setFilterSaleId('');
    setFilterApptType('');
    setFilterMeetingType('');
    setFilterAgencyCategory('');
  };

  const handleCreate = async () => {
    if (!form.agencyId || !form.apptDate) return;
    setSaving(true);
    try {
      await api.post('/appointments', {
        ...form,
        startTime: makeBKK(form.apptDate, form.startTime),
        endTime: makeBKK(form.apptDate, form.endTime),
      });
      setAddOpen(false);
      setForm(blankForm());
      fetchDashboard(); fetchEvents(); if (view === 'list') fetchList();
    } catch (e: any) { setError(e.response?.data?.message ?? 'สร้างนัดหมายไม่สำเร็จ'); }
    finally { setSaving(false); }
  };

  const handleUpdate = async () => {
    if (!detail) return;
    setSaving(true);
    try {
      await api.patch(`/appointments/${detail.id}`, {
        ...form,
        startTime: makeBKK(form.apptDate, form.startTime),
        endTime: makeBKK(form.apptDate, form.endTime),
      });
      setEditOpen(false);
      fetchDetail(detail.id); fetchDashboard(); fetchEvents();
    } catch { setError('บันทึกไม่สำเร็จ'); }
    finally { setSaving(false); }
  };

  const handleAction = async (action: string, data?: any) => {
    if (!detail) return;
    setSaving(true);
    try {
      await api.post(`/appointments/${detail.id}/${action}`, data ?? {});
      fetchDetail(detail.id); fetchDashboard(); fetchEvents();
    } catch { setError('ดำเนินการไม่สำเร็จ'); }
    finally { setSaving(false); }
  };

  const handleCheckin = async () => { await handleAction('check-in', checkinForm); setCheckinOpen(false); };

  const handleReport = async () => {
    if (!detail) return;
    setSaving(true);
    try {
      await api.post(`/appointments/${detail.id}/report`, {
        ...reportForm,
        nextApptDate: reportForm.nextApptDate ? makeBKK(reportForm.nextApptDate, '09:00') : null,
      });
      setReportOpen(false);
      fetchDetail(detail.id);
    } catch { setError('บันทึก Report ไม่สำเร็จ'); }
    finally { setSaving(false); }
  };

  const openEdit = () => {
    if (!detail) return;
    setForm({
      agencyId: detail.agency.id, agencyName: detail.agency.name,
      contactPerson: detail.contactPerson ?? '', contactPhone: detail.contactPhone ?? '',
      saleId: detail.sale?.id ?? '', saleName: detail.sale?.name ?? '',
      closerId: detail.closer?.id ?? '', closerName: detail.closer?.name ?? '',
      apptType: detail.apptType, meetingType: detail.meetingType,
      meetingRoom: detail.meetingRoom ?? '',
      apptDate: new Date(detail.startTime).toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' }),
      startTime: fmtTime(detail.startTime),
      endTime: fmtTime(detail.endTime),
      purpose: detail.purpose ?? '', notes: detail.notes ?? '',
    });
    setEditOpen(true);
  };

  const navigate = (dir: -1 | 1) => {
    const d = new Date(curDate);
    if (calMode === 'month') d.setMonth(d.getMonth() + dir);
    else if (calMode === 'week') d.setDate(d.getDate() + dir * 7);
    else d.setDate(d.getDate() + dir);
    setCurDate(d);
  };

  const eventsOnDate = (dateStr: string) => events.filter(e => e.date === dateStr);

  const StatusChip = ({ s }: { s: string }) => {
    const st = STATUS[s] ?? { label: s, color: '#6B7280', bg: '#F9FAFB' };
    return <Chip label={st.label} size="small" sx={{ bgcolor: st.bg, color: st.color, fontWeight: 600, border: `1px solid ${st.color}40` }} />;
  };

  const EventChip = ({ ev }: { ev: CalendarEvent }) => (
    <Box
      onClick={e => { e.stopPropagation(); if (ev.sourceType === 'appointment') { setDetailId(ev.id); setDetail(null); } }}
      sx={{ bgcolor: ev.color, color: '#fff', borderRadius: 0.5, px: 0.5, py: 0.15, mb: 0.25, fontSize: 10, fontWeight: 600, cursor: 'pointer', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', '&:hover': { opacity: 0.85 } }}
    >
      {ev.startTime && `${ev.startTime} `}{ev.title}
    </Box>
  );

  const FormDialog = ({ open, title, onClose, onSave }: { open: boolean; title: string; onClose: () => void; onSave: () => void }) => (
    <Dialog open={open} maxWidth="md" fullWidth onClose={onClose}>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography fontWeight={700}>{title}</Typography>
          <IconButton onClick={onClose}><Close /></IconButton>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2} mt={0}>
          <Grid item xs={12} sm={8}>
            <Autocomplete
              freeSolo options={agencyOpts}
              getOptionLabel={o => typeof o === 'string' ? o : `${o.name} (${o.code})`}
              inputValue={form.agencyName}
              onInputChange={(_, v) => { setForm(f => ({ ...f, agencyName: v })); searchAgencies(v); }}
              onChange={(_, v) => {
                if (v && typeof v !== 'string') {
                  setForm(f => ({ ...f, agencyId: v.id, agencyName: v.name, contactPerson: v.managerName ?? f.contactPerson, contactPhone: v.phone ?? f.contactPhone }));
                }
              }}
              renderInput={p => <TextField {...p} label="Agency *" size="small" fullWidth />}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <FormControl size="small" fullWidth>
              <InputLabel>ประเภทนัด</InputLabel>
              <Select value={form.apptType} label="Appointment type" onChange={e => setForm(f => ({ ...f, apptType: e.target.value }))}>
                {APPT_TYPES.map(t => <MenuItem key={t.key} value={t.key}>{t.label}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField size="small" fullWidth label="ผู้ติดต่อ" value={form.contactPerson} onChange={e => setForm(f => ({ ...f, contactPerson: e.target.value }))} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField size="small" fullWidth label="เบอร์โทร" value={form.contactPhone} onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField size="small" fullWidth label="วันที่ *" type="date" value={form.apptDate} onChange={e => setForm(f => ({ ...f, apptDate: e.target.value }))} InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField size="small" fullWidth label="เวลาเริ่ม" type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} InputLabelProps={{ shrink: true }} inputProps={{ step: 900 }} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField size="small" fullWidth label="เวลาสิ้นสุด" type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} InputLabelProps={{ shrink: true }} inputProps={{ step: 900 }} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl size="small" fullWidth>
              <InputLabel>ประเภทการประชุม</InputLabel>
              <Select value={form.meetingType} label="ประเภทการประชุม" onChange={e => setForm(f => ({ ...f, meetingType: e.target.value }))}>
                {MEETING_TYPES.map(m => <MenuItem key={m.key} value={m.key}>{m.label}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl size="small" fullWidth>
              <InputLabel>ห้องประชุม</InputLabel>
              <Select value={form.meetingRoom} label="ห้องประชุม" onChange={e => setForm(f => ({ ...f, meetingRoom: e.target.value }))}>
                <MenuItem value="">—</MenuItem>
                {MEETING_ROOMS.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Autocomplete
              options={userOpts} getOptionLabel={o => o.name}
              value={userOpts.find(u => u.id === form.saleId) ?? null}
              onChange={(_, v) => setForm(f => ({ ...f, saleId: v?.id ?? '', saleName: v?.name ?? '' }))}
              renderInput={p => <TextField {...p} label="Sale" size="small" fullWidth />}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Autocomplete
              options={userOpts} getOptionLabel={o => o.name}
              value={userOpts.find(u => u.id === form.closerId) ?? null}
              onChange={(_, v) => setForm(f => ({ ...f, closerId: v?.id ?? '', closerName: v?.name ?? '' }))}
              renderInput={p => <TextField {...p} label="Closer (ไม่บังคับ)" size="small" fullWidth />}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField size="small" fullWidth label="วัตถุประสงค์" value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} />
          </Grid>
          <Grid item xs={12}>
            <TextField size="small" fullWidth label="หมายเหตุ" value={form.notes} multiline rows={2} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>ยกเลิก</Button>
        <Button variant="contained" onClick={onSave} disabled={saving || !form.agencyId}>
          {saving ? <CircularProgress size={20} /> : 'บันทึก'}
        </Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <Box p={3}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Activity Calendar</Typography>
          <Typography variant="body2" color="text.secondary">ปฏิทินกิจกรรมรวม · Showroom Appointment · Site Visit</Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => { setForm(blankForm()); setAddOpen(true); }}>นัดหมายใหม่</Button>
      </Box>

      {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}

      {/* Tabs */}
      <Paper sx={{ mb: 2 }}>
        <Tabs value={view} onChange={(_, v) => setView(v)} sx={{ borderBottom: '1px solid #E2E8F0', px: 2 }}>
          <Tab value="dashboard" label="Dashboard" icon={<DashboardIcon />} iconPosition="start" />
          <Tab value="calendar" label="ปฏิทิน" icon={<CalendarMonth />} iconPosition="start" />
          <Tab value="list" label="รายการทั้งหมด" icon={<ViewList />} iconPosition="start" />
        </Tabs>
      </Paper>

      {/* ── DASHBOARD ── */}
      {view === 'dashboard' && (
        <Box>
          {dashboard ? (
            <>
              <Grid container spacing={2} mb={3}>
                {[
                  { label: 'นัดหมายวันนี้', value: dashboard.total,     color: '#4F46E5' },
                  { label: 'ยืนยันแล้ว',   value: dashboard.confirmed, color: '#2563EB' },
                  { label: 'รอยืนยัน',     value: dashboard.pending,   color: '#D97706' },
                  { label: 'เสร็จสิ้น',    value: dashboard.completed, color: '#16A34A' },
                  { label: 'ไม่มาตามนัด', value: dashboard.noShow,    color: '#6B7280' },
                  { label: 'ยกเลิก',       value: dashboard.cancelled, color: '#DC2626' },
                ].map(k => (
                  <Grid item xs={6} sm={4} md={2} key={k.label}>
                    <Card variant="outlined" sx={{ borderTop: `3px solid ${k.color}` }}>
                      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                        <Typography variant="caption" color="text.secondary" display="block">{k.label}</Typography>
                        <Typography variant="h4" fontWeight={700} sx={{ color: k.color }}>{k.value}</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>

              <Paper variant="outlined" sx={{ p: 2 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="subtitle1" fontWeight={700}>📅 วันนี้ — {fmtDate(new Date())}</Typography>
                  <IconButton size="small" onClick={fetchDashboard}><Refresh /></IconButton>
                </Box>
                {dashboard.todayItems.length === 0 ? (
                  <Typography color="text.secondary">ไม่มีนัดหมายวันนี้</Typography>
                ) : (
                  <Stack spacing={1.5}>
                    {dashboard.todayItems.map(a => (
                      <Box key={a.id} display="flex" gap={2} alignItems="flex-start"
                        sx={{ p: 1.5, border: '1px solid #E2E8F0', borderRadius: 1, cursor: 'pointer', '&:hover': { bgcolor: '#F8FAFC' } }}
                        onClick={() => { setDetailId(a.id); setDetail(null); }}>
                        <Box sx={{ bgcolor: getColor(a.apptType, a.meetingType), color: '#fff', borderRadius: 1, px: 1.5, py: 0.75, minWidth: 90, textAlign: 'center', flexShrink: 0 }}>
                          <Typography variant="body2" fontWeight={700}>{fmtTime(a.startTime)}</Typography>
                          <Typography variant="caption">{fmtTime(a.endTime)}</Typography>
                        </Box>
                        <Box flex={1}>
                          <Typography fontWeight={700}>{a.agency?.name}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {a.apptNo} · {MEETING_TYPES.find(m => m.key === a.meetingType)?.label ?? a.meetingType}
                            {a.meetingRoom && ` · ${a.meetingRoom}`}
                          </Typography>
                          {a.sale && <Typography variant="caption" color="text.secondary">Sale: {a.sale.name}{a.closer && ` · Closer: ${a.closer.name}`}</Typography>}
                        </Box>
                        <StatusChip s={a.status} />
                      </Box>
                    ))}
                  </Stack>
                )}
              </Paper>
            </>
          ) : (
            <Box textAlign="center" py={8}><CircularProgress /></Box>
          )}
        </Box>
      )}

      {/* ── CALENDAR ── */}
      {view === 'calendar' && (
        <Box>
          {/* Nav */}
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Box display="flex" alignItems="center" gap={1}>
              <IconButton onClick={() => navigate(-1)}><ChevronLeft /></IconButton>
              <Typography variant="h6" fontWeight={700} minWidth={240} textAlign="center">
                {calMode === 'month' && `${MONTHS_TH[curDate.getMonth()]} ${curDate.getFullYear() + 543}`}
                {calMode === 'week' && (() => { const w = getWeekDays(curDate); return `${fmtDate(w[0])} — ${fmtDate(w[6])}`; })()}
                {calMode === 'day' && fmtDate(curDate)}
              </Typography>
              <IconButton onClick={() => navigate(1)}><ChevronRight /></IconButton>
              <Button size="small" variant="outlined" onClick={() => setCurDate(new Date())}>วันนี้</Button>
            </Box>
            <Box display="flex" gap={1} alignItems="center">
              <ToggleButtonGroup value={calMode} exclusive onChange={(_, v) => v && setCalMode(v)} size="small">
                <ToggleButton value="month">เดือน</ToggleButton>
                <ToggleButton value="week">สัปดาห์</ToggleButton>
                <ToggleButton value="day">วัน</ToggleButton>
              </ToggleButtonGroup>
              <IconButton size="small" onClick={fetchEvents}><Refresh /></IconButton>
            </Box>
          </Box>

          {/* Legend */}
          <Box display="flex" gap={1} flexWrap="wrap" mb={1.5}>
            {[['#16A34A','🚗 Site Visit'],['#2563EB','🏢 Showroom'],['#D97706','🎓 Training'],['#DC2626','📝 Contract'],['#7C3AED','📣 Marketing'],['#EA580C','🔄 Follow-up']].map(([c,l])=>
              <Chip key={l} size="small" label={l} sx={{ bgcolor: c, color: '#fff', fontWeight: 600, fontSize: 11 }} />
            )}
          </Box>

          {/* Month View */}
          {calMode === 'month' && (
            <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
              <Box display="grid" gridTemplateColumns="repeat(7, 1fr)" sx={{ borderBottom: '1px solid #E2E8F0' }}>
                {DAY_ABBR.map(d => <Box key={d} sx={{ p: 1, textAlign: 'center', fontWeight: 700, fontSize: 12, bgcolor: '#F8FAFC' }}>{d}</Box>)}
              </Box>
              <Box display="grid" gridTemplateColumns="repeat(7, 1fr)">
                {getMonthGrid(curDate.getFullYear(), curDate.getMonth()).map((day, i) => {
                  const ds = toBKKDate(day);
                  const dayEvts = eventsOnDate(ds);
                  const isToday = ds === toBKKDate(new Date());
                  const isCur = day.getMonth() === curDate.getMonth();
                  return (
                    <Box key={i} sx={{ minHeight: 90, p: 0.5, borderRight: '1px solid #E2E8F0', borderBottom: '1px solid #E2E8F0', bgcolor: isToday ? '#EFF6FF' : 'transparent', opacity: isCur ? 1 : 0.4 }}>
                      <Typography variant="caption" fontWeight={isToday ? 700 : 400} sx={{ display: 'block', mb: 0.25, color: isToday ? 'primary.main' : 'text.primary' }}>
                        {day.getDate()}
                      </Typography>
                      {dayEvts.slice(0, 3).map(ev => <EventChip key={ev.id} ev={ev} />)}
                      {dayEvts.length > 3 && <Typography variant="caption" color="text.secondary">+{dayEvts.length - 3}</Typography>}
                    </Box>
                  );
                })}
              </Box>
            </Paper>
          )}

          {/* Week View */}
          {calMode === 'week' && (
            <Paper variant="outlined" sx={{ overflow: 'auto' }}>
              <Box display="flex" minWidth={700}>
                <Box sx={{ width: 56, flexShrink: 0, borderRight: '1px solid #E2E8F0' }}>
                  <Box sx={{ height: 52, borderBottom: '1px solid #E2E8F0' }} />
                  {TIME_SLOTS.map(ts => (
                    <Box key={ts} sx={{ height: SLOT_HEIGHT, borderBottom: '1px solid #F1F5F9', px: 0.5, display: 'flex', alignItems: 'flex-start', pt: 0.25 }}>
                      {ts.endsWith('00') && <Typography sx={{ fontSize: 10 }} color="text.secondary">{ts}</Typography>}
                    </Box>
                  ))}
                </Box>
                {getWeekDays(curDate).map((day, di) => {
                  const ds = toBKKDate(day);
                  const dayEvts = eventsOnDate(ds).filter(e => e.startTime);
                  const isToday = ds === toBKKDate(new Date());
                  return (
                    <Box key={di} sx={{ flex: 1, borderRight: '1px solid #E2E8F0', minWidth: 90 }}>
                      <Box sx={{ height: 52, borderBottom: '1px solid #E2E8F0', textAlign: 'center', p: 0.5, bgcolor: isToday ? '#EFF6FF' : '#F8FAFC' }}>
                        <Typography variant="caption" display="block">{DAY_ABBR[di]}</Typography>
                        <Typography fontWeight={isToday ? 700 : 400} color={isToday ? 'primary' : 'text.primary'} sx={{ fontSize: 15 }}>{day.getDate()}</Typography>
                      </Box>
                      <Box sx={{ position: 'relative', height: TIME_SLOTS.length * SLOT_HEIGHT }}>
                        {TIME_SLOTS.map((_, si) => <Box key={si} sx={{ height: SLOT_HEIGHT, borderBottom: '1px solid #F1F5F9' }} />)}
                        {dayEvts.map(ev => {
                          const [sh, sm] = (ev.startTime ?? '07:00').split(':').map(Number);
                          const [eh, em] = (ev.endTime ?? '08:00').split(':').map(Number);
                          const topPx = ((sh - 7) * 2 + (sm >= 30 ? 1 : 0)) * SLOT_HEIGHT;
                          const hPx = Math.max(((eh - 7) * 2 + (em >= 30 ? 1 : 0) - ((sh - 7) * 2 + (sm >= 30 ? 1 : 0))) * SLOT_HEIGHT, SLOT_HEIGHT);
                          return (
                            <Box key={ev.id} onClick={() => { if (ev.sourceType === 'appointment') { setDetailId(ev.id); setDetail(null); } }}
                              sx={{ position: 'absolute', top: topPx, left: 2, right: 2, height: hPx, bgcolor: ev.color, color: '#fff', borderRadius: 0.5, p: 0.5, fontSize: 11, fontWeight: 600, overflow: 'hidden', cursor: 'pointer', '&:hover': { opacity: 0.85 }, zIndex: 1 }}>
                              {ev.startTime} {ev.title}
                            </Box>
                          );
                        })}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Paper>
          )}

          {/* Day View */}
          {calMode === 'day' && (
            <Paper variant="outlined" sx={{ overflow: 'auto' }}>
              <Box display="flex" minWidth={320}>
                <Box sx={{ width: 56, flexShrink: 0, borderRight: '1px solid #E2E8F0' }}>
                  <Box sx={{ height: 52, borderBottom: '1px solid #E2E8F0' }} />
                  {TIME_SLOTS.map(ts => (
                    <Box key={ts} sx={{ height: SLOT_HEIGHT, borderBottom: '1px solid #F1F5F9', px: 0.5, display: 'flex', alignItems: 'flex-start', pt: 0.25 }}>
                      {ts.endsWith('00') && <Typography sx={{ fontSize: 10 }} color="text.secondary">{ts}</Typography>}
                    </Box>
                  ))}
                </Box>
                <Box flex={1}>
                  <Box sx={{ height: 52, borderBottom: '1px solid #E2E8F0', p: 1, textAlign: 'center', bgcolor: '#EFF6FF' }}>
                    <Typography fontWeight={700}>{fmtDate(curDate)}</Typography>
                  </Box>
                  <Box sx={{ position: 'relative', height: TIME_SLOTS.length * SLOT_HEIGHT }}>
                    {TIME_SLOTS.map((_, si) => <Box key={si} sx={{ height: SLOT_HEIGHT, borderBottom: '1px solid #F1F5F9' }} />)}
                    {eventsOnDate(toBKKDate(curDate)).filter(e => e.startTime).map(ev => {
                      const [sh, sm] = (ev.startTime ?? '07:00').split(':').map(Number);
                      const [eh, em] = (ev.endTime ?? '08:00').split(':').map(Number);
                      const topPx = ((sh - 7) * 2 + (sm >= 30 ? 1 : 0)) * SLOT_HEIGHT;
                      const hPx = Math.max(((eh - 7) * 2 + (em >= 30 ? 1 : 0) - ((sh - 7) * 2 + (sm >= 30 ? 1 : 0))) * SLOT_HEIGHT, SLOT_HEIGHT);
                      return (
                        <Box key={ev.id} onClick={() => { if (ev.sourceType === 'appointment') { setDetailId(ev.id); setDetail(null); } }}
                          sx={{ position: 'absolute', top: topPx, left: 4, right: 4, height: hPx, bgcolor: ev.color, color: '#fff', borderRadius: 0.5, p: 1, cursor: 'pointer', '&:hover': { opacity: 0.85 }, zIndex: 1 }}>
                          <Typography variant="body2" fontWeight={700}>{ev.title}</Typography>
                          <Typography variant="caption">{ev.startTime}–{ev.endTime}{ev.meetingRoom && ` · ${ev.meetingRoom}`}</Typography>
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              </Box>
            </Paper>
          )}
        </Box>
      )}

      {/* ── LIST ── */}
      {view === 'list' && (
        <Box>
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Box display="flex" gap={1.5} flexWrap="wrap" alignItems="center">
              <TextField size="small" placeholder="Search agency, seller, contact, phone, note..." value={filterSearch}
                onChange={e => setFilterSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchList()}
                sx={{ minWidth: 260 }} />
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Status</InputLabel>
                <Select value={filterStatus} label="Status" onChange={e => setFilterStatus(e.target.value)}>
                  <MenuItem value="">All status</MenuItem>
                  {Object.entries(STATUS).map(([k, v]) => <MenuItem key={k} value={k}>{v.label}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Seller</InputLabel>
                <Select value={filterSaleId} label="Seller" onChange={e => setFilterSaleId(e.target.value)}>
                  <MenuItem value="">All sellers</MenuItem>
                  {userOpts.map(u => <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 170 }}>
                <InputLabel>Appointment</InputLabel>
                <Select value={filterApptType} label="Appointment" onChange={e => setFilterApptType(e.target.value)}>
                  <MenuItem value="">All appointments</MenuItem>
                  {APPT_TYPES.map(t => <MenuItem key={t.key} value={t.key}>{t.label}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 210 }}>
                <InputLabel>Activity / Result</InputLabel>
                <Select value={filterMeetingType} label="Activity / Result" onChange={e => setFilterMeetingType(e.target.value)}>
                  <MenuItem value="">All activity types</MenuItem>
                  {MEETING_TYPES.map(m => <MenuItem key={m.key} value={m.key}>{m.label}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField size="small" label="Agency category" placeholder="type, tier, level..."
                value={filterAgencyCategory} onChange={e => setFilterAgencyCategory(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchList()} sx={{ minWidth: 180 }} />
              <TextField size="small" label="From" type="date" value={filterFrom}
                onChange={e => setFilterFrom(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 150 }} />
              <TextField size="small" label="To" type="date" value={filterTo}
                onChange={e => setFilterTo(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 150 }} />
              <Button variant="contained" size="small" onClick={fetchList}>Search</Button>
              <Button variant="text" size="small" onClick={clearListFilters}>Clear</Button>
              <IconButton size="small" onClick={fetchList}><Refresh /></IconButton>
            </Box>
          </Paper>
          <Paper>
            {loading ? <Box p={6} textAlign="center"><CircularProgress /></Box> : (
              <>
                <Box px={2} py={1}><Typography variant="caption" color="text.secondary">ทั้งหมด {apptTotal} รายการ</Typography></Box>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                      {['เลขที่','วันที่','เวลา','Agency','ประเภท','ห้อง','Sale','สถานะ',''].map(h => (
                        <TableCell key={h} sx={{ fontWeight: 700 }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {appts.length === 0 ? (
                      <TableRow><TableCell colSpan={9} align="center" sx={{ py: 6, color: 'text.secondary' }}>ไม่มีนัดหมาย</TableCell></TableRow>
                    ) : appts.map(a => (
                      <TableRow key={a.id} hover sx={{ cursor: 'pointer' }} onClick={() => { setDetailId(a.id); setDetail(null); }}>
                        <TableCell><Typography variant="body2" fontWeight={700} color="primary">{a.apptNo}</Typography></TableCell>
                        <TableCell><Typography variant="body2">{new Date(a.apptDate).toLocaleDateString('th-TH')}</Typography></TableCell>
                        <TableCell><Typography variant="body2">{fmtTime(a.startTime)}–{fmtTime(a.endTime)}</Typography></TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>{a.agency?.name}</Typography>
                          <Typography variant="caption" color="text.secondary">{a.agency?.code}</Typography>
                          {(a.agency?.type || a.agency?.classification || a.agency?.tier || a.agency?.level) && (
                            <Typography variant="caption" color="text.secondary" display="block">
                              {[a.agency?.type, a.agency?.classification, a.agency?.tier, a.agency?.level].filter(Boolean).join(' / ')}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip label={MEETING_TYPES.find(m => m.key === a.meetingType)?.label ?? a.meetingType}
                            size="small" sx={{ bgcolor: getColor(a.apptType, a.meetingType), color: '#fff', fontWeight: 600 }} />
                        </TableCell>
                        <TableCell><Typography variant="body2">{a.meetingRoom ?? '—'}</Typography></TableCell>
                        <TableCell><Typography variant="body2">{a.sale?.name ?? '—'}</Typography></TableCell>
                        <TableCell><StatusChip s={a.status} /></TableCell>
                        <TableCell><Tooltip title="รายละเอียด"><IconButton size="small"><Assignment /></IconButton></Tooltip></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </Paper>
        </Box>
      )}

      {/* ── ADD/EDIT DIALOGS ── */}
      <FormDialog open={addOpen} title="สร้างนัดหมายใหม่" onClose={() => setAddOpen(false)} onSave={handleCreate} />
      <FormDialog open={editOpen} title="แก้ไขนัดหมาย" onClose={() => setEditOpen(false)} onSave={handleUpdate} />

      {/* ── DETAIL DIALOG ── */}
      {detailId && (
        <Dialog open maxWidth="sm" fullWidth onClose={() => { setDetailId(null); setDetail(null); }}>
          <DialogTitle>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Box display="flex" alignItems="center" gap={1}>
                <Typography fontWeight={700}>{detail?.apptNo ?? '...'}</Typography>
                {detail && <StatusChip s={detail.status} />}
              </Box>
              <IconButton onClick={() => { setDetailId(null); setDetail(null); }}><Close /></IconButton>
            </Box>
          </DialogTitle>
          {!detail ? (
            <DialogContent><Box p={4} textAlign="center"><CircularProgress /></Box></DialogContent>
          ) : (
            <>
              <DialogContent dividers>
                <Stack spacing={1.5}>
                  <Box display="flex" gap={1} alignItems="center">
                    <Business sx={{ color: 'text.secondary', fontSize: 20 }} />
                    <Box>
                      <Typography fontWeight={700}>{detail.agency?.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{detail.agency?.code}</Typography>
                      {(detail.agency?.type || detail.agency?.classification || detail.agency?.tier || detail.agency?.level) && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          {[detail.agency?.type, detail.agency?.classification, detail.agency?.tier, detail.agency?.level].filter(Boolean).join(' / ')}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                  <Box display="flex" gap={1} alignItems="center">
                    <Schedule sx={{ color: 'text.secondary', fontSize: 20 }} />
                    <Typography variant="body2">
                      {new Date(detail.apptDate).toLocaleDateString('th-TH', { dateStyle: 'long', timeZone: 'Asia/Bangkok' })} · {fmtTime(detail.startTime)} – {fmtTime(detail.endTime)}
                    </Typography>
                  </Box>
                  {detail.meetingRoom && (
                    <Box display="flex" gap={1} alignItems="center">
                      <MeetingRoom sx={{ color: 'text.secondary', fontSize: 20 }} />
                      <Typography variant="body2">{detail.meetingRoom}</Typography>
                    </Box>
                  )}
                  {detail.contactPerson && (
                    <Box display="flex" gap={1} alignItems="center">
                      <Person sx={{ color: 'text.secondary', fontSize: 20 }} />
                      <Typography variant="body2">{detail.contactPerson}{detail.contactPhone && ` (${detail.contactPhone})`}</Typography>
                    </Box>
                  )}
                  <Divider />
                  <Box display="flex" gap={1} flexWrap="wrap">
                    <Chip label={APPT_TYPES.find(t => t.key === detail.apptType)?.label ?? detail.apptType}
                      size="small" variant="outlined" />
                    <Chip label={MEETING_TYPES.find(m => m.key === detail.meetingType)?.label ?? detail.meetingType}
                      size="small" sx={{ bgcolor: getColor(detail.apptType, detail.meetingType), color: '#fff' }} />
                    {detail.sale && <Chip label={`Sale: ${detail.sale.name}`} size="small" variant="outlined" />}
                    {detail.closer && <Chip label={`Closer: ${detail.closer.name}`} size="small" variant="outlined" />}
                  </Box>
                  {detail.purpose && <Typography variant="body2"><strong>วัตถุประสงค์:</strong> {detail.purpose}</Typography>}
                  {detail.checkInAt && (
                    <Alert severity="success" sx={{ py: 0.5 }}>
                      Check-in: {new Date(detail.checkInAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}
                      {detail.receptionName && ` · ผู้รับ: ${detail.receptionName}`}
                      {detail.meetingRoomActual && ` · ${detail.meetingRoomActual}`}
                    </Alert>
                  )}
                  {detail.report && (
                    <Paper variant="outlined" sx={{ p: 1.5 }}>
                      <Typography variant="subtitle2" fontWeight={700} mb={1}>📋 Meeting Report</Typography>
                      {detail.report.interestScore != null && (
                        <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                          <Typography variant="caption">ความสนใจ:</Typography>
                          <Rating value={detail.report.interestScore} max={5} readOnly size="small" />
                        </Box>
                      )}
                      {detail.report.topics && <Typography variant="body2"><strong>หัวข้อ:</strong> {detail.report.topics}</Typography>}
                      {!!detail.report.newLeads && <Typography variant="body2"><strong>New Leads:</strong> {detail.report.newLeads}</Typography>}
                      {detail.report.salesOpportunity && <Typography variant="body2"><strong>โอกาสขาย:</strong> {detail.report.salesOpportunity}</Typography>}
                      {detail.report.remarks && <Typography variant="body2"><strong>หมายเหตุ:</strong> {detail.report.remarks}</Typography>}
                    </Paper>
                  )}
                </Stack>
              </DialogContent>
              <DialogActions sx={{ flexWrap: 'wrap', gap: 0.5, p: 1.5 }}>
                {isAdmin && detail.status === 'pending' && (
                  <Button size="small" variant="outlined" color="primary" onClick={() => handleAction('confirm')} disabled={saving}>✅ Confirm</Button>
                )}
                {['pending', 'confirmed'].includes(detail.status) && (
                  <Button size="small" variant="outlined" color="secondary" startIcon={<LoginIcon />} onClick={() => setCheckinOpen(true)}>Check-in</Button>
                )}
                {detail.status === 'checked_in' && (
                  <>
                    <Button size="small" variant="contained" color="success" onClick={() => handleAction('complete')} disabled={saving}>✅ เสร็จสิ้น</Button>
                    <Button size="small" variant="outlined" startIcon={<Assignment />}
                      onClick={() => { setReportForm({ topics: detail.report?.topics ?? '', promotions: detail.report?.promotions ?? '', projects: detail.report?.projects ?? '', newLeads: detail.report?.newLeads ?? 0, salesOpportunity: detail.report?.salesOpportunity ?? '', interestScore: detail.report?.interestScore ?? 3, nextApptDate: '', remarks: detail.report?.remarks ?? '' }); setReportOpen(true); }}>
                      Meeting Report
                    </Button>
                  </>
                )}
                {detail.status === 'completed' && (
                  <Button size="small" variant="outlined" startIcon={<Assignment />}
                    onClick={() => { setReportForm({ topics: detail.report?.topics ?? '', promotions: detail.report?.promotions ?? '', projects: detail.report?.projects ?? '', newLeads: detail.report?.newLeads ?? 0, salesOpportunity: detail.report?.salesOpportunity ?? '', interestScore: detail.report?.interestScore ?? 3, nextApptDate: '', remarks: detail.report?.remarks ?? '' }); setReportOpen(true); }}>
                    {detail.report ? 'แก้ไข Report' : 'Meeting Report'}
                  </Button>
                )}
                {isCloser && ['pending', 'confirmed', 'checked_in'].includes(detail.status) && (
                  <Button size="small" color="error" onClick={() => { if (window.confirm('ยืนยันการยกเลิกนัด?')) handleAction('cancel', { reason: '' }); }}>ยกเลิกนัด</Button>
                )}
                {isAdmin && (
                  <Button size="small" startIcon={<Edit />} onClick={openEdit}>แก้ไข</Button>
                )}
              </DialogActions>
            </>
          )}
        </Dialog>
      )}

      {/* ── CHECK-IN DIALOG ── */}
      <Dialog open={checkinOpen} maxWidth="xs" fullWidth onClose={() => setCheckinOpen(false)}>
        <DialogTitle>
          <Box display="flex" justifyContent="space-between">
            <Typography fontWeight={700}>Check-in Agency</Typography>
            <IconButton onClick={() => setCheckinOpen(false)}><Close /></IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} mt={0.5}>
            <TextField size="small" fullWidth label="ชื่อผู้รับ" value={checkinForm.receptionName}
              onChange={e => setCheckinForm(f => ({ ...f, receptionName: e.target.value }))} />
            <FormControl size="small" fullWidth>
              <InputLabel>ห้องประชุมจริง</InputLabel>
              <Select value={checkinForm.meetingRoomActual} label="ห้องประชุมจริง"
                onChange={e => setCheckinForm(f => ({ ...f, meetingRoomActual: e.target.value }))}>
                <MenuItem value="">—</MenuItem>
                {MEETING_ROOMS.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField size="small" fullWidth label="หมายเหตุ" value={checkinForm.notes}
              onChange={e => setCheckinForm(f => ({ ...f, notes: e.target.value }))} multiline rows={2} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCheckinOpen(false)}>ยกเลิก</Button>
          <Button variant="contained" onClick={handleCheckin} disabled={saving}>Check-in</Button>
        </DialogActions>
      </Dialog>

      {/* ── MEETING REPORT DIALOG ── */}
      <Dialog open={reportOpen} maxWidth="sm" fullWidth onClose={() => setReportOpen(false)}>
        <DialogTitle>
          <Box display="flex" justifyContent="space-between">
            <Typography fontWeight={700}>Meeting Report</Typography>
            <IconButton onClick={() => setReportOpen(false)}><Close /></IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} mt={0}>
            <Grid item xs={12}>
              <TextField size="small" fullWidth label="หัวข้อที่คุย" value={reportForm.topics}
                onChange={e => setReportForm(f => ({ ...f, topics: e.target.value }))} multiline rows={2} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField size="small" fullWidth label="โปรโมชั่น" value={reportForm.promotions}
                onChange={e => setReportForm(f => ({ ...f, promotions: e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField size="small" fullWidth label="โครงการที่นำเสนอ" value={reportForm.projects}
                onChange={e => setReportForm(f => ({ ...f, projects: e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField size="small" fullWidth label="New Leads" type="number" value={reportForm.newLeads}
                onChange={e => setReportForm(f => ({ ...f, newLeads: parseInt(e.target.value) || 0 }))} inputProps={{ min: 0 }} />
            </Grid>
            <Grid item xs={12} sm={8}>
              <TextField size="small" fullWidth label="โอกาสการขาย" value={reportForm.salesOpportunity}
                onChange={e => setReportForm(f => ({ ...f, salesOpportunity: e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Box>
                <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>คะแนนความสนใจ</Typography>
                <Rating value={reportForm.interestScore} max={5} onChange={(_, v) => setReportForm(f => ({ ...f, interestScore: v ?? 3 }))} />
              </Box>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField size="small" fullWidth label="นัดครั้งต่อไป" type="date" value={reportForm.nextApptDate}
                onChange={e => setReportForm(f => ({ ...f, nextApptDate: e.target.value }))} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12}>
              <TextField size="small" fullWidth label="หมายเหตุ" value={reportForm.remarks}
                onChange={e => setReportForm(f => ({ ...f, remarks: e.target.value }))} multiline rows={2} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReportOpen(false)}>ยกเลิก</Button>
          <Button variant="contained" onClick={handleReport} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : 'บันทึก'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
