import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Box, Typography, Tabs, Tab, Card, CardContent, Stack, Table,
  TableHead, TableRow, TableCell, TableBody, TableContainer, Paper,
  Chip, LinearProgress, CircularProgress, Alert, Grid,
  IconButton, Tooltip, Slider, TextField, Button,
} from '@mui/material';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded';
import TrendingFlatRoundedIcon from '@mui/icons-material/TrendingFlatRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import ClearRoundedIcon from '@mui/icons-material/ClearRounded';
import { api } from '../api/client';
import { ExportPdfButton } from '../components/ExportPdfButton';

interface GrowthItem {
  id: string; name: string; code: string;
  currentTier: string; scoreTier: string; forecastTier: string;
  currentScore: number; forecastScore: number; scoreDelta: number; trend: number;
  historyScores: number[];
}

interface GrowthResult {
  upgrades: GrowthItem[];
  downgrades: GrowthItem[];
  stable: GrowthItem[];
}

const TIER_COLOR: Record<string, string> = {
  platinum: '#6366F1', gold: '#D97706', silver: '#6B7280', bronze: '#92400E', at_risk: '#DC2626',
};
const TIER_LABEL_TH: Record<string, string> = {
  platinum: 'Platinum', gold: 'Gold', silver: 'Silver', bronze: 'Bronze', at_risk: 'At Risk',
};

type RiskStatus = 'on_track' | 'at_risk' | 'critical' | 'unknown';

interface KpiItem {
  employeeId: string; name: string; role: string; zone: string | null; region: string | null;
  currentPeriod: {
    period: string; visitTarget: number; visitActual: number; visitProjected: number;
    visitAchRate: number | null; visitProjRate: number | null;
    salesTarget: number; salesActual: number; salesProjected: number;
    elapsedDays: number; totalDays: number; progressRate: number;
  };
  nextPeriod: {
    period: string; visitForecast: number; salesForecast: number; followupForecast: number;
    visitTrend: number; salesTrend: number;
  };
  history: { period: string; visitTarget: number | null; visitActual: number | null; salesActual: number }[];
  riskStatus: RiskStatus;
}

interface ForecastDashboard {
  currentPeriod: string; nextPeriod: string;
  summary: { total: number; onTrack: number; atRisk: number; critical: number; avgVisitProjRate: number; avgVisitForecast: number };
  workload: { period: string; taskForecast: number; visitForecast: number; visitCapacity: number; capacityPct: number | null; taskTrend: number; visitTrend: number };
  topAtRisk: KpiItem[];
  alerts: string[];
}

interface WorkloadResult {
  currentPeriod: string; nextPeriod: string; activeSales: number;
  snapshot: { openTasks: number; overdueTasks: number };
  history: { period: string; tasks: { created: number; done: number }; visits: { planned: number; done: number } }[];
  forecast: { period: string; taskForecast: number; visitForecast: number; visitCapacity: number; capacityPct: number | null; taskTrend: number; visitTrend: number };
}

interface ScenarioResult {
  base: { sales: number; visitForecast: number; capacity: number; capacityPct: number | null };
  scenario: { sales: number; visitForecast: number; capacity: number; capacityPct: number | null };
  delta: { salesDelta: number; visitTargetChangePct: number; capacityGainPct: number | null };
}

const STATUS_COLOR: Record<RiskStatus, string> = {
  on_track: '#16A34A', at_risk: '#D97706', critical: '#DC2626', unknown: '#6B7280',
};
const STATUS_LABEL: Record<RiskStatus, string> = {
  on_track: 'On Track', at_risk: 'At Risk', critical: 'Critical', unknown: 'No Data',
};

function StatusChip({ status }: { status: RiskStatus }) {
  const colors: Record<RiskStatus, { bg: string; text: string }> = {
    on_track: { bg: '#F0FDF4', text: '#16A34A' },
    at_risk: { bg: '#FEFCE8', text: '#D97706' },
    critical: { bg: '#FEF2F2', text: '#DC2626' },
    unknown: { bg: '#F3F4F6', text: '#6B7280' },
  };
  return (
    <Chip label={STATUS_LABEL[status]} size="small"
      sx={{ bgcolor: colors[status].bg, color: colors[status].text, fontWeight: 700, fontSize: 11 }} />
  );
}

