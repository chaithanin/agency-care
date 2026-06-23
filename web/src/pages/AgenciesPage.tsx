import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
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
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import HistoryIcon from '@mui/icons-material/History';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditNoteIcon from '@mui/icons-material/EditNote';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk';
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
}

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
        <HistoryIcon /> ประวัติ — {agencyName}
      </DialogTitle>
      <DialogContent dividers>
        {loading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>}
        {err && <Alert severity="error">{err}</Alert>}
        {!loading && events.length === 0 && (
          <Typography color="text.secondary" textAlign="center" py={4}>ยังไม่มีประวัติ</Typography>
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
                <Typography variant="caption" color="text.secondary">โดย {ev.actor}</Typography>
              )}
              {ev.type === 'visit' && ev.metadata && (
                <Stack direction="row" spacing={0.5} mt={0.5} flexWrap="wrap" useFlexGap>
                  {ev.metadata.interestLevel && (
                    <Chip size="small" color={INTEREST_COLOR[ev.metadata.interestLevel] ?? 'default'}
                      label={`ความสนใจ: ${ev.metadata.interestLevel}`} />
                  )}
                  {(ev.metadata.newLeads ?? 0) > 0 && (
                    <Chip size="small" color="success" label={`Lead: ${ev.metadata.newLeads}`} />
                  )}
                  {ev.metadata.duration != null && (
                    <Chip size="small" variant="outlined" label={`${ev.metadata.duration} นาที`} />
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
                  เปลี่ยน: {ev.metadata.changes.join(', ')}
                </Typography>
              )}
              {i < events.length - 1 && <Divider sx={{ mt: 1.5 }} />}
            </Box>
          </Box>
        ))}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>ปิด</Button>
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
  if (!hits.length) return null;
  return (
    <Alert severity="warning" icon={<WarningAmberIcon />}>
      <Typography variant="body2" fontWeight={600}>พบรายการที่อาจซ้ำกัน ({hits.length} รายการ):</Typography>
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
      setGeoResult(`เติมพิกัดสำเร็จ ${data.found}/${data.processed} · เหลือไม่มีพิกัด ${data.remaining} ร้าน`);
      load();
    } catch (e) { setGeoResult(errMsg(e)); } finally { setGeocoding(false); }
  };

  const saveGps = async () => {
    if (!gpsFor) return; setGpsErr('');
    const c = parseCoords(gpsText);
    if (!c) { setGpsErr('อ่านพิกัดไม่ได้ — วาง "lat,lng" หรือลิงก์ Google Maps'); return; }
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

      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('c.code')}</TableCell>
              <TableCell>{t('c.name')}</TableCell>
              <TableCell>Tier / Stage</TableCell>
              <TableCell>{t('c.zone')}</TableCell>
              <TableCell>GPS</TableCell>
              <TableCell>{t('ag.assignedSeller')}</TableCell>
              <TableCell align="right">{t('ag.assign')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((a) => (
              <TableRow key={a.id} hover>
                <TableCell>
                  <Typography
                    variant="body2" sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                    onClick={() => openEdit(a)}
                  >
                    {a.code}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography
                    variant="body2" sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                    onClick={() => openEdit(a)}
                  >
                    {a.name}
                  </Typography>
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
                  <Chip size="small" clickable
                    color={a.latitude == null ? 'warning' : a.geocodeSource === 'google' ? 'info' : 'success'}
                    label={a.latitude == null ? t('ag.setGps') : a.geocodeSource === 'google' ? t('ag.autoCheck') : t('ag.confirmed')}
                    onClick={() => { setGpsFor(a); setGpsText(''); setGpsErr(''); }}
                  />
                </TableCell>
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
                    <Button size="small" startIcon={<HistoryIcon fontSize="small" />}
                      onClick={() => setTimelineFor(a)}>
                      ประวัติ
                    </Button>
                    <Button size="small" onClick={() => { setAssignFor(a); setAssignEmp(''); }}>
                      {t('ag.addSeller')}
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      {/* ─── Enhanced Agency Form Dialog ──────────────────────────────────── */}
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="md" scroll="paper">
        <DialogTitle>{editFor ? `แก้ไข: ${editFor.name}` : t('ag.addTitle')}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1} mt={0.5}>
            {error && <Alert severity="error">{error}</Alert>}
            <DuplicateWarning hits={dupHits} />

            {/* ส่วนที่ 1: ข้อมูลพื้นฐาน */}
            <Section title="1 · ข้อมูลพื้นฐาน">
              <Stack direction="row" spacing={2}>
                <TextField label={t('ag.codeLabel')} value={form.code}
                  onChange={(e) => setF('code', e.target.value)} required sx={{ flex: 1 }} size="small" />
                <TextField select label={t('ag.level')} value={form.level}
                  onChange={(e) => setF('level', e.target.value)} sx={{ width: 100 }} size="small">
                  {['A', 'B', 'C', 'D'].map((l) => <MenuItem key={l} value={l}>{l}</MenuItem>)}
                </TextField>
                {editFor && (
                  <TextField select label="สถานะ" value={form.status}
                    onChange={(e) => setF('status', e.target.value)} sx={{ width: 130 }} size="small">
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="inactive">Inactive</MenuItem>
                  </TextField>
                )}
              </Stack>
              <TextField label={t('ag.nameLabel')} value={form.name}
                onChange={(e) => setF('name', e.target.value)} required size="small" />
              <TextField label="ประเภทร้าน" value={form.type}
                onChange={(e) => setF('type', e.target.value)} size="small"
                placeholder="เช่น Freelance, Office, Retail" />
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
            <Section title="2 · ที่อยู่และพื้นที่">
              <TextField label="ที่อยู่ (เลขที่/ถนน/ซอย)" value={form.address}
                onChange={(e) => setF('address', e.target.value)} multiline minRows={2} size="small" />
              <Stack direction="row" spacing={2}>
                <TextField label={t('ag.province')} value={form.province}
                  onChange={(e) => setF('province', e.target.value)} sx={{ flex: 1 }} size="small" />
                <TextField label={t('c.zone')} value={form.zone}
                  onChange={(e) => setF('zone', e.target.value)} sx={{ flex: 1 }} size="small" />
              </Stack>
            </Section>

            {/* ส่วนที่ 3: ผู้ติดต่อ */}
            <Section title="3 · ผู้ติดต่อ">
              <Stack direction="row" spacing={2}>
                <TextField label="เจ้าของ (Owner)" value={form.ownerName}
                  onChange={(e) => setF('ownerName', e.target.value)} sx={{ flex: 1 }} size="small" />
                <TextField label="ผู้จัดการ (Manager)" value={form.managerName}
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
            <Section title="4 · ข้อมูลธุรกิจ">
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
            <Section title="5 · พิกัด GPS">
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
            <Section title="6 · รูปภาพ">
              <Typography variant="caption" color="text.secondary">
                รูปหน้าร้าน/ป้าย/ภายใน — อัปโหลดจากหน้า Visit Detail (ตอน check-in)
              </Typography>
              {editFor && (editFor as any).photoFront && (
                <Box component="img" src={(editFor as any).photoFront} sx={{ maxHeight: 120, objectFit: 'contain', borderRadius: 1 }} />
              )}
            </Section>

            {/* ส่วนที่ 7: หมายเหตุ */}
            <Section title="7 · หมายเหตุ">
              <TextField label="หมายเหตุ (ภายใน)" value={form.remark}
                onChange={(e) => setF('remark', e.target.value)} multiline minRows={3} size="small"
                placeholder="บันทึกข้อมูลเพิ่มเติม ประวัติ ข้อสังเกต..." />
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
