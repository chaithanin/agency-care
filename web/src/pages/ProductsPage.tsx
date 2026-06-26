import { useEffect, useMemo, useState } from 'react';
import {
  Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, IconButton, InputAdornment, Link, Paper, Stack,
  Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField,
  Tooltip, Typography, Alert,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import LaunchIcon from '@mui/icons-material/Launch';
import SearchIcon from '@mui/icons-material/Search';
import { api, errMsg } from '../api/client';
import { useT } from '../i18n';

interface Product {
  id: string;
  code: string;
  name: string;
  price: number;
  isActive: boolean;
  description?: string | null;
  projectType?: string | null;
  unit?: string | null;
  quota?: number | null;
  marketingLink?: string | null;
}

const emptyForm = { code: '', name: '', price: '', description: '', projectType: '', unit: '', quota: '', marketingLink: '' };

export default function ProductsPage() {
  const { t } = useT();
  const [rows, setRows] = useState<Product[]>([]);
  const [searchQ, setSearchQ] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [formError, setFormError] = useState('');
  const [editId, setEditId] = useState('');
  const [editForm, setEditForm] = useState({ ...emptyForm, isActive: true as boolean });
  const [editOpen, setEditOpen] = useState(false);
  const [editError, setEditError] = useState('');

  const load = () => api.get('/products').then((r) => setRows(r.data));
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = searchQ.toLowerCase();
    if (!q) return rows;
    return rows.filter((p) =>
      p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) ||
      (p.projectType ?? '').toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q)
    );
  }, [rows, searchQ]);

  const save = async () => {
    setFormError('');
    try {
      await api.post('/products', {
        code: form.code, name: form.name,
        price: form.price ? Number(form.price) : undefined,
        description: form.description || undefined,
        projectType: form.projectType || undefined,
        unit: form.unit || undefined,
        quota: form.quota ? Number(form.quota) : undefined,
        marketingLink: form.marketingLink || undefined,
      });
      setOpen(false);
      setForm({ ...emptyForm });
      load();
    } catch (e) { setFormError(errMsg(e)); }
  };

  const openEdit = (p: Product) => {
    setEditId(p.id);
    setEditForm({
      code: p.code, name: p.name, price: String(p.price),
      description: p.description ?? '', projectType: p.projectType ?? '',
      unit: p.unit ?? '', quota: p.quota != null ? String(p.quota) : '',
      marketingLink: p.marketingLink ?? '', isActive: p.isActive,
    });
    setEditError('');
    setEditOpen(true);
  };

  const saveEdit = async () => {
    setEditError('');
    try {
      await api.patch(`/products/${editId}`, {
        name: editForm.name, price: editForm.price ? Number(editForm.price) : undefined,
        isActive: editForm.isActive, description: editForm.description || undefined,
        projectType: editForm.projectType || undefined, unit: editForm.unit || undefined,
        quota: editForm.quota ? Number(editForm.quota) : undefined,
        marketingLink: editForm.marketingLink || undefined,
      });
      setEditOpen(false);
      load();
    } catch (e) { setEditError(errMsg(e)); }
  };

  const remove = async (p: Product) => {
    if (!window.confirm(`${t('pr.deleteConfirm')} "${p.name}"?`)) return;
    try { await api.delete(`/products/${p.id}`); load(); } catch (e) { alert(errMsg(e)); }
  };

  const ProductForm = ({ f, onChange }: { f: typeof emptyForm; onChange: (v: typeof emptyForm) => void }) => (
    <Stack spacing={2} mt={1}>
      <Stack direction="row" spacing={2}>
        <TextField label={t('c.code')} value={f.code} onChange={(e) => onChange({ ...f, code: e.target.value })} required sx={{ flex: 1 }} />
        <TextField label={t('pr.name')} value={f.name} onChange={(e) => onChange({ ...f, name: e.target.value })} required sx={{ flex: 2 }} />
      </Stack>
      <Stack direction="row" spacing={2}>
        <TextField label={t('pr.price')} type="number" value={f.price} onChange={(e) => onChange({ ...f, price: e.target.value })} sx={{ flex: 1 }} />
        <TextField label={t('pr.unit')} value={f.unit} onChange={(e) => onChange({ ...f, unit: e.target.value })} sx={{ flex: 1 }} />
        <TextField label={t('pr.quota')} type="number" value={f.quota} onChange={(e) => onChange({ ...f, quota: e.target.value })} sx={{ flex: 1 }} />
      </Stack>
      <TextField label={t('pr.projectType')} value={f.projectType} onChange={(e) => onChange({ ...f, projectType: e.target.value })} />
      <TextField label={t('pr.description')} value={f.description} onChange={(e) => onChange({ ...f, description: e.target.value })} multiline minRows={2} />
      <TextField label={t('pr.marketingLink')} value={f.marketingLink} onChange={(e) => onChange({ ...f, marketingLink: e.target.value })}
        placeholder="https://..." InputProps={{ startAdornment: <InputAdornment position="start"><LaunchIcon fontSize="small" /></InputAdornment> }} />
    </Stack>
  );

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={1}>
        <Typography variant="h5" fontWeight={700}>{t('pr.title')}</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField size="small" placeholder={t('c.search')} value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
            sx={{ width: 220 }} />
          <Button variant="contained" onClick={() => setOpen(true)}>{t('pr.add')}</Button>
        </Stack>
      </Stack>

      <Paper sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('c.code')}</TableCell>
              <TableCell>{t('pr.name')}</TableCell>
              <TableCell>{t('pr.projectType')}</TableCell>
              <TableCell align="right">{t('pr.price')}</TableCell>
              <TableCell align="center">{t('pr.quota')}</TableCell>
              <TableCell>{t('pr.unit')}</TableCell>
              <TableCell>{t('pr.active')}</TableCell>
              <TableCell align="center">{t('pr.marketingLink')}</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((p) => (
              <TableRow key={p.id} hover>
                <TableCell><Typography variant="caption" fontFamily="monospace">{p.code}</Typography></TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight={600}>{p.name}</Typography>
                  {p.description && <Typography variant="caption" color="text.secondary" display="block" noWrap sx={{ maxWidth: 200 }}>{p.description}</Typography>}
                </TableCell>
                <TableCell>{p.projectType ? <Chip size="small" label={p.projectType} /> : '-'}</TableCell>
                <TableCell align="right">{p.price.toLocaleString()}</TableCell>
                <TableCell align="center">{p.quota ?? '-'}</TableCell>
                <TableCell>{p.unit ?? '-'}</TableCell>
                <TableCell>
                  <Chip size="small" label={p.isActive ? t('pr.activeYes') : t('pr.activeNo')}
                    color={p.isActive ? 'success' : 'default'} />
                </TableCell>
                <TableCell align="center">
                  {p.marketingLink ? (
                    <Tooltip title={p.marketingLink}>
                      <IconButton size="small" component={Link} href={p.marketingLink} target="_blank" rel="noopener">
                        <LaunchIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  ) : '-'}
                </TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => openEdit(p)}><EditIcon fontSize="small" /></IconButton>
                  <IconButton size="small" color="error" onClick={() => remove(p)}><DeleteIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ color: 'text.secondary', py: 3 }}>
                  {t('c.noData')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      {/* Create dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('pr.addTitle')}</DialogTitle>
        <DialogContent>
          {formError && <Alert severity="error" sx={{ mb: 1 }}>{formError}</Alert>}
          <ProductForm f={form} onChange={setForm} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={save}>{t('common.save')}</Button>
        </DialogActions>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('pr.editTitle')}</DialogTitle>
        <DialogContent>
          {editError && <Alert severity="error" sx={{ mb: 1 }}>{editError}</Alert>}
          <ProductForm f={editForm} onChange={(v) => setEditForm({ ...v, isActive: editForm.isActive })} />
          <FormControlLabel sx={{ mt: 1 }} control={
            <Switch checked={editForm.isActive} onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })} />
          } label={t('pr.active')} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={saveEdit}>{t('common.save')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
