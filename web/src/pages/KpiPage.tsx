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
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  LinearProgress,
  Card,
  CardContent,
  Grid,
  Divider,
  Button,
  Chip,
  Alert,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { api } from '../api/client';
import { PdfExportButton } from '../utils/pdf';
import { useT } from '../i18n';
import { useAuth } from '../auth/AuthContext';

// ─── Period helpers ───────────────────────────────────────────────────────────

const buildPeriods = () =>
  Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return d.toISOString().slice(0, 7); // YYYY-MM
  });

// ─── API response shapes ──────────────────────────────────────────────────────

interface EmployeeKpi {
  period: string;
  visitTarget: number;
  visitActual: number;
  newAgencyTarget: number;
  newAgencyActual: number;
  followupActual: number;
  salesActual: number | string;
  visitRate: number;
  newAgencyRate: number;
  overallRate: number;
  employee?: { name: string; code: string; position: string };
  // closer-specific fields
  completionRate?: number;
  newAgencies?: number;
  teamSize?: number;
}

interface TeamKpiRow extends EmployeeKpi {
  employeeId: string;
}

interface OrgKpi {
  period: string;
  totalVisits: number;
  completedVisits: number;
  completionRate: number;
  totalAgencies: number;
  activeAgencies: number;
  coverageRate: number;
  totalSales: number | string;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function progressColor(pct: number): 'success' | 'warning' | 'error' {
  if (pct >= 80) return 'success';
  if (pct >= 50) return 'warning';
  return 'error';
}

function MetricCard({
  label,
  actual,
  target,
  pct,
  suffix = '',
}: {
  label: string;
  actual: number | string;
  target?: number;
  pct?: number;
  suffix?: string;
}) {
  const color = pct !== undefined ? progressColor(pct) : undefined;
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="caption" color="text.secondary" gutterBottom>
          {label}
        </Typography>
        <Stack direction="row" alignItems="baseline" spacing={0.5} mb={1}>
          <Typography variant="h5" fontWeight={700}>
            {typeof actual === 'number' ? actual.toLocaleString() : actual}
          </Typography>
          {target !== undefined && (
            <Typography variant="body2" color="text.secondary">
              / {target.toLocaleString()}{suffix}
            </Typography>
          )}
          {suffix && target === undefined && (
            <Typography variant="body2" color="text.secondary">
              {suffix}
            </Typography>
          )}
        </Stack>
        {pct !== undefined && color && (
          <Stack spacing={0.5}>
            <LinearProgress
              variant="determinate"
              value={Math.min(pct, 100)}
              color={color}
              sx={{ height: 8, borderRadius: 1 }}
            />
            <Stack direction="row" justifyContent="flex-end">
              <Chip size="small" label={`${pct}%`} color={color} />
            </Stack>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Sales / Employee view ────────────────────────────────────────────────────

function SalesKpiView({ kpi }: { kpi: EmployeeKpi }) {
  const { t } = useT();
  const salesNum =
    typeof kpi.salesActual === 'string'
      ? parseFloat(kpi.salesActual)
      : kpi.salesActual;

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} sm={6} md={3}>
        <MetricCard
          label={t('kpi.visited')}
          actual={kpi.visitActual}
          target={kpi.visitTarget}
          pct={kpi.visitRate}
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <MetricCard
          label={t('c.agency')}
          actual={kpi.newAgencyActual}
          target={kpi.newAgencyTarget}
          pct={kpi.newAgencyRate}
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <MetricCard
          label="Follow-up"
          actual={kpi.followupActual}
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <MetricCard
          label={t('kpi.sales')}
          actual={isNaN(salesNum) ? 0 : salesNum}
          suffix=" บาท"
        />
      </Grid>
    </Grid>
  );
}

// ─── Admin / team table ───────────────────────────────────────────────────────

function TeamKpiTable({ rows }: { rows: TeamKpiRow[] }) {
  const { t } = useT();
  return (
    <Paper variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{t('c.seller')}</TableCell>
            <TableCell align="center">{t('kpi.visited')}</TableCell>
            <TableCell align="center">{t('c.agency')}</TableCell>
            <TableCell align="center">Follow-up</TableCell>
            <TableCell align="right">{t('kpi.sales')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r, idx) => {
            const visitColor = progressColor(r.visitRate);
            const agColor = progressColor(r.newAgencyRate);
            const salesNum =
              typeof r.salesActual === 'string'
                ? parseFloat(r.salesActual)
                : r.salesActual;
            return (
              <TableRow key={r.employeeId ?? idx}>
                <TableCell>
                  {r.employee?.name ?? '—'}
                  <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                    ({r.employee?.code ?? ''})
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Stack spacing={0.25} alignItems="center">
                    <Typography variant="body2">
                      {r.visitActual}/{r.visitTarget}
                    </Typography>
                    <Chip size="small" label={`${r.visitRate}%`} color={visitColor} />
                  </Stack>
                </TableCell>
                <TableCell align="center">
                  <Stack spacing={0.25} alignItems="center">
                    <Typography variant="body2">
                      {r.newAgencyActual}/{r.newAgencyTarget}
                    </Typography>
                    <Chip size="small" label={`${r.newAgencyRate}%`} color={agColor} />
                  </Stack>
                </TableCell>
                <TableCell align="center">{r.followupActual}</TableCell>
                <TableCell align="right">
                  {isNaN(salesNum) ? 0 : salesNum.toLocaleString()}
                </TableCell>
              </TableRow>
            );
          })}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} align="center">
                <Typography variant="body2" color="text.secondary">—</Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Paper>
  );
}