function TrendIcon({ pct }: { pct: number }) {
  if (pct > 5) return <TrendingUpRoundedIcon fontSize="small" sx={{ color: '#16A34A' }} />;
  if (pct < -5) return <TrendingDownRoundedIcon fontSize="small" sx={{ color: '#DC2626' }} />;
  return <TrendingFlatRoundedIcon fontSize="small" sx={{ color: '#6B7280' }} />;
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Box sx={{ width: 60, height: 6, bgcolor: '#F3F4F6', borderRadius: 3, overflow: 'hidden' }}>
        <Box sx={{ height: '100%', width: `${pct}%`, bgcolor: color, borderRadius: 3 }} />
      </Box>
      <Typography variant="caption" sx={{ fontSize: 10, color }}>{pct}%</Typography>
    </Box>
  );
}

function HistorySparkline({ history, field }: { history: KpiItem['history']; field: 'visitActual' | 'salesActual' }) {
  const values = history.map(h => field === 'visitActual' ? (h.visitActual ?? 0) : h.salesActual);
  const max = Math.max(...values, 1);
  return (
    <Stack direction="row" alignItems="flex-end" spacing={0.25} sx={{ height: 24 }}>
      {values.map((v, i) => (
        <Box key={i} sx={{ width: 8, height: `${Math.round((v / max) * 24)}px`, bgcolor: '#6366F1', borderRadius: 0.5, opacity: 0.6 + i * 0.2 }} />
      ))}
    </Stack>
  );
}

function KpiRow({ item }: { item: KpiItem }) {
  const cp = item.currentPeriod;
  const np = item.nextPeriod;
  return (
    <TableRow hover>
      <TableCell>
        <Typography variant="body2" fontWeight={600}>{item.name}</Typography>
        <Typography variant="caption" color="text.secondary">{item.role}{item.zone ? ` · ${item.zone}` : ''}</Typography>
      </TableCell>
      <TableCell><StatusChip status={item.riskStatus} /></TableCell>
      <TableCell>
        <Box>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="caption" fontWeight={700}>{cp.visitActual}/{cp.visitTarget}</Typography>
            <Typography variant="caption" color="text.secondary">→ Est. {cp.visitProjected}</Typography>
          </Stack>
          <MiniBar value={cp.visitActual} max={cp.visitTarget} color={STATUS_COLOR[item.riskStatus]} />
        </Box>
      </TableCell>
      <TableCell>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Typography variant="body2" fontWeight={700} sx={{ color: '#6366F1' }}>{np.visitForecast}</Typography>
          <TrendIcon pct={np.visitTrend} />
          <Typography variant="caption" color="text.secondary">{np.visitTrend > 0 ? '+' : ''}{np.visitTrend}%</Typography>
        </Stack>
      </TableCell>
      <TableCell>
        <HistorySparkline history={item.history} field="visitActual" />
      </TableCell>
      <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>{cp.progressRate}%</TableCell>
    </TableRow>
  );
}

