import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent, Chip, Table, TableHead,
  TableRow, TableCell, TableBody, Button, TextField, Select, MenuItem,
  FormControl, InputLabel, Alert, IconButton, CircularProgress, LinearProgress,
} from '@mui/material';
import { Refresh, Stars, TrendingUp } from '@mui/icons-material';
import { api, errMsg } from '../api/client';
import { ExportPdfButton } from '../components/ExportPdfButton';

const GRADE_COLOR: Record<string,string> = { A:'#16A34A', B:'#2563EB', C:'#D97706', D:'#DC2626' };

interface Score {
  id: string; month: number; year: number; grade?: string;
  visitScore?: number; salesScore?: number; growthScore?: number; riskScore?: number; overallScore?: number;
  notes?: string;
  agency: { id: string; name: string; code: string; level?: string };
  createdBy: { name: string };
}

const MONTH_TH = ['','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

export default function AgencyScorePage() {
  const [scores, setScores] = useState<Score[]>([]);
  const [leaderboard, setLeaderboard] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);
  const [calcLoading, setCalcLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [tab, setTab] = useState<'list'|'leaderboard'>('leaderboard');

  const load = async () => {
    setLoading(true);
    try {
      const [lbRes, scRes] = await Promise.all([
        api.get<Score[]>(`/agency-scores/leaderboard?year=${year}&month=${month}`),
        api.get<Score[]>(`/agency-scores?year=${year}&month=${month}`),
      ]);
      setLeaderboard(lbRes.data ?? []);
      setScores(scRes.data ?? []);
    } catch (e) { setError(errMsg(e)); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [month, year]);

  const calcBulk = async () => {
    setCalcLoading(true);
    setError('');
    try {
      const res = await api.post<{ calculated: number }>('/agency-scores/bulk-calculate', { month, year });
      setSuccess(`Calculation complete — ${res.data.calculated} Agencies`);
      load();
    } catch (e) { setError(errMsg(e)); }
    setCalcLoading(false);
    setTimeout(() => setSuccess(''), 4000);
  };

  const byGrade = (g: string) => leaderboard.filter(s => s.grade === g).length;

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Box display="flex" alignItems="center" gap={1}><Stars sx={{ color:'#D97706' }} /><Typography variant="h5" fontWeight={700}>Agency Score</Typography></Box>
          <Typography variant="body2" color="text.secondary">Monthly Agency evaluation scores</Typography>
        </Box>
        <Box display="flex" gap={1} alignItems="center">
          <FormControl size="small" sx={{ minWidth:80 }}>
            <InputLabel>Month</InputLabel>
            <Select value={month} label="Month" onChange={e => setMonth(Number(e.target.value))}>
              {Array.from({length:12},(_,i)=><MenuItem key={i+1} value={i+1}>{i+1}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField size="small" label="Year" type="number" value={year} onChange={e=>setYear(Number(e.target.value))} sx={{ width:90 }} />
          <Button variant="contained" onClick={calcBulk} disabled={calcLoading} startIcon={<TrendingUp />}>
            {calcLoading ? 'Calculating...' : 'AI Calculate'}
          </Button>
          <ExportPdfButton tableId="agency-score-table" filename="agency-scores" title="Agency Score" size="small" />
          <IconButton onClick={load}><Refresh /></IconButton>
        </Box>
      </Box>

      {success && <Alert severity="success" sx={{ mb:2 }}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ mb:2 }}>{error}</Alert>}

      {/* Grade summary */}
      <Grid container spacing={2} mb={2}>
        {['A','B','C','D'].map(g => (
          <Grid item xs={6} sm={3} key={g}>
            <Card variant="outlined" sx={{ borderTop:`4px solid ${GRADE_COLOR[g]}`, textAlign:'center' }}>
              <CardContent sx={{ py:1.5, px:2, '&:last-child':{pb:1.5} }}>
                <Typography variant="h4" fontWeight={900} sx={{ color:GRADE_COLOR[g] }}>{g}</Typography>
                <Typography variant="h6" fontWeight={700}>{byGrade(g)}</Typography>
                <Typography variant="caption" color="text.secondary">Agency</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Tabs */}
      <Box display="flex" gap={1} mb={2}>
        <Button variant={tab==='leaderboard'?'contained':'outlined'} size="small" onClick={() => setTab('leaderboard')}>Ranking</Button>
        <Button variant={tab==='list'?'contained':'outlined'} size="small" onClick={() => setTab('list')}>All</Button>
      </Box>

      <Paper>
        {loading ? <Box p={6} textAlign="center"><CircularProgress /></Box> : (
          <Table id="agency-score-table" size="small">
            <TableHead><TableRow sx={{ bgcolor:'#F8FAFC' }}>
              {tab==='leaderboard'
                ? ['#','Agency','Level','Visits','Sales','Growth','Risk','Total','Grade'].map(h=><TableCell key={h} sx={{ fontWeight:700 }}>{h}</TableCell>)
                : ['Agency','Level','Month','Visits','Sales','Growth','Risk','Total','Grade','Notes'].map(h=><TableCell key={h} sx={{ fontWeight:700 }}>{h}</TableCell>)
              }
            </TableRow></TableHead>
            <TableBody>
              {(tab==='leaderboard'?leaderboard:scores).length === 0 ? (
                <TableRow><TableCell colSpan={10} align="center" sx={{ py:6, color:'text.secondary' }}>No score data — click "AI Calculate" to generate</TableCell></TableRow>
              ) : (tab==='leaderboard'?leaderboard:scores).map((s, idx) => (
                <TableRow key={s.id} hover>
                  {tab==='leaderboard' && <TableCell><Typography fontWeight={700} sx={{ color: idx<3?['#D97706','#6B7280','#92400E'][idx]:'inherit' }}>#{idx+1}</Typography></TableCell>}
                  <TableCell>
                    <Typography variant="body2" fontWeight={700}>{s.agency.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{s.agency.code}</Typography>
                  </TableCell>
                  <TableCell><Chip label={s.agency.level??'—'} size="small" /></TableCell>
                  {tab==='list' && <TableCell>{MONTH_TH[s.month]} {s.year+543}</TableCell>}
                  {[s.visitScore,s.salesScore,s.growthScore,s.riskScore].map((v,i) => (
                    <TableCell key={i}>
                      {v != null ? (
                        <Box>
                          <Typography variant="body2">{v}</Typography>
                          <LinearProgress variant="determinate" value={v} sx={{ height:4, borderRadius:2, bgcolor:'#E2E8F0' }} />
                        </Box>
                      ) : '—'}
                    </TableCell>
                  ))}
                  <TableCell><Typography fontWeight={700} variant="body2">{s.overallScore??'—'}</Typography></TableCell>
                  <TableCell>
                    <Chip label={s.grade??'—'} size="small" sx={{ bgcolor: GRADE_COLOR[s.grade??'']??'#E2E8F0', color: GRADE_COLOR[s.grade??'']?'#fff':'inherit', fontWeight:700 }} />
                  </TableCell>
                  {tab==='list' && <TableCell>{s.notes??'—'}</TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>
    </Box>
  );
}
