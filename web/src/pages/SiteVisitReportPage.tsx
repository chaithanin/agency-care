import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  CalendarToday,
  CheckCircle,
  Close,
  FilterList,
  OpenInNew,
  PendingActions,
  PhotoCamera,
  Place,
  Psychology,
  Refresh,
  Schedule,
  Warning,
} from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { api, errMsg } from '../api/client';
import { useAuth } from '../auth/AuthContext';

// ─── Types ───────────────────────────────────────────────────────────────────
interface DashboardSummary {
  scheduled: number; completed: number; confirmed: number;
  overdue: number; cancelled: number; checkinSuccess: number; photosUploaded: number;
}

interface ReportRow {
  id: string;
  planDate: string;
  status: string;
  callConfirmResult?: string | null;
  agency: { id: string; code: string; name: string; zone?: string; province?: string; level?: string; type?: string };
  employee: { id: string; code: string; name: string };
  checkin?: {
    id: string; checkinAt: string; checkOutAt?: string; durationMinutes?: number;
    withinRadius: boolean; distanceMeters: number;
    latitude: number; longitude: number;
    contactName?: string; contactPosition?: string; contactPhone?: string;
    photos: { id: string; url: string; phase: string; takenAt: string }[];
  } | null;
  report?: {
    purposes: string[]; visitType?: string; summary?: string; problems?: string; actionPlan?: string;
    interestLevel?: string; newLeads?: number; nextVisitDate?: string;
  } | null;
  workPhotos: { id: string; url: string; caption?: string; takenAt: string }[];
  tasks: { id: string; title: string; dueDate?: string }[];
}

interface AiInsight {
  daysSinceLast: number; totalVisits: number; recentVisits: number; totalLeads: number;
  latestInterest?: string | null; relationshipScore: number; riskLevel: string; suggestRevisitDays: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info' | 'primary'> = {
  pending: 'warning', waiting_confirmation: 'info', confirmed: 'primary',
  rescheduled: 'default', on_route: 'primary', done: 'success',
  postponed: 'default', cancelled: 'error',
};
const STATUS_LABEL: Record<string, string> = {
  pending: 'รอดำเนินการ', waiting_confirmation: 'รอยืนยัน', confirmed: 'ยืนยันแล้ว',
  rescheduled: 'เลื่อนนัด', on_route: 'กำลังเดินทาง', done: 'สำเร็จ',
  postponed: 'เลื่อนไม่มีกำหนด', cancelled: 'ยกเลิก',
};
const INTEREST_LABEL: Record<string, string> = { high: 'สูง', medium: 'ปานกลาง', low: 'ต่ำ' };
const INTEREST_COLOR: Record<string, 'success' | 'warning' | 'error'> = {
  high: 'success', medium: 'warning', low: 'error',
};
const PURPOSES = [
  { value: 'introduce_project', label: 'แนะนำโครงการ' },
  { value: 'update_promotion', label: 'อัปเดตโปรโมชั่น' },
  { value: 'distribute_material', label: 'แจกสื่อการขาย' },
  { value: 'follow_sales', label: 'ติดตามยอดขาย' },
  { value: 'build_relationship', label: 'สร้างความสัมพันธ์' },
  { value: 'training', label: 'Training' },
];
const VISIT_TYPES = [
  { value: 'visit_agency', label: 'ไปเยี่ยม Agency' },
  { value: 'agency_brings_client', label: 'Agency พา Client มา' },
];

const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '-';
const fmtTime = (d?: string) => d ? new Date(d).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-';

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <Paper sx={{ p: 2, borderRadius: 3, flex: 1, minWidth: 120 }}>
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Box sx={{ color, opacity: 0.85 }}>{icon}</Box>
        <Box>
          <Typography variant="h5" fontWeight={800} sx={{ lineHeight: 1.1 }}>{value}</Typography>
          <Typography variant="caption" color="text.secondary">{label}</Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

