import { useEffect, useState } from 'react';
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
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Phone, SwapHoriz } from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { api, errMsg } from '../api/client';
import { useT } from '../i18n';

interface Opt { id: string; code: string; name: string; }

interface Plan {
  id: string;
  planDate: string;
  status: string;
  callConfirmResult?: string | null;
  callConfirmAt?: string | null;
  agency: { id: string; code: string; name: string };
  employee: { name: string };
  checkin?: { withinRadius: boolean; distanceMeters: number } | null;
  report?: { id: string } | null;
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

const CALL_RESULTS = [
  { value: 'confirmed', label: 'ยืนยันนัด ✓' },
  { value: 'rescheduled', label: 'ขอเลื่อน' },
  { value: 'no_answer', label: 'โทรไม่ติด' },
  { value: 'cancelled', label: 'ยกเลิก' },
];

export default function PlansPage() {
  const { t } = useT();
  const [agencies, setAgencies] = useState<Opt[]>([]);
  const [employees, setEmployees] = useState<Opt[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [date, setDate] = useState(todayStr());
  const [form, setForm] = useState({ agencyId: '', employeeId: '', note: '' });
  const [error, setError] = useState('');

  // ─── Call Confirm dialog ──────────────────────────────────────────────────
  const [callFor, setCallFor] = useState<Plan | null>(null);
  const [callResult, setCallResult] = useState('confirmed');
  const [callNote, setCallNote] = useState('');
  const [rescheduleTo, setRescheduleTo] = useState('');
  const [callLoading, setCallLoading] = useState(false);
  const [callErr, setCallErr] = useState('');

  // ─── Smart Replacement dialog ─────────────────────────────────────────────
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestFor, setSuggestFor] = useState<Plan | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestPlanDate, setSuggestPlanDate] = useState('');
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const loadPlans = (d: string) =>
    api.get('/visits/plans', { params: { date: d } }).then((r) => setPlans(r.data));

  useEffect(() => {
    api.get('/agencies').then((r) => setAgencies(r.data));
    api.get('/employees').then((r) => setEmployees(r.data));
  }, []);
  useEffect(() => { loadPlans(date); }, [date]);

  const create = async () => {
    setError('');
    if (!form.agencyId || !form.employeeId) { setError('เลือก Agency และเซลส์'); return; }
    try {
      await api.post('/visits/plans', {
        agencyId: form.agencyId, employeeId: form.employeeId,
        planDate: date, note: form.note || undefined,
      });
      setForm({ agencyId: '', employeeId: '', note: '' });
      loadPlans(date);
    } catch (e) { setError(errMsg(e)); }
  };

