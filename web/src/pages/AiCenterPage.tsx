import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Grid, Card, CardContent, Chip, Tabs, Tab, Button,
  List, ListItem, ListItemIcon, ListItemText, CircularProgress, Alert, Divider,
  TextField, Select, MenuItem, FormControl, InputLabel, LinearProgress,
} from '@mui/material';
import {
  Psychology, AutoAwesome, Route, CalendarMonth, Assessment, Stars, Warning,
  TrendingUp, Lightbulb, ArrowForward, CheckCircle, Speed,
} from '@mui/icons-material';
import { api } from '../api/client';

const AI_MODULES = [
  { key: 'assignment', label: 'AI Assignment', icon: <Psychology />, desc: 'จัดสรรพนักงานเข้า Agency อัตโนมัติตามระดับ', color: '#4F46E5', route: '/auto-assign' },
  { key: 'scheduler', label: 'AI Scheduler', icon: <CalendarMonth />, desc: 'สร้างตารางงานรายเดือนอัตโนมัติ', color: '#7C3AED', route: '/scheduling' },
  { key: 'route', label: 'AI Route', icon: <Route />, desc: 'เส้นทางเยี่ยมที่เหมาะสมที่สุด', color: '#2563EB', route: '/route' },
  { key: 'performance', label: 'AI Performance', icon: <Assessment />, desc: 'วิเคราะห์ผลงานทีมและบุคคล', color: '#16A34A', route: '/analytics' },
  { key: 'score', label: 'AI Agency Score', icon: <Stars />, desc: 'คำนวณคะแนน Agency อัตโนมัติ', color: '#D97706', route: '/agencies' },
  { key: 'risk', label: 'AI Risk Analysis', icon: <Warning />, desc: 'วิเคราะห์ความเสี่ยง Agency และพนักงาน', color: '#DC2626', route: null },
  { key: 'forecast', label: 'AI Forecast', icon: <TrendingUp />, desc: 'พยากรณ์ยอดขายและ KPI ล่วงหน้า', color: '#0891B2', route: null },
  { key: 'recommendation', label: 'AI Recommendation', icon: <Lightbulb />, desc: 'คำแนะนำการปรับปรุงผลงาน', color: '#059669', route: null },
];

interface AnalyticsSummary {
  totalVisits?: number; avgVisitScore?: number; topPerformers?: Array<{ name: string; score: number }>;
  riskAgencies?: Array<{ name: string; lastVisit: string; risk: string }>;
  recommendations?: string[];
  forecast?: Array<{ month: string; predicted: number }>;
}

