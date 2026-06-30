import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Grid, Tabs, Tab, Table, TableHead, TableRow, TableCell,
  TableBody, Button, TextField, Switch, FormControlLabel, Dialog, DialogTitle,
  DialogContent, DialogActions, Chip, IconButton, CircularProgress, Alert, Select,
  MenuItem, FormControl, InputLabel, Stack,
} from '@mui/material';
import { Add, Edit, Delete, Save } from '@mui/icons-material';
import { api, errMsg } from '../api/client';
import { ExportPdfButton } from '../components/ExportPdfButton';

const CATEGORIES = [
  { key: 'visit_type', label: 'Visit Type' },
  { key: 'task_type', label: 'Task Type' },
  { key: 'agency_type', label: 'Agency Type' },
  { key: 'priority', label: 'Priority' },
  { key: 'reason_code', label: 'Reason Code' },
];

interface Region { id: string; code: string; name: string; isActive: boolean; branches?: Branch[] }
interface Branch { id: string; code: string; name: string; regionId?: string; isActive: boolean; region?: { name: string } }
interface Department { id: string; code: string; name: string; isActive: boolean }
interface MasterItem { id: string; category: string; code: string; nameEn: string; nameTh: string; sortOrder: number; isActive: boolean }

function EmptyRow({ cols }: { cols: number }) {
  return <TableRow><TableCell colSpan={cols} align="center" sx={{ py: 4, color: 'text.secondary' }}>No data</TableCell></TableRow>;
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
      setSuccess(isNew ? 'Added successfully' : 'Saved successfully');
      closeDialog();
      loadAll();
    } catch (e) { setError(errMsg(e)); }
    setSaving(false);
    setTimeout(() => setSuccess(''), 3000);
  };

  const deleteItem = async (type: string, id: string) => {
    if (!confirm('Confirm delete?')) return;
    const endpoint = type === 'region' ? '/master-data/regions' :
      type === 'branch' ? '/master-data/branches' :
      type === 'department' ? '/master-data/departments' : '/master-data/items';
    try {
      await api.delete(`${endpoint}/${id}`);
      setSuccess('Deleted successfully');
      loadAll();
    } catch (e) { setError(errMsg(e)); }
    setTimeout(() => setSuccess(''), 3000);
  };

  const filteredItems = masterItems.filter(m => m.category === selectedCategory);

  if (loading) return <Box p={6} textAlign="center"><CircularProgress /></Box>;

  return (
    <Box p={3}>
      <Typography variant="h5" fontWeight={700} mb={1}>Master Data</Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>Manage system master data</Typography>

      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: '1px solid #E2E8F0', px: 2 }}>
          {['Regions', 'Branches', 'Departments', 'Type Data'].map((t, i) => <Tab key={i} label={t} />)}
        </Tabs>

        {/* Regions */}
        {tab === 0 && (
          <Box p={2}>
            <Box display="flex" justifyContent="flex-end" mb={2}>
              <Stack direction="row" spacing={1}>
                <ExportPdfButton tableId="regions-table" filename="regions" title="Regions" size="small" variant="outlined" />
                <Button startIcon={<Add />} variant="contained" size="small" onClick={() => openAdd('region')}>Add Region</Button>
              </Stack>
            </Box>
            <Table size="small" id="regions-table">
              <TableHead><TableRow sx={{ bgcolor: '#F8FAFC' }}>
                {['Code', 'Name', 'Branches', 'Status', 'Actions'].map(h => <TableCell key={h} sx={{ fontWeight: 700 }}>{h}</TableCell>)}
              </TableRow></TableHead>
              <TableBody>
                {regions.length === 0 ? <EmptyRow cols={5} /> : regions.map(r => (
                  <TableRow key={r.id} hover>
                    <TableCell><Chip label={r.code} size="small" /></TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell>{r.branches?.length ?? 0} branches</TableCell>
                    <TableCell><Chip label={r.isActive ? 'Active' : 'Inactive'} size="small" color={r.isActive ? 'success' : 'default'} /></TableCell>
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
              <Stack direction="row" spacing={1}>
                <ExportPdfButton tableId="branches-table" filename="branches" title="Branches" size="small" variant="outlined" />
                <Button startIcon={<Add />} variant="contained" size="small" onClick={() => openAdd('branch')}>Add Branch</Button>
              </Stack>
            </Box>
            <Table size="small" id="branches-table">
              <TableHead><TableRow sx={{ bgcolor: '#F8FAFC' }}>
                {['Code', 'Name', 'Region', 'Status', 'Actions'].map(h => <TableCell key={h} sx={{ fontWeight: 700 }}>{h}</TableCell>)}
              </TableRow></TableHead>
              <TableBody>
                {branches.length === 0 ? <EmptyRow cols={5} /> : branches.map(b => (
                  <TableRow key={b.id} hover>
                    <TableCell><Chip label={b.code} size="small" /></TableCell>
                    <TableCell>{b.name}</TableCell>
                    <TableCell>{b.region?.name ?? '—'}</TableCell>
                    <TableCell><Chip label={b.isActive ? 'Active' : 'Inactive'} size="small" color={b.isActive ? 'success' : 'default'} /></TableCell>
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
              <Stack direction="row" spacing={1}>
                <ExportPdfButton tableId="departments-table" filename="departments" title="Departments" size="small" variant="outlined" />
                <Button startIcon={<Add />} variant="contained" size="small" onClick={() => openAdd('department')}>Add Department</Button>
              </Stack>
            </Box>
            <Table size="small" id="departments-table">
              <TableHead><TableRow sx={{ bgcolor: '#F8FAFC' }}>
                {['Code', 'Name', 'Status', 'Actions'].map(h => <TableCell key={h} sx={{ fontWeight: 700 }}>{h}</TableCell>)}
              </TableRow></TableHead>
              <TableBody>
                {departments.length === 0 ? <EmptyRow cols={4} /> : departments.map(d => (
                  <TableRow key={d.id} hover>
                    <TableCell><Chip label={d.code} size="small" /></TableCell>
                    <TableCell>{d.name}</TableCell>
                    <TableCell><Chip label={d.isActive ? 'Active' : 'Inactive'} size="small" color={d.isActive ? 'success' : 'default'} /></TableCell>
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
                <InputLabel>Category</InputLabel>
                <Select value={selectedCategory} label="Category" onChange={e => setSelectedCategory(e.target.value)}>
                  {CATEGORIES.map(c => <MenuItem key={c.key} value={c.key}>{c.label}</MenuItem>)}
                </Select>
              </FormControl>
              <Stack direction="row" spacing={1}>
                <ExportPdfButton tableId="master-data-table" filename="master-data" title="Master Data" size="small" variant="outlined" />
                <Button startIcon={<Add />} variant="contained" size="small" onClick={() => openAdd('item')}>Add Item</Button>
              </Stack>
            </Box>
            <Table size="small" id="master-data-table">
              <TableHead><TableRow sx={{ bgcolor: '#F8FAFC' }}>
                {['Code', 'Name (TH)', 'Name (EN)', 'Order', 'Status', 'Actions'].map(h => <TableCell key={h} sx={{ fontWeight: 700 }}>{h}</TableCell>)}
              </TableRow></TableHead>
              <TableBody>
                {filteredItems.length === 0 ? <EmptyRow cols={6} /> : filteredItems.map(m => (
                  <TableRow key={m.id} hover>
                    <TableCell><Chip label={m.code} size="small" /></TableCell>
                    <TableCell>{m.nameTh}</TableCell>
                    <TableCell>{m.nameEn}</TableCell>
                    <TableCell>{m.sortOrder}</TableCell>
                    <TableCell><Chip label={m.isActive ? 'Active' : 'Inactive'} size="small" color={m.isActive ? 'success' : 'default'} /></TableCell>
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
        <DialogTitle>{editItem?.id ? 'Edit' : 'Add'} {editType === 'region' ? 'Region' : editType === 'branch' ? 'Branch' : editType === 'department' ? 'Department' : 'Item'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}>
              <TextField label="Code" fullWidth size="small" value={editItem?.code as string ?? ''} onChange={e => setEditItem(p => ({ ...p!, code: e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Name (TH)" fullWidth size="small" value={(editItem?.nameTh ?? editItem?.name) as string ?? ''} onChange={e => setEditItem(p => ({ ...p!, name: e.target.value, nameTh: e.target.value }))} />
            </Grid>
            {(editType === 'item') && (
              <>
                <Grid item xs={12} sm={6}>
                  <TextField label="Name (EN)" fullWidth size="small" value={editItem?.nameEn as string ?? ''} onChange={e => setEditItem(p => ({ ...p!, nameEn: e.target.value }))} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField label="Order" type="number" fullWidth size="small" value={editItem?.sortOrder as number ?? 0} onChange={e => setEditItem(p => ({ ...p!, sortOrder: Number(e.target.value) }))} />
                </Grid>
              </>
            )}
            {editType === 'branch' && (
              <Grid item xs={12}>
                <FormControl fullWidth size="small">
                  <InputLabel>Region</InputLabel>
                  <Select value={editItem?.regionId as string ?? ''} label="Region" onChange={e => setEditItem(p => ({ ...p!, regionId: e.target.value }))}>
                    <MenuItem value="">— Not specified —</MenuItem>
                    {regions.map(r => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            )}
            <Grid item xs={12}>
              <FormControlLabel
                control={<Switch checked={editItem?.isActive as boolean ?? true} onChange={e => setEditItem(p => ({ ...p!, isActive: e.target.checked }))} />}
                label="Active"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button startIcon={<Save />} variant="contained" onClick={saveItem} disabled={saving}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
