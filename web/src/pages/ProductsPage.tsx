import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
  Alert,
  IconButton,
  Switch,
  FormControlLabel,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { api, errMsg } from '../api/client';
import { useT } from '../i18n';

interface Product {
  id: string;
  code: string;
  name: string;
  price: number;
  isActive: boolean;
}

const empty = { code: '', name: '', price: '' };
const emptyEdit = { name: '', price: '', isActive: true };

export default function ProductsPage() {
  const { t } = useT();
  const [rows, setRows] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...empty });
  const [error, setError] = useState('');

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState('');
  const [editForm, setEditForm] = useState({ ...emptyEdit });
  const [editError, setEditError] = useState('');

  const load = () => api.get('/products').then((r) => setRows(r.data));
  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    setError('');
    try {
      await api.post('/products', {
        code: form.code,
        name: form.name,
        price: form.price ? Number(form.price) : undefined,
      });
      setOpen(false);
      setForm({ ...empty });
      load();
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const openEdit = (p: Product) => {
    setEditId(p.id);
    setEditForm({ name: p.name, price: String(p.price), isActive: p.isActive });
    setEditError('');
    setEditOpen(true);
  };

  const saveEdit = async () => {
    setEditError('');
    try {
      await api.patch(`/products/${editId}`, {
        name: editForm.name,
        price: editForm.price ? Number(editForm.price) : undefined,
        isActive: editForm.isActive,
      });
      setEditOpen(false);
      load();
    } catch (e) {
      setEditError(errMsg(e));
    }
  };

  const remove = async (p: Product) => {
    if (!window.confirm(`${t('pr.deleteConfirm')} "${p.name}"?`)) return;
    try {
      await api.delete(`/products/${p.id}`);
      load();
    } catch (e) {
      alert(errMsg(e));
    }
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={700}>
          {t('pr.title')}
        </Typography>
        <Button variant="contained" onClick={() => setOpen(true)}>
          {t('pr.add')}
        </Button>
      </Stack>

      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('c.code')}</TableCell>
              <TableCell>{t('pr.name')}</TableCell>
              <TableCell align="right">{t('pr.price')}</TableCell>
              <TableCell>{t('pr.active')}</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{p.code}</TableCell>
                <TableCell>{p.name}</TableCell>
                <TableCell align="right">{p.price.toLocaleString()}</TableCell>
                <TableCell>{p.isActive ? t('pr.activeYes') : t('pr.activeNo')}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => openEdit(p)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" color="error" onClick={() => remove(p)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      {/* Create dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{t('pr.addTitle')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label={t('c.code')}
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              required
            />
            <TextField
              label={t('pr.name')}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <TextField
              label={t('pr.price')}
              type="number"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={save}>
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{t('pr.editTitle')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            {editError && <Alert severity="error">{editError}</Alert>}
            <TextField
              label={t('pr.name')}
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              required
            />
            <TextField
              label={t('pr.price')}
              type="number"
              value={editForm.price}
              onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                />
              }
              label={t('pr.active')}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={saveEdit}>
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