export default function AiCenterPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcResult, setCalcResult] = useState('');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    api.get<AnalyticsSummary>('/analytics/summary').then(r => setSummary(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const calcAgencyScores = async () => {
    setCalcLoading(true);
    setCalcResult('');
    try {
      const res = await api.post<{ calculated: number }>('/agency-scores/bulk-calculate', { month, year });
      setCalcResult(`คำนวณเสร็จ ${res.data.calculated} Agency`);
    } catch {
      setCalcResult('เกิดข้อผิดพลาด');
    }
    setCalcLoading(false);
  };

  return (
    <Box p={3}>
      <Box display="flex" alignItems="center" gap={1} mb={3}>
        <AutoAwesome sx={{ color: '#4F46E5', fontSize: 32 }} />
        <Box>
          <Typography variant="h5" fontWeight={700}>AI Center</Typography>
          <Typography variant="body2" color="text.secondary">ศูนย์กลาง AI ทุก Feature ของระบบ</Typography>
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
                    เปิดใช้งาน
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
          {['Overview','AI Agency Score','AI Daily Summary','AI Insights'].map((t, i) => <Tab key={i} label={t} />)}
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
                          label={m.route ? 'ON' : 'Soon'}
                          size="small"
                          color={m.route ? 'success' : 'default'}
                          sx={{ fontWeight: 700 }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" fontWeight={700} mb={2}>AI Metrics</Typography>
                  {[
                    { label: 'AI Assignment Accuracy', value: 92, color: '#4F46E5' },
                    { label: 'Route Optimization', value: 87, color: '#2563EB' },
                    { label: 'Performance Prediction', value: 78, color: '#16A34A' },
                    { label: 'Agency Risk Detection', value: 65, color: '#DC2626' },
                  ].map(m => (
                    <Box key={m.label} mb={2}>
                      <Box display="flex" justifyContent="space-between" mb={0.5}>
                        <Typography variant="body2">{m.label}</Typography>
                        <Typography variant="body2" fontWeight={700} sx={{ color: m.color }}>{m.value}%</Typography>
                      </Box>
                      <LinearProgress variant="determinate" value={m.value} sx={{ height: 8, borderRadius: 4, bgcolor: '#E2E8F0', '& .MuiLinearProgress-bar': { bgcolor: m.color } }} />
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
            <Typography variant="subtitle1" fontWeight={700} mb={2}>คำนวณ Agency Score อัตโนมัติ</Typography>
            <Box display="flex" gap={2} alignItems="center" mb={3}>
              <FormControl size="small" sx={{ minWidth: 100 }}>
                <InputLabel>เดือน</InputLabel>
                <Select value={month} label="เดือน" onChange={e => setMonth(Number(e.target.value))}>
                  {Array.from({ length: 12 }, (_, i) => <MenuItem key={i+1} value={i+1}>{i+1}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField size="small" label="ปี" type="number" value={year} onChange={e => setYear(Number(e.target.value))} sx={{ width: 100 }} />
              <Button variant="contained" onClick={calcAgencyScores} disabled={calcLoading} startIcon={<Speed />}>
                {calcLoading ? 'กำลังคำนวณ...' : 'คำนวณ Agency Score'}
              </Button>
              {calcResult && <Alert severity={calcResult.includes('ข้อผิด') ? 'error' : 'success'} sx={{ py: 0.5 }}>{calcResult}</Alert>}
            </Box>
            <Paper variant="outlined" sx={{ p: 2, bgcolor: '#F8FAFC' }}>
              <Typography variant="subtitle2" mb={1}>อัลกอริทึม AI Agency Scoring</Typography>
              {[
                { label: 'Visit Score (40%)', desc: 'ความสม่ำเสมอของการเข้าเยี่ยม vs เป้าหมาย' },
                { label: 'Sales Score (30%)', desc: 'ยอดขายเทียบกับ Target และ YoY Growth' },
                { label: 'Growth Score (20%)', desc: 'แนวโน้มการเติบโต 3 เดือนย้อนหลัง' },
                { label: 'Risk Score (10%)', desc: 'ปัจจัยเสี่ยง: หมดสัญญา, ลดยอด, ร้องเรียน' },
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
            <Alert severity="info" sx={{ mb: 2 }}>ส่งสรุปประจำวันให้ทีมผ่าน LINE OA ทุก 08:00 น. อัตโนมัติ</Alert>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" mb={1}>ตัวอย่าง AI Daily Brief</Typography>
              <Divider sx={{ mb: 1 }} />
              {[
                '📊 วันนี้มีนัด Site Visit 12 รายการ (เสร็จ 8, ค้าง 4)',
                '⚠️ Agency เสี่ยงสูง 3 ราย: TH-001, TH-045, TH-112',
                '🏆 พนักงานทำ KPI ดีที่สุด: สมชาย (95%)',
                '📋 งานค้างเกินกำหนด 7 รายการ รอดำเนินการ',
                '💰 PR รออนุมัติ 2 รายการ มูลค่า ฿45,000',
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
                { icon: <TrendingUp sx={{ color: '#16A34A' }} />, title: 'โอกาสเพิ่ม Visit', desc: 'Zone B มี 5 Agency ระดับ A ที่ยังไม่ได้รับการเยี่ยมใน 30 วัน', action: 'ดูแผน', color: '#16A34A' },
                { icon: <Warning sx={{ color: '#DC2626' }} />, title: 'ความเสี่ยงสูง', desc: '3 Agency มีสัญญาหมดใน 60 วัน และยอดขายลดลง', action: 'ดู Agency', color: '#DC2626' },
                { icon: <Stars sx={{ color: '#D97706' }} />, title: 'Best Practice', desc: 'ทีม A มี Conversion Rate 85% — พิจารณาใช้เป็น Template', action: 'ดูทีม', color: '#D97706' },
                { icon: <Lightbulb sx={{ color: '#4F46E5' }} />, title: 'ปรับปรุง KPI', desc: 'พนักงาน 4 คน มีแนวโน้ม KPI ต่ำกว่า Target ในเดือนหน้า', action: 'ดูรายชื่อ', color: '#4F46E5' },
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
