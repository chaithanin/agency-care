import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Grid, Tabs, Tab, Table, TableHead, TableRow, TableCell,
  TableBody, Button, TextField, Switch, FormControlLabel, Dialog, DialogTitle,
  DialogContent, DialogActions, Chip, IconButton, CircularProgress, Alert, Select,
  MenuItem, FormControl, InputLabel,
} from '@mui/material';
import { Add, Edit, Delete, Save } from '@mui/icons-material';
import { api, errMsg } from '../api/client';

const CATEGORIES = [
  { key: 'visit_type', label: 'ประเภทการเยี่ยม' },
  { key: 'task_type', label: 'ประเภทงาน' },
  { key: 'agency_type', label: 'ประเภท Agency' },
  { key: 'priority', label: 'ความสำคัญ' },
  { key: 'reason_code', label: 'รหัสเหตุผล' },
];

interface Region { id: string; code: string; name: string; isActive: boolean; branches?: Branch[] }
interface Branch { id: string; code: string; name: string; regionId?: string; isActive: boolean; region?: { name: string } }
interface Department { id: string; code: string; name: string; isActive: boolean }
interface MasterItem { id: string; category: string; code: string; nameEn: string; nameTh: string; sortOrder: number; isActive: boolean }

function EmptyRow({ cols }: { cols: number }) {
  return <TableRow><TableCell colSpan={cols} align="center" sx={{ py: 4, color: 'text.secondary' }}>ไม่มีข้อมูล</TableCell></TableRow>;
}

