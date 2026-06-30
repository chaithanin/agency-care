import { useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, FormControl, FormControlLabel, InputLabel, LinearProgress,
  MenuItem, Paper, Select, Stack, Switch, Table, TableBody, TableCell, TableHead,
  TableRow, TextField, Tooltip, Typography, Autocomplete,
} from '@mui/material';
import { Download, Phone, SwapHoriz } from '@mui/icons-material';
import AddIcon from '@mui/icons-material/Add';
import PrintIcon from '@mui/icons-material/Print';
import { Link } from 'react-router-dom';
import { api, errMsg } from '../api/client';
import { useT } from '../i18n';
import { useAuth } from '../auth/AuthContext';
import { ExportPdfButton } from '../components/ExportPdfButton';

interface Opt { id: string; code: string; name: string; }

interface Plan {
  id: string;
  planDate: string;
  status: string;
  actionType?: string | null;
  requestDetails?: string | null;
  priority?: string;
  callConfirmResult?: string | null;
  callConfirmAt?: string | null;
  agency: { id: string; code: string; name: string; phone?: string | null };
  employee: { id: string; name: string; code: string };
  checkin?: { withinRadius: boolean; distanceMeters: number } | null;
  report?: { id: string; summary?: string | null } | null;
}

interface Suggestion {
  id: string; code: string; name: string; zone?: string | null; tier?: string;
  distanceMeters: number | null; phone?: string | null;
}

const todayStr = () => new Date().toISOString().slice(0, 10);

const statusColor: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info' | 'primary'> = {
  pending: 'warning',
  waiting_confirmation: 'info',
  confirmed: 'primary',
  rescheduled: 'default',
  on_route: 'primary',
  done: 'success',
  postponed: 'default',
  cancelled: 'error',
};

const priorityColor: Record<string, 'error' | 'warning' | 'default'> = {
  high: 'error',
  medium: 'warning',
  low: 'default',
};

