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

export default function AutoAssignPage() {
  const { t, lang } = useT();
  const [proposal, setProposal] = useState<ProposalRow[] | null>(null);
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [filterEmp, setFilterEmp] = useState<string | null>(null); // คลิกชื่อเพื่อฟิลเตอร์
  const [maxPerSales, setMaxPerSales] = useState('30'); // Phase 5: จำกัด/คน
  const [unassigned, setUnassigned] = useState(0);
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
      setUnassigned(data.unassigned ?? 0);
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
    setLoading(true);
    setMsg('');
    try {
      const assignments = proposal.map((p) => ({ agencyId: p.agencyId, employeeId: p.employeeId }));
      const { data } = await api.post('/auto-assign/apply', { assignments });
      setMsg(`ยืนยันการแบ่งแล้ว ${data.applied} ร้าน`);
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
            onChange={(e) => setMaxPerSales(e.target.value)}
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
                label={`${s.name}: ${s.count} ร้าน`}
                color={filterEmp === s.employeeId ? 'primary' : 'default'}
                variant={filterEmp === s.employeeId ? 'filled' : 'outlined'}
                onClick={() => setFilterEmp(filterEmp === s.employeeId ? null : s.employeeId)}
              />
            ))}
            {unassigned > 0 && (
              <Chip label={`${t('aa.unassigned')}: ${unassigned}`} color="warning" />
            )}
            {filterEmp && (
              <Chip label={t('aa.clearFilter')} color="error" variant="outlined" onClick={() => setFilterEmp(null)} />
            )}
          </Stack>
        </Paper>
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
                      <Chip size="small" color="success" label="ตรง" />
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
