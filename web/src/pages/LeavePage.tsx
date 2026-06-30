import { useCallback, useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Stack, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Select, FormControl, InputLabel, Alert,
  Tabs, Tab, Card, CardContent, Grid,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import { api, errMsg } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useT } from '../i18n';
import { ExportPdfButton } from '../components/ExportPdfButton';

interface LeaveRequest {
  id: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  reason?: string;
  status: string;
  rejectedReason?: string;
  createdAt: string;
  employee: { id: string; name: string; code: string; position: string };
  approvedBy?: { id: string; name: string };
}

interface HistoryRecord {
  id: string;
  employee: { id: string; name: string; code: string };
  leaveType: string;
  date: string;
  count: number;
  reason?: string;
  lateArrivalCount?: number;
  warningCount?: number;
}

export default function LeavePage() {
  const { t } = useT();
  const { user } = useAuth();
  const isManager = ['manager', 'super_admin', 'admin', 'closer'].includes(user?.activeRole ?? '');

  const LEAVE_TYPES = [
    { value: 'sick', label: t('leave.typeSick') },
    { value: 'annual', label: t('leave.typeAnnual') },
    { value: 'personal', label: t('leave.typePersonal') },
    { value: 'other', label: t('leave.typeOther') },
  ];

  function statusColor(s: string): 'default' | 'warning' | 'success' | 'error' | 'info' {
    if (s === 'pending') return 'warning';
    if (s === 'approved') return 'success';
    if (s === 'rejected') return 'error';
    if (s === 'cancelled') return 'default';
    return 'info';
  }

  function statusLabel(s: string) {
    const m: Record<string, string> = {
      pending: t('leave.statusPending'),
      approved: t('leave.statusApproved'),
      rejected: t('leave.statusRejected'),
      cancelled: t('leave.statusCancelled'),
    };
    return m[s] ?? s;
  }

  function leaveTypeLabel(lt: string) {
    return LEAVE_TYPES.find((x) => x.value === lt)?.label ?? lt;
  }

  const [rows, setRows] = useState<LeaveRequest[]>([]);
  const [tab, setTab] = useState<'all' | 'pending' | 'approved' | 'schedule' | 'history'>('all');
  const [openAdd, setOpenAdd] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const [leaveType, setLeaveType] = useState('sick');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  // Schedule & History state
  const [historyRows, setHistoryRows] = useState<HistoryRecord[]>([]);
  const [scheduleMonth, setScheduleMonth] = useState(new Date().toISOString().slice(0, 7));
  const [filterSeller, setFilterSeller] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterLeaveType, setFilterLeaveType] = useState('');
  const [sellers, setSellers] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [summaryStats, setSummaryStats] = useState({
    totalOffDays: 0,
    sickDaysUsed: 0,
    warningsCount: 0,
  });

  const loadLeaves = useCallback(() => {
    if (tab === 'schedule' || tab === 'history') return;
    const status = tab === 'all' ? undefined : tab;
    api.get('/leave', { params: { status } }).then((r) => setRows(r.data)).catch(() => {});
  }, [tab]);

  const loadSellers = useCallback(() => {
    api.get('/employees', { params: { pageSize: 1000 } })
      .then((r) => setSellers(r.data?.rows || []))
      .catch(() => {});
  }, []);

  const loadHistory = useCallback(() => {
    const params: Record<string, string | undefined> = {};
    if (filterSeller) params.employeeId = filterSeller;
    if (filterDateFrom) params.dateFrom = filterDateFrom;
    if (filterDateTo) params.dateTo = filterDateTo;
    if (filterLeaveType) params.leaveType = filterLeaveType;

    api.get('/leave/history', { params })
      .then((r) => {
        setHistoryRows(r.data?.rows || []);
        setSummaryStats({
          totalOffDays: r.data?.summary?.totalOffDays || 0,
          sickDaysUsed: r.data?.summary?.sickDaysUsed || 0,
          warningsCount: r.data?.summary?.warningsCount || 0,
        });
      })
      .catch(() => {});
  }, [filterSeller, filterDateFrom, filterDateTo, filterLeaveType]);

  const loadSchedule = useCallback(() => {
    loadSellers();
  }, [loadSellers]);

  useEffect(() => {
    if (tab === 'history') {
      loadHistory();
    } else if (tab === 'schedule') {
      loadSchedule();
    } else {
      loadLeaves();
    }
  }, [tab, loadLeaves, loadHistory, loadSchedule]);

  const calcDays = () => {
    if (!startDate || !endDate) return 0;
    const d = Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1;
    return Math.max(1, d);
  };

  const handleSubmit = async () => {
    if (!startDate || !endDate) { setErr(t('leave.dateRequired')); return; }
    setSaving(true); setErr('');
    try {
      await api.post('/leave', { leaveType, startDate, endDate, days: calcDays(), reason });
      setOpenAdd(false);
      setLeaveType('sick'); setStartDate(''); setEndDate(''); setReason('');
      loadLeaves();
    } catch (e) { setErr(errMsg(e)); }
    finally { setSaving(false); }
  };

  const handleApprove = async (id: string) => {
    await api.patch(`/leave/${id}/approve`).catch(() => {});
    loadLeaves();
  };

  const handleReject = async () => {
    if (!rejectId) return;
    await api.patch(`/leave/${rejectId}/reject`, { reason: rejectReason }).catch(() => {});
    setRejectId(null); setRejectReason(''); loadLeaves();
  };

  const handleCancel = async (id: string) => {
    await api.patch(`/leave/${id}/cancel`).catch(() => {});
    loadLeaves();
  };

  const filtered = tab === 'all' ? rows : rows.filter((r) => r.status === tab);

  // Helper: Get seller off days in a month
  const getSellerOffDays = (sellerId: string, dateStr: string) => {
    const [year, month] = dateStr.split('-').map(Number);
    const offDays: number[] = [];
    rows
      .filter((r) => r.employee.id === sellerId && r.status === 'approved')
      .forEach((r) => {
        const start = new Date(r.startDate);
        const end = new Date(r.endDate);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          if (d.getFullYear() === year && d.getMonth() === month - 1) {
            offDays.push(d.getDate());
          }
        }
      });
    return offDays;
  };

  // Render schedule tab
  const renderScheduleTab = () => (
    <Box>
      <Stack direction="row" spacing={2} mb={2} alignItems="center">
        <TextField
          size="small"
          type="month"
          value={scheduleMonth}
          onChange={(e) => setScheduleMonth(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
      </Stack>

      <Grid container spacing={2}>
        {sellers.map((seller) => {
          const offDays = getSellerOffDays(seller.id, scheduleMonth);
          const isWorking = offDays.length === 0;
          return (
            <Grid item xs={12} sm={6} md={4} key={seller.id}>
              <Card>
                <CardContent>
                  <Stack spacing={1}>
                    <Box>
                      <Typography variant="subtitle2" fontWeight={700}>
                        {seller.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {seller.code}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {isWorking ? (
                        <>
                          <EventAvailableIcon sx={{ fontSize: 20, color: '#4caf50' }} />
                          <Typography variant="caption" color="#4caf50">
                            Working
                          </Typography>
                        </>
                      ) : (
                        <>
                          <EventBusyIcon sx={{ fontSize: 20, color: '#f44336' }} />
                          <Typography variant="caption" color="#f44336">
                            Off: {offDays.join(', ')}
                          </Typography>
                        </>
                      )}
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {sellers.length === 0 && (
        <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
          {t('leave.noData')}
        </Typography>
      )}
    </Box>
  );

  // Render history tab
  const renderHistoryTab = () => (
    <Box>
      <Stack spacing={2} mb={2}>
        {/* Filters */}
        <Paper sx={{ p: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Employee</InputLabel>
              <Select
                value={filterSeller}
                label="Employee"
                onChange={(e) => setFilterSeller(e.target.value)}
              >
                <MenuItem value="">All Employees</MenuItem>
                {sellers.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              size="small"
              type="date"
              label="From Date"
              InputLabelProps={{ shrink: true }}
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
            />
            <TextField
              size="small"
              type="date"
              label="To Date"
              InputLabelProps={{ shrink: true }}
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
            />
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Leave Type</InputLabel>
              <Select
                value={filterLeaveType}
                label="Leave Type"
                onChange={(e) => setFilterLeaveType(e.target.value)}
              >
                <MenuItem value="">All Types</MenuItem>
                {LEAVE_TYPES.map((x) => (
                  <MenuItem key={x.value} value={x.value}>
                    {x.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button variant="outlined" onClick={() => loadHistory()} sx={{ alignSelf: 'center' }}>
              Filter
            </Button>
          </Stack>
        </Paper>

        {/* Summary Stats */}
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <Card sx={{ bgcolor: '#e3f2fd' }}>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Total Off Days
                </Typography>
                <Typography variant="h6" fontWeight={700}>
                  {summaryStats.totalOffDays}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card sx={{ bgcolor: '#fff3e0' }}>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Sick Days Used
                </Typography>
                <Typography variant="h6" fontWeight={700}>
                  {summaryStats.sickDaysUsed}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card sx={{ bgcolor: '#ffebee' }}>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Warnings
                </Typography>
                <Typography variant="h6" fontWeight={700}>
                  {summaryStats.warningsCount}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Stack>

      {/* History Table */}
      <Stack direction="row" spacing={1} mb={2} justifyContent="flex-end">
        <ExportPdfButton tableId="history-table" filename="leave-history" title="Leave History" size="small" variant="outlined" />
      </Stack>
      <Paper variant="outlined">
        <Table size="small" id="history-table">
          <TableHead>
            <TableRow>
              <TableCell>Employee</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Date</TableCell>
              <TableCell align="center">Count</TableCell>
              <TableCell align="center">Late Arrivals</TableCell>
              <TableCell align="center">Warnings</TableCell>
              <TableCell>Reason</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {historyRows.map((r) => (
              <TableRow key={r.id} hover>
                <TableCell>
                  <Typography variant="body2">{r.employee.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {r.employee.code}
                  </Typography>
                </TableCell>
                <TableCell>{leaveTypeLabel(r.leaveType)}</TableCell>
                <TableCell>{r.date?.slice(0, 10)}</TableCell>
                <TableCell align="center">{r.count}</TableCell>
                <TableCell align="center">{r.lateArrivalCount || 0}</TableCell>
                <TableCell align="center">
                  {r.warningCount || 0 > 0 && (
                    <Chip
                      size="small"
                      color="error"
                      label={`${r.warningCount}`}
                      variant="outlined"
                    />
                  )}
                  {r.warningCount === 0 && '—'}
                </TableCell>
                <TableCell>
                  <Typography variant="caption">{r.reason || '—'}</Typography>
                </TableCell>
              </TableRow>
            ))}
            {historyRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    {t('leave.noData')}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={700}>
          {t('leave.title')}
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setOpenAdd(true); setErr(''); }}>
          {t('leave.submit')}
        </Button>
      </Stack>

      <Tabs value={tab} onChange={(_, v) => setTab(v as any)} sx={{ mb: 2 }}>
        <Tab value="all" label={t('leave.tabAll')} />
        <Tab value="pending" label={t('leave.tabPending')} />
        <Tab value="approved" label={t('leave.tabApproved')} />
        {isManager && <Tab value="schedule" label="Schedule" />}
        {isManager && <Tab value="history" label="History" />}
      </Tabs>

      {tab === 'schedule' ? (
        renderScheduleTab()
      ) : tab === 'history' ? (
        renderHistoryTab()
      ) : (
        <>
          <Stack direction="row" spacing={1} mb={2} justifyContent="flex-end">
            <ExportPdfButton tableId="leave-table" filename="leave-requests" title="Leave" size="small" variant="outlined" />
          </Stack>
          <Paper variant="outlined">
            <Table size="small" id="leave-table">
              <TableHead>
                <TableRow>
                  {isManager && <TableCell>{t('leave.colEmployee')}</TableCell>}
                  <TableCell>{t('leave.colType')}</TableCell>
                  <TableCell>{t('leave.colStart')}</TableCell>
                  <TableCell>{t('leave.colEnd')}</TableCell>
                  <TableCell align="center">{t('leave.colDays')}</TableCell>
                  <TableCell>{t('leave.colReason')}</TableCell>
                  <TableCell>{t('leave.colStatus')}</TableCell>
                  <TableCell align="right">{t('leave.colAction')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id} hover>
                    {isManager && (
                      <TableCell>
                        <Typography variant="body2">{r.employee.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{r.employee.code}</Typography>
                      </TableCell>
                    )}
                    <TableCell>{leaveTypeLabel(r.leaveType)}</TableCell>
                    <TableCell>{r.startDate?.slice(0, 10)}</TableCell>
                    <TableCell>{r.endDate?.slice(0, 10)}</TableCell>
                    <TableCell align="center">{r.days}</TableCell>
                    <TableCell>
                      <Typography variant="caption">{r.reason || '—'}</Typography>
                      {r.rejectedReason && (
                        <Typography variant="caption" color="error" display="block">
                          {t('leave.rejectedPrefix')}{r.rejectedReason}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip size="small" color={statusColor(r.status)} label={statusLabel(r.status)} />
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        {isManager && r.status === 'pending' && (
                          <>
                            <Button size="small" color="success" startIcon={<CheckCircleIcon />}
                              onClick={() => handleApprove(r.id)}>
                              {t('leave.approve')}
                            </Button>
                            <Button size="small" color="error" startIcon={<CancelIcon />}
                              onClick={() => { setRejectId(r.id); setRejectReason(''); }}>
                              {t('leave.reject')}
                            </Button>
                          </>
                        )}
                        {!isManager && r.status === 'pending' && (
                          <Button size="small" color="error" onClick={() => handleCancel(r.id)}>
                            {t('leave.cancel')}
                          </Button>
                        )}
                        {r.approvedBy && (
                          <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
                            {t('leave.approvedBy')} {r.approvedBy.name}
                          </Typography>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={isManager ? 8 : 7} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                        {t('leave.noData')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>
        </>
      )}

      {/* Add Leave Dialog */}
      <Dialog open={openAdd} onClose={() => setOpenAdd(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('leave.submit')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            {err && <Alert severity="error">{err}</Alert>}
            <FormControl fullWidth size="small">
              <InputLabel>{t('leave.colType')}</InputLabel>
              <Select value={leaveType} label={t('leave.colType')} onChange={(e) => setLeaveType(e.target.value)}>
                {LEAVE_TYPES.map((x) => (
                  <MenuItem key={x.value} value={x.value}>{x.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Stack direction="row" spacing={2}>
              <TextField fullWidth size="small" type="date" label={t('leave.colStart')} InputLabelProps={{ shrink: true }}
                value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              <TextField fullWidth size="small" type="date" label={t('leave.colEnd')} InputLabelProps={{ shrink: true }}
                value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </Stack>
            {startDate && endDate && (
              <Typography variant="body2" color="text.secondary">
                {t('leave.totalDays')} {calcDays()} {t('leave.days')}
              </Typography>
            )}
            <TextField fullWidth size="small" multiline rows={2} label={t('leave.reasonOpt')}
              value={reason} onChange={(e) => setReason(e.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAdd(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={saving}>
            {saving ? t('leave.submitting') : t('leave.submit')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!rejectId} onClose={() => setRejectId(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('leave.rejectTitle')}</DialogTitle>
        <DialogContent>
          <TextField fullWidth size="small" multiline rows={2} label={t('leave.reasonOpt')} sx={{ mt: 1 }}
            value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectId(null)}>{t('common.cancel')}</Button>
          <Button color="error" variant="contained" onClick={handleReject}>{t('leave.reject')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
