import { useCallback, useEffect, useRef, useState } from 'react';
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
} from '@mui/material';
import { api, errMsg } from '../api/client';
import { PdfExportButton } from '../utils/pdf';
import { useT } from '../i18n';

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
const statusEmoji: Record<string, string> = { green: '🟢', yellow: '🟡', red: '🔴', blue: '🔵', gray: '⚪' };

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
                  <TableCell align="right">Sales</TableCell>
                  <TableCell align="right">Closer</TableCell>
                  <TableCell align="right">Agency</TableCell>
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
        </Stack>
      )}

      <Snackbar open={!!toast} autoHideDuration={5000} onClose={() => setToast(null)} message={toast ?? ''} />
    </Box>
  );
}
