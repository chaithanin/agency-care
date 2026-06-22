import { useEffect, useState } from 'react';
import {
  Box, Button, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Stack, Chip, Alert,
} from '@mui/material';
import { api, errMsg } from '../api/client';

interface InvItem {
  id: string;
  code: string;
  name: string;
  unit: string;
  stockQty: number;
  reorderPoint: number;
  used30: number;
  low: boolean;
}

const empty = { code: '', name: '', unit: 'ชิ้น', stockQty: '', reorderPoint: '' };

export default function PosmPage() {
  const [rows, setRows] = useState<InvItem[]>([]);
  const [lowCount, setLowCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...empty });
  const [error, setError] = useState('');
  // จัดการสต็อก/จุดสั่งซื้อ
  const [manageFor, setManageFor] = useState<InvItem | null>(null);
  const [delta, setDelta] = useState('');
  const [rp, setRp] = useState('');

  const load = () =>
    api.get('/posm/inventory').then((r) => {
      setRows(r.data.items);
      setLowCount(r.data.lowStockCount);
    });
  useEffect(() => { load(); }, []);

  const save = async () => {
    setError('');
    try {
      await api.post('/posm/items', {
        code: form.code,
        name: form.name,
        unit: form.unit || undefined,
        stockQty: form.stockQty ? Number(form.stockQty) : undefined,
        reorderPoint: form.reorderPoint ? Number(form.reorderPoint) : undefined,
      });
      setOpen(false);
      setForm({ ...empty });
      load();
    } catch (e) { setError(errMsg(e)); }
  };

  const openManage = (it: InvItem) => {
    setManageFor(it);
    setDelta('');
    setRp(String(it.reorderPoint));
    setError('');
  };
  const saveManage = async () => {
    if (!manageFor) return;
    setError('');
    try {
      if (delta && Number(delta) !== 0) {
        await api.post(`/posm/items/${manageFor.id}/adjust`, { delta: Number(delta) });
      }
      if (rp !== '' && Number(rp) !== manageFor.reorderPoint) {
        await api.patch(`/posm/items/${manageFor.id}`, { reorderPoint: Number(rp) });
      }
      setManageFor(null);
      load();
    } catch (e) { setError(errMsg(e)); }
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={700}>คลังสื่อ POSM</Typography>
        <Button variant="contained" onClick={() => { setError(''); setOpen(true); }}>+ เพิ่มสื่อ</Button>
      </Stack>

      {lowCount > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          ⚠️ มีสื่อ {lowCount} รายการ ถึง/ต่ำกว่าจุดสั่งซื้อ — ควรเติมสต็อก
        </Alert>
      )}

      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>รหัส</TableCell>
              <TableCell>ชื่อสื่อ</TableCell>
              <TableCell>หน่วย</TableCell>
              <TableCell align="right">คงเหลือ</TableCell>
              <TableCell align="right">จุดสั่งซื้อ</TableCell>
              <TableCell align="right">ใช้ไป 30 วัน</TableCell>
              <TableCell align="right">จัดการ</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((p) => (
              <TableRow key={p.id} sx={{ bgcolor: p.low ? 'warning.50' : undefined }}>
                <TableCell>{p.code}</TableCell>
                <TableCell>{p.name}{p.low && ' 🔴'}</TableCell>
                <TableCell>{p.unit}</TableCell>
                <TableCell align="right">
                  <Chip size="small" label={p.stockQty} color={p.low ? 'error' : p.stockQty < 10 ? 'warning' : 'success'} />
                </TableCell>
                <TableCell align="right">{p.reorderPoint || '-'}</TableCell>
                <TableCell align="right">{p.used30}</TableCell>
                <TableCell align="right">
                  <Button size="small" onClick={() => openManage(p)}>เติม/ตั้งค่า</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      {/* เพิ่มสื่อ */}
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>เพิ่มสื่อ POSM</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField label="รหัส" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
            <TextField label="ชื่อสื่อ" placeholder="โบรชัวร์ / Roll Up / Banner" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <Stack direction="row" spacing={2}>
              <TextField label="หน่วย" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} sx={{ flex: 1 }} />
              <TextField label="สต็อกเริ่มต้น" type="number" value={form.stockQty} onChange={(e) => setForm({ ...form, stockQty: e.target.value })} sx={{ flex: 1 }} />
            </Stack>
            <TextField label="จุดสั่งซื้อ (แจ้งเตือนเมื่อต่ำกว่า)" type="number" value={form.reorderPoint} onChange={(e) => setForm({ ...form, reorderPoint: e.target.value })} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>ยกเลิก</Button>
          <Button variant="contained" onClick={save}>บันทึก</Button>
        </DialogActions>
      </Dialog>

      {/* เติมสต็อก / ตั้งจุดสั่งซื้อ */}
      <Dialog open={!!manageFor} onClose={() => setManageFor(null)} fullWidth maxWidth="xs">
        <DialogTitle>{manageFor?.name} (คงเหลือ {manageFor?.stockQty})</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField label="รับเข้า/หัก (+เติม / -หัก)" type="number" value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="เช่น 100" helperText="ใส่จำนวนที่รับเข้าคลัง" />
            <TextField label="จุดสั่งซื้อ" type="number" value={rp} onChange={(e) => setRp(e.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setManageFor(null)}>ยกเลิก</Button>
          <Button variant="contained" onClick={saveManage}>บันทึก</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
