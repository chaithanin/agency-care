import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Paper,
  Slide,
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
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import HistoryIcon from '@mui/icons-material/History';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditNoteIcon from '@mui/icons-material/EditNote';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import { api, errMsg } from '../api/client';
import { useT } from '../i18n';

interface Agency {
  id: string;
  code: string;
  name: string;
  level: string;
  status: string;
  province?: string;
  zone?: string;
  address?: string;
  phone?: string;
  email?: string;
  ownerName?: string;
  managerName?: string;
  lineId?: string;
  website?: string;
  classification?: string;
  gradeQuality?: string;
  gradeRelationship?: string;
  priority?: string;
  source?: string;
  tags?: string;
  remark?: string;
  latitude?: number;
  longitude?: number;
  geocodeSource?: string | null;
  tier?: string;
  pipelineStage?: string;
  assignments: { employee: { id: string; name: string; code: string } }[];
  lastVisitDate?: string | null;
  completedVisits?: number;
}

const gradeColor = (g?: string): 'success' | 'info' | 'warning' | 'error' | 'default' => {
  if (!g) return 'default';
  const u = g.toUpperCase();
  if (u === 'S' || u === 'A') return 'success';
  if (u === 'B') return 'info';
  if (u === 'C') return 'warning';
  if (u === 'D' || u === 'F') return 'error';
  return 'default';
};

interface DupHit {
  id: string;
  code: string;
  name: string;
  phone?: string;
  province?: string;
  status: string;
}

interface TimelineEvent {
  type: string; date: string; actor?: string; icon?: string;
  description: string;
  metadata?: {
    status?: string; visitType?: string; purposes?: string[];
    summary?: string; interestLevel?: string | null; newLeads?: number;
    checkinAt?: string; duration?: number; employee?: string;
    before?: Record<string, any>; after?: Record<string, any>; changes?: string[];
  };
}

// ── Agency Timeline Dialog ─────────────────────────────────────────────────
const INTEREST_COLOR: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  high: 'success', medium: 'warning', low: 'error',
};

function TimelineDotIcon({ icon }: { icon?: string }) {
  const sx = { width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };
  if (icon === 'create') return <Box sx={{ ...sx, bgcolor: 'success.main' }}><AddCircleOutlineIcon sx={{ fontSize: 18, color: '#fff' }} /></Box>;
  if (icon === 'edit') return <Box sx={{ ...sx, bgcolor: 'primary.main' }}><EditNoteIcon sx={{ fontSize: 18, color: '#fff' }} /></Box>;
  if (icon === 'person') return <Box sx={{ ...sx, bgcolor: 'secondary.main' }}><PersonAddIcon sx={{ fontSize: 18, color: '#fff' }} /></Box>;
  return <Box sx={{ ...sx, bgcolor: 'info.main' }}><DirectionsWalkIcon sx={{ fontSize: 18, color: '#fff' }} /></Box>;
}

function AgencyTimelineDialog({ agencyId, agencyName, onClose }: { agencyId: string; agencyName: string; onClose: () => void }) {
  const { t } = useT();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    setLoading(true);
    api.get(`/agencies/${agencyId}/timeline`)
      .then((r) => setEvents(r.data.events))
      .catch((e) => setErr(errMsg(e)))
      .finally(() => setLoading(false));
  }, [agencyId]);

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" scroll="paper">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <HistoryIcon /> {t('ag.history')} — {agencyName}
      </DialogTitle>
      <DialogContent dividers>
        {loading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>}
        {err && <Alert severity="error">{err}</Alert>}
        {!loading && events.length === 0 && (
          <Typography color="text.secondary" textAlign="center" py={4}>{t('ag.noHistory')}</Typography>
        )}
        {events.map((ev, i) => (
          <Box key={i} sx={{ display: 'flex', gap: 2, mb: 2 }}>
            {/* Dot + connector */}
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <TimelineDotIcon icon={ev.icon} />
              {i < events.length - 1 && (
                <Box sx={{ width: 2, flex: 1, bgcolor: 'divider', mt: 0.5, mb: 0.5, minHeight: 24 }} />
              )}
            </Box>
            {/* Content */}
            <Box sx={{ flex: 1, pb: 1 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Typography variant="body2" fontWeight={700}>{ev.description}</Typography>
                <Typography variant="caption" color="text.disabled" sx={{ whiteSpace: 'nowrap', ml: 1 }}>
                  {fmtDate(ev.date)}
                </Typography>
              </Stack>
              {ev.actor && (
                <Typography variant="caption" color="text.secondary">{t('ag.by')} {ev.actor}</Typography>
              )}
              {ev.type === 'visit' && ev.metadata && (
                <Stack direction="row" spacing={0.5} mt={0.5} flexWrap="wrap" useFlexGap>
                  {ev.metadata.interestLevel && (
                    <Chip size="small" color={INTEREST_COLOR[ev.metadata.interestLevel] ?? 'default'}
                      label={`${t('ag.interest')}: ${ev.metadata.interestLevel}`} />
                  )}
                  {(ev.metadata.newLeads ?? 0) > 0 && (
                    <Chip size="small" color="success" label={`Lead: ${ev.metadata.newLeads}`} />
                  )}
                  {ev.metadata.duration != null && (
                    <Chip size="small" variant="outlined" label={`${ev.metadata.duration} ${t('ag.minutes')}`} />
                  )}
                  {ev.metadata.summary && (
                    <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                      {ev.metadata.summary}
                    </Typography>
                  )}
                </Stack>
              )}
              {ev.type === 'updated' && ev.metadata?.changes && (
                <Typography variant="caption" color="text.secondary">
                  {t('ag.changed')}: {ev.metadata.changes.join(', ')}
                </Typography>
              )}
              {i < events.length - 1 && <Divider sx={{ mt: 1.5 }} />}
            </Box>
          </Box>
        ))}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.close')}</Button>
      </DialogActions>
    </Dialog>
  );
}

