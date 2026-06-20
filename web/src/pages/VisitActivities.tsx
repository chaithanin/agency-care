import { useEffect, useState } from 'react';
import {
  Paper,
  Typography,
  Stack,
  TextField,
  MenuItem,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Alert,
} from '@mui/material';
import { api, errMsg } from '../api/client';

interface PosmItem {
  id: string;
  name: string;
  unit: string;
  stockQty: number;
}
interface Product {
  id: string;
  name: string;
  price: number;
}
interface PosmTxn {
  id: string;
  quantity: number;
  posmItem: { name: string; unit: string };
}
interface SalesRow {
  id: string;
  qtyOffered: number;
  qtySold: number;
  amount: number;
  product: { name: string };
}

export default function VisitActivities({
  visitPlanId,
  isSales,
}: {
  visitPlanId: string;
  isSales: boolean;
}) {
  const [items, setItems] = useState<PosmItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [txns, setTxns] = useState<PosmTxn[]>([]);
  const [sales, setSales] = useState<SalesRow[]>([]);
  const [err, setErr] = useState('');

  // posm form
  const [posmItem, setPosmItem] = useState('');
  const [posmQty, setPosmQty] = useState('1');

  // sales form
  const [product, setProduct] = useState('');
  const [offered, setOffered] = useState('');
  const [sold, setSold] = useState('');
  const [amount, setAmount] = useState('');

  const loadLists = () => {
    api.get('/posm/transactions', { params: { visitPlanId } }).then((r) => setTxns(r.data));
    api.get('/sales', { params: { visitPlanId } }).then((r) => setSales(r.data));
  };
  useEffect(() => {
    api.get('/posm/items').then((r) => setItems(r.data));
    api.get('/products').then((r) => setProducts(r.data));
    loadLists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitPlanId]);

  const giveOut = async () => {
    setErr('');
    if (!posmItem) return;
    try {
      await api.post('/posm/transactions', {
        visitPlanId,
        posmItemId: posmItem,
        quantity: Number(posmQty),
      });
      setPosmItem('');
      setPosmQty('1');
      loadLists();
      api.get('/posm/items').then((r) => setItems(r.data)); // refresh stock
    } catch (e) {
      setErr(errMsg(e));
    }
  };

  const recordSale = async () => {
    setErr('');
    if (!product) return;
    try {
      await api.post('/sales', {
        visitPlanId,
        productId: product,
        qtyOffered: offered ? Number(offered) : 0,
        qtySold: sold ? Number(sold) : 0,
        amount: amount ? Number(amount) : undefined,
      });
      setProduct('');
      setOffered('');
      setSold('');
      setAmount('');
      loadLists();
    } catch (e) {
      setErr(errMsg(e));
    }
  };

  const totalSales = sales.reduce((s, r) => s + r.amount, 0);

  return (
    <>
      {err && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {err}
        </Alert>
      )}

      {/* ---- POSM ---- */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" fontWeight={700} mb={1}>
          แจกสื่อ POSM
        </Typography>
        {isSales && (
          <Stack direction="row" spacing={1} mb={2} alignItems="center" flexWrap="wrap" useFlexGap>
            <TextField
              select
              size="small"
              label="สื่อ"
              value={posmItem}
              onChange={(e) => setPosmItem(e.target.value)}
              sx={{ minWidth: 180 }}
            >
              {items.map((i) => (
                <MenuItem key={i.id} value={i.id} disabled={i.stockQty <= 0}>
                  {i.name} (เหลือ {i.stockQty})
                </MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              type="number"
              label="จำนวน"
              value={posmQty}
              onChange={(e) => setPosmQty(e.target.value)}
              sx={{ width: 100 }}
            />
            <Button variant="outlined" onClick={giveOut}>
              บันทึก
            </Button>
          </Stack>
        )}
        {txns.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            ยังไม่มีการแจกสื่อ
          </Typography>
        ) : (
          <Table size="small">
            <TableBody>
              {txns.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{t.posmItem.name}</TableCell>
                  <TableCell align="right">
                    {t.quantity} {t.posmItem.unit}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      {/* ---- Sales ---- */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" fontWeight={700} mb={1}>
          บันทึกการขาย
        </Typography>
        {isSales && (
          <Stack direction="row" spacing={1} mb={2} alignItems="center" flexWrap="wrap" useFlexGap>
            <TextField
              select
              size="small"
              label="สินค้า"
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              sx={{ minWidth: 160 }}
            >
              {products.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              type="number"
              label="เสนอ"
              value={offered}
              onChange={(e) => setOffered(e.target.value)}
              sx={{ width: 80 }}
            />
            <TextField
              size="small"
              type="number"
              label="ขายได้"
              value={sold}
              onChange={(e) => setSold(e.target.value)}
              sx={{ width: 80 }}
            />
            <TextField
              size="small"
              type="number"
              label="ยอด (บาท)"
              placeholder="auto"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              sx={{ width: 110 }}
            />
            <Button variant="outlined" onClick={recordSale}>
              บันทึก
            </Button>
          </Stack>
        )}
        {sales.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            ยังไม่มีการขาย
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>สินค้า</TableCell>
                <TableCell align="right">เสนอ</TableCell>
                <TableCell align="right">ขายได้</TableCell>
                <TableCell align="right">ยอด</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sales.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.product.name}</TableCell>
                  <TableCell align="right">{s.qtyOffered}</TableCell>
                  <TableCell align="right">{s.qtySold}</TableCell>
                  <TableCell align="right">{s.amount.toLocaleString()}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={3} align="right" sx={{ fontWeight: 700 }}>
                  รวม
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>
                  {totalSales.toLocaleString()}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </Paper>
    </>
  );
}
