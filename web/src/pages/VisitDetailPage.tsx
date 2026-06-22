import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Stack,
  Chip,
  Alert,
  CircularProgress,
  Divider,
  TextField,
  FormGroup,
  FormControlLabel,
  Checkbox,
  ImageList,
  ImageListItem,
  Link as MuiLink,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import LogoutIcon from '@mui/icons-material/Logout';
import AddTaskIcon from '@mui/icons-material/AddTask';
import { useParams } from 'react-router-dom';
import { api, errMsg } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import VisitActivities from './VisitActivities';

interface Photo { id: string; url: string; phase: string }
interface Checkin {
  id: string;
  checkinAt: string;
  checkOutAt?: string | null;
  durationMinutes?: number | null;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  gpsStatus: string;
  isMockGps?: boolean;
  contactName?: string | null;
  contactPosition?: string | null;
  contactPhone?: string | null;
  photos: Photo[];
}
interface Report { purposes: string[]; summary?: string; problems?: string; actionPlan?: string }
interface WorkPhoto { id: string; url: string; caption?: string | null }
interface Plan {
  id: string;
  status: string;
  note?: string;
  agency: { code: string; name: string; latitude?: number; longitude?: number; phone?: string };
  employee: { name: string };
  checkin?: Checkin | null;
  report?: Report | null;
  workPhotos?: WorkPhoto[];
}
interface FollowUp { id: string; title: string; detail?: string; dueDate?: string; status: string }

const PURPOSES = [
  { key: 'visit', label: 'เยี่ยมความสัมพันธ์' },
  { key: 'new_project', label: 'แนะนำโครงการใหม่' },
  { key: 'give_material', label: 'แจกสื่อการตลาด' },
  { key: 'training', label: 'ฝึกอบรม' },
  { key: 'install_posm', label: 'ติดตั้งสื่อ' },
  { key: 'follow_sales', label: 'ติดตามยอดขาย' },
  { key: 'solve_problem', label: 'แก้ไขปัญหา' },
];
const PHOTO_CATS = [
  { key: 'office', label: 'หน้าออฟฟิศ' },
  { key: 'activity', label: 'กิจกรรม' },
  { key: 'material', label: 'สื่อที่ติดตั้ง' },
  { key: 'selfie', label: 'Selfie คู่ผู้ดูแล' },
] as const;

// ใส่ลายน้ำ (วันเวลา/พิกัด/เซลส์/agency) ลงรูปก่อนอัปโหลด
async function watermark(file: File, lines: string[]): Promise<Blob> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / img.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const fs = Math.max(13, canvas.width / 42);
  const lh = fs * 1.35;
  const boxH = lines.length * lh + 10;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, canvas.height - boxH, canvas.width, boxH);
  ctx.fillStyle = '#fff';
  ctx.font = `${fs}px sans-serif`;
  ctx.textBaseline = 'top';
  lines.forEach((t, i) => ctx.fillText(t, 8, canvas.height - boxH + 5 + i * lh));
  return new Promise((res) => canvas.toBlob((b) => res(b ?? file), 'image/jpeg', 0.85));
}

const gpsChip = (s: string) =>
  s === 'in_area'
    ? { color: 'success' as const, label: '🟢 อยู่ในพื้นที่' }
    : s === 'near'
      ? { color: 'warning' as const, label: '🟡 ใกล้เคียง' }
      : { color: 'error' as const, label: '🔴 นอกพื้นที่' };

