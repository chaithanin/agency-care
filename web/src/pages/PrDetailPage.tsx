import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Typography, Paper, Button, Chip, Grid, Divider, TextField,
  IconButton, Select, MenuItem, FormControl, InputLabel, CircularProgress,
  Alert, Checkbox, FormControlLabel, Dialog, DialogTitle, DialogContent,
  DialogActions, List, ListItem, ListItemText, Avatar,
} from '@mui/material';
import {
  ArrowBack, Edit, CheckCircle, FiberManualRecord, AttachFile,
  Send, PlayArrow,
} from '@mui/icons-material';
import { useT } from '../i18n';
import { api, errMsg } from '../api/client';
import { useAuth } from '../auth/AuthContext';

type PrStatus = 'draft' | 'submitted' | 'waiting_approval' | 'approved' | 'purchasing' | 'ordered' | 'received' | 'completed' | 'cancelled';

interface PrDetail {
  id: string;
  prNumber: string;
  title: string;
  department: string;
  prType: string;
  priority: string;
  status: PrStatus;
  description?: string;
  note?: string;
  budgetTotal?: number;
  dueDate?: string;
  createdAt: string;
  approvedAt?: string;
  closedAt?: string;
  cancelReason?: string;
  createdBy: { id: string; name: string };
  responsible?: { id: string; name: string; code: string };
  approver?: { id: string; name: string };
  items: { id: string; name: string; detail?: string; qty: number; unit?: string; budget?: number; neededBy?: string }[];
  comments: { id: string; message: string; createdAt: string; user: { id: string; name: string } }[];
  activities: { id: string; action: string; oldValue?: string; newValue?: string; note?: string; createdAt: string; user: { id: string; name: string } }[];
  checklists: { id: string; label: string; isDone: boolean; doneAt?: string }[];
  attachments: { id: string; fileName: string; fileUrl: string; mimeType?: string; createdAt: string }[];
}

const STATUS_FLOW: PrStatus[] = ['draft', 'submitted', 'waiting_approval', 'approved', 'purchasing', 'ordered', 'received', 'completed'];

const STATUS_COLORS: Record<string, string> = {
  draft: '#94A3B8', submitted: '#60A5FA', waiting_approval: '#FBBF24',
  approved: '#34D399', purchasing: '#818CF8', ordered: '#F472B6',
  received: '#2DD4BF', completed: '#22C55E', cancelled: '#EF4444',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'ร่าง', submitted: 'ส่งแล้ว', waiting_approval: 'รออนุมัติ',
  approved: 'อนุมัติแล้ว', purchasing: 'กำลังซื้อ', ordered: 'สั่งซื้อแล้ว',
  received: 'รับสินค้าแล้ว', completed: 'เสร็จสิ้น', cancelled: 'ยกเลิก',
};

const ACTIVITY_LABELS: Record<string, string> = {
  created: '📝 สร้าง PR', status_change: '🔄 เปลี่ยนสถานะ', edit: '✏️ แก้ไข',
  comment: '💬 ความคิดเห็น', attachment: '📎 แนบไฟล์', assign: '👤 มอบหมาย',
};

const NEXT_STATUSES: Record<PrStatus, PrStatus[]> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['waiting_approval', 'cancelled'],
  waiting_approval: ['approved', 'cancelled'],
  approved: ['purchasing', 'cancelled'],
  purchasing: ['ordered', 'cancelled'],
  ordered: ['received', 'cancelled'],
  received: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

