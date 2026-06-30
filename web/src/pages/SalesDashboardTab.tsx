import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, FormControl, InputLabel, MenuItem, Select,
  Grid, Paper, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ComposedChart, Line, ResponsiveContainer, Cell, PieChart, Pie,
} from 'recharts';
import { Refresh, Download } from '@mui/icons-material';
import { api, errMsg } from '../api/client';

// ── Types ──────────────────────────────────────────────────────────────────

interface SellerRow {
  id: string; code: string; name: string;
  visits: number; ohCount: number; calls: number;
  orientation: number; customer: number; holding: number;
  deals: number; dealValue: number; leads: number;
  agenciesBrought: string[];
  visitTarget: number; ohTarget: number; callTarget: number;
  visitAch: number; ohAch: number;
  status: 'Met' | 'Partial' | 'Missed';
  perfScore: number;
  callAnswered?: number; callNotAnswered?: number; callNotReturned?: number;
  appointmentSuccess?: number;
}

interface AgencyWithCustomer {
  agencyId: string; agencyName: string; customerCount: number; sellerName: string;
}

interface ProjectSale {
  projectId: string; projectName: string; dealCount: number; totalValue: number;
}

interface AgentBrought {
  sellerId: string; sellerName: string; agentCount: number; agents: string[];
}

interface CallPerformance {
  sellerName: string; answered: number; notAnswered: number; notReturned: number;
}

