import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip,
  Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, InputLabel, LinearProgress, MenuItem,
  Paper, Select, Stack, Tab, Table, TableBody, TableCell,
  TableHead, TablePagination, TableRow, Tabs, TextField, Tooltip, Typography,
} from '@mui/material';
import {
  Add, ErrorOutline, Inventory2, ListAlt,
  People, Refresh, WarningAmber,
} from '@mui/icons-material';
import { api, errMsg } from '../api/client';
import { useT } from '../i18n';

// ─── Types ───────────────────────────────────────────────────────────────────
interface InvItem {
  id: string; code: string; name: string;
  category: string; description?: string | null;
  unit: string; stockQty: number; reorderPoint: number;
  used30: number; low: boolean; urgent: boolean;
}

interface DistLog {
  id: string; date: string; quantity: number;
  item: { code: string; name: string; unit: string; category: string };
  agency: { id: string; code: string; name: string };
  employee: { name: string; code: string };
  visitPlanId: string;
}

interface AgRow {
  id: string; code: string; name: string; zone?: string | null;
  materials: Record<string, { qty: number; unit: string; category: string }>;
  total: number; lastGiven: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().slice(0, 10);
const monthAgoStr = () => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 10); };
const fmtDate = (d: string) => new Date(d).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' });

const CATEGORY_LABEL: Record<string, string> = {
  display: 'Display', printed: 'Printed', gift: 'Gift', general: 'General',
};
const CATEGORY_COLOR: Record<string, 'primary' | 'secondary' | 'success' | 'default'> = {
  display: 'primary', printed: 'success', gift: 'secondary', general: 'default',
};
const CATEGORIES = ['display', 'printed', 'gift', 'general'];

function StockBar({ qty, reorder }: { qty: number; reorder: number }) {
  if (!reorder) return null;
  const pct = Math.min(100, Math.round((qty / (reorder * 2)) * 100));
  const color = qty <= reorder * 0.5 ? 'error' : qty <= reorder ? 'warning' : 'success';
  return (
    <Tooltip title={`${qty} / min ${reorder}`}>
      <LinearProgress variant="determinate" value={pct} color={color}
        sx={{ height: 6, borderRadius: 3, width: 80 }} />
    </Tooltip>
  );
}

