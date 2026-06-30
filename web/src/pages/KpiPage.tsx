import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
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
  TextField,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { api } from '../api/client';
import { PdfExportButton } from '../utils/pdf';
import { ExportPdfButton } from '../components/ExportPdfButton';
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
  callCount?: number;
  orientationCount?: number;
  customerCount?: number;
  holdingCount?: number;
  followupCustomerCount?: number;
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
    <Stack spacing={2}>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard label={t('kpi.visited')} actual={kpi.visitActual} target={kpi.visitTarget} pct={kpi.visitRate} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard label={t('c.agency')} actual={kpi.newAgencyActual} target={kpi.newAgencyTarget} pct={kpi.newAgencyRate} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard label={t('kpi.followup')} actual={kpi.followupActual} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard label={t('kpi.sales')} actual={isNaN(salesNum) ? 0 : salesNum} suffix=" THB" />
        </Grid>
      </Grid>
      {/* Activity breakdown */}
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={1}>
          {t('kpi.activityBreakdown')}
        </Typography>
        <Grid container spacing={1}>
          {[
            { label: t('kpi.callCount'), value: kpi.callCount ?? 0 },
            { label: t('kpi.orientationCount'), value: kpi.orientationCount ?? 0 },
            { label: t('kpi.customerCount'), value: kpi.customerCount ?? 0 },
            { label: t('kpi.holdingCount'), value: kpi.holdingCount ?? 0 },
            { label: t('kpi.followupCustomer'), value: kpi.followupCustomerCount ?? 0 },
          ].map(({ label, value }) => (
            <Grid item xs={6} sm={4} md={2} key={label}>
              <Box sx={{ textAlign: 'center', p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <Typography variant="h6" fontWeight={700}>{value}</Typography>
                <Typography variant="caption" color="text.secondary">{label}</Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Paper>
    </Stack>
  );
}

// ─── Admin / team table ───────────────────────────────────────────────────────

function TeamKpiTable({
  rows,
  searchQ,
  dateRangeStart,
  dateRangeEnd,
}: {
  rows: TeamKpiRow[];
  searchQ: string;
  dateRangeStart?: string;
  dateRangeEnd?: string;
}) {
  const { t } = useT();
  const filtered = useMemo(() => {
    let result = rows;

    // Filter by search query
    if (searchQ) {
      result = result.filter((r) =>
        (r.employee?.name ?? '').toLowerCase().includes(searchQ.toLowerCase()) ||
        (r.employee?.code ?? '').toLowerCase().includes(searchQ.toLowerCase())
      );
    }

    // Filter by date range (period)
    if (dateRangeStart || dateRangeEnd) {
      result = result.filter((r) => {
        const rPeriod = r.period;
        if (dateRangeStart && rPeriod < dateRangeStart) return false;
        if (dateRangeEnd && rPeriod > dateRangeEnd) return false;
        return true;
      });
    }

    return result;
  }, [rows, searchQ, dateRangeStart, dateRangeEnd]);

  return (
    <Paper id="kpi-table" variant="outlined" sx={{ overflowX: 'auto' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{t('c.seller')}</TableCell>
            <TableCell align="center">{t('kpi.visited')}</TableCell>
            <TableCell align="center">{t('c.agency')}</TableCell>
            <TableCell align="center">{t('kpi.callCount')}</TableCell>
            <TableCell align="center">{t('kpi.orientationCount')}</TableCell>
            <TableCell align="center">{t('kpi.customerCount')}</TableCell>
            <TableCell align="center">{t('kpi.holdingCount')}</TableCell>
            <TableCell align="center">{t('kpi.followup')}</TableCell>
            <TableCell align="right">{t('kpi.sales')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {filtered.map((r, idx) => {
            const visitColor = progressColor(r.visitRate);
            const agColor = progressColor(r.newAgencyRate);
            const salesNum = typeof r.salesActual === 'string' ? parseFloat(r.salesActual) : r.salesActual;
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
                    <Typography variant="body2">{r.visitActual}/{r.visitTarget}</Typography>
                    <Chip size="small" label={`${r.visitRate}%`} color={visitColor} />
                  </Stack>
                </TableCell>
                <TableCell align="center">
                  <Stack spacing={0.25} alignItems="center">
                    <Typography variant="body2">{r.newAgencyActual}/{r.newAgencyTarget}</Typography>
                    <Chip size="small" label={`${r.newAgencyRate}%`} color={agColor} />
                  </Stack>
                </TableCell>
                <TableCell align="center">{r.callCount ?? 0}</TableCell>
                <TableCell align="center">{r.orientationCount ?? 0}</TableCell>
                <TableCell align="center">{r.customerCount ?? 0}</TableCell>
                <TableCell align="center">{r.holdingCount ?? 0}</TableCell>
                <TableCell align="center">{r.followupActual}</TableCell>
                <TableCell align="right">{isNaN(salesNum) ? 0 : salesNum.toLocaleString()}</TableCell>
              </TableRow>
            );
          })}
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={9} align="center">
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
  const [sellerSearch, setSellerSearch] = useState('');

  // Data states
  const [myKpi, setMyKpi] = useState<EmployeeKpi | null>(null);
  const [teamKpi, setTeamKpi] = useState<TeamKpiRow[]>([]);
  const [orgKpi, setOrgKpi] = useState<OrgKpi | null>(null);

  // Filter states
  const [dateRangeStart, setDateRangeStart] = useState<string>('');
  const [dateRangeEnd, setDateRangeEnd] = useState<string>('');

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

  // Reset filters when data changes
  useEffect(() => {
    setDateRangeStart('');
    setDateRangeEnd('');
  }, [period]);

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
      {(['manager', 'super_admin', 'admin'].includes(activeRole ?? '')) && !loading && (
        <Stack spacing={3}>
          {orgKpi && <OrgSummarySection org={orgKpi} />}

          {teamKpi.length > 0 && (
            <>
              <Divider />
              <Box>
                <Typography variant="subtitle1" fontWeight={600} mb={2}>
                  {t('kpi.individualTitle')}
                </Typography>

                {/* Filter Section */}
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    mb: 2,
                    backgroundColor: 'background.default',
                    borderRadius: 1,
                  }}
                >
                  <Stack spacing={2}>
                    <Typography variant="subtitle2" fontWeight={600}>
                      {t('c.filters')} / {t('c.search')}
                    </Typography>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-end">
                      {/* Text search */}
                      <TextField
                        size="small"
                        label={t('c.searchSeller')}
                        placeholder="Name or code"
                        value={sellerSearch}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSellerSearch(e.target.value)}
                        sx={{ width: { xs: '100%', sm: 200 } }}
                      />

                      {/* Date range start */}
                      <TextField
                        size="small"
                        type="month"
                        label="From (YYYY-MM)"
                        value={dateRangeStart}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDateRangeStart(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        sx={{ width: { xs: '100%', sm: 160 } }}
                      />

                      {/* Date range end */}
                      <TextField
                        size="small"
                        type="month"
                        label="To (YYYY-MM)"
                        value={dateRangeEnd}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDateRangeEnd(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        sx={{ width: { xs: '100%', sm: 160 } }}
                      />

                      {/* Reset filters button */}
                      {(sellerSearch || dateRangeStart || dateRangeEnd) && (
                        <Button
                          size="small"
                          variant="text"
                          onClick={() => {
                            setSellerSearch('');
                            setDateRangeStart('');
                            setDateRangeEnd('');
                          }}
                        >
                          {t('c.clearFilters') || 'Clear Filters'}
                        </Button>
                      )}
                    </Stack>

                    {/* Result count */}
                    <Typography variant="caption" color="text.secondary">
                      Showing{' '}
                      {teamKpi
                        .filter((r) =>
                          (!sellerSearch ||
                            (r.employee?.name ?? '').toLowerCase().includes(sellerSearch.toLowerCase()) ||
                            (r.employee?.code ?? '').toLowerCase().includes(sellerSearch.toLowerCase())) &&
                          (!dateRangeStart || r.period >= dateRangeStart) &&
                          (!dateRangeEnd || r.period <= dateRangeEnd)
                        )
                        .length.toLocaleString()}{' '}
                      of {teamKpi.length.toLocaleString()} records
                    </Typography>
                  </Stack>
                </Paper>

                {/* Action buttons and table */}
                <Stack direction="row" justifyContent="flex-end" spacing={1} mb={2}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      const headers = ['Name', 'Code', 'Period', 'Visits', 'Target', '%', 'Agency', 'Call', 'Orientation', 'Customer', 'Holding', 'Follow-up', 'Sales'];
                      const rows2 = teamKpi
                        .filter(
                          (r) =>
                            (!sellerSearch ||
                              (r.employee?.name ?? '').toLowerCase().includes(sellerSearch.toLowerCase()) ||
                              (r.employee?.code ?? '').toLowerCase().includes(sellerSearch.toLowerCase())) &&
                            (!dateRangeStart || r.period >= dateRangeStart) &&
                            (!dateRangeEnd || r.period <= dateRangeEnd)
                        )
                        .map((r) => [
                          r.employee?.name ?? '',
                          r.employee?.code ?? '',
                          r.period,
                          r.visitActual,
                          r.visitTarget,
                          r.visitRate,
                          r.newAgencyActual,
                          r.callCount ?? 0,
                          r.orientationCount ?? 0,
                          r.customerCount ?? 0,
                          r.holdingCount ?? 0,
                          r.followupActual,
                          r.salesActual,
                        ]);
                      const lines = [headers, ...rows2].map((row) =>
                        row
                          .map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`)
                          .join(',')
                      );
                      const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `kpi-team-${period}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    Export CSV
                  </Button>
                  <ExportPdfButton
                    tableId="kpi-table"
                    filename={`kpi-team-${period}.pdf`}
                    title="KPI Report"
                    size="small"
                    variant="outlined"
                  />
                </Stack>

                <TeamKpiTable
                  rows={teamKpi}
                  searchQ={sellerSearch}
                  dateRangeStart={dateRangeStart}
                  dateRangeEnd={dateRangeEnd}
                />
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