function fmtBaht(n?: number | null) {
  if (!n) return '—';
  return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0 }).format(n);
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'เมื่อกี้';
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ชม.ที่แล้ว`;
  return new Date(d).toLocaleDateString('th-TH');
}

export default function PrDetailPage() {
  const { t } = useT();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isManager = ['manager', 'super_admin', 'admin', 'closer'].includes(user?.activeRole ?? user?.role ?? '');

  const [pr, setPr] = useState<PrDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [comment, setComment] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [statusDialog, setStatusDialog] = useState(false);
  const [newStatus, setNewStatus] = useState<PrStatus>('submitted');
  const [cancelNote, setCancelNote] = useState('');
  const [changingStatus, setChangingStatus] = useState(false);

  useEffect(() => { if (id) fetchPr(id); }, [id]);

  const fetchPr = async (prId: string) => {
    setLoading(true);
    try {
      const res = await api.get<PrDetail>(`/pr/${prId}`);
      setPr(res.data);
    } catch (e) { setError(errMsg(e)); }
    finally { setLoading(false); }
  };

  const sendComment = async () => {
    if (!comment.trim() || !id) return;
    setSendingComment(true);
    try {
      await api.post(`/pr/${id}/comments`, { message: comment.trim() });
      setComment('');
      fetchPr(id);
    } catch { /* ignore */ }
    finally { setSendingComment(false); }
  };

  const toggleChecklist = async (checklistId: string, isDone: boolean) => {
    if (!id) return;
    await api.patch(`/pr/${id}/checklists/${checklistId}`, { isDone });
    setPr((p) => p ? { ...p, checklists: p.checklists.map((c) => c.id === checklistId ? { ...c, isDone } : c) } : p);
  };

  const changeStatus = async () => {
    if (!id) return;
    setChangingStatus(true);
    try {
      await api.patch(`/pr/${id}/status`, { status: newStatus, note: newStatus === 'cancelled' ? cancelNote : undefined });
      setStatusDialog(false);
      fetchPr(id);
    } catch (e) { setError(errMsg(e)); }
    finally { setChangingStatus(false); }
  };

  if (loading) return <Box p={6} textAlign="center"><CircularProgress /></Box>;
  if (!pr) return <Box p={3}><Alert severity="error">{error || 'ไม่พบ PR'}</Alert></Box>;

  const age = Math.floor((Date.now() - new Date(pr.createdAt).getTime()) / 86400000);
  const isOverdue = pr.dueDate && new Date(pr.dueDate) < new Date() && !['completed', 'cancelled'].includes(pr.status);
  const nextStatuses = NEXT_STATUSES[pr.status] ?? [];
  const canEdit = isManager || (pr.createdBy.id === user?.id && ['draft', 'submitted'].includes(pr.status));
  const completedChecklists = pr.checklists.filter((c) => c.isDone).length;

  return (
    <Box p={3}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={3}>
        <Box display="flex" alignItems="center" gap={1}>
          <IconButton onClick={() => navigate('/pr')}><ArrowBack /></IconButton>
          <Box>
            <Typography variant="h5" fontWeight={700}>{pr.prNumber}</Typography>
            <Typography variant="body2" color="text.secondary">{pr.title}</Typography>
          </Box>
        </Box>
        <Box display="flex" gap={1} flexWrap="wrap" justifyContent="flex-end">
          <Chip label={STATUS_LABELS[pr.status]} sx={{ bgcolor: STATUS_COLORS[pr.status] ?? '#E2E8F0', color: '#fff', fontWeight: 700 }} />
          {canEdit && <Button variant="outlined" size="small" startIcon={<Edit />} onClick={() => navigate(`/pr/${pr.id}/edit`)}>แก้ไข</Button>}
          {nextStatuses.length > 0 && (
            <Button variant="contained" size="small" startIcon={<PlayArrow />} onClick={() => { setNewStatus(nextStatuses[0]); setStatusDialog(true); }}>
              เปลี่ยนสถานะ
            </Button>
          )}
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={3}>
        {/* Left: Main info */}
        <Grid item xs={12} md={8}>
          {/* Info Summary */}
          <Paper sx={{ p: 2, mb: 2 }}>
            <Grid container spacing={2}>
              {[
                { label: t('prt.department'), value: pr.department },
                { label: t('prt.type'), value: pr.prType },
                { label: t('prt.priority'), value: <Chip label={{ low: 'ต่ำ', medium: 'ปานกลาง', high: 'สูง', urgent: 'เร่งด่วน' }[pr.priority] ?? pr.priority} size="small" color={pr.priority === 'urgent' ? 'error' : pr.priority === 'high' ? 'warning' : 'default'} /> },
                { label: t('prt.responsible'), value: pr.responsible?.name ?? '—' },
                { label: t('prt.approver'), value: pr.approver?.name ?? '—' },
                { label: t('prt.budget'), value: fmtBaht(pr.budgetTotal) },
                { label: t('prt.dueDate'), value: pr.dueDate ? <Typography color={isOverdue ? 'error' : 'inherit'} component="span" fontWeight={isOverdue ? 700 : 400}>{new Date(pr.dueDate).toLocaleDateString('th-TH')}{isOverdue ? ' ⚠️' : ''}</Typography> : '—' },
                { label: `${t('prt.age')}`, value: <Chip label={`${age} วัน`} size="small" color={age > 14 ? 'error' : age > 7 ? 'warning' : 'default'} /> },
              ].map((row) => (
                <Grid item xs={6} sm={3} key={row.label}>
                  <Typography variant="caption" color="text.secondary">{row.label}</Typography>
                  <Box mt={0.5}><Typography variant="body2" fontWeight={500}>{row.value}</Typography></Box>
                </Grid>
              ))}
            </Grid>
            {pr.description && <><Divider sx={{ my: 2 }} /><Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{pr.description}</Typography></>}
          </Paper>

          {/* Timeline (status flow) */}
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} mb={2}>{t('prt.timeline')}</Typography>
            <Box display="flex" alignItems="center" flexWrap="wrap" gap={0}>
              {STATUS_FLOW.map((s, i) => {
                const idx = STATUS_FLOW.indexOf(pr.status);
                const done = i < idx || pr.status === s;
                const current = pr.status === s;
                return (
                  <Box key={s} display="flex" alignItems="center">
                    <Box textAlign="center" sx={{ minWidth: 70 }}>
                      <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: done ? STATUS_COLORS[s] : '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', border: current ? `2px solid ${STATUS_COLORS[s]}` : 'none', boxShadow: current ? `0 0 0 3px ${STATUS_COLORS[s]}33` : 'none' }}>
                        {done ? <CheckCircle sx={{ fontSize: 16, color: '#fff' }} /> : <FiberManualRecord sx={{ fontSize: 10, color: '#94A3B8' }} />}
                      </Box>
                      <Typography variant="caption" sx={{ fontSize: 10, color: done ? STATUS_COLORS[s] : '#94A3B8', fontWeight: current ? 700 : 400 }}>
                        {STATUS_LABELS[s]}
                      </Typography>
                    </Box>
                    {i < STATUS_FLOW.length - 1 && <Box sx={{ flex: 1, height: 2, bgcolor: i < idx ? '#22C55E' : '#E2E8F0', minWidth: 16 }} />}
                  </Box>
                );
              })}
              {pr.status === 'cancelled' && (
                <Chip label="ยกเลิก" sx={{ bgcolor: '#EF4444', color: '#fff', ml: 1 }} size="small" />
              )}
            </Box>
          </Paper>

          {/* Line Items */}
          {pr.items.length > 0 && (
            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle2" fontWeight={700} mb={1}>{t('prt.items')} ({pr.items.length})</Typography>
              <Box sx={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      {['ชื่อรายการ', 'รายละเอียด', 'จำนวน', 'หน่วย', 'งบ/ชิ้น', 'รวม', 'วันที่ต้องการ'].map((h) => (
                        <th key={h} style={{ textAlign: 'left', padding: '6px 10px', borderBottom: '1px solid #E2E8F0', fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pr.items.map((item) => (
                      <tr key={item.id}>
                        <td style={{ padding: '6px 10px', borderBottom: '1px solid #F1F5F9' }}>{item.name}</td>
                        <td style={{ padding: '6px 10px', borderBottom: '1px solid #F1F5F9', color: '#6B7280', maxWidth: 140 }}>{item.detail ?? '—'}</td>
                        <td style={{ padding: '6px 10px', borderBottom: '1px solid #F1F5F9' }}>{Number(item.qty)}</td>
                        <td style={{ padding: '6px 10px', borderBottom: '1px solid #F1F5F9' }}>{item.unit ?? '—'}</td>
                        <td style={{ padding: '6px 10px', borderBottom: '1px solid #F1F5F9' }}>{fmtBaht(item.budget)}</td>
                        <td style={{ padding: '6px 10px', borderBottom: '1px solid #F1F5F9', fontWeight: 600 }}>{item.budget ? fmtBaht(item.budget * Number(item.qty)) : '—'}</td>
                        <td style={{ padding: '6px 10px', borderBottom: '1px solid #F1F5F9', color: '#6B7280' }}>{item.neededBy ? new Date(item.neededBy).toLocaleDateString('th-TH') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Box>
            </Paper>
          )}

          {/* Comments */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} mb={2}>{t('prt.comments')} ({pr.comments.length})</Typography>
            <List dense sx={{ maxHeight: 300, overflow: 'auto', mb: 2 }}>
              {pr.comments.length === 0 && <Typography variant="body2" color="text.secondary" px={1}>ยังไม่มีความคิดเห็น</Typography>}
              {pr.comments.map((c) => (
                <ListItem key={c.id} alignItems="flex-start" sx={{ px: 0 }}>
                  <Avatar sx={{ width: 28, height: 28, mr: 1, fontSize: 12, bgcolor: '#4F46E5' }}>{c.user.name[0]}</Avatar>
                  <ListItemText
                    primary={<Box display="flex" gap={1} alignItems="center"><Typography variant="body2" fontWeight={600}>{c.user.name}</Typography><Typography variant="caption" color="text.secondary">{timeAgo(c.createdAt)}</Typography></Box>}
                    secondary={<Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.5 }}>{c.message}</Typography>}
                  />
                </ListItem>
              ))}
            </List>
            <Box display="flex" gap={1}>
              <TextField
                size="small" fullWidth multiline maxRows={3} placeholder="เพิ่มความคิดเห็น…"
                value={comment} onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendComment(); } }}
              />
              <IconButton color="primary" onClick={sendComment} disabled={!comment.trim() || sendingComment}>
                {sendingComment ? <CircularProgress size={20} /> : <Send />}
              </IconButton>
            </Box>
          </Paper>
        </Grid>

        {/* Right: Sidebar */}
        <Grid item xs={12} md={4}>
          {/* Checklist */}
          <Paper sx={{ p: 2, mb: 2 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="subtitle2" fontWeight={700}>{t('prt.checklist')}</Typography>
              <Typography variant="caption" color="text.secondary">{completedChecklists}/{pr.checklists.length}</Typography>
            </Box>
            <Box sx={{ height: 4, bgcolor: '#E2E8F0', borderRadius: 2, mb: 2 }}>
              <Box sx={{ height: '100%', bgcolor: '#22C55E', borderRadius: 2, width: `${pr.checklists.length ? (completedChecklists / pr.checklists.length) * 100 : 0}%`, transition: 'width 0.3s' }} />
            </Box>
            {pr.checklists.map((c) => (
              <FormControlLabel
                key={c.id}
                control={<Checkbox size="small" checked={c.isDone} onChange={(e) => toggleChecklist(c.id, e.target.checked)} />}
                label={<Typography variant="body2" sx={{ textDecoration: c.isDone ? 'line-through' : 'none', color: c.isDone ? 'text.secondary' : 'text.primary' }}>{c.label}</Typography>}
                sx={{ display: 'flex', mb: 0.5 }}
              />
            ))}
          </Paper>

          {/* Attachments */}
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} mb={1}>{t('prt.attachments')} ({pr.attachments.length})</Typography>
            {pr.attachments.length === 0 && <Typography variant="caption" color="text.secondary">ยังไม่มีเอกสารแนบ</Typography>}
            {pr.attachments.map((att) => (
              <Box key={att.id} display="flex" alignItems="center" gap={1} mb={0.5}>
                <AttachFile fontSize="small" sx={{ color: '#6B7280' }} />
                <Typography variant="body2" component="a" href={att.fileUrl} target="_blank" rel="noreferrer" sx={{ textDecoration: 'none', color: 'primary.main', '&:hover': { textDecoration: 'underline' } }}>
                  {att.fileName}
                </Typography>
              </Box>
            ))}
          </Paper>

          {/* Activity Log */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} mb={1}>{t('prt.activity')}</Typography>
            <Box sx={{ maxHeight: 320, overflow: 'auto' }}>
              {pr.activities.map((a, i) => (
                <Box key={a.id} display="flex" gap={1} mb={1.5} position="relative">
                  <Box sx={{ position: 'relative', zIndex: 1 }}>
                    <Avatar sx={{ width: 24, height: 24, fontSize: 11, bgcolor: '#4F46E5' }}>{a.user.name[0]}</Avatar>
                    {i < pr.activities.length - 1 && <Box sx={{ position: 'absolute', left: '50%', top: 24, bottom: -8, width: 1, bgcolor: '#E2E8F0', transform: 'translateX(-50%)' }} />}
                  </Box>
                  <Box flex={1}>
                    <Typography variant="caption" color="text.secondary">
                      {a.user.name} • {timeAgo(a.createdAt)}
                    </Typography>
                    <Typography variant="body2">
                      {ACTIVITY_LABELS[a.action] ?? a.action}
                      {a.action === 'status_change' && a.oldValue && a.newValue && (
                        <> : <Chip label={STATUS_LABELS[a.oldValue]} size="small" sx={{ bgcolor: STATUS_COLORS[a.oldValue], color: '#fff', fontSize: 10, height: 18 }} /> → <Chip label={STATUS_LABELS[a.newValue]} size="small" sx={{ bgcolor: STATUS_COLORS[a.newValue], color: '#fff', fontSize: 10, height: 18 }} /></>
                      )}
                    </Typography>
                    {a.note && <Typography variant="caption" color="text.secondary">{a.note.slice(0, 80)}</Typography>}
                  </Box>
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Status change dialog */}
      <Dialog open={statusDialog} onClose={() => setStatusDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('prt.changeStatus')}</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel>สถานะใหม่</InputLabel>
            <Select value={newStatus} label="สถานะใหม่" onChange={(e) => setNewStatus(e.target.value as PrStatus)}>
              {nextStatuses.map((s) => (
                <MenuItem key={s} value={s}>
                  <Chip label={STATUS_LABELS[s]} size="small" sx={{ bgcolor: STATUS_COLORS[s], color: '#fff' }} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {newStatus === 'cancelled' && (
            <TextField
              label={t('prt.cancelReason')} fullWidth multiline rows={2} sx={{ mt: 2 }}
              value={cancelNote} onChange={(e) => setCancelNote(e.target.value)}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusDialog(false)}>ยกเลิก</Button>
          <Button variant="contained" onClick={changeStatus} disabled={changingStatus}>
            {changingStatus ? <CircularProgress size={18} /> : 'ยืนยัน'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
