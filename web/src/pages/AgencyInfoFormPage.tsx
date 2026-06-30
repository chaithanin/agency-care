import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useT } from '../i18n';
import {
  Alert, Box, Button, Card, CardContent, Checkbox, Chip,
  CircularProgress, Divider, FormControlLabel, FormGroup,
  FormLabel, Paper, Radio, RadioGroup, Stack, TextField,
  Typography,
} from '@mui/material';
import {
  ArrowBack, CheckBox, CheckBoxOutlineBlank, Print, Save,
} from '@mui/icons-material';
import { api, errMsg } from '../api/client';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ProfileData {
  // Section 1 — Main Information
  locationDetail: string;
  hasWebsite: string; // 'yes'|'no'|''
  websiteUrl: string;
  websiteProjects: [string, string, string];
  targetMarkets: {
    resell: boolean;
    underConstruction: boolean;
    finishedProjects: boolean;
    rentals: boolean;
    otherMarket: string;
  };
  hasOrganicSocial: string;
  organicPlatforms: { facebook: boolean; instagram: boolean; tiktok: boolean; other: string };
  hasPaidSocial: string;
  paidPlatforms: { facebook: boolean; instagram: boolean; tiktok: boolean; other: string };
  socialProjects: [string, string];
  // Section 2 — General Information
  staffCount: string;
  bringCustomers: string;
  sellsForUs: string;
  lastSaleDate: string;
  hadOrientation: string;
}

const DEFAULT_PROFILE: ProfileData = {
  locationDetail: '',
  hasWebsite: '',
  websiteUrl: '',
  websiteProjects: ['', '', ''],
  targetMarkets: { resell: false, underConstruction: false, finishedProjects: false, rentals: false, otherMarket: '' },
  hasOrganicSocial: '',
  organicPlatforms: { facebook: false, instagram: false, tiktok: false, other: '' },
  hasPaidSocial: '',
  paidPlatforms: { facebook: false, instagram: false, tiktok: false, other: '' },
  socialProjects: ['', ''],
  staffCount: '',
  bringCustomers: '',
  sellsForUs: '',
  lastSaleDate: '',
  hadOrientation: '',
};

