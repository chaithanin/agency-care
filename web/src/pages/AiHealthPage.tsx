import { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Tabs, Tab, Card, CardContent, Stack, Grid,
  CircularProgress, Alert, Chip, LinearProgress, IconButton, Tooltip,
  Table, TableHead, TableRow, TableCell, TableBody, TableContainer, Paper,
} from '@mui/material';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import { ExportPdfButton } from '../components/ExportPdfButton';
import { api } from '../api/client';

type HealthLabel = 'excellent' | 'good' | 'fair' | 'poor' | 'critical';

const HEALTH_COLOR: Record<HealthLabel, string> = {
  excellent: '#16A34A', good: '#22C55E', fair: '#D97706', poor: '#EA580C', critical: '#DC2626',
};
const HEALTH_BG: Record<HealthLabel, string> = {
  excellent: '#F0FDF4', good: '#F0FDF4', fair: '#FEFCE8', poor: '#FFF7ED', critical: '#FEF2F2',
};
const HEALTH_LABEL_TH: Record<HealthLabel, string> = {
  excellent: 'Excellent', good: 'Good', fair: 'Fair', poor: 'Weak', critical: 'Critical',
};

interface AgencyHealth {
  id: string; name: string; code: string; level: string; tier: string; pipelineStage: string;
  healthScore: number; healthLabel: HealthLabel; agencyScore: number | null;
  daysSinceLastVisit: number | null; daysSinceLastSale: number | null;
}

interface EmployeeHealth {
  employeeId: string; name: string; role: string; zone: string | null; region: string | null;
  healthScore: number; healthLabel: HealthLabel;
  stats: { planned: number; done: number; overdue: number; checkins: number; visitRate: number; kpiRate: number | null };
}

interface TeamHealth {
  zone: string; avg: number; count: number; employees: EmployeeHealth[];
}

interface HealthSummary {
  orgScore: number; orgLabel: HealthLabel;
  agency: {
    avg: number; total: number;
    distribution: Record<string, number>;
    topAgencies: AgencyHealth[];
    bottomAgencies: AgencyHealth[];
  };
  employee: {
    avg: number; total: number;
    byEmployee: EmployeeHealth[];
    teams: TeamHealth[];
  };
}

function HealthChip({ label }: { label: HealthLabel }) {
  return (
    <Chip
      label={HEALTH_LABEL_TH[label]}
      size="small"
      sx={{ bgcolor: HEALTH_BG[label], color: HEALTH_COLOR[label], fontWeight: 700, fontSize: 11 }}
    />
  );
}

function HealthGauge({ score, size = 120 }: { score: number; size?: number }) {
  const label: HealthLabel =
    score >= 80 ? 'excellent' : score >= 60 ? 'good' : score >= 40 ? 'fair' : score >= 20 ? 'poor' : 'critical';
  const color = HEALTH_COLOR[label];
  const r = size / 2 - 10;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <Box sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F3F4F6" strokeWidth={10} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={10}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" style={{ transition: 'stroke-dasharray .8s' }} />
      </svg>
      <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="h5" fontWeight={800} sx={{ color, lineHeight: 1 }}>{score}</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>/100</Typography>
      </Box>
    </Box>
  );
}

function DistBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <Box sx={{ mb: 1 }}>
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.25 }}>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography variant="caption" fontWeight={700}>{count} ({pct}%)</Typography>
      </Stack>
      <LinearProgress variant="determinate" value={pct}
        sx={{ height: 8, borderRadius: 4, bgcolor: '#F3F4F6',
          '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 4 } }} />
    </Box>
  );
}

