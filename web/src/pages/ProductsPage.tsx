import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, FormControlLabel, IconButton, InputAdornment, Link, Paper, Stack,
  Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField,
  Tooltip, Typography, Alert,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import LaunchIcon from '@mui/icons-material/Launch';
import SearchIcon from '@mui/icons-material/Search';
import PrintIcon from '@mui/icons-material/Print';
import RequestQuoteIcon from '@mui/icons-material/RequestQuote';
import { api, errMsg } from '../api/client';
import { useT } from '../i18n';

interface QuoteLine { product: Product; qty: number; unitPrice: number; }

function QuotationDialog({ open, onClose, products }: { open: boolean; onClose: () => void; products: Product[] }) {
  const printRef = useRef<HTMLDivElement>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerTel, setCustomerTel] = useState('');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<QuoteLine[]>([]);
  const [quoteNo] = useState(() => `QT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 9000) + 1000}`);

  const toggleProduct = (p: Product) => {
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.product.id === p.id);
      if (idx >= 0) return prev.filter((_, i) => i !== idx);
      return [...prev, { product: p, qty: 1, unitPrice: p.price }];
    });
  };
  const setQty = (id: string, qty: number) => setLines((prev) => prev.map((l) => l.product.id === id ? { ...l, qty } : l));
  const setUnitPrice = (id: string, v: number) => setLines((prev) => prev.map((l) => l.product.id === id ? { ...l, unitPrice: v } : l));

  const subtotal = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const vat = Math.round(subtotal * 0.07);
  const total = subtotal + vat;

  const doPrint = () => {
    if (!printRef.current) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><title>ใบเสนอราคา</title><style>
      body{font-family:sans-serif;margin:24px;font-size:13px}
      table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #ccc;padding:6px 8px}
      th{background:#f5f5f5}
      .right{text-align:right}.center{text-align:center}
      @media print{button{display:none}}
    </style></head><body>${printRef.current.innerHTML}</body></html>`);
    w.document.close();
    w.print();
  };

  const today = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <span>สร้างใบเสนอราคา</span>
          <Button size="small" variant="outlined" startIcon={<PrintIcon />} onClick={doPrint} disabled={lines.length === 0}>
            พิมพ์
          </Button>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack direction="row" spacing={2} mb={2} mt={1} flexWrap="wrap" useFlexGap>
          <TextField size="small" label="ชื่อลูกค้า / Agency" value={customerName} onChange={(e) => setCustomerName(e.target.value)} sx={{ flex: 2, minWidth: 200 }} />
          <TextField size="small" label="เบอร์โทรศัพท์" value={customerTel} onChange={(e) => setCustomerTel(e.target.value)} sx={{ flex: 1, minWidth: 150 }} />
        </Stack>

        <Typography variant="subtitle2" fontWeight={700} mb={1}>เลือกสินค้า/โครงการ</Typography>
        <Paper variant="outlined" sx={{ mb: 2, maxHeight: 220, overflowY: 'auto' }}>
          <Table size="small">
            <TableBody>
              {products.filter((p) => p.isActive).map((p) => {
                const sel = lines.find((l) => l.product.id === p.id);
                return (
                  <TableRow key={p.id} hover selected={!!sel} onClick={() => toggleProduct(p)} sx={{ cursor: 'pointer' }}>
                    <TableCell padding="checkbox"><Checkbox size="small" checked={!!sel} /></TableCell>
                    <TableCell>{p.code}</TableCell>
                    <TableCell>{p.name}</TableCell>
                    <TableCell align="right">{p.price.toLocaleString()}</TableCell>
                    <TableCell>{p.unit ?? '-'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Paper>

        {lines.length > 0 && (
          <>
            <Typography variant="subtitle2" fontWeight={700} mb={1}>รายการในใบเสนอราคา</Typography>
            <Table size="small" sx={{ mb: 2 }}>
              <TableHead>
                <TableRow>
                  <TableCell>สินค้า/โครงการ</TableCell>
                  <TableCell align="center" sx={{ width: 80 }}>จำนวน</TableCell>
                  <TableCell align="right" sx={{ width: 130 }}>ราคาต่อหน่วย</TableCell>
                  <TableCell align="right" sx={{ width: 120 }}>รวม</TableCell>
                  <TableCell sx={{ width: 40 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {lines.map((l) => (
                  <TableRow key={l.product.id}>
                    <TableCell>{l.product.name}</TableCell>
                    <TableCell align="center">
                      <TextField size="small" type="number" value={l.qty} onChange={(e) => setQty(l.product.id, Number(e.target.value))}
                        inputProps={{ min: 1, style: { textAlign: 'center' } }} sx={{ width: 70 }} onClick={(e) => e.stopPropagation()} />
                    </TableCell>
                    <TableCell align="right">
                      <TextField size="small" type="number" value={l.unitPrice} onChange={(e) => setUnitPrice(l.product.id, Number(e.target.value))}
                        inputProps={{ style: { textAlign: 'right' } }} sx={{ width: 120 }} onClick={(e) => e.stopPropagation()} />
                    </TableCell>
                    <TableCell align="right">{(l.qty * l.unitPrice).toLocaleString()}</TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); toggleProduct(l.product); }}><DeleteIcon fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={3} align="right" sx={{ fontWeight: 600 }}>ราคารวม (ก่อน VAT)</TableCell>
                  <TableCell align="right">{subtotal.toLocaleString()}</TableCell>
                  <TableCell />
                </TableRow>
                <TableRow>
                  <TableCell colSpan={3} align="right">VAT 7%</TableCell>
                  <TableCell align="right">{vat.toLocaleString()}</TableCell>
                  <TableCell />
                </TableRow>
                <TableRow>
                  <TableCell colSpan={3} align="right" sx={{ fontWeight: 700, fontSize: '1rem' }}>ยอดรวมทั้งสิ้น</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: '1rem', color: 'primary.main' }}>{total.toLocaleString()}</TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </>
        )}

        <TextField size="small" label="หมายเหตุ" value={note} onChange={(e) => setNote(e.target.value)}
          fullWidth multiline minRows={2} placeholder="เงื่อนไขการชำระเงิน, ระยะเวลาดำเนินการ..." />

        {/* Hidden print area */}
        <Box ref={printRef} sx={{ display: 'none' }}>
          <div style={{ padding: '20px' }}>
            <table style={{ width: '100%', marginBottom: 16 }}>
              <tbody>
                <tr>
                  <td><h2 style={{ margin: 0 }}>ใบเสนอราคา (Quotation)</h2></td>
                  <td style={{ textAlign: 'right', verticalAlign: 'top' }}>
                    <div><b>เลขที่:</b> {quoteNo}</div>
                    <div><b>วันที่:</b> {today}</div>
                  </td>
                </tr>
              </tbody>
            </table>
            <div style={{ marginBottom: 12 }}>
              <div><b>เสนอให้:</b> {customerName || '-'}</div>
              <div><b>โทร:</b> {customerTel || '-'}</div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
              <thead>
                <tr>
                  <th style={{ border: '1px solid #ccc', padding: '6px 8px', background: '#f5f5f5' }}>ลำดับ</th>
                  <th style={{ border: '1px solid #ccc', padding: '6px 8px', background: '#f5f5f5' }}>สินค้า/โครงการ</th>
                  <th style={{ border: '1px solid #ccc', padding: '6px 8px', background: '#f5f5f5', textAlign: 'center' }}>จำนวน</th>
                  <th style={{ border: '1px solid #ccc', padding: '6px 8px', background: '#f5f5f5', textAlign: 'right' }}>ราคาต่อหน่วย</th>
                  <th style={{ border: '1px solid #ccc', padding: '6px 8px', background: '#f5f5f5', textAlign: 'right' }}>จำนวนเงิน</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={l.product.id}>
                    <td style={{ border: '1px solid #ccc', padding: '6px 8px', textAlign: 'center' }}>{i + 1}</td>
                    <td style={{ border: '1px solid #ccc', padding: '6px 8px' }}>{l.product.name}{l.product.unit ? ` (${l.product.unit})` : ''}</td>
                    <td style={{ border: '1px solid #ccc', padding: '6px 8px', textAlign: 'center' }}>{l.qty}</td>
                    <td style={{ border: '1px solid #ccc', padding: '6px 8px', textAlign: 'right' }}>{l.unitPrice.toLocaleString()}</td>
                    <td style={{ border: '1px solid #ccc', padding: '6px 8px', textAlign: 'right' }}>{(l.qty * l.unitPrice).toLocaleString()}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={4} style={{ border: '1px solid #ccc', padding: '6px 8px', textAlign: 'right' }}>ราคารวมก่อน VAT</td>
                  <td style={{ border: '1px solid #ccc', padding: '6px 8px', textAlign: 'right' }}>{subtotal.toLocaleString()}</td>
                </tr>
                <tr>
                  <td colSpan={4} style={{ border: '1px solid #ccc', padding: '6px 8px', textAlign: 'right' }}>VAT 7%</td>
                  <td style={{ border: '1px solid #ccc', padding: '6px 8px', textAlign: 'right' }}>{vat.toLocaleString()}</td>
                </tr>
                <tr>
                  <td colSpan={4} style={{ border: '1px solid #ccc', padding: '6px 8px', textAlign: 'right', fontWeight: 'bold' }}>ยอดรวมทั้งสิ้น</td>
                  <td style={{ border: '1px solid #ccc', padding: '6px 8px', textAlign: 'right', fontWeight: 'bold' }}>{total.toLocaleString()} บาท</td>
                </tr>
              </tbody>
            </table>
            {note && <div style={{ marginBottom: 8 }}><b>หมายเหตุ:</b> {note}</div>}
            <div style={{ marginTop: 40, display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ textAlign: 'center' }}><div style={{ borderTop: '1px solid #333', width: 160, margin: '0 auto' }}></div><div style={{ marginTop: 4 }}>ผู้เสนอราคา</div></div>
              <div style={{ textAlign: 'center' }}><div style={{ borderTop: '1px solid #333', width: 160, margin: '0 auto' }}></div><div style={{ marginTop: 4 }}>ผู้อนุมัติ / ผู้มีอำนาจ</div></div>
            </div>
          </div>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>ปิด</Button>
      </DialogActions>
    </Dialog>
  );
}

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
  const [quoteOpen, setQuoteOpen] = useState(false);
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
          <Button variant="outlined" startIcon={<RequestQuoteIcon />} onClick={() => setQuoteOpen(true)}>ใบเสนอราคา</Button>
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

      {/* Quotation dialog */}
      <QuotationDialog open={quoteOpen} onClose={() => setQuoteOpen(false)} products={rows} />

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
