import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Chip,
  Avatar,
  LinearProgress,
  Grid,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TextField,
  Button,
} from '@mui/material';
import { api } from '../api/client';
import { PdfExportButton } from '../utils/pdf';
import { ExportPdfButton } from '../components/ExportPdfButton';
import { useT } from '../i18n';

interface Seller {
  id: string;
  name: string;
  code: string;
  position: string;
  inTraining: boolean;
  team?: { name: string } | null;
}
interface WeekDay {
  label: string;
  date: string;
  today: boolean;
  inOffice: boolean;
  items: { name: string; status: 'done' | 'plan' | 'miss' }[];
}
interface LbRow {
  rank: number;
  employeeId: string;
  name: string;
  visitsDone: number;
  agencies: number;
  newAgencies: number;
  me: boolean;
}
interface Perf {
  sellers: Seller[];
  selected: { id: string; name: string; position: string; inTraining: boolean; team: string | null } | null;
  kpis: { visitsDone: number; visitTarget: number; completionPct: number; agencies: number; newAgencies: number; newAgencyTarget: number };
  pipeline: { pass: number; partial: number; none: number; total: number };
  week: WeekDay[];
  leaderboard: LbRow[];
}

const initials = (n: string) => n.slice(0, 2).toUpperCase();
const statusColor: Record<string, string> = { done: '#1C7A62', plan: '#E8C77E', miss: '#B0593E' };

function Kpi({ value, sub, label, color }: { value: number | string; sub?: string; label: string; color?: string }) {
  return (
    <Paper sx={{ p: 1.5, textAlign: 'center', height: '100%' }}>
      <Typography variant="h5" fontWeight={700} color={color}>
        {value}
        {sub && <Typography component="span" variant="body2" color="text.secondary">/{sub}</Typography>}
      </Typography>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
    </Paper>
  );
}

