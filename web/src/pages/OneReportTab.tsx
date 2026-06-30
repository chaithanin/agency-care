import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, CircularProgress, Grid, Paper, Stack, TextField, Typography,
} from '@mui/material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, Legend,
  ComposedChart, Line, ResponsiveContainer, Cell, LabelList,
} from 'recharts';
import { Assessment, Refresh } from '@mui/icons-material';
import { api, errMsg } from '../api/client';

// ── Types ──────────────────────────────────────────────────────────────────────

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

// ── Helpers ────────────────────────────────────────────────────────────────────

const todayStr = () => new Date().toISOString().slice(0, 10);
const firstOfMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};
const fmtBaht = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M`
  : n >= 1_000 ? `${(n / 1_000).toFixed(0)}K`
  : String(n);
const shortName = (s: string) => s.replace(/\s+GTG$/i, '').trim();

const monthLabel = (from: string) => {
  if (!from) return '';
  const d = new Date(from + 'T00:00:00');
  return d.toLocaleString('th-TH', { month: 'long', year: 'numeric' });
};

const BAR_COLORS = ['#1565c0', '#42a5f5', '#2e7d32', '#66bb6a', '#e65100', '#ffb74d', '#7b1fa2', '#ab47bc'];

// ── Sub-components ─────────────────────────────────────────────────────────────

function KpiBox({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <Paper sx={{ p: 2.5, borderRadius: 2, border: `3px solid ${color}`, textAlign: 'center', minWidth: 130, flex: 1 }}>
      <Typography variant="h3" fontWeight={900} sx={{ color, lineHeight: 1.1 }}>{value}</Typography>
      <Typography variant="body2" fontWeight={600} mt={0.5}>{label}</Typography>
    </Paper>
  );
}

function ChartCard({ title, height = 280, children }: { title: string; height?: number; children: React.ReactNode }) {
  return (
    <Paper sx={{ p: 2, borderRadius: 2, height: '100%' }}>
      <Typography fontWeight={700} fontSize={13} align="center" mb={1.5}>{title}</Typography>
      <ResponsiveContainer width="100%" height={height}>
        {children as React.ReactElement}
      </ResponsiveContainer>
    </Paper>
  );
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <Paper sx={{ p: 1.5, minWidth: 150, boxShadow: 4 }}>
      <Typography variant="caption" fontWeight={700} display="block" mb={0.5}>{label}</Typography>
      {payload.map((p: any) => (
        <Typography key={p.name} variant="caption" display="block" sx={{ color: p.color ?? p.fill }}>
          {p.name}: <b>{typeof p.value === 'number' && String(p.name).includes('%') ? `${p.value}%` : typeof p.value === 'number' && p.value >= 1000 ? p.value.toLocaleString('th-TH') : p.value}</b>
        </Typography>
      ))}
    </Paper>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function OneReportTab() {
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

  const sellers = data?.sellers ?? [];
  const totals = data?.totals;

  // ── Chart datasets ──────────────────────────────────────────────────────────

  const dealValueData = [...sellers]
    .sort((a, b) => b.dealValue - a.dealValue)
    .map((s) => ({
      name: shortName(s.name),
      'Sales': s.dealValue,
    }));

  const perfPctData = sellers.map((s) => ({
    name: shortName(s.name),
    'Achieved %': Math.min(100, s.visitAch),
    'Remaining %': Math.max(0, 100 - s.visitAch),
  }));

  const ohData = sellers.map((s) => ({
    name: shortName(s.name),
    'Actual OH': s.ohCount,
    'OH Target': s.ohTarget,
  }));

  const customerData = sellers.map((s) => ({
    name: shortName(s.name),
    'Customers': s.customer + s.orientation,
    'Deals': s.deals,
    'Lead': s.leads,
  }));

  const visitPerfData = sellers.map((s) => ({
    name: shortName(s.name),
    'Actual': s.visits,
    'Target': s.visitTarget,
    '%Result': s.visitAch,
  }));

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Box>
      {/* Filter */}
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
          <Button variant="contained" startIcon={<Refresh />} onClick={load} disabled={loading}>
            Refresh
          </Button>
        </Stack>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Title */}
      <Typography variant="h5" fontWeight={900} align="center" mb={3} letterSpacing={1}>
        Summary Dashboard
      </Typography>

      {loading && !data && (
        <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>
      )}

      {/* ── KPI Cards ── */}
      {totals && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mb={3} flexWrap="wrap" useFlexGap>
          <KpiBox label="Total Sales" value={sellers.length} color="#1565c0" />
          <KpiBox
            label="Total Deals (Value)"
            value={`${totals.totalDeals.toLocaleString('th-TH')} (${fmtBaht(totals.totalDealValue)})`}
            color="#e65100"
          />
          <KpiBox label="Total Agencies" value={totals.totalAgencies} color="#2e7d32" />
        </Stack>
      )}

      {sellers.length > 0 && (
        <>
          {/* ── Row 1: Sales + Performance % ── */}
          <Grid container spacing={2} mb={2}>
            <Grid item xs={12} md={6}>
              <ChartCard title="Total Sales per Sales Person">
                <BarChart data={dealValueData} margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={fmtBaht} tick={{ fontSize: 10 }} />
                  <ReTooltip content={<ChartTooltip />} />
                  <Bar dataKey="Sales" radius={[4, 4, 0, 0]}>
                    {dealValueData.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                    <LabelList dataKey="Sales" position="top" formatter={(v: any) => fmtBaht(Number(v ?? 0))} style={{ fontSize: 10, fontWeight: 700 }} />
                  </Bar>
                </BarChart>
              </ChartCard>
            </Grid>

            <Grid item xs={12} md={6}>
              <ChartCard title="Sales Performance (Achieved vs Remaining %)">
                <BarChart data={perfPctData} margin={{ top: 8, right: 20, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `${v}%`} domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <ReTooltip content={<ChartTooltip />} />
                  <Legend />
                  <Bar dataKey="Achieved %" stackId="a" fill="#1565c0">
                    <LabelList
                      dataKey="Achieved %"
                      position="inside"
                      style={{ fill: '#fff', fontSize: 11, fontWeight: 700 }}
                      formatter={(v: any) => Number(v ?? 0) > 5 ? `${v}%` : ''}
                    />
                  </Bar>
                  <Bar dataKey="Remaining %" stackId="a" fill="#ef9a9a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartCard>
            </Grid>
          </Grid>

          {/* ── Row 2: Open House + Customers ── */}
          <Grid container spacing={2} mb={2}>
            <Grid item xs={12} md={6}>
              <ChartCard title="Agencies Bringing Customers to Open House by Sales Person" height={260}>
                <BarChart data={ohData} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <ReTooltip content={<ChartTooltip />} />
                  <Legend />
                  <Bar dataKey="Actual OH" fill="#1565c0" radius={[4, 4, 0, 0]}>
                    {ohData.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                    <LabelList dataKey="Actual OH" position="top" style={{ fontSize: 12, fontWeight: 700 }} />
                  </Bar>
                  <Bar dataKey="OH Target" fill="#b0bec5" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartCard>
            </Grid>

            <Grid item xs={12} md={6}>
              <ChartCard title={`Customers Handled by Sales Person (${monthLabel(from)})`} height={260}>
                <BarChart data={customerData} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <ReTooltip content={<ChartTooltip />} />
                  <Legend />
                  <Bar dataKey="Customers" fill="#1565c0" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="Customers" position="top" style={{ fontSize: 11 }} />
                  </Bar>
                  <Bar dataKey="Deals" fill="#e65100" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="Deals" position="top" style={{ fontSize: 11 }} />
                  </Bar>
                  <Bar dataKey="Lead" fill="#2e7d32" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="Lead" position="top" style={{ fontSize: 11 }} />
                  </Bar>
                </BarChart>
              </ChartCard>
            </Grid>
          </Grid>

          {/* ── Row 3: Visit Performance vs Target (full width) ── */}
          <Paper sx={{ p: 2, borderRadius: 2, mb: 2 }}>
            <Typography fontWeight={700} fontSize={13} align="center" mb={1.5}>
              Agency Visit Result vs Target by Sales Person ({monthLabel(from)})
            </Typography>
            <ResponsiveContainer width="100%" height={340}>
              <ComposedChart data={visitPerfData} margin={{ top: 20, right: 50, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" allowDecimals={false} />
                <YAxis yAxisId="right" orientation="right" unit="%" domain={[0, 130]} tick={{ fontSize: 10 }} />
                <ReTooltip content={<ChartTooltip />} />
                <Legend />
                <Bar yAxisId="left" dataKey="Actual" fill="#1565c0" radius={[4, 4, 0, 0]}>
                  {visitPerfData.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                  <LabelList dataKey="Actual" position="top" style={{ fontSize: 12, fontWeight: 700 }} />
                </Bar>
                <Bar yAxisId="left" dataKey="Target" fill="#b0bec5" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="Target" position="top" style={{ fontSize: 10, fill: '#555' }} />
                </Bar>
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="%Result"
                  stroke="#2e7d32"
                  strokeWidth={2.5}
                  dot={{ r: 5, fill: '#2e7d32', stroke: '#fff', strokeWidth: 2 }}
                  label={{
                    position: 'top',
                    fontSize: 11,
                    fontWeight: 700,
                    fill: '#2e7d32',
                    formatter: (v: any) => `${v ?? 0}%`,
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </Paper>
        </>
      )}

      {!loading && sellers.length === 0 && (
        <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 2 }}>
          <Assessment sx={{ fontSize: 56, color: 'text.disabled', mb: 1 }} />
          <Typography color="text.secondary">No data available for the selected period</Typography>
        </Paper>
      )}
    </Box>
  );
}
