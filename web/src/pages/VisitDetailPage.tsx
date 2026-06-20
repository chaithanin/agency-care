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
} from '@mui/material';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import { useParams } from 'react-router-dom';
import { api, errMsg } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import VisitActivities from './VisitActivities';

interface Photo {
  id: string;
  url: string;
  phase: string;
}
interface Checkin {
  id: string;
  checkinAt: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  withinRadius: boolean;
  photos: Photo[];
}
interface Report {
  purposes: string[];
  summary?: string;
  problems?: string;
  actionPlan?: string;
}
interface Plan {
  id: string;
  status: string;
  note?: string;
  agency: {
    code: string;
    name: string;
    latitude?: number;
    longitude?: number;
    phone?: string;
  };
  employee: { name: string };
  checkin?: Checkin | null;
  report?: Report | null;
}

const PURPOSES = [
  { key: 'visit', label: 'เยี่ยมลูกค้า' },
  { key: 'close_sale', label: 'ปิดการขาย' },
  { key: 'install_posm', label: 'ติดตั้งสื่อ' },
  { key: 'collect_data', label: 'เก็บข้อมูล' },
  { key: 'training', label: 'ฝึกอบรม' },
];

export default function VisitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const isSales = user?.role === 'sales';

  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api.get(`/visits/plans/${id}`).then((r) => setPlan(r.data));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ---- GPS check-in ----
  const checkin = () => {
    setError('');
    if (!navigator.geolocation) {
      setError('อุปกรณ์ไม่รองรับ GPS');
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await api.post(`/visits/plans/${id}/checkin`, {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
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

  if (!plan) return <CircularProgress />;

  return (
    <Box>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>
          {plan.agency.name}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {plan.agency.code} · เซลส์: {plan.employee.name}
        </Typography>
        {plan.agency.phone && (
          <Typography variant="body2">โทร: {plan.agency.phone}</Typography>
        )}
        <Stack direction="row" spacing={1} mt={1}>
          <Chip size="small" label={`สถานะ: ${plan.status}`} />
          {plan.agency.latitude != null ? (
            <Chip
              size="small"
              color="success"
              clickable
              component="a"
              href={`https://www.google.com/maps/search/?api=1&query=${plan.agency.latitude},${plan.agency.longitude}`}
              target="_blank"
              label="เปิดแผนที่"
            />
          ) : (
            <Chip size="small" color="warning" label="Agency ยังไม่ตั้งพิกัด" />
          )}
        </Stack>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* ---- Check-in ---- */}
      {!plan.checkin ? (
        isSales ? (
          <Paper sx={{ p: 3, mb: 2, textAlign: 'center' }}>
            <Typography variant="h6" mb={1}>
              เริ่มเข้าเยี่ยม
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>
              กดเพื่อตรวจสอบตำแหน่ง GPS และ check-in หน้างาน
            </Typography>
            <Button
              variant="contained"
              size="large"
              startIcon={busy ? <CircularProgress size={20} color="inherit" /> : <MyLocationIcon />}
              onClick={checkin}
              disabled={busy}
              fullWidth
            >
              {busy ? 'กำลังอ่านตำแหน่ง...' : 'Check-in ที่นี่'}
            </Button>
          </Paper>
        ) : (
          <Alert severity="info" sx={{ mb: 2 }}>
            ยังไม่มีการ check-in
          </Alert>
        )
      ) : (
        <CheckedInSection plan={plan} isSales={isSales} reload={load} />
      )}
    </Box>
  );
}

// ===== ส่วนหลัง check-in: รูป + รายงาน =====
function CheckedInSection({
  plan,
  isSales,
  reload,
}: {
  plan: Plan;
  isSales: boolean;
  reload: () => Promise<void>;
}) {
  const checkin = plan.checkin!;
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<'before' | 'during' | 'after'>('before');
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');

  // report form state
  const [purposes, setPurposes] = useState<string[]>(plan.report?.purposes ?? []);
  const [summary, setSummary] = useState(plan.report?.summary ?? '');
  const [problems, setProblems] = useState(plan.report?.problems ?? '');
  const [actionPlan, setActionPlan] = useState(plan.report?.actionPlan ?? '');
  const [savingReport, setSavingReport] = useState(false);
  const [savedReport, setSavedReport] = useState(false);

  const pickPhoto = (p: 'before' | 'during' | 'after') => {
    setPhase(p);
    fileRef.current?.click();
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErr('');
    setUploading(true);
    const fd = new FormData();
    fd.append('photo', file);
    fd.append('phase', phase);
    try {
      const loc = await new Promise<GeolocationCoordinates | null>((res) => {
        if (!navigator.geolocation) return res(null);
        navigator.geolocation.getCurrentPosition(
          (pos) => res(pos.coords),
          () => res(null),
          { timeout: 8000 },
        );
      });
      if (loc) {
        fd.append('latitude', String(loc.latitude));
        fd.append('longitude', String(loc.longitude));
      }
      await api.post(`/visits/checkins/${checkin.id}/photos`, fd);
      await reload();
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setUploading(false);
    }
  };

  const saveReport = async () => {
    setSavingReport(true);
    setErr('');
    try {
      await api.post(`/visits/plans/${plan.id}/report`, {
        purposes,
        summary: summary || undefined,
        problems: problems || undefined,
        actionPlan: actionPlan || undefined,
      });
      setSavedReport(true);
      await reload();
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setSavingReport(false);
    }
  };

  const togglePurpose = (key: string) =>
    setPurposes((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]));

  return (
    <Box>
      <Alert severity={checkin.withinRadius ? 'success' : 'warning'} sx={{ mb: 2 }}>
        Check-in แล้ว · ห่างจากร้าน {checkin.distanceMeters} เมตร ·{' '}
        {new Date(checkin.checkinAt).toLocaleString('th-TH')}
      </Alert>

      {err && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {err}
        </Alert>
      )}

      {/* ---- Photos ---- */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" fontWeight={700} mb={1}>
          รูปยืนยัน
        </Typography>
        {isSales && (
          <Stack direction="row" spacing={1} mb={2} flexWrap="wrap" useFlexGap>
            {(['before', 'during', 'after'] as const).map((p) => (
              <Button
                key={p}
                variant="outlined"
                size="small"
                startIcon={<PhotoCameraIcon />}
                onClick={() => pickPhoto(p)}
                disabled={uploading}
              >
                {p === 'before' ? 'ก่อนเข้า' : p === 'during' ? 'ระหว่าง' : 'หลังเข้า'}
              </Button>
            ))}
            {uploading && <CircularProgress size={24} />}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={onFile}
            />
          </Stack>
        )}
        {checkin.photos.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            ยังไม่มีรูป
          </Typography>
        ) : (
          <ImageList cols={3} gap={8} sx={{ m: 0 }}>
            {checkin.photos.map((ph) => (
              <ImageListItem key={ph.id}>
                <MuiLink href={ph.url} target="_blank">
                  <img src={ph.url} alt={ph.phase} loading="lazy" style={{ borderRadius: 8 }} />
                </MuiLink>
                <Chip
                  size="small"
                  label={ph.phase}
                  sx={{ position: 'absolute', bottom: 4, left: 4, bgcolor: 'rgba(0,0,0,0.6)', color: 'white' }}
                />
              </ImageListItem>
            ))}
          </ImageList>
        )}
      </Paper>

      {/* ---- POSM + การขาย ---- */}
      <VisitActivities visitPlanId={plan.id} isSales={isSales} />

      {/* ---- Report ---- */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" fontWeight={700} mb={1}>
          รายงานการเข้าเยี่ยม
        </Typography>
        <Typography variant="subtitle2" color="text.secondary">
          วัตถุประสงค์
        </Typography>
        <FormGroup row>
          {PURPOSES.map((p) => (
            <FormControlLabel
              key={p.key}
              control={
                <Checkbox
                  checked={purposes.includes(p.key)}
                  onChange={() => togglePurpose(p.key)}
                  disabled={!isSales}
                />
              }
              label={p.label}
            />
          ))}
        </FormGroup>
        <Divider sx={{ my: 2 }} />
        <Stack spacing={2}>
          <TextField
            label="สรุปผล"
            multiline
            minRows={2}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            disabled={!isSales}
          />
          <TextField
            label="ปัญหาที่พบ"
            multiline
            minRows={2}
            value={problems}
            onChange={(e) => setProblems(e.target.value)}
            disabled={!isSales}
          />
          <TextField
            label="Action Plan"
            multiline
            minRows={2}
            value={actionPlan}
            onChange={(e) => setActionPlan(e.target.value)}
            disabled={!isSales}
          />
          {isSales && (
            <Button variant="contained" onClick={saveReport} disabled={savingReport}>
              {savingReport ? 'กำลังบันทึก...' : 'บันทึกรายงาน'}
            </Button>
          )}
          {savedReport && <Alert severity="success">บันทึกรายงานแล้ว</Alert>}
        </Stack>
      </Paper>
    </Box>
  );
}