// ─── Org summary cards ────────────────────────────────────────────────────────

function OrgSummarySection({ org }: { org: OrgKpi }) {
  const { t } = useT();
  const totalSalesNum =
    typeof org.totalSales === 'string' ? parseFloat(org.totalSales) : org.totalSales;

  return (
    <Box>
      <Typography variant="subtitle1" fontWeight={600} mb={1}>
        {t('kpi.orgSummaryTitle')}
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={4}>
          <MetricCard
            label={t('kpi.completion')}
            actual={org.completedVisits}
            target={org.totalVisits}
            pct={org.completionRate}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <MetricCard
            label={t('kpi.activeAgenciesLabel')}
            actual={org.activeAgencies}
            target={org.totalAgencies}
            pct={org.coverageRate}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <MetricCard
            label={t('kpi.sales')}
            actual={isNaN(totalSalesNum) ? 0 : totalSalesNum}
            suffix={t('kpi.bahtSuffix')}
          />
        </Grid>
      </Grid>
    </Box>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function KpiPage() {
  const { t } = useT();
  const { user } = useAuth();
  const pdfRef = useRef<HTMLDivElement>(null);

  const periods = buildPeriods();
  const [period, setPeriod] = useState<string>(periods[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [myKpi, setMyKpi] = useState<EmployeeKpi | null>(null);
  const [teamKpi, setTeamKpi] = useState<TeamKpiRow[]>([]);
  const [orgKpi, setOrgKpi] = useState<OrgKpi | null>(null);

  const activeRole = user?.activeRole;
  const employeeId = user?.employee?.id ?? '';

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMyKpi(null);
    setTeamKpi([]);
    setOrgKpi(null);
    try {
      if (activeRole === 'sales') {
        const res = await api.get('/kpi/me', { params: { period } });
        setMyKpi(res.data);
      } else if (activeRole === 'closer') {
        const [closerRes, orgRes] = await Promise.all([
          api.get(`/kpi/closer/${employeeId}`, { params: { period } }),
          api.get('/kpi/org', { params: { period } }),
        ]);
        setMyKpi(closerRes.data);
        setOrgKpi(orgRes.data);
      } else {
        // admin / super_admin: load org + full team
        const [orgRes, teamRes] = await Promise.all([
          api.get('/kpi/org', { params: { period } }),
          api.get('/kpi/team', { params: { period } }),
        ]);
        setOrgKpi(orgRes.data);
        setTeamKpi(Array.isArray(teamRes.data) ? teamRes.data : []);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load KPI data';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [period, activeRole, employeeId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <Box ref={pdfRef}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={1}>
        <Typography variant="h5" fontWeight={700}>
          {t('page.kpi')}
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>{t('kpi.monthLabel')}</InputLabel>
            <Select
              value={period}
              label={t('kpi.monthLabel')}
              onChange={(e) => setPeriod(e.target.value)}
            >
              {periods.map((p) => (
                <MenuItem key={p} value={p}>
                  {p}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            size="small"
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadData}
            disabled={loading}
          >
            {t('kpi.refresh')}
          </Button>
          <PdfExportButton targetRef={pdfRef} filename={`kpi-${period}.pdf`} />
        </Stack>
      </Stack>

      {/* Loading bar */}
      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Sales view: 4 personal KPI metric cards */}
      {activeRole === 'sales' && myKpi && !loading && (
        <SalesKpiView kpi={myKpi} />
      )}

      {/* Closer view: closer team summary + org overview */}
      {activeRole === 'closer' && !loading && (
        <Stack spacing={3}>
          {myKpi && (
            <Box>
              <Typography variant="subtitle1" fontWeight={600} mb={1}>
                {t('kpi.teamSummaryTitle')}
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="caption" color="text.secondary">
                        {t('kpi.completion')}
                      </Typography>
                      <Typography variant="h5" fontWeight={700}>
                        {myKpi.completionRate ?? 0}%
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(myKpi.completionRate ?? 0, 100)}
                        color={progressColor(myKpi.completionRate ?? 0)}
                        sx={{ mt: 1, height: 8, borderRadius: 1 }}
                      />
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="caption" color="text.secondary">
                        {t('kpi.newAgencyLabel')}
                      </Typography>
                      <Typography variant="h5" fontWeight={700}>
                        {myKpi.newAgencies ?? 0}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="caption" color="text.secondary">
                        {t('kpi.teamSize')}
                      </Typography>
                      <Typography variant="h5" fontWeight={700}>
                        {myKpi.teamSize ?? 0}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          )}
          {orgKpi && (
            <>
              <Divider />
              <OrgSummarySection org={orgKpi} />
            </>
          )}
        </Stack>
      )}

      {/* Admin / super_admin view: org summary + full team table */}
      {(activeRole === 'admin' || activeRole === 'super_admin') && !loading && (
        <Stack spacing={3}>
          {orgKpi && <OrgSummarySection org={orgKpi} />}

          {teamKpi.length > 0 && (
            <>
              <Divider />
              <Box>
                <Typography variant="subtitle1" fontWeight={600} mb={1}>
                  {t('kpi.individualTitle')}
                </Typography>
                <TeamKpiTable rows={teamKpi} />
              </Box>
            </>
          )}
        </Stack>
      )}

      {/* Empty state */}
      {!loading && !error && !myKpi && teamKpi.length === 0 && !orgKpi && (
        <Typography color="text.secondary" sx={{ mt: 2 }}>
          {t('kpi.noData')}
        </Typography>
      )}
    </Box>
  );
}
