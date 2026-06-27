import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Assessment,
  BarChart,
  BusinessCenter,
  CalendarMonth,
  CheckCircle,
  Download,
  EmojiEvents,
  Groups,
  Refresh,
  TableChart,
  TrendingUp,
} from '@mui/icons-material';
import { api, errMsg } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useT } from '../i18n';
import SalesDashboardTab from './SalesDashboardTab';

// ─── Types ───────────────────────────────────────────────────────────────────
interface AgActivityRow {
  id: string; code: string; name: string;
  zone?: string | null; grade?: string | null; assignedTo?: string;
  phone?: string | null; contactPerson?: string | null;
  staffCount?: number | null;
  totalVisits: number; completedVisits: number;
  lastVisitDate?: string | null; lastVisitBy?: string | null; lastReportDate?: string | null; leads: number;
  bringCustomers: string; lastSaleDate: string; hadOrientation: string;
  hasOrganicSocial: string; hasPaidSocial: string;
  websiteUrl: string;
  materials: { name: string; qty: number; unit: string }[];
  totalMaterials: number;
}
interface AgActivityData { rows: AgActivityRow[] }

interface DailyRow {
  id: string; name: string; code: string; team: string | null;
  daily: Record<string, number>; total: number; target: number;
}
interface DailyTrackerData {
  year: number; month: number; half: number;
  dates: string[]; workingDays: number; dailyTarget: number; periodTarget: number;
  rows: DailyRow[];
  grand: { daily: Record<string, number>; total: number; target: number };
}

interface WeeklyRow {
  id: string; code: string; name: string;
  visit_agency: number; agency_brings_client: number;
  training: number; other: number;
  total: number; completed: number; withReport: number; leads: number;
  call: number; orientation: number; customer: number; holding: number; followupCustomer: number; overdue: number;
}
interface WeeklyData {
  from: string; to: string;
  rows: WeeklyRow[];
  grand: Omit<WeeklyRow, 'id' | 'code' | 'name'>;
}

interface MonthlyEmpRow {
  id: string; code: string; name: string;
  planned: number; completed: number; withReport: number; leads: number; submissionRate: number;
}
interface MonthlyData { year: number; month: number; rows: MonthlyEmpRow[] }

interface AgRow {
  id: string; code: string; name: string;
  zone?: string | null; province?: string | null; level?: string | null; tier?: string | null;
  visits: number; completed: number; withReport: number; leads: number;
  avgInterest: number; lastVisit: string | null; score: number;
}
interface AgPerfData { from: string; to: string; rows: AgRow[] }

// ─── Helpers ─────────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().slice(0, 10);
const weekAgoStr = () => { const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().slice(0, 10); };
const firstOfMonth = () => todayStr().slice(0, 8) + '01';
const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '-';
const monthName = (y: number, m: number) => new Date(y, m - 1, 1).toLocaleString('th-TH', { month: 'long', year: 'numeric' });

function RateChip({ value }: { value: number }) {
  const color = value >= 80 ? 'success' : value >= 50 ? 'warning' : 'error';
  return <Chip size="small" label={`${value}%`} color={color} />;
}

function SummaryCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: number | string; sub?: string }) {
  return (
    <Paper sx={{ p: 2, borderRadius: 3, textAlign: 'center', flex: 1 }}>
      <Box sx={{ color: 'primary.main', mb: 0.5 }}>{icon}</Box>
      <Typography variant="h5" fontWeight={800}>{value}</Typography>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      {sub && <Typography variant="caption" color="text.disabled" display="block">{sub}</Typography>}
    </Paper>
  );
}

