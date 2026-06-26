import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Stack,
  TextField,
  Chip,
  LinearProgress,
  Button,
  Grid,
  Alert,
  Snackbar,
  IconButton,
  Collapse,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { api, errMsg } from '../api/client';
import { PdfExportButton } from '../utils/pdf';
import { useT } from '../i18n';
import { useAuth } from '../auth/AuthContext';

interface TeamRow {
  teamId: string;
  code: string;
  name: string;
  zone: string | null;
  sales: number;
  closer: number;
  agencies: number;
  visitTarget: number;
  visited: number;
  remaining: number;
  progressPct: number;
}
interface Coverage {
  totalAgencies: number;
  pass: number;
  partial: number;
  none: number;
  coveragePct: number;
}
interface Office {
  date: string;
  need: { sales: number; closer: number };
  inOffice: { sales: string[]; closer: string[] };
  ok: boolean;
  warning: string | null;
}
interface NewAgencyRow {
  employeeId: string;
  name: string;
  code: string;
  target: number;
  actual: number;
  remaining: number;
  ok: boolean;
}
interface MonthlyRow {
  employeeId: string;
  name: string;
  team: string | null;
  inTraining: boolean;
  agencies: number;
  target: number;
  visited: number;
  remaining: number;
  pct: number;
  status: string;
}
interface LiveRow {
  employeeId: string;
  name: string;
  position: string;
  state: string;
  detail: string;
}
interface TargetRow {
  employeeId: string;
  name: string;
  code: string;
  position: string;
  visitTarget: number;
  newAgencyTarget: number;
}
const statusEmoji: Record<string, string> = { green: '🟢', yellow: '🟡', red: '🔴', blue: '🔵', gray: '⚪' };

const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const thisMonth = () => new Date().toISOString().slice(0, 7);

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <Paper sx={{ p: 2, textAlign: 'center' }}>
      <Typography variant="h4" fontWeight={700} color={color}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Paper>
  );
}

