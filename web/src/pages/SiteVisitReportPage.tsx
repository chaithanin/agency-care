import { useCallback, useEffect, useState } from 'react';
import { useT } from '../i18n';
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
  Download,
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
  closer?: { id: string; name: string; code: string } | null;
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
  posmItems?: { name: string; quantity: number; unit: string }[];
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
const STATUS_LABEL_KEY: Record<string, string> = {
  pending: 'svr.statusPending', waiting_confirmation: 'svr.statusWaitingConfirm', confirmed: 'svr.statusConfirmed',
  rescheduled: 'svr.statusRescheduled', on_route: 'svr.statusOnRoute', done: 'svr.statusDone',
  postponed: 'svr.statusPostponed', cancelled: 'svr.statusCancelled',
};
const INTEREST_LABEL_KEY: Record<string, string> = { high: 'svr.interestHigh', medium: 'svr.interestMedium', low: 'svr.interestLow' };
const INTEREST_COLOR: Record<string, 'success' | 'warning' | 'error'> = {
  high: 'success', medium: 'warning', low: 'error',
};
const PURPOSE_KEYS: Record<string, string> = {
  introduce_project: 'svr.purposeIntroProject',
  update_promotion: 'svr.purposeUpdatePromo',
  distribute_material: 'svr.purposeDistMaterial',
  follow_sales: 'svr.purposeFollowSales',
  build_relationship: 'svr.purposeBuildRel',
  training: 'svr.purposeTraining',
};
const VISIT_TYPE_KEYS: Record<string, string> = {
  visit_agency: 'svr.visitTypeVisitAgency',
  agency_brings_client: 'svr.visitTypeAgencyBringsClient',
};

const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '-';
const fmtTime = (d?: string) => d ? new Date(d).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-';

const thisMonthRange = () => {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { from, to };
};

const lastMonthRange = () => {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
  const to = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
  return { from, to };
};

