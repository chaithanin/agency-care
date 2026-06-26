import { useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, FormControl, FormControlLabel, InputLabel, LinearProgress,
  MenuItem, Paper, Select, Stack, Switch, Table, TableBody, TableCell, TableHead,
  TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import { Download, Phone, SwapHoriz } from '@mui/icons-material';
import AddIcon from '@mui/icons-material/Add';
import PrintIcon from '@mui/icons-material/Print';
import { Link } from 'react-router-dom';
import { api, errMsg } from '../api/client';
import { useT } from '../i18n';
import { useAuth } from '../auth/AuthContext';

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
    { value: 'visit', label: t('pl.actionVisit') },
    { value: 'call', label: t('pl.actionCall') },
    { value: 'invite', label: t('pl.actionInvite') },
    { value: 'orientation', label: t('pl.actionOrientation') },
    { value: 'customer', label: t('pl.actionCustomer') },
    { value: 'followup_hold', label: t('pl.actionFollowupHold') },
    { value: 'followup_customer', label: t('pl.actionFollowupCustomer') },
    { value: 'delivery', label: t('pl.actionDelivery') },
    { value: 'event', label: t('pl.actionEvent') },
    { value: 'launch', label: t('pl.actionLaunch') },
    { value: 'rental', label: t('pl.actionRental') },
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
    actionType: 'visit', requestDetails: '', priority: 'medium',
    isRecurring: false, recurringFreq: 'monthly', recurringUntil: '',
  });
  const [error, setError] = useState('');

  // ─── Call Confirm ─────────────────────────────────────────────────────────
  const [callFor, setCallFor] = useState<Plan | null>(null);
  const [callResult, setCallResult] = useState('confirmed');
  const [callNote, setCallNote] = useState('');
  const [rescheduleTo, setRescheduleTo] = useState('');
  const [callLoading, setCallLoading] = useState(false);
  const [callErr, setCallErr] = useState('');

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
    if (!form.agencyId || !form.employeeId) { setError(t('pl2.selectAgencyAndSeller')); return; }
    if (form.isRecurring && !form.recurringUntil) { setError(t('pl.recurringUntilRequired')); return; }
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
      setForm({ agencyId: '', employeeId: '', date: todayStr(), note: '', actionType: 'visit', requestDetails: '', priority: 'medium', isRecurring: false, recurringFreq: 'monthly', recurringUntil: '' });
      loadPlans();
    } catch (e) { setError(errMsg(e)); }
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

  // ─── Print ───────────────────────────────────────────────────────────────
  const handlePrint = () => window.print();

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
          <Tooltip title={t('pl.print')}>
            <Button size="small" variant="outlined" startIcon={<PrintIcon />} onClick={handlePrint}>
              {t('pl.print')}
            </Button>
          </Tooltip>
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
      <Paper ref={tableRef}>
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

      {/* ─── Add Plan Dialog ─── */}
      <Dialog open={openAdd} onClose={() => setOpenAdd(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('pl2.add')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField select label="Agency" value={form.agencyId}
              onChange={(e) => setForm({ ...form, agencyId: e.target.value })} size="small" fullWidth>
              {agencies.map((a) => (
                <MenuItem key={a.id} value={a.id}>{a.code} — {a.name}</MenuItem>
              ))}
            </TextField>
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
          <Button onClick={() => setOpenAdd(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={create}>{t('pl2.add')}</Button>
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