const STAGES = ['new', 'prospect', 'onboarding', 'active', 'grade_a', 'at_risk', 'inactive'];
const TIERS = ['platinum', 'gold', 'silver', 'bronze', 'new'];

const tierColor = (t?: string) =>
  t === 'platinum' ? 'secondary' : t === 'gold' ? 'warning' : t === 'new' ? 'info' : 'default';

const emptyForm = {
  // ส่วนที่ 1 — พื้นฐาน
  code: '', name: '', type: '', level: 'C', tier: 'gold', pipelineStage: 'active', status: 'active',
  // ส่วนที่ 2 — ที่อยู่
  address: '', province: '', zone: '',
  // ส่วนที่ 3 — ผู้ติดต่อ
  ownerName: '', managerName: '', phone: '', email: '', lineId: '', website: '',
  // ส่วนที่ 4 — ข้อมูลธุรกิจ
  classification: '', gradeQuality: '', gradeRelationship: '', priority: '', source: '', tags: '',
  // ส่วนที่ 5 — พิกัด GPS
  latitude: '', longitude: '',
  // ส่วนที่ 7 — หมายเหตุ
  remark: '',
};

interface EmpOpt { id: string; code: string; name: string; }

// ── Duplicate warning ─────────────────────────────────────────────────────────
function DuplicateWarning({ hits }: { hits: DupHit[] }) {
  const { t } = useT();
  if (!hits.length) return null;
  return (
    <Alert severity="warning" icon={<WarningAmberIcon />}>
      <Typography variant="body2" fontWeight={600}>{t('ag.dupWarning')} ({hits.length} {t('ag.dupItems')}):</Typography>
      {hits.map((h) => (
        <Typography key={h.id} variant="caption" display="block">
          • {h.code} — {h.name} {h.phone ? `(${h.phone})` : ''} [{h.status}]
        </Typography>
      ))}
    </Alert>
  );
}

