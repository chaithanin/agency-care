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
  FormControl,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
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
  Print as PrintIcon,
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

  // ─── Print ──────────────────────────────────────────────────────────────────
  const [printOpen, setPrintOpen] = useState(false);
  const [printEmployee, setPrintEmployee] = useState(''); // '' = all

  // Unique employees from current items
  const uniqueEmployees = Array.from(
    new Map(items.map((i) => [i.employee.id, i.employee])).values(),
  ).sort((a, b) => a.name.localeCompare(b.name, 'th'));

  const executePrint = () => {
    const colStyle = 'padding:6px 8px;border:1px solid #cbd5e1;font-size:11px;vertical-align:top;';
    const hStyle = `${colStyle}background:#1e293b;color:#fff;font-weight:700;white-space:nowrap;`;

    const buildHeader = () => `
      <tr>
        <th style="${hStyle}">#</th>
        <th style="${hStyle}">รหัส Agency</th>
        <th style="${hStyle}">ชื่อ Agency</th>
        <th style="${hStyle}">โซน Agency</th>
        <th style="${hStyle}">โซนเซลส์</th>
        <th style="${hStyle}">หมายเหตุ</th>
      </tr>`;

    const buildRows = (list: PlanItem[]) =>
      list.map((item, i) => `
        <tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'}">
          <td style="${colStyle}text-align:center;color:#94a3b8">${i + 1}</td>
          <td style="${colStyle}white-space:nowrap;font-weight:600">${item.agency.code}</td>
          <td style="${colStyle}">${item.agency.name}</td>
          <td style="${colStyle}text-align:center">
            <span style="background:#e0e7ff;color:#3730a3;padding:2px 8px;border-radius:9999px;font-size:10px">
              ${item.agency.zone ?? '—'}
            </span>
          </td>
          <td style="${colStyle}text-align:center">
            <span style="background:${item.agency.zone && item.employee.zone === item.agency.zone ? '#dcfce7' : '#f1f5f9'};color:${item.agency.zone && item.employee.zone === item.agency.zone ? '#15803d' : '#64748b'};padding:2px 8px;border-radius:9999px;font-size:10px">
              ${item.employee.zone ?? '—'}
            </span>
          </td>
          <td style="${colStyle}color:#64748b">${item.note ?? ''}</td>
        </tr>`).join('');

    let bodyHtml = '';

    if (printEmployee) {
      // Single employee
      const empItems = items.filter((i) => i.employee.id === printEmployee);
      const emp = uniqueEmployees.find((e) => e.id === printEmployee);
      bodyHtml = `
        <div style="margin-bottom:8px;background:#3b82f6;color:#fff;padding:6px 12px;font-weight:700;font-size:13px;border-radius:4px">
          👤 ${emp?.name ?? ''} — ${emp?.code ?? ''} &nbsp;|&nbsp; โซน: ${emp?.zone ?? '—'} &nbsp;|&nbsp; ${empItems.length} Agency
        </div>
        <table style="width:100%;border-collapse:collapse">
          ${buildHeader()}
          ${buildRows(empItems)}
        </table>`;
    } else {
      // All employees — one section per person
      bodyHtml = uniqueEmployees.map((emp) => {
        const empItems = items.filter((i) => i.employee.id === emp.id);
        return `
          <div style="margin-bottom:24px;page-break-inside:avoid">
            <div style="background:#1d4ed8;color:#fff;padding:6px 12px;font-weight:700;font-size:13px;border-radius:4px 4px 0 0">
              👤 ${emp.name} (${emp.code}) &nbsp;|&nbsp; โซน: ${emp.zone ?? '—'} &nbsp;|&nbsp; ${empItems.length} Agency
            </div>
            <table style="width:100%;border-collapse:collapse">
              ${buildHeader()}
              ${buildRows(empItems)}
            </table>
          </div>`;
      }).join('');
    }

    const empLabel = printEmployee
      ? uniqueEmployees.find((e) => e.id === printEmployee)?.name ?? ''
      : 'ทั้งหมด';

    const todayStr = new Date().toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' });

    const html = `<!DOCTYPE html><html><head>
      <meta charset="utf-8"/>
      <title>แผนมอบหมาย ${plan.period} — ${empLabel}</title>
      <style>
        * { font-family: 'Sarabun', Arial, sans-serif; box-sizing: border-box; }
        body { margin: 0; padding: 16px 20px; color: #0f172a; }
        @media print {
          @page { size: A4 landscape; margin: 8mm 10mm; }
          body { padding: 0; }
          .no-print { display: none; }
        }
      </style>
    </head><body>
      <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:14px;border-bottom:3px solid #1d4ed8;padding-bottom:8px">
        <div>
          <div style="font-size:20px;font-weight:800;color:#1d4ed8">แผนมอบหมาย AI — Agency Care</div>
          <div style="font-size:13px;color:#475569;margin-top:2px">
            ประจำเดือน: <strong>${plan.period}</strong>
            &nbsp;|&nbsp; เซลส์: <strong>${empLabel}</strong>
            &nbsp;|&nbsp; สถานะ: <strong>${plan.status}</strong>
          </div>
        </div>
        <div style="text-align:right;font-size:11px;color:#94a3b8">
          พิมพ์เมื่อ: ${todayStr}<br/>
          รวม ${printEmployee ? items.filter((i) => i.employee.id === printEmployee).length : items.length} รายการ
          &nbsp;|&nbsp; ${printEmployee ? 1 : uniqueEmployees.length} เซลส์
        </div>
      </div>
      ${bodyHtml}
      <div class="no-print" style="margin-top:20px;text-align:center">
        <button onclick="window.print()" style="padding:10px 32px;background:#1d4ed8;color:#fff;border:none;border-radius:6px;font-size:14px;cursor:pointer">🖨️ พิมพ์</button>
      </div>
    </body></html>`;

    const w = window.open('', '_blank', 'width=1100,height=800');
    if (w) {
      w.document.write(html);
      w.document.close();
      setTimeout(() => w.print(), 500);
    }
    setPrintOpen(false);
  };

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
      <Stack direction="row" spacing={1} mb={2} flexWrap="wrap" alignItems="center">
        {/* Print button — always visible when items exist */}
        {items.length > 0 && (
          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={() => { setPrintEmployee(''); setPrintOpen(true); }}
            size="small"
          >
            พิมพ์แผน
          </Button>
        )}
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

      {/* ─── Print Dialog ─── */}
      <Dialog open={printOpen} onClose={() => setPrintOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          <PrintIcon sx={{ mr: 1, verticalAlign: 'middle' }} fontSize="small" />
          พิมพ์แผนมอบหมาย — {plan.period}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <FormControl size="small" fullWidth>
              <InputLabel>เซลส์</InputLabel>
              <Select
                value={printEmployee}
                label="เซลส์"
                onChange={(e) => setPrintEmployee(e.target.value)}
              >
                <MenuItem value="">ทั้งหมด (แยกกลุ่มตามคน — {uniqueEmployees.length} คน)</MenuItem>
                {uniqueEmployees.map((e) => (
                  <MenuItem key={e.id} value={e.id}>
                    {e.name} ({e.code}) — {items.filter((i) => i.employee.id === e.id).length} Agency
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Alert severity="info" sx={{ py: 0.5, fontSize: 12 }}>
              เปิดหน้าต่างใหม่ขนาด A4 แนวนอน พร้อมตาราง Agency–เซลส์
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPrintOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" startIcon={<PrintIcon />} onClick={executePrint}>
            พิมพ์
          </Button>
        </DialogActions>
      </Dialog>

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
  const isAdmin = ['manager', 'super_admin', 'admin'].includes(user?.role ?? '');

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