export default function AiForecastPage() {
  const [tab, setTab] = useState(0);
  const [dashboard, setDashboard] = useState<ForecastDashboard | null>(null);
  const [kpiItems, setKpiItems] = useState<KpiItem[]>([]);
  const [workload, setWorkload] = useState<WorkloadResult | null>(null);
  const [scenario, setScenario] = useState<ScenarioResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [growth, setGrowth] = useState<GrowthResult | null>(null);
  const [addSales, setAddSales] = useState(0);
  const [visitDelta, setVisitDelta] = useState(0);
  const [scenarioLoading, setScenarioLoading] = useState(false);
  // Filter states for KPI tab
  const [searchText, setSearchText] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [dashRes, kpiRes, workRes, growthRes] = await Promise.all([
        api.get('/ai-forecast/dashboard'),
        api.get('/ai-forecast/kpi'),
        api.get('/ai-forecast/workload'),
        api.get('/ai-forecast/agency-growth'),
      ]);
      setDashboard(dashRes.data);
      setKpiItems(kpiRes.data.items ?? []);
      setWorkload(workRes.data);
      setGrowth(growthRes.data);
    } catch {
      setError('Unable to load Forecast data');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadScenario = useCallback(async () => {
    setScenarioLoading(true);
    try {
      const res = await api.get(`/ai-forecast/scenario?addSales=${addSales}&visitTargetChange=${visitDelta}`);
      setScenario(res.data);
    } catch {
      // ignore
    } finally {
      setScenarioLoading(false);
    }
  }, [addSales, visitDelta]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (tab === 4) loadScenario();
  }, [tab, addSales, visitDelta, loadScenario]);

  const periodLabel = (p: string) => {
    const [y, m] = p.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[parseInt(m) - 1]} ${y}`;
  };

  // Filter logic for KPI items
  const filteredKpiItems = useMemo(() => {
    return kpiItems.filter(item => {
      // Search filter (name, role, zone, region)
      if (searchText.trim()) {
        const lowerSearch = searchText.toLowerCase();
        const matchesSearch =
          item.name.toLowerCase().includes(lowerSearch) ||
          item.role.toLowerCase().includes(lowerSearch) ||
          (item.zone?.toLowerCase().includes(lowerSearch) || false) ||
          (item.region?.toLowerCase().includes(lowerSearch) || false);
        if (!matchesSearch) return false;
      }

      // Date range filter (based on currentPeriod)
      if (startDate || endDate) {
        const itemDate = new Date(`${item.currentPeriod.period}-01`);
        if (startDate) {
          const start = new Date(startDate);
          if (itemDate < start) return false;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setMonth(end.getMonth() + 1);
          if (itemDate >= end) return false;
        }
      }

      return true;
    });
  }, [kpiItems, searchText, startDate, endDate]);

  // Check if any filters are active
  const hasActiveFilters = searchText.trim() !== '' || startDate !== '' || endDate !== '';

  const handleClearFilters = () => {
    setSearchText('');
    setStartDate('');
    setEndDate('');
  };

  return (
    <Box sx={{ p: { xs: 1.5, md: 3 }, maxWidth: 1400, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <TrendingUpRoundedIcon sx={{ color: '#6366F1', fontSize: 28 }} />
          <Box>
            <Typography variant="h5" fontWeight={800}>AI Forecast</Typography>
            <Typography variant="caption" color="text.secondary">Automated KPI, Workload and Scenario forecasting</Typography>
          </Box>
        </Stack>
        <Tooltip title="Refresh">
          <IconButton onClick={load} size="small"><RefreshRoundedIcon /></IconButton>
        </Tooltip>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: '1px solid #E5E7EB' }}>
        <Tab label="Overview" />
        <Tab label="KPI Forecast" />
        <Tab label="Workload" />
        <Tab label="Agency Growth" />
        <Tab label="What-If Scenario" />
      </Tabs>

      {loading && !dashboard ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* Dashboard Tab */}
          {tab === 0 && dashboard && (
            <Box>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                {[
                  { label: 'KPI On Track', value: dashboard.summary.onTrack, color: '#16A34A', sub: 'Sales' },
                  { label: 'At Risk', value: dashboard.summary.atRisk, color: '#D97706', sub: 'Sales' },
                  { label: 'Critical', value: dashboard.summary.critical, color: '#DC2626', sub: 'Sales' },
                  { label: 'Avg. Achievement', value: `${dashboard.summary.avgVisitProjRate}%`, color: '#6366F1', sub: 'Projected end-of-month' },
                ].map(card => (
                  <Grid item xs={6} md={3} key={card.label}>
                    <Card>
                      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                        <Typography variant="h4" fontWeight={800} sx={{ color: card.color }}>{card.value}</Typography>
                        <Typography variant="caption" color="text.secondary" display="block">{card.label}</Typography>
                        <Typography variant="caption" color="text.secondary">{card.sub}</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>

              {dashboard.alerts.length > 0 && (
                <Card sx={{ mb: 3, bgcolor: '#FFF7ED', border: '1px solid #FED7AA' }}>
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                      <WarningAmberRoundedIcon sx={{ color: '#EA580C', fontSize: 18 }} />
                      <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#EA580C' }}>Predictive Alerts</Typography>
                    </Stack>
                    <Stack spacing={0.75}>
                      {dashboard.alerts.map((alert, i) => (
                        <Typography key={i} variant="body2" sx={{ display: 'flex', gap: 1 }}>
                          <Box component="span" sx={{ color: '#EA580C', fontWeight: 700, flexShrink: 0 }}>!</Box>
                          {alert}
                        </Typography>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              )}

              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                    Next Month Forecast ({periodLabel(dashboard.nextPeriod)})
                  </Typography>
                  <Card>
                    <CardContent>
                      <Stack spacing={1.5}>
                        <Box>
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="body2" color="text.secondary">Avg. visits / sales</Typography>
                            <Typography variant="body2" fontWeight={700} sx={{ color: '#6366F1' }}>
                              {dashboard.summary.avgVisitForecast} visits
                            </Typography>
                          </Stack>
                        </Box>
                        <Box>
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="body2" color="text.secondary">Estimated tasks</Typography>
                            <Typography variant="body2" fontWeight={700}>
                              {dashboard.workload.taskForecast}
                              <Box component="span" sx={{ ml: 0.5, fontSize: 11, color: dashboard.workload.taskTrend > 5 ? '#DC2626' : dashboard.workload.taskTrend < -5 ? '#16A34A' : '#6B7280' }}>
                                {dashboard.workload.taskTrend > 0 ? `↑${dashboard.workload.taskTrend}%` : dashboard.workload.taskTrend < 0 ? `↓${Math.abs(dashboard.workload.taskTrend)}%` : '→'}
                              </Box>
                            </Typography>
                          </Stack>
                        </Box>
                        {dashboard.workload.capacityPct !== null && (
                          <Box>
                            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                              <Typography variant="body2" color="text.secondary">Capacity</Typography>
                              <Typography variant="body2" fontWeight={700} sx={{ color: dashboard.workload.capacityPct > 90 ? '#DC2626' : dashboard.workload.capacityPct > 75 ? '#D97706' : '#16A34A' }}>
                                {dashboard.workload.capacityPct}%
                              </Typography>
                            </Stack>
                            <LinearProgress
                              variant="determinate" value={Math.min(100, dashboard.workload.capacityPct)}
                              sx={{ height: 6, borderRadius: 3, bgcolor: '#F3F4F6',
                                '& .MuiLinearProgress-bar': { bgcolor: dashboard.workload.capacityPct > 90 ? '#DC2626' : dashboard.workload.capacityPct > 75 ? '#D97706' : '#16A34A' } }}
                            />
                          </Box>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Sales to Watch</Typography>
                  <Stack spacing={1}>
                    {dashboard.topAtRisk.slice(0, 5).map(item => (
                      <Box key={item.employeeId} sx={{ p: 1.5, border: '1px solid', borderColor: STATUS_COLOR[item.riskStatus] + '40', borderRadius: 2, bgcolor: item.riskStatus === 'critical' ? '#FEF2F2' : '#FEFCE8' }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Box>
                            <Typography variant="body2" fontWeight={700}>{item.name}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              Visit {item.currentPeriod.visitActual}/{item.currentPeriod.visitTarget} · Est. end-of-month {item.currentPeriod.visitProjected}
                            </Typography>
                          </Box>
                          <StatusChip status={item.riskStatus} />
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                </Grid>
              </Grid>
            </Box>
          )}

          {/* KPI Forecast Tab */}
          {tab === 1 && (
            <Box>
              {/* Filter Section */}
              <Card sx={{ mb: 2, bgcolor: '#FAFBFC', border: '1px solid #E5E7EB' }}>
                <CardContent>
                  <Stack spacing={2}>
                    {/* Filter Controls */}
                    <Grid container spacing={2} alignItems="flex-end">
                      <Grid item xs={12} md={4}>
                        <TextField
                          fullWidth
                          size="small"
                          placeholder="Search by name, role, zone..."
                          value={searchText}
                          onChange={(e) => setSearchText(e.target.value)}
                          variant="outlined"
                          slotProps={{
                            input: { sx: { bgcolor: '#fff' } }
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Start Period"
                          type="month"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          variant="outlined"
                          slotProps={{
                            input: { sx: { bgcolor: '#fff' } }
                          }}
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <TextField
                          fullWidth
                          size="small"
                          label="End Period"
                          type="month"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          variant="outlined"
                          slotProps={{
                            input: { sx: { bgcolor: '#fff' } }
                          }}
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                      <Grid item xs={12} md={2}>
                        {hasActiveFilters && (
                          <Button
                            fullWidth
                            size="small"
                            variant="outlined"
                            startIcon={<ClearRoundedIcon />}
                            onClick={handleClearFilters}
                            sx={{ textTransform: 'none' }}
                          >
                            Clear
                          </Button>
                        )}
                      </Grid>
                    </Grid>

                    {/* Filter Info */}
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary">
                        {filteredKpiItems.length} of {kpiItems.length} results
                        {hasActiveFilters && ' (filtered)'}
                      </Typography>
                      {hasActiveFilters && (
                        <Stack direction="row" spacing={1}>
                          {searchText && (
                            <Chip
                              size="small"
                              label={`Search: "${searchText}"`}
                              onDelete={() => setSearchText('')}
                              variant="outlined"
                            />
                          )}
                          {startDate && (
                            <Chip
                              size="small"
                              label={`From: ${startDate}`}
                              onDelete={() => setStartDate('')}
                              variant="outlined"
                            />
                          )}
                          {endDate && (
                            <Chip
                              size="small"
                              label={`To: ${endDate}`}
                              onDelete={() => setEndDate('')}
                              variant="outlined"
                            />
                          )}
                        </Stack>
                      )}
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>

              {/* KPI Table */}
              <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1.5 }}>
                <ExportPdfButton tableId="ai-forecast-table" filename="ai-forecast" title="AI Forecast - KPI" size="small" />
              </Stack>
              <TableContainer id="ai-forecast-table" component={Paper} elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 2 }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#F9FAFB' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Sales</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 700, minWidth: 160 }}>This Month (Visits)</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Next Month Forecast</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>3-Month Trend</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Previous Month</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredKpiItems.length === 0 ? (
                      <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                        {hasActiveFilters ? 'No results match your filters' : 'No KPI data found'}
                      </TableCell></TableRow>
                    ) : (
                      filteredKpiItems.map(item => <KpiRow key={item.employeeId} item={item} />)
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* Workload Tab */}
          {tab === 2 && workload && (
            <Box>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                {[
                  { label: 'Open Tasks', value: workload.snapshot.openTasks, color: '#6366F1' },
                  { label: 'Overdue Tasks', value: workload.snapshot.overdueTasks, color: '#DC2626' },
                  { label: 'Total Sales', value: workload.activeSales, color: '#16A34A' },
                ].map(c => (
                  <Grid item xs={6} md={4} key={c.label}>
                    <Card>
                      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                        <Typography variant="h4" fontWeight={800} sx={{ color: c.color }}>{c.value}</Typography>
                        <Typography variant="caption" color="text.secondary">{c.label}</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>

              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>
                    Next Month Forecast ({periodLabel(workload.nextPeriod)})
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                      <Typography variant="caption" color="text.secondary">Estimated tasks</Typography>
                      <Stack direction="row" alignItems="center" spacing={0.5}>
                        <Typography variant="h5" fontWeight={800} sx={{ color: '#6366F1' }}>{workload.forecast.taskForecast}</Typography>
                        <TrendIcon pct={workload.forecast.taskTrend} />
                      </Stack>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Typography variant="caption" color="text.secondary">Field visits (estimated)</Typography>
                      <Stack direction="row" alignItems="center" spacing={0.5}>
                        <Typography variant="h5" fontWeight={800} sx={{ color: '#6366F1' }}>{workload.forecast.visitForecast}</Typography>
                        <TrendIcon pct={workload.forecast.visitTrend} />
                      </Stack>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Typography variant="caption" color="text.secondary">Capacity</Typography>
                      <Typography variant="h5" fontWeight={800} sx={{ color: workload.forecast.capacityPct && workload.forecast.capacityPct > 90 ? '#DC2626' : '#16A34A' }}>
                        {workload.forecast.capacityPct !== null ? `${workload.forecast.capacityPct}%` : '—'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        of {workload.forecast.visitCapacity} capacity
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                <Typography variant="subtitle2" fontWeight={700}>3-Month History</Typography>
                <ExportPdfButton tableId="workload-history-table" filename="workload-history" title="Workload History" size="small" />
              </Stack>
              <TableContainer id="workload-history-table" component={Paper} elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 2 }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#F9FAFB' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Month</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Tasks Created</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Tasks Completed</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Visits Planned</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Visits Done</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Visit Rate</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {workload.history.map(h => {
                      const visitRate = h.visits.planned > 0 ? Math.round((h.visits.done / h.visits.planned) * 100) : 0;
                      return (
                        <TableRow key={h.period} hover>
                          <TableCell sx={{ fontWeight: 600 }}>{periodLabel(h.period)}</TableCell>
                          <TableCell>{h.tasks.created}</TableCell>
                          <TableCell sx={{ color: '#16A34A' }}>{h.tasks.done}</TableCell>
                          <TableCell>{h.visits.planned}</TableCell>
                          <TableCell>{h.visits.done}</TableCell>
                          <TableCell>
                            <MiniBarInline pct={visitRate} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* Agency Growth Tab */}
          {tab === 3 && growth && (
            <Box>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                    <ArrowUpwardRoundedIcon sx={{ color: '#16A34A', fontSize: 20 }} />
                    <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#16A34A' }}>
                      Agency Likely to Upgrade ({growth.upgrades.length})
                    </Typography>
                  </Stack>
                  {growth.upgrades.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">None</Typography>
                  ) : (
                    <Stack spacing={1}>
                      {growth.upgrades.slice(0, 10).map(a => (
                        <Box key={a.id} sx={{ p: 1.5, border: '1px solid #D1FAE5', borderRadius: 2, bgcolor: '#F0FDF4' }}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Box>
                              <Typography variant="body2" fontWeight={700}>{a.name}</Typography>
                              <Typography variant="caption" color="text.secondary">{a.code}</Typography>
                            </Box>
                            <Stack direction="row" alignItems="center" spacing={0.5}>
                              <Chip label={TIER_LABEL_TH[a.scoreTier] ?? a.scoreTier} size="small" sx={{ bgcolor: TIER_COLOR[a.scoreTier] + '20', color: TIER_COLOR[a.scoreTier], fontWeight: 700, fontSize: 10 }} />
                              <Typography variant="caption" sx={{ color: '#6B7280' }}>→</Typography>
                              <Chip label={TIER_LABEL_TH[a.forecastTier] ?? a.forecastTier} size="small" sx={{ bgcolor: TIER_COLOR[a.forecastTier] + '20', color: TIER_COLOR[a.forecastTier], fontWeight: 700, fontSize: 10 }} />
                            </Stack>
                          </Stack>
                          <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">Current score: {a.currentScore}</Typography>
                            <Typography variant="caption" fontWeight={700} sx={{ color: '#16A34A' }}>+{a.scoreDelta} → {a.forecastScore}</Typography>
                          </Stack>
                        </Box>
                      ))}
                    </Stack>
                  )}
                </Grid>
                <Grid item xs={12} md={6}>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                    <ArrowDownwardRoundedIcon sx={{ color: '#DC2626', fontSize: 20 }} />
                    <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#DC2626' }}>
                      Agency at Risk of Downgrade ({growth.downgrades.length})
                    </Typography>
                  </Stack>
                  {growth.downgrades.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">None</Typography>
                  ) : (
                    <Stack spacing={1}>
                      {growth.downgrades.slice(0, 10).map(a => (
                        <Box key={a.id} sx={{ p: 1.5, border: '1px solid #FEE2E2', borderRadius: 2, bgcolor: '#FEF2F2' }}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Box>
                              <Typography variant="body2" fontWeight={700}>{a.name}</Typography>
                              <Typography variant="caption" color="text.secondary">{a.code}</Typography>
                            </Box>
                            <Stack direction="row" alignItems="center" spacing={0.5}>
                              <Chip label={TIER_LABEL_TH[a.scoreTier] ?? a.scoreTier} size="small" sx={{ bgcolor: TIER_COLOR[a.scoreTier] + '20', color: TIER_COLOR[a.scoreTier], fontWeight: 700, fontSize: 10 }} />
                              <Typography variant="caption" sx={{ color: '#6B7280' }}>→</Typography>
                              <Chip label={TIER_LABEL_TH[a.forecastTier] ?? a.forecastTier} size="small" sx={{ bgcolor: TIER_COLOR[a.forecastTier] + '20', color: TIER_COLOR[a.forecastTier], fontWeight: 700, fontSize: 10 }} />
                            </Stack>
                          </Stack>
                          <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">Current score: {a.currentScore}</Typography>
                            <Typography variant="caption" fontWeight={700} sx={{ color: '#DC2626' }}>{a.scoreDelta} → {a.forecastScore}</Typography>
                          </Stack>
                        </Box>
                      ))}
                    </Stack>
                  )}
                </Grid>
              </Grid>
            </Box>
          )}

          {/* Scenario Tab */}
          {tab === 4 && (
            <Box>
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>Adjust Scenario</Typography>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <Typography variant="body2" gutterBottom>Add / Remove Sales: <strong>{addSales > 0 ? '+' : ''}{addSales} people</strong></Typography>
                      <Slider
                        value={addSales}
                        onChange={(_, v) => setAddSales(v as number)}
                        min={-5} max={10} step={1} marks
                        sx={{ color: addSales >= 0 ? '#16A34A' : '#DC2626' }}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Typography variant="body2" gutterBottom>
                        Change Visit Target: <strong>{visitDelta > 0 ? '+' : ''}{visitDelta}%</strong>
                      </Typography>
                      <Slider
                        value={visitDelta}
                        onChange={(_, v) => setVisitDelta(v as number)}
                        min={-30} max={30} step={5} marks
                        sx={{ color: visitDelta >= 0 ? '#6366F1' : '#DC2626' }}
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              {scenarioLoading ? (
                <Box sx={{ display: 'grid', placeItems: 'center', py: 4 }}><CircularProgress /></Box>
              ) : scenario && (
                <Grid container spacing={2}>
                  {[
                    { title: 'Base (Current)', data: scenario.base, color: '#6B7280' },
                    { title: `Scenario (+${addSales} sales, ${visitDelta > 0 ? '+' : ''}${visitDelta}% visits)`, data: scenario.scenario, color: '#6366F1' },
                  ].map(col => (
                    <Grid item xs={12} md={6} key={col.title}>
                      <Card sx={{ border: `2px solid ${col.color}20`, height: '100%' }}>
                        <CardContent>
                          <Typography variant="subtitle2" fontWeight={700} sx={{ color: col.color, mb: 2 }}>{col.title}</Typography>
                          <Stack spacing={1.5}>
                            {[
                              { label: 'Sales headcount', value: `${col.data.sales} people` },
                              { label: 'Visits forecast (next month)', value: `${col.data.visitForecast} visits` },
                              { label: 'Capacity', value: `${col.data.capacity} visits` },
                              { label: 'Capacity utilization', value: col.data.capacityPct !== null ? `${col.data.capacityPct}%` : '—' },
                            ].map(row => (
                              <Stack key={row.label} direction="row" justifyContent="space-between">
                                <Typography variant="body2" color="text.secondary">{row.label}</Typography>
                                <Typography variant="body2" fontWeight={700}>{row.value}</Typography>
                              </Stack>
                            ))}
                            {col.data.capacityPct !== null && (
                              <LinearProgress
                                variant="determinate"
                                value={Math.min(100, col.data.capacityPct)}
                                sx={{ height: 8, borderRadius: 4, bgcolor: '#F3F4F6',
                                  '& .MuiLinearProgress-bar': { bgcolor: col.data.capacityPct > 90 ? '#DC2626' : col.data.capacityPct > 75 ? '#D97706' : '#16A34A', borderRadius: 4 } }}
                              />
                            )}
                          </Stack>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                  {scenario.delta.capacityGainPct !== null && (
                    <Grid item xs={12}>
                      <Alert severity={scenario.delta.capacityGainPct > 0 ? 'success' : 'info'} icon={<TrendingUpRoundedIcon />}>
                        Capacity reduced by <strong>{Math.abs(scenario.delta.capacityGainPct)}%</strong>
                        {scenario.delta.salesDelta > 0 && ` from adding ${scenario.delta.salesDelta} sales`}
                        {scenario.delta.visitTargetChangePct !== 0 && ` + target adjusted ${scenario.delta.visitTargetChangePct > 0 ? '+' : ''}${scenario.delta.visitTargetChangePct}% visits`}
                      </Alert>
                    </Grid>
                  )}
                </Grid>
              )}
            </Box>
          )}
        </>
      )}
    </Box>
  );
}

function MiniBarInline({ pct }: { pct: number }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Box sx={{ width: 60, height: 6, bgcolor: '#F3F4F6', borderRadius: 3, overflow: 'hidden' }}>
        <Box sx={{ height: '100%', width: `${pct}%`, bgcolor: pct >= 80 ? '#16A34A' : pct >= 60 ? '#D97706' : '#DC2626', borderRadius: 3 }} />
      </Box>
      <Typography variant="caption" sx={{ fontSize: 11 }}>{pct}%</Typography>
    </Box>
  );
}