export default function AgenciesPage() {
  const { t } = useT();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Agency[]>([]);
  const [employees, setEmployees] = useState<EmpOpt[]>([]);
  const [open, setOpen] = useState(false);
  const [editFor, setEditFor] = useState<Agency | null>(null); // null = สร้างใหม่
  const [form, setForm] = useState({ ...emptyForm });
  const [error, setError] = useState('');
  const [dupHits, setDupHits] = useState<DupHit[]>([]);
  const dupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // assign dialog
  const [assignFor, setAssignFor] = useState<Agency | null>(null);
  const [assignEmp, setAssignEmp] = useState('');

  // GPS dialog
  const [gpsFor, setGpsFor] = useState<Agency | null>(null);
  const [gpsText, setGpsText] = useState('');
  const [gpsErr, setGpsErr] = useState('');

  // tier/stage dialog
  const [tierFor, setTierFor] = useState<Agency | null>(null);

  // timeline dialog
  const [timelineFor, setTimelineFor] = useState<Agency | null>(null);

  // bulk geocode
  const [geocoding, setGeocoding] = useState(false);
  const [geoResult, setGeoResult] = useState('');

  // ── Search / Filter ───────────────────────────────────────────────────────
  const [filterQ, setFilterQ] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [filterZone, setFilterZone] = useState('');
  const [filterSeller, setFilterSeller] = useState('');

  const clearFilters = () => { setFilterQ(''); setFilterGrade(''); setFilterZone(''); setFilterSeller(''); };
  const hasFilter = !!(filterQ || filterGrade || filterZone || filterSeller);

  // unique zones from loaded data
  const zoneOptions = useMemo(
    () => [...new Set(rows.map((r) => r.zone).filter(Boolean))].sort() as string[],
    [rows],
  );
  // unique grade values
  const gradeOptions = useMemo(
    () => [...new Set(rows.map((r) => r.gradeRelationship).filter(Boolean))].sort() as string[],
    [rows],
  );

  const filtered = useMemo(() => {
    const q = filterQ.toLowerCase().trim();
    return rows.filter((a) => {
      if (q && !a.name.toLowerCase().includes(q) && !a.code.toLowerCase().includes(q) && !(a.tags ?? '').toLowerCase().includes(q)) return false;
      if (filterGrade && a.gradeRelationship !== filterGrade) return false;
      if (filterZone && a.zone !== filterZone) return false;
      if (filterSeller && !a.assignments.some((x) => x.employee.id === filterSeller)) return false;
      return true;
    });
  }, [rows, filterQ, filterGrade, filterZone, filterSeller]);
  // ─────────────────────────────────────────────────────────────────────────

  // ── Multi-select & Bulk Plan ───────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkDate, setBulkDate] = useState('');
  const [bulkSeller, setBulkSeller] = useState('');
  const [bulkCreating, setBulkCreating] = useState(false);
  const [bulkMsg, setBulkMsg] = useState('');

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const allFilteredSelected = filtered.length > 0 && filtered.every((a) => selectedIds.has(a.id));
  const someFilteredSelected = filtered.some((a) => selectedIds.has(a.id));

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (allFilteredSelected) filtered.forEach((a) => n.delete(a.id));
      else filtered.forEach((a) => n.add(a.id));
      return n;
    });
  };

  const selectedAgencies = rows.filter((a) => selectedIds.has(a.id));

  const createBulkPlans = async () => {
    if (!bulkDate || !bulkSeller) return;
    setBulkCreating(true); setBulkMsg('');
    let ok = 0;
    for (const a of selectedAgencies) {
      try {
        await api.post('/visits/plans', { agencyId: a.id, employeeId: bulkSeller, planDate: bulkDate });
        ok++;
      } catch { /* skip individual failures */ }
    }
    setBulkMsg(`${t('ag.bulkOk')} ${ok}/${selectedAgencies.length}`);
    setBulkCreating(false);
    if (ok > 0) { setSelectedIds(new Set()); setBulkOpen(false); load(); }
  };
  // ──────────────────────────────────────────────────────────────────────────

  const load = () => api.get('/agencies').then((r) => setRows(r.data));
  useEffect(() => {
    load();
    api.get('/employees').then((r) => setEmployees(r.data));
  }, []);

  // ─── Duplicate check (debounced) ─────────────────────────────────────────
  const checkDup = useCallback((name: string, phone: string, code: string) => {
    if (dupTimer.current) clearTimeout(dupTimer.current);
    if (!name && !phone && !code) { setDupHits([]); return; }
    dupTimer.current = setTimeout(async () => {
      try {
        const params: Record<string, string> = {};
        if (name.length >= 4) params.name = name;
        if (phone) params.phone = phone;
        if (code) params.code = code;
        const { data } = await api.get('/agencies/check-duplicate', { params });
        // ถ้ากำลัง edit — ข้ามตัวเองออก
        const filtered = editFor ? data.duplicates.filter((d: DupHit) => d.id !== editFor.id) : data.duplicates;
        setDupHits(filtered);
      } catch { /* ไม่แสดง error */ }
    }, 600);
  }, [editFor]);

  // ─── Form helpers ─────────────────────────────────────────────────────────
  const setF = (key: keyof typeof emptyForm, val: string) => {
    const next = { ...form, [key]: val };
    setForm(next);
    if (key === 'name' || key === 'phone' || key === 'code') {
      checkDup(next.name, next.phone, next.code);
    }
  };

  const openCreate = () => {
    setEditFor(null);
    setForm({ ...emptyForm });
    setError('');
    setDupHits([]);
    setOpen(true);
  };

  const openEdit = (a: Agency) => {
    setEditFor(a);
    setForm({
      code: a.code ?? '', name: a.name ?? '', type: (a as any).type ?? '',
      level: a.level ?? 'C', tier: a.tier ?? 'gold',
      pipelineStage: a.pipelineStage ?? 'active', status: a.status ?? 'active',
      address: a.address ?? '', province: a.province ?? '', zone: a.zone ?? '',
      ownerName: a.ownerName ?? '', managerName: a.managerName ?? '',
      phone: a.phone ?? '', email: a.email ?? '', lineId: a.lineId ?? '', website: a.website ?? '',
      classification: a.classification ?? '', gradeQuality: a.gradeQuality ?? '',
      gradeRelationship: a.gradeRelationship ?? '', priority: a.priority ?? '',
      source: a.source ?? '', tags: a.tags ?? '',
      latitude: a.latitude != null ? String(a.latitude) : '',
      longitude: a.longitude != null ? String(a.longitude) : '',
      remark: a.remark ?? '',
    });
    setError('');
    setDupHits([]);
    setOpen(true);
  };

  const doAssign = async () => {
    if (!assignFor || !assignEmp) return;
    setError('');
    try {
      await api.post('/assignments', { agencyId: assignFor.id, employeeId: assignEmp });
      setAssignFor(null); setAssignEmp(''); load();
    } catch (e) { setError(errMsg(e)); }
  };

  const doUnassign = async (agencyId: string, employeeId: string) => {
    await api.delete('/assignments', { data: { agencyId, employeeId } });
    load();
  };

  const parseCoords = (text: string) => {
    const tr = text.trim();
    const at = tr.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    const q = tr.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
    const plain = tr.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
    const m = at || q || plain;
    if (!m) return null;
    const lat = Number(m[1]); const lng = Number(m[2]);
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return { lat, lng };
  };

  const runGeocode = async () => {
    setGeocoding(true); setGeoResult('');
    try {
      const { data } = await api.post('/agencies/geocode', null, { params: { limit: 50 } });
      setGeoResult(`${t('ag.geocodeOk')} ${data.found}/${data.processed} · ${t('ag.geocodeRemaining')} ${data.remaining} ${t('ag.geocodeShops')}`);
      load();
    } catch (e) { setGeoResult(errMsg(e)); } finally { setGeocoding(false); }
  };

  const saveGps = async () => {
    if (!gpsFor) return; setGpsErr('');
    const c = parseCoords(gpsText);
    if (!c) { setGpsErr(t('ag.gpsParseErr')); return; }
    await api.patch(`/agencies/${gpsFor.id}`, { latitude: c.lat, longitude: c.lng });
    setGpsFor(null); setGpsText(''); load();
  };

  const saveTier = async () => {
    if (!tierFor) return;
    await api.patch(`/agencies/${tierFor.id}`, { tier: tierFor.tier, pipelineStage: tierFor.pipelineStage });
    setTierFor(null); load();
  };

  const save = async () => {
    setError('');
    const payload: Record<string, any> = {
      code: form.code, name: form.name,
      type: form.type || undefined, level: form.level,
      tier: form.tier, pipelineStage: form.pipelineStage,
      province: form.province || undefined, zone: form.zone || undefined,
      address: form.address || undefined,
      ownerName: form.ownerName || undefined, managerName: form.managerName || undefined,
      phone: form.phone || undefined, email: form.email || undefined,
      lineId: form.lineId || undefined, website: form.website || undefined,
      classification: form.classification || undefined,
      gradeQuality: form.gradeQuality || undefined,
      gradeRelationship: form.gradeRelationship || undefined,
      priority: form.priority || undefined, source: form.source || undefined,
      tags: form.tags || undefined, remark: form.remark || undefined,
      latitude: form.latitude ? Number(form.latitude) : undefined,
      longitude: form.longitude ? Number(form.longitude) : undefined,
    };
    if (editFor) payload.status = form.status;
    try {
      if (editFor) {
        await api.patch(`/agencies/${editFor.id}`, payload);
      } else {
        await api.post('/agencies', payload);
      }
      setOpen(false); setForm({ ...emptyForm }); setEditFor(null); setDupHits([]); load();
    } catch (e) { setError(errMsg(e)); }
  };

  // ─── Form sections ─────────────────────────────────────────────────────────
  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <Accordion defaultExpanded disableGutters elevation={0} sx={{ '&:before': { display: 'none' }, border: '1px solid', borderColor: 'divider', borderRadius: 1, mb: 1 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: 'action.hover', borderRadius: 1 }}>
        <Typography variant="subtitle2" fontWeight={700}>{title}</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={2}>{children}</Stack>
      </AccordionDetails>
    </Accordion>
  );

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={700}>{t('page.agencies')}</Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={runGeocode} disabled={geocoding}>
            {geocoding ? t('ag.geocoding') : t('ag.geocode')}
          </Button>
          <Button variant="contained" onClick={openCreate}>{t('ag.add')}</Button>
        </Stack>
      </Stack>

      {geoResult && <Alert severity="info" sx={{ mb: 2 }} onClose={() => setGeoResult('')}>{geoResult}</Alert>}

      {/* ── Filter bar ── */}
      <Paper sx={{ p: 1.5, mb: 1.5 }}>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
          <TextField
            size="small" placeholder={t('ag.searchPh')}
            value={filterQ} onChange={(e) => setFilterQ(e.target.value)}
            sx={{ minWidth: 220 }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
              endAdornment: filterQ ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setFilterQ('')}><ClearIcon fontSize="small" /></IconButton>
                </InputAdornment>
              ) : undefined,
            }}
          />
          <TextField select size="small" label={t('ag.filterGrade')} value={filterGrade}
            onChange={(e) => setFilterGrade(e.target.value)} sx={{ minWidth: 130 }}>
            <MenuItem value="">{t('c.all')}</MenuItem>
            {gradeOptions.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
          </TextField>
          <TextField select size="small" label={t('c.zone')} value={filterZone}
            onChange={(e) => setFilterZone(e.target.value)} sx={{ minWidth: 150 }}>
            <MenuItem value="">{t('c.all')}</MenuItem>
            {zoneOptions.map((z) => <MenuItem key={z} value={z}>{z}</MenuItem>)}
          </TextField>
          <TextField select size="small" label={t('c.seller')} value={filterSeller}
            onChange={(e) => setFilterSeller(e.target.value)} sx={{ minWidth: 160 }}>
            <MenuItem value="">{t('c.all')}</MenuItem>
            {employees.map((e) => <MenuItem key={e.id} value={e.id}>{e.name}</MenuItem>)}
          </TextField>
          {hasFilter && (
            <Button size="small" variant="outlined" color="inherit" startIcon={<ClearIcon />} onClick={clearFilters}>
              {t('ag.clearFilter')}
            </Button>
          )}
          <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
            {filtered.length} / {rows.length} {t('c.agencies')}
          </Typography>
        </Stack>
      </Paper>

      <Paper sx={{ overflow: 'auto' }}>
        <Table size="small" sx={{ minWidth: 900 }}>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  size="small"
                  indeterminate={someFilteredSelected && !allFilteredSelected}
                  checked={allFilteredSelected}
                  onChange={toggleSelectAll}
                />
              </TableCell>
              <TableCell sx={{ minWidth: 90 }}>{t('c.code')}</TableCell>
              <TableCell sx={{ minWidth: 160 }}>{t('c.name')}</TableCell>
              <TableCell sx={{ minWidth: 70 }}>Grade</TableCell>
              <TableCell sx={{ minWidth: 130 }}>Tags</TableCell>
              <TableCell sx={{ minWidth: 100 }}>{t('ag.lastVisit')}</TableCell>
              <TableCell sx={{ minWidth: 150 }}>Tier / Stage</TableCell>
              <TableCell sx={{ minWidth: 100 }}>{t('c.zone')}</TableCell>
              <TableCell sx={{ minWidth: 140 }}>{t('ag.assignedSeller')}</TableCell>
              <TableCell align="right" sx={{ minWidth: 220 }}>{t('ag.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((a) => {
              const tags = (a.tags ?? '').split(',').map((s) => s.trim()).filter(Boolean);
              const isSelected = selectedIds.has(a.id);
              return (
                <TableRow key={a.id} hover selected={isSelected}>
                  <TableCell padding="checkbox">
                    <Checkbox size="small" checked={isSelected} onChange={() => toggleSelect(a.id)} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                      onClick={() => openEdit(a)}>
                      {a.code}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                      onClick={() => openEdit(a)}>
                      {a.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {a.gradeRelationship ? (
                      <Chip size="small" color={gradeColor(a.gradeRelationship)} label={a.gradeRelationship} />
                    ) : <Typography variant="caption" color="text.disabled">—</Typography>}
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.3} flexWrap="wrap" useFlexGap>
                      {tags.slice(0, 3).map((tg) => (
                        <Chip key={tg} size="small" variant="outlined" label={tg} sx={{ fontSize: 10, height: 18 }} />
                      ))}
                      {tags.length > 3 && <Typography variant="caption" color="text.secondary">+{tags.length - 3}</Typography>}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    {a.lastVisitDate ? (
                      <Tooltip title={`${a.completedVisits ?? 0} ${t('ag.visits')}`}>
                        <Stack direction="row" alignItems="center" spacing={0.4}>
                          <CalendarMonthIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
                          <Typography variant="caption">{a.lastVisitDate}</Typography>
                        </Stack>
                      </Tooltip>
                    ) : <Typography variant="caption" color="text.disabled">—</Typography>}
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5}>
                      <Chip size="small" clickable color={tierColor(a.tier)} label={a.tier ?? 'gold'}
                        onClick={() => setTierFor({ ...a })} />
                      <Chip size="small" variant="outlined" label={t('st.' + (a.pipelineStage ?? 'active'))}
                        onClick={() => setTierFor({ ...a })} />
                    </Stack>
                  </TableCell>
                  <TableCell>{a.zone || '-'}</TableCell>
                  <TableCell>
                    {a.assignments.length ? (
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                        {a.assignments.map((x) => (
                          <Chip key={x.employee.id} size="small" label={x.employee.name}
                            onDelete={() => doUnassign(a.id, x.employee.id)} />
                        ))}
                      </Stack>
                    ) : (
                      <Typography variant="caption" color="text.secondary">{t('ag.notAssigned')}</Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <Tooltip title="GPS">
                        <Chip size="small" clickable
                          color={a.latitude == null ? 'warning' : a.geocodeSource === 'google' ? 'info' : 'success'}
                          label={a.latitude == null ? 'GPS?' : '📍'}
                          onClick={() => { setGpsFor(a); setGpsText(''); setGpsErr(''); }}
                        />
                      </Tooltip>
                      <Button size="small" startIcon={<ArticleOutlinedIcon fontSize="small" />}
                        onClick={() => navigate(`/agencies/${a.id}/form`)}>
                        {t('ag.formBtn')}
                      </Button>
                      <Button size="small" startIcon={<HistoryIcon fontSize="small" />}
                        onClick={() => setTimelineFor(a)}>
                        {t('ag.history')}
                      </Button>
                      <Button size="small" onClick={() => { setAssignFor(a); setAssignEmp(''); }}>
                        {t('ag.addSeller')}
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Paper>

      {/* ── Bulk Plan Floating Bar ── */}
      <Slide direction="up" in={selectedIds.size > 0} mountOnEnter unmountOnExit>
        <Paper elevation={8} sx={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          px: 3, py: 1.5, zIndex: 1300, borderRadius: 3, minWidth: 320,
        }}>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography fontWeight={700} color="primary.main">
              ✓ {selectedIds.size} {t('ag.selected')}
            </Typography>
            <Button size="small" variant="contained" startIcon={<CalendarMonthIcon />}
              onClick={() => { setBulkDate(''); setBulkSeller(''); setBulkMsg(''); setBulkOpen(true); }}>
              {t('ag.createPlans')}
            </Button>
            <Button size="small" variant="outlined" color="inherit"
              onClick={() => setSelectedIds(new Set())}>
              {t('ag.clearSel')}
            </Button>
          </Stack>
        </Paper>
      </Slide>

      {/* ── Bulk Plan Dialog ── */}
      <Dialog open={bulkOpen} onClose={() => setBulkOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('ag.createPlans')} ({selectedAgencies.length} {t('c.agencies')})</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            {bulkMsg && <Alert severity={bulkMsg.includes('0/') ? 'error' : 'success'}>{bulkMsg}</Alert>}
            <TextField type="date" label={t('ag.planDate')} value={bulkDate}
              onChange={(e) => setBulkDate(e.target.value)}
              InputLabelProps={{ shrink: true }} size="small" />
            <TextField select label={t('c.seller')} value={bulkSeller}
              onChange={(e) => setBulkSeller(e.target.value)} size="small">
              {employees.map((e) => <MenuItem key={e.id} value={e.id}>{e.name} ({e.code})</MenuItem>)}
            </TextField>
            {bulkCreating && <LinearProgress />}
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>{t('ag.selectedList')}:</Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap mt={0.5}>
                {selectedAgencies.map((a) => (
                  <Chip key={a.id} size="small" label={`${a.code} ${a.name}`}
                    onDelete={() => toggleSelect(a.id)} />
                ))}
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={createBulkPlans}
            disabled={!bulkDate || !bulkSeller || bulkCreating}>
            {t('ag.createPlansBtn')} ({selectedAgencies.length})
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── Enhanced Agency Form Dialog ──────────────────────────────────── */}
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="md" scroll="paper">
        <DialogTitle>{editFor ? `${t('common.edit')}: ${editFor.name}` : t('ag.addTitle')}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1} mt={0.5}>
            {error && <Alert severity="error">{error}</Alert>}
            <DuplicateWarning hits={dupHits} />

            {/* ส่วนที่ 1: ข้อมูลพื้นฐาน */}
            <Section title={t('ag.sec1')}>
              <Stack direction="row" spacing={2}>
                <TextField label={t('ag.codeLabel')} value={form.code}
                  onChange={(e) => setF('code', e.target.value)} required sx={{ flex: 1 }} size="small" />
                <TextField select label={t('ag.level')} value={form.level}
                  onChange={(e) => setF('level', e.target.value)} sx={{ width: 100 }} size="small">
                  {['A', 'B', 'C', 'D'].map((l) => <MenuItem key={l} value={l}>{l}</MenuItem>)}
                </TextField>
                {editFor && (
                  <TextField select label={t('c.status')} value={form.status}
                    onChange={(e) => setF('status', e.target.value)} sx={{ width: 130 }} size="small">
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="inactive">Inactive</MenuItem>
                  </TextField>
                )}
              </Stack>
              <TextField label={t('ag.nameLabel')} value={form.name}
                onChange={(e) => setF('name', e.target.value)} required size="small" />
              <TextField label={t('ag.shopType')} value={form.type}
                onChange={(e) => setF('type', e.target.value)} size="small"
                placeholder={t('ag.shopTypePh')} />
              <Stack direction="row" spacing={2}>
                <TextField select label={t('ag.tierFreqLabel')} value={form.tier}
                  onChange={(e) => setF('tier', e.target.value)} sx={{ flex: 1 }} size="small">
                  {TIERS.map((tier) => <MenuItem key={tier} value={tier}>{tier}</MenuItem>)}
                </TextField>
                <TextField select label="Pipeline Stage" value={form.pipelineStage}
                  onChange={(e) => setF('pipelineStage', e.target.value)} sx={{ flex: 1 }} size="small">
                  {STAGES.map((s) => <MenuItem key={s} value={s}>{t('st.' + s)}</MenuItem>)}
                </TextField>
              </Stack>
            </Section>

            {/* ส่วนที่ 2: ที่อยู่ */}
            <Section title={t('ag.sec2')}>
              <TextField label={t('ag.address')} value={form.address}
                onChange={(e) => setF('address', e.target.value)} multiline minRows={2} size="small" />
              <Stack direction="row" spacing={2}>
                <TextField label={t('ag.province')} value={form.province}
                  onChange={(e) => setF('province', e.target.value)} sx={{ flex: 1 }} size="small" />
                <TextField label={t('c.zone')} value={form.zone}
                  onChange={(e) => setF('zone', e.target.value)} sx={{ flex: 1 }} size="small" />
              </Stack>
            </Section>

            {/* ส่วนที่ 3: ผู้ติดต่อ */}
            <Section title={t('ag.sec3')}>
              <Stack direction="row" spacing={2}>
                <TextField label={t('ag.owner')} value={form.ownerName}
                  onChange={(e) => setF('ownerName', e.target.value)} sx={{ flex: 1 }} size="small" />
                <TextField label={t('ag.manager')} value={form.managerName}
                  onChange={(e) => setF('managerName', e.target.value)} sx={{ flex: 1 }} size="small" />
              </Stack>
              <Stack direction="row" spacing={2}>
                <TextField label={t('c.phone')} value={form.phone}
                  onChange={(e) => setF('phone', e.target.value)} sx={{ flex: 1 }} size="small" />
                <TextField label="Email" value={form.email}
                  onChange={(e) => setF('email', e.target.value)} sx={{ flex: 1 }} size="small" />
              </Stack>
              <Stack direction="row" spacing={2}>
                <TextField label="LINE ID" value={form.lineId}
                  onChange={(e) => setF('lineId', e.target.value)} sx={{ flex: 1 }} size="small" />
                <TextField label="Website" value={form.website}
                  onChange={(e) => setF('website', e.target.value)} sx={{ flex: 1 }} size="small"
                  placeholder="https://" />
              </Stack>
            </Section>

            {/* ส่วนที่ 4: ข้อมูลธุรกิจ */}
            <Section title={t('ag.sec4')}>
              <Stack direction="row" spacing={2}>
                <TextField label="Classification" value={form.classification}
                  onChange={(e) => setF('classification', e.target.value)} sx={{ flex: 1 }} size="small" />
                <TextField label="Grade Quality" value={form.gradeQuality}
                  onChange={(e) => setF('gradeQuality', e.target.value)} sx={{ flex: 1 }} size="small" />
                <TextField label="Grade Relationship" value={form.gradeRelationship}
                  onChange={(e) => setF('gradeRelationship', e.target.value)} sx={{ flex: 1 }} size="small" />
              </Stack>
              <Stack direction="row" spacing={2}>
                <TextField label="Priority" value={form.priority}
                  onChange={(e) => setF('priority', e.target.value)} sx={{ flex: 1 }} size="small" />
                <TextField label="Source" value={form.source}
                  onChange={(e) => setF('source', e.target.value)} sx={{ flex: 1 }} size="small" />
                <TextField label="Tags" value={form.tags}
                  onChange={(e) => setF('tags', e.target.value)} sx={{ flex: 1 }} size="small" />
              </Stack>
            </Section>

            {/* ส่วนที่ 5: พิกัด GPS */}
            <Section title={t('ag.sec5')}>
              <Stack direction="row" spacing={2}>
                <TextField label="Latitude" value={form.latitude}
                  onChange={(e) => setF('latitude', e.target.value)} placeholder="13.7563"
                  sx={{ flex: 1 }} size="small" />
                <TextField label="Longitude" value={form.longitude}
                  onChange={(e) => setF('longitude', e.target.value)} placeholder="100.5018"
                  sx={{ flex: 1 }} size="small" />
              </Stack>
              <Typography variant="caption" color="text.secondary">{t('ag.gpsHint')}</Typography>
            </Section>

            {/* ส่วนที่ 6: รูปภาพ — ยังใช้ GPS dialog เดิม (ดูด้านล่าง) */}
            <Section title={t('ag.sec6')}>
              <Typography variant="caption" color="text.secondary">
                {t('ag.photoHint')}
              </Typography>
              {editFor && (editFor as any).photoFront && (
                <Box component="img" src={(editFor as any).photoFront} sx={{ maxHeight: 120, objectFit: 'contain', borderRadius: 1 }} />
              )}
            </Section>

            {/* ส่วนที่ 7: หมายเหตุ */}
            <Section title={t('ag.sec7')}>
              <TextField label={t('ag.remarkLabel')} value={form.remark}
                onChange={(e) => setF('remark', e.target.value)} multiline minRows={3} size="small"
                placeholder={t('ag.remarkPh')} />
            </Section>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={save} disabled={!form.code || !form.name}>
            {editFor ? t('common.save') : t('ag.add')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── มอบหมายเซลส์ ─── */}
      <Dialog open={!!assignFor} onClose={() => setAssignFor(null)} fullWidth maxWidth="xs">
        <DialogTitle>{t('ag.assignTitle')} — {assignFor?.name}</DialogTitle>
        <DialogContent>
          <TextField select label={t('ag.selectSeller')} value={assignEmp}
            onChange={(e) => setAssignEmp(e.target.value)} fullWidth sx={{ mt: 1 }}>
            {employees.map((e) => (
              <MenuItem key={e.id} value={e.id}>{e.name} ({e.code})</MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignFor(null)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={doAssign} disabled={!assignEmp}>{t('ag.doAssign')}</Button>
        </DialogActions>
      </Dialog>

      {/* ─── ตั้งพิกัด GPS (quick dialog) ─── */}
      <Dialog open={!!gpsFor} onClose={() => setGpsFor(null)} fullWidth maxWidth="sm">
        <DialogTitle>{t('ag.gpsTitle')} — {gpsFor?.name}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            {gpsErr && <Alert severity="error">{gpsErr}</Alert>}
            <Typography variant="body2" color="text.secondary">{t('ag.gpsHowto')}</Typography>
            <TextField label={t('ag.gpsLabel')}
              placeholder="13.7563, 100.5018  /  https://maps.google.com/...@13.75,100.50"
              value={gpsText} onChange={(e) => setGpsText(e.target.value)} multiline minRows={2} autoFocus />
            {gpsFor?.latitude != null && (
              <Typography variant="caption" color="text.secondary">
                {t('ag.current')}: {gpsFor.latitude}, {gpsFor.longitude}
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGpsFor(null)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={saveGps}>{t('ag.saveGps')}</Button>
        </DialogActions>
      </Dialog>

      {/* ─── Tier / Pipeline Stage ─── */}
      <Dialog open={!!tierFor} onClose={() => setTierFor(null)} fullWidth maxWidth="xs">
        <DialogTitle>{t('ag.tierTitle')} — {tierFor?.name}</DialogTitle>
        <DialogContent>
          {tierFor && (
            <Stack spacing={2} mt={1}>
              <TextField select label={t('ag.tierFreqLabel')} value={tierFor.tier ?? 'gold'}
                onChange={(e) => setTierFor({ ...tierFor, tier: e.target.value })}>
                {TIERS.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </TextField>
              <TextField select label="Pipeline Stage" value={tierFor.pipelineStage ?? 'active'}
                onChange={(e) => setTierFor({ ...tierFor, pipelineStage: e.target.value })}>
                {STAGES.map((s) => <MenuItem key={s} value={s}>{t('st.' + s)}</MenuItem>)}
              </TextField>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTierFor(null)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={saveTier}>{t('common.save')}</Button>
        </DialogActions>
      </Dialog>
      {/* ─── Agency Timeline ─── */}
      {timelineFor && (
        <AgencyTimelineDialog
          agencyId={timelineFor.id}
          agencyName={timelineFor.name}
          onClose={() => setTimelineFor(null)}
        />
      )}
    </Box>
  );
}
