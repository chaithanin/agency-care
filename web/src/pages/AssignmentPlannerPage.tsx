import { useEffect, useState } from 'react';
import { useT } from '../i18n';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  CheckCircle,
  History,
  PlayArrow,
  Publish,
  Send,
  Undo,
} from '@mui/icons-material';
import { api, errMsg } from '../api/client';
import { useAuth } from '../auth/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────
type PlanStatus = 'draft' | 'pending_approval' | 'approved' | 'published' | 'active' | 'closed';

interface PlanSummary {
  id: string;
  period: string;
  title?: string;
  status: PlanStatus;
  totalAgencies: number;
  totalSales: number;
  createdAt: string;
  createdBy: { name: string };
  approvedBy?: { name: string } | null;
  publishedAt?: string | null;
  versions: { id: string; versionNo: number; isCurrent: boolean; note?: string; createdAt: string }[];
}

interface PlanItem {
  id: string;
  isLocked: boolean;
  note?: string;
  agency: { id: string; code: string; name: string; zone?: string | null };
  employee: { id: string; code: string; name: string; zone?: string | null };
}

interface PlanDetail extends PlanSummary {
  versions: (PlanSummary['versions'][0] & { items: PlanItem[]; createdBy: { name: string } })[];
}

// ─── Status display helpers ────────────────────────────────────────────────────
const STATUS_KEY: Record<PlanStatus, string> = {
  draft: 'aa.statusDraft',
  pending_approval: 'aa.statusPendingApproval',
  approved: 'aa.statusApproved',
  published: 'aa.statusPublished',
  active: 'aa.statusActive',
  closed: 'aa.statusClosed',
};
const STATUS_COLOR: Record<PlanStatus, 'default' | 'warning' | 'info' | 'success' | 'primary' | 'error'> = {
  draft: 'default',
  pending_approval: 'warning',
  approved: 'info',
  published: 'success',
  active: 'primary',
  closed: 'error',
};

