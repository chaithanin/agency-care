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
  Chip,
  Alert,
} from '@mui/material';
import { api, errMsg } from '../api/client';

interface PosmItem {
  id: string;
  code: string;
  name: string;
  unit: string;
  stockQty: number;
}

const empty = { code: '', name: '', unit: 'ชิ้น', stockQty: '' };

export default function PosmPage() {
  const [rows, setRows] = useState<PosmItem[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...empty });
  const [error, setError] = useState('');

  const load = () => api.get('/posm/items').then((r) => setRows(r.data));
  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    setError('');
    try {
      await api.post('/posm/items', {
        code: form.code,
        name: form.name,
        unit: form.unit || undefined,
        stockQty: form.stockQty ? Number(form.stockQty) : undefined,
      });
      setOpen(false);
      setForm({ ...empty });
      load();
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const restock = async (item: PosmItem) => {
    const v = window.prompt(`ตั้งสต็อกใหม่ของ ${item.name}`, String(item.stockQty));
    if (v == null) return;
    await api.patch(`/posm/items/${item.id}`, { stockQty: Number(v) });
    load();
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={700}>
          คลังสื่อ POSM
        </Typography>
        <Button variant="contained" onClick={() => setOpen(true)}>
          + เพิ่มสื่อ
        </Button>
      </Stack>

      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>รหัส</TableCell>
              <TableCell>ชื่อสื่อ</TableCell>
              <TableCell>หน่วย</TableCell>
              <TableCell align="right">คงเหลือ</TableCell>
              <TableCell align="right">จัดการ</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{p.code}</TableCell>
                <TableCell>{p.name}</TableCell>
                <TableCell>{p.unit}</TableCell>
                <TableCell align="right">
                  <Chip
                    size="small"
                    label={p.stockQty}
                    color={p.stockQty <= 0 ? 'error' : p.stockQty < 10 ? 'warning' : 'success'}
                  />
                </TableCell>
                <TableCell align="right">
                  <Button size="small" onClick={() => restock(p)}>
                    ปรับสต็อก
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>เพิ่มสื่อ POSM</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="รหัส"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              required
            />
            <TextField
              label="ชื่อสื่อ"
              placeholder="โบรชัวร์ / Roll Up / Banner"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="หน่วย"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                sx={{ flex: 1 }}
              />
              <TextField
                label="สต็อกเริ่มต้น"
                type="number"
                value={form.stockQty}
                onChange={(e) => setForm({ ...form, stockQty: e.target.value })}
                sx={{ flex: 1 }}
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>ยกเลิก</Button>
          <Button variant="contained" onClick={save}>
            บันทึก
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
