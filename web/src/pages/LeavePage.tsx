import { useCallback, useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Stack, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Select, FormControl, InputLabel, Alert,
  Tabs, Tab,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import { api, errMsg } from '../api/client';
import { useAuth } from '../auth/AuthContext';

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

const LEAVE_TYPES = [
  { value: 'sick', label: 'ลาป่วย' },
  { value: 'annual', label: 'ลาพักร้อน' },
  { value: 'personal', label: 'ลากิจ' },
  { value: 'other', label: 'อื่นๆ' },
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
    pending: 'รอการอนุมัติ', approved: 'อนุมัติแล้ว',
    rejected: 'ปฏิเสธ', cancelled: 'ยกเลิก',
  };
  return m[s] ?? s;
}

function leaveTypeLabel(t: string) {
  return LEAVE_TYPES.find((x) => x.value === t)?.label ?? t;
}

export default function LeavePage() {
  const { user } = useAuth();
  const isManager = ['admin', 'super_admin', 'closer'].includes(user?.activeRole ?? '');

  const [rows, setRows] = useState<LeaveRequest[]>([]);
  const [tab, setTab] = useState<'all' | 'pending' | 'approved'>('all');
  const [openAdd, setOpenAdd] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  // new leave form
  const [leaveType, setLeaveType] = useState('sick');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  const load = useCallback(() => {
    const status = tab === 'all' ? undefined : tab;
    api.get('/leave', { params: { status } }).then((r) => setRows(r.data)).catch(() => {});
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const calcDays = () => {
    if (!startDate || !endDate) return 0;
    const d = Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1;
    return Math.max(1, d);
  };

  const handleSubmit = async () => {
    if (!startDate || !endDate) { setErr('กรุณาระบุวันที่'); return; }
    setSaving(true); setErr('');
    try {
      await api.post('/leave', { leaveType, startDate, endDate, days: calcDays(), reason });
      setOpenAdd(false);
      setLeaveType('sick'); setStartDate(''); setEndDate(''); setReason('');
      load();
    } catch (e) { setErr(errMsg(e)); }
    finally { setSaving(false); }
  };

  const handleApprove = async (id: string) => {
    await api.patch(`/leave/${id}/approve`).catch(() => {});
    load();
  };

  const handleReject = async () => {
    if (!rejectId) return;
    await api.patch(`/leave/${rejectId}/reject`, { reason: rejectReason }).catch(() => {});
    setRejectId(null); setRejectReason(''); load();
  };

  const handleCancel = async (id: string) => {
    await api.patch(`/leave/${id}/cancel`).catch(() => {});
    load();
  };

  const filtered = tab === 'all' ? rows : rows.filter((r) => r.status === tab);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={700}>
          ใบลาพนักงาน
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setOpenAdd(true); setErr(''); }}>
          ยื่นใบลา
        </Button>
      </Stack>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="all" label="ทั้งหมด" />
        <Tab value="pending" label="รอการอนุมัติ" />
        <Tab value="approved" label="อนุมัติแล้ว" />
      </Tabs>

      <Paper variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              {isManager && <TableCell>พนักงาน</TableCell>}
              <TableCell>ประเภทการลา</TableCell>
              <TableCell>วันที่เริ่ม</TableCell>
              <TableCell>วันที่สิ้นสุด</TableCell>
              <TableCell align="center">จำนวนวัน</TableCell>
              <TableCell>เหตุผล</TableCell>
              <TableCell>สถานะ</TableCell>
              <TableCell align="right">การดำเนินการ</TableCell>
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
                      เหตุผลปฏิเสธ: {r.rejectedReason}
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
                          อนุมัติ
                        </Button>
                        <Button size="small" color="error" startIcon={<CancelIcon />}
                          onClick={() => { setRejectId(r.id); setRejectReason(''); }}>
                          ปฏิเสธ
                        </Button>
                      </>
                    )}
                    {!isManager && r.status === 'pending' && (
                      <Button size="small" color="error" onClick={() => handleCancel(r.id)}>
                        ยกเลิก
                      </Button>
                    )}
                    {r.approvedBy && (
                      <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
                        โดย {r.approvedBy.name}
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
                    ไม่มีรายการ
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      {/* Add Leave Dialog */}
      <Dialog open={openAdd} onClose={() => setOpenAdd(false)} maxWidth="sm" fullWidth>
        <DialogTitle>ยื่นใบลา</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            {err && <Alert severity="error">{err}</Alert>}
            <FormControl fullWidth size="small">
              <InputLabel>ประเภทการลา</InputLabel>
              <Select value={leaveType} label="ประเภทการลา" onChange={(e) => setLeaveType(e.target.value)}>
                {LEAVE_TYPES.map((x) => (
                  <MenuItem key={x.value} value={x.value}>{x.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Stack direction="row" spacing={2}>
              <TextField fullWidth size="small" type="date" label="วันที่เริ่ม" InputLabelProps={{ shrink: true }}
                value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              <TextField fullWidth size="small" type="date" label="วันที่สิ้นสุด" InputLabelProps={{ shrink: true }}
                value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </Stack>
            {startDate && endDate && (
              <Typography variant="body2" color="text.secondary">
                รวม {calcDays()} วัน
              </Typography>
            )}
            <TextField fullWidth size="small" multiline rows={2} label="เหตุผล (ถ้ามี)"
              value={reason} onChange={(e) => setReason(e.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAdd(false)}>ยกเลิก</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={saving}>
            {saving ? 'กำลังส่ง...' : 'ยื่นใบลา'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!rejectId} onClose={() => setRejectId(null)} maxWidth="xs" fullWidth>
        <DialogTitle>ปฏิเสธใบลา</DialogTitle>
        <DialogContent>
          <TextField fullWidth size="small" multiline rows={2} label="เหตุผล (ถ้ามี)" sx={{ mt: 1 }}
            value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectId(null)}>ยกเลิก</Button>
          <Button color="error" variant="contained" onClick={handleReject}>ปฏิเสธ</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