// ─── Tab 1: Stock Overview ────────────────────────────────────────────────────
function StockTab() {
  const { t } = useT();
  const [data, setData] = useState<{ lowStockCount: number; urgentCount: number; items: InvItem[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [catFilter, setCatFilter] = useState('all');

  // Add item dialog
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', category: 'general', description: '', unit: '', stockQty: '', reorderPoint: '' });
  const [addErr, setAddErr] = useState('');

  // Manage dialog (refill + reorder point)
  const [manageFor, setManageFor] = useState<InvItem | null>(null);
  const [delta, setDelta] = useState('');
  const [rp, setRp] = useState('');
  const [manErr, setManErr] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get('/posm/inventory').then((r) => setData(r.data)).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setAddErr('');
    try {
      await api.post('/posm/items', {
        code: form.code, name: form.name,
        category: form.category || undefined,
        description: form.description || undefined,
        unit: form.unit || undefined,
        stockQty: form.stockQty ? Number(form.stockQty) : undefined,
        reorderPoint: form.reorderPoint ? Number(form.reorderPoint) : undefined,
      });
      setAddOpen(false);
      setForm({ code: '', name: '', category: 'general', description: '', unit: '', stockQty: '', reorderPoint: '' });
      load();
    } catch (e) { setAddErr(errMsg(e)); }
  };

  const openManage = (it: InvItem) => {
    setManageFor(it); setDelta(''); setRp(String(it.reorderPoint)); setManErr('');
  };

  const saveManage = async () => {
    if (!manageFor) return; setManErr('');
    try {
      if (delta && Number(delta) !== 0) await api.post(`/posm/items/${manageFor.id}/adjust`, { delta: Number(delta) });
      if (rp !== '' && Number(rp) !== manageFor.reorderPoint) await api.patch(`/posm/items/${manageFor.id}`, { reorderPoint: Number(rp) });
      setManageFor(null); load();
    } catch (e) { setManErr(errMsg(e)); }
  };

  const items = data?.items.filter((it) => catFilter === 'all' || it.category === catFilter) ?? [];

  // Group by category for display
  const grouped = CATEGORIES.map((cat) => ({
    cat,
    rows: items.filter((it) => it.category === cat),
  })).filter((g) => g.rows.length > 0);

  return (
    <Box>
      {/* Alerts */}
      {(data?.urgentCount ?? 0) > 0 && (
        <Alert severity="error" icon={<ErrorOutline />} sx={{ mb: 1.5 }}>
          🚨 <strong>{data!.urgentCount} {t('posm.items')}</strong> {t('posm.urgentAlert')}
        </Alert>
      )}
      {(data?.lowStockCount ?? 0) > 0 && (data?.urgentCount ?? 0) === 0 && (
        <Alert severity="warning" icon={<WarningAmber />} sx={{ mb: 1.5 }}>
          ⚠️ <strong>{data!.lowStockCount} {t('posm.items')}</strong> {t('posm.lowAlert2')}
        </Alert>
      )}

      {/* Controls */}
      <Stack direction="row" spacing={1} alignItems="center" mb={2} flexWrap="wrap" useFlexGap>
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>{t('posm.category')}</InputLabel>
          <Select value={catFilter} label={t('posm.category')} onChange={(e) => setCatFilter(e.target.value)}>
            <MenuItem value="all">{t('posm.all')}</MenuItem>
            {CATEGORIES.map((c) => <MenuItem key={c} value={c}>{CATEGORY_LABEL[c]}</MenuItem>)}
          </Select>
        </FormControl>
        <Button startIcon={<Refresh />} onClick={load} disabled={loading}>{t('posm.refresh')}</Button>
        <Box flex={1} />
        <Button variant="contained" startIcon={<Add />} onClick={() => { setAddErr(''); setAddOpen(true); }}>
          {t('posm.addItem')}
        </Button>
      </Stack>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {/* Tables by category */}
      {grouped.map(({ cat, rows }) => (
        <Paper key={cat} sx={{ mb: 3, borderRadius: 3 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Chip size="small" color={CATEGORY_COLOR[cat]} label={CATEGORY_LABEL[cat]} />
            <Typography variant="caption" color="text.secondary">{rows.length} {t('posm.items')}</Typography>
          </Stack>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 700, fontSize: 12 } }}>
                <TableCell>{t('posm.codeAndName')}</TableCell>
                <TableCell>{t('posm.stock')}</TableCell>
                <TableCell>{t('posm.minStockCol')}</TableCell>
                <TableCell>{t('c.status')}</TableCell>
                <TableCell align="right">{t('posm.used30')}</TableCell>
                <TableCell align="right">{t('c.manage')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id} hover
                  sx={{ bgcolor: p.urgent ? 'error.50' : p.low ? 'warning.50' : undefined }}>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{p.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{p.code} · {p.unit}</Typography>
                    {p.description && <Typography variant="caption" color="text.disabled" display="block">{p.description}</Typography>}
                  </TableCell>
                  <TableCell>
                    <Typography fontWeight={800} color={p.urgent ? 'error.main' : p.low ? 'warning.main' : 'success.main'}>
                      {p.stockQty}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">{p.reorderPoint || '—'}</Typography>
                    <StockBar qty={p.stockQty} reorder={p.reorderPoint} />
                  </TableCell>
                  <TableCell>
                    {p.urgent
                      ? <Chip size="small" color="error" label={`🚨 ${t('posm.statusCritical')}`} />
                      : p.low
                        ? <Chip size="small" color="warning" label={`⚠️ ${t('posm.statusLow')}`} />
                        : <Chip size="small" color="success" label={`✓ ${t('posm.statusOk')}`} />}
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">{p.used30}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => openManage(p)}>{t('posm.refill')}</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      ))}

      {/* Add Item Dialog */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('posm.addDialogTitle')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            {addErr && <Alert severity="error">{addErr}</Alert>}
            <Stack direction="row" spacing={2}>
              <TextField label={t('c.code')} value={form.code} required sx={{ flex: 1 }}
                onChange={(e) => setForm({ ...form, code: e.target.value })} />
              <FormControl sx={{ flex: 1 }}>
                <InputLabel>{t('posm.category')}</InputLabel>
                <Select value={form.category} label={t('posm.category')}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map((c) => <MenuItem key={c} value={c}>{CATEGORY_LABEL[c]}</MenuItem>)}
                </Select>
              </FormControl>
            </Stack>
            <TextField label={t('posm.itemName')} value={form.name} required
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="X-Stand, Brochure EN, Gift Box" />
            <TextField label={t('posm.descriptionOpt')} value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={t('posm.descriptionPh')} />
            <Stack direction="row" spacing={2}>
              <TextField label={t('posm.unit')} value={form.unit} sx={{ flex: 1 }}
                onChange={(e) => setForm({ ...form, unit: e.target.value })} />
              <TextField label={t('posm.initialStock')} type="number" value={form.stockQty} sx={{ flex: 1 }}
                onChange={(e) => setForm({ ...form, stockQty: e.target.value })} />
              <TextField label={t('posm.minStockLabel')} type="number" value={form.reorderPoint} sx={{ flex: 1 }}
                onChange={(e) => setForm({ ...form, reorderPoint: e.target.value })} />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={save} disabled={!form.code || !form.name}>{t('common.save')}</Button>
        </DialogActions>
      </Dialog>

      {/* Manage Stock Dialog */}
      <Dialog open={!!manageFor} onClose={() => setManageFor(null)} fullWidth maxWidth="sm">
        <DialogTitle>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <span>{manageFor?.name}</span>
            <Chip size="small" color={manageFor?.urgent ? 'error' : manageFor?.low ? 'warning' : 'success'}
              label={`${t('posm.stock')} ${manageFor?.stockQty} ${manageFor?.unit}`} />
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} mt={1}>
            {manErr && <Alert severity="error">{manErr}</Alert>}
            {manageFor?.low && (
              <Alert severity={manageFor.urgent ? 'error' : 'warning'}>
                {manageFor.urgent ? `🚨 ${t('posm.alertCritical')}` : `⚠️ ${t('posm.alertLow')}`}
              </Alert>
            )}
            <TextField
              label={t('posm.adjustLabel')}
              type="number"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              placeholder={t('posm.adjustPh')}
              helperText={delta && Number(delta) !== 0
                ? `${t('posm.newStockWillBe')}: ${(manageFor?.stockQty ?? 0) + Number(delta)} ${manageFor?.unit}`
                : t('posm.adjustHint')}
            />
            <TextField
              label={t('posm.minStockLevel')}
              type="number"
              value={rp}
              onChange={(e) => setRp(e.target.value)}
              helperText={t('posm.minStockHint')}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setManageFor(null)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={saveManage}>{t('common.save')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ─── Tab 2: Agency Distribution Summary ──────────────────────────────────────
function AgencyTab() {
  const { t } = useT();
  const [from, setFrom] = useState(monthAgoStr());
  const [to, setTo] = useState(todayStr());
  const [rows, setRows] = useState<AgRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/posm/agency-summary', { params: { from, to } })
      .then((r) => setRows(r.data))
      .finally(() => setLoading(false));
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const filtered = rows.filter((r) =>
    !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.code.toLowerCase().includes(search.toLowerCase()),
  );

  const totalItems = rows.reduce((s, r) => s + r.total, 0);
  const totalAgencies = rows.length;

  return (
    <Box>
      {/* Controls */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center" flexWrap="wrap">
          <TextField size="small" type="date" label={t('posm.from')} value={from}
            onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField size="small" type="date" label={t('posm.to')} value={to}
            onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
          <Button variant="contained" onClick={load} startIcon={<Refresh />}>{t('posm.viewData')}</Button>
          <TextField size="small" placeholder={t('posm.searchAgency')} value={search}
            onChange={(e) => setSearch(e.target.value)} sx={{ minWidth: 200 }} />
        </Stack>
      </Paper>

      {/* Summary KPIs */}
      <Stack direction="row" gap={2} mb={3} flexWrap="wrap">
        <Paper sx={{ p: 2, flex: 1, minWidth: 160, borderRadius: 3, textAlign: 'center' }}>
          <Typography variant="h5" fontWeight={800}>{totalAgencies}</Typography>
          <Typography variant="caption" color="text.secondary">{t('posm.agenciesReceived')}</Typography>
        </Paper>
        <Paper sx={{ p: 2, flex: 1, minWidth: 160, borderRadius: 3, textAlign: 'center' }}>
          <Typography variant="h5" fontWeight={800}>{totalItems}</Typography>
          <Typography variant="caption" color="text.secondary">{t('posm.totalDistributed')}</Typography>
        </Paper>
        <Paper sx={{ p: 2, flex: 1, minWidth: 160, borderRadius: 3, textAlign: 'center' }}>
          <Typography variant="h5" fontWeight={800}>
            {totalAgencies > 0 ? (totalItems / totalAgencies).toFixed(1) : 0}
          </Typography>
          <Typography variant="caption" color="text.secondary">{t('posm.avgPerAgency')}</Typography>
        </Paper>
      </Stack>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {/* Agency table */}
      {filtered.length > 0 && (
        <Paper sx={{ borderRadius: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 700, fontSize: 12 } }}>
                <TableCell>#</TableCell>
                <TableCell>Agency</TableCell>
                <TableCell>{t('c.zone')}</TableCell>
                <TableCell align="center">{t('posm.totalMedia')}</TableCell>
                <TableCell align="center">{t('posm.lastDate')}</TableCell>
                <TableCell align="right">{t('posm.detail')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((r, i) => (
                <>
                  <TableRow key={r.id} hover sx={{ cursor: 'pointer' }}
                    onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}>
                    <TableCell><Typography variant="caption" color="text.secondary">{i + 1}</Typography></TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{r.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{r.code}</Typography>
                    </TableCell>
                    <TableCell><Typography variant="caption">{r.zone ?? '—'}</Typography></TableCell>
                    <TableCell align="center">
                      <Chip size="small" label={r.total} color="primary" />
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="caption">{r.lastGiven ? fmtDate(r.lastGiven) : '—'}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small">{expandedId === r.id ? `${t('posm.hide')} ▲` : `${t('posm.view')} ▼`}</Button>
                    </TableCell>
                  </TableRow>
                  {expandedId === r.id && (
                    <TableRow key={`${r.id}-detail`}>
                      <TableCell colSpan={6} sx={{ bgcolor: 'action.hover', px: 4, py: 1.5 }}>
                        <Stack direction="row" flexWrap="wrap" gap={1}>
                          {Object.entries(r.materials)
                            .sort((a, b) => b[1].qty - a[1].qty)
                            .map(([name, { qty, unit, category }]) => (
                              <Chip key={name} size="small"
                                color={CATEGORY_COLOR[category] ?? 'default'}
                                variant="outlined"
                                label={`${name}: ${qty} ${unit}`} />
                            ))}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
      {!loading && filtered.length === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
          <Typography color="text.secondary">{t('posm.noDistrib')}</Typography>
        </Paper>
      )}
    </Box>
  );
}

// ─── Tab 3: Distribution Log ──────────────────────────────────────────────────
function LogTab() {
  const { t } = useT();
  const [from, setFrom] = useState(monthAgoStr());
  const [to, setTo] = useState(todayStr());
  const [rows, setRows] = useState<DistLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<{ id: string; name: string }[]>([]);
  const [itemFilter, setItemFilter] = useState('');
  // MUI TablePagination uses 0-based page index
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);

  const load = useCallback((pg: number, rpp: number) => {
    setLoading(true);
    api.get('/posm/distribution-log', {
      params: { from, to, itemId: itemFilter || undefined, page: pg + 1, limit: rpp },
    })
      .then((r) => {
        setRows(r.data.data);
        setTotal(r.data.total);
      })
      .finally(() => setLoading(false));
  }, [from, to, itemFilter]);

  // Reset to page 0 and reload when filters change
  const handleSearch = () => {
    setPage(0);
    load(0, rowsPerPage);
  };

  useEffect(() => {
    api.get('/posm/items').then((r) => setItems(r.data));
  }, []);

  useEffect(() => {
    load(page, rowsPerPage);
  }, [load, page, rowsPerPage]);

  const quantityTotal = rows.reduce((s, r) => s + r.quantity, 0);

  return (
    <Box>
      {/* Controls */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center" flexWrap="wrap">
          <TextField size="small" type="date" label={t('posm.from')} value={from}
            onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField size="small" type="date" label={t('posm.to')} value={to}
            onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>{t('posm.filterMedia')}</InputLabel>
            <Select value={itemFilter} label={t('posm.filterMedia')}
              onChange={(e) => setItemFilter(e.target.value)}>
              <MenuItem value="">{t('posm.all')}</MenuItem>
              {items.map((it) => <MenuItem key={it.id} value={it.id}>{it.name}</MenuItem>)}
            </Select>
          </FormControl>
          <Button variant="contained" onClick={handleSearch} startIcon={<Refresh />}>{t('posm.viewData')}</Button>
          {total > 0 && (
            <Typography variant="caption" color="text.secondary">
              {total} {t('posm.items')} · {t('posm.total')} {quantityTotal} {t('posm.pieces')}
            </Typography>
          )}
        </Stack>
      </Paper>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {rows.length > 0 && (
        <Paper sx={{ borderRadius: 3 }}>
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ '& th': { fontWeight: 700, fontSize: 12 } }}>
                  <TableCell>{t('pl2.date')}</TableCell>
                  <TableCell>Agency</TableCell>
                  <TableCell>{t('posm.media')}</TableCell>
                  <TableCell>{t('posm.category')}</TableCell>
                  <TableCell align="center">{t('va.qty')}</TableCell>
                  <TableCell>{t('c.seller')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell>
                      <Typography variant="caption">{fmtDate(r.date)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: 200 }}>{r.agency.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{r.agency.code}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{r.item.name}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" color={CATEGORY_COLOR[r.item.category] ?? 'default'}
                        label={CATEGORY_LABEL[r.item.category] ?? r.item.category} />
                    </TableCell>
                    <TableCell align="center">
                      <Chip size="small" label={`${r.quantity} ${r.item.unit}`} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">{r.employee.name}</Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
          <TablePagination
            component="div"
            count={total}
            page={page}
            rowsPerPage={rowsPerPage}
            rowsPerPageOptions={[25, 50, 100]}
            onPageChange={(_, newPage) => setPage(newPage)}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(Number(e.target.value));
              setPage(0);
            }}
          />
        </Paper>
      )}
      {!loading && rows.length === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
          <Typography color="text.secondary">{t('posm.noDistrib')}</Typography>
        </Paper>
      )}
    </Box>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PosmPage() {
  const { t } = useT();
  const [tab, setTab] = useState(0);
  const [lowCount, setLowCount] = useState(0);

  useEffect(() => {
    api.get('/posm/inventory').then((r) => setLowCount(r.data.lowStockCount)).catch(() => {});
  }, []);

  return (
    <Box>
      <Typography variant="h5" fontWeight={800} mb={3}>{t('posm.title')}</Typography>

      <Paper sx={{ borderRadius: 3, mb: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
          <Tab icon={<Inventory2 fontSize="small" />} iconPosition="start"
            label={
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <span>{t('posm.tabStock')}</span>
                {lowCount > 0 && (
                  <Chip size="small" color="warning" label={lowCount} sx={{ height: 18, fontSize: 10 }} />
                )}
              </Stack>
            } />
          <Tab icon={<People fontSize="small" />} iconPosition="start" label={t('posm.tabByAgency')} />
          <Tab icon={<ListAlt fontSize="small" />} iconPosition="start" label={t('posm.tabLog')} />
        </Tabs>
      </Paper>

      <Box hidden={tab !== 0}><StockTab /></Box>
      <Box hidden={tab !== 1}><AgencyTab /></Box>
      <Box hidden={tab !== 2}><LogTab /></Box>
    </Box>
  );
}