// ─── CSV Export ───────────────────────────────────────────────────────────────
function exportCsv(rows: ReportRow[]) {
  const escape = (v: string | number | undefined | null) => {
    if (v == null) return '';
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = [
    'Date', 'Agency Code', 'Agency Name', 'Zone', 'Province', 'Level', 'Sale', 'Closer',
    'Status', 'Check-in Time', 'Check-out Time', 'Duration (min)', 'Within Radius',
    'Photos Count', 'Leads', 'Interest Level', 'Summary',
  ].join(',');
  const dataRows = rows.map((r) => {
    const photoCount = (r.checkin?.photos.length ?? 0) + r.workPhotos.length;
    return [
      escape(fmtDate(r.planDate)),
      escape(r.agency.code),
      escape(r.agency.name),
      escape(r.agency.zone),
      escape(r.agency.province),
      escape(r.agency.level),
      escape(r.employee.name),
      escape(r.closer?.name),
      escape(r.status),
      escape(fmtTime(r.checkin?.checkinAt)),
      escape(fmtTime(r.checkin?.checkOutAt)),
      escape(r.checkin?.durationMinutes),
      escape(r.checkin ? (r.checkin.withinRadius ? 'Yes' : 'No') : ''),
      escape(photoCount > 0 ? photoCount : 0),
      escape(r.report?.newLeads),
      escape(r.report?.interestLevel),
      escape(r.report?.summary),
    ].join(',');
  });
  const csv = [header, ...dataRows].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'site-visit-report.csv';
  a.click();
  URL.revokeObjectURL(url);
}

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
  const { t } = useT();
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
            {fmtDate(row.planDate)} · {row.employee.name} · <Chip size="small" label={t(STATUS_LABEL_KEY[row.status] ?? row.status)} color={STATUS_COLOR[row.status] ?? 'default'} />
          </Typography>
        </Box>
        <IconButton onClick={onClose}><Close /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>

          {/* ── Check-in Data ── */}
          <Section title={t('svr.checkinData')}>
            {row.checkin ? (
              <Grid container spacing={2}>
                <InfoItem label={t('svr.arrivalTime')} value={fmtTime(row.checkin.checkinAt)} />
                <InfoItem label={t('svr.departTime')} value={fmtTime(row.checkin.checkOutAt)} />
                <InfoItem label={t('svr.duration')} value={row.checkin.durationMinutes ? `${row.checkin.durationMinutes} ${t('svr.minuteUnit')}` : '-'} />
                <InfoItem label={t('svr.distance')} value={`${row.checkin.distanceMeters} ${t('svr.meterUnit')}`} />
                <InfoItem label="GPS" value={`${row.checkin.latitude.toFixed(5)}, ${row.checkin.longitude.toFixed(5)}`} />
                <InfoItem label={t('svr.contact')} value={row.checkin.contactName ?? '-'} />
                <InfoItem label={t('c.position')} value={row.checkin.contactPosition ?? '-'} />
                <InfoItem label={t('svr.contactPhone')} value={row.checkin.contactPhone ?? '-'} />
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
              <Typography color="text.secondary" variant="body2">{t('svr.notCheckedIn')}</Typography>
            )}
          </Section>

          {/* ── Photos ── */}
          {allPhotos.length > 0 && (
            <Section title={`${t('svr.photos')} (${allPhotos.length} ${t('svr.photoUnit')})`}>
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

          {/* ── POSM / Materials Given ── */}
          <Section title={t('svr.materialsGiven') || 'สิ่งที่นำไป / Materials Given'}>
            {row.posmItems && row.posmItems.length > 0 ? (
              <Stack spacing={0.5}>
                {row.posmItems.map((item, i) => (
                  <Stack key={i} direction="row" alignItems="center" spacing={1}>
                    <Typography variant="body2" sx={{ flex: 1 }}>{item.name}</Typography>
                    <Chip size="small" label={`${item.quantity} ${item.unit}`} variant="outlined" />
                  </Stack>
                ))}
              </Stack>
            ) : (
              <Typography color="text.secondary" variant="body2">-</Typography>
            )}
          </Section>

          {/* ── Visit Report ── */}
          {row.report && (
            <>
              <Section title={t('svr.visitPurpose')}>
                <Stack direction="row" flexWrap="wrap" gap={1}>
                  {(row.report.purposes ?? []).map((p) => (
                    <Chip key={p} size="small" label={t(PURPOSE_KEYS[p] ?? p)} color="primary" variant="outlined" />
                  ))}
                  {row.report.visitType && (
                    <Chip size="small" label={t(VISIT_TYPE_KEYS[row.report!.visitType] ?? row.report!.visitType)} color="secondary" variant="outlined" />
                  )}
                  {(row.report.purposes ?? []).length === 0 && <Typography color="text.secondary" variant="body2">-</Typography>}
                </Stack>
              </Section>

              <Section title={t('svr.visitResult')}>
                <Grid container spacing={2}>
                  <InfoItem label={t('svr.interest')}
                    value={row.report.interestLevel
                      ? <Chip size="small" label={t(INTEREST_LABEL_KEY[row.report.interestLevel])} color={INTEREST_COLOR[row.report.interestLevel]} />
                      : '-'} />
                  <InfoItem label={t('svr.newLead')} value={row.report.newLeads != null ? `${row.report.newLeads} ${t('svr.personUnit')}` : '-'} />
                  <InfoItem label={t('svr.nextAppt')} value={fmtDate(row.report.nextVisitDate)} />
                  {row.report.summary && (
                    <Grid item xs={12}>
                      <Typography variant="caption" color="text.secondary">{t('svr.summaryLabel')}</Typography>
                      <Typography variant="body2">{row.report.summary}</Typography>
                    </Grid>
                  )}
                  {row.report.problems && (
                    <Grid item xs={12}>
                      <Typography variant="caption" color="text.secondary">{t('vd.problems')}</Typography>
                      <Typography variant="body2">{row.report.problems}</Typography>
                    </Grid>
                  )}
                  {row.report.actionPlan && (
                    <Grid item xs={12}>
                      <Typography variant="caption" color="text.secondary">{t('svr.actionPlan')}</Typography>
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
              {t('svr.viewFullDetail')}
            </Button>
          </Box>

          {/* ── AI Insight ── */}
          <Section title="AI Insight" icon={<Psychology color="secondary" />}>
            {insightLoading ? (
              <LinearProgress />
            ) : insight ? (
              <Grid container spacing={2}>
                <InfoItem label={t('svr.daysSinceLast')} value={insight.daysSinceLast === 999 ? t('svr.neverVisited') : `${insight.daysSinceLast} ${t('svr.dayUnit')}`} />
                <InfoItem label={t('svr.totalVisits')} value={`${insight.totalVisits} ${t('svr.timesUnit')}`} />
                <InfoItem label={t('svr.last3Months')} value={`${insight.recentVisits} ${t('svr.timesUnit')}`} />
                <InfoItem label={t('svr.totalLeads')} value={`${insight.totalLeads} ${t('svr.personUnit')}`} />
                <Grid item xs={12}>
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <Box sx={{ flex: 1 }}>
                      <Stack direction="row" justifyContent="space-between" mb={0.5}>
                        <Typography variant="caption">{t('svr.relationshipScore')}</Typography>
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
                      label={`${t('svr.risk')}: ${insight.riskLevel === 'low' ? t('svr.interestLow') : insight.riskLevel === 'medium' ? t('svr.interestMedium') : t('svr.interestHigh')}`}
                      color={insight.riskLevel === 'low' ? 'success' : insight.riskLevel === 'medium' ? 'warning' : 'error'}
                    />
                  </Stack>
                </Grid>
                {insight.daysSinceLast > 14 && (
                  <Grid item xs={12}>
                    <Alert severity={insight.riskLevel === 'high' ? 'error' : 'warning'} icon={<Warning />}>
                      {t('svr.shouldRevisitWithin')} {insight.suggestRevisitDays} {t('svr.dayUnit')}
                      {insight.daysSinceLast !== 999 && ` (${t('svr.daysSinceLast')} ${insight.daysSinceLast} ${t('svr.dayUnit')})`}
                    </Alert>
                  </Grid>
                )}
              </Grid>
            ) : (
              <Typography variant="body2" color="text.secondary">{t('svr.insightLoadFail')}</Typography>
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
  const { t } = useT();
  const { user } = useAuth();
  const isAdmin = user?.activeRole === 'super_admin' || user?.activeRole === 'admin';
  const isCloser = user?.activeRole === 'closer';
  const isManager = user?.activeRole !== 'sales';

  // Dashboard summary
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [dashDate, setDashDate] = useState(todayStr());

  // Filters
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState({
    from: todayStr(), to: todayStr(),
    employeeId: '', agencyId: '', status: '', province: '', agencyLevel: '', agencyType: '', closerId: '',
  });
  const [appliedFilters, setAppliedFilters] = useState({ ...filters });

  // Report list
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Detail dialog
  const [selected, setSelected] = useState<ReportRow | null>(null);

  // Dropdown options
  const [employees, setEmployees] = useState<{ id: string; name: string; code: string; position?: string }[]>([]);
  const [closers, setClosers] = useState<{ id: string; name: string; code: string }[]>([]);
  const [provinces, setProvinces] = useState<string[]>([]);

  // Current user's employee id (from AuthContext — available for all roles with an employee record)
  const myEmployeeId = user?.employee?.id ?? null;

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
    if (f.closerId) params.closerId = f.closerId;
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
    if (isManager) {
      api.get('/employees').then((r) => {
        const all: { id: string; name: string; code: string; position?: string }[] = r.data;
        setEmployees(all.filter((e) => e.position === 'sales' || !e.position));
        setClosers(all.filter((e) => e.position === 'closer'));
      });
    }
  }, [isManager]);

  // For closer role: pre-set closerId filter to own employee id (locked)
  useEffect(() => {
    if (isCloser && myEmployeeId) {
      setFilters((f) => ({ ...f, closerId: myEmployeeId }));
      setAppliedFilters((f) => ({ ...f, closerId: myEmployeeId }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCloser, myEmployeeId]);

  useEffect(() => {
    loadReport(appliedFilters);
  }, [appliedFilters, loadReport]);

  const applyFilters = () => { setAppliedFilters({ ...filters }); setShowFilter(false); };
  const resetFilters = () => {
    const def = {
      from: todayStr(), to: todayStr(),
      employeeId: '', agencyId: '', status: '', province: '', agencyLevel: '', agencyType: '',
      closerId: isCloser && myEmployeeId ? myEmployeeId : '',
    };
    setFilters(def); setAppliedFilters(def);
  };

  // Sales role: no filter panel; closer: locked closerId
  const canShowFilter = isManager;
  const closerFilterLocked = isCloser && !!myEmployeeId;

  // Sale dropdown: for closer, only show their team members (backend handles this via closerId filter,
  // but for the dropdown we show all sales from the loaded list)
  const saleOptions = employees;

  return (
    <Box>
      {/* ─── Title bar ─── */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight={800}>Site Visit Report</Typography>
        <Stack direction="row" spacing={1}>
          {(isAdmin || isCloser) && (
            <Tooltip title="Export CSV">
              <Button
                variant="outlined"
                size="small"
                startIcon={<Download />}
                onClick={() => exportCsv(rows)}
                disabled={rows.length === 0}
              >
                Export CSV
              </Button>
            </Tooltip>
          )}
          <Tooltip title={t('svr.refresh')}>
            <IconButton onClick={() => { loadDashboard(dashDate); loadReport(appliedFilters); }}>
              <Refresh />
            </IconButton>
          </Tooltip>
          {canShowFilter && (
            <Button variant="outlined" startIcon={<FilterList />} onClick={() => setShowFilter((v) => !v)}>
              {t('svr.filter')}
            </Button>
          )}
        </Stack>
      </Stack>

      {/* ── Section 1: Dashboard Summary ── */}
      <Paper sx={{ p: 2.5, mb: 3, borderRadius: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="subtitle1" fontWeight={700}>{t('svr.dashboardDate')}</Typography>
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
          <KpiCard icon={<Place />} label={t('svr.checkinSuccess')} value={summary?.checkinSuccess ?? 0} color="success.dark" />
          <KpiCard icon={<PhotoCamera />} label="Photos" value={summary?.photosUploaded ?? 0} color="secondary.main" />
        </Stack>
      </Paper>

      {/* ── Section 2: Filter Panel ── */}
      {canShowFilter && (
        <Collapse in={showFilter}>
          <Paper sx={{ p: 2.5, mb: 3, borderRadius: 3 }}>
            <Typography variant="subtitle2" fontWeight={700} mb={2}>{t('svr.filterPanel')}</Typography>

            {/* Month quick-select buttons */}
            <Stack direction="row" spacing={1} mb={2}>
              <Button
                size="small" variant="outlined"
                onClick={() => setFilters((f) => ({ ...f, ...thisMonthRange() }))}
              >
                This Month
              </Button>
              <Button
                size="small" variant="outlined"
                onClick={() => setFilters((f) => ({ ...f, ...lastMonthRange() }))}
              >
                Last Month
              </Button>
            </Stack>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <TextField fullWidth type="date" label={t('svr.from')} size="small" value={filters.from}
                  onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
                  InputLabelProps={{ shrink: true }} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField fullWidth type="date" label={t('svr.to')} size="small" value={filters.to}
                  onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
                  InputLabelProps={{ shrink: true }} />
              </Grid>

              {/* Sale dropdown */}
              {(isAdmin || isCloser) && (
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Sale</InputLabel>
                    <Select value={filters.employeeId} label="Sale"
                      onChange={(e) => setFilters((f) => ({ ...f, employeeId: e.target.value }))}>
                      <MenuItem value="">{t('svr.all')}</MenuItem>
                      {saleOptions.map((e) => <MenuItem key={e.id} value={e.id}>{e.name} ({e.code})</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
              )}

              {/* Closer dropdown — admins see all closers; closer role sees self (locked) */}
              {(isAdmin || isCloser) && (
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth size="small" disabled={closerFilterLocked}>
                    <InputLabel>Closer</InputLabel>
                    <Select value={filters.closerId} label="Closer"
                      onChange={(e) => setFilters((f) => ({ ...f, closerId: e.target.value }))}>
                      <MenuItem value="">{t('svr.all')}</MenuItem>
                      {closers.map((c) => <MenuItem key={c.id} value={c.id}>{c.name} ({c.code})</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
              )}

              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>{t('c.status')}</InputLabel>
                  <Select value={filters.status} label={t('c.status')}
                    onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
                    <MenuItem value="">{t('svr.all')}</MenuItem>
                    {Object.entries(STATUS_LABEL_KEY).map(([k, labelKey]) => <MenuItem key={k} value={k}>{t(labelKey)}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>{t('ag.province')}</InputLabel>
                  <Select value={filters.province} label={t('ag.province')}
                    onChange={(e) => setFilters((f) => ({ ...f, province: e.target.value }))}>
                    <MenuItem value="">{t('svr.all')}</MenuItem>
                    {provinces.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Agency Level</InputLabel>
                  <Select value={filters.agencyLevel} label="Agency Level"
                    onChange={(e) => setFilters((f) => ({ ...f, agencyLevel: e.target.value }))}>
                    <MenuItem value="">{t('svr.all')}</MenuItem>
                    {['A', 'B', 'C', 'D'].map((l) => <MenuItem key={l} value={l}>Level {l}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Agency Type</InputLabel>
                  <Select value={filters.agencyType} label="Agency Type"
                    onChange={(e) => setFilters((f) => ({ ...f, agencyType: e.target.value }))}>
                    <MenuItem value="">{t('svr.all')}</MenuItem>
                    <MenuItem value="individual">Individual</MenuItem>
                    <MenuItem value="corporate">Corporate</MenuItem>
                    <MenuItem value="online">Online</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            <Stack direction="row" spacing={1} mt={2}>
              <Button variant="contained" onClick={applyFilters}>{t('svr.search')}</Button>
              <Button variant="outlined" onClick={resetFilters}>{t('svr.reset')}</Button>
            </Stack>
          </Paper>
        </Collapse>
      )}

      {/* ── Section 3: Report Table ── */}
      <Paper sx={{ borderRadius: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle1" fontWeight={700}>
            {t('svr.visitReport')} {rows.length > 0 && `(${rows.length} ${t('svr.itemUnit')})`}
          </Typography>
        </Stack>
        {loading && <LinearProgress />}
        {error && <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>}
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('pl2.date')}</TableCell>
                <TableCell>Agency</TableCell>
                <TableCell>Sale</TableCell>
                {isManager && <TableCell>Closer</TableCell>}
                <TableCell>{t('c.status')}</TableCell>
                <TableCell align="center">{t('svr.time')}</TableCell>
                <TableCell align="center">{t('svr.duration')}</TableCell>
                <TableCell align="center">Check-in</TableCell>
                <TableCell align="center">{t('svr.photos')}</TableCell>
                <TableCell align="center">Lead</TableCell>
                <TableCell align="right">{t('svr.detail')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={isManager ? 11 : 10} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    {t('svr.noData')}
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
                    {isManager && (
                      <TableCell>
                        <Typography variant="body2">{r.closer?.name ?? '-'}</Typography>
                      </TableCell>
                    )}
                    <TableCell>
                      <Chip size="small" label={t(STATUS_LABEL_KEY[r.status] ?? r.status)} color={STATUS_COLOR[r.status] ?? 'default'} />
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
                      {r.checkin?.durationMinutes ? `${r.checkin.durationMinutes} ${t('svr.minuteUnit')}` : '-'}
                    </TableCell>
                    <TableCell align="center">
                      {r.checkin
                        ? <Tooltip title={`${r.checkin.distanceMeters} ${t('svr.meterUnit')}`}><CheckCircle color={r.checkin.withinRadius ? 'success' : 'error'} fontSize="small" /></Tooltip>
                        : <Typography variant="caption" color="text.disabled">-</Typography>}
                    </TableCell>
                    <TableCell align="center">
                      {photoCount > 0
                        ? <Chip size="small" icon={<PhotoCamera fontSize="small" />} label={`${photoCount} ${t('svr.photoUnit') || 'รูป'}`} variant="outlined" />
                        : <Typography variant="caption" color="text.disabled">-</Typography>}
                    </TableCell>
                    <TableCell align="center">
                      {r.report?.newLeads != null
                        ? <Chip size="small" label={r.report.newLeads} color="success" />
                        : <Typography variant="caption" color="text.disabled">-</Typography>}
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small" variant="outlined" onClick={() => setSelected(r)}>
                        {t('svr.viewDetail')}
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
