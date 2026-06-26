import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Grid, Card, CardContent, Chip, Tabs, Tab, Table,
  TableHead, TableRow, TableCell, TableBody, Button, CircularProgress, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Tooltip, IconButton,
} from '@mui/material';
import { CheckCircle, Cancel, Visibility, Refresh } from '@mui/icons-material';
import { api, errMsg } from '../api/client';

const MODULE_LABELS: Record<string, string> = {
  leave: 'ใบลา', pr: 'PR', document: 'เอกสาร', expense: 'ค่าใช้จ่าย', agency: 'Agency',
};
const MODULE_COLOR: Record<string, 'primary'|'secondary'|'success'|'warning'|'error'> = {
  leave: 'secondary', pr: 'primary', document: 'success', expense: 'warning', agency: 'error',
};

interface QueueItem {
  id: string; _module: string; _label: string; status: string; createdAt: string;
  employee?: { name: string; code: string };
  createdBy?: { name: string };
}

interface Stats { leave: number; pr: number; document: number; expense: number; agency: number; total: number }

export default function ApprovalCenterPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionItem, setActionItem] = useState<QueueItem | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');

  const modules = ['', 'leave', 'pr', 'document', 'expense', 'agency'];
  const selectedModule = modules[tab];

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [qRes, sRes] = await Promise.all([
        api.get<{ items: QueueItem[]; total: number }>(`/approvals/queue${selectedModule ? `?module=${selectedModule}` : ''}`),
        api.get<Stats>('/approvals/stats'),
      ]);
      setItems(qRes.data.items);
      setStats(sRes.data);
    } catch (e) { setError(errMsg(e)); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [tab]);

  const viewItem = (item: QueueItem) => {
    if (item._module === 'pr') navigate(`/pr/${item.id}`);
    else if (item._module === 'document') navigate(`/docs/${item.id}`);
    else if (item._module === 'leave') navigate('/leave');
    else if (item._module === 'agency') navigate(`/agencies/${item.id}/form`);
  };

  const openAction = (item: QueueItem, type: 'approve' | 'reject') => {
    setActionItem(item);
    setActionType(type);
    setNote('');
  };

  const doAction = async () => {
    if (!actionItem) return;
    setSaving(true);
    try {
      await api.patch(`/approvals/${actionItem._module}/${actionItem.id}/action`, { action: actionType, note });
      setSuccess(`${actionType === 'approve' ? 'อนุมัติ' : 'ปฏิเสธ'}สำเร็จ`);
      setActionItem(null);
      load();
    } catch (e) { setError(errMsg(e)); }
    setSaving(false);
    setTimeout(() => setSuccess(''), 3000);
  };

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Approval Center</Typography>
          <Typography variant="body2" color="text.secondary">รายการรออนุมัติทั้งหมด</Typography>
        </Box>
        <IconButton onClick={load}><Refresh /></IconButton>
      </Box>

      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Stats */}
      {stats && (
        <Grid container spacing={2} mb={2}>
          {([
            ['ทั้งหมด', stats.total, '#4F46E5'],
            ['ใบลา', stats.leave, '#7C3AED'],
            ['PR', stats.pr, '#2563EB'],
            ['เอกสาร', stats.document, '#16A34A'],
            ['ค่าใช้จ่าย', stats.expense, '#D97706'],
            ['Agency', stats.agency, '#DC2626'],
          ] as [string, number, string][]).map(([label, val, color]) => (
            <Grid item xs={6} sm={2} key={label}>
              <Card variant="outlined" sx={{ borderTop: `3px solid ${color}`, textAlign: 'center' }}>
                <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="h5" fontWeight={700} sx={{ color }}>{val}</Typography>
                  <Typography variant="caption" color="text.secondary">{label}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Tabs */}
      <Paper>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: '1px solid #E2E8F0', px: 2 }}>
          {['ทั้งหมด','ใบลา','PR','เอกสาร','ค่าใช้จ่าย','Agency'].map((t, i) => (
            <Tab key={i} label={t} />
          ))}
        </Tabs>

        {loading ? (
          <Box p={6} textAlign="center"><CircularProgress /></Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                {['โมดูล','รายการ','พนักงาน/สร้างโดย','วันที่','จัดการ'].map(h => (
                  <TableCell key={h} sx={{ fontWeight: 700 }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 8, color: 'text.secondary' }}>
                    <CheckCircle sx={{ fontSize: 48, color: '#16A34A', mb: 1, display: 'block', mx: 'auto' }} />
                    ไม่มีรายการรออนุมัติ
                  </TableCell>
                </TableRow>
              ) : items.map(item => (
                <TableRow key={`${item._module}-${item.id}`} hover>
                  <TableCell>
                    <Chip label={MODULE_LABELS[item._module]} size="small" color={MODULE_COLOR[item._module]} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{item._label}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{item.employee?.name ?? item.createdBy?.name ?? '—'}</Typography>
                    {item.employee && <Typography variant="caption" color="text.secondary">{item.employee.code}</Typography>}
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">{new Date(item.createdAt).toLocaleDateString('th-TH')}</Typography>
                  </TableCell>
                  <TableCell>
                    <Box display="flex" gap={0.5}>
                      <Tooltip title="ดูรายละเอียด">
                        <IconButton size="small" onClick={() => viewItem(item)}><Visibility fontSize="small" /></IconButton>
                      </Tooltip>
                      <Tooltip title="อนุมัติ">
                        <IconButton size="small" color="success" onClick={() => openAction(item, 'approve')}><CheckCircle fontSize="small" /></IconButton>
                      </Tooltip>
                      <Tooltip title="ปฏิเสธ">
                        <IconButton size="small" color="error" onClick={() => openAction(item, 'reject')}><Cancel fontSize="small" /></IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      {/* Action Dialog */}
      <Dialog open={!!actionItem} onClose={() => setActionItem(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{actionType === 'approve' ? 'ยืนยันการอนุมัติ' : 'ยืนยันการปฏิเสธ'}</DialogTitle>
        <DialogContent>
          {actionItem && (
            <Box mb={2}>
              <Typography variant="body2" gutterBottom><strong>รายการ:</strong> {actionItem._label}</Typography>
              <Typography variant="body2"><strong>โมดูล:</strong> {MODULE_LABELS[actionItem._module]}</Typography>
            </Box>
          )}
          <TextField
            label={actionType === 'reject' ? 'เหตุผลที่ปฏิเสธ (จำเป็น)' : 'หมายเหตุ (ถ้ามี)'}
            multiline rows={3} fullWidth value={note} onChange={e => setNote(e.target.value)}
            required={actionType === 'reject'}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActionItem(null)}>ยกเลิก</Button>
          <Button
            variant="contained"
            color={actionType === 'approve' ? 'success' : 'error'}
            onClick={doAction}
            disabled={saving || (actionType === 'reject' && !note.trim())}
          >
            {saving ? '...' : actionType === 'approve' ? 'อนุมัติ' : 'ปฏิเสธ'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
