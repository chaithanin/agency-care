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
  MenuItem,
  Alert,
} from '@mui/material';
import { api, errMsg } from '../api/client';

interface Model {
  id: string;
  code: string;
  name: string;
  category?: string;
  status: string;
  currentAgency?: { code: string; name: string } | null;
}
interface Opt {
  id: string;
  code: string;
  name: string;
}

const statusColor: Record<string, 'default' | 'success' | 'warning' | 'error'> = {
  in_stock: 'default',
  deployed: 'success',
  repair: 'warning',
  lost: 'error',
};
const statusLabel: Record<string, string> = {
  in_stock: 'อยู่คลัง',
  deployed: 'ติดตั้งแล้ว',
  repair: 'ส่งซ่อม',
  lost: 'สูญหาย',
};

const empty = { code: '', name: '', category: '' };

export default function ModelsPage() {
  const [rows, setRows] = useState<Model[]>([]);
  const [agencies, setAgencies] = useState<Opt[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...empty });
  const [error, setError] = useState('');

  // deploy dialog
  const [deployFor, setDeployFor] = useState<Model | null>(null);
  const [deployAgency, setDeployAgency] = useState('');

  const load = () => api.get('/models').then((r) => setRows(r.data));
  useEffect(() => {
    load();
    api.get('/agencies').then((r) => setAgencies(r.data));
  }, []);

  const save = async () => {
    setError('');
    try {
      await api.post('/models', {
        code: form.code,
        name: form.name,
        category: form.category || undefined,
      });
      setOpen(false);
      setForm({ ...empty });
      load();
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const doDeploy = async () => {
    if (!deployFor || !deployAgency) return;
    await api.post('/models/deploy', { modelId: deployFor.id, agencyId: deployAgency });
    setDeployFor(null);
    setDeployAgency('');
    load();
  };

  const doReturn = async (m: Model) => {
    await api.post('/models/return', { modelId: m.id });
    load();
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={700}>
          อุปกรณ์ / เครื่องเดโม
        </Typography>
        <Button variant="contained" onClick={() => setOpen(true)}>
          + เพิ่มอุปกรณ์
        </Button>
      </Stack>

      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>รหัส</TableCell>
              <TableCell>ชื่อ</TableCell>
              <TableCell>ประเภท</TableCell>
              <TableCell>สถานะ</TableCell>
              <TableCell>อยู่ที่</TableCell>
              <TableCell align="right">จัดการ</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((m) => (
              <TableRow key={m.id}>
                <TableCell>{m.code}</TableCell>
                <TableCell>{m.name}</TableCell>
                <TableCell>{m.category || '-'}</TableCell>
                <TableCell>
                  <Chip size="small" label={statusLabel[m.status]} color={statusColor[m.status]} />
                </TableCell>
                <TableCell>{m.currentAgency ? m.currentAgency.name : '-'}</TableCell>
                <TableCell align="right">
                  {m.status === 'deployed' ? (
                    <Button size="small" onClick={() => doReturn(m)}>
                      รับคืน
                    </Button>
                  ) : (
                    <Button
                      size="small"
                      onClick={() => {
                        setDeployFor(m);
                        setDeployAgency('');
                      }}
                    >
                      ส่งไปร้าน
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>เพิ่มอุปกรณ์</DialogTitle>
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
              label="ชื่ออุปกรณ์"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <TextField
              label="ประเภท"
              placeholder="Demo Unit / Stand / ป้าย"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>ยกเลิก</Button>
          <Button variant="contained" onClick={save}>
            บันทึก
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deployFor} onClose={() => setDeployFor(null)} fullWidth maxWidth="xs">
        <DialogTitle>ส่งอุปกรณ์ไปร้าน — {deployFor?.name}</DialogTitle>
        <DialogContent>
          <TextField
            select
            label="เลือกร้าน"
            value={deployAgency}
            onChange={(e) => setDeployAgency(e.target.value)}
            fullWidth
            sx={{ mt: 1 }}
          >
            {agencies.map((a) => (
              <MenuItem key={a.id} value={a.id}>
                {a.code} — {a.name}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeployFor(null)}>ยกเลิก</Button>
          <Button variant="contained" onClick={doDeploy} disabled={!deployAgency}>
            ส่งไป
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
