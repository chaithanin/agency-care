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
  CalendarMonth,
  CheckCircle,
  Download,
  EmojiEvents,
  Groups,
  Refresh,
  TrendingUp,
} from '@mui/icons-material';
import { api, errMsg } from '../api/client';
import { useAuth } from '../auth/AuthContext';

// ─── Types ───────────────────────────────────────────────────────────────────
interface WeeklyRow {
  id: string; code: string; name: string;
  visit_agency: number; agency_brings_client: number;
  training: number; other: number;
  total: number; completed: number; withReport: number; leads: number;
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

// ─── Tab 1: Weekly Activity Summary ──────────────────────────────────────────
function WeeklyTab() {
  const [from, setFrom] = useState(weekAgoStr());
  const [to, setTo] = useState(todayStr());
  const [data, setData] = useState<WeeklyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
  ];

  const grand = data?.grand;
  const totalLeads = data?.rows.reduce((s, r) => s + r.leads, 0) ?? 0;

  return (
    <Box>
      {/* Controls */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
          <TextField size="small" type="date" label="จาก" value={from}
            onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField size="small" type="date" label="ถึง" value={to}
            onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
          <Button variant="contained" onClick={load} startIcon={<Refresh />}>ดูรายงาน</Button>
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
          <SummaryCard icon={<Assessment />} label="กิจกรรมทั้งหมด" value={grand.total} />
          <SummaryCard icon={<CheckCircle />} label="เสร็จแล้ว" value={grand.completed} sub={`${grand.total > 0 ? Math.round((grand.completed / grand.total) * 100) : 0}%`} />
          <SummaryCard icon={<BarChart />} label="ส่งรายงาน" value={grand.withReport} sub={`${grand.completed > 0 ? Math.round((grand.withReport / grand.completed) * 100) : 0}%`} />
          <SummaryCard icon={<TrendingUp />} label="Lead ใหม่" value={totalLeads} />
          <SummaryCard icon={<Groups />} label="เซลส์ที่มีกิจกรรม" value={data?.rows.length ?? 0} />
        </Stack>
      )}

