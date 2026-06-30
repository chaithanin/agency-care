import { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Tabs, Tab, Card, CardContent, Chip, Stack, Table,
  TableHead, TableRow, TableCell, TableBody, TableContainer, Paper,
  TextField, InputAdornment, IconButton, Collapse, LinearProgress,
  Grid, CircularProgress, Alert, Tooltip,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { api } from '../api/client';
import { ExportPdfButton } from '../components/ExportPdfButton';

type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

interface Factor { name: string; detail: string; score: number; weight: number }
interface AgencyRisk {
  id: string; name: string; code: string; level: string; tier: string; pipelineStage: string;
  riskScore: number; riskLevel: RiskLevel; factors: Factor[]; recommendations: string[];
  daysSinceLastVisit: number | null; daysSinceLastSale: number | null; daysSinceLastCall: number | null;
  agreementExpiry: string | null; daysUntilExpiry: number | null; overdueTaskCount: number;
  agencyScore: number | null; scoreTrend: number;
}
interface SaleRisk {
  employeeId: string; userId: string; name: string; role: string; zone: string | null; region: string | null;
  performanceScore: number; riskScore: number; riskLevel: RiskLevel;
  factors: Factor[]; issues: string[]; recommendations: string[];
  stats: { planned: number; done: number; confirmed: number; overdueCount: number; totalOpen: number; checkins: number };
  kpi: { visitTarget: number; visitActual: number } | null;
}
interface Dashboard {
  agencies: { critical: number; high: number; medium: number; low: number; total: number };
  sales: { critical: number; high: number; medium: number; low: number; total: number };
  topRiskAgencies: AgencyRisk[]; topRiskSales: SaleRisk[]; recommendations: string[];
}

const RISK_COLOR: Record<RiskLevel, string> = {
  critical: '#DC2626', high: '#EA580C', medium: '#D97706', low: '#16A34A',
};
const RISK_BG: Record<RiskLevel, string> = {
  critical: '#FEF2F2', high: '#FFF7ED', medium: '#FEFCE8', low: '#F0FDF4',
};
const RISK_LABEL: Record<RiskLevel, string> = {
  critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low',
};

function RiskChip({ level }: { level: RiskLevel }) {
  return (
    <Chip
      label={RISK_LABEL[level]}
      size="small"
      sx={{ bgcolor: RISK_BG[level], color: RISK_COLOR[level], fontWeight: 700, fontSize: 11 }}
    />
  );
}

function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <LinearProgress
        variant="determinate"
        value={score}
        sx={{ flex: 1, height: 8, borderRadius: 4, bgcolor: '#F3F4F6',
          '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 4 } }}
      />
      <Typography variant="caption" sx={{ fontWeight: 700, minWidth: 28, color }}>{score}</Typography>
    </Box>
  );
}

function FactorList({ factors }: { factors: Factor[] }) {
  return (
    <Stack spacing={0.5}>
      {factors.map(f => (
        <Box key={f.name}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.25 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', minWidth: 100 }}>{f.name}</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>{f.detail}</Typography>
            <Typography variant="caption" sx={{ fontWeight: 700, minWidth: 40, textAlign: 'right', color: f.score > 0 ? '#DC2626' : '#16A34A' }}>
              {f.score}/{f.weight}
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={f.weight > 0 ? Math.round((f.score / f.weight) * 100) : 0}
            sx={{ height: 4, borderRadius: 2, bgcolor: '#F3F4F6',
              '& .MuiLinearProgress-bar': { bgcolor: f.score > f.weight * 0.7 ? '#DC2626' : f.score > f.weight * 0.4 ? '#D97706' : '#16A34A', borderRadius: 2 } }}
          />
        </Box>
      ))}
    </Stack>
  );
}

function AgencyRow({ agency }: { agency: AgencyRisk }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TableRow
        hover sx={{ cursor: 'pointer', '& td': { borderBottom: open ? 'none' : undefined } }}
        onClick={() => setOpen(o => !o)}
      >
        <TableCell>
          <Stack direction="row" alignItems="center" spacing={1}>
            <IconButton size="small" sx={{ p: 0 }}>
              {open ? <ExpandLessRoundedIcon fontSize="small" /> : <ExpandMoreRoundedIcon fontSize="small" />}
            </IconButton>
            <Box>
              <Typography variant="body2" fontWeight={600}>{agency.name}</Typography>
              <Typography variant="caption" color="text.secondary">{agency.code} · {agency.level ?? '-'}</Typography>
            </Box>
          </Stack>
        </TableCell>
        <TableCell><RiskChip level={agency.riskLevel} /></TableCell>
        <TableCell>
          <ScoreBar score={agency.riskScore} color={RISK_COLOR[agency.riskLevel]} />
        </TableCell>
        <TableCell sx={{ color: 'text.secondary', fontSize: 12 }}>
          {agency.daysSinceLastVisit !== null ? `${agency.daysSinceLastVisit}d` : '—'}
        </TableCell>
        <TableCell sx={{ color: 'text.secondary', fontSize: 12 }}>
          {agency.daysSinceLastSale !== null ? `${agency.daysSinceLastSale}d` : '—'}
        </TableCell>
        <TableCell sx={{ color: agency.daysUntilExpiry !== null && agency.daysUntilExpiry < 30 ? '#DC2626' : 'text.secondary', fontSize: 12 }}>
          {agency.daysUntilExpiry !== null ? (agency.daysUntilExpiry < 0 ? 'Expired' : `${agency.daysUntilExpiry}d`) : '—'}
        </TableCell>
        <TableCell sx={{ color: 'text.secondary', fontSize: 12 }}>
          {agency.agencyScore !== null ? `${agency.agencyScore}${agency.scoreTrend < -5 ? ' ↓' : agency.scoreTrend > 5 ? ' ↑' : ''}` : '—'}
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={7} sx={{ p: 0, border: 'none' }}>
          <Collapse in={open} unmountOnExit>
            <Box sx={{ p: 2, bgcolor: '#FAFAFA', borderBottom: '1px solid #E5E7EB' }}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="caption" fontWeight={700} sx={{ mb: 1, display: 'block' }}>Risk Factors</Typography>
                  <FactorList factors={agency.factors} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="caption" fontWeight={700} sx={{ mb: 1, display: 'block' }}>AI Recommendations</Typography>
                  <Stack spacing={0.5}>
                    {agency.recommendations.map((r, i) => (
                      <Typography key={i} variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box component="span" sx={{ color: RISK_COLOR[agency.riskLevel], fontWeight: 700 }}>→</Box> {r}
                      </Typography>
                    ))}
                  </Stack>
                  {agency.overdueTaskCount > 0 && (
                    <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                      {agency.overdueTaskCount} overdue task{agency.overdueTaskCount > 1 ? 's' : ''}
                    </Typography>
                  )}
                </Grid>
              </Grid>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

function SaleRow({ sale }: { sale: SaleRisk }) {
  const [open, setOpen] = useState(false);
  const visitRate = sale.stats.planned > 0 ? Math.round((sale.stats.done / sale.stats.planned) * 100) : 0;
  return (
    <>
      <TableRow hover sx={{ cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
        <TableCell>
          <Stack direction="row" alignItems="center" spacing={1}>
            <IconButton size="small" sx={{ p: 0 }}>
              {open ? <ExpandLessRoundedIcon fontSize="small" /> : <ExpandMoreRoundedIcon fontSize="small" />}
            </IconButton>
            <Box>
              <Typography variant="body2" fontWeight={600}>{sale.name}</Typography>
              <Typography variant="caption" color="text.secondary">{sale.role}{sale.zone ? ` · ${sale.zone}` : ''}</Typography>
            </Box>
          </Stack>
        </TableCell>
        <TableCell><RiskChip level={sale.riskLevel} /></TableCell>
        <TableCell>
          <ScoreBar score={sale.performanceScore} color={RISK_COLOR[sale.riskLevel]} />
        </TableCell>
        <TableCell sx={{ fontSize: 12 }}>{`${sale.stats.done}/${sale.stats.planned}`}</TableCell>
        <TableCell sx={{ fontSize: 12 }}>{sale.stats.overdueCount}</TableCell>
        <TableCell sx={{ fontSize: 12 }}>
          {sale.kpi ? `${sale.kpi.visitActual}/${sale.kpi.visitTarget}` : '—'}
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={6} sx={{ p: 0, border: 'none' }}>
          <Collapse in={open} unmountOnExit>
            <Box sx={{ p: 2, bgcolor: '#FAFAFA', borderBottom: '1px solid #E5E7EB' }}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="caption" fontWeight={700} sx={{ mb: 1, display: 'block' }}>Performance Factors</Typography>
                  <FactorList factors={sale.factors} />
                  <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
                    {sale.issues.map((issue, i) => (
                      <Chip key={i} label={issue} size="small" sx={{ fontSize: 10, bgcolor: '#FEF2F2', color: '#DC2626' }} />
                    ))}
                  </Stack>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="caption" fontWeight={700} sx={{ mb: 1, display: 'block' }}>AI Recommendations</Typography>
                  <Stack spacing={0.5}>
                    {sale.recommendations.map((r, i) => (
                      <Typography key={i} variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box component="span" sx={{ color: RISK_COLOR[sale.riskLevel], fontWeight: 700 }}>→</Box> {r}
                      </Typography>
                    ))}
                  </Stack>
                  <Box sx={{ mt: 1.5, p: 1, bgcolor: '#F3F4F6', borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      Visit: {sale.stats.done}/{sale.stats.planned} ({visitRate}%) · Confirmed: {sale.stats.confirmed} · Check-in: {sale.stats.checkins}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Card sx={{ flex: 1, minWidth: 110 }}>
      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Typography variant="h4" fontWeight={800} sx={{ color }}>{value}</Typography>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
      </CardContent>
    </Card>
  );
}

export default function AiRiskPage() {
  const [tab, setTab] = useState(0);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [agencies, setAgencies] = useState<AgencyRisk[]>([]);
  const [sales, setSales] = useState<SaleRisk[]>([]);
  const [loading, setLoading] = useState(true);
  const [agencySearch, setAgencySearch] = useState('');
  const [riskFilter, setRiskFilter] = useState<RiskLevel | 'all'>('all');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [dashRes, agRes, saleRes] = await Promise.all([
        api.get('/ai-risk/dashboard'),
        api.get('/ai-risk/agencies?limit=200'),
        api.get('/ai-risk/sales'),
      ]);
      setDashboard(dashRes.data);
      setAgencies(agRes.data.items ?? []);
      setSales(saleRes.data.items ?? []);
    } catch {
      setError('Unable to load risk data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredAgencies = agencies.filter(a => {
    const matchSearch = !agencySearch || a.name.toLowerCase().includes(agencySearch.toLowerCase()) || a.code?.toLowerCase().includes(agencySearch.toLowerCase());
    const matchRisk = riskFilter === 'all' || a.riskLevel === riskFilter;
    return matchSearch && matchRisk;
  });

  return (
    <Box sx={{ p: { xs: 1.5, md: 3 }, maxWidth: 1400, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <WarningAmberRoundedIcon sx={{ color: '#D97706', fontSize: 28 }} />
          <Box>
            <Typography variant="h5" fontWeight={800}>AI Risk Analysis</Typography>
            <Typography variant="caption" color="text.secondary">Agency &amp; Sales risk analysis with automated recommendations</Typography>
          </Box>
        </Stack>
        <Tooltip title="Refresh">
          <IconButton onClick={load} size="small"><RefreshRoundedIcon /></IconButton>
        </Tooltip>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: '1px solid #E5E7EB' }}>
        <Tab label="Executive Dashboard" />
        <Tab label="Agency Risk" />
        <Tab label="Sales Risk" />
      </Tabs>

      {loading && !dashboard ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* Executive Dashboard */}
          {tab === 0 && dashboard && (
            <Box>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Agency Risk</Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <SummaryCard label="Critical" value={dashboard.agencies.critical} color="#DC2626" />
                    <SummaryCard label="High" value={dashboard.agencies.high} color="#EA580C" />
                    <SummaryCard label="Medium" value={dashboard.agencies.medium} color="#D97706" />
                    <SummaryCard label="Low" value={dashboard.agencies.low} color="#16A34A" />
                  </Stack>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Sales Performance</Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <SummaryCard label="Critical" value={dashboard.sales.critical} color="#DC2626" />
                    <SummaryCard label="High" value={dashboard.sales.high} color="#EA580C" />
                    <SummaryCard label="Medium" value={dashboard.sales.medium} color="#D97706" />
                    <SummaryCard label="Good" value={dashboard.sales.low} color="#16A34A" />
                  </Stack>
                </Grid>
              </Grid>

              {dashboard.recommendations.length > 0 && (
                <Card sx={{ mb: 3, bgcolor: '#FFFBEB', border: '1px solid #FDE68A' }}>
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, color: '#D97706' }}>
                      AI Recommendations
                    </Typography>
                    <Stack spacing={0.75}>
                      {dashboard.recommendations.map((r, i) => (
                        <Typography key={i} variant="body2" sx={{ display: 'flex', gap: 1 }}>
                          <Box component="span" sx={{ color: '#D97706', fontWeight: 700, flexShrink: 0 }}>{i + 1}.</Box>
                          {r}
                        </Typography>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              )}

              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Top Agencies Requiring Immediate Attention</Typography>
                  <Stack spacing={1}>
                    {dashboard.topRiskAgencies.slice(0, 5).map(a => (
                      <Box key={a.id} sx={{ p: 1.5, border: '1px solid', borderColor: RISK_COLOR[a.riskLevel] + '40', borderRadius: 2, bgcolor: RISK_BG[a.riskLevel] }}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                          <Box>
                            <Typography variant="body2" fontWeight={700}>{a.name}</Typography>
                            <Typography variant="caption" color="text.secondary">{a.code}</Typography>
                          </Box>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Typography variant="h6" fontWeight={800} sx={{ color: RISK_COLOR[a.riskLevel] }}>{a.riskScore}</Typography>
                            <RiskChip level={a.riskLevel} />
                          </Stack>
                        </Stack>
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                          {a.recommendations[0]}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Sales Requiring Support</Typography>
                  <Stack spacing={1}>
                    {dashboard.topRiskSales.slice(0, 5).map(s => (
                      <Box key={s.employeeId} sx={{ p: 1.5, border: '1px solid', borderColor: RISK_COLOR[s.riskLevel] + '40', borderRadius: 2, bgcolor: RISK_BG[s.riskLevel] }}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                          <Box>
                            <Typography variant="body2" fontWeight={700}>{s.name}</Typography>
                            <Typography variant="caption" color="text.secondary">{s.role}{s.zone ? ` · ${s.zone}` : ''}</Typography>
                          </Box>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Typography variant="h6" fontWeight={800} sx={{ color: RISK_COLOR[s.riskLevel] }}>{s.performanceScore}</Typography>
                            <RiskChip level={s.riskLevel} />
                          </Stack>
                        </Stack>
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                          {s.issues[0]}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </Grid>
              </Grid>
            </Box>
          )}

          {/* Agency Risk Tab */}
          {tab === 1 && (
            <Box>
              <Stack direction="row" spacing={1.5} sx={{ mb: 2, flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                <TextField
                  size="small" placeholder="Search Agency..."
                  value={agencySearch}
                  onChange={e => setAgencySearch(e.target.value)}
                  InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" /></InputAdornment> }}
                  sx={{ width: 240 }}
                />
                {(['all', 'critical', 'high', 'medium', 'low'] as const).map(lv => (
                  <Chip
                    key={lv}
                    label={lv === 'all' ? 'All' : RISK_LABEL[lv]}
                    onClick={() => setRiskFilter(lv)}
                    sx={{
                      cursor: 'pointer',
                      bgcolor: riskFilter === lv ? (lv === 'all' ? '#6366F1' : RISK_COLOR[lv]) : undefined,
                      color: riskFilter === lv ? '#FFF' : undefined,
                      fontWeight: riskFilter === lv ? 700 : 400,
                    }}
                  />
                ))}
                <Box sx={{ ml: 'auto' }}>
                  <ExportPdfButton tableId="ai-risk-table" filename="ai-risk" title="AI Risk - Agencies" size="small" />
                </Box>
              </Stack>
              <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 2 }} id="ai-risk-table">
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#F9FAFB' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Agency</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Level</TableCell>
                      <TableCell sx={{ fontWeight: 700, minWidth: 140 }}>Risk Score</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Last Visit</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Last Sale</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Agreement</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Score</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredAgencies.length === 0 ? (
                      <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>No data found</TableCell></TableRow>
                    ) : (
                      filteredAgencies.map(a => <AgencyRow key={a.id} agency={a} />)
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Showing {filteredAgencies.length} of {agencies.length} agencies
              </Typography>
            </Box>
          )}

          {/* Sale Risk Tab */}
          {tab === 2 && (
            <Box>
              <Stack direction="row" spacing={1.5} sx={{ mb: 2, justifyContent: 'flex-end' }}>
                <ExportPdfButton tableId="sales-risk-table" filename="sales-risk" title="AI Risk - Sales" size="small" />
              </Stack>
              <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 2 }} id="sales-risk-table">
              <Table size="small">
                <TableHead sx={{ bgcolor: '#F9FAFB' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Sales</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Level</TableCell>
                    <TableCell sx={{ fontWeight: 700, minWidth: 140 }}>Performance Score</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Visits This Month</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Overdue Tasks</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>KPI</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sales.length === 0 ? (
                    <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>No data found</TableCell></TableRow>
                  ) : (
                    sales.map(s => <SaleRow key={s.employeeId} sale={s} />)
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