export default function MasterDataPage() {
  const [tab, setTab] = useState(0);
  const [regions, setRegions] = useState<Region[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [masterItems, setMasterItems] = useState<MasterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form dialogs
  const [editItem, setEditItem] = useState<Record<string, unknown> | null>(null);
  const [editType, setEditType] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('visit_type');
  const [saving, setSaving] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [rRes, bRes, dRes, mRes] = await Promise.all([
        api.get<Region[]>('/master-data/regions'),
        api.get<Branch[]>('/master-data/branches'),
        api.get<Department[]>('/master-data/departments'),
        api.get<MasterItem[]>('/master-data/items'),
      ]);
      setRegions(rRes.data ?? []);
      setBranches(bRes.data ?? []);
      setDepartments(dRes.data ?? []);
      setMasterItems(mRes.data ?? []);
    } catch (e) { setError(errMsg(e)); }
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const openAdd = (type: string) => {
    setEditType(type);
    setEditItem({ code: '', name: '', nameEn: '', nameTh: '', isActive: true, sortOrder: 0, category: selectedCategory });
  };
  const openEdit = (type: string, item: Record<string, unknown>) => { setEditType(type); setEditItem({ ...item }); };
  const closeDialog = () => { setEditItem(null); setEditType(''); };

  const saveItem = async () => {
    if (!editItem) return;
    setSaving(true);
    setError('');
    try {
      const isNew = !editItem.id;
      const endpoint = editType === 'region' ? '/master-data/regions' :
        editType === 'branch' ? '/master-data/branches' :
        editType === 'department' ? '/master-data/departments' : '/master-data/items';
      if (isNew) await api.post(endpoint, editItem);
      else await api.patch(`${endpoint}/${editItem.id as string}`, editItem);
      setSuccess(isNew ? 'เพิ่มสำเร็จ' : 'บันทึกสำเร็จ');
      closeDialog();
      loadAll();
    } catch (e) { setError(errMsg(e)); }
    setSaving(false);
    setTimeout(() => setSuccess(''), 3000);
  };

  const deleteItem = async (type: string, id: string) => {
    if (!confirm('ยืนยันการลบ?')) return;
    const endpoint = type === 'region' ? '/master-data/regions' :
      type === 'branch' ? '/master-data/branches' :
      type === 'department' ? '/master-data/departments' : '/master-data/items';
    try {
      await api.delete(`${endpoint}/${id}`);
      setSuccess('ลบสำเร็จ');
      loadAll();
    } catch (e) { setError(errMsg(e)); }
    setTimeout(() => setSuccess(''), 3000);
  };

  const filteredItems = masterItems.filter(m => m.category === selectedCategory);

  if (loading) return <Box p={6} textAlign="center"><CircularProgress /></Box>;

  return (
    <Box p={3}>
      <Typography variant="h5" fontWeight={700} mb={1}>Master Data</Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>จัดการข้อมูลหลักของระบบ</Typography>

      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: '1px solid #E2E8F0', px: 2 }}>
          {['ภูมิภาค','สาขา','แผนก','ข้อมูลประเภท'].map((t, i) => <Tab key={i} label={t} />)}
        </Tabs>

        {/* Regions */}
        {tab === 0 && (
          <Box p={2}>
            <Box display="flex" justifyContent="flex-end" mb={2}>
              <Button startIcon={<Add />} variant="contained" size="small" onClick={() => openAdd('region')}>เพิ่มภูมิภาค</Button>
            </Box>
            <Table size="small">
              <TableHead><TableRow sx={{ bgcolor: '#F8FAFC' }}>
                {['รหัส','ชื่อ','สาขา','สถานะ','จัดการ'].map(h => <TableCell key={h} sx={{ fontWeight: 700 }}>{h}</TableCell>)}
              </TableRow></TableHead>
              <TableBody>
                {regions.length === 0 ? <EmptyRow cols={5} /> : regions.map(r => (
                  <TableRow key={r.id} hover>
                    <TableCell><Chip label={r.code} size="small" /></TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell>{r.branches?.length ?? 0} สาขา</TableCell>
                    <TableCell><Chip label={r.isActive ? 'ใช้งาน' : 'ปิด'} size="small" color={r.isActive ? 'success' : 'default'} /></TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={() => openEdit('region', r as unknown as Record<string,unknown>)}><Edit fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" onClick={() => deleteItem('region', r.id)}><Delete fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}

        {/* Branches */}
        {tab === 1 && (
          <Box p={2}>
            <Box display="flex" justifyContent="flex-end" mb={2}>
              <Button startIcon={<Add />} variant="contained" size="small" onClick={() => openAdd('branch')}>เพิ่มสาขา</Button>
            </Box>
            <Table size="small">
              <TableHead><TableRow sx={{ bgcolor: '#F8FAFC' }}>
                {['รหัส','ชื่อ','ภูมิภาค','สถานะ','จัดการ'].map(h => <TableCell key={h} sx={{ fontWeight: 700 }}>{h}</TableCell>)}
              </TableRow></TableHead>
              <TableBody>
                {branches.length === 0 ? <EmptyRow cols={5} /> : branches.map(b => (
                  <TableRow key={b.id} hover>
                    <TableCell><Chip label={b.code} size="small" /></TableCell>
                    <TableCell>{b.name}</TableCell>
                    <TableCell>{b.region?.name ?? '—'}</TableCell>
                    <TableCell><Chip label={b.isActive ? 'ใช้งาน' : 'ปิด'} size="small" color={b.isActive ? 'success' : 'default'} /></TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={() => openEdit('branch', b as unknown as Record<string,unknown>)}><Edit fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" onClick={() => deleteItem('branch', b.id)}><Delete fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}

        {/* Departments */}
        {tab === 2 && (
          <Box p={2}>
            <Box display="flex" justifyContent="flex-end" mb={2}>
              <Button startIcon={<Add />} variant="contained" size="small" onClick={() => openAdd('department')}>เพิ่มแผนก</Button>
            </Box>
            <Table size="small">
              <TableHead><TableRow sx={{ bgcolor: '#F8FAFC' }}>
                {['รหัส','ชื่อ','สถานะ','จัดการ'].map(h => <TableCell key={h} sx={{ fontWeight: 700 }}>{h}</TableCell>)}
              </TableRow></TableHead>
              <TableBody>
                {departments.length === 0 ? <EmptyRow cols={4} /> : departments.map(d => (
                  <TableRow key={d.id} hover>
                    <TableCell><Chip label={d.code} size="small" /></TableCell>
                    <TableCell>{d.name}</TableCell>
                    <TableCell><Chip label={d.isActive ? 'ใช้งาน' : 'ปิด'} size="small" color={d.isActive ? 'success' : 'default'} /></TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={() => openEdit('department', d as unknown as Record<string,unknown>)}><Edit fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" onClick={() => deleteItem('department', d.id)}><Delete fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}

        {/* Master Items */}
        {tab === 3 && (
          <Box p={2}>
            <Box display="flex" justifyContent="space-between" mb={2}>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>หมวดหมู่</InputLabel>
                <Select value={selectedCategory} label="หมวดหมู่" onChange={e => setSelectedCategory(e.target.value)}>
                  {CATEGORIES.map(c => <MenuItem key={c.key} value={c.key}>{c.label}</MenuItem>)}
                </Select>
              </FormControl>
              <Button startIcon={<Add />} variant="contained" size="small" onClick={() => openAdd('item')}>เพิ่มรายการ</Button>
            </Box>
            <Table size="small">
              <TableHead><TableRow sx={{ bgcolor: '#F8FAFC' }}>
                {['รหัส','ชื่อ TH','ชื่อ EN','ลำดับ','สถานะ','จัดการ'].map(h => <TableCell key={h} sx={{ fontWeight: 700 }}>{h}</TableCell>)}
              </TableRow></TableHead>
              <TableBody>
                {filteredItems.length === 0 ? <EmptyRow cols={6} /> : filteredItems.map(m => (
                  <TableRow key={m.id} hover>
                    <TableCell><Chip label={m.code} size="small" /></TableCell>
                    <TableCell>{m.nameTh}</TableCell>
                    <TableCell>{m.nameEn}</TableCell>
                    <TableCell>{m.sortOrder}</TableCell>
                    <TableCell><Chip label={m.isActive ? 'ใช้งาน' : 'ปิด'} size="small" color={m.isActive ? 'success' : 'default'} /></TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={() => openEdit('item', m as unknown as Record<string,unknown>)}><Edit fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" onClick={() => deleteItem('item', m.id)}><Delete fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </Paper>

      {/* Edit/Add Dialog */}
      <Dialog open={!!editItem} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editItem?.id ? 'แก้ไข' : 'เพิ่ม'}{editType === 'region' ? 'ภูมิภาค' : editType === 'branch' ? 'สาขา' : editType === 'department' ? 'แผนก' : 'รายการ'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}>
              <TextField label="รหัส" fullWidth size="small" value={editItem?.code as string ?? ''} onChange={e => setEditItem(p => ({ ...p!, code: e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="ชื่อ (TH)" fullWidth size="small" value={(editItem?.nameTh ?? editItem?.name) as string ?? ''} onChange={e => setEditItem(p => ({ ...p!, name: e.target.value, nameTh: e.target.value }))} />
            </Grid>
            {(editType === 'item') && (
              <>
                <Grid item xs={12} sm={6}>
                  <TextField label="ชื่อ (EN)" fullWidth size="small" value={editItem?.nameEn as string ?? ''} onChange={e => setEditItem(p => ({ ...p!, nameEn: e.target.value }))} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField label="ลำดับ" type="number" fullWidth size="small" value={editItem?.sortOrder as number ?? 0} onChange={e => setEditItem(p => ({ ...p!, sortOrder: Number(e.target.value) }))} />
                </Grid>
              </>
            )}
            {editType === 'branch' && (
              <Grid item xs={12}>
                <FormControl fullWidth size="small">
                  <InputLabel>ภูมิภาค</InputLabel>
                  <Select value={editItem?.regionId as string ?? ''} label="ภูมิภาค" onChange={e => setEditItem(p => ({ ...p!, regionId: e.target.value }))}>
                    <MenuItem value="">— ไม่ระบุ —</MenuItem>
                    {regions.map(r => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            )}
            <Grid item xs={12}>
              <FormControlLabel
                control={<Switch checked={editItem?.isActive as boolean ?? true} onChange={e => setEditItem(p => ({ ...p!, isActive: e.target.checked }))} />}
                label="ใช้งาน"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>ยกเลิก</Button>
          <Button startIcon={<Save />} variant="contained" onClick={saveItem} disabled={saving}>บันทึก</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