// ─── Detail Drawer ────────────────────────────────────────────────────────────
function VisitDetailDialog({ row, onClose }: { row: ReportRow | null; onClose: () => void }) {
  const [insight, setInsight] = useState<AiInsight | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);

  useEffect(() => {
    if (!row) { setInsight(null); return; }
    setInsightLoading(true);
    api.get(`/visits/plans/${row.id}/ai-insight`)
      .then((r) => setInsight(r.data))
      .catch(() => setInsight(null))
      .finally(() => setInsightLoading(false));
  }, [row?.id]);

  if (!row) return null;

  const allPhotos = [
    ...(row.checkin?.photos ?? []).map((p) => ({ ...p, source: 'checkin' })),
    ...row.workPhotos.map((p) => ({ id: p.id, url: p.url, phase: p.caption ?? 'work', takenAt: p.takenAt, source: 'work' })),
  ];

  return (
    <Dialog open={!!row} onClose={onClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography fontWeight={800}>{row.agency.code} — {row.agency.name}</Typography>
          <Typography variant="caption" color="text.secondary">
            {fmtDate(row.planDate)} · {row.employee.name} · <Chip size="small" label={STATUS_LABEL[row.status] ?? row.status} color={STATUS_COLOR[row.status] ?? 'default'} />
          </Typography>
        </Box>
        <IconButton onClick={onClose}><Close /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>

          {/* ── Check-in Data ── */}
          <Section title="ข้อมูลการ Check-in">
            {row.checkin ? (
              <Grid container spacing={2}>
                <InfoItem label="เวลามาถึง" value={fmtTime(row.checkin.checkinAt)} />
                <InfoItem label="เวลาออก" value={fmtTime(row.checkin.checkOutAt)} />
                <InfoItem label="ระยะเวลา" value={row.checkin.durationMinutes ? `${row.checkin.durationMinutes} นาที` : '-'} />
                <InfoItem label="ระยะห่าง" value={`${row.checkin.distanceMeters} ม.`} />
                <InfoItem label="GPS" value={`${row.checkin.latitude.toFixed(5)}, ${row.checkin.longitude.toFixed(5)}`} />
                <InfoItem label="ผู้ติดต่อ" value={row.checkin.contactName ?? '-'} />
                <InfoItem label="ตำแหน่ง" value={row.checkin.contactPosition ?? '-'} />
                <InfoItem label="เบอร์ผู้ติดต่อ" value={row.checkin.contactPhone ?? '-'} />
                <Grid item xs={12}>
                  <Button
                    size="small" variant="outlined" startIcon={<Place />}
                    component="a"
                    href={`https://www.google.com/maps?q=${row.checkin.latitude},${row.checkin.longitude}`}
                    target="_blank"
                  >
                    Google Map
                  </Button>
                </Grid>
              </Grid>
            ) : (
              <Typography color="text.secondary" variant="body2">ยังไม่ได้ check-in</Typography>
            )}
          </Section>

          {/* ── Photos ── */}
          {allPhotos.length > 0 && (
            <Section title={`รูปภาพ (${allPhotos.length} รูป)`}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {allPhotos.map((p) => (
                  <Tooltip key={p.id} title={p.phase}>
                    <Box
                      component="a" href={p.url} target="_blank"
                      sx={{ width: 90, height: 90, borderRadius: 2, overflow: 'hidden', display: 'block',
                        border: '1px solid', borderColor: 'divider' }}
                    >
                      <Box component="img" src={p.url} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </Box>
                  </Tooltip>
                ))}
              </Box>
            </Section>
          )}

          {/* ── Visit Report ── */}
          {row.report && (
            <>
              <Section title="วัตถุประสงค์การเข้าเยี่ยม">
                <Stack direction="row" flexWrap="wrap" gap={1}>
                  {(row.report.purposes ?? []).map((p) => (
                    <Chip key={p} size="small" label={PURPOSES.find((x) => x.value === p)?.label ?? p} color="primary" variant="outlined" />
                  ))}
                  {row.report.visitType && (
                    <Chip size="small" label={VISIT_TYPES.find((x) => x.value === row.report!.visitType)?.label ?? row.report.visitType} color="secondary" variant="outlined" />
                  )}
                  {(row.report.purposes ?? []).length === 0 && <Typography color="text.secondary" variant="body2">-</Typography>}
                </Stack>
              </Section>

              <Section title="ผลการเข้าเยี่ยม">
                <Grid container spacing={2}>
                  <InfoItem label="ความสนใจ"
                    value={row.report.interestLevel
                      ? <Chip size="small" label={INTEREST_LABEL[row.report.interestLevel]} color={INTEREST_COLOR[row.report.interestLevel]} />
                      : '-'} />
                  <InfoItem label="Lead ใหม่" value={row.report.newLeads != null ? `${row.report.newLeads} ราย` : '-'} />
                  <InfoItem label="นัดครั้งถัดไป" value={fmtDate(row.report.nextVisitDate)} />
                  {row.report.summary && (
                    <Grid item xs={12}>
                      <Typography variant="caption" color="text.secondary">สรุปผล</Typography>
                      <Typography variant="body2">{row.report.summary}</Typography>
                    </Grid>
                  )}
                  {row.report.problems && (
                    <Grid item xs={12}>
                      <Typography variant="caption" color="text.secondary">ปัญหาที่พบ</Typography>
                      <Typography variant="body2">{row.report.problems}</Typography>
                    </Grid>
                  )}
                  {row.report.actionPlan && (
                    <Grid item xs={12}>
                      <Typography variant="caption" color="text.secondary">แผนถัดไป</Typography>
                      <Typography variant="body2">{row.report.actionPlan}</Typography>
                    </Grid>
                  )}
                </Grid>
              </Section>
            </>
          )}

          {/* ── Follow-up Tasks ── */}
          {row.tasks.length > 0 && (
            <Section title={`Follow-up Tasks (${row.tasks.length})`}>
              <Stack spacing={1}>
                {row.tasks.map((t) => (
                  <Stack key={t.id} direction="row" alignItems="center" spacing={1}>
                    <PendingActions fontSize="small" color="warning" />
                    <Typography variant="body2">{t.title}</Typography>
                    {t.dueDate && <Chip size="small" label={fmtDate(t.dueDate)} variant="outlined" />}
                  </Stack>
                ))}
              </Stack>
            </Section>
          )}

          {/* ── Visit Detail Link ── */}
          <Box>
            <Button component={Link} to={`/visits/${row.id}`} variant="outlined" startIcon={<OpenInNew />} size="small">
              ดูรายละเอียดการเยี่ยมเต็ม
            </Button>
          </Box>

          {/* ── AI Insight ── */}
          <Section title="AI Insight" icon={<Psychology color="secondary" />}>
            {insightLoading ? (
              <LinearProgress />
            ) : insight ? (
              <Grid container spacing={2}>
                <InfoItem label="ไม่ได้เยี่ยมมา" value={insight.daysSinceLast === 999 ? 'ยังไม่เคยเยี่ยม' : `${insight.daysSinceLast} วัน`} />
                <InfoItem label="เยี่ยมทั้งหมด" value={`${insight.totalVisits} ครั้ง`} />
                <InfoItem label="3 เดือนล่าสุด" value={`${insight.recentVisits} ครั้ง`} />
                <InfoItem label="Lead รวม" value={`${insight.totalLeads} ราย`} />
                <Grid item xs={12}>
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <Box sx={{ flex: 1 }}>
                      <Stack direction="row" justifyContent="space-between" mb={0.5}>
                        <Typography variant="caption">คะแนนความสัมพันธ์</Typography>
                        <Typography variant="caption" fontWeight={700}>{insight.relationshipScore}/100</Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate" value={insight.relationshipScore}
                        color={insight.riskLevel === 'low' ? 'success' : insight.riskLevel === 'medium' ? 'warning' : 'error'}
                        sx={{ height: 8, borderRadius: 4 }}
                      />
                    </Box>
                    <Chip
                      size="small"
                      label={`ความเสี่ยง: ${insight.riskLevel === 'low' ? 'ต่ำ' : insight.riskLevel === 'medium' ? 'ปานกลาง' : 'สูง'}`}
                      color={insight.riskLevel === 'low' ? 'success' : insight.riskLevel === 'medium' ? 'warning' : 'error'}
                    />
                  </Stack>
                </Grid>
                {insight.daysSinceLast > 14 && (
                  <Grid item xs={12}>
                    <Alert severity={insight.riskLevel === 'high' ? 'error' : 'warning'} icon={<Warning />}>
                      ควรเข้าเยี่ยมอีกภายใน {insight.suggestRevisitDays} วัน
                      {insight.daysSinceLast !== 999 && ` (ไม่ได้เยี่ยมมา ${insight.daysSinceLast} วัน)`}
                    </Alert>
                  </Grid>
                )}
              </Grid>
            ) : (
              <Typography variant="body2" color="text.secondary">ไม่สามารถโหลด insight ได้</Typography>
            )}
          </Section>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

// ─── Helper components ────────────────────────────────────────────────────────
function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
        {icon}
        <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {title}
        </Typography>
      </Stack>
      {children}
      <Divider sx={{ mt: 2 }} />
    </Box>
  );
}

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Grid item xs={6} sm={4}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={600}>{value ?? '-'}</Typography>
    </Grid>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SiteVisitReportPage() {
  const { user } = useAuth();
  const isManager = user?.activeRole !== 'sales';

  // Dashboard summary
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [dashDate, setDashDate] = useState(todayStr());

  // Filters
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState({
    from: todayStr(), to: todayStr(),
    employeeId: '', agencyId: '', status: '', province: '', agencyLevel: '', agencyType: '',
  });
  const [appliedFilters, setAppliedFilters] = useState({ ...filters });

  // Report list
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Detail dialog
  const [selected, setSelected] = useState<ReportRow | null>(null);

  // Dropdown options
  const [employees, setEmployees] = useState<{ id: string; name: string; code: string }[]>([]);
  const [provinces, setProvinces] = useState<string[]>([]);

  const loadDashboard = useCallback((d: string) => {
    api.get('/visits/report-dashboard', { params: { date: d } })
      .then((r) => setSummary(r.data))
      .catch(() => setSummary(null));
  }, []);

  const loadReport = useCallback((f: typeof appliedFilters) => {
    setLoading(true); setError('');
    const params: Record<string, string> = {};
    if (f.from) params.from = f.from;
    if (f.to) params.to = f.to;
    if (f.employeeId) params.employeeId = f.employeeId;
    if (f.agencyId) params.agencyId = f.agencyId;
    if (f.status) params.status = f.status;
    if (f.province) params.province = f.province;
    if (f.agencyLevel) params.agencyLevel = f.agencyLevel;
    if (f.agencyType) params.agencyType = f.agencyType;
    api.get('/visits/report', { params })
      .then((r) => {
        setRows(r.data);
        const ps = [...new Set<string>(r.data.map((x: ReportRow) => x.agency.province).filter(Boolean))];
        setProvinces(ps);
      })
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadDashboard(dashDate);
  }, [dashDate, loadDashboard]);

  useEffect(() => {
    if (isManager) api.get('/employees').then((r) => setEmployees(r.data));
  }, [isManager]);

  useEffect(() => {
    loadReport(appliedFilters);
  }, [appliedFilters, loadReport]);

  const applyFilters = () => { setAppliedFilters({ ...filters }); setShowFilter(false); };
  const resetFilters = () => {
    const def = { from: todayStr(), to: todayStr(), employeeId: '', agencyId: '', status: '', province: '', agencyLevel: '', agencyType: '' };
    setFilters(def); setAppliedFilters(def);
  };

  return (
    <Box>
      {/* ─── Title bar ─── */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight={800}>Site Visit Report</Typography>
        <Stack direction="row" spacing={1}>
          <Tooltip title="รีเฟรช">
            <IconButton onClick={() => { loadDashboard(dashDate); loadReport(appliedFilters); }}>
              <Refresh />
            </IconButton>
          </Tooltip>
          <Button variant="outlined" startIcon={<FilterList />} onClick={() => setShowFilter((v) => !v)}>
            ตัวกรอง
          </Button>
        </Stack>
      </Stack>

      {/* ── Section 1: Dashboard Summary ── */}
      <Paper sx={{ p: 2.5, mb: 3, borderRadius: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="subtitle1" fontWeight={700}>ภาพรวมวันที่</Typography>
          <TextField type="date" size="small" value={dashDate}
            onChange={(e) => setDashDate(e.target.value)}
            InputLabelProps={{ shrink: true }} sx={{ width: 160 }} />
        </Stack>
        <Stack direction="row" flexWrap="wrap" gap={2}>
          <KpiCard icon={<Schedule />} label="Scheduled" value={summary?.scheduled ?? 0} color="primary.main" />
          <KpiCard icon={<CheckCircle />} label="Completed" value={summary?.completed ?? 0} color="success.main" />
          <KpiCard icon={<CalendarToday />} label="Confirmed" value={summary?.confirmed ?? 0} color="info.main" />
          <KpiCard icon={<Warning />} label="Overdue" value={summary?.overdue ?? 0} color="warning.main" />
          <KpiCard icon={<Close sx={{ fontSize: 20 }} />} label="Cancelled" value={summary?.cancelled ?? 0} color="error.main" />
          <KpiCard icon={<Place />} label="Check-in ✓" value={summary?.checkinSuccess ?? 0} color="success.dark" />
          <KpiCard icon={<PhotoCamera />} label="Photos" value={summary?.photosUploaded ?? 0} color="secondary.main" />
        </Stack>
      </Paper>

      {/* ── Section 2: Filter Panel ── */}
      <Collapse in={showFilter}>
        <Paper sx={{ p: 2.5, mb: 3, borderRadius: 3 }}>
          <Typography variant="subtitle2" fontWeight={700} mb={2}>ตัวกรองรายงาน</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth type="date" label="จาก" size="small" value={filters.from}
                onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
                InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth type="date" label="ถึง" size="small" value={filters.to}
                onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
                InputLabelProps={{ shrink: true }} />
            </Grid>
            {isManager && (
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Sale</InputLabel>
                  <Select value={filters.employeeId} label="Sale"
                    onChange={(e) => setFilters((f) => ({ ...f, employeeId: e.target.value }))}>
                    <MenuItem value="">ทั้งหมด</MenuItem>
                    {employees.map((e) => <MenuItem key={e.id} value={e.id}>{e.name} ({e.code})</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            )}
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>สถานะ</InputLabel>
                <Select value={filters.status} label="สถานะ"
                  onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
                  <MenuItem value="">ทั้งหมด</MenuItem>
                  {Object.entries(STATUS_LABEL).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>จังหวัด</InputLabel>
                <Select value={filters.province} label="จังหวัด"
                  onChange={(e) => setFilters((f) => ({ ...f, province: e.target.value }))}>
                  <MenuItem value="">ทั้งหมด</MenuItem>
                  {provinces.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Agency Level</InputLabel>
                <Select value={filters.agencyLevel} label="Agency Level"
                  onChange={(e) => setFilters((f) => ({ ...f, agencyLevel: e.target.value }))}>
                  <MenuItem value="">ทั้งหมด</MenuItem>
                  {['A', 'B', 'C', 'D'].map((l) => <MenuItem key={l} value={l}>Level {l}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          <Stack direction="row" spacing={1} mt={2}>
            <Button variant="contained" onClick={applyFilters}>ค้นหา</Button>
            <Button variant="outlined" onClick={resetFilters}>รีเซ็ต</Button>
          </Stack>
        </Paper>
      </Collapse>

      {/* ── Section 3: Report Table ── */}
      <Paper sx={{ borderRadius: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle1" fontWeight={700}>
            รายงานการเข้าเยี่ยม {rows.length > 0 && `(${rows.length} รายการ)`}
          </Typography>
        </Stack>
        {loading && <LinearProgress />}
        {error && <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>}
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>วันที่</TableCell>
                <TableCell>Agency</TableCell>
                <TableCell>Sale</TableCell>
                <TableCell>สถานะ</TableCell>
                <TableCell align="center">เวลา</TableCell>
                <TableCell align="center">ระยะเวลา</TableCell>
                <TableCell align="center">Check-in</TableCell>
                <TableCell align="center">รูปภาพ</TableCell>
                <TableCell align="center">Lead</TableCell>
                <TableCell align="right">รายละเอียด</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    ไม่พบข้อมูล — ลองปรับตัวกรองแล้วกด "ค้นหา"
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => {
                const photoCount = (r.checkin?.photos.length ?? 0) + r.workPhotos.length;
                return (
                  <TableRow key={r.id} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{fmtDate(r.planDate)}</TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: 160 }}>
                        {r.agency.code}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', maxWidth: 160 }}>
                        {r.agency.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{r.employee.name}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={STATUS_LABEL[r.status] ?? r.status} color={STATUS_COLOR[r.status] ?? 'default'} />
                    </TableCell>
                    <TableCell align="center">
                      {r.checkin ? (
                        <Typography variant="caption">
                          {fmtTime(r.checkin.checkinAt)}
                          {r.checkin.checkOutAt && ` – ${fmtTime(r.checkin.checkOutAt)}`}
                        </Typography>
                      ) : '-'}
                    </TableCell>
                    <TableCell align="center">
                      {r.checkin?.durationMinutes ? `${r.checkin.durationMinutes} นาที` : '-'}
                    </TableCell>
                    <TableCell align="center">
                      {r.checkin
                        ? <Tooltip title={`${r.checkin.distanceMeters} ม.`}><CheckCircle color={r.checkin.withinRadius ? 'success' : 'error'} fontSize="small" /></Tooltip>
                        : <Typography variant="caption" color="text.disabled">-</Typography>}
                    </TableCell>
                    <TableCell align="center">
                      {photoCount > 0
                        ? <Chip size="small" icon={<PhotoCamera fontSize="small" />} label={photoCount} variant="outlined" />
                        : <Typography variant="caption" color="text.disabled">-</Typography>}
                    </TableCell>
                    <TableCell align="center">
                      {r.report?.newLeads != null
                        ? <Chip size="small" label={r.report.newLeads} color="success" />
                        : <Typography variant="caption" color="text.disabled">-</Typography>}
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small" variant="outlined" onClick={() => setSelected(r)}>
                        ดูรายละเอียด
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      </Paper>

      {/* ── Section 4: Detail Dialog ── */}
      <VisitDetailDialog row={selected} onClose={() => setSelected(null)} />
    </Box>
  );
}
