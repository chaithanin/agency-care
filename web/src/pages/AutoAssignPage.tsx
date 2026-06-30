import { useEffect, useMemo, useRef, useState } from 'react';
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
  Tab,
  Tabs,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import { api, errMsg } from '../api/client';
import { PdfExportButton } from '../utils/pdf';
import { useT } from '../i18n';

interface AssignmentHistory {
  id: string;
  assignedAt: string;
  agency: { id: string; code: string; name: string; zone?: string | null; province?: string | null };
  employee: { id: string; name: string; code: string };
}

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
  const [activeTab, setActiveTab] = useState(0);
  const [proposal, setProposal] = useState<ProposalRow[] | null>(null);
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [filterEmp, setFilterEmp] = useState<string | null>(null); // คลิกชื่อเพื่อฟิลเตอร์
  const [maxPerSales, setMaxPerSales] = useState(() => localStorage.getItem(MAX_PER_SALES_KEY) ?? '30'); // Phase 5: จำกัด/คน
  const [unassignedAgencies, setUnassignedAgencies] = useState<UnassignedAgency[]>([]);
  const [showUnassigned, setShowUnassigned] = useState(false);
  const [history, setHistory] = useState<AssignmentHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [yearlyYear, setYearlyYear] = useState(() => String(new Date().getFullYear() + 1));
  const [yearlyLoading, setYearlyLoading] = useState(false);
  const [yearlyMsg, setYearlyMsg] = useState('');
  const [yearlyErr, setYearlyErr] = useState('');
  const [proposalSearch, setProposalSearch] = useState('');
  const [proposalStatusFilter, setProposalStatusFilter] = useState('all');
  const pdfRef = useRef<HTMLDivElement>(null);

  const loadHistory = () => {
    setHistoryLoading(true);
    api.get('/auto-assign/history', { params: { limit: 300 } })
      .then((r) => setHistory(r.data.assignments ?? []))
      .finally(() => setHistoryLoading(false));
  };

  const generateYearly = async () => {
    setYearlyLoading(true); setYearlyMsg(''); setYearlyErr('');
    try {
      const { data } = await api.post('/auto-assign/yearly-plans', { year: Number(yearlyYear) });
      setYearlyMsg(`Plans created successfully: ${data.plansCreated} records from ${data.agenciesProcessed} agencies for year ${data.year}`);
    } catch (e) { setYearlyErr(errMsg(e)); }
    setYearlyLoading(false);
  };

  useEffect(() => {
    if (activeTab === 1) loadHistory();
  }, [activeTab]);

  // Filter proposal data based on search and status filters
  const filteredProposal = useMemo(() => {
    if (!proposal) return [];
    return proposal.filter((p) => {
      // Apply employee filter (from clicking summary chips)
      if (filterEmp && p.employeeId !== filterEmp) return false;

      // Apply search filter
      if (proposalSearch) {
        const q = proposalSearch.toLowerCase();
        const matchesSearch =
          p.agencyCode.toLowerCase().includes(q) ||
          p.agencyName.toLowerCase().includes(q) ||
          p.employeeName.toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }

      // Apply status filter
      if (proposalStatusFilter === 'matched') {
        if (!p.matchedZone) return false;
      } else if (proposalStatusFilter === 'unmatched') {
        if (p.matchedZone) return false;
      }

      return true;
    });
  }, [proposal, filterEmp, proposalSearch, proposalStatusFilter]);

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
      setProposalSearch('');
      setProposalStatusFilter('all');
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
        {activeTab === 0 && (
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
        )}
      </Stack>

      <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 2 }}>
        <Tab label={t('aa.propose')} />
        <Tab label="Assignment History" />
        <Tab label="Yearly Visit Plans" />
      </Tabs>

      {activeTab === 0 && (
        <>
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
            <>
              <Paper sx={{ p: 2, mb: 2 }}>
                <Typography variant="subtitle2" fontWeight={700} mb={2}>
                  {t('aa.filter') || 'Filters'}
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start">
                  <TextField
                    size="small"
                    label="Search Agency / Sales"
                    placeholder="Code, name, or sales..."
                    value={proposalSearch}
                    onChange={(e) => setProposalSearch(e.target.value)}
                    sx={{ minWidth: 250 }}
                  />
                  <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>Zone Match</InputLabel>
                    <Select
                      value={proposalStatusFilter}
                      onChange={(e) => setProposalStatusFilter(e.target.value)}
                      label="Zone Match"
                    >
                      <MenuItem value="all">All</MenuItem>
                      <MenuItem value="matched">Matched</MenuItem>
                      <MenuItem value="unmatched">Unmatched</MenuItem>
                    </Select>
                  </FormControl>
                  {(proposalSearch || proposalStatusFilter !== 'all') && (
                    <Button
                      size="small"
                      color="error"
                      variant="outlined"
                      onClick={() => {
                        setProposalSearch('');
                        setProposalStatusFilter('all');
                      }}
                    >
                      Clear Filters
                    </Button>
                  )}
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                    {filteredProposal.length} / {proposal.length} records
                  </Typography>
                </Stack>
              </Paper>

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
                    {filteredProposal.map((p) => (
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
                    {filteredProposal.length === 0 && proposal.length > 0 && (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ color: 'text.secondary', py: 3 }}>
                          No records match the selected filters
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Paper>
            </>
          )}
        </>
      )}

      {/* History Tab */}
      {activeTab === 1 && (
        <Box>
          <Stack direction="row" spacing={1} mb={2} alignItems="center">
            <TextField size="small" label="Search Agency / Sales / Zone" value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)} sx={{ minWidth: 280 }} />
            <Typography variant="caption" color="text.secondary">
              {history.length} records
            </Typography>
          </Stack>
          {historyLoading && <LinearProgress sx={{ mb: 1 }} />}
          <Paper>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Assigned Date</TableCell>
                  <TableCell>Agency</TableCell>
                  <TableCell>Zone</TableCell>
                  <TableCell>Province</TableCell>
                  <TableCell>Sales</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {history
                  .filter((h) => {
                    if (!historySearch) return true;
                    const q = historySearch.toLowerCase();
                    return (
                      h.agency.name.toLowerCase().includes(q) ||
                      h.agency.code.toLowerCase().includes(q) ||
                      h.employee.name.toLowerCase().includes(q) ||
                      (h.agency.zone ?? '').toLowerCase().includes(q)
                    );
                  })
                  .map((h) => (
                    <TableRow key={h.id} hover>
                      <TableCell>
                        <Typography variant="caption">{new Date(h.assignedAt).toLocaleDateString('en-GB')}</Typography>
                      </TableCell>
                      <TableCell>{h.agency.code} {h.agency.name}</TableCell>
                      <TableCell>{h.agency.zone || '-'}</TableCell>
                      <TableCell>{h.agency.province || '-'}</TableCell>
                      <TableCell>
                        <Chip size="small" label={`${h.employee.code} ${h.employee.name}`} />
                      </TableCell>
                    </TableRow>
                  ))}
                {history.length === 0 && !historyLoading && (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ color: 'text.secondary' }}>No history found</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>
        </Box>
      )}

      {/* Yearly Plans Tab */}
      {activeTab === 2 && (
        <Box>
          <Alert severity="info" sx={{ mb: 2 }}>
            Generate yearly visit plans by Agency tier: <b>Platinum</b>=12 visits, <b>Gold</b>=6 visits, <b>Silver/Bronze</b>=4 visits, <b>Standard</b>=2 visits
            — evenly distributed throughout the year, skipping Sundays automatically
          </Alert>
          <Stack direction="row" spacing={2} alignItems="center" mb={2}>
            <TextField
              label="Year (AD)"
              type="number"
              size="small"
              value={yearlyYear}
              onChange={(e) => setYearlyYear(e.target.value)}
              sx={{ width: 120 }}
            />
            <Button variant="contained" onClick={generateYearly} disabled={yearlyLoading || !yearlyYear}>
              {yearlyLoading ? 'Generating...' : `Generate Plans for ${yearlyYear}`}
            </Button>
          </Stack>
          {yearlyMsg && <Alert severity="success" sx={{ mb: 2 }}>{yearlyMsg}</Alert>}
          {yearlyErr && <Alert severity="error" sx={{ mb: 2 }}>{yearlyErr}</Alert>}
        </Box>
      )}
    </Box>
  );
}