      {/* Activity Matrix Table */}
      {data && data.rows.length > 0 && (
        <Paper sx={{ borderRadius: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography fontWeight={700}>Weekly Sale Activity Summary</Typography>
            <Tooltip title="Export (ต้องการ backend เพิ่มเติม)">
              <span><Button size="small" startIcon={<Download />} disabled>Export Excel</Button></span>
            </Tooltip>
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
                  <TableCell align="center">รวม</TableCell>
                  <TableCell align="center">เสร็จ</TableCell>
                  <TableCell align="center">รายงาน</TableCell>
                  <TableCell align="center">Lead</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.rows.map((r) => (
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
                            ? <Chip size="small" label={val} color="default" sx={{ fontWeight: 700, minWidth: 32 }} />
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
          <Typography color="text.secondary">ไม่พบข้อมูลในช่วงวันที่นี้</Typography>
        </Paper>
      )}
    </Box>
  );
}

// ─── Tab 2: Monthly Submission Log ───────────────────────────────────────────
function MonthlyTab() {
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
            <InputLabel>ปี</InputLabel>
            <Select value={year} label="ปี" onChange={(e) => setYear(Number(e.target.value))}>
              {YEARS.map((y) => <MenuItem key={y} value={y}>{y + 543}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>เดือน</InputLabel>
            <Select value={month} label="เดือน" onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTHS.map((m) => <MenuItem key={m.val} value={m.val}>{m.label}</MenuItem>)}
            </Select>
          </FormControl>
          <Button variant="contained" onClick={load} startIcon={<Refresh />}>ดูรายงาน</Button>
          {data && <Typography variant="caption" color="text.secondary">{monthName(year, month)}</Typography>}
        </Stack>
      </Paper>

      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Summary KPIs */}
      {data && (
        <Stack direction="row" flexWrap="wrap" gap={2} mb={3}>
          <SummaryCard icon={<CalendarMonth />} label="แผนทั้งหมด" value={totalPlanned} />
          <SummaryCard icon={<CheckCircle />} label="เสร็จแล้ว" value={totalCompleted} sub={`${totalPlanned > 0 ? Math.round((totalCompleted / totalPlanned) * 100) : 0}% completion`} />
          <SummaryCard icon={<Assessment />} label="อัตราส่งรายงาน" value={`${avgRate}%`} />
          <SummaryCard icon={<TrendingUp />} label="Lead รวม" value={totalLeads} />
        </Stack>
      )}

      {/* Submission Table */}
      {data && data.rows.length > 0 && (
        <Paper sx={{ borderRadius: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography fontWeight={700}>Monthly Report Submission Log — {monthName(year, month)}</Typography>
            <Tooltip title="Export (ต้องการ backend เพิ่มเติม)">
              <span><Button size="small" startIcon={<Download />} disabled>Export Excel</Button></span>
            </Tooltip>
          </Stack>
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ '& th': { fontWeight: 700 } }}>
                  <TableCell>Employee</TableCell>
                  <TableCell align="center">แผนทั้งหมด</TableCell>
                  <TableCell align="center">เสร็จแล้ว</TableCell>
                  <TableCell align="center">% Completion</TableCell>
                  <TableCell align="center">ส่งรายงาน</TableCell>
                  <TableCell align="center">% ส่งรายงาน</TableCell>
                  <TableCell align="center">Lead ใหม่</TableCell>
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
                  <TableCell>รวม / เฉลี่ย</TableCell>
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
          <Typography color="text.secondary">ไม่พบข้อมูลในเดือนนี้</Typography>
        </Paper>
      )}
    </Box>
  );
}

// ─── Tab 3: Agency Performance ────────────────────────────────────────────────
function AgencyPerfTab() {
  const { user } = useAuth();
  const isAdmin = ['super_admin', 'admin', 'closer'].includes(user?.activeRole ?? '');
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

  if (!isAdmin) return (
    <Alert severity="info">รายงานนี้สำหรับ Admin และ Closer เท่านั้น</Alert>
  );

  const top3 = data?.rows.slice(0, 3) ?? [];
  const INTEREST_LABEL: Record<string, string> = { '3': 'สูง', '2': 'กลาง', '1': 'ต่ำ', '0': '-' };

  return (
    <Box>
      {/* Controls */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
          <TextField size="small" type="date" label="จาก" value={from}
            onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField size="small" type="date" label="ถึง" value={to}
            onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
          <Button variant="contained" onClick={load} startIcon={<Refresh />}>ดูรายงาน</Button>
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
            <Typography fontWeight={700}>Agency Performance — {fmtDate(data.from)} ถึง {fmtDate(data.to)}</Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="caption" color="text.secondary">{data.rows.length} agencies</Typography>
              <Tooltip title="Export (ต้องการ backend เพิ่มเติม)">
                <span><Button size="small" startIcon={<Download />} disabled>Export Excel</Button></span>
              </Tooltip>
            </Stack>
          </Stack>
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ '& th': { fontWeight: 700, fontSize: 12 } }}>
                  <TableCell>#</TableCell>
                  <TableCell>Agency</TableCell>
                  <TableCell>โซน</TableCell>
                  <TableCell>Level</TableCell>
                  <TableCell align="center">Visit</TableCell>
                  <TableCell align="center">เสร็จ</TableCell>
                  <TableCell align="center">% เสร็จ</TableCell>
                  <TableCell align="center">Lead</TableCell>
                  <TableCell align="center">ความสนใจ</TableCell>
                  <TableCell align="center">ครั้งล่าสุด</TableCell>
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
          <Typography color="text.secondary">ไม่พบข้อมูล Agency ในช่วงนี้</Typography>
        </Paper>
      )}
    </Box>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [tab, setTab] = useState(0);

  return (
    <Box>
      <Typography variant="h5" fontWeight={800} mb={3}>Reports</Typography>

      <Paper sx={{ borderRadius: 3, mb: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
          <Tab icon={<BarChart fontSize="small" />} iconPosition="start" label="Weekly Activity Summary" />
          <Tab icon={<CalendarMonth fontSize="small" />} iconPosition="start" label="Monthly Report Log" />
          <Tab icon={<EmojiEvents fontSize="small" />} iconPosition="start" label="Agency Performance" />
        </Tabs>
      </Paper>

      <Box hidden={tab !== 0}><WeeklyTab /></Box>
      <Box hidden={tab !== 1}><MonthlyTab /></Box>
      <Box hidden={tab !== 2}><AgencyPerfTab /></Box>
    </Box>
  );
}
