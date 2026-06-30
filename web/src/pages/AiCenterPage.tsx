import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Grid, Card, CardContent, Chip, Tabs, Tab, Button,
  List, ListItem, ListItemIcon, ListItemText, CircularProgress, Alert, Divider,
  TextField, Select, MenuItem, FormControl, InputLabel,
} from '@mui/material';
import {
  Psychology, AutoAwesome, Route, CalendarMonth, Assessment, Stars, Warning,
  TrendingUp, Lightbulb, ArrowForward, CheckCircle, Speed, Favorite,
} from '@mui/icons-material';
import { api } from '../api/client';

const AI_MODULES = [
  { key: 'assignment', label: 'AI Assignment', icon: <Psychology />, desc: 'Automatically assign staff to Agency by level', color: '#4F46E5', route: '/auto-assign' },
  { key: 'scheduler', label: 'AI Scheduler', icon: <CalendarMonth />, desc: 'Auto-generate monthly work schedules', color: '#7C3AED', route: '/scheduling' },
  { key: 'route', label: 'AI Route', icon: <Route />, desc: 'Optimal visit routes', color: '#2563EB', route: '/route' },
  { key: 'performance', label: 'AI Performance', icon: <Assessment />, desc: 'Analyze team and individual performance', color: '#16A34A', route: '/analytics' },
  { key: 'score', label: 'AI Agency Score', icon: <Stars />, desc: 'Auto-calculate Agency scores', color: '#D97706', route: '/agencies' },
  { key: 'risk', label: 'AI Risk Analysis', icon: <Warning />, desc: 'Analyze Agency and staff risk', color: '#DC2626', route: '/ai-risk' },
  { key: 'forecast', label: 'AI Forecast', icon: <TrendingUp />, desc: 'Forecast KPI, Workload, and Scenarios', color: '#0891B2', route: '/ai-forecast' },
  { key: 'health', label: 'AI Health Score', icon: <Favorite />, desc: 'Health score 0–100 for org/team/Agency/staff', color: '#059669', route: '/ai-health' },
  { key: 'recommendation', label: 'AI Recommendations', icon: <Lightbulb />, desc: 'Real-time performance improvement suggestions', color: '#7C3AED', route: '/ai-risk' },
];

interface LiveData {
  risk?: { agencies: { critical: number; high: number; medium: number; low: number; total: number }; sales: { critical: number; high: number; medium: number; low: number; total: number }; recommendations: string[] };
  forecast?: { summary: { onTrack: number; atRisk: number; critical: number; total: number; avgVisitProjRate: number }; alerts: string[] };
}

