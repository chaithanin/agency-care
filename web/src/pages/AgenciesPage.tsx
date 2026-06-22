import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
  MenuItem,
  Chip,
  Alert,
} from '@mui/material';
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
  latitude?: number;
  longitude?: number;
  geocodeSource?: string | null;
  tier?: string;
  pipelineStage?: string;
  assignments: { employee: { id: string; name: string; code: string } }[];
}

const STAGES = ['new', 'prospect', 'onboarding', 'active', 'grade_a', 'at_risk', 'inactive'];
const STAGE_LABEL: Record<string, string> = {
  new: 'ใหม่', prospect: 'Prospect', onboarding: 'Onboarding', active: 'Active',
  grade_a: 'Grade A', at_risk: 'เสี่ยงหลุด', inactive: 'ไม่เคลื่อนไหว',
};
const tierColor = (t?: string) =>
  t === 'platinum' ? 'secondary' : t === 'gold' ? 'warning' : t === 'new' ? 'info' : 'default';

const empty = {
  code: '',
  name: '',
  level: 'C',
  province: '',
  zone: '',
  phone: '',
  latitude: '',
  longitude: '',
};

interface EmpOpt {
  id: string;
  code: string;
  name: string;
}

export default function AgenciesPage() {
  const { t } = useT();
  const [rows, setRows] = useState<Agency[]>([]);
  const [employees, setEmployees] = useState<EmpOpt[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...empty });
  const [error, setError] = useState('');

  // assign dialog
  const [assignFor, setAssignFor] = useState<Agency | null>(null);
  const [assignEmp, setAssignEmp] = useState('');

  // GPS dialog
  const [gpsFor, setGpsFor] = useState<Agency | null>(null);
  const [gpsText, setGpsText] = useState('');
  const [gpsErr, setGpsErr] = useState('');

  // tier/stage dialog (Phase 7)
  const [tierFor, setTierFor] = useState<Agency | null>(null);

  // bulk geocode
  const [geocoding, setGeocoding] = useState(false);
  const [geoResult, setGeoResult] = useState('');

  const load = () => api.get('/agencies').then((r) => setRows(r.data));
  useEffect(() => {
    load();
    api.get('/employees').then((r) => setEmployees(r.data));
  }, []);

  const doAssign = async () => {
    if (!assignFor || !assignEmp) return;
    setError('');
    try {
      await api.post('/assignments', { agencyId: assignFor.id, employeeId: assignEmp });
      setAssignFor(null);
      setAssignEmp('');
      load();
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const doUnassign = async (agencyId: string, employeeId: string) => {
    await api.delete('/assignments', { data: { agencyId, employeeId } });
    load();
  };

  // แยกพิกัดจากข้อความ: รองรับ "13.75,100.50" หรือ ลิงก์ Google Maps (เอา @lat,lng หรือ q=lat,lng หรือเลขคู่แรก)
  const parseCoords = (text: string): { lat: number; lng: number } | null => {
    const t = text.trim();
    const at = t.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/); // .../@13.75,100.50,17z
    const q = t.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/); // ?q=13.75,100.50
    const plain = t.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/); // 13.75, 100.50
    const m = at || q || plain;
    if (!m) return null;
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return { lat, lng };
  };

  const runGeocode = async () => {
    setGeocoding(true);
    setGeoResult('');
    try {
      const { data } = await api.post('/agencies/geocode', null, { params: { limit: 50 } });
      setGeoResult(
        `เติมพิกัดสำเร็จ ${data.found}/${data.processed} · เหลือไม่มีพิกัด ${data.remaining} ร้าน`,
      );
      load();
    } catch (e) {
      setGeoResult(errMsg(e));
    } finally {
      setGeocoding(false);
    }
  };

  const saveGps = async () => {
    if (!gpsFor) return;
    setGpsErr('');
    const c = parseCoords(gpsText);
    if (!c) {
      setGpsErr('อ่านพิกัดไม่ได้ — วาง "lat,lng" หรือลิงก์ Google Maps');
      return;
    }
    await api.patch(`/agencies/${gpsFor.id}`, { latitude: c.lat, longitude: c.lng });
    setGpsFor(null);
    setGpsText('');
    load();
  };

  const saveTier = async () => {
    if (!tierFor) return;
    await api.patch(`/agencies/${tierFor.id}`, { tier: tierFor.tier, pipelineStage: tierFor.pipelineStage });
    setTierFor(null);
    load();
  };

  const save = async () => {
    setError('');
    try {
      await api.post('/agencies', {
        code: form.code,
        name: form.name,
        level: form.level,
        province: form.province || undefined,
        zone: form.zone || undefined,
        phone: form.phone || undefined,
        latitude: form.latitude ? Number(form.latitude) : undefined,
        longitude: form.longitude ? Number(form.longitude) : undefined,
      });
      setOpen(false);
      setForm({ ...empty });
      load();
    } catch (e) {
      setError(errMsg(e));
    }
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={700}>
          {t('page.agencies')}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={runGeocode} disabled={geocoding}>
            {geocoding ? t('ag.geocoding') : t('ag.geocode')}
          </Button>
          <Button variant="contained" onClick={() => setOpen(true)}>
            {t('ag.add')}
          </Button>
        </Stack>
      </Stack>

      {geoResult && (
        <Alert severity="info" sx={{ mb: 2 }} onClose={() => setGeoResult('')}>
          {geoResult}
        </Alert>
      )}

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
              <TableRow key={a.id}>
                <TableCell>{a.code}</TableCell>
                <TableCell>{a.name}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5}>
                    <Chip size="small" clickable color={tierColor(a.tier)} label={a.tier ?? 'gold'}
                      onClick={() => setTierFor({ ...a })} />
                    <Chip size="small" variant="outlined" label={STAGE_LABEL[a.pipelineStage ?? 'active']}
                      onClick={() => setTierFor({ ...a })} />
                  </Stack>
                </TableCell>
                <TableCell>{a.zone || '-'}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    clickable
                    color={
                      a.latitude == null
                        ? 'warning'
                        : a.geocodeSource === 'google'
                          ? 'info'
                          : 'success'
                    }
                    label={
                      a.latitude == null
                        ? t('ag.setGps')
                        : a.geocodeSource === 'google'
                          ? t('ag.autoCheck')
                          : t('ag.confirmed')
                    }
                    onClick={() => {
                      setGpsFor(a);
                      setGpsText('');
                      setGpsErr('');
                    }}
                  />
                </TableCell>
                <TableCell>
                  {a.assignments.length ? (
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                      {a.assignments.map((x) => (
                        <Chip
                          key={x.employee.id}
                          size="small"
                          label={x.employee.name}
                          onDelete={() => doUnassign(a.id, x.employee.id)}
                        />
                      ))}
                    </Stack>
                  ) : (
                    <Typography variant="caption" color="text.secondary">
                      {t('ag.notAssigned')}
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="right">
                  <Button
                    size="small"
                    onClick={() => {
                      setAssignFor(a);
                      setAssignEmp('');
                    }}
                  >
                    {t('ag.addSeller')}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>เพิ่ม Agency</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            {error && <Alert severity="error">{error}</Alert>}
            <Stack direction="row" spacing={2}>
              <TextField
                label="รหัส Agency"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                required
                sx={{ flex: 1 }}
              />
              <TextField
                select
                label="ระดับ"
                value={form.level}
                onChange={(e) => setForm({ ...form, level: e.target.value })}
                sx={{ width: 120 }}
              >
                {['A', 'B', 'C', 'D'].map((l) => (
                  <MenuItem key={l} value={l}>
                    {l}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
            <TextField
              label="ชื่อ Agency"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="จังหวัด"
                value={form.province}
                onChange={(e) => setForm({ ...form, province: e.target.value })}
                sx={{ flex: 1 }}
              />
              <TextField
                label="โซน"
                value={form.zone}
                onChange={(e) => setForm({ ...form, zone: e.target.value })}
                sx={{ flex: 1 }}
              />
            </Stack>
            <TextField
              label="เบอร์โทร"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="Latitude"
                value={form.latitude}
                onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                placeholder="13.7563"
                sx={{ flex: 1 }}
              />
              <TextField
                label="Longitude"
                value={form.longitude}
                onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                placeholder="100.5018"
                sx={{ flex: 1 }}
              />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              พิกัด GPS ใช้ตรวจสอบตอนเซลส์ check-in (ต้องอยู่ในรัศมีที่กำหนด)
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>ยกเลิก</Button>
          <Button variant="contained" onClick={save}>
            บันทึก
          </Button>
        </DialogActions>
      </Dialog>

      {/* ---- มอบหมายเซลส์ ---- */}
      <Dialog open={!!assignFor} onClose={() => setAssignFor(null)} fullWidth maxWidth="xs">
        <DialogTitle>มอบหมายเซลส์ — {assignFor?.name}</DialogTitle>
        <DialogContent>
          <TextField
            select
            label="เลือกเซลส์"
            value={assignEmp}
            onChange={(e) => setAssignEmp(e.target.value)}
            fullWidth
            sx={{ mt: 1 }}
          >
            {employees.map((e) => (
              <MenuItem key={e.id} value={e.id}>
                {e.name} ({e.code})
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignFor(null)}>ยกเลิก</Button>
          <Button variant="contained" onClick={doAssign} disabled={!assignEmp}>
            มอบหมาย
          </Button>
        </DialogActions>
      </Dialog>

      {/* ---- ตั้งพิกัด GPS ---- */}
      <Dialog open={!!gpsFor} onClose={() => setGpsFor(null)} fullWidth maxWidth="sm">
        <DialogTitle>ตั้งพิกัด GPS — {gpsFor?.name}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            {gpsErr && <Alert severity="error">{gpsErr}</Alert>}
            <Typography variant="body2" color="text.secondary">
              เปิด Google Maps → หาที่ตั้งร้าน → คลิกขวา "คัดลอกพิกัด" หรือคัดลอกลิงก์ แล้ววางที่นี่
            </Typography>
            <TextField
              label="พิกัด หรือ ลิงก์ Google Maps"
              placeholder="13.7563, 100.5018  หรือ  https://maps.google.com/...@13.75,100.50"
              value={gpsText}
              onChange={(e) => setGpsText(e.target.value)}
              multiline
              minRows={2}
              autoFocus
            />
            {gpsFor?.latitude != null && (
              <Typography variant="caption" color="text.secondary">
                ปัจจุบัน: {gpsFor.latitude}, {gpsFor.longitude}
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGpsFor(null)}>ยกเลิก</Button>
          <Button variant="contained" onClick={saveGps}>
            บันทึกพิกัด
          </Button>
        </DialogActions>
      </Dialog>

      {/* ---- Tier / Pipeline Stage (Phase 7) ---- */}
      <Dialog open={!!tierFor} onClose={() => setTierFor(null)} fullWidth maxWidth="xs">
        <DialogTitle>Tier / Stage — {tierFor?.name}</DialogTitle>
        <DialogContent>
          {tierFor && (
            <Stack spacing={2} mt={1}>
              <TextField select label="Tier (ความถี่เยี่ยม/เดือน)" value={tierFor.tier ?? 'gold'}
                onChange={(e) => setTierFor({ ...tierFor, tier: e.target.value })}>
                <MenuItem value="platinum">Platinum — 4 ครั้ง/เดือน</MenuItem>
                <MenuItem value="gold">Gold — 2 ครั้ง/เดือน</MenuItem>
                <MenuItem value="silver">Silver — 1 ครั้ง/เดือน</MenuItem>
                <MenuItem value="bronze">Bronze — 1 ครั้ง/2 เดือน</MenuItem>
                <MenuItem value="new">New — 2 ครั้ง/เดือน</MenuItem>
              </TextField>
              <TextField select label="Pipeline Stage" value={tierFor.pipelineStage ?? 'active'}
                onChange={(e) => setTierFor({ ...tierFor, pipelineStage: e.target.value })}>
                {STAGES.map((s) => <MenuItem key={s} value={s}>{STAGE_LABEL[s]}</MenuItem>)}
              </TextField>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTierFor(null)}>ยกเลิก</Button>
          <Button variant="contained" onClick={saveTier}>บันทึก</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
