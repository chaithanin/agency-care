import { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent, Chip, Button, TextField,
  Select, MenuItem, FormControl, InputLabel, Dialog, DialogTitle, DialogContent,
  DialogActions, Alert, IconButton, CircularProgress, Tab, Tabs, Table, TableHead,
  TableRow, TableCell, TableBody, Stack, Divider, LinearProgress, Tooltip,
  FormControlLabel, Switch, Badge, List, ListItem, ListItemText, ListItemButton,
  Avatar,
} from '@mui/material';
import {
  Add, Refresh, Send, Edit, Delete, CheckCircle,
  Campaign, Analytics, History, Dashboard, Article, SmartToy, Preview,
  ContentCopy,
} from '@mui/icons-material';
import { api, errMsg } from '../api/client';
import { useAuth } from '../auth/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Broadcast {
  id: string; title: string; type: string; priority: string; content: string;
  imageUrl?: string; buttons?: { label: string; url: string }[];
  recipientType: string; recipientIds: string[];
  scheduleType: string; scheduledAt?: string;
  recurringFreq?: string; recurringTime?: string;
  status: string;
  sentCount: number; deliveredCount: number; readCount: number; clickCount: number; failedCount: number;
  approvalRequired: boolean; approvedBy?: { name: string }; rejectedReason?: string;
  createdBy: { name: string }; sentAt?: string; createdAt: string;
  _count?: { recipients: number };
}

interface Stats { total: number; draft: number; scheduled: number; sent: number; failed: number; avgReadRate: number; }
interface Template { id: string; name: string; type: string; content: string; buttons?: any; }
interface Employee { id: string; name: string; code: string; }

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPES = ['news', 'announcement', 'promotion', 'hr', 'it', 'training', 'emergency'];
const PRIORITIES = ['low', 'normal', 'high', 'critical'];

const TYPE_LABEL: Record<string, string> = {
  news: 'ข่าวสาร', announcement: 'ประกาศ', promotion: 'โปรโมชั่น',
  hr: 'HR', it: 'IT', training: 'อบรม', emergency: 'ฉุกเฉิน',
};
const STATUS_COLOR: Record<string, 'default' | 'info' | 'success' | 'error' | 'warning'> = {
  draft: 'default', pending_approval: 'warning', approved: 'info',
  scheduled: 'info', sending: 'warning', sent: 'success', failed: 'error', cancelled: 'default',
};
const STATUS_TH: Record<string, string> = {
  draft: 'Draft', pending_approval: 'รออนุมัติ', approved: 'อนุมัติแล้ว',
  scheduled: 'กำหนดเวลา', sending: 'กำลังส่ง', sent: 'ส่งแล้ว', failed: 'ล้มเหลว', cancelled: 'ยกเลิก',
};
const PRIORITY_EMOJI: Record<string, string> = { low: '🔵', normal: '📢', high: '🔴', critical: '🚨' };

const EMPTY_FORM = {
  title: '', type: 'news', priority: 'normal', content: '',
  imageUrl: '', buttons: [] as { label: string; url: string }[],
  recipientType: 'all', recipientIds: [] as string[],
  scheduleType: 'immediate', scheduledAt: '',
  recurringFreq: 'weekly', recurringTime: '08:30',
  approvalRequired: false,
};

// ─── LINE Preview Component ───────────────────────────────────────────────────