export default function AiCenterPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [liveData, setLiveData] = useState<LiveData>({});
  const [loading, setLoading] = useState(true);
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcResult, setCalcResult] = useState('');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    Promise.allSettled([
      api.get('/ai-risk/dashboard'),
      api.get('/ai-forecast/dashboard'),
    ]).then(([riskRes, forecastRes]) => {
      const risk = riskRes.status === 'fulfilled' ? riskRes.value.data : undefined;
      const forecast = forecastRes.status === 'fulfilled' ? forecastRes.value.data : undefined;
      setLiveData({ risk, forecast });
    }).finally(() => setLoading(false));
  }, []);

  const calcAgencyScores = async () => {
    setCalcLoading(true);
    setCalcResult('');
    try {
      const res = await api.post<{ calculated: number }>('/agency-scores/bulk-calculate', { month, year });
      setCalcResult(`Calculated ${res.data.calculated} Agency`);
    } catch {
      setCalcResult('An error occurred');
    }
    setCalcLoading(false);
  };

  return (
    <Box p={3}>
      <Box display="flex" alignItems="center" gap={1} mb={3}>
        <AutoAwesome sx={{ color: '#4F46E5', fontSize: 32 }} />
        <Box>
          <Typography variant="h5" fontWeight={700}>AI Center</Typography>
          <Typography variant="body2" color="text.secondary">Central hub for all AI features</Typography>
        </Box>
      </Box>

      {/* Module Grid */}
      <Grid container spacing={2} mb={3}>
        {AI_MODULES.map(m => (
          <Grid item xs={12} sm={6} md={3} key={m.key}>
            <Card variant="outlined" sx={{ borderTop: `4px solid ${m.color}`, height: '100%', transition: 'all .2s', '&:hover': { boxShadow: 3, transform: 'translateY(-2px)' } }}>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <Box sx={{ color: m.color }}>{m.icon}</Box>
                  <Typography variant="subtitle2" fontWeight={700}>{m.label}</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" mb={2}>{m.desc}</Typography>
                {m.route ? (
                  <Button size="small" endIcon={<ArrowForward />} onClick={() => navigate(m.route!)} sx={{ color: m.color }}>
                    Open
                  </Button>
                ) : (
                  <Chip label="Coming Soon" size="small" variant="outlined" sx={{ color: m.color, borderColor: m.color }} />
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Paper>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: '1px solid #E2E8F0', px: 2 }}>
          {['Overview', 'AI Agency Score', 'AI Daily Summary', 'AI Recommendations'].map((t, i) => <Tab key={i} label={t} />)}
        </Tabs>

        {/* Overview */}
        {tab === 0 && (
          <Box p={3}>
            {loading ? <CircularProgress /> : (
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" fontWeight={700} mb={2}>AI Status</Typography>
                  <List dense>
                    {AI_MODULES.map(m => (
                      <ListItem key={m.key} sx={{ borderRadius: 1, mb: 0.5, bgcolor: '#F8FAFC' }}>
                        <ListItemIcon sx={{ minWidth: 32, color: m.color }}>{m.icon}</ListItemIcon>
                        <ListItemText primary={m.label} secondary={m.route ? 'Active' : 'Coming Soon'} />
                        <Chip
                          label={m.route ? 'On' : 'Coming Soon'}
                          size="small"
                          color={m.route ? 'success' : 'default'}
                          sx={{ fontWeight: 700 }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" fontWeight={700} mb={2}>Real-time AI Data</Typography>
                  {liveData.risk && (
                    <Box mb={2} sx={{ p: 1.5, border: '1px solid #FEE2E2', borderRadius: 2, bgcolor: '#FEF2F2' }}>
                      <Typography variant="body2" fontWeight={700} sx={{ color: '#DC2626', mb: 0.5 }}>Agency Risk</Typography>
                      <Box display="flex" gap={1} flexWrap="wrap">
                        {[
                          { l: 'Critical', v: liveData.risk.agencies.critical, c: '#DC2626' },
                          { l: 'High', v: liveData.risk.agencies.high, c: '#EA580C' },
                          { l: 'Medium', v: liveData.risk.agencies.medium, c: '#D97706' },
                          { l: 'Low', v: liveData.risk.agencies.low, c: '#16A34A' },
                        ].map(x => (
                          <Box key={x.l} sx={{ textAlign: 'center' }}>
                            <Typography variant="h6" fontWeight={800} sx={{ color: x.c }}>{x.v}</Typography>
                            <Typography variant="caption" color="text.secondary">{x.l}</Typography>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  )}
                  {liveData.forecast && (
                    <Box mb={2} sx={{ p: 1.5, border: '1px solid #DBEAFE', borderRadius: 2, bgcolor: '#EFF6FF' }}>
                      <Typography variant="body2" fontWeight={700} sx={{ color: '#2563EB', mb: 0.5 }}>KPI Forecast This Month</Typography>
                      <Box display="flex" gap={2}>
                        <Box><Typography variant="h6" fontWeight={800} sx={{ color: '#16A34A' }}>{liveData.forecast.summary.onTrack}</Typography><Typography variant="caption">On Track</Typography></Box>
                        <Box><Typography variant="h6" fontWeight={800} sx={{ color: '#D97706' }}>{liveData.forecast.summary.atRisk}</Typography><Typography variant="caption">At Risk</Typography></Box>
                        <Box><Typography variant="h6" fontWeight={800} sx={{ color: '#DC2626' }}>{liveData.forecast.summary.critical}</Typography><Typography variant="caption">Critical</Typography></Box>
                        <Box><Typography variant="h6" fontWeight={800} sx={{ color: '#6366F1' }}>{liveData.forecast.summary.avgVisitProjRate}%</Typography><Typography variant="caption">Result</Typography></Box>
                      </Box>
                    </Box>
                  )}
                  {liveData.risk?.recommendations?.slice(0, 2).map((r, i) => (
                    <Box key={i} display="flex" gap={1} mb={0.5}>
                      <Typography variant="body2" sx={{ color: '#D97706' }}>•</Typography>
                      <Typography variant="body2">{r}</Typography>
                    </Box>
                  ))}
                </Grid>
              </Grid>
            )}
          </Box>
        )}

        {/* AI Agency Score */}
        {tab === 1 && (
          <Box p={3}>
            <Typography variant="subtitle1" fontWeight={700} mb={2}>Auto-Calculate Agency Score</Typography>
            <Box display="flex" gap={2} alignItems="center" mb={3}>
              <FormControl size="small" sx={{ minWidth: 100 }}>
                <InputLabel>Month</InputLabel>
                <Select value={month} label="Month" onChange={e => setMonth(Number(e.target.value))}>
                  {Array.from({ length: 12 }, (_, i) => <MenuItem key={i+1} value={i+1}>{i+1}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField size="small" label="Year" type="number" value={year} onChange={e => setYear(Number(e.target.value))} sx={{ width: 100 }} />
              <Button variant="contained" onClick={calcAgencyScores} disabled={calcLoading} startIcon={<Speed />}>
                {calcLoading ? 'Calculating...' : 'Calculate Agency Score'}
              </Button>
              {calcResult && <Alert severity={calcResult.includes('error') ? 'error' : 'success'} sx={{ py: 0.5 }}>{calcResult}</Alert>}
            </Box>
            <Paper variant="outlined" sx={{ p: 2, bgcolor: '#F8FAFC' }}>
              <Typography variant="subtitle2" mb={1}>AI Agency Scoring Algorithm</Typography>
              {[
                { label: 'Visit Score (40%)', desc: 'Consistency of visits vs. target' },
                { label: 'Sales Score (30%)', desc: 'Sales vs. target and YoY growth' },
                { label: 'Growth Score (20%)', desc: 'Growth trend over the past 3 months' },
                { label: 'Risk Score (10%)', desc: 'Risk factors: contract expiry, declining sales, complaints' },
              ].map((item, i) => (
                <Box key={i} display="flex" gap={1} mb={1}>
                  <CheckCircle sx={{ color: '#16A34A', fontSize: 18, mt: 0.3 }} />
                  <Box>
                    <Typography variant="body2" fontWeight={700}>{item.label}</Typography>
                    <Typography variant="caption" color="text.secondary">{item.desc}</Typography>
                  </Box>
                </Box>
              ))}
            </Paper>
          </Box>
        )}

        {/* AI Daily Summary */}
        {tab === 2 && (
          <Box p={3}>
            <Typography variant="subtitle1" fontWeight={700} mb={2}>AI Daily Summary</Typography>
            <Alert severity="info" sx={{ mb: 2 }}>Daily summary is automatically sent to the team via LINE OA at 08:00 every day</Alert>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" mb={1}>Sample AI Daily Brief</Typography>
              <Divider sx={{ mb: 1 }} />
              {[
                '📊 Today\'s Site Visits: 12 scheduled (8 completed, 4 pending)',
                '⚠️ High-risk Agencies: 3 — TH-001, TH-045, TH-112',
                '🏆 Top KPI performer: Somchai (95%)',
                '📋 Overdue tasks: 7 items awaiting action',
                '💰 PR pending approval: 2 items totaling ฿45,000',
              ].map((line, i) => (
                <Box key={i} display="flex" gap={1} mb={0.5}>
                  <Typography variant="body2">{line}</Typography>
                </Box>
              ))}
            </Paper>
          </Box>
        )}

        {/* AI Insights */}
        {tab === 3 && (
          <Box p={3}>
            <Typography variant="subtitle1" fontWeight={700} mb={2}>AI Insights & Recommendations</Typography>
            <Grid container spacing={2}>
              {[
                { icon: <TrendingUp sx={{ color: '#16A34A' }} />, title: 'Visit Opportunity', desc: 'Zone B has 5 Grade-A Agencies that have not been visited in 30 days', action: 'View Plan', color: '#16A34A' },
                { icon: <Warning sx={{ color: '#DC2626' }} />, title: 'High Risk', desc: '3 Agencies have contracts expiring within 60 days and declining sales', action: 'View Agencies', color: '#DC2626' },
                { icon: <Stars sx={{ color: '#D97706' }} />, title: 'Best Practice', desc: 'Team A has an 85% conversion rate — consider using as a template', action: 'View Team', color: '#D97706' },
                { icon: <Lightbulb sx={{ color: '#4F46E5' }} />, title: 'KPI Improvement', desc: '4 staff members are trending below target KPI for next month', action: 'View List', color: '#4F46E5' },
              ].map((item, i) => (
                <Grid item xs={12} sm={6} key={i}>
                  <Paper variant="outlined" sx={{ p: 2, borderLeft: `4px solid ${item.color}` }}>
                    <Box display="flex" gap={1} mb={1}>{item.icon}<Typography variant="subtitle2" fontWeight={700}>{item.title}</Typography></Box>
                    <Typography variant="body2" color="text.secondary" mb={1}>{item.desc}</Typography>
                    <Button size="small" sx={{ color: item.color }} endIcon={<ArrowForward fontSize="small" />}>{item.action}</Button>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