function AgencyHealthRow({ a }: { a: AgencyHealth }) {
  return (
    <TableRow hover>
      <TableCell>
        <Typography variant="body2" fontWeight={600}>{a.name}</Typography>
        <Typography variant="caption" color="text.secondary">{a.code} · {a.tier ?? a.level ?? '-'}</Typography>
      </TableCell>
      <TableCell>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="body2" fontWeight={800} sx={{ color: HEALTH_COLOR[a.healthLabel], minWidth: 28 }}>{a.healthScore}</Typography>
          <LinearProgress variant="determinate" value={a.healthScore}
            sx={{ flex: 1, height: 6, borderRadius: 3, bgcolor: '#F3F4F6',
              '& .MuiLinearProgress-bar': { bgcolor: HEALTH_COLOR[a.healthLabel], borderRadius: 3 } }} />
        </Stack>
      </TableCell>
      <TableCell><HealthChip label={a.healthLabel} /></TableCell>
      <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>{a.daysSinceLastVisit !== null ? `${a.daysSinceLastVisit} days` : '—'}</TableCell>
      <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>{a.agencyScore !== null ? `${a.agencyScore}/100` : '—'}</TableCell>
    </TableRow>
  );
}

function EmpHealthCard({ emp }: { emp: EmployeeHealth }) {
  return (
    <Box sx={{ p: 1.5, border: '1px solid', borderColor: HEALTH_COLOR[emp.healthLabel] + '40', borderRadius: 2, bgcolor: HEALTH_BG[emp.healthLabel] }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography variant="body2" fontWeight={700}>{emp.name}</Typography>
          <Typography variant="caption" color="text.secondary">{emp.role}{emp.zone ? ` · ${emp.zone}` : ''}</Typography>
        </Box>
        <Stack alignItems="center">
          <Typography variant="h6" fontWeight={800} sx={{ color: HEALTH_COLOR[emp.healthLabel], lineHeight: 1 }}>{emp.healthScore}</Typography>
          <HealthChip label={emp.healthLabel} />
        </Stack>
      </Stack>
      <Stack direction="row" spacing={1.5} sx={{ mt: 1 }}>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary" display="block">Visit</Typography>
          <Typography variant="caption" fontWeight={700}>{emp.stats.visitRate}%</Typography>
        </Box>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary" display="block">Overdue</Typography>
          <Typography variant="caption" fontWeight={700} sx={{ color: emp.stats.overdue > 10 ? '#DC2626' : 'inherit' }}>{emp.stats.overdue}</Typography>
        </Box>
        {emp.stats.kpiRate !== null && (
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary" display="block">KPI</Typography>
            <Typography variant="caption" fontWeight={700}>{emp.stats.kpiRate}%</Typography>
          </Box>
        )}
      </Stack>
    </Box>
  );
}

export default function AiHealthPage() {
  const [tab, setTab] = useState(0);
  const [data, setData] = useState<HealthSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/ai-health/summary');
      setData(res.data);
    } catch {
      setError('Unable to load Health Score data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Box sx={{ display: 'grid', placeItems: 'center', height: 300 }}><CircularProgress /></Box>;
  if (error) return <Box sx={{ p: 3 }}><Alert severity="error">{error}</Alert></Box>;
  if (!data) return null;

  const distEntries: { label: string; count: number; color: string }[] = [
    { label: '80-100 (Excellent)', count: data.agency.distribution['80-100'] ?? 0, color: '#16A34A' },
    { label: '60-79 (Good)', count: data.agency.distribution['60-79'] ?? 0, color: '#22C55E' },
    { label: '40-59 (Fair)', count: data.agency.distribution['40-59'] ?? 0, color: '#D97706' },
    { label: '20-39 (Weak)', count: data.agency.distribution['20-39'] ?? 0, color: '#EA580C' },
    { label: '0-19 (Critical)', count: data.agency.distribution['0-19'] ?? 0, color: '#DC2626' },
  ];

  return (
    <Box sx={{ p: { xs: 1.5, md: 3 }, maxWidth: 1400, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <FavoriteRoundedIcon sx={{ color: '#059669', fontSize: 28 }} />
          <Box>
            <Typography variant="h5" fontWeight={800}>AI Health Score</Typography>
            <Typography variant="caption" color="text.secondary">Organization health score 0-100 by Agency / Employee / Team</Typography>
          </Box>
        </Stack>
        <Tooltip title="Refresh"><IconButton onClick={load} size="small"><RefreshRoundedIcon /></IconButton></Tooltip>
      </Stack>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: '1px solid #E5E7EB' }}>
        <Tab label="Organization Overview" />
        <Tab label="Agency Health" />
        <Tab label="Employee Health" />
        <Tab label="Team Comparison" />
      </Tabs>

      {/* Organization Tab */}
      {tab === 0 && (
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>Organization Health</Typography>
                <Stack alignItems="center" spacing={1}>
                  <HealthGauge score={data.orgScore} size={140} />
                  <HealthChip label={data.orgLabel} />
                  <Typography variant="caption" color="text.secondary" align="center">
                    Overall score = Agency 60% + Employee 40%
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>Agency Health</Typography>
                <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
                  <HealthGauge score={data.agency.avg} size={80} />
                  <Box>
                    <Typography variant="h5" fontWeight={800}>{data.agency.avg}/100</Typography>
                    <Typography variant="caption" color="text.secondary">{data.agency.total} Agencies</Typography>
                  </Box>
                </Stack>
                {distEntries.map(d => (
                  <DistBar key={d.label} label={d.label} count={d.count} total={data.agency.total} color={d.color} />
                ))}
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>Employee Health</Typography>
                <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
                  <HealthGauge score={data.employee.avg} size={80} />
                  <Box>
                    <Typography variant="h5" fontWeight={800}>{data.employee.avg}/100</Typography>
                    <Typography variant="caption" color="text.secondary">{data.employee.total} Employees</Typography>
                  </Box>
                </Stack>
                <Stack spacing={1}>
                  {data.employee.teams.slice(0, 5).map(t => (
                    <Box key={t.zone}>
                      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.25 }}>
                        <Typography variant="caption">{t.zone}</Typography>
                        <Typography variant="caption" fontWeight={700} sx={{ color: HEALTH_COLOR[t.avg >= 80 ? 'excellent' : t.avg >= 60 ? 'good' : t.avg >= 40 ? 'fair' : 'poor'] }}>{t.avg}</Typography>
                      </Stack>
                      <LinearProgress variant="determinate" value={t.avg}
                        sx={{ height: 6, borderRadius: 3, bgcolor: '#F3F4F6',
                          '& .MuiLinearProgress-bar': { bgcolor: HEALTH_COLOR[t.avg >= 80 ? 'excellent' : t.avg >= 60 ? 'good' : t.avg >= 40 ? 'fair' : 'poor'], borderRadius: 3 } }} />
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Top & Bottom Agencies */}
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Top 5 Healthiest Agencies</Typography>
            <Stack spacing={1}>
              {data.agency.topAgencies.slice(0, 5).map(a => (
                <Box key={a.id} sx={{ p: 1.5, border: '1px solid #D1FAE5', borderRadius: 2, bgcolor: '#F0FDF4' }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="body2" fontWeight={700}>{a.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{a.code}</Typography>
                    </Box>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography variant="h6" fontWeight={800} sx={{ color: '#16A34A' }}>{a.healthScore}</Typography>
                      <HealthChip label={a.healthLabel} />
                    </Stack>
                  </Stack>
                </Box>
              ))}
            </Stack>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Bottom 5 Agencies Needing Attention</Typography>
            <Stack spacing={1}>
              {data.agency.bottomAgencies.slice(0, 5).map(a => (
                <Box key={a.id} sx={{ p: 1.5, border: '1px solid', borderColor: HEALTH_COLOR[a.healthLabel] + '40', borderRadius: 2, bgcolor: HEALTH_BG[a.healthLabel] }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="body2" fontWeight={700}>{a.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{a.code}</Typography>
                    </Box>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography variant="h6" fontWeight={800} sx={{ color: HEALTH_COLOR[a.healthLabel] }}>{a.healthScore}</Typography>
                      <HealthChip label={a.healthLabel} />
                    </Stack>
                  </Stack>
                </Box>
              ))}
            </Stack>
          </Grid>
        </Grid>
      )}

      {/* Agency Health Tab */}
      {tab === 1 && (
        <Box>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
            <Stack direction="row" alignItems="center" spacing={2}>
              <HealthGauge score={data.agency.avg} size={72} />
              <Box>
                <Typography variant="h4" fontWeight={800}>{data.agency.avg}/100</Typography>
                <Typography variant="caption" color="text.secondary">Average Agency health ({data.agency.total} agencies)</Typography>
              </Box>
            </Stack>
            <ExportPdfButton tableId="ai-health-table" filename="ai-health" title="AI Health - Agency Report" size="small" />
          </Stack>
          <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 2 }} id="ai-health-table">
            <Table size="small">
              <TableHead sx={{ bgcolor: '#F9FAFB' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Agency</TableCell>
                  <TableCell sx={{ fontWeight: 700, minWidth: 160 }}>Health Score</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Level</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Last Visit</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Agency Score</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {[...data.agency.topAgencies, ...data.agency.bottomAgencies.filter(a => !data.agency.topAgencies.find(t => t.id === a.id))].map(a => (
                  <AgencyHealthRow key={a.id} a={a} />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* Employee Health Tab */}
      {tab === 2 && (
        <Box>
          <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
            <HealthGauge score={data.employee.avg} size={72} />
            <Box>
              <Typography variant="h4" fontWeight={800}>{data.employee.avg}/100</Typography>
              <Typography variant="caption" color="text.secondary">Average employee health ({data.employee.total} employees)</Typography>
            </Box>
          </Stack>
          <Grid container spacing={1.5}>
            {data.employee.byEmployee.map(emp => (
              <Grid item xs={12} sm={6} md={4} key={emp.employeeId}>
                <EmpHealthCard emp={emp} />
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Team Comparison Tab */}
      {tab === 3 && (
        <Box>
          <Grid container spacing={2}>
            {data.employee.teams.map(team => {
              const label: HealthLabel = team.avg >= 80 ? 'excellent' : team.avg >= 60 ? 'good' : team.avg >= 40 ? 'fair' : team.avg >= 20 ? 'poor' : 'critical';
              return (
                <Grid item xs={12} md={6} key={team.zone}>
                  <Card sx={{ border: `2px solid ${HEALTH_COLOR[label]}30` }}>
                    <CardContent>
                      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                        <Box>
                          <Typography variant="subtitle1" fontWeight={700}>{team.zone}</Typography>
                          <Typography variant="caption" color="text.secondary">{team.count} members</Typography>
                        </Box>
                        <Stack alignItems="center">
                          <Typography variant="h4" fontWeight={800} sx={{ color: HEALTH_COLOR[label] }}>{team.avg}</Typography>
                          <HealthChip label={label} />
                        </Stack>
                      </Stack>
                      <LinearProgress variant="determinate" value={team.avg}
                        sx={{ height: 10, borderRadius: 5, bgcolor: '#F3F4F6', mb: 2,
                          '& .MuiLinearProgress-bar': { bgcolor: HEALTH_COLOR[label], borderRadius: 5 } }} />
                      <Stack spacing={0.75}>
                        {team.employees.map(emp => (
                          <Stack key={emp.employeeId} direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="caption">{emp.name} <Box component="span" sx={{ color: 'text.secondary' }}>({emp.role})</Box></Typography>
                            <Stack direction="row" alignItems="center" spacing={0.5}>
                              <Typography variant="caption" fontWeight={700} sx={{ color: HEALTH_COLOR[emp.healthLabel] }}>{emp.healthScore}</Typography>
                              <Box sx={{ width: 40, height: 4, bgcolor: '#F3F4F6', borderRadius: 2, overflow: 'hidden' }}>
                                <Box sx={{ height: '100%', width: `${emp.healthScore}%`, bgcolor: HEALTH_COLOR[emp.healthLabel], borderRadius: 2 }} />
                              </Box>
                            </Stack>
                          </Stack>
                        ))}
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Box>
      )}
    </Box>
  );
}