export default function SellerPerformancePage() {
  const { t } = useT();
  const [data, setData] = useState<Perf | null>(null);
  const [selId, setSelId] = useState<string | undefined>();
  const pdfRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const load = useCallback(async (id?: string) => {
    const r = await api.get('/scheduling/seller-performance', { params: { employeeId: id } });
    setData(r.data);
  }, []);

  useEffect(() => {
    load(selId);
  }, [load, selId]);

  // Filter leaderboard data
  const filteredLeaderboard = useMemo(() => {
    if (!data?.leaderboard) return [];

    let result = [...data.leaderboard];

    // Text search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((r) => r.name.toLowerCase().includes(query));
    }

    // Date range filter - placeholder for future enhancement
    // Note: leaderboard doesn't have date info currently
    // In production, you'd filter based on actual date fields in LbRow
    if (startDate && endDate) {
      // TODO: Implement date-based filtering when data includes timestamps
    }

    return result;
  }, [data?.leaderboard, searchQuery, startDate, endDate]);

  const hasActiveFilters = searchQuery.trim() !== '' || startDate !== '' || endDate !== '';

  const handleResetFilters = () => {
    setSearchQuery('');
    setStartDate('');
    setEndDate('');
  };

  if (!data) return <LinearProgress />;
  if (!data.selected) return <Typography>{t('sp.noSeller')}</Typography>;

  const { kpis, pipeline } = data;
  const pp = pipeline.total || 1;
  const donut = `conic-gradient(#1C7A62 0 ${(pipeline.pass / pp) * 100}%, #E8C77E ${(pipeline.pass / pp) * 100}% ${((pipeline.pass + pipeline.partial) / pp) * 100}%, #E0E0E0 ${((pipeline.pass + pipeline.partial) / pp) * 100}% 100%)`;

  return (
    <Box ref={pdfRef}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={0.5}>
        <Box>
          <Typography variant="h5" fontWeight={700}>{t('page.sellerPerf')}</Typography>
          <Typography variant="caption" color="text.secondary">{t('sp.sub')}</Typography>
        </Box>
        <PdfExportButton targetRef={pdfRef} filename={`seller-${data.selected?.name ?? 'performance'}.pdf`} />
      </Stack>

      {/* seller selector */}
      <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', py: 2 }}>
        {data.sellers.map((s) => {
          const on = s.id === data.selected!.id;
          return (
            <Chip
              key={s.id}
              avatar={<Avatar sx={{ bgcolor: on ? 'primary.main' : 'grey.300' }}>{initials(s.name)}</Avatar>}
              label={`${s.name}${s.position === 'closer' ? ' (Closer)' : ''}${s.inTraining ? ' 🎓' : ''}`}
              color={on ? 'primary' : 'default'}
              variant={on ? 'filled' : 'outlined'}
              onClick={() => setSelId(s.id)}
              sx={{ flexShrink: 0 }}
            />
          );
        })}
      </Stack>

      {/* KPI row */}
      <Grid container spacing={1.5} mb={2}>
        <Grid item xs={6} md={3}>
          <Kpi value={kpis.visitsDone} sub={String(kpis.visitTarget)} label={t('my.visitMonth')} color="primary.main" />
        </Grid>
        <Grid item xs={6} md={3}>
          <Kpi value={`${kpis.completionPct}%`} label={t('sp.onTarget')} color={kpis.completionPct >= 80 ? 'success.main' : 'warning.main'} />
        </Grid>
        <Grid item xs={6} md={3}>
          <Kpi value={kpis.agencies} label={t('my.agencyDuty')} />
        </Grid>
        <Grid item xs={6} md={3}>
          <Kpi value={kpis.newAgencies} sub={String(kpis.newAgencyTarget)} label={t('sp.newAgency')} color={kpis.newAgencies >= kpis.newAgencyTarget ? 'success.main' : 'warning.main'} />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        {/* weekly schedule */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight={700} mb={1.5}>
              {t('sp.weekTable')}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ overflowX: 'auto' }}>
              {data.week.map((d) => (
                <Box
                  key={d.date}
                  sx={{
                    minWidth: 120,
                    flex: 1,
                    border: 1,
                    borderColor: d.today ? 'primary.main' : 'divider',
                    bgcolor: d.today ? 'primary.50' : 'background.paper',
                    borderRadius: 2,
                    p: 1,
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" sx={{ mb: 1, pb: 0.5, borderBottom: 1, borderColor: 'divider' }}>
                    <Typography variant="caption" fontWeight={700}>{d.label}</Typography>
                    <Typography variant="caption" color="text.secondary">{d.date}</Typography>
                  </Stack>
                  {d.inOffice && <Chip size="small" label={t('sp.officeDay')} sx={{ mb: 0.5, height: 18, fontSize: 10 }} color="info" />}
                  {d.items.length === 0 && !d.inOffice && (
                    <Typography variant="caption" color="text.disabled">—</Typography>
                  )}
                  {d.items.map((it, i) => (
                    <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                      <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: statusColor[it.status], flexShrink: 0 }} />
                      <Typography variant="caption" noWrap title={it.name}>{it.name}</Typography>
                    </Box>
                  ))}
                </Box>
              ))}
            </Stack>
            <Stack direction="row" spacing={2} mt={1.5}>
              {[['done', t('c.visited')], ['plan', t('sp.plan')], ['miss', t('sp.miss')]].map(([k, l]) => (
                <Stack key={k} direction="row" alignItems="center" spacing={0.5}>
                  <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: statusColor[k] }} />
                  <Typography variant="caption" color="text.secondary">{l}</Typography>
                </Stack>
              ))}
            </Stack>
          </Paper>
        </Grid>

        {/* pipeline donut */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="subtitle1" fontWeight={700} mb={1.5}>
              {t('sp.coverage')}
            </Typography>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Box sx={{ width: 96, height: 96, borderRadius: '50%', background: donut, position: 'relative', flexShrink: 0, display: 'grid', placeItems: 'center' }}>
                <Box sx={{ width: 58, height: 58, bgcolor: 'background.paper', borderRadius: '50%', display: 'grid', placeItems: 'center' }}>
                  <Typography variant="subtitle2" fontWeight={700}>{pipeline.total}</Typography>
                </Box>
              </Box>
              <Stack spacing={0.5} flexGrow={1}>
                {[['#1C7A62', t('sp.coverPass'), pipeline.pass], ['#E8C77E', t('sp.coverPartial'), pipeline.partial], ['#E0E0E0', t('sp.coverNone'), pipeline.none]].map(([c, l, v]) => (
                  <Stack key={l as string} direction="row" alignItems="center" spacing={1}>
                    <Box sx={{ width: 11, height: 11, borderRadius: 0.5, bgcolor: c as string }} />
                    <Typography variant="caption" flexGrow={1}>{l as string}</Typography>
                    <Typography variant="caption" fontWeight={700}>{v as number}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      {/* leaderboard with filters */}
      <Paper sx={{ mt: 2 }}>
        <Box sx={{ p: 2, pb: 0 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="subtitle1" fontWeight={700}>
              {t('sp.leaderboard')}
            </Typography>
            <Stack direction="row" spacing={1}>
              {hasActiveFilters && (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleResetFilters}
                >
                  Clear Filters
                </Button>
              )}
              <ExportPdfButton tableId="seller-perf-table" filename="seller-performance" title="Seller Performance" />
            </Stack>
          </Stack>

          {/* Filter controls */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} mb={2}>
            <TextField
              size="small"
              placeholder="Search seller name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{ flex: 1, minWidth: 200 }}
            />
            <TextField
              size="small"
              type="date"
              label="Start Date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 150 }}
            />
            <TextField
              size="small"
              type="date"
              label="End Date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 150 }}
            />
          </Stack>

          {/* Result count */}
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
            Showing {filteredLeaderboard.length} of {data.leaderboard.length} results
          </Typography>
        </Box>

        <Table id="seller-perf-table" size="small">
          <TableHead>
            <TableRow>
              <TableCell>#</TableCell>
              <TableCell>{t('c.seller')}</TableCell>
              <TableCell align="right">{t('sp.visits')}</TableCell>
              <TableCell align="right">Agency</TableCell>
              <TableCell align="right">{t('sp.new')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredLeaderboard.length > 0 ? (
              filteredLeaderboard.map((r) => (
                <TableRow key={r.employeeId} sx={{ bgcolor: r.me ? 'primary.50' : undefined }}>
                  <TableCell sx={{ fontWeight: 700, color: 'primary.main' }}>{r.rank}</TableCell>
                  <TableCell>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Avatar sx={{ width: 24, height: 24, fontSize: 11 }}>{initials(r.name)}</Avatar>
                      <span>{r.name}{r.me ? ` (${t('sp.you')})` : ''}</span>
                    </Stack>
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{r.visitsDone}</TableCell>
                  <TableCell align="right">{r.agencies}</TableCell>
                  <TableCell align="right">{r.newAgencies}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} sx={{ textAlign: 'center', py: 3 }}>
                  <Typography color="text.secondary">No results found</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