export default function SchedulingPage() {
  const { t } = useT();
  const { user } = useAuth();
  const isAdmin = ['manager', 'super_admin', 'admin'].includes(user?.activeRole ?? '');
  const [month, setMonth] = useState(thisMonth());
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [office, setOffice] = useState<Office | null>(null);
  const [newAgency, setNewAgency] = useState<NewAgencyRow[]>([]);
  const [monthly, setMonthly] = useState<MonthlyRow[]>([]);
  const [live, setLive] = useState<LiveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const pdfRef = useRef<HTMLDivElement>(null);

  // Company Holidays
  const [holidayMonth, setHolidayMonth] = useState(thisMonth());
  const [companyHolidays, setCompanyHolidays] = useState<Set<string>>(new Set());
  const [holidayLoading, setHolidayLoading] = useState(false);
  const [holidayOpen, setHolidayOpen] = useState(false);

  // Monthly Targets
  const [targets, setTargets] = useState<TargetRow[]>([]);
  const [targetsOpen, setTargetsOpen] = useState(false);
  const [editingCell, setEditingCell] = useState<{ empId: string; field: 'visitTarget' | 'newAgencyTarget' } | null>(null);
  const [editingValue, setEditingValue] = useState('');

  const holidayCells = useMemo(() => {
    const [y, m] = holidayMonth.split('-').map(Number);
    const dim = new Date(y, m, 0).getDate();
    const lead = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
    const cells: (string | null)[] = Array(lead).fill(null);
    for (let d = 1; d <= dim; d++) {
      cells.push(`${holidayMonth}-${String(d).padStart(2, '0')}`);
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [holidayMonth]);

  const prevHolidayMonth = () => {
    const [y, m] = holidayMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    setHolidayMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  const nextHolidayMonth = () => {
    const [y, m] = holidayMonth.split('-').map(Number);
    const d = new Date(y, m, 1);
    setHolidayMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const loadCompanyHolidays = useCallback(async (ym: string) => {
    const [y, m] = ym.split('-').map(Number);
    setHolidayLoading(true);
    try {
      const r = await api.get('/scheduling/company-holidays', { params: { year: y, month: m } });
      setCompanyHolidays(new Set((r.data.holidays as { date: string }[]).map((h) => h.date)));
    } catch (e) {
      setToast(errMsg(e));
    } finally {
      setHolidayLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin && holidayOpen) loadCompanyHolidays(holidayMonth);
  }, [holidayMonth, holidayOpen, isAdmin, loadCompanyHolidays]);

  const toggleCompanyHoliday = async (ds: string) => {
    try {
      await api.post('/scheduling/company-holidays/toggle', { date: ds });
      loadCompanyHolidays(holidayMonth);
    } catch (e) {
      setToast(errMsg(e));
    }
  };

  const loadTargets = useCallback(async (ym: string) => {
    const [y, m] = ym.split('-').map(Number);
    try {
      const r = await api.get('/scheduling/targets', { params: { year: y, month: m } });
      setTargets(r.data.rows);
    } catch (e) {
      setToast(errMsg(e));
    }
  }, []);

  useEffect(() => {
    if (isAdmin && targetsOpen) loadTargets(month);
  }, [month, targetsOpen, isAdmin, loadTargets]);

  const startEdit = (empId: string, field: 'visitTarget' | 'newAgencyTarget', currentValue: number) => {
    setEditingCell({ empId, field });
    setEditingValue(String(currentValue));
  };

  const commitEdit = async (empId: string) => {
    if (!editingCell || editingCell.empId !== empId) return;
    const row = targets.find((r) => r.employeeId === empId);
    if (!row) return;
    const [y, m] = month.split('-').map(Number);
    const updated = {
      employeeId: empId,
      year: y,
      month: m,
      visitTarget: editingCell.field === 'visitTarget' ? Number(editingValue) : row.visitTarget,
      newAgencyTarget: editingCell.field === 'newAgencyTarget' ? Number(editingValue) : row.newAgencyTarget,
    };
    setEditingCell(null);
    try {
      await api.put('/scheduling/targets', updated);
      loadTargets(month);
    } catch (e) {
      setToast(errMsg(e));
    }
  };

  const ym = useCallback(() => {
    const [y, m] = month.split('-').map(Number);
    return { year: y, month: m };
  }, [month]);

  const load = useCallback(async () => {
    setLoading(true);
    const { year, month: m } = ym();
    try {
      const [td, cov, off, na, md, lv] = await Promise.all([
        api.get('/scheduling/team-dashboard', { params: { year, month: m } }),
        api.get('/scheduling/coverage', { params: { year, month: m } }),
        api.get('/scheduling/office'),
        api.get('/scheduling/new-agency', { params: { year, month: m } }),
        api.get('/scheduling/monthly-dashboard', { params: { year, month: m } }),
        api.get('/scheduling/live'),
      ]);
      setTeams(td.data.teams);
      setCoverage(cov.data);
      setOffice(off.data);
      setNewAgency(na.data.rows);
      setMonthly(md.data.rows);
      setLive(lv.data.rows);
    } catch (e) {
      setToast(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [ym]);

  useEffect(() => {
    load();
  }, [load]);

  const generate = async () => {
    setGenerating(true);
    try {
      const { year, month: m } = ym();
      const r = await api.post('/scheduling/generate-month', { year, month: m });
      setToast(
        r.data.error ??
          `${t('sch.genMonthDone')}: ${r.data.scheduledVisits} ${t('sp.visits')} · ${t('sch.covered')} ${r.data.agenciesScheduled}/${r.data.agenciesAssigned} ${t('sch.shops')}`,
      );
      await load();
    } catch (e) {
      setToast(errMsg(e));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Box ref={pdfRef}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={1}>
        <Typography variant="h5" fontWeight={700}>
          {t('page.scheduling')}
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField type="month" size="small" value={month} onChange={(e) => setMonth(e.target.value)} />
          <Button className="no-pdf" variant="contained" onClick={generate} disabled={generating}>
            {generating ? t('sch.generating') : t('sch.genMonth')}
          </Button>
          <PdfExportButton targetRef={pdfRef} filename={`${t('sch.pdfFilename')}-${month}.pdf`} />
        </Stack>
      </Stack>

      {loading ? (
        <LinearProgress />
      ) : (
        <Stack spacing={3}>
          {/* coverage summary */}
          {coverage && (
            <Grid container spacing={2}>
              <Grid item xs={6} md={3}>
                <StatCard label={t('dash.totalAgencies')} value={coverage.totalAgencies} />
              </Grid>
              <Grid item xs={6} md={3}>
                <StatCard label={t('sch.coverPass')} value={coverage.pass} color="success.main" />
              </Grid>
              <Grid item xs={6} md={3}>
                <StatCard label={t('sch.coverPartial')} value={coverage.partial} color="warning.main" />
              </Grid>
              <Grid item xs={6} md={3}>
                <StatCard label={t('sch.coverNone')} value={coverage.none} color="error.main" />
              </Grid>
            </Grid>
          )}

          {/* office status */}
          {office && (
            <Alert severity={office.ok ? 'success' : 'warning'}>
              <b>{t('sch.officeToday')} ({office.date}):</b> Sales {office.inOffice.sales.length}/{office.need.sales} ·
              Closer {office.inOffice.closer.length}/{office.need.closer}
              {office.warning ? ` — ${office.warning}` : ` — ${t('sch.allRulesOk')}`}
              {office.inOffice.sales.length + office.inOffice.closer.length > 0 && (
                <Typography variant="caption" display="block">
                  {t('sch.inOffice')}: {[...office.inOffice.sales, ...office.inOffice.closer].join(', ') || '-'}
                </Typography>
              )}
            </Alert>
          )}

          {/* live status — เซลส์อยู่ไหนตอนนี้ */}
          {live.length > 0 && (
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" fontWeight={700} mb={1}>
                {t('sch.live')}
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {live.map((l) => (
                  <Chip key={l.employeeId} label={`${statusEmoji[l.state] ?? ''} ${l.name}: ${l.detail}`} variant="outlined" />
                ))}
              </Stack>
            </Paper>
          )}

          {/* Dashboard รายเดือน (ต่อเซลส์) */}
          <Paper>
            <Typography variant="subtitle1" fontWeight={700} sx={{ p: 2, pb: 1 }}>
              {t('sch.monthlyDash')}
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('c.seller')}</TableCell>
                  <TableCell align="right">{t('sch.agencyDuty')}</TableCell>
                  <TableCell align="right">{t('sch.visitTarget')}</TableCell>
                  <TableCell align="right">{t('c.visited')}</TableCell>
                  <TableCell align="right">{t('c.remaining')}</TableCell>
                  <TableCell align="center">{t('c.status')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {monthly.map((r) => (
                  <TableRow key={r.employeeId}>
                    <TableCell>
                      {r.name}{r.inTraining ? ' 🎓' : ''}
                      <Typography variant="caption" color="text.secondary" display="block">{r.team}</Typography>
                    </TableCell>
                    <TableCell align="right">{r.agencies}</TableCell>
                    <TableCell align="right">{r.target}</TableCell>
                    <TableCell align="right">{r.visited}</TableCell>
                    <TableCell align="right">{r.remaining}</TableCell>
                    <TableCell align="center">{statusEmoji[r.status]} {r.pct}%</TableCell>
                  </TableRow>
                ))}
                {monthly.length === 0 && (
                  <TableRow><TableCell colSpan={6} align="center" sx={{ color: 'text.secondary' }}>
                    {t('sch.noPlan')}
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>

          {/* team dashboard */}
          <Paper>
            <Typography variant="subtitle1" fontWeight={700} sx={{ p: 2, pb: 1 }}>
              {t('sch.teamDash')}
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('c.team')}</TableCell>
                  <TableCell align="right">{t('sched.colSales')}</TableCell>
                  <TableCell align="right">{t('sched.colCloser')}</TableCell>
                  <TableCell align="right">{t('sched.colAgency')}</TableCell>
                  <TableCell align="right">{t('sch.visitTarget')}</TableCell>
                  <TableCell align="right">{t('c.visited')}</TableCell>
                  <TableCell align="right">{t('c.remaining')}</TableCell>
                  <TableCell align="center" sx={{ minWidth: 120 }}>{t('sch.progress')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {teams.map((t) => (
                  <TableRow key={t.teamId}>
                    <TableCell>
                      <b>{t.name}</b>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {t.zone}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{t.sales}</TableCell>
                    <TableCell align="right">{t.closer}</TableCell>
                    <TableCell align="right">{t.agencies}</TableCell>
                    <TableCell align="right">{t.visitTarget}</TableCell>
                    <TableCell align="right">{t.visited}</TableCell>
                    <TableCell align="right">{t.remaining}</TableCell>
                    <TableCell align="center">
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(100, t.progressPct)}
                          sx={{ flexGrow: 1, height: 8, borderRadius: 4 }}
                        />
                        <Typography variant="caption">{t.progressPct}%</Typography>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {teams.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ color: 'text.secondary' }}>
                      {t('sch.noTeam')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>

          {/* new agency targets */}
          <Paper>
            <Typography variant="subtitle1" fontWeight={700} sx={{ p: 2, pb: 1 }}>
              {t('sch.newAgencyTarget')}
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('c.seller')}</TableCell>
                  <TableCell align="right">{t('c.target')}</TableCell>
                  <TableCell align="right">{t('sch.added')}</TableCell>
                  <TableCell align="right">{t('c.remaining')}</TableCell>
                  <TableCell align="center">{t('c.status')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {newAgency.map((r) => (
                  <TableRow key={r.employeeId}>
                    <TableCell>
                      {r.name}{' '}
                      <Typography component="span" variant="caption" color="text.secondary">
                        ({r.code})
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{r.target}</TableCell>
                    <TableCell align="right">{r.actual}</TableCell>
                    <TableCell align="right">{r.remaining}</TableCell>
                    <TableCell align="center">
                      <Chip size="small" label={r.ok ? t('c.pass') : t('c.notyet')} color={r.ok ? 'success' : 'warning'} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>

          {/* ===== Admin: Company Holidays ===== */}
          {isAdmin && (
            <Paper>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ p: 2, pb: holidayOpen ? 1 : 2, cursor: 'pointer' }}
                onClick={() => setHolidayOpen((v) => !v)}
              >
                <Typography variant="subtitle1" fontWeight={700}>
                  {t('sched.companyHolidays')}
                </Typography>
                <IconButton size="small">
                  {holidayOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              </Stack>
              <Collapse in={holidayOpen}>
                <Box sx={{ px: 2, pb: 2 }}>
                  {holidayLoading && <LinearProgress sx={{ mb: 1 }} />}
                  <Stack direction="row" alignItems="center" justifyContent="center" spacing={1} mb={1.5}>
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); prevHolidayMonth(); }}>
                      <ChevronLeftIcon />
                    </IconButton>
                    <Typography fontWeight={600}>{holidayMonth}</Typography>
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); nextHolidayMonth(); }}>
                      <ChevronRightIcon />
                    </IconButton>
                  </Stack>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 0.5, mb: 0.5 }}>
                    {DOW.map((d) => (
                      <Typography key={d} variant="caption" fontWeight={700} textAlign="center" color="text.secondary">{d}</Typography>
                    ))}
                  </Box>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 0.5 }}>
                    {holidayCells.map((ds, i) =>
                      ds ? (
                        <Box
                          key={ds}
                          onClick={() => toggleCompanyHoliday(ds)}
                          sx={{
                            height: 44, display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center', borderRadius: 1,
                            border: 1, borderColor: companyHolidays.has(ds) ? 'error.main' : 'divider',
                            bgcolor: companyHolidays.has(ds) ? 'error.50' : 'background.paper',
                            cursor: 'pointer',
                            '&:hover': { bgcolor: companyHolidays.has(ds) ? 'error.100' : 'action.hover' },
                          }}
                        >
                          <Typography variant="body2" fontWeight={companyHolidays.has(ds) ? 700 : 400}>
                            {Number(ds.slice(8))}
                          </Typography>
                          {companyHolidays.has(ds) && (
                            <Typography variant="caption" sx={{ fontSize: 9, color: 'error.main', lineHeight: 1 }}>
                              {t('sched.holidayLabel')}
                            </Typography>
                          )}
                        </Box>
                      ) : <Box key={i} />
                    )}
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
                    {t('sched.holidayClickHint')}
                  </Typography>
                </Box>
              </Collapse>
            </Paper>
          )}

          {/* ===== Admin: Monthly Targets ===== */}
          {isAdmin && (
            <Paper>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ p: 2, pb: targetsOpen ? 1 : 2, cursor: 'pointer' }}
                onClick={() => setTargetsOpen((v) => !v)}
              >
                <Typography variant="subtitle1" fontWeight={700}>
                  {t('sched.monthlyTargets')}
                </Typography>
                <IconButton size="small">
                  {targetsOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              </Stack>
              <Collapse in={targetsOpen}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>{t('sched.colEmployee')}</TableCell>
                      <TableCell align="center">{t('sched.colPosition')}</TableCell>
                      <TableCell align="right">{t('sched.colVisitTarget')}</TableCell>
                      <TableCell align="right">{t('sched.colNewAgencyTarget')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {targets.map((r) => (
                      <TableRow key={r.employeeId}>
                        <TableCell>
                          {r.name}{' '}
                          <Typography component="span" variant="caption" color="text.secondary">
                            ({r.code})
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip size="small" label={r.position} color={r.position === 'closer' ? 'secondary' : 'primary'} variant="outlined" />
                        </TableCell>
                        <TableCell align="right">
                          {editingCell?.empId === r.employeeId && editingCell.field === 'visitTarget' ? (
                            <TextField
                              size="small"
                              type="number"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onBlur={() => commitEdit(r.employeeId)}
                              onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(r.employeeId); if (e.key === 'Escape') setEditingCell(null); }}
                              sx={{ width: 80 }}
                              autoFocus
                              inputProps={{ min: 0 }}
                            />
                          ) : (
                            <Typography
                              variant="body2"
                              sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                              onClick={() => startEdit(r.employeeId, 'visitTarget', r.visitTarget)}
                            >
                              {r.visitTarget}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          {editingCell?.empId === r.employeeId && editingCell.field === 'newAgencyTarget' ? (
                            <TextField
                              size="small"
                              type="number"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onBlur={() => commitEdit(r.employeeId)}
                              onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(r.employeeId); if (e.key === 'Escape') setEditingCell(null); }}
                              sx={{ width: 80 }}
                              autoFocus
                              inputProps={{ min: 0 }}
                            />
                          ) : (
                            <Typography
                              variant="body2"
                              sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                              onClick={() => startEdit(r.employeeId, 'newAgencyTarget', r.newAgencyTarget)}
                            >
                              {r.newAgencyTarget}
                            </Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {targets.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ color: 'text.secondary' }}>
                          {t('sched.noEmployees')}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                <Typography variant="caption" color="text.secondary" sx={{ p: 2, display: 'block' }}>
                  {t('sched.targetEditHint')}
                </Typography>
              </Collapse>
            </Paper>
          )}
        </Stack>
      )}

      <Snackbar open={!!toast} autoHideDuration={5000} onClose={() => setToast(null)} message={toast ?? ''} />
    </Box>
  );
}