  // ─── Call Confirm ─────────────────────────────────────────────────────────
  const openCall = (p: Plan) => {
    setCallFor(p);
    setCallResult('confirmed');
    setCallNote('');
    setRescheduleTo('');
    setCallErr('');
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
      loadPlans(date);
    } catch (e) { setCallErr(errMsg(e)); } finally { setCallLoading(false); }
  };

  // ─── Smart Replacement ────────────────────────────────────────────────────
  const openSuggestions = async (p: Plan) => {
    setSuggestFor(p);
    setSuggestLoading(true);
    setSuggestions([]);
    try {
      const { data } = await api.get(`/visits/plans/${p.id}/suggestions`);
      setSuggestions(data.suggestions ?? []);
      setSuggestPlanDate(data.planDate ?? p.planDate.slice(0, 10));
    } catch { /* ไม่แสดง error */ } finally { setSuggestLoading(false); }
  };

  const applyReplacement = async (agencyId: string) => {
    if (!suggestFor) return;
    setApplyingId(agencyId);
    try {
      await api.post('/visits/plans', {
        agencyId,
        employeeId: suggestFor.employee ? employees.find((e) => e.name === suggestFor.employee.name)?.id ?? '' : '',
        planDate: suggestPlanDate,
        note: `แทน ${suggestFor.agency.code} ที่เลื่อนนัด`,
      });
      setSuggestFor(null);
      loadPlans(date);
    } catch { /* ignore */ } finally { setApplyingId(null); }
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={2}>{t('pl2.title')}</Typography>

      {/* ─── Create form ─── */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
          <TextField type="date" label={t('pl2.date')} value={date}
            onChange={(e) => setDate(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField select label="Agency" value={form.agencyId}
            onChange={(e) => setForm({ ...form, agencyId: e.target.value })} sx={{ minWidth: 200 }}>
            {agencies.map((a) => (
              <MenuItem key={a.id} value={a.id}>{a.code} — {a.name}</MenuItem>
            ))}
          </TextField>
          <TextField select label={t('c.seller')} value={form.employeeId}
            onChange={(e) => setForm({ ...form, employeeId: e.target.value })} sx={{ minWidth: 180 }}>
            {employees.map((e) => (
              <MenuItem key={e.id} value={e.id}>{e.name} ({e.code})</MenuItem>
            ))}
          </TextField>
          <Button variant="contained" onClick={create}>{t('pl2.add')}</Button>
        </Stack>
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </Paper>

      {/* ─── Plan list ─── */}
      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Agency</TableCell>
              <TableCell>{t('c.seller')}</TableCell>
              <TableCell>{t('c.status')}</TableCell>
              <TableCell>Call Confirm</TableCell>
              <TableCell>Check-in</TableCell>
              <TableCell>{t('pl2.report')}</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {plans.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ color: 'text.secondary' }}>
                  ยังไม่มีแผนในวันนี้
                </TableCell>
              </TableRow>
            )}
            {plans.map((p) => (
              <TableRow key={p.id} hover>
                <TableCell>
                  <Typography component={Link} to={`/visits/${p.id}`}
                    sx={{ textDecoration: 'none', color: 'inherit', '&:hover': { textDecoration: 'underline' } }}>
                    {p.agency.code} — {p.agency.name}
                  </Typography>
                </TableCell>
                <TableCell>{p.employee.name}</TableCell>
                <TableCell>
                  <Chip size="small" label={p.status} color={statusColor[p.status] ?? 'default'} />
                </TableCell>
                <TableCell>
                  {p.callConfirmResult ? (
                    <Chip size="small" variant="outlined"
                      label={CALL_RESULTS.find((r) => r.value === p.callConfirmResult)?.label ?? p.callConfirmResult}
                      color={p.callConfirmResult === 'confirmed' ? 'success' : p.callConfirmResult === 'cancelled' ? 'error' : 'default'}
                    />
                  ) : (
                    <Typography variant="caption" color="text.secondary">-</Typography>
                  )}
                </TableCell>
                <TableCell>
                  {p.checkin ? `${p.checkin.distanceMeters} ม.` : '-'}
                </TableCell>
                <TableCell>{p.report ? '✓' : '-'}</TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                    {/* ปุ่ม Call Confirm */}
                    {!['done', 'cancelled'].includes(p.status) && (
                      <Tooltip title="บันทึกผลโทรยืนยัน">
                        <Button size="small" variant="outlined" startIcon={<Phone fontSize="small" />}
                          onClick={() => openCall(p)} sx={{ minWidth: 0, px: 1 }}>
                          โทร
                        </Button>
                      </Tooltip>
                    )}
                    {/* ปุ่ม Smart Replacement — แสดงเมื่อ rescheduled */}
                    {p.status === 'rescheduled' && (
                      <Tooltip title="หาร้านทดแทนใกล้เคียง">
                        <Button size="small" color="warning" variant="outlined"
                          startIcon={<SwapHoriz fontSize="small" />}
                          onClick={() => openSuggestions(p)} sx={{ minWidth: 0, px: 1 }}>
                          ทดแทน
                        </Button>
                      </Tooltip>
                    )}
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      {/* ─── Call Confirm Dialog ─── */}
      <Dialog open={!!callFor} onClose={() => setCallFor(null)} maxWidth="xs" fullWidth>
        <DialogTitle>
          <Phone sx={{ mr: 1, verticalAlign: 'middle' }} fontSize="small" />
          โทรยืนยันนัด — {callFor?.agency.name}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            {callErr && <Alert severity="error">{callErr}</Alert>}
            <TextField select label="ผลการโทร" value={callResult}
              onChange={(e) => setCallResult(e.target.value)} fullWidth>
              {CALL_RESULTS.map((r) => (
                <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>
              ))}
            </TextField>
            {callResult === 'rescheduled' && (
              <TextField type="date" label="วันใหม่ที่นัด"
                value={rescheduleTo} onChange={(e) => setRescheduleTo(e.target.value)}
                InputLabelProps={{ shrink: true }} fullWidth />
            )}
            <TextField label="หมายเหตุ" value={callNote}
              onChange={(e) => setCallNote(e.target.value)} multiline minRows={2} fullWidth
              placeholder="บันทึกเพิ่มเติม..." />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCallFor(null)}>ยกเลิก</Button>
          <Button variant="contained" onClick={submitCall} disabled={callLoading}
            startIcon={callLoading ? <CircularProgress size={16} /> : null}>
            บันทึก
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── Smart Replacement Dialog ─── */}
      <Dialog open={!!suggestFor} onClose={() => setSuggestFor(null)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <SwapHoriz sx={{ mr: 1, verticalAlign: 'middle' }} fontSize="small" />
          ร้านทดแทน — {suggestFor?.agency.name}
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" mb={1}>
            ร้านที่ {suggestFor?.employee.name} ดูแล และยังไม่มีแผนวันที่ {suggestPlanDate || suggestFor?.planDate.slice(0, 10)}
          </Typography>
          {suggestLoading && <LinearProgress />}
          {!suggestLoading && suggestions.length === 0 && (
            <Typography color="text.secondary" align="center" py={2}>ไม่พบร้านที่ว่าง</Typography>
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
                        {s.distanceMeters >= 1000
                          ? `${(s.distanceMeters / 1000).toFixed(1)} km`
                          : `${s.distanceMeters} ม.`}
                      </Typography>
                    )}
                    {s.phone && (
                      <Typography variant="caption" color="text.secondary">{s.phone}</Typography>
                    )}
                  </Stack>
                </Box>
                <Button size="small" variant="contained" color="success"
                  onClick={() => applyReplacement(s.id)}
                  disabled={applyingId === s.id}
                  startIcon={applyingId === s.id ? <CircularProgress size={14} /> : null}>
                  เลือก
                </Button>
              </Stack>
            </Paper>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSuggestFor(null)}>ปิด</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