interface Agency {
  id: string; code: string; name: string; zone: string | null;
  phone: string | null; email: string | null;
  ownerName: string | null; managerName: string | null;
  address: string | null; website: string | null;
  profileData: ProfileData | null;
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function SectionCard({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <Card sx={{ mb: 3, borderRadius: 3, breakInside: 'avoid', '@media print': { boxShadow: 'none', border: '1px solid #ccc' } }}>
      <CardContent sx={{ p: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} mb={2.5}>
          <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: 'primary.main', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
            {number}
          </Box>
          <Typography variant="h6" fontWeight={800}>{title}</Typography>
        </Stack>
        {children}
      </CardContent>
    </Card>
  );
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return <Box mb={2.5}>{children}</Box>;
}

function YesNo({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Box mb={1}>
      <FormLabel sx={{ fontWeight: 600, color: 'text.primary', fontSize: 14 }}>{label}</FormLabel>
      <RadioGroup row value={value} onChange={(e) => onChange(e.target.value)} sx={{ mt: 0.5 }}>
        <FormControlLabel value="yes" control={<Radio size="small" />} label="Yes" />
        <FormControlLabel value="no" control={<Radio size="small" />} label="No" />
      </RadioGroup>
    </Box>
  );
}

function PlatformGroup({ label, value, onChange }: {
  label: string;
  value: { facebook: boolean; instagram: boolean; tiktok: boolean; other: string };
  onChange: (v: typeof value) => void;
}) {
  return (
    <Box ml={2} mt={0.5}>
      <FormLabel sx={{ fontSize: 13, color: 'text.secondary' }}>{label}:</FormLabel>
      <FormGroup row sx={{ mt: 0.5, gap: 0 }}>
        {(['facebook', 'instagram', 'tiktok'] as const).map((p) => (
          <FormControlLabel key={p} sx={{ mr: 2 }}
            control={<Checkbox size="small" checked={value[p]} onChange={(e) => onChange({ ...value, [p]: e.target.checked })} />}
            label={<Typography variant="body2" sx={{ textTransform: 'capitalize' }}>{p}</Typography>}
          />
        ))}
        <Stack direction="row" alignItems="center" spacing={1}>
          <FormControlLabel
            control={<Checkbox size="small" checked={!!value.other} onChange={(e) => { if (!e.target.checked) onChange({ ...value, other: '' }); }} />}
            label={<Typography variant="body2">Other:</Typography>}
          />
          <TextField size="small" value={value.other} onChange={(e) => onChange({ ...value, other: e.target.value })}
            placeholder="specify..." sx={{ width: 140 }} />
        </Stack>
      </FormGroup>
    </Box>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AgencyInfoFormPage() {
  const { t } = useT();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);

  const [agency, setAgency] = useState<Agency | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState('');

  // contact fields (update agency directly)
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [contactPerson, setContactPerson] = useState('');

  // profile data
  const [p, setP] = useState<ProfileData>(DEFAULT_PROFILE);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    api.get(`/agencies/${id}`).then((r) => {
      const a: Agency = r.data;
      setAgency(a);
      setPhone(a.phone ?? '');
      setEmail(a.email ?? '');
      setContactPerson(a.ownerName ?? a.managerName ?? '');
      if (a.profileData) {
        setP({ ...DEFAULT_PROFILE, ...a.profileData });
      } else {
        setP({ ...DEFAULT_PROFILE, locationDetail: a.address ?? '', websiteUrl: a.website ?? '' });
      }
    }).catch((e) => setErr(errMsg(e))).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!id) return;
    setSaving(true); setSaved(false); setErr('');
    try {
      await api.patch(`/agencies/${id}`, {
        phone, email,
        ownerName: contactPerson || undefined,
        address: p.locationDetail || undefined,
        website: p.websiteUrl || undefined,
        profileData: p,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) { setErr(errMsg(e)); }
    finally { setSaving(false); }
  };

  const handlePrint = () => window.print();

  if (loading) return <Box display="flex" justifyContent="center" mt={8}><CircularProgress /></Box>;
  if (err && !agency) return <Alert severity="error">{err}</Alert>;

  return (
    <Box ref={printRef}>
      {/* Header — hidden on print */}
      <Stack direction="row" alignItems="center" spacing={2} mb={3} sx={{ '@media print': { display: 'none' } }}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/agencies')} size="small">{t('aif.back')}</Button>
        <Typography variant="h5" fontWeight={800} flex={1}>Agency Information Form</Typography>
        <Button startIcon={<Print />} onClick={handlePrint} variant="outlined">{t('aif.print')}</Button>
        <Button startIcon={<Save />} onClick={save} variant="contained" disabled={saving}>
          {saving ? t('aif.saving') : t('common.save')}
        </Button>
      </Stack>

      {saved && <Alert severity="success" sx={{ mb: 2, '@media print': { display: 'none' } }}>{t('aif.savedSuccess')}</Alert>}
      {err && <Alert severity="error" sx={{ mb: 2, '@media print': { display: 'none' } }}>{err}</Alert>}

      {/* Print header */}
      <Paper sx={{
        p: 3, mb: 3, borderRadius: 3, background: 'linear-gradient(135deg, #1565C0 0%, #42A5F5 100%)',
        color: 'white', '@media print': { borderRadius: 0, background: '#1565C0 !important', WebkitPrintColorAdjust: 'exact' },
      }}>
        <Typography variant="overline" sx={{ opacity: 0.85, letterSpacing: 2 }}>Agency Care — Visit Report</Typography>
        <Typography variant="h5" fontWeight={800} mt={0.5}>Agency Information Form</Typography>
        <Stack direction="row" spacing={3} mt={1.5} flexWrap="wrap">
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="caption" sx={{ opacity: 0.8 }}>Agency:</Typography>
            <Typography fontWeight={700}>{agency?.name}</Typography>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="caption" sx={{ opacity: 0.8 }}>Code:</Typography>
            <Chip label={agency?.code} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.25)', color: 'white', fontWeight: 700 }} />
          </Stack>
          {agency?.zone && (
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="caption" sx={{ opacity: 0.8 }}>Zone:</Typography>
              <Typography fontWeight={700}>{agency.zone}</Typography>
            </Stack>
          )}
        </Stack>
      </Paper>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 1 — MAIN INFORMATION
      ══════════════════════════════════════════════════════════════ */}
      <SectionCard number="1" title="Main Information">

        {/* Location */}
        <FieldRow>
          <FormLabel sx={{ fontWeight: 700, fontSize: 15, color: 'text.primary', display: 'block', mb: 1 }}>
            Agency Location
          </FormLabel>
          <TextField fullWidth size="small" label="Agency Location"
            value={p.locationDetail}
            onChange={(e) => setP({ ...p, locationDetail: e.target.value })}
            placeholder={t('aif.locationPlaceholder')} />
        </FieldRow>

        <Divider sx={{ my: 2 }} />

        {/* Official Website */}
        <FieldRow>
          <FormLabel sx={{ fontWeight: 700, fontSize: 15, color: 'text.primary', display: 'block', mb: 1 }}>
            Official Website
          </FormLabel>
          <YesNo label="Does the Agency have an official website?"
            value={p.hasWebsite} onChange={(v) => setP({ ...p, hasWebsite: v })} />
          {(p.hasWebsite === 'yes' || p.websiteUrl) && (
            <TextField fullWidth size="small" label="Website URL" value={p.websiteUrl}
              onChange={(e) => setP({ ...p, websiteUrl: e.target.value })}
              placeholder="https://..." sx={{ mt: 1 }} />
          )}
        </FieldRow>

        <Divider sx={{ my: 2 }} />

        {/* Website Analysis */}
        <FieldRow>
          <FormLabel sx={{ fontWeight: 700, fontSize: 15, color: 'text.primary', display: 'block', mb: 1 }}>
            Website Analysis
          </FormLabel>

          <Typography variant="body2" fontWeight={600} gutterBottom>
            Projects advertised on website:
          </Typography>
          <Stack spacing={1.5} mb={2}>
            {([0, 1, 2] as const).map((i) => (
              <TextField key={i} size="small" fullWidth
                label={`Project ${i + 1}`}
                value={p.websiteProjects[i]}
                onChange={(e) => {
                  const arr = [...p.websiteProjects] as [string, string, string];
                  arr[i] = e.target.value;
                  setP({ ...p, websiteProjects: arr });
                }}
                placeholder="Project name..." />
            ))}
          </Stack>

          <Typography variant="body2" fontWeight={600} gutterBottom>Target Markets:</Typography>
          <FormGroup sx={{ ml: 1 }}>
            {[
              { key: 'resell', label: 'Resale' },
              { key: 'underConstruction', label: 'Under Construction' },
              { key: 'finishedProjects', label: 'Finished Projects' },
              { key: 'rentals', label: 'Rentals' },
            ].map(({ key, label }) => (
              <FormControlLabel key={key}
                control={<Checkbox size="small"
                  checked={(p.targetMarkets as unknown as Record<string, boolean>)[key]}
                  onChange={(e) => setP({ ...p, targetMarkets: { ...p.targetMarkets, [key]: e.target.checked } })}
                  icon={<CheckBoxOutlineBlank />} checkedIcon={<CheckBox color="primary" />}
                />}
                label={<Typography variant="body2">{label}</Typography>}
              />
            ))}
            <Stack direction="row" alignItems="center" spacing={1}>
              <FormControlLabel
                control={<Checkbox size="small"
                  checked={!!p.targetMarkets.otherMarket}
                  onChange={(e) => { if (!e.target.checked) setP({ ...p, targetMarkets: { ...p.targetMarkets, otherMarket: '' } }); }}
                />}
                label={<Typography variant="body2">Other:</Typography>}
              />
              <TextField size="small" value={p.targetMarkets.otherMarket}
                onChange={(e) => setP({ ...p, targetMarkets: { ...p.targetMarkets, otherMarket: e.target.value } })}
                placeholder="Specify..." sx={{ width: 200 }} />
            </Stack>
          </FormGroup>
        </FieldRow>

        <Divider sx={{ my: 2 }} />

        {/* Social Media */}
        <FieldRow>
          <FormLabel sx={{ fontWeight: 700, fontSize: 15, color: 'text.primary', display: 'block', mb: 1.5 }}>
            Social Media
          </FormLabel>

          {/* Organic */}
          <YesNo
            label="Does the Agency run organic ads on Social Media?"
            value={p.hasOrganicSocial}
            onChange={(v) => setP({ ...p, hasOrganicSocial: v })}
          />
          {p.hasOrganicSocial === 'yes' && (
            <PlatformGroup label="Channels (Organic)"
              value={p.organicPlatforms}
              onChange={(v) => setP({ ...p, organicPlatforms: v })} />
          )}

          <Box mt={2} />

          {/* Paid */}
          <YesNo
            label="Does the Agency run paid ads on Social Media?"
            value={p.hasPaidSocial}
            onChange={(v) => setP({ ...p, hasPaidSocial: v })}
          />
          {p.hasPaidSocial === 'yes' && (
            <PlatformGroup label="Channels (Paid)"
              value={p.paidPlatforms}
              onChange={(v) => setP({ ...p, paidPlatforms: v })} />
          )}

          <Box mt={2} />

          <Typography variant="body2" fontWeight={600} gutterBottom>
            Projects advertised on Social Media:
          </Typography>
          <Stack spacing={1.5}>
            {([0, 1] as const).map((i) => (
              <TextField key={i} size="small" fullWidth
                label={`Project ${i + 1}`}
                value={p.socialProjects[i]}
                onChange={(e) => {
                  const arr = [...p.socialProjects] as [string, string];
                  arr[i] = e.target.value;
                  setP({ ...p, socialProjects: arr });
                }}
                placeholder="Project name..." />
            ))}
          </Stack>
        </FieldRow>
      </SectionCard>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 2 — GENERAL INFORMATION AND HISTORY
      ══════════════════════════════════════════════════════════════ */}
      <SectionCard number="2" title="General Information and History">

        {/* Contact Details */}
        <FieldRow>
          <FormLabel sx={{ fontWeight: 700, fontSize: 15, color: 'text.primary', display: 'block', mb: 1.5 }}>
            Contact Details
          </FormLabel>
          <Stack spacing={1.5}>
            <TextField size="small" fullWidth label="Phone Number"
              value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="+66 XX XXX XXXX" />
            <TextField size="small" fullWidth label="Email"
              value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="email@agency.com" />
            <TextField size="small" fullWidth label="Contact Person"
              value={contactPerson} onChange={(e) => setContactPerson(e.target.value)}
              placeholder={t('aif.contactPersonPlaceholder')} />
          </Stack>
        </FieldRow>

        <Divider sx={{ my: 2 }} />

        {/* Staff */}
        <FieldRow>
          <FormLabel sx={{ fontWeight: 700, fontSize: 15, color: 'text.primary', display: 'block', mb: 1 }}>
            Agency Staff
          </FormLabel>
          <TextField size="small" label="Number of staff in office"
            type="number" value={p.staffCount}
            onChange={(e) => setP({ ...p, staffCount: e.target.value })}
            sx={{ width: 220 }} />
        </FieldRow>

        <Divider sx={{ my: 2 }} />

        {/* Engagement */}
        <FieldRow>
          <FormLabel sx={{ fontWeight: 700, fontSize: 15, color: 'text.primary', display: 'block', mb: 1 }}>
            Agency Engagement
          </FormLabel>
          <YesNo label="Does the Agency bring customers to us?"
            value={p.bringCustomers} onChange={(v) => setP({ ...p, bringCustomers: v })} />
          <YesNo label="Does the Agency sell our products?"
            value={p.sellsForUs} onChange={(v) => setP({ ...p, sellsForUs: v })} />
        </FieldRow>

        <Divider sx={{ my: 2 }} />

        {/* Transaction History */}
        <FieldRow>
          <FormLabel sx={{ fontWeight: 700, fontSize: 15, color: 'text.primary', display: 'block', mb: 1 }}>
            Transaction History
          </FormLabel>
          <TextField size="small" type="date" label="Last sale date with us"
            value={p.lastSaleDate}
            onChange={(e) => setP({ ...p, lastSaleDate: e.target.value })}
            InputLabelProps={{ shrink: true }} sx={{ width: 240 }} />
        </FieldRow>

        <Divider sx={{ my: 2 }} />

        {/* Orientation */}
        <FieldRow>
          <FormLabel sx={{ fontWeight: 700, fontSize: 15, color: 'text.primary', display: 'block', mb: 1 }}>
            Orientation and Meetings
          </FormLabel>
          <YesNo
            label="Has the Agency attended an orientation or met with our management?"
            value={p.hadOrientation}
            onChange={(v) => setP({ ...p, hadOrientation: v })}
          />
        </FieldRow>
      </SectionCard>

      {/* Footer */}
      <Paper sx={{
        p: 2, borderRadius: 3, textAlign: 'center',
        '@media print': { borderRadius: 0, border: '1px solid #ccc' },
      }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="caption" color="text.secondary">
            Agency Care System — {agency?.code} · {agency?.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Date: ___________________________  Sales: ___________________________
          </Typography>
        </Stack>
      </Paper>

      {/* Save bar — hidden on print */}
      <Box sx={{ mt: 3, textAlign: 'center', '@media print': { display: 'none' } }}>
        <Button size="large" variant="contained" startIcon={<Save />}
          onClick={save} disabled={saving} sx={{ px: 6 }}>
          {saving ? t('aif.saving') : t('aif.saveData')}
        </Button>
      </Box>

      {/* Print styles */}
      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { margin: 1.5cm; size: A4; }
        }
      `}</style>
    </Box>
  );
}