export default function VisitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const isSales = user?.role === 'sales';
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // เลื่อนนัด
  const [rsOpen, setRsOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [newDate, setNewDate] = useState('');
  // อัปโหลดรูปการทำงาน
  const workRef = useRef<HTMLInputElement>(null);
  const [uploadingWork, setUploadingWork] = useState(false);

  const load = () => api.get(`/visits/plans/${id}`).then((r) => setPlan(r.data));
  useEffect(() => {
    load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const checkin = () => {
    setError('');
    if (!navigator.geolocation) return setError('อุปกรณ์ไม่รองรับ GPS');
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await api.post(`/visits/plans/${id}/checkin`, {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
          await load();
        } catch (e) {
          setError(errMsg(e));
        } finally {
          setBusy(false);
        }
      },
      (err) => {
        setError(`อ่านตำแหน่งไม่สำเร็จ: ${err.message}`);
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const doReschedule = async () => {
    if (!reason.trim()) return;
    setError('');
    try {
      await api.post(`/visits/plans/${id}/reschedule`, { reason, newDate: newDate || undefined });
      setRsOpen(false); setReason(''); setNewDate('');
      await load();
    } catch (e) { setError(errMsg(e)); }
  };

  const onWorkPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(''); setUploadingWork(true);
    try {
      const loc = await new Promise<GeolocationCoordinates | null>((res) => {
        if (!navigator.geolocation) return res(null);
        navigator.geolocation.getCurrentPosition((p) => res(p.coords), () => res(null), { timeout: 8000 });
      });
      const fd = new FormData();
      fd.append('photo', file);
      if (loc) { fd.append('latitude', String(loc.latitude)); fd.append('longitude', String(loc.longitude)); }
      await api.post(`/visits/plans/${id}/work-photos`, fd);
      await load();
    } catch (e) { setError(errMsg(e)); } finally { setUploadingWork(false); }
  };

  if (!plan) return <CircularProgress />;

  return (
    <Box>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>{plan.agency.name}</Typography>
        <Typography variant="body2" color="text.secondary">
          {plan.agency.code} · เซลส์: {plan.employee.name}
        </Typography>
        {plan.agency.phone && <Typography variant="body2">โทร: {plan.agency.phone}</Typography>}
        <Stack direction="row" spacing={1} mt={1}>
          <Chip size="small" label={`สถานะ: ${plan.status}`} />
          {plan.agency.latitude != null ? (
            <Chip size="small" color="success" clickable component="a"
              href={`https://www.google.com/maps/search/?api=1&query=${plan.agency.latitude},${plan.agency.longitude}`}
              target="_blank" label="เปิดแผนที่" />
          ) : (
            <Chip size="small" color="warning" label="Agency ยังไม่ตั้งพิกัด" />
          )}
        </Stack>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {!plan.checkin ? (
        isSales ? (
          <Paper sx={{ p: 3, mb: 2, textAlign: 'center' }}>
            <Typography variant="h6" mb={1}>เริ่มเข้าเยี่ยม</Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>
              ตรวจ GPS (≤100m ผ่าน · ≤300m แจ้งเตือน · เกิน 300m ไม่อนุญาต)
            </Typography>
            <Button variant="contained" size="large" fullWidth disabled={busy}
              startIcon={busy ? <CircularProgress size={20} color="inherit" /> : <MyLocationIcon />}
              onClick={checkin}>
              {busy ? 'กำลังอ่านตำแหน่ง...' : 'Check-in ที่นี่'}
            </Button>
            <Button variant="text" color="warning" startIcon={<EventBusyIcon />} sx={{ mt: 1 }}
              onClick={() => { setError(''); setRsOpen(true); }}>
              เลื่อนการเข้าพบ
            </Button>
          </Paper>
        ) : (
          <Alert severity="info" sx={{ mb: 2 }}>ยังไม่มีการ check-in</Alert>
        )
      ) : (
        <CheckedInSection plan={plan} isSales={isSales} reload={load} salesName={plan.employee.name} agencyName={plan.agency.name} />
      )}

      {/* ---- รูปการทำงาน (อัปโหลดได้ทุกเมื่อ) ---- */}
      <Paper sx={{ p: 2, mt: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="h6" fontWeight={700}>รูปการทำงาน</Typography>
          {isSales && (
            <Button variant="outlined" size="small" startIcon={<PhotoCameraIcon />}
              disabled={uploadingWork} onClick={() => workRef.current?.click()}>
              {uploadingWork ? 'กำลังอัปโหลด...' : 'อัปโหลดรูป'}
            </Button>
          )}
          <input ref={workRef} type="file" accept="image/*" capture="environment" hidden onChange={onWorkPhoto} />
        </Stack>
        {!plan.workPhotos?.length ? (
          <Typography variant="body2" color="text.secondary">ยังไม่มีรูป</Typography>
        ) : (
          <ImageList cols={3} gap={8} sx={{ m: 0 }}>
            {plan.workPhotos.map((ph) => (
              <ImageListItem key={ph.id}>
                <MuiLink href={ph.url} target="_blank">
                  <img src={ph.url} alt={ph.caption ?? 'work'} loading="lazy" style={{ borderRadius: 8 }} />
                </MuiLink>
              </ImageListItem>
            ))}
          </ImageList>
        )}
      </Paper>

      {/* ---- dialog เลื่อนนัด ---- */}
      <Dialog open={rsOpen} onClose={() => setRsOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>เลื่อนการเข้าพบ — {plan.agency.name}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField label="เหตุผลที่เลื่อน" multiline minRows={2} value={reason}
              onChange={(e) => setReason(e.target.value)} required autoFocus
              placeholder="เช่น ร้านปิด / ติดประชุม / ลูกค้าขอเลื่อน" />
            <TextField label="วันใหม่ (ถ้ามี)" type="date" value={newDate}
              onChange={(e) => setNewDate(e.target.value)} InputLabelProps={{ shrink: true }}
              helperText="เว้นว่าง = เลื่อนแบบยังไม่กำหนดวัน" />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRsOpen(false)}>ยกเลิก</Button>
          <Button variant="contained" color="warning" onClick={doReschedule} disabled={!reason.trim()}>ยืนยันเลื่อน</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function CheckedInSection({
  plan, isSales, reload, salesName, agencyName,
}: { plan: Plan; isSales: boolean; reload: () => Promise<void>; salesName: string; agencyName: string }) {
  const checkin = plan.checkin!;
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<string>('office');
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');

  const [purposes, setPurposes] = useState<string[]>(plan.report?.purposes ?? []);
  const [summary, setSummary] = useState(plan.report?.summary ?? '');
  const [problems, setProblems] = useState(plan.report?.problems ?? '');
  const [actionPlan, setActionPlan] = useState(plan.report?.actionPlan ?? '');
  const [savingReport, setSavingReport] = useState(false);

  // contact (ผู้เข้าพบ)
  const [cName, setCName] = useState(checkin.contactName ?? '');
  const [cPos, setCPos] = useState(checkin.contactPosition ?? '');
  const [cPhone, setCPhone] = useState(checkin.contactPhone ?? '');

  // follow-up
  const [tasks, setTasks] = useState<FollowUp[]>([]);
  const [ftTitle, setFtTitle] = useState('');
  const [ftDue, setFtDue] = useState('');
  const loadTasks = () => api.get(`/visits/plans/${plan.id}/followups`).then((r) => setTasks(r.data));
  useEffect(() => { loadTasks(); /* eslint-disable-next-line */ }, [plan.id]);

  const pickPhoto = (p: string) => { setPhase(p); fileRef.current?.click(); };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErr(''); setUploading(true);
    try {
      const loc = await new Promise<GeolocationCoordinates | null>((res) => {
        if (!navigator.geolocation) return res(null);
        navigator.geolocation.getCurrentPosition((p) => res(p.coords), () => res(null), { timeout: 8000 });
      });
      const now = new Date().toLocaleString('th-TH');
      const stamp = [
        `${now}`,
        loc ? `GPS: ${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}` : 'GPS: -',
        `เซลส์: ${salesName}`,
        `Agency: ${agencyName}`,
      ];
      const blob = await watermark(file, stamp);
      const fd = new FormData();
      fd.append('photo', blob, 'photo.jpg');
      fd.append('phase', phase);
      if (loc) { fd.append('latitude', String(loc.latitude)); fd.append('longitude', String(loc.longitude)); }
      await api.post(`/visits/checkins/${checkin.id}/photos`, fd);
      await reload();
    } catch (e) { setErr(errMsg(e)); } finally { setUploading(false); }
  };

  const doCheckout = async () => {
    setErr('');
    try { await api.post(`/visits/checkins/${checkin.id}/checkout`); await reload(); }
    catch (e) { setErr(errMsg(e)); }
  };
  const saveContact = async () => {
    setErr('');
    try { await api.patch(`/visits/checkins/${checkin.id}/contact`, { contactName: cName, contactPosition: cPos, contactPhone: cPhone }); await reload(); }
    catch (e) { setErr(errMsg(e)); }
  };
  const saveReport = async () => {
    setSavingReport(true); setErr('');
    try {
      await api.post(`/visits/plans/${plan.id}/report`, {
        purposes, summary: summary || undefined, problems: problems || undefined, actionPlan: actionPlan || undefined,
      });
      await reload();
    } catch (e) { setErr(errMsg(e)); } finally { setSavingReport(false); }
  };
  const addTask = async () => {
    if (!ftTitle.trim()) return;
    try {
      await api.post(`/visits/plans/${plan.id}/followups`, { title: ftTitle, dueDate: ftDue || undefined });
      setFtTitle(''); setFtDue(''); await loadTasks();
    } catch (e) { setErr(errMsg(e)); }
  };
  const toggleTask = async (tid: string) => { await api.patch(`/visits/followups/${tid}/toggle`); await loadTasks(); };
  const togglePurpose = (k: string) => setPurposes((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  const g = gpsChip(checkin.gpsStatus);
  const dur = checkin.durationMinutes;

  return (
    <Box>
      <Alert severity={checkin.gpsStatus === 'in_area' ? 'success' : 'warning'} sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Chip size="small" color={g.color} label={g.label} />
          <span>ห่าง {checkin.distanceMeters} ม. · เข้า {new Date(checkin.checkinAt).toLocaleTimeString('th-TH')}</span>
          {checkin.checkOutAt && <span>· ออก {new Date(checkin.checkOutAt).toLocaleTimeString('th-TH')}</span>}
          {dur != null && <Chip size="small" label={`รวม ${Math.floor(dur / 60)} ชม. ${dur % 60} นาที`} />}
          {checkin.isMockGps && <Chip size="small" color="error" label="⚠️ Fake GPS" />}
        </Stack>
      </Alert>

      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

      {/* check-out */}
      {isSales && !checkin.checkOutAt && (
        <Button variant="outlined" color="warning" startIcon={<LogoutIcon />} onClick={doCheckout} sx={{ mb: 2 }}>
          Check-out (จบงาน)
        </Button>
      )}

      {/* ผู้เข้าพบ */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={700} mb={1}>ผู้เข้าพบ (ผู้ดูแล Agency)</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <TextField label="ชื่อ" size="small" value={cName} onChange={(e) => setCName(e.target.value)} disabled={!isSales} fullWidth />
          <TextField label="ตำแหน่ง" size="small" value={cPos} onChange={(e) => setCPos(e.target.value)} disabled={!isSales} fullWidth />
          <TextField label="เบอร์โทร" size="small" value={cPhone} onChange={(e) => setCPhone(e.target.value)} disabled={!isSales} fullWidth />
          {isSales && <Button onClick={saveContact} variant="contained">บันทึก</Button>}
        </Stack>
      </Paper>

      {/* รูป (มีลายน้ำอัตโนมัติ) */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" fontWeight={700} mb={1}>รูปยืนยัน (ลายน้ำอัตโนมัติ)</Typography>
        {isSales && (
          <Stack direction="row" spacing={1} mb={2} flexWrap="wrap" useFlexGap>
            {PHOTO_CATS.map((c) => (
              <Button key={c.key} variant="outlined" size="small" startIcon={<PhotoCameraIcon />}
                onClick={() => pickPhoto(c.key)} disabled={uploading}>{c.label}</Button>
            ))}
            {uploading && <CircularProgress size={24} />}
            <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
          </Stack>
        )}
        {checkin.photos.length === 0 ? (
          <Typography variant="body2" color="text.secondary">ยังไม่มีรูป</Typography>
        ) : (
          <ImageList cols={3} gap={8} sx={{ m: 0 }}>
            {checkin.photos.map((ph) => (
              <ImageListItem key={ph.id}>
                <MuiLink href={ph.url} target="_blank">
                  <img src={ph.url} alt={ph.phase} loading="lazy" style={{ borderRadius: 8 }} />
                </MuiLink>
                <Chip size="small" label={ph.phase} sx={{ position: 'absolute', bottom: 4, left: 4, bgcolor: 'rgba(0,0,0,0.6)', color: 'white' }} />
              </ImageListItem>
            ))}
          </ImageList>
        )}
      </Paper>

      {/* POSM + การขาย */}
      <VisitActivities visitPlanId={plan.id} isSales={isSales} />

      {/* รายงาน */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" fontWeight={700} mb={1}>รายงานการเข้าเยี่ยม</Typography>
        <Typography variant="subtitle2" color="text.secondary">วัตถุประสงค์</Typography>
        <FormGroup row>
          {PURPOSES.map((p) => (
            <FormControlLabel key={p.key}
              control={<Checkbox checked={purposes.includes(p.key)} onChange={() => togglePurpose(p.key)} disabled={!isSales} />}
              label={p.label} />
          ))}
        </FormGroup>
        <Divider sx={{ my: 2 }} />
        <Stack spacing={2}>
          <TextField label="ประเด็นที่คุย / สรุปผล" multiline minRows={2} value={summary} onChange={(e) => setSummary(e.target.value)} disabled={!isSales} />
          <TextField label="ปัญหาที่พบ" multiline minRows={2} value={problems} onChange={(e) => setProblems(e.target.value)} disabled={!isSales} />
          <TextField label="สิ่งที่ต้องติดตามต่อ" multiline minRows={2} value={actionPlan} onChange={(e) => setActionPlan(e.target.value)} disabled={!isSales} />
          {isSales && <Button variant="contained" onClick={saveReport} disabled={savingReport}>{savingReport ? 'กำลังบันทึก...' : 'บันทึกรายงาน'}</Button>}
        </Stack>
      </Paper>

      {/* Follow-up tasks */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" fontWeight={700} mb={1}>งานติดตามต่อ (Follow-up)</Typography>
        {isSales && (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} mb={1}>
            <TextField label="งานที่ต้องทำ" size="small" value={ftTitle} onChange={(e) => setFtTitle(e.target.value)} fullWidth />
            <TextField label="ครบกำหนด" type="date" size="small" value={ftDue} onChange={(e) => setFtDue(e.target.value)} InputLabelProps={{ shrink: true }} />
            <Button variant="contained" startIcon={<AddTaskIcon />} onClick={addTask}>เพิ่ม</Button>
          </Stack>
        )}
        {tasks.length === 0 ? (
          <Typography variant="body2" color="text.secondary">ยังไม่มีงานติดตาม</Typography>
        ) : (
          <List dense>
            {tasks.map((t) => (
              <ListItem key={t.id} divider
                secondaryAction={
                  <IconButton edge="end" onClick={() => toggleTask(t.id)} title="สลับสถานะ">
                    <Checkbox checked={t.status === 'done'} />
                  </IconButton>
                }>
                <ListItemText
                  primary={<span style={{ textDecoration: t.status === 'done' ? 'line-through' : 'none' }}>{t.title}</span>}
                  secondary={t.dueDate ? `ครบกำหนด ${new Date(t.dueDate).toLocaleDateString('th-TH')}` : undefined}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Paper>
    </Box>
  );
}
