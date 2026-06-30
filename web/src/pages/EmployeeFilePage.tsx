import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Grid, Card, Chip, Tabs, Tab, Table,
  TableHead, TableRow, TableCell, TableBody, Button, Avatar, LinearProgress,
  CircularProgress, Alert, Divider, Stack,
} from '@mui/material';
import {
  ArrowBack, Assignment, DirectionsWalk, School, Assessment, Description,
  BeachAccess, ReceiptLong, EmojiEvents,
} from '@mui/icons-material';
import { api } from '../api/client';
import { ExportPdfButton } from '../components/ExportPdfButton';

const GRADE_COLOR: Record<string, string> = { A: '#16A34A', B: '#2563EB', C: '#D97706', D: '#DC2626' };
const MONTH_TH = ['','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

interface Employee {
  id: string; code: string; name: string; phone?: string; zone?: string;
  position: string; isActive: boolean; team?: { name: string };
  user?: { email: string; role: string };
  kpiTargets: Array<{ month: number; year: number; siteVisit: number; followUp: number; newAgency: number }>;
  leaveRequests: Array<{ id: string; leaveType: string; startDate: string; endDate: string; days: number; status: string }>;
  tasks: Array<{ id: string; title: string; status: string; dueDate?: string; priority: string }>;
  documents: Array<{ id: string; docType: string; docNumber?: string; month: number; year: number; status: string }>;
}

interface TabPanelProps { children?: React.ReactNode; index: number; value: number }
function TabPanel({ children, index, value }: TabPanelProps) {
  return <div hidden={value !== index}>{value === index && <Box pt={2}>{children}</Box>}</div>;
}

export default function EmployeeFilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [emp, setEmp] = useState<Employee | null>(null);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [trainings, setTrainings] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.get<Employee>(`/employees/${id}`),
      api.get<any[]>(`/evaluations?employeeId=${id}`),
      api.get<any[]>(`/training?employeeId=${id}`),
      api.get<any[]>(`/expenses?employeeId=${id}`),
    ]).then(([empR, evalR, trainR, expR]) => {
      setEmp(empR.data);
      setEvaluations(evalR.data ?? []);
      setTrainings(trainR.data ?? []);
      setExpenses(expR.data ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Box p={6} textAlign="center"><CircularProgress /></Box>;
  if (!emp) return <Alert severity="error" sx={{ m: 3 }}>Employee not found</Alert>;

  const latestKpi = emp.kpiTargets?.[0];
  const totalLeave = emp.leaveRequests?.reduce((s, l) => s + l.days, 0) ?? 0;
  const pendingTasks = emp.tasks?.filter(t => t.status !== 'done').length ?? 0;
  const latestEval = evaluations[0];

  return (
    <Box p={3}>
      {/* Header */}
      <Box display="flex" alignItems="center" gap={1} mb={3}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/employees')}>Back</Button>
        <Typography variant="h5" fontWeight={700} flex={1}>{emp.name}</Typography>
        <Chip label={emp.isActive ? 'Active' : 'Inactive'} color={emp.isActive ? 'success' : 'default'} />
      </Box>

      {/* Profile Card */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={3}>
          <Grid item xs="auto">
            <Avatar sx={{ width: 80, height: 80, bgcolor: '#1e3a5f', fontSize: 32 }}>{emp.name[0]}</Avatar>
          </Grid>
          <Grid item xs>
            <Typography variant="h5" fontWeight={700}>{emp.name}</Typography>
            <Typography color="text.secondary">{emp.code} · {emp.position} · {emp.team?.name ?? 'No Team'}</Typography>
            <Typography color="text.secondary">📞 {emp.phone ?? '—'} · 📍 {emp.zone ?? '—'}</Typography>
            {emp.user && <Typography color="text.secondary" variant="body2">✉️ {emp.user.email}</Typography>}
          </Grid>
          {latestEval && (
            <Grid item xs={12} sm="auto" textAlign="center">
              <Typography variant="caption" color="text.secondary">Latest Evaluation</Typography>
              <Typography variant="h2" fontWeight={700} sx={{ color: GRADE_COLOR[latestEval.grade ?? ''] ?? '#666' }}>
                {latestEval.grade ?? '—'}
              </Typography>
              <Typography variant="caption">Score {latestEval.overallScore ?? '—'}/100</Typography>
            </Grid>
          )}
        </Grid>

        {/* KPI Summary */}
        {latestKpi && (
          <Box mt={2}>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="subtitle2" color="text.secondary" mb={1}>KPI Target {MONTH_TH[latestKpi.month]} {latestKpi.year + 543}</Typography>
            <Grid container spacing={2}>
              {[
                ['Site Visit', latestKpi.siteVisit],
                ['Follow-up', latestKpi.followUp],
                ['New Agency', latestKpi.newAgency],
                ['Leave Used', totalLeave, 'days'],
                ['Pending Tasks', pendingTasks, 'tasks'],
              ].map(([label, val, unit]) => (
                <Grid item xs={6} sm={2.4} key={String(label)}>
                  <Card variant="outlined" sx={{ textAlign: 'center', py: 1 }}>
                    <Typography variant="h5" fontWeight={700} color="primary">{String(val ?? '—')}</Typography>
                    <Typography variant="caption" color="text.secondary">{String(label)} {unit ?? ''}</Typography>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}
      </Paper>

      {/* Tabs */}
      <Paper>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: '1px solid #E2E8F0', px: 2 }}>
          {[
            { label: 'Tasks', icon: <Assignment /> },
            { label: 'Site Visit', icon: <DirectionsWalk /> },
            { label: 'Training', icon: <School /> },
            { label: 'Evaluations', icon: <Assessment /> },
            { label: 'Documents', icon: <Description /> },
            { label: 'Leave', icon: <BeachAccess /> },
            { label: 'Expenses', icon: <ReceiptLong /> },
            { label: 'PR', icon: <EmojiEvents /> },
          ].map((t, i) => <Tab key={i} label={t.label} icon={t.icon} iconPosition="start" sx={{ minHeight: 48 }} />)}
        </Tabs>

        {/* Tasks */}
        <TabPanel value={tab} index={0}>
          <Box p={2}>
            <Stack direction="row" gap={1} mb={2} justifyContent="flex-end">
              <ExportPdfButton tableId="tasks-table" filename="employee-tasks" title={`Tasks - ${emp.name}`} size="small" />
            </Stack>
            <Table size="small" id="tasks-table">
              <TableHead><TableRow sx={{ bgcolor: '#F8FAFC' }}>
                {['Task','Priority','Due Date','Status'].map(h => <TableCell key={h} sx={{ fontWeight: 700 }}>{h}</TableCell>)}
              </TableRow></TableHead>
              <TableBody>
                {(emp.tasks ?? []).slice(0, 20).map(t => (
                  <TableRow key={t.id} hover>
                    <TableCell>{t.title}</TableCell>
                    <TableCell><Chip label={t.priority} size="small" color={t.priority === 'urgent' ? 'error' : t.priority === 'high' ? 'warning' : 'default'} /></TableCell>
                    <TableCell>{t.dueDate ? new Date(t.dueDate).toLocaleDateString('th-TH') : '—'}</TableCell>
                    <TableCell><Chip label={t.status} size="small" color={t.status === 'done' ? 'success' : 'default'} /></TableCell>
                  </TableRow>
                ))}
                {!emp.tasks?.length && <TableRow><TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.secondary' }}>No tasks</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Box>
        </TabPanel>

        {/* Site Visit — placeholder pulling from employee.visitPlans relation */}
        <TabPanel value={tab} index={1}>
          <Box p={2}>
            <Typography color="text.secondary" textAlign="center" py={4}>Site Visit History — view in Site Visit Report</Typography>
            <Box textAlign="center">
              <Button variant="outlined" onClick={() => navigate(`/site-visit-report?employeeId=${emp.id}`)}>View Site Visit Report</Button>
            </Box>
          </Box>
        </TabPanel>

        {/* Training */}
        <TabPanel value={tab} index={2}>
          <Box p={2}>
            <Stack direction="row" gap={1} mb={2} justifyContent="flex-end">
              <ExportPdfButton tableId="training-table" filename="employee-training" title={`Training - ${emp.name}`} size="small" />
            </Stack>
            <Table size="small" id="training-table">
              <TableHead><TableRow sx={{ bgcolor: '#F8FAFC' }}>
                {['Course','Date','Hours','Score','Result'].map(h => <TableCell key={h} sx={{ fontWeight: 700 }}>{h}</TableCell>)}
              </TableRow></TableHead>
              <TableBody>
                {trainings.map(t => (
                  <TableRow key={t.id} hover>
                    <TableCell>{t.trainingName}</TableCell>
                    <TableCell>{new Date(t.trainingDate).toLocaleDateString('th-TH')}</TableCell>
                    <TableCell>{t.hours ?? '—'}</TableCell>
                    <TableCell>{t.score ?? '—'}</TableCell>
                    <TableCell><Chip label={t.passed ? 'Passed' : 'Failed'} size="small" color={t.passed ? 'success' : 'error'} /></TableCell>
                  </TableRow>
                ))}
                {!trainings.length && <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>No training history</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Box>
        </TabPanel>

        {/* Evaluations */}
        <TabPanel value={tab} index={3}>
          <Box p={2}>
            <Stack direction="row" gap={1} mb={2} justifyContent="flex-end">
              <ExportPdfButton tableId="evaluations-table" filename="employee-evaluations" title={`Evaluations - ${emp.name}`} size="small" />
            </Stack>
            <Table size="small" id="evaluations-table">
              <TableHead><TableRow sx={{ bgcolor: '#F8FAFC' }}>
                {['Month','KPI','Behavior','Total','Grade','Evaluated By'].map(h => <TableCell key={h} sx={{ fontWeight: 700 }}>{h}</TableCell>)}
              </TableRow></TableHead>
              <TableBody>
                {evaluations.map(e => (
                  <TableRow key={e.id} hover>
                    <TableCell>{MONTH_TH[e.month]} {e.year + 543}</TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <LinearProgress variant="determinate" value={e.kpiScore ?? 0} sx={{ width: 60, height: 6, borderRadius: 3 }} />
                        {e.kpiScore ?? '—'}
                      </Box>
                    </TableCell>
                    <TableCell>{e.behaviorScore ?? '—'}</TableCell>
                    <TableCell>{e.overallScore ?? '—'}</TableCell>
                    <TableCell>
                      <Chip label={e.grade ?? '—'} size="small" sx={{ bgcolor: GRADE_COLOR[e.grade ?? ''] ?? '#E2E8F0', color: GRADE_COLOR[e.grade ?? ''] ? '#fff' : 'inherit', fontWeight: 700 }} />
                    </TableCell>
                    <TableCell>{e.evaluatedBy?.name ?? '—'}</TableCell>
                  </TableRow>
                ))}
                {!evaluations.length && <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>No evaluations</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Box>
        </TabPanel>

        {/* Documents */}
        <TabPanel value={tab} index={4}>
          <Box p={2}>
            <Stack direction="row" gap={1} mb={2} justifyContent="flex-end">
              <ExportPdfButton tableId="documents-table" filename="employee-documents" title={`Documents - ${emp.name}`} size="small" />
            </Stack>
            <Table size="small" id="documents-table">
              <TableHead><TableRow sx={{ bgcolor: '#F8FAFC' }}>
                {['Number','Type','Month','Status'].map(h => <TableCell key={h} sx={{ fontWeight: 700 }}>{h}</TableCell>)}
              </TableRow></TableHead>
              <TableBody>
                {(emp.documents ?? []).map(d => (
                  <TableRow key={d.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/docs/${d.id}`)}>
                    <TableCell>{d.docNumber ?? d.id.slice(0,8)}</TableCell>
                    <TableCell><Chip label={d.docType.toUpperCase()} size="small" variant="outlined" /></TableCell>
                    <TableCell>{MONTH_TH[d.month]} {d.year + 543}</TableCell>
                    <TableCell><Chip label={d.status} size="small" /></TableCell>
                  </TableRow>
                ))}
                {!emp.documents?.length && <TableRow><TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.secondary' }}>No documents</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Box>
        </TabPanel>

        {/* Leave */}
        <TabPanel value={tab} index={5}>
          <Box p={2}>
            <Stack direction="row" gap={1} mb={2} justifyContent="flex-end">
              <ExportPdfButton tableId="leave-table" filename="employee-leave" title={`Leave Requests - ${emp.name}`} size="small" />
            </Stack>
            <Table size="small" id="leave-table">
              <TableHead><TableRow sx={{ bgcolor: '#F8FAFC' }}>
                {['Type','Start Date','End Date','Days','Status'].map(h => <TableCell key={h} sx={{ fontWeight: 700 }}>{h}</TableCell>)}
              </TableRow></TableHead>
              <TableBody>
                {(emp.leaveRequests ?? []).map(l => (
                  <TableRow key={l.id} hover>
                    <TableCell>{l.leaveType}</TableCell>
                    <TableCell>{new Date(l.startDate).toLocaleDateString('th-TH')}</TableCell>
                    <TableCell>{new Date(l.endDate).toLocaleDateString('th-TH')}</TableCell>
                    <TableCell>{l.days} days</TableCell>
                    <TableCell><Chip label={l.status} size="small" color={l.status === 'approved' ? 'success' : l.status === 'rejected' ? 'error' : 'default'} /></TableCell>
                  </TableRow>
                ))}
                {!emp.leaveRequests?.length && <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>No leave requests</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Box>
        </TabPanel>

        {/* Expenses */}
        <TabPanel value={tab} index={6}>
          <Box p={2}>
            <Stack direction="row" gap={1} mb={2} justifyContent="flex-end">
              <ExportPdfButton tableId="expenses-table" filename="employee-expenses" title={`Expenses - ${emp.name}`} size="small" />
            </Stack>
            <Table size="small" id="expenses-table">
              <TableHead><TableRow sx={{ bgcolor: '#F8FAFC' }}>
                {['Date','Type','Amount','Details','Status'].map(h => <TableCell key={h} sx={{ fontWeight: 700 }}>{h}</TableCell>)}
              </TableRow></TableHead>
              <TableBody>
                {expenses.map(e => (
                  <TableRow key={e.id} hover>
                    <TableCell>{new Date(e.date).toLocaleDateString('th-TH')}</TableCell>
                    <TableCell>{e.category}</TableCell>
                    <TableCell>฿{Number(e.amount).toLocaleString()}</TableCell>
                    <TableCell>{e.description ?? '—'}</TableCell>
                    <TableCell><Chip label={e.status} size="small" color={e.status === 'approved' ? 'success' : e.status === 'rejected' ? 'error' : 'default'} /></TableCell>
                  </TableRow>
                ))}
                {!expenses.length && <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>No expenses</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Box>
        </TabPanel>

        {/* PR */}
        <TabPanel value={tab} index={7}>
          <Box p={2} textAlign="center" color="text.secondary" py={4}>
            <Button variant="outlined" onClick={() => navigate('/pr')}>View PR Tracking</Button>
          </Box>
        </TabPanel>
      </Paper>
    </Box>
  );
}