function LinePreview({ title, content, priority, buttons }: {
  title: string; content: string; priority: string; buttons: { label: string; url: string }[];
}) {
  const emoji = PRIORITY_EMOJI[priority] ?? '📢';
  return (
    <Box sx={{ maxWidth: 300, mx: 'auto' }}>
      <Typography variant="caption" color="text.secondary" align="center" display="block" mb={1}>
        ตัวอย่างใน LINE OA
      </Typography>
      <Box sx={{
        bgcolor: '#06C755', borderRadius: 3, p: 2,
        boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
      }}>
        <Stack direction="row" spacing={1} alignItems="center" mb={1}>
          <Avatar sx={{ width: 28, height: 28, bgcolor: '#00A846', fontSize: 12 }}>AC</Avatar>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.9)', fontWeight: 700 }}>
            Agency Care
          </Typography>
        </Stack>
        <Box sx={{ bgcolor: '#fff', borderRadius: 2, p: 1.5 }}>
          <Typography variant="body2" fontWeight={700} mb={0.5}>
            {emoji} {title || 'หัวข้อข่าว'}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
            {(content || 'เนื้อหาข่าว...').slice(0, 200)}
          </Typography>
          {buttons.length > 0 && (
            <Stack spacing={0.5} mt={1}>
              {buttons.map((b, i) => (
                <Box key={i} sx={{
                  bgcolor: '#06C755', color: '#fff', borderRadius: 1,
                  p: 0.75, textAlign: 'center', fontSize: 12, fontWeight: 700,
                }}>
                  {b.label}
                </Box>
              ))}
            </Stack>
          )}
        </Box>
      </Box>
    </Box>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BroadcastPage() {
  const { user } = useAuth();
  const isManager = !['sales'].includes(user?.activeRole ?? '');
  const isAdmin = ['admin', 'super_admin'].includes(user?.activeRole ?? '');

  const [tab, setTab] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [templatePickOpen, setTemplatePickOpen] = useState(false);

  // Detail dialog
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);

  // ─── Load ──────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filterStatus) params.status = filterStatus;
      const [bRes, sRes] = await Promise.all([
        api.get<Broadcast[]>('/broadcasts', { params }),
        api.get<Stats>('/broadcasts/stats'),
      ]);
      setBroadcasts(bRes.data ?? []);
      setStats(sRes.data);
    } catch (e) { setError(errMsg(e)); }
    setLoading(false);
  }, [filterStatus]);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    api.get<Template[]>('/broadcasts/templates').then(r => setTemplates(r.data ?? [])).catch(() => {});
    if (isManager) api.get<Employee[]>('/employees').then(r => setEmployees(r.data ?? [])).catch(() => {});
  }, [isManager]);

  useEffect(() => {
    if (tab === 3) {
      api.get('/broadcasts/analytics').then(r => setAnalytics(r.data)).catch(() => {});
    }
  }, [tab]);

  const flash = (msg: string, isErr = false) => {
    if (isErr) setError(msg); else setSuccess(msg);
    setTimeout(() => { setError(''); setSuccess(''); }, 4000);
  };

  // ─── Form ──────────────────────────────────────────────────────
  const openCreate = () => {
    setEditId(null);
    setForm({ ...EMPTY_FORM });
    setFormOpen(true);
  };

  const openEdit = (b: Broadcast) => {
    setEditId(b.id);
    setForm({
      title: b.title, type: b.type, priority: b.priority, content: b.content,
      imageUrl: b.imageUrl ?? '', buttons: b.buttons ?? [],
      recipientType: b.recipientType, recipientIds: b.recipientIds ?? [],
      scheduleType: b.scheduleType,
      scheduledAt: b.scheduledAt ? b.scheduledAt.slice(0, 16) : '',
      recurringFreq: b.recurringFreq ?? 'weekly', recurringTime: b.recurringTime ?? '08:30',
      approvalRequired: b.approvalRequired,
    });
    setFormOpen(true);
  };

  const save = async () => {
    if (!form.title || !form.content) { flash('กรุณาใส่หัวข้อและเนื้อหา', true); return; }
    try {
      const payload = {
        ...form,
        imageUrl: form.imageUrl || undefined,
        scheduledAt: form.scheduleType === 'scheduled' && form.scheduledAt ? new Date(form.scheduledAt).toISOString() : undefined,
      };
      if (editId) {
        await api.patch(`/broadcasts/${editId}`, payload);
        flash('บันทึกสำเร็จ');
      } else {
        await api.post('/broadcasts', payload);
        flash('สร้าง Broadcast สำเร็จ');
      }
      setFormOpen(false);
      loadAll();
    } catch (e) { flash(errMsg(e), true); }
  };

  const applyTemplate = (t: Template) => {
    setForm(f => ({ ...f, type: t.type, content: t.content, buttons: t.buttons ?? [] }));
    setTemplatePickOpen(false);
  };

  // ─── Actions ───────────────────────────────────────────────────
  const sendNow = async (id: string) => {
    try {
      setLoading(true);
      const r = await api.post<{ sentCount: number; failedCount: number }>(`/broadcasts/${id}/send`);
      flash(`ส่งสำเร็จ ${r.data.sentCount} ราย`);
      loadAll();
    } catch (e) { flash(errMsg(e), true); } finally { setLoading(false); }
  };

  const approve = async (id: string) => {
    try { await api.post(`/broadcasts/${id}/approve`); flash('อนุมัติสำเร็จ'); loadAll(); }
    catch (e) { flash(errMsg(e), true); }
  };

  const remove = async (id: string) => {
    if (!confirm('ลบ Broadcast นี้?')) return;
    try { await api.delete(`/broadcasts/${id}`); flash('ลบแล้ว'); loadAll(); }
    catch (e) { flash(errMsg(e), true); }
  };

  const loadDetail = async (id: string) => {
    setDetailId(id); setDetail(null);
    try { const r = await api.get(`/broadcasts/${id}`); setDetail(r.data); }
    catch (e) { flash(errMsg(e), true); }
  };

  // ─── AI Draft ─────────────────────────────────────────────────
  const aiDraft = async () => {
    if (!form.title) { flash('ใส่หัวข้อก่อน แล้วกด AI', true); return; }
    try {
      const prompt = `เขียนข่าวประกาศสำหรับ LINE OA เรื่อง "${form.title}" ประเภท ${TYPE_LABEL[form.type] ?? form.type} ให้กระชับ ชัดเจน ไม่เกิน 200 คำ`;
      const r = await api.post('/analytics/ai-chat', { message: prompt });
      setForm(f => ({ ...f, content: r.data?.reply ?? r.data?.message ?? '' }));
    } catch { flash('AI ไม่พร้อมใช้งาน', true); }
  };

  // ─── Read rate bar ────────────────────────────────────────────
  const readRate = (b: Broadcast) =>
    b.sentCount > 0 ? Math.round((b.readCount / b.sentCount) * 100) : 0;

  // ─── Render ───────────────────────────────────────────────────
  return (
    <Box p={3}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Campaign sx={{ color: '#06C755', fontSize: 28 }} />
            <Typography variant="h5" fontWeight={700}>LINE Broadcast Center</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">ส่งข่าวสารผ่าน LINE OA ถึงพนักงาน</Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <IconButton onClick={loadAll}><Refresh /></IconButton>
          {isManager && (
            <Button startIcon={<Add />} variant="contained" onClick={openCreate}
              sx={{ bgcolor: '#06C755', '&:hover': { bgcolor: '#00A846' } }}>
              สร้าง Broadcast
            </Button>
          )}
        </Stack>
      </Box>

      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab icon={<Dashboard fontSize="small" />} label="Dashboard" iconPosition="start" />
        <Tab icon={<History fontSize="small" />} label="ประวัติการส่ง" iconPosition="start" />
        <Tab icon={<Article fontSize="small" />} label="Templates" iconPosition="start" />
        <Tab icon={<Analytics fontSize="small" />} label="Analytics" iconPosition="start" />
      </Tabs>

      {/* ── Tab 0: Dashboard ── */}
      {tab === 0 && (
        <>
          {/* Stats */}
          <Grid container spacing={2} mb={3}>
            {[
              { label: 'ข่าวทั้งหมด', value: stats?.total ?? '—', color: '#4F46E5' },
              { label: 'Draft', value: stats?.draft ?? '—', color: '#6B7280' },
              { label: 'Scheduled', value: stats?.scheduled ?? '—', color: '#2563EB' },
              { label: 'Sent', value: stats?.sent ?? '—', color: '#16A34A' },
              { label: 'Failed', value: stats?.failed ?? '—', color: '#DC2626' },
              { label: 'Avg Read Rate', value: stats ? `${stats.avgReadRate}%` : '—', color: '#D97706' },
            ].map((c) => (
              <Grid item xs={6} sm={4} md={2} key={c.label}>
                <Card variant="outlined" sx={{ borderTop: `3px solid ${c.color}`, textAlign: 'center' }}>
                  <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="h5" fontWeight={700} sx={{ color: c.color }}>{c.value}</Typography>
                    <Typography variant="caption" color="text.secondary">{c.label}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Recent broadcasts */}
          <Typography variant="subtitle1" fontWeight={700} mb={1}>ล่าสุด</Typography>
          {loading ? <Box textAlign="center" p={4}><CircularProgress /></Box> : (
            <Stack spacing={1.5}>
              {broadcasts.slice(0, 6).map((b) => (
                <Paper key={b.id} sx={{ p: 2, cursor: 'pointer', '&:hover': { boxShadow: 4 } }}
                  onClick={() => loadDetail(b.id)}>
                  <Stack direction="row" alignItems="flex-start" spacing={2}>
                    <Box sx={{ fontSize: 24 }}>{PRIORITY_EMOJI[b.priority] ?? '📢'}</Box>
                    <Box flex={1} minWidth={0}>
                      <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                        <Typography fontWeight={700} noWrap>{b.title}</Typography>
                        <Chip label={STATUS_TH[b.status]} size="small" color={STATUS_COLOR[b.status]} />
                        <Chip label={TYPE_LABEL[b.type] ?? b.type} size="small" variant="outlined" />
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        โดย {b.createdBy?.name} · {new Date(b.createdAt).toLocaleDateString('th-TH')}
                        {b.sentAt && ` · ส่งแล้ว ${b.sentCount} ราย`}
                      </Typography>
                      {b.sentCount > 0 && (
                        <Box mt={0.5}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="caption" color="text.secondary" sx={{ minWidth: 60 }}>
                              อ่าน {readRate(b)}%
                            </Typography>
                            <LinearProgress variant="determinate" value={readRate(b)}
                              sx={{ flex: 1, height: 4, borderRadius: 2, bgcolor: '#E2E8F0',
                                '& .MuiLinearProgress-bar': { bgcolor: '#06C755' } }} />
                          </Stack>
                        </Box>
                      )}
                    </Box>
                    <Stack direction="row" spacing={0.5}>
                      {['draft', 'approved'].includes(b.status) && isManager && (
                        <Tooltip title="ส่งเดี๋ยวนี้">
                          <IconButton size="small" color="success" onClick={(e) => { e.stopPropagation(); sendNow(b.id); }}>
                            <Send fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {b.status === 'pending_approval' && isAdmin && (
                        <Tooltip title="อนุมัติ">
                          <IconButton size="small" color="success" onClick={(e) => { e.stopPropagation(); approve(b.id); }}>
                            <CheckCircle fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {['draft', 'pending_approval'].includes(b.status) && isManager && (
                        <Tooltip title="แก้ไข">
                          <IconButton size="small" onClick={(e) => { e.stopPropagation(); openEdit(b); }}>
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </>
      )}

      {/* ── Tab 1: ประวัติ ── */}
      {tab === 1 && (
        <>
          <Stack direction="row" spacing={2} mb={2} flexWrap="wrap">
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>สถานะ</InputLabel>
              <Select value={filterStatus} label="สถานะ" onChange={e => setFilterStatus(e.target.value)}>
                <MenuItem value="">ทั้งหมด</MenuItem>
                {Object.entries(STATUS_TH).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
              </Select>
            </FormControl>
          </Stack>
          <Paper>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                  {['วันที่', 'หัวข้อ', 'ประเภท', 'ผู้ส่ง', 'ผู้รับ', 'ส่งสำเร็จ', 'อ่าน', 'สถานะ', ''].map(h => (
                    <TableCell key={h} sx={{ fontWeight: 700 }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={9} align="center"><CircularProgress size={24} /></TableCell></TableRow>
                ) : broadcasts.length === 0 ? (
                  <TableRow><TableCell colSpan={9} align="center" sx={{ py: 4, color: 'text.secondary' }}>ไม่มีข้อมูล</TableCell></TableRow>
                ) : broadcasts.map(b => (
                  <TableRow key={b.id} hover sx={{ cursor: 'pointer' }} onClick={() => loadDetail(b.id)}>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {new Date(b.createdAt).toLocaleDateString('th-TH')}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{b.title}</Typography>
                    </TableCell>
                    <TableCell><Chip label={TYPE_LABEL[b.type] ?? b.type} size="small" variant="outlined" /></TableCell>
                    <TableCell>{b.createdBy?.name ?? '—'}</TableCell>
                    <TableCell>{b._count?.recipients ?? b.sentCount}</TableCell>
                    <TableCell>{b.sentCount}</TableCell>
                    <TableCell>
                      {b.sentCount > 0 ? (
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <Typography variant="caption">{readRate(b)}%</Typography>
                          <LinearProgress variant="determinate" value={readRate(b)}
                            sx={{ width: 50, height: 4, borderRadius: 2,
                              '& .MuiLinearProgress-bar': { bgcolor: '#06C755' } }} />
                        </Stack>
                      ) : '—'}
                    </TableCell>
                    <TableCell>
                      <Chip label={STATUS_TH[b.status]} size="small" color={STATUS_COLOR[b.status]} />
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <Stack direction="row" spacing={0.5}>
                        {['draft', 'approved'].includes(b.status) && isManager && (
                          <Tooltip title="ส่ง">
                            <IconButton size="small" color="success" onClick={() => sendNow(b.id)}>
                              <Send fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {b.status === 'pending_approval' && isAdmin && (
                          <Tooltip title="อนุมัติ">
                            <IconButton size="small" color="success" onClick={() => approve(b.id)}>
                              <CheckCircle fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {['draft', 'pending_approval'].includes(b.status) && isManager && (
                          <IconButton size="small" onClick={() => openEdit(b)}><Edit fontSize="small" /></IconButton>
                        )}
                        {!['sent', 'sending'].includes(b.status) && isAdmin && (
                          <IconButton size="small" color="error" onClick={() => remove(b.id)}><Delete fontSize="small" /></IconButton>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </>
      )}

      {/* ── Tab 2: Templates ── */}
      {tab === 2 && (
        <Grid container spacing={2}>
          {templates.map(t => (
            <Grid item xs={12} sm={6} md={4} key={t.id}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                    <Chip label={TYPE_LABEL[t.type] ?? t.type} size="small" color="primary" />
                    <Typography variant="subtitle2" fontWeight={700} flex={1} noWrap>{t.name}</Typography>
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'pre-line', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {t.content}
                  </Typography>
                </CardContent>
                <Box px={2} pb={2}>
                  <Button size="small" startIcon={<ContentCopy />}
                    onClick={() => { setForm(f => ({ ...f, type: t.type, content: t.content })); setTab(0); openCreate(); }}>
                    ใช้ Template นี้
                  </Button>
                </Box>
              </Card>
            </Grid>
          ))}
          {templates.length === 0 && (
            <Grid item xs={12}><Typography color="text.secondary" align="center" py={4}>ยังไม่มี Template</Typography></Grid>
          )}
        </Grid>
      )}

      {/* ── Tab 3: Analytics ── */}
      {tab === 3 && (
        <Box>
          {!analytics ? <Box textAlign="center" p={4}><CircularProgress /></Box> : (
            <>
              <Grid container spacing={2} mb={3}>
                {[
                  { label: 'Total Sent', value: analytics.totalSent, color: '#4F46E5' },
                  { label: 'Total Read', value: analytics.totalRead, color: '#16A34A' },
                  { label: 'Open Rate', value: `${analytics.openRate}%`, color: '#2563EB' },
                  { label: 'Click Rate', value: `${analytics.clickRate}%`, color: '#D97706' },
                ].map(c => (
                  <Grid item xs={6} sm={3} key={c.label}>
                    <Card variant="outlined" sx={{ borderTop: `3px solid ${c.color}`, textAlign: 'center' }}>
                      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                        <Typography variant="h5" fontWeight={700} sx={{ color: c.color }}>{c.value}</Typography>
                        <Typography variant="caption" color="text.secondary">{c.label}</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>

              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" fontWeight={700} mb={2}>Open Rate ย้อนหลัง 30 วัน</Typography>
                <Stack spacing={1}>
                  {(analytics.series ?? []).slice(-14).map((s: any) => (
                    <Stack key={s.date} direction="row" alignItems="center" spacing={1}>
                      <Typography variant="caption" sx={{ minWidth: 80 }}>{s.date}</Typography>
                      <LinearProgress
                        variant="determinate"
                        value={s.sent > 0 ? Math.round((s.read / s.sent) * 100) : 0}
                        sx={{ flex: 1, height: 10, borderRadius: 4,
                          '& .MuiLinearProgress-bar': { bgcolor: '#06C755' } }}
                      />
                      <Typography variant="caption" sx={{ minWidth: 40 }}>
                        {s.sent > 0 ? `${Math.round((s.read / s.sent) * 100)}%` : '—'}
                      </Typography>
                    </Stack>
                  ))}
                  {(analytics.series ?? []).length === 0 && (
                    <Typography color="text.secondary" align="center" py={2}>ยังไม่มีข้อมูล</Typography>
                  )}
                </Stack>
              </Paper>
            </>
          )}
        </Box>
      )}

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="md" fullWidth
        PaperProps={{ sx: { backgroundImage: 'none', bgcolor: 'background.paper' } }}
        slotProps={{ backdrop: { sx: { bgcolor: 'rgba(0,0,0,0.75)' } } }}>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Campaign sx={{ color: '#06C755' }} />
            <span>{editId ? 'แก้ไข Broadcast' : 'สร้าง Broadcast ใหม่'}</span>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            {/* Header row */}
            <Grid item xs={12}>
              <Stack direction="row" spacing={1} justifyContent="flex-end" mb={1}>
                <Button size="small" startIcon={<Article />} variant="outlined"
                  onClick={() => setTemplatePickOpen(true)}>
                  ใช้ Template
                </Button>
                <Button size="small" startIcon={<SmartToy />} variant="outlined"
                  onClick={aiDraft}>
                  AI Draft
                </Button>
                <Button size="small" startIcon={<Preview />} variant="outlined"
                  onClick={() => setPreviewOpen(true)}>
                  Preview
                </Button>
              </Stack>
            </Grid>

            <Grid item xs={12}>
              <TextField label="หัวข้อ *" fullWidth size="small" value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </Grid>

            <Grid item xs={6} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>ประเภท</InputLabel>
                <Select value={form.type} label="ประเภท" onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  {TYPES.map(t => <MenuItem key={t} value={t}>{TYPE_LABEL[t]}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>ลำดับความสำคัญ</InputLabel>
                <Select value={form.priority} label="ลำดับความสำคัญ" onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                  {PRIORITIES.map(p => <MenuItem key={p} value={p}>{PRIORITY_EMOJI[p]} {p}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControlLabel
                control={<Switch checked={form.approvalRequired}
                  onChange={e => setForm(f => ({ ...f, approvalRequired: e.target.checked }))} />}
                label="ต้องอนุมัติก่อนส่ง"
              />
            </Grid>

            <Grid item xs={12}>
              <TextField label="เนื้อหา *" fullWidth multiline rows={6} size="small"
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                placeholder="เขียนข่าวสาร..." />
            </Grid>

            <Grid item xs={12}>
              <TextField label="URL รูปภาพ (ถ้ามี)" fullWidth size="small"
                value={form.imageUrl}
                onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))} />
            </Grid>

            <Grid item xs={12}><Divider><Typography variant="caption">ผู้รับ</Typography></Divider></Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>กลุ่มผู้รับ</InputLabel>
                <Select value={form.recipientType} label="กลุ่มผู้รับ"
                  onChange={e => setForm(f => ({ ...f, recipientType: e.target.value }))}>
                  {[
                    { v: 'all', l: '👥 ทุกคน' }, { v: 'sale', l: '🏃 Sale' },
                    { v: 'closer', l: '💼 Closer' }, { v: 'admin', l: '⚙️ Admin' },
                    { v: 'executive', l: '👑 Executive' }, { v: 'individual', l: '👤 เลือกรายบุคคล' },
                  ].map(o => <MenuItem key={o.v} value={o.v}>{o.l}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>

            {form.recipientType === 'individual' && (
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>เลือกพนักงาน</InputLabel>
                  <Select
                    multiple value={form.recipientIds} label="เลือกพนักงาน"
                    onChange={e => setForm(f => ({ ...f, recipientIds: e.target.value as string[] }))}
                    renderValue={(sel) => `เลือกแล้ว ${(sel as string[]).length} คน`}
                  >
                    {employees.map(e => (
                      <MenuItem key={e.id} value={e.id}>
                        <Badge variant="dot" color={form.recipientIds.includes(e.id) ? 'success' : 'default'} sx={{ mr: 1 }} />
                        {e.name} ({e.code})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}

            <Grid item xs={12}><Divider><Typography variant="caption">การส่ง</Typography></Divider></Grid>

            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>เวลาส่ง</InputLabel>
                <Select value={form.scheduleType} label="เวลาส่ง"
                  onChange={e => setForm(f => ({ ...f, scheduleType: e.target.value }))}>
                  <MenuItem value="immediate">⚡ ส่งทันที</MenuItem>
                  <MenuItem value="scheduled">📅 กำหนดวันเวลา</MenuItem>
                  <MenuItem value="recurring">🔄 ส่งซ้ำ</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {form.scheduleType === 'scheduled' && (
              <Grid item xs={12} sm={8}>
                <TextField label="วันและเวลา" type="datetime-local" fullWidth size="small"
                  value={form.scheduledAt} InputLabelProps={{ shrink: true }}
                  onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))} />
              </Grid>
            )}

            {form.scheduleType === 'recurring' && (
              <>
                <Grid item xs={6} sm={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel>ความถี่</InputLabel>
                    <Select value={form.recurringFreq} label="ความถี่"
                      onChange={e => setForm(f => ({ ...f, recurringFreq: e.target.value }))}>
                      <MenuItem value="daily">รายวัน</MenuItem>
                      <MenuItem value="weekly">รายสัปดาห์</MenuItem>
                      <MenuItem value="monthly">รายเดือน</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6} sm={4}>
                  <TextField label="เวลา" type="time" fullWidth size="small"
                    value={form.recurringTime} InputLabelProps={{ shrink: true }}
                    onChange={e => setForm(f => ({ ...f, recurringTime: e.target.value }))} />
                </Grid>
              </>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormOpen(false)}>ยกเลิก</Button>
          <Button variant="outlined" onClick={save} disabled={!form.title}>
            บันทึก Draft
          </Button>
          {!form.approvalRequired && (
            <Button variant="contained" onClick={async () => { await save(); }}
              sx={{ bgcolor: '#06C755', '&:hover': { bgcolor: '#00A846' } }}
              disabled={!form.title || !form.content} startIcon={<Send />}>
              บันทึก + ส่ง
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* ── Preview Dialog ── */}
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { backgroundImage: 'none', bgcolor: 'background.paper' } }}>
        <DialogTitle>Preview LINE OA</DialogTitle>
        <DialogContent>
          <LinePreview title={form.title} content={form.content}
            priority={form.priority} buttons={form.buttons} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)}>ปิด</Button>
        </DialogActions>
      </Dialog>

      {/* ── Template Picker ── */}
      <Dialog open={templatePickOpen} onClose={() => setTemplatePickOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { backgroundImage: 'none', bgcolor: 'background.paper' } }}>
        <DialogTitle>เลือก Template</DialogTitle>
        <DialogContent>
          <List>
            {templates.map(t => (
              <ListItemButton key={t.id} onClick={() => applyTemplate(t)}>
                <ListItemText
                  primary={<Stack direction="row" spacing={1} alignItems="center">
                    <Chip label={TYPE_LABEL[t.type] ?? t.type} size="small" color="primary" />
                    <span>{t.name}</span>
                  </Stack>}
                  secondary={t.content.slice(0, 80) + '...'}
                />
              </ListItemButton>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTemplatePickOpen(false)}>ปิด</Button>
        </DialogActions>
      </Dialog>

      {/* ── Detail Dialog ── */}
      <Dialog open={!!detailId} onClose={() => setDetailId(null)} maxWidth="md" fullWidth
        PaperProps={{ sx: { backgroundImage: 'none', bgcolor: 'background.paper' } }}>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <span>{detail?.title ?? '...'}</span>
            {detail && <Chip label={STATUS_TH[detail.status]} size="small" color={STATUS_COLOR[detail.status]} />}
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {!detail ? <Box textAlign="center" p={4}><CircularProgress /></Box> : (
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">ผู้สร้าง</Typography>
                <Typography>{detail.createdBy?.name}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">ส่งเมื่อ</Typography>
                <Typography>{detail.sentAt ? new Date(detail.sentAt).toLocaleString('th-TH') : '—'}</Typography>
              </Grid>

              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">เนื้อหา</Typography>
                <Paper variant="outlined" sx={{ p: 2, whiteSpace: 'pre-line', mt: 0.5 }}>
                  {detail.content}
                </Paper>
              </Grid>

              {/* Stats */}
              <Grid item xs={12}>
                <Stack direction="row" spacing={2} flexWrap="wrap">
                  {[
                    { l: 'ส่ง', v: detail.sentCount, c: '#4F46E5' },
                    { l: 'อ่าน', v: detail.readCount, c: '#06C755' },
                    { l: 'ล้มเหลว', v: detail.failedCount, c: '#DC2626' },
                  ].map(s => (
                    <Box key={s.l} sx={{ textAlign: 'center', minWidth: 80 }}>
                      <Typography variant="h5" fontWeight={700} sx={{ color: s.c }}>{s.v}</Typography>
                      <Typography variant="caption" color="text.secondary">{s.l}</Typography>
                    </Box>
                  ))}
                </Stack>
              </Grid>

              {/* Logs */}
              {detail.logs?.length > 0 && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" fontWeight={700} mb={1}>Broadcast Log</Typography>
                  <List dense disablePadding>
                    {detail.logs.map((log: any) => (
                      <ListItem key={log.id} disableGutters>
                        <ListItemText
                          primary={`${log.action} — ${log.user?.name ?? 'ระบบ'}`}
                          secondary={`${new Date(log.createdAt).toLocaleString('th-TH')}${log.detail ? ' · ' + log.detail : ''}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Grid>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          {detail && ['draft', 'approved'].includes(detail.status) && isManager && (
            <Button variant="contained" startIcon={<Send />}
              sx={{ bgcolor: '#06C755', '&:hover': { bgcolor: '#00A846' } }}
              onClick={() => { sendNow(detail.id); setDetailId(null); }}>
              ส่งเดี๋ยวนี้
            </Button>
          )}
          {detail && detail.status === 'pending_approval' && isAdmin && (
            <Button variant="contained" color="success" startIcon={<CheckCircle />}
              onClick={() => { approve(detail.id); setDetailId(null); }}>
              อนุมัติ
            </Button>
          )}
          <Button onClick={() => setDetailId(null)}>ปิด</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
