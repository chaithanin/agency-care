import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Stack,
  TextField,
  Chip,
  LinearProgress,
  Button,
  Grid,
  Alert,
  Snackbar,
} from '@mui/material';
import { api, errMsg } from '../api/client';
import { PdfExportButton } from '../utils/pdf';
import { useT } from '../i18n';

interface TeamRow {
  teamId: string;
  code: string;
  name: string;
  zone: string | null;
  sales: number;
  closer: number;
  agencies: number;
  visitTarget: number;
  visited: number;
  remaining: number;
  progressPct: number;
}
interface Coverage {
  totalAgencies: number;
  pass: number;
  partial: number;
  none: number;
  coveragePct: number;
}
interface Office {
  date: string;
  need: { sales: number; closer: number };
  inOffice: { sales: string[]; closer: string[] };
  ok: boolean;
  warning: string | null;
}
interface NewAgencyRow {
  employeeId: string;
  name: string;
  code: string;
  target: number;
  actual: number;
  remaining: number;
  ok: boolean;
}
interface MonthlyRow {
  employeeId: string;
  name: string;
  team: string | null;
  inTraining: boolean;
  agencies: number;
  target: number;
  visited: number;
  remaining: number;
  pct: number;
  status: string;
}
interface LiveRow {
  employeeId: string;
  name: string;
  position: string;
  state: string;
  detail: string;
}
const statusEmoji: Record<string, string> = { green: '🟢', yellow: '🟡', red: '🔴', blue: '🔵', gray: '⚪' };

const thisMonth = () => new Date().toISOString().slice(0, 7);

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <Paper sx={{ p: 2, textAlign: 'center' }}>
      <Typography variant="h4" fontWeight={700} color={color}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Paper>
  );
}

