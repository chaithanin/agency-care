import { useRef, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
  Alert,
  LinearProgress,
  TextField,
  Collapse,
} from '@mui/material';
import { api, errMsg } from '../api/client';
import { PdfExportButton } from '../utils/pdf';
import { useT } from '../i18n';

interface ProposalRow {
  agencyId: string;
  agencyCode: string;
  agencyName: string;
  zone?: string;
  employeeId: string;
  employeeName: string;
  matchedZone: boolean;
}
interface SummaryRow {
  employeeId: string;
  name: string;
  count: number;
}
interface UnassignedAgency {
  id: string;
  code: string;
  name: string;
  zone?: string | null;
}

const MAX_PER_SALES_KEY = 'autoAssign.maxPerSales';

export default function AutoAssignPage() {
  const { t, lang } = useT();
  const [proposal, setProposal] = useState<ProposalRow[] | null>(null);
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [filterEmp, setFilterEmp] = useState<string | null>(null); // คลิกชื่อเพื่อฟิลเตอร์
  const [maxPerSales, setMaxPerSales] = useState(() => localStorage.getItem(MAX_PER_SALES_KEY) ?? '30'); // Phase 5: จำกัด/คน
  const [unassignedAgencies, setUnassignedAgencies] = useState<UnassignedAgency[]>([]);
  const [showUnassigned, setShowUnassigned] = useState(false);
  const pdfRef = useRef<HTMLDivElement>(null);

  const propose = async () => {
    setLoading(true);
    setMsg('');
    try {
      const { data } = await api.get('/auto-assign/propose', {
        params: maxPerSales ? { maxPerSales } : {},
      });
      setProposal(data.proposal);
      setSummary(data.summary);
      setUnassignedAgencies(data.unassignedAgencies ?? []);
      setShowUnassigned(false);
      setFilterEmp(null);
      if (data.note) setMsg(data.note);
    } catch (e) {
      setMsg(errMsg(e));
    } finally {
      setLoading(false);
    }
  };

  const apply = async () => {
    if (!proposal) return;
    const confirmed = window.confirm(
      lang === 'th'
        ? `ยืนยันการแบ่ง Agency ${proposal.filter((p) => p.employeeId).length} ร้านให้เซลส์? การกระทำนี้จะเปลี่ยน Assignment ที่มีอยู่`
        : `Apply assignment for ${proposal.filter((p) => p.employeeId).length} agencies? This will replace existing assignments.`
    );
    if (!confirmed) return;
    setLoading(true);
    setMsg('');
    try {
      const assignments = proposal.map((p) => ({ agencyId: p.agencyId, employeeId: p.employeeId }));
      const { data } = await api.post('/auto-assign/apply', { assignments });
      setMsg(lang === 'th' ? `ยืนยันการแบ่งแล้ว ${data.applied} ร้าน` : `Applied to ${data.applied} agencies`);
      setProposal(null);
    } catch (e) {
      setMsg(errMsg(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box ref={pdfRef}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={700}>
          {t('page.autoassign')}
        </Typography>
        <Stack direction="row" spacing={1} className="no-pdf" alignItems="center">
          <TextField
            label={t('aa.limit')}
            type="number"
            size="small"
            value={maxPerSales}
            onChange={(e) => {
              setMaxPerSales(e.target.value);
              localStorage.setItem(MAX_PER_SALES_KEY, e.target.value);
            }}
            sx={{ width: 110 }}
          />
          <Button variant="outlined" onClick={propose} disabled={loading}>
            {t('aa.propose')}
          </Button>
          {proposal && (
            <Button variant="contained" color="success" onClick={apply} disabled={loading}>
              {t('aa.apply')}
            </Button>
          )}
          {summary.length > 0 && <PdfExportButton targetRef={pdfRef} filename="จัดทีม-AI.pdf" />}
        </Stack>
      </Stack>

      <Typography variant="body2" color="text.secondary" mb={2}>
        {lang === 'th'
          ? <>แบ่ง Agency ให้เฉพาะ <b>Sales</b> (ไม่รวม Closer) บาลานซ์ตามโซน — จำกัด {maxPerSales || '∞'} ร้าน/คน ตามกฎ Phase 5</>
          : <>Distribute agencies to <b>Sales</b> only (no Closers), balanced by zone — limit {maxPerSales || '∞'}/person (Phase 5)</>}
      </Typography>

      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {msg && (
        <Alert severity="info" sx={{ mb: 2 }} onClose={() => setMsg('')}>
          {msg}
        </Alert>
      )}

      {summary.length > 0 && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle1" fontWeight={700} mb={1}>
            {t('aa.summary')}{' '}
            <Typography component="span" variant="caption" color="text.secondary">
              {t('aa.clickFilter')}
            </Typography>
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {summary.map((s) => (
              <Chip
                key={s.employeeId}
                label={`${s.name}: ${s.count}`}
                color={filterEmp === s.employeeId ? 'primary' : 'default'}
                variant={filterEmp === s.employeeId ? 'filled' : 'outlined'}
                onClick={() => setFilterEmp(filterEmp === s.employeeId ? null : s.employeeId)}
              />
            ))}
            {unassignedAgencies.length > 0 && (
              <Chip
                label={`${t('aa.unassigned')}: ${unassignedAgencies.length}`}
                color="warning"
                onClick={() => setShowUnassigned((v) => !v)}
              />
            )}
            {filterEmp && (
              <Chip label={t('aa.clearFilter')} color="error" variant="outlined" onClick={() => setFilterEmp(null)} />
            )}
          </Stack>
        </Paper>
      )}

      {unassignedAgencies.length > 0 && (
        <Collapse in={showUnassigned}>
          <Paper sx={{ p: 2, mb: 2, border: '1px solid', borderColor: 'warning.main' }}>
            <Typography variant="subtitle2" fontWeight={700} color="warning.dark" mb={1}>
              {t('aa.unassignedAgencies')} ({unassignedAgencies.length})
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('aa.colCode')}</TableCell>
                  <TableCell>{t('aa.colName')}</TableCell>
                  <TableCell>{t('c.zone')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {unassignedAgencies.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{a.code}</TableCell>
                    <TableCell>{a.name}</TableCell>
                    <TableCell>{a.zone || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Collapse>
      )}

      {proposal && (
        <Paper>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Agency</TableCell>
                <TableCell>{t('c.zone')}</TableCell>
                <TableCell>{t('aa.proposed')}</TableCell>
                <TableCell>{t('aa.zoneMatch')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {proposal
                .filter((p) => !filterEmp || p.employeeId === filterEmp)
                .map((p) => (
                <TableRow key={p.agencyId}>
                  <TableCell>
                    {p.agencyCode} — {p.agencyName}
                  </TableCell>
                  <TableCell>{p.zone || '-'}</TableCell>
                  <TableCell>{p.employeeName}</TableCell>
                  <TableCell>
                    {p.matchedZone ? (
                      <Chip size="small" color="success" label={t('aa.zoneMatchLabel')} />
                    ) : (
                      <Chip size="small" label="-" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  );
}