// ─── CSV export helper ───────────────────────────────────────────────────────
function exportCsv(headers: string[], rows: (string | number)[][], filename: string) {
  const lines = [headers, ...rows].map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','));
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── Tab 1: Weekly Activity Summary ──────────────────────────────────────────
function WeeklyTab() {
  const { t } = useT();
  const [from, setFrom] = useState(weekAgoStr());
  const [to, setTo] = useState(todayStr());
  const [data, setData] = useState<WeeklyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sellerQ, setSellerQ] = useState('');

  const exportWeeklyCsv = () => {
    if (!data) return;
    const headers = ['Employee', 'Code', 'Visit Agency', 'AG Bring Customer', 'Training', 'Other', 'Call', 'Orientation', 'Customer', 'Holding', 'Follow-up Customer', 'Total', 'Completed', 'Reports', 'Leads', 'Overdue'];
    const rows = data.rows.map((r) => [r.name, r.code, r.visit_agency, r.agency_brings_client, r.training, r.other, r.call, r.orientation, r.customer, r.holding, r.followupCustomer, r.total, r.completed, r.withReport, r.leads, r.overdue]);
    exportCsv(headers, rows, `weekly-activity-${from}-to-${to}.csv`);
  };

  const load = useCallback(() => {
    setLoading(true); setError('');
    api.get('/reports/weekly-activity', { params: { from, to } })
      .then((r) => setData(r.data))
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const cols = [
    { key: 'visit_agency', label: 'Visit Agency Office', color: 'primary.main' },
    { key: 'agency_brings_client', label: 'AG Bring Customer', color: 'success.main' },
    { key: 'training', label: 'Internal Training', color: 'secondary.main' },
    { key: 'other', label: 'Other', color: 'text.secondary' },
    { key: 'call', label: t('kpi.callCount'), color: 'info.main' },
    { key: 'orientation', label: t('kpi.orientationCount'), color: 'warning.main' },
    { key: 'customer', label: t('kpi.customerCount'), color: 'success.main' },
    { key: 'holding', label: t('kpi.holdingCount'), color: 'secondary.main' },
    { key: 'followupCustomer', label: t('kpi.followupCustomer'), color: 'primary.main' },
    { key: 'overdue', label: 'Overdue', color: 'error.main' },
  ];

  const grand = data?.grand;
  const filteredRows = sellerQ ? (data?.rows ?? []).filter((r) =>
    r.name.toLowerCase().includes(sellerQ.toLowerCase()) || r.code.toLowerCase().includes(sellerQ.toLowerCase())
  ) : (data?.rows ?? []);
  const totalLeads = filteredRows.reduce((s, r) => s + r.leads, 0);

  return (
    <Box>
      {/* Controls */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center" flexWrap="wrap">
          <TextField size="small" type="date" label={t('rpt.from')} value={from}
            onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField size="small" type="date" label={t('rpt.to')} value={to}
            onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
          <Button variant="contained" onClick={load} startIcon={<Refresh />}>{t('rpt.viewReport')}</Button>
          <TextField size="small" label={t('c.searchSeller')} value={sellerQ}
            onChange={(e) => setSellerQ(e.target.value)} sx={{ width: 180 }} />
          <Typography variant="caption" color="text.secondary">
            {from && to ? `${fmtDate(from)} — ${fmtDate(to)}` : ''}
          </Typography>
        </Stack>
      </Paper>

      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Summary KPIs */}
      {grand && (
        <Stack direction="row" flexWrap="wrap" gap={2} mb={3}>
          <SummaryCard icon={<Assessment />} label={t('rpt.totalActivities')} value={grand.total} />
          <SummaryCard icon={<CheckCircle />} label={t('rpt.completed')} value={grand.completed} sub={`${grand.total > 0 ? Math.round((grand.completed / grand.total) * 100) : 0}%`} />
          <SummaryCard icon={<BarChart />} label={t('rpt.submitted')} value={grand.withReport} sub={`${grand.completed > 0 ? Math.round((grand.withReport / grand.completed) * 100) : 0}%`} />
          <SummaryCard icon={<TrendingUp />} label={t('rpt.newLead')} value={totalLeads} />
          <SummaryCard icon={<Groups />} label={t('rpt.activeSellers')} value={data?.rows.length ?? 0} />
        </Stack>
      )}

      {/* Activity Matrix Table */}
      {data && filteredRows.length > 0 && (
        <Paper sx={{ borderRadius: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography fontWeight={700}>Weekly Sale Activity Summary</Typography>
            <Button size="small" startIcon={<Download />} onClick={exportWeeklyCsv}>Export CSV</Button>
          </Stack>
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ '& th': { fontWeight: 700, fontSize: 12 } }}>
                  <TableCell>Employee</TableCell>
                  {cols.map((c) => (
                    <TableCell key={c.key} align="center" sx={{ color: c.color }}>
                      {c.label}
                    </TableCell>
                  ))}
                  <TableCell align="center">{t('rpt.total')}</TableCell>
                  <TableCell align="center">{t('rpt.done')}</TableCell>
                  <TableCell align="center">{t('pl2.report')}</TableCell>
                  <TableCell align="center">Lead</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRows.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{r.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{r.code}</Typography>
                    </TableCell>
                    {cols.map((c) => {
                      const val = r[c.key as keyof WeeklyRow] as number;
                      return (
                        <TableCell key={c.key} align="center">
                          {val > 0
                            ? <Chip size="small" label={val} color={c.key === 'overdue' ? 'error' : 'default'} sx={{ fontWeight: 700, minWidth: 32 }} />
                            : <Typography variant="caption" color="text.disabled">-</Typography>}
                        </TableCell>
                      );
                    })}
                    <TableCell align="center"><Typography fontWeight={800}>{r.total}</Typography></TableCell>
                    <TableCell align="center">{r.completed}</TableCell>
                    <TableCell align="center">
                      <RateChip value={r.completed > 0 ? Math.round((r.withReport / r.completed) * 100) : 0} />
                    </TableCell>
                    <TableCell align="center">
                      {r.leads > 0 ? <Chip size="small" label={r.leads} color="success" /> : '-'}
                    </TableCell>
                  </TableRow>
                ))}
                {/* Grand Total */}
                {grand && (
                  <TableRow sx={{ bgcolor: 'action.hover', '& td': { fontWeight: 800 } }}>
                    <TableCell>Grand Total</TableCell>
                    {cols.map((c) => (
                      <TableCell key={c.key} align="center">{grand[c.key as keyof typeof grand] || '-'}</TableCell>
                    ))}
                    <TableCell align="center">{grand.total}</TableCell>
                    <TableCell align="center">{grand.completed}</TableCell>
                    <TableCell align="center">
                      <RateChip value={grand.completed > 0 ? Math.round((grand.withReport / grand.completed) * 100) : 0} />
                    </TableCell>
                    <TableCell align="center">{grand.leads || '-'}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Box>
        </Paper>
      )}
      {data && data.rows.length === 0 && !loading && (
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
          <Typography color="text.secondary">{t('rpt.noDataPeriod')}</Typography>
        </Paper>
      )}
    </Box>
  );
}

// ─── Tab 2: Monthly Submission Log ───────────────────────────────────────────
function MonthlyTab() {
  const { t } = useT();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<MonthlyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true); setError('');
    api.get('/reports/monthly-submission', { params: { year, month } })
      .then((r) => setData(r.data))
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  const exportMonthlyCsv = () => {
    if (!data) return;
    const headers = ['Employee', 'Code', 'Planned', 'Completed', '% Completion', 'Reports Submitted', '% Submission', 'New Leads'];
    const rows = data.rows.map((r) => [r.name, r.code, r.planned, r.completed, r.planned > 0 ? Math.round((r.completed / r.planned) * 100) : 0, r.withReport, r.submissionRate, r.leads]);
    exportCsv(headers, rows, `monthly-submission-${year}-${String(month).padStart(2, '0')}.csv`);
  };

  const YEARS = Array.from({ length: 4 }, (_, i) => now.getFullYear() - i);
  const MONTHS = Array.from({ length: 12 }, (_, i) => ({ val: i + 1, label: new Date(2000, i, 1).toLocaleString('th-TH', { month: 'long' }) }));

  const totalPlanned = data?.rows.reduce((s, r) => s + r.planned, 0) ?? 0;
  const totalCompleted = data?.rows.reduce((s, r) => s + r.completed, 0) ?? 0;
  const totalLeads = data?.rows.reduce((s, r) => s + r.leads, 0) ?? 0;
  const avgRate = data?.rows.length
    ? Math.round(data.rows.reduce((s, r) => s + r.submissionRate, 0) / data.rows.length)
    : 0;

  return (
    <Box>
      {/* Controls */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel>{t('rpt.year')}</InputLabel>
            <Select value={year} label={t('rpt.year')} onChange={(e) => setYear(Number(e.target.value))}>
              {YEARS.map((y) => <MenuItem key={y} value={y}>{y + 543}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>{t('rpt.month')}</InputLabel>
            <Select value={month} label={t('rpt.month')} onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTHS.map((m) => <MenuItem key={m.val} value={m.val}>{m.label}</MenuItem>)}
            </Select>
          </FormControl>
          <Button variant="contained" onClick={load} startIcon={<Refresh />}>{t('rpt.viewReport')}</Button>
          {data && <Typography variant="caption" color="text.secondary">{monthName(year, month)}</Typography>}
        </Stack>
      </Paper>

      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Summary KPIs */}
      {data && (
        <Stack direction="row" flexWrap="wrap" gap={2} mb={3}>
          <SummaryCard icon={<CalendarMonth />} label={t('rpt.totalPlanned')} value={totalPlanned} />
          <SummaryCard icon={<CheckCircle />} label={t('rpt.completed')} value={totalCompleted} sub={`${totalPlanned > 0 ? Math.round((totalCompleted / totalPlanned) * 100) : 0}% completion`} />
          <SummaryCard icon={<Assessment />} label={t('rpt.submitRate')} value={`${avgRate}%`} />
          <SummaryCard icon={<TrendingUp />} label={t('rpt.totalLeads')} value={totalLeads} />
        </Stack>
      )}

      {/* Submission Table */}
      {data && data.rows.length > 0 && (
        <Paper sx={{ borderRadius: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography fontWeight={700}>{t('svr.monthlyLog')} — {monthName(year, month)}</Typography>
            <Button size="small" startIcon={<Download />} onClick={exportMonthlyCsv}>Export CSV</Button>
          </Stack>
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ '& th': { fontWeight: 700 } }}>
                  <TableCell>Employee</TableCell>
                  <TableCell align="center">{t('rpt.totalPlanned')}</TableCell>
                  <TableCell align="center">{t('rpt.completed')}</TableCell>
                  <TableCell align="center">% Completion</TableCell>
                  <TableCell align="center">{t('rpt.submitted')}</TableCell>
                  <TableCell align="center">{t('rpt.pctSubmit')}</TableCell>
                  <TableCell align="center">{t('rpt.newLead')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.rows.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{r.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{r.code}</Typography>
                    </TableCell>
                    <TableCell align="center">{r.planned}</TableCell>
                    <TableCell align="center">{r.completed}</TableCell>
                    <TableCell align="center">
                      <RateChip value={r.planned > 0 ? Math.round((r.completed / r.planned) * 100) : 0} />
                    </TableCell>
                    <TableCell align="center">{r.withReport}</TableCell>
                    <TableCell align="center"><RateChip value={r.submissionRate} /></TableCell>
                    <TableCell align="center">
                      {r.leads > 0 ? <Chip size="small" label={r.leads} color="success" /> : '-'}
                    </TableCell>
                  </TableRow>
                ))}
                {/* Grand row */}
                <TableRow sx={{ bgcolor: 'action.hover', '& td': { fontWeight: 800 } }}>
                  <TableCell>{t('rpt.totalAvg')}</TableCell>
                  <TableCell align="center">{totalPlanned}</TableCell>
                  <TableCell align="center">{totalCompleted}</TableCell>
                  <TableCell align="center">
                    <RateChip value={totalPlanned > 0 ? Math.round((totalCompleted / totalPlanned) * 100) : 0} />
                  </TableCell>
                  <TableCell align="center">{data.rows.reduce((s, r) => s + r.withReport, 0)}</TableCell>
                  <TableCell align="center"><RateChip value={avgRate} /></TableCell>
                  <TableCell align="center">{totalLeads || '-'}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Box>
        </Paper>
      )}
      {data && data.rows.length === 0 && !loading && (
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
          <Typography color="text.secondary">{t('rpt.noDataMonth')}</Typography>
        </Paper>
      )}
    </Box>
  );
}