export default function SchedulingPage() {
  const { t } = useT();
  const [month, setMonth] = useState(thisMonth());
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [office, setOffice] = useState<Office | null>(null);
  const [newAgency, setNewAgency] = useState<NewAgencyRow[]>([]);
  const [monthly, setMonthly] = useState<MonthlyRow[]>([]);
  const [live, setLive] = useState<LiveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const pdfRef = useRef<HTMLDivElement>(null);

  const ym = useCallback(() => {
    const [y, m] = month.split('-').map(Number);
    return { year: y, month: m };
  }, [month]);

  const load = useCallback(async () => {
    setLoading(true);
    const { year, month: m } = ym();
    try {
      const [td, cov, off, na, md, lv] = await Promise.all([
        api.get('/scheduling/team-dashboard', { params: { year, month: m } }),
        api.get('/scheduling/coverage', { params: { year, month: m } }),
        api.get('/scheduling/office'),
        api.get('/scheduling/new-agency', { params: { year, month: m } }),
        api.get('/scheduling/monthly-dashboard', { params: { year, month: m } }),
        api.get('/scheduling/live'),
      ]);
      setTeams(td.data.teams);
      setCoverage(cov.data);
      setOffice(off.data);
      setNewAgency(na.data.rows);
      setMonthly(md.data.rows);
      setLive(lv.data.rows);
    } catch (e) {
      setToast(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [ym]);

  useEffect(() => {
    load();
  }, [load]);

  const generate = async () => {
    setGenerating(true);
    try {
      const { year, month: m } = ym();
      const r = await api.post('/scheduling/generate-month', { year, month: m });
      setToast(
        r.data.error ??
          `สร้างแผนเดือนแล้ว: ${r.data.scheduledVisits} เยี่ยม · ครอบคลุม ${r.data.agenciesScheduled}/${r.data.agenciesAssigned} ร้าน`,
      );
      await load();
    } catch (e) {
      setToast(errMsg(e));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Box ref={pdfRef}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={1}>
        <Typography variant="h5" fontWeight={700}>
          {t('page.scheduling')}
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField type="month" size="small" value={month} onChange={(e) => setMonth(e.target.value)} />
          <Button className="no-pdf" variant="contained" onClick={generate} disabled={generating}>
            {generating ? 'กำลังสร้าง…' : '🤖 สร้างแผนเดือน (AI)'}
          </Button>
          <PdfExportButton targetRef={pdfRef} filename={`ตารางงาน-${month}.pdf`} />
        </Stack>
      </Stack>

      {loading ? (
        <LinearProgress />
      ) : (
        <Stack spacing={3}>
          {/* coverage summary */}
          {coverage && (
            <Grid container spacing={2}>
              <Grid item xs={6} md={3}>
                <StatCard label="Agency ทั้งหมด" value={coverage.totalAgencies} />
              </Grid>
              <Grid item xs={6} md={3}>
                <StatCard label="เยี่ยมครบ ≥2 (ผ่าน)" value={coverage.pass} color="success.main" />
              </Grid>
              <Grid item xs={6} md={3}>
                <StatCard label="เยี่ยม 1 (ขาดอีก 1)" value={coverage.partial} color="warning.main" />
              </Grid>
              <Grid item xs={6} md={3}>
                <StatCard label="ยังไม่ถูกเยี่ยม" value={coverage.none} color="error.main" />
              </Grid>
            </Grid>
          )}

          {/* office status */}
          {office && (
            <Alert severity={office.ok ? 'success' : 'warning'}>
              <b>คนประจำออฟฟิศวันนี้ ({office.date}):</b> Sales {office.inOffice.sales.length}/{office.need.sales} ·
              Closer {office.inOffice.closer.length}/{office.need.closer}
              {office.warning ? ` — ${office.warning}` : ' — ครบตามกฎ ✓'}
              {office.inOffice.sales.length + office.inOffice.closer.length > 0 && (
                <Typography variant="caption" display="block">
                  อยู่ออฟฟิศ: {[...office.inOffice.sales, ...office.inOffice.closer].join(', ') || '-'}
                </Typography>
              )}
            </Alert>
          )}

          {/* live status — เซลส์อยู่ไหนตอนนี้ */}
          {live.length > 0 && (
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" fontWeight={700} mb={1}>
                สถานะเรียลไทม์วันนี้
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {live.map((l) => (
                  <Chip key={l.employeeId} label={`${statusEmoji[l.state] ?? ''} ${l.name}: ${l.detail}`} variant="outlined" />
                ))}
              </Stack>
            </Paper>
          )}

          {/* Dashboard รายเดือน (ต่อเซลส์) */}
          <Paper>
            <Typography variant="subtitle1" fontWeight={700} sx={{ p: 2, pb: 1 }}>
              Dashboard รายเดือน (ต่อเซลส์)
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>เซลส์</TableCell>
                  <TableCell align="right">Agency ดูแล</TableCell>
                  <TableCell align="right">เป้าเยี่ยม</TableCell>
                  <TableCell align="right">เยี่ยมแล้ว</TableCell>
                  <TableCell align="right">คงเหลือ</TableCell>
                  <TableCell align="center">สถานะ</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {monthly.map((r) => (
                  <TableRow key={r.employeeId}>
                    <TableCell>
                      {r.name}{r.inTraining ? ' 🎓' : ''}
                      <Typography variant="caption" color="text.secondary" display="block">{r.team}</Typography>
                    </TableCell>
                    <TableCell align="right">{r.agencies}</TableCell>
                    <TableCell align="right">{r.target}</TableCell>
                    <TableCell align="right">{r.visited}</TableCell>
                    <TableCell align="right">{r.remaining}</TableCell>
                    <TableCell align="center">{statusEmoji[r.status]} {r.pct}%</TableCell>
                  </TableRow>
                ))}
                {monthly.length === 0 && (
                  <TableRow><TableCell colSpan={6} align="center" sx={{ color: 'text.secondary' }}>
                    ยังไม่มีแผน — กด "สร้างแผนเดือน (AI)"
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>

          {/* team dashboard */}
          <Paper>
            <Typography variant="subtitle1" fontWeight={700} sx={{ p: 2, pb: 1 }}>
              Team Dashboard
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>ทีม</TableCell>
                  <TableCell align="right">Sales</TableCell>
                  <TableCell align="right">Closer</TableCell>
                  <TableCell align="right">Agency</TableCell>
                  <TableCell align="right">เป้าเยี่ยม</TableCell>
                  <TableCell align="right">เยี่ยมแล้ว</TableCell>
                  <TableCell align="right">คงเหลือ</TableCell>
                  <TableCell align="center" sx={{ minWidth: 120 }}>ความคืบหน้า</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {teams.map((t) => (
                  <TableRow key={t.teamId}>
                    <TableCell>
                      <b>{t.name}</b>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {t.zone}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{t.sales}</TableCell>
                    <TableCell align="right">{t.closer}</TableCell>
                    <TableCell align="right">{t.agencies}</TableCell>
                    <TableCell align="right">{t.visitTarget}</TableCell>
                    <TableCell align="right">{t.visited}</TableCell>
                    <TableCell align="right">{t.remaining}</TableCell>
                    <TableCell align="center">
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(100, t.progressPct)}
                          sx={{ flexGrow: 1, height: 8, borderRadius: 4 }}
                        />
                        <Typography variant="caption">{t.progressPct}%</Typography>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {teams.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ color: 'text.secondary' }}>
                      ยังไม่มีทีม
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>

          {/* new agency targets */}
          <Paper>
            <Typography variant="subtitle1" fontWeight={700} sx={{ p: 2, pb: 1 }}>
              เป้าเพิ่ม Agency ใหม่ (เซลส์ละ 1-2/เดือน)
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>เซลส์</TableCell>
                  <TableCell align="right">เป้า</TableCell>
                  <TableCell align="right">เพิ่มแล้ว</TableCell>
                  <TableCell align="right">คงเหลือ</TableCell>
                  <TableCell align="center">สถานะ</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {newAgency.map((r) => (
                  <TableRow key={r.employeeId}>
                    <TableCell>
                      {r.name}{' '}
                      <Typography component="span" variant="caption" color="text.secondary">
                        ({r.code})
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{r.target}</TableCell>
                    <TableCell align="right">{r.actual}</TableCell>
                    <TableCell align="right">{r.remaining}</TableCell>
                    <TableCell align="center">
                      <Chip size="small" label={r.ok ? 'ผ่าน' : 'ยังขาด'} color={r.ok ? 'success' : 'warning'} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Stack>
      )}

      <Snackbar open={!!toast} autoHideDuration={5000} onClose={() => setToast(null)} message={toast ?? ''} />
    </Box>
  );
}