export default function PlansPage() {
  const { t } = useT();
  const { user } = useAuth();
  const isManager = user?.activeRole !== 'sales';
  const tableRef = useRef<HTMLDivElement>(null);

  const ACTION_TYPES = [
    { value: 'AG Bring Customer', label: 'AG Bring Customer' },
    { value: 'Agency Sign VIP', label: 'Agency Sign VIP' },
    { value: 'Call Agency', label: 'Call Agency' },
    { value: 'Call for NEW PROJECT', label: 'Call for NEW PROJECT' },
    { value: 'Come Open house', label: 'Come Open house' },
    { value: 'Come to Party', label: 'Come to Party' },
    { value: 'Customer Registration by Agency Record', label: 'Customer Registration by Agency Record' },
    { value: 'Follow-up Deposit', label: 'Follow-up Deposit' },
    { value: 'Follow-up Holding Unit', label: 'Follow-up Holding Unit' },
    { value: 'Follow-up Reservation', label: 'Follow-up Reservation' },
    { value: 'Found New Agency', label: 'Found New Agency' },
    { value: 'Impress Villa', label: 'Impress Villa' },
    { value: 'Internal Training', label: 'Internal Training' },
    { value: 'Invitation to opening house', label: 'Invitation to opening house' },
    { value: 'Invitation to Party', label: 'Invitation to Party' },
    { value: 'Make Photo&VDO', label: 'Make Photo&VDO' },
    { value: 'Managment Internal Meeting', label: 'Managment Internal Meeting' },
    { value: 'Meet Management', label: 'Meet Management' },
    { value: 'Meeting for new Projects', label: 'Meeting for new Projects' },
    { value: 'Old Customer', label: 'Old Customer' },
    { value: 'Online Customer', label: 'Online Customer' },
    { value: 'Orientation', label: 'Orientation' },
    { value: 'Orientation New Agency Only', label: 'Orientation New Agency Only' },
    { value: 'Pick up-Drop Customer', label: 'Pick up-Drop Customer' },
    { value: 'Repeat Customer', label: 'Repeat Customer' },
    { value: 'Sale Support - Admin', label: 'Sale Support - Admin' },
    { value: 'Sales Team Morning Meetings Points', label: 'Sales Team Morning Meetings Points' },
    { value: 'Show units', label: 'Show units' },
    { value: 'Sign Agency Agreement', label: 'Sign Agency Agreement' },
    { value: 'VDO Call / Meeting', label: 'VDO Call / Meeting' },
    { value: 'Visit Agency Office', label: 'Visit Agency Office' },
    { value: 'Visit Booth', label: 'Visit Booth' },
    { value: 'Walk In Agency', label: 'Walk In Agency' },
    { value: 'Walk In Customer', label: 'Walk In Customer' },
  ];

  const CALL_RESULTS = [
    { value: 'confirmed', label: t('pl2.callConfirmed') },
    { value: 'rescheduled', label: t('pl2.callRescheduled') },
    { value: 'no_answer', label: t('pl2.callNoAnswer') },
    { value: 'cancelled', label: t('pl2.callCancelled') },
  ];

  const PRIORITIES = [
    { value: 'high', label: t('pl.priorityHigh') },
    { value: 'medium', label: t('pl.priorityMedium') },
    { value: 'low', label: t('pl.priorityLow') },
  ];

  // ─── Data ───────────────────────────────────────────────────────────────────
  const [agencies, setAgencies] = useState<Opt[]>([]);
  const [employees, setEmployees] = useState<Opt[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);

  // ─── Filters ─────────────────────────────────────────────────────────────────
  const [dateFrom, setDateFrom] = useState(todayStr());
  const [dateTo, setDateTo] = useState(todayStr());
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // ─── Create form ─────────────────────────────────────────────────────────────
  const [openAdd, setOpenAdd] = useState(false);
  const [form, setForm] = useState({
    agencyId: '', employeeId: '', date: todayStr(), note: '',
    actionType: 'AG Bring Customer', requestDetails: '', priority: 'medium',
    isRecurring: false, recurringFreq: 'monthly', recurringUntil: '',
  });
  const [agencySearch, setAgencySearch] = useState('');
  const [error, setError] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  // ─── Call Confirm ─────────────────────────────────────────────────────────
  const [callFor, setCallFor] = useState<Plan | null>(null);
  const [callResult, setCallResult] = useState('confirmed');
  const [callNote, setCallNote] = useState('');
  const [rescheduleTo, setRescheduleTo] = useState('');
  const [callLoading, setCallLoading] = useState(false);
  const [callErr, setCallErr] = useState('');

  // ─── Bulk Create ────────────────────────────────────────────────────────
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkAgencySearch, setBulkAgencySearch] = useState('');
  const [bulkSelected, setBulkSelected] = useState<string[]>([]);
  const [bulkForm, setBulkForm] = useState({ employeeId: '', date: todayStr(), actionType: 'AG Bring Customer', priority: 'medium', note: '' });
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkMsg, setBulkMsg] = useState('');

  const bulkFilteredAgencies = agencies.filter((a) => {
    if (!bulkAgencySearch) return true;
    const q = bulkAgencySearch.toLowerCase();
    return a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q);
  });

  const doBulkCreate = async () => {
    if (!bulkSelected.length || !bulkForm.employeeId || !bulkForm.date) {
      setBulkMsg('Please select Agency, sales, and date'); return;
    }
    setBulkLoading(true); setBulkMsg('');
    try {
      const { data } = await api.post('/visits/plans/bulk', { agencyIds: bulkSelected, ...bulkForm });
      setBulkMsg(`Created ${data.created} plans successfully`);
      setBulkSelected([]);
      loadPlans();
    } catch (e) { setBulkMsg(errMsg(e)); }
    finally { setBulkLoading(false); }
  };

  // ─── Smart Replacement ────────────────────────────────────────────────────
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestFor, setSuggestFor] = useState<Plan | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestPlanDate, setSuggestPlanDate] = useState('');
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const loadPlans = () => {
    setLoading(true);
    const params: Record<string, string> = { from: dateFrom, to: dateTo };
    if (filterEmployee) params.employeeId = filterEmployee;
    if (filterAction) params.actionType = filterAction;
    if (filterStatus) params.status = filterStatus;
    api.get('/visits/plans', { params })
      .then((r) => setPlans(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    api.get('/agencies').then((r) => setAgencies(r.data));
    if (isManager) api.get('/employees').then((r) => setEmployees(r.data));
  }, [isManager]);

  useEffect(() => { loadPlans(); }, [dateFrom, dateTo, filterEmployee, filterAction, filterStatus]);

  const create = async () => {
    setError('');
    if (!form.agencyId || !form.employeeId) { setError(t('pl2.selectAgencyAndSeller') || 'Please select Agency and Seller'); return; }
    if (!form.date) { setError('Please select a date'); return; }
    if (form.isRecurring && !form.recurringUntil) { setError(t('pl.recurringUntilRequired') || 'Please select recurring until date'); return; }

    setCreateLoading(true);
    try {
      await api.post('/visits/plans', {
        agencyId: form.agencyId,
        employeeId: form.employeeId,
        planDate: form.date,
        note: form.note || undefined,
        actionType: form.actionType,
        requestDetails: form.requestDetails || undefined,
        priority: form.priority,
        isRecurring: form.isRecurring,
        recurringFreq: form.isRecurring ? form.recurringFreq : undefined,
        recurringUntil: form.isRecurring ? form.recurringUntil : undefined,
      });
      setOpenAdd(false);
      setForm({ agencyId: '', employeeId: '', date: todayStr(), note: '', actionType: 'AG Bring Customer', requestDetails: '', priority: 'medium', isRecurring: false, recurringFreq: 'monthly', recurringUntil: '' });
      setAgencySearch('');
      setError('');
      loadPlans();
    } catch (e) {
      const msg = errMsg(e) || 'Failed to create plan';
      setError(msg);
      console.error('Create plan error:', e);
    } finally {
      setCreateLoading(false);
    }
  };

  // ─── Export CSV ──────────────────────────────────────────────────────────
  const exportCsv = () => {
    const headers = ['Date', 'Agency Code', 'Agency', 'Phone', 'Seller', 'Type', 'Priority', 'Details', 'Status', 'Call Result', 'Check-in', 'Report'];
    const rows = plans.map((p) => [
      p.planDate?.slice(0, 10),
      p.agency.code,
      p.agency.name,
      p.agency.phone ?? '',
      p.employee.name,
      ACTION_TYPES.find((a) => a.value === p.actionType)?.label ?? p.actionType ?? '',
      p.priority ?? 'medium',
      (p.requestDetails ?? '').replace(/,/g, ' '),
      p.status,
      p.callConfirmResult ?? '',
      p.checkin ? `${p.checkin.distanceMeters}m` : '',
      p.report ? 'Yes' : '',
    ]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `plans-${dateFrom}-to-${dateTo}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Print Dialog ────────────────────────────────────────────────────────
  const [printOpen, setPrintOpen] = useState(false);
  const now = new Date();
  const [printYear, setPrintYear] = useState(now.getFullYear());
  const [printMonth, setPrintMonth] = useState(now.getMonth() + 1);
  const [printEmployee, setPrintEmployee] = useState('');   // '' = all
  const [printLoading, setPrintLoading] = useState(false);

  const handlePrint = () => setPrintOpen(true);

  const executePrint = async () => {
    setPrintLoading(true);
    try {
      const from = `${printYear}-${String(printMonth).padStart(2, '0')}-01`;
      const lastDay = new Date(printYear, printMonth, 0).getDate();
      const to = `${printYear}-${String(printMonth).padStart(2, '0')}-${lastDay}`;
      const params: Record<string, string> = { from, to };
      if (printEmployee) params.employeeId = printEmployee;

      const { data: rows } = await api.get<Plan[]>('/visits/plans', { params });

      const THAI_MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
      const monthLabel = `${THAI_MONTHS[printMonth - 1]} ${printYear + 543}`;
      const empName = printEmployee
        ? employees.find((e) => e.id === printEmployee)?.name ?? 'Sales'
        : 'All';

      const fmtDate = (d: string) => {
        const dt = new Date(d);
        return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear() + 543}`;
      };

      const statusTH: Record<string, string> = {
        pending: 'รอ', confirmed: 'ยืนยัน', done: 'เสร็จ',
        rescheduled: 'เลื่อน', cancelled: 'ยกเลิก', postponed: 'เลื่อน',
        on_route: 'กำลังไป', waiting_confirmation: 'รอยืนยัน',
      };

      const actionTH: Record<string, string> = {
        visit: 'เยี่ยม', call: 'โทร', invite: 'เชิญ', orientation: 'ORT',
        customer: 'ลูกค้า', followup_hold: 'F/U Hold', followup_customer: 'F/U',
        delivery: 'ส่งของ', event: 'Event', launch: 'Launch', rental: 'เช่า',
      };

      // Group by employee when printing all
      const grouped: Record<string, { name: string; plans: Plan[] }> = {};
      for (const p of rows) {
        const key = p.employee.id;
        if (!grouped[key]) grouped[key] = { name: p.employee.name, plans: [] };
        grouped[key].plans.push(p);
      }

      const colStyle = 'padding:6px 8px;border:1px solid #cbd5e1;font-size:11px;';
      const hStyle = `${colStyle}background:#1e293b;color:#fff;font-weight:700;white-space:nowrap;`;

      const buildRows = (list: Plan[], showEmp: boolean) =>
        list.map((p, i) => `
          <tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'}">
            <td style="${colStyle}white-space:nowrap">${fmtDate(p.planDate)}</td>
            <td style="${colStyle}white-space:nowrap">${p.agency.code}</td>
            <td style="${colStyle}">${p.agency.name}</td>
            <td style="${colStyle}white-space:nowrap">${p.agency.phone ?? '—'}</td>
            ${showEmp ? `<td style="${colStyle}">${p.employee.name}</td>` : ''}
            <td style="${colStyle}text-align:center">${actionTH[p.actionType ?? ''] ?? p.actionType ?? '—'}</td>
            <td style="${colStyle}text-align:center">${
              p.priority === 'high' ? '🔴 สูง' : p.priority === 'medium' ? '🟡 กลาง' : '⚪ ต่ำ'
            }</td>
            <td style="${colStyle}">${p.requestDetails ?? '—'}</td>
            <td style="${colStyle}text-align:center">${statusTH[p.status] ?? p.status}</td>
            <td style="${colStyle}text-align:center">${
              p.callConfirmResult === 'confirmed' ? '✅' : p.callConfirmResult === 'cancelled' ? '❌' : p.callConfirmResult ?? '—'
            }</td>
            <td style="${colStyle}text-align:center">${p.checkin ? `${p.checkin.distanceMeters}ม.` : '—'}</td>
            <td style="${colStyle}text-align:center">${p.report ? '✓' : '—'}</td>
          </tr>`).join('');

      const buildHeader = (showEmp: boolean) => `
        <tr>
          <th style="${hStyle}">Date</th>
          <th style="${hStyle}">Code</th>
          <th style="${hStyle}">Agency</th>
          <th style="${hStyle}">Phone</th>
          ${showEmp ? `<th style="${hStyle}">Sales</th>` : ''}
          <th style="${hStyle}">Type</th>
          <th style="${hStyle}">Priority</th>
          <th style="${hStyle}">Details</th>
          <th style="${hStyle}">Status</th>
          <th style="${hStyle}">Call Confirm</th>
          <th style="${hStyle}">Check-in</th>
          <th style="${hStyle}">Report</th>
        </tr>`;

      let tableBody = '';
      if (printEmployee) {
        // Single employee — flat table
        tableBody = `
          <table style="width:100%;border-collapse:collapse;margin-top:8px">
            ${buildHeader(false)}
            ${buildRows(rows, false)}
          </table>`;
      } else {
        // All employees — grouped
        tableBody = Object.values(grouped).map(({ name, plans: empPlans }) => `
          <div style="margin-bottom:24px;page-break-inside:avoid">
            <div style="background:#3b82f6;color:#fff;padding:6px 12px;font-weight:700;font-size:13px;border-radius:4px 4px 0 0">
              👤 ${name} &nbsp;(${empPlans.length} items)
            </div>
            <table style="width:100%;border-collapse:collapse">
              ${buildHeader(false)}
              ${buildRows(empPlans, false)}
            </table>
          </div>`).join('');
      }

      const todayFmt = fmtDate(new Date().toISOString().slice(0, 10));
      const html = `<!DOCTYPE html><html><head>
        <meta charset="utf-8"/>
        <title>Visit Plan ${monthLabel} — ${empName}</title>
        <style>
          * { font-family: 'Sarabun', Arial, sans-serif; box-sizing: border-box; }
          body { margin: 0; padding: 16px 20px; color: #0f172a; }
          @media print {
            @page { size: A4 landscape; margin: 10mm 8mm; }
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head><body>
        <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:12px;border-bottom:3px solid #1d4ed8;padding-bottom:8px">
          <div>
            <div style="font-size:20px;font-weight:800;color:#1d4ed8">Agency Care Visit Plan</div>
            <div style="font-size:14px;color:#475569;margin-top:2px">Month: <strong>${monthLabel}</strong> &nbsp;|&nbsp; Sales: <strong>${empName}</strong></div>
          </div>
          <div style="text-align:right;font-size:11px;color:#94a3b8">
            Printed: ${todayFmt}<br/>Total ${rows.length} items
          </div>
        </div>
        ${tableBody}
        <div class="no-print" style="margin-top:20px;text-align:center">
          <button onclick="window.print()" style="padding:10px 32px;background:#1d4ed8;color:#fff;border:none;border-radius:6px;font-size:14px;cursor:pointer">🖨️ Print</button>
        </div>
      </body></html>`;

      const w = window.open('', '_blank', 'width=1100,height=800');
      if (w) {
        w.document.write(html);
        w.document.close();
        setTimeout(() => w.print(), 600);
      }
    } finally {
      setPrintLoading(false);
      setPrintOpen(false);
    }
  };

  // ─── Call Confirm ─────────────────────────────────────────────────────────
  const openCall = (p: Plan) => {
    setCallFor(p); setCallResult('confirmed'); setCallNote(''); setRescheduleTo(''); setCallErr('');
  };

  const submitCall = async () => {
    if (!callFor) return;
    setCallLoading(true); setCallErr('');
    try {
      await api.post(`/visits/plans/${callFor.id}/call-confirm`, {
        result: callResult,
        note: callNote || undefined,
        rescheduledTo: callResult === 'rescheduled' && rescheduleTo ? rescheduleTo : undefined,
      });
      setCallFor(null);
      loadPlans();
    } catch (e) { setCallErr(errMsg(e)); } finally { setCallLoading(false); }
  };

  // ─── Smart Replacement ────────────────────────────────────────────────────
  const openSuggestions = async (p: Plan) => {
    setSuggestFor(p); setSuggestLoading(true); setSuggestions([]);
    try {
      const { data } = await api.get(`/visits/plans/${p.id}/suggestions`);
      setSuggestions(data.suggestions ?? []);
      setSuggestPlanDate(data.planDate ?? p.planDate.slice(0, 10));
    } catch { /* ignore */ } finally { setSuggestLoading(false); }
  };

  const applyReplacement = async (agencyId: string) => {
    if (!suggestFor) return;
    setApplyingId(agencyId);
    try {
      await api.post('/visits/plans', {
        agencyId,
        employeeId: suggestFor.employee.id,
        planDate: suggestPlanDate,
        note: `${t('pl2.replaceNotePrefix')} ${suggestFor.agency.code} ${t('pl2.replaceNoteSuffix')}`,
      });
      setSuggestFor(null);
      loadPlans();
    } catch { /* ignore */ } finally { setApplyingId(null); }
  };

  const actionLabel = (type?: string | null) =>
    ACTION_TYPES.find((a) => a.value === type)?.label ?? type ?? '';

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={1}>
        <Typography variant="h5" fontWeight={700}>{t('pl2.title')}</Typography>
        <Stack direction="row" spacing={1}>
          <Tooltip title={t('pl.exportCsv')}>
            <Button size="small" variant="outlined" startIcon={<Download />} onClick={exportCsv}>
              CSV
            </Button>
          </Tooltip>
          <ExportPdfButton tableId="plans-table" filename="site-visit-plans" title="Site Visit Plans" size="small" variant="outlined" />
          <Tooltip title={t('pl.print')}>
            <Button size="small" variant="outlined" startIcon={<PrintIcon />} onClick={handlePrint}>
              {t('pl.print')}
            </Button>
          </Tooltip>
          {isManager && (
            <Button variant="outlined" color="secondary" startIcon={<AddIcon />} onClick={() => setBulkOpen(true)}>
              Add Multiple Agencies
            </Button>
          )}
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setOpenAdd(true); setError(''); }}>
            {t('pl2.add')}
          </Button>
        </Stack>
      </Stack>

      {/* ─── Filters ─── */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} flexWrap="wrap">
          <TextField size="small" type="date" label={t('pl.dateFrom')} value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField size="small" type="date" label={t('pl.dateTo')} value={dateTo}
            onChange={(e) => setDateTo(e.target.value)} InputLabelProps={{ shrink: true }} />
          {isManager && (
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>{t('c.seller')}</InputLabel>
              <Select value={filterEmployee} label={t('c.seller')} onChange={(e) => setFilterEmployee(e.target.value)}>
                <MenuItem value="">{t('pl.allSellers')}</MenuItem>
                {employees.map((e) => <MenuItem key={e.id} value={e.id}>{e.name}</MenuItem>)}
              </Select>
            </FormControl>
          )}
          <FormControl size="small" sx={{ minWidth: 170 }}>
            <InputLabel>{t('pl.actionType')}</InputLabel>
            <Select value={filterAction} label={t('pl.actionType')} onChange={(e) => setFilterAction(e.target.value)}>
              <MenuItem value="">{t('pl.allTypes')}</MenuItem>
              {ACTION_TYPES.map((a) => <MenuItem key={a.value} value={a.value}>{a.label}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>{t('c.status')}</InputLabel>
            <Select value={filterStatus} label={t('c.status')} onChange={(e) => setFilterStatus(e.target.value)}>
              <MenuItem value="">{t('pl.allStatuses')}</MenuItem>
              {['pending','confirmed','done','rescheduled','cancelled'].map((s) => (
                <MenuItem key={s} value={s}>{s}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {/* ─── Plan list ─── */}
      {loading && <LinearProgress sx={{ mb: 1 }} />}
      <Paper ref={tableRef} id="plans-table">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('pl2.date')}</TableCell>
              <TableCell>Agency</TableCell>
              <TableCell>{t('pl.phone')}</TableCell>
              {isManager && <TableCell>{t('c.seller')}</TableCell>}
              <TableCell>{t('pl.actionType')}</TableCell>
              <TableCell>{t('pl.priority')}</TableCell>
              <TableCell>{t('pl.requestDetails')}</TableCell>
              <TableCell>{t('c.status')}</TableCell>
              <TableCell>Call</TableCell>
              <TableCell>Check-in</TableCell>
              <TableCell>Report</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {plans.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={isManager ? 12 : 11} align="center" sx={{ color: 'text.secondary', py: 3 }}>
                  {t('pl2.noPlanToday')}
                </TableCell>
              </TableRow>
            )}
            {plans.map((p) => (
              <TableRow key={p.id} hover>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{p.planDate?.slice(0, 10)}</TableCell>
                <TableCell>
                  <Typography component={Link} to={`/visits/${p.id}`} variant="body2"
                    sx={{ textDecoration: 'none', color: 'inherit', '&:hover': { textDecoration: 'underline' } }}>
                    {p.agency.code} — {p.agency.name}
                  </Typography>
                </TableCell>
                <TableCell>
                  {p.agency.phone ? (
                    <Typography variant="caption" color="text.secondary">{p.agency.phone}</Typography>
                  ) : <Typography variant="caption" color="text.disabled">—</Typography>}
                </TableCell>
                {isManager && <TableCell>{p.employee.name}</TableCell>}
                <TableCell>
                  {p.actionType ? (
                    <Chip size="small" label={actionLabel(p.actionType)} variant="outlined" />
                  ) : <Typography variant="caption" color="text.disabled">—</Typography>}
                </TableCell>
                <TableCell>
                  {p.priority && (
                    <Chip size="small" label={PRIORITIES.find((x) => x.value === p.priority)?.label ?? p.priority}
                      color={priorityColor[p.priority] ?? 'default'} />
                  )}
                </TableCell>
                <TableCell sx={{ maxWidth: 180 }}>
                  {p.requestDetails ? (
                    <Tooltip title={p.requestDetails}>
                      <Typography variant="caption" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {p.requestDetails}
                      </Typography>
                    </Tooltip>
                  ) : <Typography variant="caption" color="text.disabled">—</Typography>}
                </TableCell>
                <TableCell>
                  <Chip size="small" label={p.status} color={statusColor[p.status] ?? 'default'} />
                </TableCell>
                <TableCell>
                  {p.callConfirmResult ? (
                    <Chip size="small" variant="outlined"
                      label={CALL_RESULTS.find((r) => r.value === p.callConfirmResult)?.label ?? p.callConfirmResult}
                      color={p.callConfirmResult === 'confirmed' ? 'success' : p.callConfirmResult === 'cancelled' ? 'error' : 'default'}
                    />
                  ) : <Typography variant="caption" color="text.disabled">—</Typography>}
                </TableCell>
                <TableCell>
                  {p.checkin ? `${p.checkin.distanceMeters}m` : '—'}
                </TableCell>
                <TableCell>
                  {p.report ? (
                    <Tooltip title={p.report.summary ?? ''}>
                      <Chip size="small" label="✓" color="success" />
                    </Tooltip>
                  ) : '—'}
                </TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                    {!['done', 'cancelled'].includes(p.status) && (
                      <Tooltip title={t('pl2.callTooltip')}>
                        <Button size="small" variant="outlined" startIcon={<Phone fontSize="small" />}
                          onClick={() => openCall(p)} sx={{ minWidth: 0, px: 1 }}>
                          {t('pl2.callBtn')}
                        </Button>
                      </Tooltip>
                    )}
                    {p.status === 'rescheduled' && (
                      <Tooltip title={t('pl2.replaceTooltip')}>
                        <Button size="small" color="warning" variant="outlined"
                          startIcon={<SwapHoriz fontSize="small" />}
                          onClick={() => openSuggestions(p)} sx={{ minWidth: 0, px: 1 }}>
                          {t('pl2.replaceBtn')}
                        </Button>
                      </Tooltip>
                    )}
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Box sx={{ p: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary">
            {plans.length} {t('pl.planCount')}
          </Typography>
        </Box>
      </Paper>

      {/* ─── Bulk Create Dialog ─── */}
      <Dialog open={bulkOpen} onClose={() => { setBulkOpen(false); setBulkMsg(''); setBulkSelected([]); }} maxWidth="md" fullWidth>
        <DialogTitle>Add Plans for Multiple Agencies</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            {bulkMsg && <Alert severity={bulkMsg.includes('successfully') ? 'success' : 'error'}>{bulkMsg}</Alert>}
            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
              <FormControl size="small" sx={{ flex: 1, minWidth: 180 }}>
                <InputLabel>{t('c.seller')}</InputLabel>
                <Select label={t('c.seller')} value={bulkForm.employeeId} onChange={(e) => setBulkForm({ ...bulkForm, employeeId: e.target.value })}>
                  {employees.map((e) => <MenuItem key={e.id} value={e.id}>{e.code} {e.name}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField size="small" type="date" label="Date" value={bulkForm.date}
                onChange={(e) => setBulkForm({ ...bulkForm, date: e.target.value })} InputLabelProps={{ shrink: true }} sx={{ flex: 1, minWidth: 150 }} />
              <FormControl size="small" sx={{ flex: 1, minWidth: 160 }}>
                <InputLabel>{t('pl.actionType')}</InputLabel>
                <Select label={t('pl.actionType')} value={bulkForm.actionType} onChange={(e) => setBulkForm({ ...bulkForm, actionType: e.target.value })}>
                  {ACTION_TYPES.map((a) => <MenuItem key={a.value} value={a.value}>{a.label}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ flex: 1, minWidth: 140 }}>
                <InputLabel>{t('pl.priority')}</InputLabel>
                <Select label={t('pl.priority')} value={bulkForm.priority} onChange={(e) => setBulkForm({ ...bulkForm, priority: e.target.value })}>
                  {PRIORITIES.map((p) => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
                </Select>
              </FormControl>
            </Stack>
            <Divider>Select Agencies ({bulkSelected.length} selected)</Divider>
            <TextField size="small" placeholder="Search Agency..." value={bulkAgencySearch}
              onChange={(e) => setBulkAgencySearch(e.target.value)} />
            <Paper variant="outlined" sx={{ maxHeight: 280, overflowY: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox size="small"
                        checked={bulkFilteredAgencies.length > 0 && bulkFilteredAgencies.every((a) => bulkSelected.includes(a.id))}
                        indeterminate={bulkFilteredAgencies.some((a) => bulkSelected.includes(a.id)) && !bulkFilteredAgencies.every((a) => bulkSelected.includes(a.id))}
                        onChange={(e) => {
                          if (e.target.checked) setBulkSelected((prev) => [...new Set([...prev, ...bulkFilteredAgencies.map((a) => a.id)])]);
                          else setBulkSelected((prev) => prev.filter((id) => !bulkFilteredAgencies.find((a) => a.id === id)));
                        }}
                      />
                    </TableCell>
                    <TableCell>Code</TableCell>
                    <TableCell>Name</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {bulkFilteredAgencies.map((a) => (
                    <TableRow key={a.id} hover onClick={() => setBulkSelected((prev) => prev.includes(a.id) ? prev.filter((id) => id !== a.id) : [...prev, a.id])} sx={{ cursor: 'pointer' }}>
                      <TableCell padding="checkbox"><Checkbox size="small" checked={bulkSelected.includes(a.id)} /></TableCell>
                      <TableCell>{a.code}</TableCell>
                      <TableCell>{a.name}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setBulkOpen(false); setBulkMsg(''); setBulkSelected([]); }}>Close</Button>
          <Button variant="contained" onClick={doBulkCreate} disabled={bulkLoading || !bulkSelected.length}>
            {bulkLoading ? <CircularProgress size={18} /> : `Create ${bulkSelected.length} Plans`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── Add Plan Dialog ─── */}
      <Dialog open={openAdd} onClose={() => setOpenAdd(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('pl2.add')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            {error && <Alert severity="error">{error}</Alert>}
            <Autocomplete
              size="small"
              options={agencies}
              getOptionLabel={(option) => `${option.code} — ${option.name}`}
              value={agencies.find(a => a.id === form.agencyId) || null}
              onChange={(_event, value) => setForm({ ...form, agencyId: value?.id || '' })}
              inputValue={agencySearch}
              onInputChange={(_event, value) => setAgencySearch(value)}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              renderInput={(params) => <TextField {...params} label="Agency" placeholder="Search agency..." />}
            />
            <TextField select label={t('c.seller')} value={form.employeeId}
              onChange={(e) => setForm({ ...form, employeeId: e.target.value })} size="small" fullWidth>
              {employees.map((e) => (
                <MenuItem key={e.id} value={e.id}>{e.name} ({e.code})</MenuItem>
              ))}
            </TextField>
            <Stack direction="row" spacing={2}>
              <TextField type="date" label={t('pl2.date')} value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                InputLabelProps={{ shrink: true }} size="small" fullWidth />
              <TextField select label={t('pl.priority')} value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })} size="small" fullWidth>
                {PRIORITIES.map((p) => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
              </TextField>
            </Stack>
            <TextField select label={t('pl.actionType')} value={form.actionType}
              onChange={(e) => setForm({ ...form, actionType: e.target.value })} size="small" fullWidth>
              {ACTION_TYPES.map((a) => <MenuItem key={a.value} value={a.value}>{a.label}</MenuItem>)}
            </TextField>
            <TextField label={t('pl.requestDetails')} value={form.requestDetails}
              onChange={(e) => setForm({ ...form, requestDetails: e.target.value })}
              multiline minRows={2} size="small" fullWidth placeholder={t('pl.requestDetailsHint')} />
            <TextField label={t('pl2.noteLabel')} value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              multiline minRows={1} size="small" fullWidth />

            <Divider />
            <FormControlLabel
              control={<Switch checked={form.isRecurring} onChange={(e) => setForm({ ...form, isRecurring: e.target.checked })} />}
              label={t('pl.recurring')}
            />
            {form.isRecurring && (
              <Stack direction="row" spacing={2}>
                <TextField select label={t('pl.recurringFreq')} value={form.recurringFreq}
                  onChange={(e) => setForm({ ...form, recurringFreq: e.target.value })} size="small" fullWidth>
                  <MenuItem value="weekly">{t('pl.recurringWeekly')}</MenuItem>
                  <MenuItem value="monthly">{t('pl.recurringMonthly')}</MenuItem>
                </TextField>
                <TextField type="date" label={t('pl.recurringUntil')} value={form.recurringUntil}
                  onChange={(e) => setForm({ ...form, recurringUntil: e.target.value })}
                  InputLabelProps={{ shrink: true }} size="small" fullWidth />
              </Stack>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAdd(false)} disabled={createLoading}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={create} disabled={createLoading} sx={{ position: 'relative' }}>
            {createLoading && <CircularProgress size={20} sx={{ position: 'absolute', left: 12 }} />}
            <span style={{ marginLeft: createLoading ? 28 : 0 }}>{t('pl2.add')}</span>
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── Call Confirm Dialog ─── */}
      <Dialog open={!!callFor} onClose={() => setCallFor(null)} maxWidth="xs" fullWidth>
        <DialogTitle>
          <Phone sx={{ mr: 1, verticalAlign: 'middle' }} fontSize="small" />
          {t('pl2.callDialogTitle')} — {callFor?.agency.name}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            {callErr && <Alert severity="error">{callErr}</Alert>}
            <TextField select label={t('pl2.callResultLabel')} value={callResult}
              onChange={(e) => setCallResult(e.target.value)} fullWidth>
              {CALL_RESULTS.map((r) => (
                <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>
              ))}
            </TextField>
            {callResult === 'rescheduled' && (
              <TextField type="date" label={t('pl2.newDateLabel')}
                value={rescheduleTo} onChange={(e) => setRescheduleTo(e.target.value)}
                InputLabelProps={{ shrink: true }} fullWidth />
            )}
            <TextField label={t('pl2.noteLabel')} value={callNote}
              onChange={(e) => setCallNote(e.target.value)} multiline minRows={2} fullWidth
              placeholder={t('pl2.notePlaceholder')} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCallFor(null)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={submitCall} disabled={callLoading}
            startIcon={callLoading ? <CircularProgress size={16} /> : null}>
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── Print Dialog ─── */}
      <Dialog open={printOpen} onClose={() => setPrintOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          <PrintIcon sx={{ mr: 1, verticalAlign: 'middle' }} fontSize="small" />
          Print Monthly Visit Plan
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <Stack direction="row" spacing={2}>
              <FormControl size="small" fullWidth>
                <InputLabel>Month</InputLabel>
                <Select value={printMonth} label="Month" onChange={(e) => setPrintMonth(Number(e.target.value))}>
                  {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => (
                    <MenuItem key={i + 1} value={i + 1}>{m}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                size="small" label="Year" type="number" fullWidth
                value={printYear}
                onChange={(e) => setPrintYear(Number(e.target.value))}
                inputProps={{ min: 2017, max: 2037 }}
              />
            </Stack>
            <FormControl size="small" fullWidth>
              <InputLabel>Sales</InputLabel>
              <Select value={printEmployee} label="Sales" onChange={(e) => setPrintEmployee(e.target.value)}>
                <MenuItem value="">All (grouped by person)</MenuItem>
                {employees.map((e) => (
                  <MenuItem key={e.id} value={e.id}>{e.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Alert severity="info" sx={{ py: 0.5, fontSize: 12 }}>
              A new window will open in A4 landscape format with a print button.
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPrintOpen(false)}>{t('common.cancel')}</Button>
          <Button
            variant="contained" startIcon={printLoading ? <CircularProgress size={16} /> : <PrintIcon />}
            onClick={executePrint} disabled={printLoading}
          >
            {printLoading ? 'Loading...' : 'Print'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── Smart Replacement Dialog ─── */}
      <Dialog open={!!suggestFor} onClose={() => setSuggestFor(null)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <SwapHoriz sx={{ mr: 1, verticalAlign: 'middle' }} fontSize="small" />
          {t('pl2.replaceDialogTitle')} — {suggestFor?.agency.name}
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" mb={1}>
            {t('pl2.replaceDialogDesc1')} {suggestFor?.employee.name} {t('pl2.replaceDialogDesc2')} {suggestPlanDate || suggestFor?.planDate.slice(0, 10)}
          </Typography>
          {suggestLoading && <LinearProgress />}
          {!suggestLoading && suggestions.length === 0 && (
            <Typography color="text.secondary" align="center" py={2}>{t('pl2.noReplacement')}</Typography>
          )}
          {suggestions.map((s) => (
            <Paper key={s.id} variant="outlined" sx={{ p: 1.5, mb: 1 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="body2" fontWeight={600}>{s.code} — {s.name}</Typography>
                  <Stack direction="row" spacing={1} mt={0.5}>
                    {s.zone && <Chip size="small" label={s.zone} variant="outlined" />}
                    {s.tier && <Chip size="small" label={s.tier} variant="outlined" />}
                    {s.distanceMeters != null && (
                      <Typography variant="caption" color="text.secondary">
                        {s.distanceMeters >= 1000 ? `${(s.distanceMeters / 1000).toFixed(1)} km` : `${s.distanceMeters} m`}
                      </Typography>
                    )}
                    {s.phone && <Typography variant="caption" color="text.secondary">{s.phone}</Typography>}
                  </Stack>
                </Box>
                <Button size="small" variant="contained" color="success"
                  onClick={() => applyReplacement(s.id)}
                  disabled={applyingId === s.id}
                  startIcon={applyingId === s.id ? <CircularProgress size={14} /> : null}>
                  {t('pl2.selectBtn')}
                </Button>
              </Stack>
            </Paper>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSuggestFor(null)}>{t('pl2.closeBtn')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