interface DashData {
  from: string; to: string;
  sellers: SellerRow[];
  totals: {
    totalAgencies: number; totalDeals: number; totalDealValue: number;
    grandVisits: number; grandOh: number; grandCalls: number;
    totalAgencyCustomers?: number;
  };
  agenciesWithCustomers?: AgencyWithCustomer[];
  projectSales?: ProjectSale[];
  agentsBrought?: AgentBrought[];
  callPerformance?: CallPerformance[];
  planVsActual?: Array<{ sellerName: string; plan: number; actual: number; }>;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const todayStr = () => new Date().toISOString().slice(0, 10);
const firstOfMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; };
const fmt = (n: number) => n.toLocaleString('th-TH');
const fmtBaht = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(0)}K` : String(n);

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'error'> = {
  Met: 'success', Partial: 'warning', Missed: 'error',
};
const STATUS_LABEL: Record<string, string> = {
  Met: 'Met', Partial: 'Partial', Missed: 'Missed',
};
const STATUS_BG: Record<string, string> = {
  Met: '#e8f5e9', Partial: '#fff8e1', Missed: '#ffebee',
};

// ── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Paper sx={{ p: 2, textAlign: 'center', borderRadius: 2, height: '100%' }}>
      <Typography variant="h4" fontWeight={800} color="primary.main">{value}</Typography>
      <Typography variant="body2" fontWeight={600} mt={0.5}>{label}</Typography>
      {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
    </Paper>
  );
}

// ── Custom Tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <Paper sx={{ p: 1.5, minWidth: 160, boxShadow: 3 }}>
      <Typography variant="caption" fontWeight={700} display="block" mb={0.5}>{label}</Typography>
      {payload.map((p: any) => (
        <Typography key={p.name} variant="caption" display="block" color={p.color}>
          {p.name}: <b>{p.value}</b>
        </Typography>
      ))}
    </Paper>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function SalesDashboardTab() {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(todayStr());
  const [visitTarget, setVisitTarget] = useState('2');
  const [ohTarget, setOhTarget] = useState('2');
  const [callTarget, setCallTarget] = useState('7');
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filterSeller, setFilterSeller] = useState('');
  const [filterAgency, setFilterAgency] = useState('');

  const load = useCallback(() => {
    setLoading(true); setError('');
    api.get('/reports/seller-performance-dashboard', {
      params: { from, to, visitTarget, ohTarget, callTarget },
    })
      .then((r) => setData(r.data))
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
  }, [from, to, visitTarget, ohTarget, callTarget]);

  useEffect(() => { load(); }, [load]);

  if (!data && loading) return <Box display="flex" justifyContent="center" py={6}><CircularProgress /></Box>;

  const sellers = data?.sellers ?? [];
  const totals = data?.totals;

  // Chart data — dataKey strings are also legend labels in recharts
  const visitChartData = sellers.map((s) => ({
    name: s.name.replace(' GTG', '').replace(/\s+/g, ' '),
    'Actual Visits': s.visits,
    'Visit Target': s.visitTarget,
    'Actual OH': s.ohCount,
    'OH Target': s.ohTarget,
    '% Achievement': s.visitAch,
  }));

  const callChartData = sellers.map((s) => ({
    name: s.name.replace(' GTG', '').replace(/\s+/g, ' '),
    'Actual Calls': s.calls,
    'Call Target': s.callTarget,
  }));

  const customerChartData = sellers.map((s) => ({
    name: s.name.replace(' GTG', '').replace(/\s+/g, ' '),
    'Customers Assisted': s.customer + s.orientation,
    'Deals Closed': s.deals,
  }));

  const perfChartData = sellers.map((s) => ({
    name: s.name.replace(' GTG', '').replace(/\s+/g, ' '),
    'Actual Visits': s.visits,
    'Target': s.visitTarget,
    '% Overall': s.visitAch,
  }));

  const BAR_COLORS = ['#1565c0', '#90caf9', '#2e7d32', '#a5d6a7', '#e65100', '#ffcc02'];
  const PIE_COLORS = ['#1565c0', '#2e7d32', '#e65100', '#f57c00', '#c62828', '#6a1b9a', '#0277bd', '#00796b'];

  const uniqueSellers = Array.from(new Set((data?.sellers ?? []).map((s) => s.name)));
  const uniqueAgencies = Array.from(new Set((data?.agenciesWithCustomers ?? []).map((a) => a.agencyName)));

  // Calculate statistics
  const totalAgencyCustomers = data?.totals?.totalAgencyCustomers ?? 0;
  const totalDealAmount = data?.totals?.totalDealValue ?? 0;
  const sellersSorted = (data?.sellers ?? []).sort((a, b) => (b.dealValue ?? 0) - (a.dealValue ?? 0));

  return (
    <Box>
      {/* ── Enhanced Filter Bar with Dropdowns ── */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} flexWrap="wrap" useFlexGap alignItems="center">
          <TextField size="small" type="date" label="From" value={from}
            onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField size="small" type="date" label="To" value={to}
            onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField size="small" label="Visit Target/Person" type="number" value={visitTarget}
            onChange={(e) => setVisitTarget(e.target.value)} sx={{ width: 140 }} />
          <TextField size="small" label="OH Target/Person" type="number" value={ohTarget}
            onChange={(e) => setOhTarget(e.target.value)} sx={{ width: 130 }} />
          <TextField size="small" label="Call Target/Person" type="number" value={callTarget}
            onChange={(e) => setCallTarget(e.target.value)} sx={{ width: 130 }} />

          {/* Seller Filter */}
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Filter Seller</InputLabel>
            <Select value={filterSeller} label="Filter Seller" onChange={(e) => setFilterSeller(e.target.value)}>
              <MenuItem value="">All Sellers</MenuItem>
              {uniqueSellers.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </Select>
          </FormControl>

          {/* Agency Filter */}
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Filter Agency</InputLabel>
            <Select value={filterAgency} label="Filter Agency" onChange={(e) => setFilterAgency(e.target.value)}>
              <MenuItem value="">All Agencies</MenuItem>
              {uniqueAgencies.map((a) => <MenuItem key={a} value={a}>{a}</MenuItem>)}
            </Select>
          </FormControl>

          <Button variant="contained" startIcon={<Refresh />} onClick={load} disabled={loading}>
            Refresh
          </Button>
          <Button variant="outlined" size="small" startIcon={<Download />}>Export</Button>
        </Stack>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* ── Enhanced KPI Cards (6 + 2 new metrics) ── */}
      {totals && (
        <Grid container spacing={2} mb={3}>
          <Grid item xs={6} sm={4} lg={2}>
            <KpiCard label="Total Agencies" value={fmt(totals.totalAgencies)} />
          </Grid>
          <Grid item xs={6} sm={4} lg={2}>
            <KpiCard label="Total Deals" value={fmt(totals.totalDeals)} sub={`Value: ${fmtBaht(totals.totalDealValue)}`} />
          </Grid>
          <Grid item xs={6} sm={4} lg={2}>
            <KpiCard label="Total Visits" value={fmt(totals.grandVisits)} sub="Completed visits" />
          </Grid>
          <Grid item xs={6} sm={4} lg={2}>
            <KpiCard label="Open House" value={fmt(totals.grandOh)} sub="Agencies brought" />
          </Grid>
          {/* New Metrics: #6 & #7 */}
          <Grid item xs={6} sm={4} lg={2}>
            <KpiCard label="Agency Bring Customers" value={fmt(totalAgencyCustomers)} sub="Total customers" />
          </Grid>
          <Grid item xs={6} sm={4} lg={2}>
            <KpiCard label="Total Deals Amount" value={fmtBaht(totalDealAmount)} sub="Sales value" />
          </Grid>
        </Grid>
      )}

      {/* ── Sales Performance Table ── */}
      <Paper sx={{ mb: 3, borderRadius: 2, overflow: 'hidden' }}>
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', background: 'linear-gradient(90deg, #1565c0 0%, #1976d2 100%)' }}>
          <Typography fontWeight={700} color="#fff">
            Agency Visit Results &amp; Open House Count by Sales
            {data && ` — ${data.from} to ${data.to}`}
          </Typography>
        </Box>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead sx={{ bgcolor: '#f5f5f5' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, minWidth: 130 }}>Sales Name</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>Visits</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>OH</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>Visit Target</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>OH Target</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>% Visits</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>% OH</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>Score</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sellers.map((s) => (
                <TableRow key={s.id} sx={{ bgcolor: STATUS_BG[s.status] }}>
                  <TableCell sx={{ fontWeight: 600 }}>{s.name}</TableCell>
                  <TableCell align="center">{s.visits}</TableCell>
                  <TableCell align="center">{s.ohCount}</TableCell>
                  <TableCell align="center">{s.visitTarget}</TableCell>
                  <TableCell align="center">{s.ohTarget}</TableCell>
                  <TableCell align="center">{s.visitAch}%</TableCell>
                  <TableCell align="center">{s.ohAch}%</TableCell>
                  <TableCell align="center">
                    <Chip label={STATUS_LABEL[s.status] ?? s.status} size="small" color={STATUS_COLOR[s.status]} />
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>{s.perfScore.toFixed(2)}</TableCell>
                </TableRow>
              ))}
              {sellers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ color: 'text.secondary', py: 4 }}>
                    {loading ? 'Loading...' : 'No data'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Box>
      </Paper>

      {/* ── Chart Row 1: Visit Results + Status Summary ── */}
      {sellers.length > 0 && (
        <Grid container spacing={2} mb={3}>
          {/* Visit results vs target chart */}
          <Grid item xs={12} lg={7}>
            <Paper sx={{ p: 2, borderRadius: 2 }}>
              <Typography fontWeight={700} mb={2}>Agency Visit Results vs Target by Sales</Typography>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={perfChartData} margin={{ top: 8, right: 30, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" unit="%" domain={[0, 120]} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar yAxisId="left" dataKey="Actual Visits" fill="#1565c0" radius={[3, 3, 0, 0]} />
                  <Bar yAxisId="left" dataKey="Target" fill="#90caf9" radius={[3, 3, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="% Overall" stroke="#2e7d32" strokeWidth={2} dot={{ r: 4, fill: '#2e7d32' }} label={{ position: 'top', fontSize: 10, fill: '#2e7d32' }} />
                </ComposedChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          {/* Target status summary */}
          <Grid item xs={12} lg={5}>
            <Paper sx={{ p: 2, borderRadius: 2, height: '100%' }}>
              <Typography fontWeight={700} mb={2}>Sales Target Status Summary</Typography>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>Count</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(['Met', 'Partial', 'Missed'] as const).map((st) => {
                    const count = sellers.filter((s) => s.status === st).length;
                    return (
                      <TableRow key={st} sx={{ bgcolor: STATUS_BG[st] }}>
                        <TableCell><Chip label={STATUS_LABEL[st]} size="small" color={STATUS_COLOR[st]} /></TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700 }}>{count}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <Typography fontWeight={700} mt={3} mb={1}>Agency Visit Count by Sales</Typography>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Sales</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>Achieved</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>Target</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sellers.map((s) => (
                    <TableRow key={s.id} hover>
                      <TableCell>{s.name}</TableCell>
                      <TableCell align="center" sx={{ color: s.visits >= s.visitTarget ? 'success.main' : 'error.main', fontWeight: 700 }}>{s.visits}</TableCell>
                      <TableCell align="center">{s.visitTarget}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* ── Chart Row 2: Calls + Customers vs Deals ── */}
      {sellers.length > 0 && (
        <Grid container spacing={2} mb={3}>
          {/* Call results */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, borderRadius: 2 }}>
              <Typography fontWeight={700} mb={2}>Call Results vs Target by Sales</Typography>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={callChartData} layout="vertical" margin={{ top: 0, right: 30, bottom: 0, left: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="Actual Calls" fill="#1565c0" radius={[0, 3, 3, 0]} />
                  <Bar dataKey="Call Target" fill="#b0bec5" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          {/* Customers assisted vs deals closed */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, borderRadius: 2 }}>
              <Typography fontWeight={700} mb={2}>Customers Assisted vs Deals Closed</Typography>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={customerChartData} margin={{ top: 8, right: 20, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="Customers Assisted" fill="#1565c0" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Deals Closed" fill="#e65100" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* ── Chart Row 3: Open House + Agency List ── */}
      {sellers.length > 0 && (
        <Grid container spacing={2} mb={3}>
          {/* Agencies brought to Open House by sales */}
          <Grid item xs={12} md={7}>
            <Paper sx={{ p: 2, borderRadius: 2 }}>
              <Typography fontWeight={700} mb={2}>Agencies Brought to Open House by Sales</Typography>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={visitChartData} margin={{ top: 8, right: 20, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="Actual OH" fill="#1565c0" radius={[3, 3, 0, 0]}>
                    {visitChartData.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                  </Bar>
                  <Bar dataKey="OH Target" fill="#b0bec5" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          {/* Agency list brought by sales */}
          <Grid item xs={12} md={5}>
            <Paper sx={{ p: 2, borderRadius: 2 }}>
              <Typography fontWeight={700} mb={1}>Agencies Brought to Open House</Typography>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Sales</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Agency</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sellers.filter((s) => s.agenciesBrought.length > 0).map((s) => (
                    <TableRow key={s.id} hover>
                      <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{s.name}</TableCell>
                      <TableCell sx={{ fontSize: 12 }}>{s.agenciesBrought.join(', ')}</TableCell>
                    </TableRow>
                  ))}
                  {sellers.every((s) => s.agenciesBrought.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={2} align="center" sx={{ color: 'text.secondary' }}>No data yet</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* ── Customer & Deal Summary Table ── */}
      {sellers.length > 0 && (
        <Paper sx={{ mb: 3, borderRadius: 2 }}>
          <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography fontWeight={700}>Customers Assisted vs Deals Summary by Sales</Typography>
          </Box>
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Sales</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>Customers Assisted</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>Orientation</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>Holding</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>Deals Closed</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>Deal Value</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>Leads</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sellers.map((s) => (
                  <TableRow key={s.id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{s.name}</TableCell>
                    <TableCell align="center">{s.customer}</TableCell>
                    <TableCell align="center">{s.orientation}</TableCell>
                    <TableCell align="center">{s.holding}</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, color: s.deals > 0 ? 'success.main' : undefined }}>{s.deals}</TableCell>
                    <TableCell align="center">{s.dealValue > 0 ? fmtBaht(s.dealValue) : '-'}</TableCell>
                    <TableCell align="center">{s.leads}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </Paper>
      )}

      {/* ── NEW CHARTS: Row 1 ── */}
      {sellers.length > 0 && (
        <Grid container spacing={2} mb={3}>
          {/* Chart 1: Agency Bring Customer (by agency) */}
          {(data?.agenciesWithCustomers ?? []).length > 0 && (
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, borderRadius: 2 }}>
                <Typography fontWeight={700} mb={2}>1. Agency Bring Customer</Typography>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={(data?.agenciesWithCustomers ?? []).slice(0, 15)} margin={{ top: 8, right: 20, bottom: 60, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="agencyName" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 10 }} />
                    <YAxis />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="customerCount" fill="#1565c0" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
          )}

          {/* Chart 2: Seller Sales Amount */}
          {sellersSorted.length > 0 && (
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, borderRadius: 2 }}>
                <Typography fontWeight={700} mb={2}>2. Seller Sales Amount</Typography>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={sellersSorted.slice(0, 10)} margin={{ top: 8, right: 20, bottom: 60, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 10 }} />
                    <YAxis />
                    <Tooltip content={<CustomTooltip />} formatter={(v) => fmtBaht(v as number)} />
                    <Bar dataKey="dealValue" fill="#2e7d32" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
          )}
        </Grid>
      )}

      {/* ── NEW CHARTS: Row 2 ── */}
      {sellers.length > 0 && (
        <Grid container spacing={2} mb={3}>
          {/* Chart 3: Project Sales */}
          {(data?.projectSales ?? []).length > 0 && (
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, borderRadius: 2 }}>
                <Typography fontWeight={700} mb={2}>3. Project Sales Distribution</Typography>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={(data?.projectSales ?? []).slice(0, 10)}
                      dataKey="dealCount"
                      nameKey="projectName"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={(entry: any) => `${String(entry.projectName ?? '').substring(0, 10)}: ${entry.dealCount}`}
                    >
                      {(data?.projectSales ?? []).map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => String(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
          )}

          {/* Chart 4: Agents Seller Brought */}
          {(data?.agentsBrought ?? []).length > 0 && (
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, borderRadius: 2 }}>
                <Typography fontWeight={700} mb={2}>4. Agents Seller Brought</Typography>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={data?.agentsBrought ?? []} layout="vertical" margin={{ top: 0, right: 30, bottom: 0, left: 120 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="sellerName" tick={{ fontSize: 10 }} width={120} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="agentCount" fill="#f57c00" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
          )}
        </Grid>
      )}

      {/* ── NEW CHARTS: Row 3 ── */}
      {sellers.length > 0 && (
        <Grid container spacing={2} mb={3}>
          {/* Chart 5: Call Performance by Agency */}
          {(data?.callPerformance ?? []).length > 0 && (
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, borderRadius: 2 }}>
                <Typography fontWeight={700} mb={2}>5. Call Performance (Answered vs Not Answered)</Typography>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={data?.callPerformance ?? []} margin={{ top: 8, right: 20, bottom: 60, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="sellerName" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 10 }} />
                    <YAxis />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="answered" fill="#2e7d32" radius={[3, 3, 0, 0]} name="Answered" />
                    <Bar dataKey="notAnswered" fill="#e65100" radius={[3, 3, 0, 0]} name="Not Answered" />
                    <Bar dataKey="notReturned" fill="#c62828" radius={[3, 3, 0, 0]} name="Not Returned" />
                  </BarChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
          )}

          {/* Chart 6: Plan vs Actual Results */}
          {(data?.planVsActual ?? []).length > 0 && (
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, borderRadius: 2 }}>
                <Typography fontWeight={700} mb={2}>6. Plan vs Actual Results by Seller</Typography>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={data?.planVsActual ?? []} margin={{ top: 8, right: 20, bottom: 60, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="sellerName" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 10 }} />
                    <YAxis />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="plan" fill="#90caf9" radius={[3, 3, 0, 0]} name="Plan" />
                    <Bar dataKey="actual" fill="#1565c0" radius={[3, 3, 0, 0]} name="Actual" />
                  </BarChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
          )}
        </Grid>
      )}

      {/* ── Agencies to Office Details Table ── */}
      {(data?.agenciesWithCustomers ?? []).length > 0 && (
        <Paper sx={{ mb: 3, borderRadius: 2 }}>
          <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography fontWeight={700}>Agency Brought to Office (with Success Rate)</Typography>
          </Box>
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Agency Name</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>Seller</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>Customers Brought</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(data?.agenciesWithCustomers ?? []).map((a, i) => (
                  <TableRow key={i} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{a.agencyName}</TableCell>
                    <TableCell align="center">{a.sellerName}</TableCell>
                    <TableCell align="center">
                      <Chip label={`${a.customerCount} customers`} size="small" color="primary" variant="outlined" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </Paper>
      )}

      {/* ── Agents Brought Details Table ── */}
      {(data?.agentsBrought ?? []).length > 0 && (
        <Paper sx={{ mb: 3, borderRadius: 2 }}>
          <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography fontWeight={700}>Agents Brought by Seller</Typography>
          </Box>
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Seller</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>Total Agents</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Agents List</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(data?.agentsBrought ?? []).map((a, i) => (
                  <TableRow key={i} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{a.sellerName}</TableCell>
                    <TableCell align="center">
                      <Chip label={a.agentCount} size="small" color="info" variant="outlined" />
                    </TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{a.agents.join(', ')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </Paper>
      )}

      {/* ── Projects Sold Details Table ── */}
      {(data?.projectSales ?? []).length > 0 && (
        <Paper sx={{ mb: 3, borderRadius: 2 }}>
          <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography fontWeight={700}>Project Sales Details</Typography>
          </Box>
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Project Name</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>Deals Closed</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>Total Value</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(data?.projectSales ?? []).map((p, i) => (
                  <TableRow key={i} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{p.projectName}</TableCell>
                    <TableCell align="center">
                      <Chip label={p.dealCount} size="small" color="success" variant="outlined" />
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>{fmtBaht(p.totalValue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </Paper>
      )}
    </Box>
  );
}
