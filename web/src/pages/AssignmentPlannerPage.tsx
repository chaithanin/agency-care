import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
  Alert,
  Paper,
} from '@mui/material';
import { api } from '../api/client';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} id={`tabpanel-${index}`} aria-labelledby={`tab-${index}`} {...other}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

export default function AssignmentPlannerPage() {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [newEmployeeId, setNewEmployeeId] = useState('');
  const [newMonth, setNewMonth] = useState(new Date().toISOString().split('T')[0].slice(0, 7));
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [approveNotes, setApproveNotes] = useState('');
  const [approveLoading, setApproveLoading] = useState(false);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    setLoading(true);
    try {
      const res = await api.get('/assignments/plans');
      setPlans(res.data || []);
    } catch (err) {
      console.error('Failed to load plans:', err);
    }
    setLoading(false);
  };

  const handleCreatePlan = async () => {
    if (!newEmployeeId || !newMonth) return;
    setLoading(true);
    try {
      const res = await api.post('/assignments/plans/draft', { employeeId: newEmployeeId, month: newMonth });
      setCreateDialogOpen(false);
      await loadPlans();
      setSelectedPlan(res.data.plan);
      setTabValue(1);
    } catch (err: any) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleSubmit = async (planId: string) => {
    setLoading(true);
    try {
      await api.post(`/assignments/plans/${planId}/submit`);
      await loadPlans();
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleApprovePlan = async () => {
    if (!selectedPlan) return;
    setApproveLoading(true);
    try {
      await api.post(`/assignments/plans/${selectedPlan.id}/approve`, { notes: approveNotes });
      setApproveDialogOpen(false);
      await loadPlans();
    } catch (err) {
      console.error(err);
    }
    setApproveLoading(false);
  };


  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight={700}>Assignment Planner</Typography>
        <Button variant="contained" onClick={() => setCreateDialogOpen(true)} disabled={loading}>
          + Create Draft
        </Button>
      </Stack>

      <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Plans List" id="tab-0" />
        <Tab label="Plan Details" id="tab-1" disabled={!selectedPlan} />
      </Tabs>

      <TabPanel value={tabValue} index={0}>
        {loading && <LinearProgress sx={{ mb: 2 }} />}
        {plans.length === 0 ? (
          <Alert severity="info">No plans yet</Alert>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#fafafa' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Month</TableCell>
                  <TableCell>Employee</TableCell>
                  <TableCell>Working Days</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {plans.map((plan) => (
                  <TableRow key={plan.id} onClick={() => { setSelectedPlan(plan); setTabValue(1); }} sx={{ cursor: 'pointer' }}>
                    <TableCell>{plan.month}</TableCell>
                    <TableCell>{plan.employee?.name}</TableCell>
                    <TableCell>{plan.workingDays}</TableCell>
                    <TableCell><Chip label={plan.status} size="small" /></TableCell>
                    <TableCell>
                      {plan.status === 'draft' && (
                        <Button size="small" variant="contained" onClick={(e) => { e.stopPropagation(); handleSubmit(plan.id); }}>
                          Submit
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        {selectedPlan && (
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={700}>{selectedPlan.employee?.name} - {selectedPlan.month}</Typography>
              <Typography variant="body2" color="text.secondary">Working Days: {selectedPlan.workingDays} | Quota: {selectedPlan.quotaTarget}</Typography>
            </CardContent>
          </Card>
        )}
      </TabPanel>

      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Plan Draft</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField label="Employee ID" value={newEmployeeId} onChange={(e) => setNewEmployeeId(e.target.value)} fullWidth />
          <TextField label="Month" type="month" value={newMonth} onChange={(e) => setNewMonth(e.target.value)} fullWidth sx={{ mt: 2 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreatePlan} variant="contained" disabled={loading}>Create</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={approveDialogOpen} onClose={() => setApproveDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Approve Plan</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField label="Notes" value={approveNotes} onChange={(e) => setApproveNotes(e.target.value)} fullWidth multiline rows={3} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApproveDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleApprovePlan} variant="contained" disabled={approveLoading}>Approve</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
