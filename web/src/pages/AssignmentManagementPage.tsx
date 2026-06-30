import { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../i18n';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
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
import { PdfExportButton } from '../utils/pdf';
import { ExportPdfButton } from '../components/ExportPdfButton';

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

interface AssignmentHistory {
  id: string;
  assignedAt: string;
  agency: { id: string; code: string; name: string; zone?: string | null; province?: string | null };
  employee: { id: string; name: string; code: string };
}

interface ProposalRow {
  agencyId: string;
  agencyCode: string;
  agencyName: string;
  zone?: string;
  employeeId: string;
  employeeName: string;
  matchedZone: boolean;
}

interface SummaryRow {
  employeeId: string;
  name: string;
  code: string;
  count: number;
}

interface UnassignedAgency {
  id: string;
  code: string;
  name: string;
  zone?: string | null;
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

const MAX_PER_SALES_KEY = 'autoAssign.maxPerSales';

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
        <th style="${hStyle}">Agency Code</th>
        <th style="${hStyle}">Agency Name</th>
        <th style="${hStyle}">Agency Zone</th>
        <th style="${hStyle}">Sales Zone</th>
        <th style="${hStyle}">Notes</th>
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
          👤 ${emp?.name ?? ''} — ${emp?.code ?? ''} &nbsp;|&nbsp; Zone: ${emp?.zone ?? '—'} &nbsp;|&nbsp; ${empItems.length} Agency
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
              👤 ${emp.name} (${emp.code}) &nbsp;|&nbsp; Zone: ${emp.zone ?? '—'} &nbsp;|&nbsp; ${empItems.length} Agency
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
      : 'All';

    const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    const html = `<!DOCTYPE html><html><head>
      <meta charset="utf-8"/>
      <title>Assignment Plan ${plan.period} — ${empLabel}</title>
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
          <div style="font-size:20px;font-weight:800;color:#1d4ed8">AI Assignment Plan — Agency Care</div>
          <div style="font-size:13px;color:#475569;margin-top:2px">
            Period: <strong>${plan.period}</strong>
            &nbsp;|&nbsp; Sales: <strong>${empLabel}</strong>
            &nbsp;|&nbsp; Status: <strong>${plan.status}</strong>
          </div>
        </div>
        <div style="text-align:right;font-size:11px;color:#94a3b8">
          Printed: ${todayStr}<br/>
          Total ${printEmployee ? items.filter((i) => i.employee.id === printEmployee).length : items.length} items
          &nbsp;|&nbsp; ${printEmployee ? 1 : uniqueEmployees.length} sales
        </div>
      </div>
      ${bodyHtml}
      <div class="no-print" style="margin-top:20px;text-align:center">
        <button onclick="window.print()" style="padding:10px 32px;background:#1d4ed8;color:#fff;border:none;border-radius:6px;font-size:14px;cursor:pointer">🖨️ Print</button>
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
        {/* Export PDF button — always visible when items exist */}
        {items.length > 0 && (
          <ExportPdfButton
            tableId="plan-items-table"
            filename="assignment-plan-items"
            title={`Assignment Plan ${plan.period}`}
            size="small"
          />
        )}
        {/* Print button — always visible when items exist */}
        {items.length > 0 && (
          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={() => { setPrintEmployee(''); setPrintOpen(true); }}
            size="small"
          >
            Print Plan
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
          <Table size="small" id="plan-items-table">
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
          Print Assignment Plan — {plan.period}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <FormControl size="small" fullWidth>
              <InputLabel>Sales</InputLabel>
              <Select
                value={printEmployee}
                label="Sales"
                onChange={(e) => setPrintEmployee(e.target.value)}
              >
                <MenuItem value="">All (grouped by person — {uniqueEmployees.length} people)</MenuItem>
                {uniqueEmployees.map((e) => (
                  <MenuItem key={e.id} value={e.id}>
                    {e.name} ({e.code}) — {items.filter((i) => i.employee.id === e.id).length} Agency
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Alert severity="info" sx={{ py: 0.5, fontSize: 12 }}>
              Opens a new A4 landscape window with an Agency–Sales table
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPrintOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" startIcon={<PrintIcon />} onClick={executePrint}>
            Print
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
export default function AssignmentManagementPage() {
  const { user } = useAuth();
  const { t, lang } = useT();
  const isAdmin = ['manager', 'super_admin', 'admin'].includes(user?.role ?? '');

  // Main tab state
  const [mainTab, setMainTab] = useState(0); // 0=plans, 1=quick assign, 2=history, 3=yearly

  // ─── Tab 1: Assignment Plans (from AssignmentPlannerPage) ─────────────────────
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PlanDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);

  // ─── Tab 2: Quick Auto-Assign (from AutoAssignPage) ──────────────────────────
  const [proposal, setProposal] = useState<ProposalRow[] | null>(null);
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [autoLoading, setAutoLoading] = useState(false);
  const [autoMsg, setAutoMsg] = useState('');
  const [filterEmp, setFilterEmp] = useState<string | null>(null);
  const [maxPerSales, setMaxPerSales] = useState(() => localStorage.getItem(MAX_PER_SALES_KEY) ?? '30');
  const [unassignedAgencies, setUnassignedAgencies] = useState<UnassignedAgency[]>([]);
  const [showUnassigned, setShowUnassigned] = useState(false);
  const [proposalSearch, setProposalSearch] = useState('');
  const [proposalStatusFilter, setProposalStatusFilter] = useState('all');
  const pdfRef = useRef<HTMLDivElement>(null);

  // ─── Tab 3: Assignment History (from AutoAssignPage) ───────────────────────────
  const [history, setHistory] = useState<AssignmentHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState('');

  // ─── Tab 4: Yearly Plans (from AutoAssignPage) ──────────────────────────────────
  const [yearlyYear, setYearlyYear] = useState(() => String(new Date().getFullYear() + 1));
  const [yearlyLoading, setYearlyLoading] = useState(false);
  const [yearlyMsg, setYearlyMsg] = useState('');
  const [yearlyErr, setYearlyErr] = useState('');

  // ─── Functions for Tab 1: Assignment Plans ─────────────────────────────────────
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

  const handleRefresh = () => {
    loadPlans();
    if (selectedId) loadDetail(selectedId);
  };

  // ─── Functions for Tab 2: Quick Auto-Assign ───────────────────────────────────
  const loadHistory = () => {
    setHistoryLoading(true);
    api.get('/auto-assign/history', { params: { limit: 300 } })
      .then((r) => setHistory(r.data.assignments ?? []))
      .finally(() => setHistoryLoading(false));
  };

  const propose = async () => {
    setAutoLoading(true);
    setAutoMsg('');
    try {
      const { data } = await api.get('/auto-assign/propose', {
        params: maxPerSales ? { maxPerSales } : {},
      });
      setProposal(data.proposal);
      setSummary(data.summary);
      setUnassignedAgencies(data.unassignedAgencies ?? []);
      setShowUnassigned(false);
      setFilterEmp(null);
      setProposalSearch('');
      setProposalStatusFilter('all');
      if (data.note) setAutoMsg(data.note);
    } catch (e) {
      setAutoMsg(errMsg(e));
    } finally {
      setAutoLoading(false);
    }
  };

  const apply = async () => {
    if (!proposal) return;
    const confirmed = window.confirm(
      lang === 'th'
        ? `ยืนยันการแบ่ง Agency ${proposal.filter((p) => p.employeeId).length} ร้านให้เซลส์? การกระทำนี้จะเปลี่ยน Assignment ที่มีอยู่`
        : `Apply assignment for ${proposal.filter((p) => p.employeeId).length} agencies? This will replace existing assignments.`
    );
    if (!confirmed) return;
    setAutoLoading(true);
    setAutoMsg('');
    try {
      const assignments = proposal.map((p) => ({ agencyId: p.agencyId, employeeId: p.employeeId }));
      const { data } = await api.post('/auto-assign/apply', { assignments });
      setAutoMsg(lang === 'th' ? `ยืนยันการแบ่งแล้ว ${data.applied} ร้าน` : `Applied to ${data.applied} agencies`);
      setProposal(null);
    } catch (e) {
      setAutoMsg(errMsg(e));
    } finally {
      setAutoLoading(false);
    }
  };

  const generateYearly = async () => {
    setYearlyLoading(true); setYearlyMsg(''); setYearlyErr('');
    try {
      const { data } = await api.post('/auto-assign/yearly-plans', { year: Number(yearlyYear) });
      setYearlyMsg(`Plans created successfully: ${data.plansCreated} records from ${data.agenciesProcessed} agencies for year ${data.year}`);
    } catch (e) { setYearlyErr(errMsg(e)); }
    setYearlyLoading(false);
  };

  // Filter proposal data based on search and status filters
  const filteredProposal = useMemo(() => {
    if (!proposal) return [];
    return proposal.filter((p) => {
      // Apply employee filter (from clicking summary chips)
      if (filterEmp && p.employeeId !== filterEmp) return false;

      // Apply search filter
      if (proposalSearch) {
        const q = proposalSearch.toLowerCase();
        const matchesSearch =
          p.agencyCode.toLowerCase().includes(q) ||
          p.agencyName.toLowerCase().includes(q) ||
          p.employeeName.toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }

      // Apply status filter
      if (proposalStatusFilter === 'matched') {
        if (!p.matchedZone) return false;
      } else if (proposalStatusFilter === 'unmatched') {
        if (p.matchedZone) return false;
      }

      return true;
    });
  }, [proposal, filterEmp, proposalSearch, proposalStatusFilter]);

  // ─── Effects ──────────────────────────────────────────────────────────────────
  useEffect(() => { loadPlans(); }, []);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId]);

  useEffect(() => {
    if (mainTab === 2) loadHistory();
  }, [mainTab]);

  return (
    <Box ref={pdfRef}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Assignment Management</Typography>
          <Typography variant="body2" color="text.secondary">
            Unified Assignment Planner, Auto-Assign, & History
          </Typography>
        </Box>
        {mainTab === 0 && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setGenerateOpen(true)}
          >
            {t('aa.createNewPlan')}
          </Button>
        )}
        {mainTab === 1 && (
          <Stack direction="row" spacing={1} className="no-pdf" alignItems="center">
            <TextField
              label={t('aa.limit')}
              type="number"
              size="small"
              value={maxPerSales}
              onChange={(e) => {
                setMaxPerSales(e.target.value);
                localStorage.setItem(MAX_PER_SALES_KEY, e.target.value);
              }}
              sx={{ width: 110 }}
            />
            <Button variant="outlined" onClick={propose} disabled={autoLoading}>
              {t('aa.propose')}
            </Button>
            {proposal && (
              <Button variant="contained" color="success" onClick={apply} disabled={autoLoading}>
                {t('aa.apply')}
              </Button>
            )}
            {summary.length > 0 && <PdfExportButton targetRef={pdfRef} filename="จัดทีม-AI.pdf" />}
          </Stack>
        )}
      </Stack>

      {/* Main Tabs */}
      <Tabs value={mainTab} onChange={(_, v) => setMainTab(v)} sx={{ mb: 2 }}>
        <Tab label="Assignment Plans" />
        <Tab label="Quick Auto-Assign" />
        <Tab label="Assignment History" />
        <Tab label="Yearly Plans" />
      </Tabs>

      {/* ═══════════════════════════════════════════════════════════════════════════
          TAB 0: Assignment Plans (from AssignmentPlannerPage)
          ═══════════════════════════════════════════════════════════════════════════ */}
      <Box hidden={mainTab !== 0}>
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

      {/* ═══════════════════════════════════════════════════════════════════════════
          TAB 1: Quick Auto-Assign (from AutoAssignPage propose tab)
          ═══════════════════════════════════════════════════════════════════════════ */}
      <Box hidden={mainTab !== 1}>
        <Typography variant="body2" color="text.secondary" mb={2}>
          {lang === 'th'
            ? <>แบ่ง Agency ให้เฉพาะ <b>Sales</b> (ไม่รวม Closer) บาลานซ์ตามโซน — จำกัด {maxPerSales || '∞'} ร้าน/คน ตามกฎ Phase 5</>
            : <>Distribute agencies to <b>Sales</b> only (no Closers), balanced by zone — limit {maxPerSales || '∞'}/person (Phase 5)</>}
        </Typography>

        {autoLoading && <LinearProgress sx={{ mb: 2 }} />}
        {autoMsg && (
          <Alert severity="info" sx={{ mb: 2 }} onClose={() => setAutoMsg('')}>
            {autoMsg}
          </Alert>
        )}

        {summary.length > 0 && (
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={700} mb={1}>
              {t('aa.summary')}{' '}
              <Typography component="span" variant="caption" color="text.secondary">
                {t('aa.clickFilter')}
              </Typography>
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {summary.map((s) => (
                <Chip
                  key={s.employeeId}
                  label={`${s.name}: ${s.count}`}
                  color={filterEmp === s.employeeId ? 'primary' : 'default'}
                  variant={filterEmp === s.employeeId ? 'filled' : 'outlined'}
                  onClick={() => setFilterEmp(filterEmp === s.employeeId ? null : s.employeeId)}
                />
              ))}
              {unassignedAgencies.length > 0 && (
                <Chip
                  label={`${t('aa.unassigned')}: ${unassignedAgencies.length}`}
                  color="warning"
                  onClick={() => setShowUnassigned((v) => !v)}
                />
              )}
              {filterEmp && (
                <Chip label={t('aa.clearFilter')} color="error" variant="outlined" onClick={() => setFilterEmp(null)} />
              )}
            </Stack>
          </Paper>
        )}

        {unassignedAgencies.length > 0 && (
          <Collapse in={showUnassigned}>
            <Paper sx={{ p: 2, mb: 2, border: '1px solid', borderColor: 'warning.main' }}>
              <Typography variant="subtitle2" fontWeight={700} color="warning.dark" mb={1}>
                {t('aa.unassignedAgencies')} ({unassignedAgencies.length})
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('aa.colCode')}</TableCell>
                    <TableCell>{t('aa.colName')}</TableCell>
                    <TableCell>{t('c.zone')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {unassignedAgencies.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>{a.code}</TableCell>
                      <TableCell>{a.name}</TableCell>
                      <TableCell>{a.zone || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          </Collapse>
        )}

        {proposal && (
          <>
            <Paper sx={{ p: 2, mb: 2 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start" justifyContent="space-between">
                <Box flex={1}>
                  <Typography variant="subtitle2" fontWeight={700} mb={2}>
                    {t('aa.filter') || 'Filters'}
                  </Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start">
                    <TextField
                      size="small"
                      label="Search Agency / Sales"
                      placeholder="Code, name, or sales..."
                      value={proposalSearch}
                      onChange={(e) => setProposalSearch(e.target.value)}
                      sx={{ minWidth: 250 }}
                    />
                    <FormControl size="small" sx={{ minWidth: 150 }}>
                      <InputLabel>Zone Match</InputLabel>
                      <Select
                        value={proposalStatusFilter}
                        onChange={(e) => setProposalStatusFilter(e.target.value)}
                        label="Zone Match"
                      >
                        <MenuItem value="all">All</MenuItem>
                        <MenuItem value="matched">Matched</MenuItem>
                        <MenuItem value="unmatched">Unmatched</MenuItem>
                      </Select>
                    </FormControl>
                    {(proposalSearch || proposalStatusFilter !== 'all') && (
                      <Button
                        size="small"
                        color="error"
                        variant="outlined"
                        onClick={() => {
                          setProposalSearch('');
                          setProposalStatusFilter('all');
                        }}
                      >
                        Clear Filters
                      </Button>
                    )}
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                      {filteredProposal.length} / {proposal.length} records
                    </Typography>
                  </Stack>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <ExportPdfButton
                    tableId="proposal-table"
                    filename="assignment-proposal"
                    title="Assignment Proposal"
                    size="small"
                  />
                </Box>
              </Stack>
            </Paper>

            <Paper>
              <Table size="small" id="proposal-table">
                <TableHead>
                  <TableRow>
                    <TableCell>Agency</TableCell>
                    <TableCell>{t('c.zone')}</TableCell>
                    <TableCell>{t('aa.proposed')}</TableCell>
                    <TableCell>{t('aa.zoneMatch')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredProposal.map((p) => (
                    <TableRow key={p.agencyId}>
                      <TableCell>
                        {p.agencyCode} — {p.agencyName}
                      </TableCell>
                      <TableCell>{p.zone || '-'}</TableCell>
                      <TableCell>{p.employeeName}</TableCell>
                      <TableCell>
                        {p.matchedZone ? (
                          <Chip size="small" color="success" label={t('aa.zoneMatchLabel')} />
                        ) : (
                          <Chip size="small" label="-" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredProposal.length === 0 && proposal.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ color: 'text.secondary', py: 3 }}>
                        No records match the selected filters
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Paper>
          </>
        )}
      </Box>

      {/* ═══════════════════════════════════════════════════════════════════════════
          TAB 2: Assignment History
          ═══════════════════════════════════════════════════════════════════════════ */}
      <Box hidden={mainTab !== 2}>
        <Stack direction="row" spacing={1} mb={2} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={1} alignItems="center" flex={1}>
            <TextField size="small" label="Search Agency / Sales / Zone" value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)} sx={{ minWidth: 280 }} />
            <Typography variant="caption" color="text.secondary">
              {history.length} records
            </Typography>
          </Stack>
          {history.length > 0 && (
            <ExportPdfButton
              tableId="assignment-history-table"
              filename="assignment-history"
              title="Assignment History"
              size="small"
            />
          )}
        </Stack>
        {historyLoading && <LinearProgress sx={{ mb: 1 }} />}
        <Paper>
          <Table size="small" id="assignment-history-table">
            <TableHead>
              <TableRow>
                <TableCell>Assigned Date</TableCell>
                <TableCell>Agency</TableCell>
                <TableCell>Zone</TableCell>
                <TableCell>Province</TableCell>
                <TableCell>Sales</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {history
                .filter((h) => {
                  if (!historySearch) return true;
                  const q = historySearch.toLowerCase();
                  return (
                    h.agency.name.toLowerCase().includes(q) ||
                    h.agency.code.toLowerCase().includes(q) ||
                    h.employee.name.toLowerCase().includes(q) ||
                    (h.agency.zone ?? '').toLowerCase().includes(q)
                  );
                })
                .map((h) => (
                  <TableRow key={h.id} hover>
                    <TableCell>
                      <Typography variant="caption">{new Date(h.assignedAt).toLocaleDateString('en-GB')}</Typography>
                    </TableCell>
                    <TableCell>{h.agency.code} {h.agency.name}</TableCell>
                    <TableCell>{h.agency.zone || '-'}</TableCell>
                    <TableCell>{h.agency.province || '-'}</TableCell>
                    <TableCell>
                      <Chip size="small" label={`${h.employee.code} ${h.employee.name}`} />
                    </TableCell>
                  </TableRow>
                ))}
              {history.length === 0 && !historyLoading && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ color: 'text.secondary' }}>No history found</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>
      </Box>

      {/* ═══════════════════════════════════════════════════════════════════════════
          TAB 3: Yearly Plans
          ═══════════════════════════════════════════════════════════════════════════ */}
      <Box hidden={mainTab !== 3}>
        <Alert severity="info" sx={{ mb: 2 }}>
          Generate yearly visit plans by Agency tier: <b>Platinum</b>=12 visits, <b>Gold</b>=6 visits, <b>Silver/Bronze</b>=4 visits, <b>Standard</b>=2 visits
          — evenly distributed throughout the year, skipping Sundays automatically
        </Alert>
        <Stack direction="row" spacing={2} alignItems="center" mb={2}>
          <TextField
            label="Year (AD)"
            type="number"
            size="small"
            value={yearlyYear}
            onChange={(e) => setYearlyYear(e.target.value)}
            sx={{ width: 120 }}
          />
          <Button variant="contained" onClick={generateYearly} disabled={yearlyLoading || !yearlyYear}>
            {yearlyLoading ? 'Generating...' : `Generate Plans for ${yearlyYear}`}
          </Button>
        </Stack>
        {yearlyMsg && <Alert severity="success" sx={{ mb: 2 }}>{yearlyMsg}</Alert>}
        {yearlyErr && <Alert severity="error" sx={{ mb: 2 }}>{yearlyErr}</Alert>}
      </Box>
    </Box>
  );
}
