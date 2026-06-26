/**
 * AddAgencyDialog — comprehensive 7-section Add/Edit form for Agency.
 * Used by AgenciesPage.tsx for both create and edit flows.
 */
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
  FormControlLabel,
  FormGroup,
  FormLabel,
  MenuItem,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { api, errMsg } from '../api/client';
import { useT } from '../i18n';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AgencyFull {
  id: string;
  code: string;
  name: string;
  ownerName?: string;
  phone?: string;
  email?: string;
  website?: string;
  status: string;
  level?: string;
  priority?: string;
  type?: string;
  classification?: string;
  remark?: string;
  address?: string;
  province?: string;
  zone?: string;
  latitude?: number;
  longitude?: number;
  photoFront?: string;
  // agreement
  agreementActive?: boolean;
  agreementStartDate?: string;
  agreementExpiry?: string;
  // sales
  sellsOurProjects?: boolean;
  lastSaleDate?: string;
  lastUnitsSold?: number;
  totalUnitsSold?: number;
  // office
  physicalOffice?: boolean;
  // marketing
  numSalesAgents?: number;
  advertisesOurProjects?: boolean;
  paidAds?: boolean;
  // social
  facebook?: string;
  instagram?: string;
  tiktok?: string;
  linkedin?: string;
  otherSocial?: string;
  // management
  visitFrequency?: number;
  assignedCloserId?: string;
  propertyTypes?: string[];
  mainProjects?: string[];
}

interface EmpOpt { id: string; code: string; name: string; position?: string; }
interface DupHit { id: string; code: string; name: string; phone?: string; status: string; }

// ── Constants ────────────────────────────────────────────────────────────────

const PROPERTY_TYPES = ['Villa', 'Condo', 'Townhome', 'Luxury Home', 'Commercial'];

const SCORE_LABEL = (total: number) => {
  if (total >= 50) return 'A';
  if (total >= 20) return 'B';
  if (total >= 1) return 'C';
  return 'D';
};

const SCORE_COLOR = (s: string): 'success' | 'info' | 'warning' | 'default' => {
  if (s === 'A') return 'success';
  if (s === 'B') return 'info';
  if (s === 'C') return 'warning';
  return 'default';
};

// ── Empty form state ──────────────────────────────────────────────────────────

const emptyForm = {
  // Section 1 — General
  name: '',
  ownerName: '',
  phone: '',
  email: '',
  website: '',
  status: 'active',
  // Section 2 — Agreement
  agreementActive: false,
  agreementStartDate: '',
  agreementExpiry: '',
  // Section 3 — Sales
  sellsOurProjects: false,
  lastSaleDate: '',
  lastUnitsSold: '',
  totalUnitsSold: '',
  // Section 4 — Office
  physicalOffice: false,
  address: '',
  province: '',
  zone: '',
  latitude: '',
  longitude: '',
  // Section 5 — Marketing
  numSalesAgents: '',
  advertisesOurProjects: false,
  paidAds: false,
  // Section 6 — Social
  facebook: '',
  instagram: '',
  tiktok: '',
  linkedin: '',
  otherSocial: '',
  // Section 7 — Management
  level: '',
  priority: '',
  visitFrequency: '',
  assignedCloserId: '',
  type: '',
  classification: '',
  remark: '',
  propertyTypes: [] as string[],
  mainProjects: [] as string[],
  // tag input buffer
  _projectInput: '',
};

type FormState = typeof emptyForm;

// ── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  title,
  defaultExpanded = false,
  children,
}: {
  title: string;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Accordion
      defaultExpanded={defaultExpanded}
      disableGutters
      elevation={0}
      sx={{
        '&:before': { display: 'none' },
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        mb: 1,
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: 'action.hover', borderRadius: 1 }}>
        <Typography variant="subtitle2" fontWeight={700}>{title}</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={2}>{children}</Stack>
      </AccordionDetails>
    </Accordion>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  editFor?: AgencyFull | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function AddAgencyDialog({ open, editFor, onClose, onSaved }: Props) {
  const { t } = useT();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [form, setForm] = useState<FormState>({ ...emptyForm });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState('');

  // duplicate check
  const [dupHits, setDupHits] = useState<DupHit[]>([]);
  const dupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // closers list
  const [closers, setClosers] = useState<EmpOpt[]>([]);

  // GPS status
  const [gpsLoading, setGpsLoading] = useState(false);

  // photo
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');

  // ── Load closers on mount ────────────────────────────────────────────────
  useEffect(() => {
    api.get('/employees?position=closer')
      .then((r) => setClosers(r.data))
      .catch(() => {
        // fallback: load all employees and filter client-side
        api.get('/employees').then((r) => {
          const all: EmpOpt[] = r.data;
          const filtered = all.filter((e) => !e.position || e.position === 'closer');
          setClosers(filtered.length > 0 ? filtered : all);
        }).catch(() => {});
      });
  }, []);

  // ── Populate form when editing ──────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    if (editFor) {
      setForm({
        name: editFor.name ?? '',
        ownerName: editFor.ownerName ?? '',
        phone: editFor.phone ?? '',
        email: editFor.email ?? '',
        website: editFor.website ?? '',
        status: editFor.status ?? 'active',
        agreementActive: editFor.agreementActive ?? false,
        agreementStartDate: editFor.agreementStartDate ?? '',
        agreementExpiry: editFor.agreementExpiry ?? '',
        sellsOurProjects: editFor.sellsOurProjects ?? false,
        lastSaleDate: editFor.lastSaleDate ?? '',
        lastUnitsSold: editFor.lastUnitsSold != null ? String(editFor.lastUnitsSold) : '',
        totalUnitsSold: editFor.totalUnitsSold != null ? String(editFor.totalUnitsSold) : '',
        physicalOffice: editFor.physicalOffice ?? false,
        address: editFor.address ?? '',
        province: editFor.province ?? '',
        zone: editFor.zone ?? '',
        latitude: editFor.latitude != null ? String(editFor.latitude) : '',
        longitude: editFor.longitude != null ? String(editFor.longitude) : '',
        numSalesAgents: editFor.numSalesAgents != null ? String(editFor.numSalesAgents) : '',
        advertisesOurProjects: editFor.advertisesOurProjects ?? false,
        paidAds: editFor.paidAds ?? false,
        facebook: editFor.facebook ?? '',
        instagram: editFor.instagram ?? '',
        tiktok: editFor.tiktok ?? '',
        linkedin: editFor.linkedin ?? '',
        otherSocial: editFor.otherSocial ?? '',
        level: editFor.level ?? '',
        priority: editFor.priority ?? '',
        visitFrequency: editFor.visitFrequency != null ? String(editFor.visitFrequency) : '',
        assignedCloserId: editFor.assignedCloserId ?? '',
        type: editFor.type ?? '',
        classification: editFor.classification ?? '',
        remark: editFor.remark ?? '',
        propertyTypes: editFor.propertyTypes ?? [],
        mainProjects: editFor.mainProjects ?? [],
        _projectInput: '',
      });
      setPhotoPreview(editFor.photoFront ?? '');
    } else {
      setForm({ ...emptyForm });
      setPhotoPreview('');
    }
    setError('');
    setDupHits([]);
  }, [open, editFor]);

  // ── Duplicate check (debounced) ──────────────────────────────────────────
  const checkDup = useCallback(
    (name: string, phone: string, email: string) => {
      if (dupTimer.current) clearTimeout(dupTimer.current);
      if (!name && !phone && !email) { setDupHits([]); return; }
      dupTimer.current = setTimeout(async () => {
        try {
          const params: Record<string, string> = {};
          if (name.length >= 3) params.name = name;
          if (phone) params.phone = phone;
          if (email) params.email = email;
          if (!Object.keys(params).length) return;
          const { data } = await api.get('/agencies/check-duplicate', { params });
          const hits: DupHit[] = editFor
            ? data.duplicates.filter((d: DupHit) => d.id !== editFor.id)
            : data.duplicates;
          setDupHits(hits);
        } catch { /* silent */ }
      }, 600);
    },
    [editFor],
  );

  // ── Form field helpers ──────────────────────────────────────────────────
  const setStr = (key: keyof FormState, val: string) => {
    setForm((prev) => {
      const next = { ...prev, [key]: val };
      if (key === 'name' || key === 'phone' || key === 'email') {
        checkDup(next.name, next.phone, next.email);
      }
      return next;
    });
  };

  const setBool = (key: keyof FormState, val: boolean) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  // ── Agreement expiry warning ──────────────────────────────────────────────
  const agreementDaysLeft = (() => {
    if (!form.agreementExpiry) return null;
    const diff = new Date(form.agreementExpiry).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days;
  })();

  // ── Sales score ──────────────────────────────────────────────────────────
  const salesScore = SCORE_LABEL(Number(form.totalUnitsSold) || 0);

  // ── GPS pinning ──────────────────────────────────────────────────────────
  const pinLocation = () => {
    if (!navigator.geolocation) { setError('Browser ไม่รองรับ Geolocation'); return; }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStr('latitude', String(pos.coords.latitude));
        setStr('longitude', String(pos.coords.longitude));
        setGpsLoading(false);
      },
      () => { setError('ไม่สามารถรับ GPS ได้'); setGpsLoading(false); },
    );
  };

  // ── Photo capture ─────────────────────────────────────────────────────────
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPhotoPreview(url);
  };

  // ── Property types ────────────────────────────────────────────────────────
  const togglePropertyType = (pt: string) => {
    setForm((prev) => {
      const next = prev.propertyTypes.includes(pt)
        ? prev.propertyTypes.filter((x) => x !== pt)
        : [...prev.propertyTypes, pt];
      return { ...prev, propertyTypes: next };
    });
  };

  // ── Main projects tag input ───────────────────────────────────────────────
  const addProject = () => {
    const val = form._projectInput.trim();
    if (!val || form.mainProjects.includes(val)) return;
    setForm((prev) => ({ ...prev, mainProjects: [...prev.mainProjects, val], _projectInput: '' }));
  };

  const removeProject = (p: string) =>
    setForm((prev) => ({ ...prev, mainProjects: prev.mainProjects.filter((x) => x !== p) }));

  // ── Submit ────────────────────────────────────────────────────────────────
  const save = async () => {
    if (!form.name.trim()) { setError('กรุณากรอกชื่อ Agency'); return; }
    if (!form.ownerName.trim()) { setError('กรุณากรอกชื่อผู้ติดต่อ'); return; }
    if (!form.phone.trim()) { setError('กรุณากรอกเบอร์โทร'); return; }
    setSaving(true);
    setError('');

    const payload: Record<string, any> = {
      name: form.name,
      ownerName: form.ownerName || undefined,
      phone: form.phone || undefined,
      email: form.email || undefined,
      website: form.website || undefined,
      status: form.status,
      agreementActive: form.agreementActive,
      agreementStartDate: form.agreementStartDate || undefined,
      agreementExpiry: form.agreementExpiry || undefined,
      sellsOurProjects: form.sellsOurProjects,
      lastSaleDate: form.lastSaleDate || undefined,
      lastUnitsSold: form.lastUnitsSold ? Number(form.lastUnitsSold) : undefined,
      totalUnitsSold: form.totalUnitsSold ? Number(form.totalUnitsSold) : undefined,
      physicalOffice: form.physicalOffice,
      address: form.address || undefined,
      province: form.province || undefined,
      zone: form.zone || undefined,
      latitude: form.latitude ? Number(form.latitude) : undefined,
      longitude: form.longitude ? Number(form.longitude) : undefined,
      numSalesAgents: form.numSalesAgents ? Number(form.numSalesAgents) : undefined,
      advertisesOurProjects: form.advertisesOurProjects,
      paidAds: form.paidAds,
      facebook: form.facebook || undefined,
      instagram: form.instagram || undefined,
      tiktok: form.tiktok || undefined,
      linkedin: form.linkedin || undefined,
      otherSocial: form.otherSocial || undefined,
      level: form.level || undefined,
      priority: form.priority || undefined,
      visitFrequency: form.visitFrequency ? Number(form.visitFrequency) : undefined,
      assignedCloserId: form.assignedCloserId || undefined,
      type: form.type || undefined,
      classification: form.classification || undefined,
      remark: form.remark || undefined,
      propertyTypes: form.propertyTypes.length ? form.propertyTypes : undefined,
      mainProjects: form.mainProjects.length ? form.mainProjects : undefined,
    };

    try {
      if (editFor) {
        await api.patch(`/agencies/${editFor.id}`, payload);
        setSnack('บันทึก Agency สำเร็จ');
      } else {
        await api.post('/agencies', payload);
        setSnack('สร้าง Agency สำเร็จ');
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const agencyCodeDisplay = editFor?.code
    ? editFor.code
    : 'Agency-XXXX (auto)';

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        fullWidth
        maxWidth="md"
        fullScreen={isMobile}
        scroll="paper"
        PaperProps={{ sx: { backgroundImage: 'none', bgcolor: 'background.paper' } }}
        slotProps={{ backdrop: { sx: { bgcolor: 'rgba(0,0,0,0.75)' } } }}
      >
        <DialogTitle>
          {editFor
            ? `แก้ไข Agency: ${editFor.name}`
            : 'เพิ่ม Agency ใหม่'}
        </DialogTitle>

        <DialogContent dividers>
          <Stack spacing={1} mt={0.5}>
            {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

            {/* Duplicate warning */}
            {dupHits.length > 0 && (
              <Alert severity="warning" icon={<WarningAmberIcon />}>
                <Typography variant="body2" fontWeight={600}>
                  พบข้อมูลซ้ำ ({dupHits.length} รายการ):
                </Typography>
                {dupHits.map((h) => (
                  <Typography key={h.id} variant="caption" display="block">
                    • {h.code} — {h.name} {h.phone ? `(${h.phone})` : ''} [{h.status}]
                  </Typography>
                ))}
                <Typography variant="caption" color="text.secondary">
                  ยังสามารถสร้างต่อได้
                </Typography>
              </Alert>
            )}

            {/* ── SECTION 1: General Information ── */}
            <Section title="1. ข้อมูลทั่วไป (General Information)" defaultExpanded>
              {/* Agency code (read-only display) */}
              <TextField
                label="Agency Code"
                value={agencyCodeDisplay}
                disabled
                size="small"
                helperText="รหัสสร้างอัตโนมัติโดยระบบ"
              />

              <TextField
                label="ชื่อ Agency *"
                value={form.name}
                onChange={(e) => setStr('name', e.target.value)}
                onBlur={() => checkDup(form.name, form.phone, form.email)}
                required
                size="small"
              />

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Contact Person *"
                  value={form.ownerName}
                  onChange={(e) => setStr('ownerName', e.target.value)}
                  required
                  size="small"
                  sx={{ flex: 1 }}
                />
                <TextField
                  label="เบอร์โทร *"
                  value={form.phone}
                  onChange={(e) => setStr('phone', e.target.value)}
                  onBlur={() => checkDup(form.name, form.phone, form.email)}
                  required
                  size="small"
                  sx={{ flex: 1 }}
                />
              </Stack>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setStr('email', e.target.value)}
                  onBlur={() => checkDup(form.name, form.phone, form.email)}
                  size="small"
                  sx={{ flex: 1 }}
                />
                <TextField
                  label="Website"
                  value={form.website}
                  onChange={(e) => setStr('website', e.target.value)}
                  size="small"
                  placeholder="https://"
                  sx={{ flex: 1 }}
                />
              </Stack>

              <TextField
                select
                label="สถานะ *"
                value={form.status}
                onChange={(e) => setStr('status', e.target.value)}
                size="small"
                sx={{ maxWidth: 200 }}
              >
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
              </TextField>
            </Section>

            {/* ── SECTION 2: Agreement Information ── */}
            <Section title="2. ข้อมูลสัญญา (Agreement Information)">
              <FormControlLabel
                control={
                  <Switch
                    checked={form.agreementActive}
                    onChange={(e) => setBool('agreementActive', e.target.checked)}
                  />
                }
                label="Active Agency Agreement"
              />

              {form.agreementActive && (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    label="วันที่เริ่มสัญญา"
                    type="date"
                    value={form.agreementStartDate}
                    onChange={(e) => setStr('agreementStartDate', e.target.value)}
                    size="small"
                    InputLabelProps={{ shrink: true }}
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    label="วันที่หมดสัญญา"
                    type="date"
                    value={form.agreementExpiry}
                    onChange={(e) => setStr('agreementExpiry', e.target.value)}
                    size="small"
                    InputLabelProps={{ shrink: true }}
                    sx={{ flex: 1 }}
                  />
                </Stack>
              )}

              {form.agreementActive &&
                form.agreementExpiry &&
                agreementDaysLeft !== null &&
                agreementDaysLeft <= 90 && (
                  <Alert severity="warning">
                    {agreementDaysLeft <= 0
                      ? `สัญญาหมดอายุแล้ว ${Math.abs(agreementDaysLeft)} วัน`
                      : `สัญญาหมด ${agreementDaysLeft} วัน`}
                  </Alert>
                )}
            </Section>

            {/* ── SECTION 3: Sales Performance ── */}
            <Section title="3. ผลการขาย (Sales Performance)">
              <FormControlLabel
                control={
                  <Switch
                    checked={form.sellsOurProjects}
                    onChange={(e) => setBool('sellsOurProjects', e.target.checked)}
                  />
                }
                label="Do They Sell Our Projects?"
              />

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start">
                <TextField
                  label="วันที่ขายล่าสุด"
                  type="date"
                  value={form.lastSaleDate}
                  onChange={(e) => setStr('lastSaleDate', e.target.value)}
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  sx={{ flex: 1 }}
                />
                <TextField
                  label="ยูนิตที่ขายล่าสุด"
                  type="number"
                  value={form.lastUnitsSold}
                  onChange={(e) => setStr('lastUnitsSold', e.target.value)}
                  size="small"
                  sx={{ flex: 1 }}
                  inputProps={{ min: 0 }}
                />
                <TextField
                  label="ยูนิตทั้งหมด"
                  type="number"
                  value={form.totalUnitsSold}
                  onChange={(e) => setStr('totalUnitsSold', e.target.value)}
                  size="small"
                  sx={{ flex: 1 }}
                  inputProps={{ min: 0 }}
                />
              </Stack>

              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" color="text.secondary">Agency Score:</Typography>
                <Chip
                  label={salesScore}
                  color={SCORE_COLOR(salesScore)}
                  size="small"
                  sx={{ fontWeight: 700 }}
                />
                <Typography variant="caption" color="text.secondary">
                  (A≥50, B≥20, C≥1, D=0 ยูนิต)
                </Typography>
              </Stack>
            </Section>

            {/* ── SECTION 4: Office Information ── */}
            <Section title="4. ข้อมูลสำนักงาน (Office Information)">
              <FormControlLabel
                control={
                  <Switch
                    checked={form.physicalOffice}
                    onChange={(e) => setBool('physicalOffice', e.target.checked)}
                  />
                }
                label="Physical Office"
              />

              <TextField
                label="ที่อยู่"
                value={form.address}
                onChange={(e) => setStr('address', e.target.value)}
                multiline
                rows={2}
                size="small"
              />

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="จังหวัด"
                  value={form.province}
                  onChange={(e) => setStr('province', e.target.value)}
                  size="small"
                  sx={{ flex: 1 }}
                />
                <TextField
                  label="โซน"
                  value={form.zone}
                  onChange={(e) => setStr('zone', e.target.value)}
                  size="small"
                  sx={{ flex: 1 }}
                />
              </Stack>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
                <TextField
                  label="Latitude"
                  type="number"
                  value={form.latitude}
                  onChange={(e) => setStr('latitude', e.target.value)}
                  size="small"
                  placeholder="13.7563"
                  sx={{ flex: 1 }}
                />
                <TextField
                  label="Longitude"
                  type="number"
                  value={form.longitude}
                  onChange={(e) => setStr('longitude', e.target.value)}
                  size="small"
                  placeholder="100.5018"
                  sx={{ flex: 1 }}
                />
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={gpsLoading ? <CircularProgress size={14} /> : <MyLocationIcon />}
                  onClick={pinLocation}
                  disabled={gpsLoading}
                  sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  📍 Pin Location
                </Button>
              </Stack>

              {/* Photo front */}
              <Box>
                <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                  รูปหน้าร้าน
                </Typography>
                {photoPreview && (
                  <Box
                    component="img"
                    src={photoPreview}
                    sx={{ maxHeight: 120, objectFit: 'contain', borderRadius: 1, mb: 1, display: 'block' }}
                  />
                )}
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: 'none' }}
                  onChange={handlePhotoChange}
                />
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => photoInputRef.current?.click()}
                >
                  📷 Take Photo
                </Button>
              </Box>
            </Section>

            {/* ── SECTION 5: Marketing Information ── */}
            <Section title="5. การตลาด (Marketing Information)">
              <TextField
                label="Number of Sales Agents"
                type="number"
                value={form.numSalesAgents}
                onChange={(e) => setStr('numSalesAgents', e.target.value)}
                size="small"
                sx={{ maxWidth: 220 }}
                inputProps={{ min: 0 }}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={form.advertisesOurProjects}
                    onChange={(e) => setBool('advertisesOurProjects', e.target.checked)}
                  />
                }
                label="Advertise Our Projects?"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={form.paidAds}
                    onChange={(e) => setBool('paidAds', e.target.checked)}
                  />
                }
                label="Paid Ads?"
              />
            </Section>

            {/* ── SECTION 6: Social Media ── */}
            <Section title="6. Social Media">
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Facebook URL"
                  value={form.facebook}
                  onChange={(e) => setStr('facebook', e.target.value)}
                  size="small"
                  placeholder="https://facebook.com/..."
                  sx={{ flex: 1 }}
                />
                <TextField
                  label="Instagram URL"
                  value={form.instagram}
                  onChange={(e) => setStr('instagram', e.target.value)}
                  size="small"
                  placeholder="https://instagram.com/..."
                  sx={{ flex: 1 }}
                />
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="TikTok URL"
                  value={form.tiktok}
                  onChange={(e) => setStr('tiktok', e.target.value)}
                  size="small"
                  placeholder="https://tiktok.com/@..."
                  sx={{ flex: 1 }}
                />
                <TextField
                  label="LinkedIn URL"
                  value={form.linkedin}
                  onChange={(e) => setStr('linkedin', e.target.value)}
                  size="small"
                  placeholder="https://linkedin.com/..."
                  sx={{ flex: 1 }}
                />
              </Stack>
              <TextField
                label="Other"
                value={form.otherSocial}
                onChange={(e) => setStr('otherSocial', e.target.value)}
                size="small"
              />
            </Section>

            {/* ── SECTION 7: Agency Management ── */}
            <Section title="7. จัดการ Agency (Agency Management)">
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  select
                  label="Agency Level"
                  value={form.level}
                  onChange={(e) => setStr('level', e.target.value)}
                  size="small"
                  sx={{ flex: 1 }}
                >
                  <MenuItem value="">—</MenuItem>
                  {['VIP', 'A', 'B', 'C', 'D'].map((l) => (
                    <MenuItem key={l} value={l}>{l}</MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="Priority"
                  value={form.priority}
                  onChange={(e) => setStr('priority', e.target.value)}
                  size="small"
                  sx={{ flex: 1 }}
                >
                  <MenuItem value="">—</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="low">Low</MenuItem>
                </TextField>
                <TextField
                  select
                  label="Visit Frequency / Month"
                  value={form.visitFrequency}
                  onChange={(e) => setStr('visitFrequency', e.target.value)}
                  size="small"
                  sx={{ flex: 1 }}
                >
                  <MenuItem value="">—</MenuItem>
                  <MenuItem value="1">1 ครั้ง/เดือน</MenuItem>
                  <MenuItem value="2">2 ครั้ง/เดือน</MenuItem>
                  <MenuItem value="4">4 ครั้ง/เดือน</MenuItem>
                </TextField>
              </Stack>

              {/* Assigned Closer */}
              <TextField
                select
                label="Assigned Closer"
                value={form.assignedCloserId}
                onChange={(e) => setStr('assignedCloserId', e.target.value)}
                size="small"
              >
                <MenuItem value="">— ไม่ระบุ —</MenuItem>
                {closers.map((c) => (
                  <MenuItem key={c.id} value={c.id}>{c.name} ({c.code})</MenuItem>
                ))}
              </TextField>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Agency Type"
                  value={form.type}
                  onChange={(e) => setStr('type', e.target.value)}
                  size="small"
                  sx={{ flex: 1 }}
                />
                <TextField
                  label="Classification"
                  value={form.classification}
                  onChange={(e) => setStr('classification', e.target.value)}
                  size="small"
                  sx={{ flex: 1 }}
                />
              </Stack>

              <TextField
                label="หมายเหตุ"
                value={form.remark}
                onChange={(e) => setStr('remark', e.target.value)}
                multiline
                rows={2}
                size="small"
              />

              {/* Property Focus */}
              <Box>
                <FormLabel sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary' }}>
                  Property Types ที่สนใจ
                </FormLabel>
                <FormGroup row sx={{ mt: 0.5, gap: 0.5 }}>
                  {PROPERTY_TYPES.map((pt) => (
                    <Chip
                      key={pt}
                      label={pt}
                      size="small"
                      clickable
                      color={form.propertyTypes.includes(pt) ? 'primary' : 'default'}
                      variant={form.propertyTypes.includes(pt) ? 'filled' : 'outlined'}
                      onClick={() => togglePropertyType(pt)}
                    />
                  ))}
                </FormGroup>
              </Box>

              {/* Main Projects */}
              <Box>
                <FormLabel sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary' }}>
                  Main Projects
                </FormLabel>
                <Stack direction="row" spacing={1} mt={0.5} flexWrap="wrap" useFlexGap>
                  {form.mainProjects.map((p) => (
                    <Chip
                      key={p}
                      label={p}
                      size="small"
                      onDelete={() => removeProject(p)}
                    />
                  ))}
                </Stack>
                <Stack direction="row" spacing={1} mt={1}>
                  <TextField
                    size="small"
                    placeholder="พิมพ์ชื่อโปรเจกต์ แล้วกด Enter"
                    value={form._projectInput}
                    onChange={(e) => setForm((prev) => ({ ...prev, _projectInput: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); addProject(); }
                    }}
                    sx={{ flex: 1 }}
                  />
                  <Button variant="outlined" size="small" onClick={addProject}>
                    เพิ่ม
                  </Button>
                </Stack>
              </Box>
            </Section>
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={save}
            disabled={saving || !form.name.trim()}
            startIcon={saving ? <CircularProgress size={16} /> : undefined}
          >
            {editFor ? t('common.save') : 'สร้าง Agency'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!snack}
        autoHideDuration={3000}
        onClose={() => setSnack('')}
        message={snack}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  );
}
