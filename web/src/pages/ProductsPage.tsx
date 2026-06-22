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
} from '@mui/material';
import { api, errMsg } from '../api/client';
import { useT } from '../i18n';

interface Product {
  id: string;
  code: string;
  name: string;
  price: number;
}

const empty = { code: '', name: '', price: '' };

export default function ProductsPage() {
  const { t } = useT();
  const [rows, setRows] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...empty });
  const [error, setError] = useState('');

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
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{p.code}</TableCell>
                <TableCell>{p.name}</TableCell>
                <TableCell align="right">{p.price.toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

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
    </Box>
  );
}