// ─── Tab 3: Agency Performance ────────────────────────────────────────────────
function AgencyPerfTab() {
  const { t } = useT();
  const { user } = useAuth();
  const isAdmin = ['manager', 'super_admin', 'admin', 'closer'].includes(user?.activeRole ?? '');
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(todayStr());
  const [data, setData] = useState<AgPerfData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true); setError('');
    api.get('/reports/agency-performance', { params: { from, to } })
      .then((r) => setData(r.data))
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
  }, [from, to]);

  useEffect(() => { if (isAdmin) load(); }, [load, isAdmin]);

  const exportAgencyCsv = () => {
    if (!data) return;
    const headers = ['Code', 'Name', 'Zone', 'Province', 'Level', 'Tier', 'Total Plans', 'Completed', 'Reports', 'Leads', 'Avg Interest', 'Last Visit', 'Score'];
    const rows = data.rows.map((r) => [r.code, r.name, r.zone ?? '', r.province ?? '', r.level ?? '', r.tier ?? '', r.visits, r.completed, r.withReport, r.leads, r.avgInterest, r.lastVisit ?? '', r.score]);
    exportCsv(headers, rows, `agency-performance-${from}-to-${to}.csv`);
  };

  if (!isAdmin) return (
    <Alert severity="info">{t('rpt.adminOnly')}</Alert>
  );

  const top3 = data?.rows.slice(0, 3) ?? [];
  const INTEREST_LABEL: Record<string, string> = { '3': t('rpt.interestHigh'), '2': t('rpt.interestMid'), '1': t('rpt.interestLow'), '0': '-' };

  return (
    <Box>
      {/* Controls */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
          <TextField size="small" type="date" label={t('rpt.from')} value={from}
            onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField size="small" type="date" label={t('rpt.to')} value={to}
            onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
          <Button variant="contained" onClick={load} startIcon={<Refresh />}>{t('rpt.viewReport')}</Button>
        </Stack>
      </Paper>

      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Top 3 Podium */}
      {top3.length > 0 && (
        <Stack direction="row" flexWrap="wrap" gap={2} mb={3}>
          {top3.map((a, i) => (
            <Paper key={a.id} sx={{ p: 2, flex: 1, minWidth: 180, borderRadius: 3, border: '2px solid', borderColor: i === 0 ? 'warning.main' : i === 1 ? 'grey.400' : 'warning.light' }}>
              <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                <EmojiEvents sx={{ color: i === 0 ? 'warning.main' : i === 1 ? 'grey.400' : '#cd7f32' }} />
                <Typography fontWeight={800} variant="body2">#{i + 1} {a.name}</Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary">{a.code} · {a.zone ?? '-'}</Typography>
              <Grid container spacing={1} mt={0.5}>
                <Grid item xs={6}><Typography variant="caption" color="text.secondary">Visit</Typography><br /><Typography variant="body2" fontWeight={700}>{a.completed}/{a.visits}</Typography></Grid>
                <Grid item xs={6}><Typography variant="caption" color="text.secondary">Lead</Typography><br /><Typography variant="body2" fontWeight={700}>{a.leads}</Typography></Grid>
              </Grid>
              <Box mt={1}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="caption">Score</Typography>
                  <Typography variant="caption" fontWeight={700}>{a.score}</Typography>
                </Stack>
                <LinearProgress variant="determinate" value={Math.min(100, a.score)} color="primary" sx={{ height: 6, borderRadius: 3 }} />
              </Box>
            </Paper>
          ))}
        </Stack>
      )}

      {/* Full Table */}
      {data && data.rows.length > 0 && (
        <Paper sx={{ borderRadius: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography fontWeight={700}>Agency Performance — {fmtDate(data.from)} {t('rpt.toDate')} {fmtDate(data.to)}</Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="caption" color="text.secondary">{data.rows.length} agencies</Typography>
              <Button size="small" startIcon={<Download />} onClick={exportAgencyCsv}>Export CSV</Button>
            </Stack>
          </Stack>
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ '& th': { fontWeight: 700, fontSize: 12 } }}>
                  <TableCell>#</TableCell>
                  <TableCell>Agency</TableCell>
                  <TableCell>{t('c.zone')}</TableCell>
                  <TableCell>Level</TableCell>
                  <TableCell align="center">Visit</TableCell>
                  <TableCell align="center">{t('rpt.done')}</TableCell>
                  <TableCell align="center">{t('rpt.pctDone')}</TableCell>
                  <TableCell align="center">Lead</TableCell>
                  <TableCell align="center">{t('rpt.interest')}</TableCell>
                  <TableCell align="center">{t('rpt.lastVisit')}</TableCell>
                  <TableCell align="center">Score</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.rows.map((r, i) => {
                  const pct = r.visits > 0 ? Math.round((r.completed / r.visits) * 100) : 0;
                  return (
                    <TableRow key={r.id} hover sx={i < 3 ? { bgcolor: 'action.hover' } : {}}>
                      <TableCell>
                        {i < 3
                          ? <EmojiEvents fontSize="small" sx={{ color: i === 0 ? 'warning.main' : i === 1 ? 'grey.400' : '#cd7f32' }} />
                          : <Typography variant="caption" color="text.secondary">{i + 1}</Typography>}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: 180 }}>{r.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{r.code}</Typography>
                      </TableCell>
                      <TableCell><Typography variant="caption">{r.zone ?? '-'}</Typography></TableCell>
                      <TableCell>
                        {r.level && <Chip size="small" label={`L${r.level}`} variant="outlined" />}
                      </TableCell>
                      <TableCell align="center">{r.visits}</TableCell>
                      <TableCell align="center">{r.completed}</TableCell>
                      <TableCell align="center"><RateChip value={pct} /></TableCell>
                      <TableCell align="center">
                        {r.leads > 0 ? <Chip size="small" label={r.leads} color="success" /> : '-'}
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="caption" color="text.secondary">
                          {INTEREST_LABEL[String(Math.round(r.avgInterest))] ?? '-'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="caption">{fmtDate(r.lastVisit)}</Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography fontWeight={700} color="primary.main">{r.score}</Typography>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        </Paper>
      )}
      {data && data.rows.length === 0 && !loading && (
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
          <Typography color="text.secondary">{t('rpt.noDataAgency')}</Typography>
        </Paper>
      )}
    </Box>
  );
}

// ─── Tab 4: Agency Activity Report ───────────────────────────────────────────
function AgencyActivityTab() {
  const { t } = useT();
  const now = new Date();
  const [from, setFrom] = useState(`${now.getFullYear()}-01-01`);
  const [to, setTo] = useState(todayStr());
  const [data, setData] = useState<AgActivityData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(() => {
    setLoading(true); setError('');
    api.get('/reports/agency-activity', { params: { from, to } })
      .then((r) => setData({ rows: r.data }))
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const rows = (data?.rows ?? []).filter((r) =>
    !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.code.toLowerCase().includes(search.toLowerCase())
  );

  const yesNo = (v: string) => {
    if (v === 'yes') return <Chip size="small" label="Yes" color="success" variant="outlined" />;
    if (v === 'no') return <Chip size="small" label="No" color="default" variant="outlined" />;
    return <Typography variant="caption" color="text.disabled">-</Typography>;
  };

  const gradeColor = (g?: string | null) => {
    if (g === 'A') return 'success';
    if (g === 'B') return 'primary';
    if (g === 'C') return 'warning';
    if (g === 'D') return 'error';
    return 'default';
  };

  return (
    <Box>
      <Paper sx={{ p: 2, mb: 3, borderRadius: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center" flexWrap="wrap">
          <TextField size="small" type="date" label={t('rpt.from')} value={from}
            onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField size="small" type="date" label={t('rpt.to')} value={to}
            onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
          <Button variant="contained" onClick={load} startIcon={<Refresh />}>{t('rpt.load')}</Button>
          <TextField size="small" placeholder={t('rpt.searchAgency')} value={search}
            onChange={(e) => setSearch(e.target.value)} sx={{ minWidth: 200 }} />
          {data && <Typography variant="caption" color="text.secondary">{rows.length} agencies</Typography>}
        </Stack>
      </Paper>

      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {data && rows.length > 0 && (
        <Paper sx={{ borderRadius: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center"
            sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography fontWeight={700}>Agency Activity Report</Typography>
            <Typography variant="caption" color="text.secondary">
              {fmtDate(from)} — {fmtDate(to)}
            </Typography>
          </Stack>
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small" sx={{ minWidth: 1200 }}>
              <TableHead>
                <TableRow sx={{ '& th': { fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap', bgcolor: 'grey.50' } }}>
                  <TableCell>#</TableCell>
                  <TableCell>Agency</TableCell>
                  <TableCell>Grade</TableCell>
                  <TableCell>{t('c.zone')}</TableCell>
                  <TableCell>{t('rpt.responsible')}</TableCell>
                  <TableCell>{t('rpt.contactPerson')}</TableCell>
                  <TableCell align="center">Visit (Done)</TableCell>
                  <TableCell align="center">Last Visit</TableCell>
                  <TableCell align="center">Last Report</TableCell>
                  <TableCell align="center">Lead</TableCell>
                  <TableCell align="center">AG Bring Customer</TableCell>
                  <TableCell align="center">Orientation</TableCell>
                  <TableCell align="center">Last Sale</TableCell>
                  <TableCell align="center">Social Media</TableCell>
                  <TableCell align="center">Paid Ads</TableCell>
                  <TableCell align="center">Materials Given</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={r.id} hover>
                    <TableCell><Typography variant="caption" color="text.disabled">{i + 1}</Typography></TableCell>
                    <TableCell sx={{ minWidth: 160 }}>
                      <Typography variant="body2" fontWeight={700} noWrap sx={{ maxWidth: 160 }}>{r.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{r.code}</Typography>
                    </TableCell>
                    <TableCell>
                      {r.grade
                        ? <Chip size="small" label={r.grade} color={gradeColor(r.grade) as 'success' | 'primary' | 'warning' | 'error' | 'default'} />
                        : <Typography variant="caption" color="text.disabled">-</Typography>}
                    </TableCell>
                    <TableCell><Typography variant="caption">{r.zone ?? '-'}</Typography></TableCell>
                    <TableCell sx={{ minWidth: 100 }}>
                      <Typography variant="caption" noWrap>{r.assignedTo || '-'}</Typography>
                    </TableCell>
                    <TableCell sx={{ minWidth: 100 }}>
                      <Typography variant="caption">{r.contactPerson ?? '-'}</Typography>
                      {r.phone && <Typography variant="caption" color="text.disabled" display="block">{r.phone}</Typography>}
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2" fontWeight={700}>{r.completedVisits}</Typography>
                      {r.totalVisits !== r.completedVisits && (
                        <Typography variant="caption" color="text.disabled">/{r.totalVisits}</Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="caption">{fmtDate(r.lastVisitDate)}</Typography>
                      {r.lastVisitBy && <Typography variant="caption" color="text.secondary" display="block" noWrap>{r.lastVisitBy}</Typography>}
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="caption">{r.lastReportDate ? fmtDate(r.lastReportDate) : '-'}</Typography>
                    </TableCell>
                    <TableCell align="center">
                      {r.leads > 0 ? <Chip size="small" label={r.leads} color="success" /> : <Typography variant="caption" color="text.disabled">-</Typography>}
                    </TableCell>
                    <TableCell align="center">{yesNo(r.bringCustomers)}</TableCell>
                    <TableCell align="center">{yesNo(r.hadOrientation)}</TableCell>
                    <TableCell align="center">
                      <Typography variant="caption">{r.lastSaleDate ? fmtDate(r.lastSaleDate) : '-'}</Typography>
                    </TableCell>
                    <TableCell align="center">{yesNo(r.hasOrganicSocial)}</TableCell>
                    <TableCell align="center">{yesNo(r.hasPaidSocial)}</TableCell>
                    <TableCell align="center">
                      {r.totalMaterials > 0
                        ? <Tooltip title={r.materials.map((m) => `${m.name}: ${m.qty} ${m.unit}`).join(', ')}>
                            <Chip size="small" label={`${r.totalMaterials} ${t('rpt.pieces')}`} color="info" variant="outlined" />
                          </Tooltip>
                        : <Typography variant="caption" color="text.disabled">-</Typography>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </Paper>
      )}
      {data && rows.length === 0 && !loading && (
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
          <Typography color="text.secondary">{t('rpt.noDataAgencyShort')}</Typography>
        </Paper>
      )}
    </Box>
  );
}

// ─── Tab 5: Daily Visit Tracker ───────────────────────────────────────────────
function DailyTrackerTab() {
  const { t } = useT();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [half, setHalf] = useState<1 | 2>(now.getDate() <= 15 ? 1 : 2);
  const [data, setData] = useState<DailyTrackerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true); setError('');
    api.get('/reports/daily-tracker', { params: { year, month, half } })
      .then((r) => setData(r.data))
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
  }, [year, month, half]);

  useEffect(() => { load(); }, [load]);

  const YEARS = Array.from({ length: 4 }, (_, i) => now.getFullYear() - i);
  const MONTHS = Array.from({ length: 12 }, (_, i) => ({
    val: i + 1, label: new Date(2000, i, 1).toLocaleString('th-TH', { month: 'short' }),
  }));

  const achColor = (total: number, target: number) => {
    if (target === 0) return 'default';
    const pct = total / target;
    if (pct >= 1) return 'success';
    if (pct >= 0.5) return 'warning';
    return 'error';
  };

  const cellBg = (cnt: number) => {
    if (cnt === 0) return undefined;
    if (cnt >= 3) return 'success.light';
    if (cnt >= 1) return 'warning.light';
    return undefined;
  };

  const dayLabel = (ds: string) => {
    const d = new Date(ds + 'T00:00:00');
    return `${d.getDate()}`;
  };

  return (
    <Box>
      <Paper sx={{ p: 2, mb: 3, borderRadius: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center" flexWrap="wrap">
          <FormControl size="small" sx={{ minWidth: 90 }}>
            <InputLabel>{t('rpt.year')}</InputLabel>
            <Select value={year} label={t('rpt.year')} onChange={(e) => setYear(Number(e.target.value))}>
              {YEARS.map((y) => <MenuItem key={y} value={y}>{y + 543}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 110 }}>
            <InputLabel>{t('rpt.month')}</InputLabel>
            <Select value={month} label={t('rpt.month')} onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTHS.map((m) => <MenuItem key={m.val} value={m.val}>{m.label}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>{t('rpt.period')}</InputLabel>
            <Select value={half} label={t('rpt.period')} onChange={(e) => setHalf(Number(e.target.value) as 1 | 2)}>
              <MenuItem value={1}>{t('rpt.firstHalf')}</MenuItem>
              <MenuItem value={2}>{t('rpt.secondHalf')}</MenuItem>
            </Select>
          </FormControl>
          <Button variant="contained" onClick={load} startIcon={<Refresh />}>{t('rpt.load')}</Button>

          {data && (
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip size="small" label={`${data.workingDays} ${t('rpt.workingDays')}`} variant="outlined" />
              <Chip size="small" label={`Target ${data.periodTarget} visits`} color="primary" variant="outlined" />
            </Stack>
          )}
        </Stack>
      </Paper>

      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Legend */}
      <Stack direction="row" spacing={2} mb={2} alignItems="center">
        <Typography variant="caption" color="text.secondary">{t('rpt.colorLegend')}</Typography>
        <Box sx={{ px: 1.5, py: 0.3, bgcolor: 'success.light', borderRadius: 1 }}>
          <Typography variant="caption">{t('svr.visitGeq3')}</Typography>
        </Box>
        <Box sx={{ px: 1.5, py: 0.3, bgcolor: 'warning.light', borderRadius: 1 }}>
          <Typography variant="caption">{t('svr.visit12')}</Typography>
        </Box>
        <Box sx={{ px: 1.5, py: 0.3, bgcolor: 'grey.200', borderRadius: 1 }}>
          <Typography variant="caption">{t('rpt.zeroWorkday')}</Typography>
        </Box>
      </Stack>

      {data && data.rows.length > 0 && (
        <Paper sx={{ borderRadius: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center"
            sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography fontWeight={700}>
              {t('svr.dailyTracker')} — {MONTHS.find(m => m.val === data.month)?.label} {data.year + 543}
              {' '}({data.half === 1 ? t('rpt.halfFirst') : t('rpt.halfSecond')})
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Target {data.dailyTarget} visits/day
            </Typography>
          </Stack>
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small" sx={{ minWidth: 900 }}>
              <TableHead>
                <TableRow sx={{ '& th': { fontWeight: 700, fontSize: 11, textAlign: 'center', bgcolor: 'grey.50', py: 0.5 } }}>
                  <TableCell sx={{ textAlign: 'left !important', minWidth: 130 }}>Sales</TableCell>
                  <TableCell sx={{ minWidth: 70 }}>{t('c.team')}</TableCell>
                  {data.dates.map((ds) => (
                    <TableCell key={ds} sx={{ minWidth: 34, px: 0.5 }}>
                      <Box>
                        <Typography variant="caption" fontWeight={700}>{dayLabel(ds)}</Typography>
                        <Typography variant="caption" color="text.disabled" display="block" fontSize={9}>
                          {new Date(ds + 'T00:00:00').toLocaleString('th-TH', { weekday: 'short' })}
                        </Typography>
                      </Box>
                    </TableCell>
                  ))}
                  <TableCell sx={{ minWidth: 50 }}>{t('rpt.total')}</TableCell>
                  <TableCell sx={{ minWidth: 60 }}>Target</TableCell>
                  <TableCell sx={{ minWidth: 60 }}>Ach%</TableCell>
                  <TableCell sx={{ minWidth: 60 }}>{t('rpt.avgPerDay')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.rows.map((r) => {
                  const ach = r.target > 0 ? Math.round((r.total / r.target) * 100) : 0;
                  const avg = data.workingDays > 0 ? (r.total / data.workingDays).toFixed(1) : '0';
                  return (
                    <TableRow key={r.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600} noWrap>{r.name}</Typography>
                        <Typography variant="caption" color="text.disabled">{r.code}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" noWrap>{r.team ?? '-'}</Typography>
                      </TableCell>
                      {data.dates.map((ds) => {
                        const cnt = r.daily[ds] ?? 0;
                        return (
                          <TableCell key={ds} align="center" sx={{ px: 0.5, bgcolor: cellBg(cnt) }}>
                            {cnt > 0
                              ? <Typography variant="caption" fontWeight={700}>{cnt}</Typography>
                              : <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10 }}>-</Typography>}
                          </TableCell>
                        );
                      })}
                      <TableCell align="center">
                        <Typography fontWeight={800} color="primary.main">{r.total}</Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="caption" color="text.secondary">{r.target}</Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip size="small" label={`${ach}%`} color={achColor(r.total, r.target) as 'success' | 'warning' | 'error' | 'default'} />
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="caption">{avg}</Typography>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {/* Grand Total */}
                <TableRow sx={{ bgcolor: 'action.hover', '& td': { fontWeight: 800 } }}>
                  <TableCell colSpan={2}>
                    <Typography fontWeight={800} variant="body2">Grand Total</Typography>
                  </TableCell>
                  {data.dates.map((ds) => {
                    const cnt = data.grand.daily[ds] ?? 0;
                    return (
                      <TableCell key={ds} align="center" sx={{ px: 0.5 }}>
                        {cnt > 0 ? <Typography variant="caption" fontWeight={800}>{cnt}</Typography>
                          : <Typography variant="caption" color="text.disabled">-</Typography>}
                      </TableCell>
                    );
                  })}
                  <TableCell align="center">{data.grand.total}</TableCell>
                  <TableCell align="center">
                    <Typography variant="caption" color="text.secondary">{data.grand.target}</Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Chip size="small"
                      label={`${data.grand.target > 0 ? Math.round((data.grand.total / data.grand.target) * 100) : 0}%`}
                      color={achColor(data.grand.total, data.grand.target) as 'success' | 'warning' | 'error' | 'default'} />
                  </TableCell>
                  <TableCell align="center">
                    <Typography variant="caption">
                      {data.workingDays > 0 && data.rows.length > 0
                        ? (data.grand.total / (data.workingDays * data.rows.length)).toFixed(1)
                        : '-'}
                    </Typography>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Box>
        </Paper>
      )}
      {data && data.rows.length === 0 && !loading && (
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
          <Typography color="text.secondary">{t('rpt.noDataVisit')}</Typography>
        </Paper>
      )}
    </Box>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const { t } = useT();
  const [tab, setTab] = useState(0);

  return (
    <Box>
      <Typography variant="h5" fontWeight={800} mb={3}>Reports</Typography>

      <Paper sx={{ borderRadius: 3, mb: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
          <Tab icon={<BarChart fontSize="small" />} iconPosition="start" label="Weekly Activity" />
          <Tab icon={<CalendarMonth fontSize="small" />} iconPosition="start" label="Monthly Log" />
          <Tab icon={<EmojiEvents fontSize="small" />} iconPosition="start" label="Agency Performance" />
          <Tab icon={<BusinessCenter fontSize="small" />} iconPosition="start" label="Agency Activity Report" />
          <Tab icon={<TableChart fontSize="small" />} iconPosition="start" label={t('svr.dailyTracker')} />
          <Tab icon={<TrendingUp fontSize="small" />} iconPosition="start" label="Sales Dashboard" />
        </Tabs>
      </Paper>

      <Box hidden={tab !== 0}><WeeklyTab /></Box>
      <Box hidden={tab !== 1}><MonthlyTab /></Box>
      <Box hidden={tab !== 2}><AgencyPerfTab /></Box>
      <Box hidden={tab !== 3}><AgencyActivityTab /></Box>
      <Box hidden={tab !== 4}><DailyTrackerTab /></Box>
      <Box hidden={tab !== 5}><SalesDashboardTab /></Box>
    </Box>
  );
}
