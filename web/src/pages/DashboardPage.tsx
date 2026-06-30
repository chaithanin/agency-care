import { useEffect, useState } from 'react';
import {
  Box, Chip, LinearProgress, Paper, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useT } from '../i18n';
import { ExportPdfButton } from '../components/ExportPdfButton';

interface Summary {
  date: string;
  agencies: { total: number; active: number; inactive: number };
  visits: { planned: number; done: number; pending: number; completionPct: number };
  employees: number;
  perEmployee: { employeeId: string; name: string; code: string; planned: number; done: number; completionPct: number }[];
}
interface WeekDay { date: string; planned: number; done: number; }
interface TodayPlan {
  id: string; status: string; planDate: string; actionType?: string | null; priority?: string;
  agency: { code: string; name: string; phone?: string | null; zone?: string | null };
  employee: { name: string; code: string };
  checkin?: { checkinAt: string; withinRadius: boolean } | null;
  report?: { id: string } | null;
}

const todayStr = () => new Date().toISOString().slice(0, 10);

function KpiCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <Paper sx={{ p: 2, flex: 1, borderTop: `3px solid ${color ?? '#6366f1'}` }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="h4" fontWeight={700}>{value}</Typography>
      {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
    </Paper>
  );
}

function WeeklyChart({ days }: { days: WeekDay[] }) {
  if (!days.length) return null;
  const maxVal = Math.max(...days.map((d) => d.planned), 1);
  const BAR_H = 100;
  const BAR_W = 32;
  const GAP = 12;
  const total_w = days.length * (BAR_W + GAP) + 40;

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="subtitle2" fontWeight={700} mb={1}>7-Day Visit Overview</Typography>
      <Box sx={{ overflowX: 'auto' }}>
        <svg width={total_w} height={BAR_H + 40} style={{ display: 'block' }}>
          {days.map((d, i) => {
            const x = 20 + i * (BAR_W + GAP);
            const planH = Math.round((d.planned / maxVal) * BAR_H);
            const doneH = Math.round((d.done / maxVal) * BAR_H);
            const label = d.date.slice(5); // MM-DD
            return (
              <g key={d.date}>
                {/* planned bar */}
                <rect x={x} y={BAR_H - planH} width={BAR_W} height={planH} fill="#e0e7ff" rx={3} />
                {/* done bar */}
                <rect x={x} y={BAR_H - doneH} width={BAR_W} height={doneH} fill="#6366f1" rx={3} />
                {/* count label */}
                <text x={x + BAR_W / 2} y={BAR_H - planH - 4} textAnchor="middle" fontSize={10} fill="#555">
                  {d.planned > 0 ? `${d.done}/${d.planned}` : ''}
                </text>
                {/* date label */}
                <text x={x + BAR_W / 2} y={BAR_H + 14} textAnchor="middle" fontSize={10} fill="#888">
                  {label}
                </text>
              </g>
            );
          })}
        </svg>
      </Box>
      <Stack direction="row" spacing={2} mt={0.5}>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Box sx={{ width: 12, height: 12, bgcolor: '#6366f1', borderRadius: 1 }} />
          <Typography variant="caption">Done</Typography>
        </Stack>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Box sx={{ width: 12, height: 12, bgcolor: '#e0e7ff', borderRadius: 1 }} />
          <Typography variant="caption">Planned</Typography>
        </Stack>
      </Stack>
    </Paper>
  );
}

const statusColor: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info' | 'primary'> = {
  pending: 'warning', confirmed: 'primary', done: 'success', cancelled: 'error',
  rescheduled: 'default', on_route: 'primary',
};

