import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress,
  Grid, Paper, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ComposedChart, Line, ResponsiveContainer, Cell,
} from 'recharts';
import { Refresh } from '@mui/icons-material';
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
}

interface DashData {
  from: string; to: string;
  sellers: SellerRow[];
  totals: {
    totalAgencies: number; totalDeals: number; totalDealValue: number;
    grandVisits: number; grandOh: number; grandCalls: number;
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const todayStr = () => new Date().toISOString().slice(0, 10);
const firstOfMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; };
const fmt = (n: number) => n.toLocaleString('th-TH');
const fmtBaht = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(0)}K` : String(n);

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'error'> = {
  Met: 'success', Partial: 'warning', Missed: 'error',
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

  // Chart data
  const visitChartData = sellers.map((s) => ({
    name: s.name.replace(' GTG', '').replace(/\s+/g, ' '),
    'Actual Visits': s.visits,
    'Visit Target': s.visitTarget,
    'OH Actual': s.ohCount,
    'OH Target': s.ohTarget,
    'Ach%': s.visitAch,
  }));

  const callChartData = sellers.map((s) => ({
    name: s.name.replace(' GTG', '').replace(/\s+/g, ' '),
    'Calls Made': s.calls,
    'Call Target': s.callTarget,
  }));

  const customerChartData = sellers.map((s) => ({
    name: s.name.replace(' GTG', '').replace(/\s+/g, ' '),
    'Customers Assisted': s.customer + s.orientation,
    'Deals Created': s.deals,
  }));

  const perfChartData = sellers.map((s) => ({
    name: s.name.replace(' GTG', '').replace(/\s+/g, ' '),
    'Actual': s.visits,
    'Target': s.visitTarget,
    'Overall Ach %': s.visitAch,
  }));

  const BAR_COLORS = ['#1565c0', '#90caf9', '#2e7d32', '#a5d6a7', '#e65100', '#ffcc02'];

  return (
    <Box>
      {/* ── Filter Bar ── */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} flexWrap="wrap" useFlexGap alignItems="center">
          <TextField size="small" type="date" label="From" value={from}
            onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField size="small" type="date" label="To" value={to}
            onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField size="small" label="Visit Target/Person" type="number" value={visitTarget}
            onChange={(e) => setVisitTarget(e.target.value)} sx={{ width: 150 }} />
          <TextField size="small" label="OH Target/Person" type="number" value={ohTarget}
            onChange={(e) => setOhTarget(e.target.value)} sx={{ width: 150 }} />
          <TextField size="small" label="Call Target/Person" type="number" value={callTarget}
            onChange={(e) => setCallTarget(e.target.value)} sx={{ width: 150 }} />
          <Button variant="contained" startIcon={<Refresh />} onClick={load} disabled={loading}>
            Refresh
          </Button>
        </Stack>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* ── KPI Cards ── */}
      {totals && (
        <Grid container spacing={2} mb={3}>
          <Grid item xs={6} sm={3}>
            <KpiCard label="Total Agencies" value={fmt(totals.totalAgencies)} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <KpiCard label="Total Deals" value={fmt(totals.totalDeals)} sub={`Value: ${fmtBaht(totals.totalDealValue)}`} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <KpiCard label="Total Visits" value={fmt(totals.grandVisits)} sub="completed" />
          </Grid>
          <Grid item xs={6} sm={3}>
            <KpiCard label="Open House" value={fmt(totals.grandOh)} sub="agencies brought" />
          </Grid>
        </Grid>
      )}

      {/* ── Seller Performance Table ── */}
      <Paper sx={{ mb: 3, borderRadius: 2, overflow: 'hidden' }}>
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', background: 'linear-gradient(90deg, #1565c0 0%, #1976d2 100%)' }}>
          <Typography fontWeight={700} color="#fff">
            Sellers Performance of Agencies Visits &amp; No of Agencies that brings to Open House
            {data && ` — ${data.from} to ${data.to}`}
          </Typography>
        </Box>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead sx={{ bgcolor: '#f5f5f5' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, minWidth: 130 }}>Seller Name</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>Visits</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>OH Count</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>Visit Target</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>OH Target</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>Visit Ach%</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>OH Ach%</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>Perf Score</TableCell>
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
                    <Chip label={s.status} size="small" color={STATUS_COLOR[s.status]} />
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>{s.perfScore.toFixed(2)}</TableCell>
                </TableRow>
              ))}
              {sellers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ color: 'text.secondary', py: 4 }}>
                    {loading ? 'กำลังโหลด...' : 'ไม่มีข้อมูล'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Box>
      </Paper>

      {/* ── Charts Row 1: Visit Performance + OH ── */}
      {sellers.length > 0 && (
        <Grid container spacing={2} mb={3}>
          {/* Agency Visit Performance vs Target */}
          <Grid item xs={12} lg={7}>
            <Paper sx={{ p: 2, borderRadius: 2 }}>
              <Typography fontWeight={700} mb={2}>Agency Visit Performance vs Target by Seller</Typography>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={perfChartData} margin={{ top: 8, right: 30, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" unit="%" domain={[0, 120]} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar yAxisId="left" dataKey="Actual" fill="#1565c0" radius={[3, 3, 0, 0]} />
                  <Bar yAxisId="left" dataKey="Target" fill="#90caf9" radius={[3, 3, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="Overall Ach %" stroke="#2e7d32" strokeWidth={2} dot={{ r: 4, fill: '#2e7d32' }} label={{ position: 'top', fontSize: 10, fill: '#2e7d32' }} />
                </ComposedChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          {/* Status Condition Check */}
          <Grid item xs={12} lg={5}>
            <Paper sx={{ p: 2, borderRadius: 2, height: '100%' }}>
              <Typography fontWeight={700} mb={2}>Seller Target Condition Check</Typography>
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
                        <TableCell><Chip label={st} size="small" color={STATUS_COLOR[st]} /></TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700 }}>{count}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <Typography fontWeight={700} mt={3} mb={1}>Sellers visit agencies</Typography>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Seller</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>Actual</TableCell>
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

      {/* ── Charts Row 2: Calls + Customers vs Deals ── */}
      {sellers.length > 0 && (
        <Grid container spacing={2} mb={3}>
          {/* Call Performance */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, borderRadius: 2 }}>
              <Typography fontWeight={700} mb={2}>Call Performance Target Tracking</Typography>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={callChartData} layout="vertical" margin={{ top: 0, right: 30, bottom: 0, left: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="Calls Made" fill="#1565c0" radius={[0, 3, 3, 0]} />
                  <Bar dataKey="Call Target" fill="#b0bec5" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          {/* Customers Assisted vs Deals Created */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, borderRadius: 2 }}>
              <Typography fontWeight={700} mb={2}>Customers Assisted vs Deal Created</Typography>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={customerChartData} margin={{ top: 8, right: 20, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="Customers Assisted" fill="#1565c0" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Deals Created" fill="#e65100" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* ── Charts Row 3: Visit Achievement + Agencies Sellers Bring ── */}
      {sellers.length > 0 && (
        <Grid container spacing={2} mb={3}>
          {/* Visit Achievement % bar */}
          <Grid item xs={12} md={7}>
            <Paper sx={{ p: 2, borderRadius: 2 }}>
              <Typography fontWeight={700} mb={2}>No of Agencies Sellers Bring to Open House</Typography>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={visitChartData} margin={{ top: 8, right: 20, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="OH Actual" fill="#1565c0" radius={[3, 3, 0, 0]}>
                    {visitChartData.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                  </Bar>
                  <Bar dataKey="OH Target" fill="#b0bec5" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          {/* Agencies brought per seller */}
          <Grid item xs={12} md={5}>
            <Paper sx={{ p: 2, borderRadius: 2 }}>
              <Typography fontWeight={700} mb={1}>Agencies Sellers Bring (Open House)</Typography>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Seller</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Agencies</TableCell>
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
                      <TableCell colSpan={2} align="center" sx={{ color: 'text.secondary' }}>ยังไม่มีข้อมูล</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* ── Sellers assisted vs deals detail ── */}
      {sellers.length > 0 && (
        <Paper sx={{ mb: 3, borderRadius: 2 }}>
          <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography fontWeight={700}>Sellers Assisted vs Deals Summary</Typography>
          </Box>
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Sales Rep</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>Customers Assisted</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>Orientation</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>Holding</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>Deals Created</TableCell>
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
    </Box>
  );
}