// ─── Generate Dialog ────────────────────────────────────────────────────────
function GenerateDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { t } = useT();
  const now = new Date();
  const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, '0')}`;
  const [period, setPeriod] = useState(defaultPeriod);
  const [maxPerSales, setMaxPerSales] = useState('30');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const run = async () => {
    setLoading(true);
    setErr('');
    try {
      await api.post('/assignment-plans/generate', {
        period,
        maxPerSales: maxPerSales ? parseInt(maxPerSales) : undefined,
      });
      onDone();
      onClose();
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t('aa.genDialogTitle')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          {err && <Alert severity="error">{err}</Alert>}
          <TextField
            label={t('aa.monthLabel')}
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            placeholder="2026-08"
            size="small"
            fullWidth
          />
          <TextField
            label={t('aa.maxPerSalesLabel')}
            type="number"
            value={maxPerSales}
            onChange={(e) => setMaxPerSales(e.target.value)}
            size="small"
            fullWidth
          />
          <Typography variant="caption" color="text.secondary">
            {t('aa.genHint')}
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>{t('common.cancel')}</Button>
        <Button variant="contained" onClick={run} disabled={loading || !period} startIcon={loading ? <CircularProgress size={16} /> : <PlayArrow />}>
          {t('aa.genBtn')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Plan Detail Panel ─────────────────────────────────────────────────────────
function PlanDetailPanel({
  plan,
  isAdmin,
  onRefresh,
}: {
  plan: PlanDetail;
  isAdmin: boolean;
  onRefresh: () => void;
}) {
  const { t } = useT();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [activeTab, setActiveTab] = useState(0); // 0=items, 1=versions

  const currentVersion = plan.versions.find((v) => v.isCurrent) ?? plan.versions[0];
  const items = currentVersion?.items ?? [];

  const act = async (method: 'patch' | 'post', path: string, body?: object) => {
    setLoading(true);
    setErr('');
    setMsg('');
    try {
      await api[method](`/assignment-plans/${plan.id}/${path}`, body ?? {});
      setMsg(t('aa.success'));
      onRefresh();
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setLoading(false);
    }
  };

  const rollback = async (versionId: string) => {
    setLoading(true);
    setErr('');
    try {
      await api.post(`/assignment-plans/${plan.id}/rollback/${versionId}`);
      setMsg(t('aa.rollbackSuccess'));
      onRefresh();
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      {loading && <LinearProgress sx={{ mb: 1 }} />}
      {msg && <Alert severity="success" onClose={() => setMsg('')} sx={{ mb: 1 }}>{msg}</Alert>}
      {err && <Alert severity="error" onClose={() => setErr('')} sx={{ mb: 1 }}>{err}</Alert>}

      {/* Action buttons */}
      <Stack direction="row" spacing={1} mb={2} flexWrap="wrap">
        {plan.status === 'draft' && (
          <Button
            variant="outlined"
            color="primary"
            startIcon={<Send />}
            onClick={() => act('patch', 'submit')}
            disabled={loading}
          >
            {t('aa.submitBtn')}
          </Button>
        )}
        {plan.status === 'pending_approval' && isAdmin && (
          <Button
            variant="contained"
            color="success"
            startIcon={<CheckCircle />}
            onClick={() => act('patch', 'approve')}
            disabled={loading}
          >
            {t('aa.approveBtn')}
          </Button>
        )}
        {plan.status === 'approved' && isAdmin && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<Publish />}
            onClick={() => act('patch', 'publish')}
            disabled={loading}
          >
            {t('aa.publishBtn')}
          </Button>
        )}
      </Stack>

      <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 1 }}>
        <Tab label={`${t('aa.itemsTab')} (${items.length})`} />
        <Tab label={`${t('aa.versionsTab')} (${plan.versions.length})`} icon={<History fontSize="small" />} iconPosition="end" />
      </Tabs>

      {activeTab === 0 && (
        <Paper variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'action.hover' }}>
                <TableCell>Agency</TableCell>
                <TableCell>Zone</TableCell>
                <TableCell>{t('c.seller')}</TableCell>
                <TableCell>{t('aa.sellerZone')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>{item.agency.code}</Typography>
                    <Typography variant="caption" color="text.secondary">{item.agency.name}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={item.agency.zone || '-'} variant="outlined" />
                  </TableCell>
                  <TableCell>{item.employee.name}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={item.employee.zone || '-'}
                      color={item.agency.zone && item.employee.zone === item.agency.zone ? 'success' : 'default'}
                      variant={item.agency.zone && item.employee.zone === item.agency.zone ? 'filled' : 'outlined'}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ color: 'text.secondary', py: 4 }}>
                    {t('aa.noItems')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>
      )}

      {activeTab === 1 && (
        <Paper variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'action.hover' }}>
                <TableCell>Version</TableCell>
                <TableCell>{t('aa.note')}</TableCell>
                <TableCell>{t('aa.createdBy')}</TableCell>
                <TableCell>{t('pl2.date')}</TableCell>
                <TableCell align="center">Rollback</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {plan.versions.map((v) => (
                <TableRow key={v.id} selected={v.isCurrent} hover>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2" fontWeight={600}>v{v.versionNo}</Typography>
                      {v.isCurrent && <Chip size="small" label={t('aa.currentVersion')} color="primary" />}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">{v.note || '-'}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">{(v as any).createdBy?.name || '-'}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">
                      {new Date(v.createdAt).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    {!v.isCurrent && ['draft', 'pending_approval'].includes(plan.status) && (
                      <Tooltip title={`${t('aa.rollbackTo')} v${v.versionNo}`}>
                        <IconButton size="small" onClick={() => rollback(v.id)} disabled={loading}>
                          <Undo fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function AssignmentPlannerPage() {
  const { user } = useAuth();
  const { t } = useT();
  const isAdmin = ['super_admin', 'admin'].includes(user?.role ?? '');

  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PlanDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);

  const loadPlans = async () => {
    setLoading(true);
    setErr('');
    try {
      const { data } = await api.get('/assignment-plans');
      setPlans(data);
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const { data } = await api.get(`/assignment-plans/${id}`);
      setDetail(data);
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => { loadPlans(); }, []);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId]);

  const handleRefresh = () => {
    loadPlans();
    if (selectedId) loadDetail(selectedId);
  };

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>AI Assignment Planner</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('aa.pageSubtitle')}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setGenerateOpen(true)}
        >
          {t('aa.createNewPlan')}
        </Button>
      </Stack>

      {err && <Alert severity="error" onClose={() => setErr('')} sx={{ mb: 2 }}>{err}</Alert>}
      {loading && <LinearProgress sx={{ mb: 2 }} />}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="flex-start">
        {/* Plan list */}
        <Paper sx={{ width: { xs: '100%', md: 320 }, flexShrink: 0 }}>
          <Typography variant="subtitle2" sx={{ px: 2, pt: 2, pb: 1, fontWeight: 700 }}>
            {t('aa.allPlans')} ({plans.length})
          </Typography>
          <Divider />
          {plans.length === 0 && !loading && (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
              {t('aa.noPlan')}
            </Typography>
          )}
          {plans.map((p) => (
            <Box
              key={p.id}
              onClick={() => setSelectedId(p.id)}
              sx={{
                px: 2,
                py: 1.5,
                cursor: 'pointer',
                borderLeft: selectedId === p.id ? 3 : 0,
                borderColor: 'primary.main',
                bgcolor: selectedId === p.id ? 'action.selected' : 'transparent',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="body1" fontWeight={600}>{p.period}</Typography>
                <Chip size="small" label={t(STATUS_KEY[p.status])} color={STATUS_COLOR[p.status]} />
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {p.totalAgencies} Agency · {p.totalSales} {t('c.seller')} · v{p.versions.length}
              </Typography>
              <Typography variant="caption" display="block" color="text.secondary">
                {t('aa.createdBy')} {p.createdBy.name}
              </Typography>
            </Box>
          ))}
        </Paper>

        {/* Detail panel */}
        <Box flex={1} minWidth={0}>
          {detailLoading && <LinearProgress />}
          {!selectedId && !detailLoading && (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">{t('aa.selectPlan')}</Typography>
            </Paper>
          )}
          {detail && !detailLoading && (
            <Paper sx={{ p: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
                <Box>
                  <Typography variant="h6" fontWeight={700}>{detail.period} — {detail.title}</Typography>
                  <Stack direction="row" spacing={1} mt={0.5}>
                    <Chip size="small" label={t(STATUS_KEY[detail.status])} color={STATUS_COLOR[detail.status]} />
                    <Chip size="small" label={`${detail.totalAgencies} Agency`} variant="outlined" />
                    <Chip size="small" label={`${detail.totalSales} ${t('c.seller')}`} variant="outlined" />
                    <Chip size="small" label={`v${detail.versions.length}`} variant="outlined" />
                  </Stack>
                </Box>
                {detail.approvedBy && (
                  <Typography variant="caption" color="text.secondary">
                    {t('aa.approvedBy')}: {detail.approvedBy.name}
                  </Typography>
                )}
              </Stack>
              <Divider sx={{ mb: 2 }} />
              <PlanDetailPanel plan={detail} isAdmin={isAdmin} onRefresh={handleRefresh} />
            </Paper>
          )}
        </Box>
      </Stack>

      <GenerateDialog
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        onDone={loadPlans}
      />
    </Box>
  );
}