export default function DashboardPage() {
  const { t } = useT();
  const [date, setDate] = useState(todayStr());
  const [planFrom, setPlanFrom] = useState(todayStr());
  const [planTo, setPlanTo] = useState(todayStr());
  const [rangeMode, setRangeMode] = useState(false);
  const [data, setData] = useState<Summary | null>(null);
  const [weekDays, setWeekDays] = useState<WeekDay[]>([]);
  const [todayPlans, setTodayPlans] = useState<TodayPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [plansLoading, setPlansLoading] = useState(false);

  useEffect(() => {
    api.get('/dashboard/weekly').then((r) => setWeekDays(r.data.days ?? []));
  }, []);

  useEffect(() => {
    setLoading(true);
    api.get('/dashboard/summary', { params: { date } })
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  }, [date]);

  const loadPlans = () => {
    setPlansLoading(true);
    const params = rangeMode ? { from: planFrom, to: planTo } : { date };
    api.get('/dashboard/today-plans', { params })
      .then((r) => setTodayPlans(r.data ?? []))
      .finally(() => setPlansLoading(false));
  };

  useEffect(() => { loadPlans(); }, [date, rangeMode, planFrom, planTo]);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={1}>
        <Typography variant="h5" fontWeight={700}>{t('dash.title')}</Typography>
        <TextField size="small" type="date" label={t('dash.selectDate')} value={date}
          onChange={(e) => setDate(e.target.value)} InputLabelProps={{ shrink: true }} />
      </Stack>

      {loading && <LinearProgress sx={{ mb: 1 }} />}

      {/* KPI cards */}
      {data && (
        <Stack direction="row" spacing={2} mb={3} flexWrap="wrap" useFlexGap>
          <KpiCard label={t('dash.totalAgencies')} value={data.agencies.total}
            sub={`Active ${data.agencies.active}`} color="#6366f1" />
          <KpiCard label={t('dash.todayPlan')} value={data.visits.planned}
            color="#0ea5e9" />
          <KpiCard label={t('dash.visited')} value={data.visits.done}
            sub={`${t('c.remaining')} ${data.visits.pending}`} color="#22c55e" />
          <KpiCard label={t('dash.completion')} value={`${data.visits.completionPct}%`}
            color={data.visits.completionPct >= 80 ? '#22c55e' : data.visits.completionPct >= 50 ? '#f59e0b' : '#ef4444'} />
        </Stack>
      )}

      {/* Weekly chart */}
      {weekDays.length > 0 && (
        <Box mb={3}>
          <WeeklyChart days={weekDays} />
        </Box>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 3 }}>
        {/* Per-seller summary */}
        {data && (
          <Paper sx={{ p: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1} flexWrap="wrap" gap={1}>
              <Typography variant="subtitle1" fontWeight={700}>
                {t('dash.sellerToday')} — {date}
              </Typography>
              <ExportPdfButton tableId="seller-summary-table" filename="seller-summary" title="Seller Summary" size="small" variant="outlined" />
            </Stack>
            <Table size="small" id="seller-summary-table">
              <TableHead>
                <TableRow>
                  <TableCell>{t('c.seller')}</TableCell>
                  <TableCell align="right">{t('c.plan')}</TableCell>
                  <TableCell align="right">{t('c.done')}</TableCell>
                  <TableCell align="right">%</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.perEmployee.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ color: 'text.secondary' }}>
                      {t('dash.noPlan')}
                    </TableCell>
                  </TableRow>
                )}
                {data.perEmployee.map((e) => (
                  <TableRow key={e.employeeId}>
                    <TableCell>
                      {e.name} <Typography component="span" variant="caption" color="text.secondary">({e.code})</Typography>
                    </TableCell>
                    <TableCell align="right">{e.planned}</TableCell>
                    <TableCell align="right">{e.done}</TableCell>
                    <TableCell align="right">
                      <Chip size="small" label={`${e.completionPct}%`}
                        color={e.completionPct >= 80 ? 'success' : e.completionPct >= 50 ? 'warning' : 'default'} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        )}

        {/* Today's plan detail */}
        <Paper sx={{ p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1} flexWrap="wrap" gap={1}>
            <Typography variant="subtitle1" fontWeight={700}>
              {rangeMode ? 'Visit Plan' : t('dash.todayPlanList')} ({todayPlans.length})
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <ExportPdfButton tableId="today-plans-table" filename="today-plans" title="Today's Plans" size="small" variant="outlined" />
              <Chip size="small" label={rangeMode ? 'Date Range' : 'Single Day'}
                color={rangeMode ? 'primary' : 'default'} clickable onClick={() => setRangeMode((v) => !v)} />
              {rangeMode && (
                <>
                  <TextField size="small" type="date" label="From" value={planFrom}
                    onChange={(e) => setPlanFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
                  <TextField size="small" type="date" label="To" value={planTo}
                    onChange={(e) => setPlanTo(e.target.value)} InputLabelProps={{ shrink: true }} />
                </>
              )}
            </Stack>
          </Stack>
          {plansLoading && <LinearProgress sx={{ mb: 1 }} />}
          <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
            <Table size="small" stickyHeader id="today-plans-table">
              <TableHead>
                <TableRow>
                  {rangeMode && <TableCell>Date</TableCell>}
                  <TableCell>Agency</TableCell>
                  <TableCell>{t('c.seller')}</TableCell>
                  <TableCell>{t('c.status')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {todayPlans.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={rangeMode ? 4 : 3} align="center" sx={{ color: 'text.secondary' }}>
                      {t('dash.noPlan')}
                    </TableCell>
                  </TableRow>
                )}
                {todayPlans.map((p) => (
                  <TableRow key={p.id} hover>
                    {rangeMode && <TableCell><Typography variant="caption">{p.planDate?.slice(0, 10)}</Typography></TableCell>}
                    <TableCell>
                      <Tooltip title={p.agency.phone ?? ''}>
                        <Typography component={Link} to={`/visits/${p.id}`} variant="body2"
                          sx={{ textDecoration: 'none', color: 'inherit', '&:hover': { textDecoration: 'underline' } }}>
                          {p.agency.code} {p.agency.name}
                        </Typography>
                      </Tooltip>
                      {p.agency.zone && (
                        <Typography variant="caption" color="text.secondary" display="block">{p.agency.zone}</Typography>
                      )}
                    </TableCell>
                    <TableCell><Typography variant="caption">{p.employee.name}</Typography></TableCell>
                    <TableCell>
                      <Stack spacing={0.3}>
                        <Chip size="small" label={p.status} color={statusColor[p.status] ?? 'default'} />
                        {p.checkin && <Chip size="small" label="✓ Check-in" color="success" variant="outlined" />}
                        {p.report && <Chip size="small" label="✓ Report" color="info" variant="outlined" />}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}
