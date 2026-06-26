import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Button, Chip, Table, TableHead, TableRow, TableCell, TableBody,
  Tabs, Tab, TextField, Select, MenuItem, FormControl, InputLabel, Grid, Card, CardContent,
  CircularProgress, Alert, IconButton, Tooltip,
} from '@mui/material';
import { Add, Search, Description, Assignment, Assessment, Refresh } from '@mui/icons-material';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';

const DOC_TYPES = [
  { key: 'all', label: 'ทั้งหมด', icon: null },
  { key: 'sva', label: 'Site Visit Assignment', icon: <Assignment /> },
  { key: 'svr', label: 'Completion Report', icon: <Description /> },
  { key: 'mpa', label: 'Performance Acknowledgement', icon: <Assessment /> },
];

const STATUS_COLORS: Record<string, string> = {
  draft: '#94A3B8', pending_review: '#60A5FA', pending_approval: '#FBBF24',
  approved: '#34D399', signing: '#818CF8', completed: '#22C55E', cancelled: '#EF4444',
};
const STATUS_LABELS: Record<string, string> = {
  draft: 'ร่าง', pending_review: 'รอ Closer', pending_approval: 'รออนุมัติ',
  approved: 'อนุมัติแล้ว', signing: 'รอลงนาม', completed: 'เสร็จสิ้น', cancelled: 'ยกเลิก',
};

const MONTH_TH = ['','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

interface DocItem {
  id: string; docType: string; docNumber?: string;
  month: number; year: number; version: number; status: string;
  employee: { id: string; name: string; code: string };
  createdBy: { id: string; name: string };
  signatures: { signerType: string }[];
  createdAt: string;
}

interface Dashboard {
  total: number; pendingSignature: number; signing: number; completed: number; cancelled: number;
  byType: { docType: string; _count: { _all: number } }[];
  byStatus: { status: string; _count: { _all: number } }[];
}

export default function DocsPage() {
  const navigate = useNavigate();
  useAuth();

  const [tab, setTab] = useState(0);
  const [items, setItems] = useState<DocItem[]>([]);
  const [total, setTotal] = useState(0);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());

  const docType = DOC_TYPES[tab].key;

  useEffect(() => { fetchDashboard(); fetchList(); }, [tab, filterStatus, filterYear]);

  const fetchDashboard = async () => {
    try {
      const res = await api.get<Dashboard>(`/docs/dashboard?${docType !== 'all' ? `type=${docType}&` : ''}year=${filterYear}`);
      setDashboard(res.data);
    } catch { /* ignore */ }
  };

  const fetchList = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: '100', year: filterYear });
      if (docType !== 'all') params.set('type', docType);
      if (filterStatus) params.set('status', filterStatus);
      if (search) params.set('search', search);
      const res = await api.get<{ total: number; items: DocItem[] }>(`/docs?${params}`);
      setItems(res.data.items);
      setTotal(res.data.total);
    } catch { setError('โหลดข้อมูลไม่สำเร็จ'); }
    finally { setLoading(false); }
  };

  const kpiCards = dashboard ? [
    { label: 'เอกสารทั้งหมด', value: dashboard.total, color: '#4F46E5' },
    { label: 'รอลงนาม', value: dashboard.signing, color: '#7C3AED' },
    { label: 'เสร็จสิ้น', value: dashboard.completed, color: '#16A34A' },
    { label: 'ยกเลิก', value: dashboard.cancelled, color: '#DC2626' },
  ] : [];


  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Document Center</Typography>
          <Typography variant="body2" color="text.secondary">SVA · SVR · MPA — {total} เอกสาร</Typography>
        </Box>
        <Box display="flex" gap={1}>
          <Button variant="outlined" size="small" onClick={() => navigate('/docs/new?type=sva')} startIcon={<Add />}>Site Visit Assignment</Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/docs/new?type=svr')} startIcon={<Add />}>Site Visit Report</Button>
          <Button variant="contained" size="small" onClick={() => navigate('/docs/new?type=mpa')} startIcon={<Add />}>Monthly Performance</Button>
        </Box>
      </Box>

      {/* KPI Cards */}
      {dashboard && (
        <Grid container spacing={2} mb={2}>
          {kpiCards.map((k) => (
            <Grid item xs={6} sm={3} key={k.label}>
              <Card variant="outlined" sx={{ borderTop: `3px solid ${k.color}` }}>
                <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="caption" color="text.secondary">{k.label}</Typography>
                  <Typography variant="h5" fontWeight={700} sx={{ color: k.color }}>{k.value}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Tabs */}
      <Paper sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => { setTab(v); }} sx={{ borderBottom: '1px solid #E2E8F0', px: 2 }}>
          {DOC_TYPES.map((t) => <Tab key={t.key} label={t.label} />)}
        </Tabs>

        {/* Filters */}
        <Box display="flex" flexWrap="wrap" gap={1.5} p={2} alignItems="center">
          <TextField size="small" placeholder="ค้นหา..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchList()}
            InputProps={{ startAdornment: <Search sx={{ mr: 0.5, fontSize: 18, color: 'text.secondary' }} /> }}
            sx={{ minWidth: 200 }} />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>สถานะ</InputLabel>
            <Select value={filterStatus} label="สถานะ" onChange={(e) => setFilterStatus(e.target.value)}>
              <MenuItem value="">ทั้งหมด</MenuItem>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <MenuItem key={k} value={k}><Chip label={v} size="small" sx={{ bgcolor: STATUS_COLORS[k], color: '#fff' }} /></MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField size="small" label="ปี" type="number" value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)} sx={{ width: 100 }} />
          <Button size="small" variant="contained" onClick={fetchList}><Search /></Button>
          <Tooltip title="รีเฟรช"><IconButton size="small" onClick={() => { fetchList(); fetchDashboard(); }}><Refresh /></IconButton></Tooltip>
        </Box>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Table */}
      <Paper>
        {loading ? <Box p={6} textAlign="center"><CircularProgress /></Box> : (
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                {['เลขที่', 'ประเภท', 'เดือน', 'พนักงาน', 'Version', 'สถานะ', 'ลงนาม', 'สร้างเมื่อ'].map((h) => (
                  <TableCell key={h} sx={{ fontWeight: 700 }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {items.length === 0 ? (
                <TableRow><TableCell colSpan={8} align="center" sx={{ py: 6, color: 'text.secondary' }}>ไม่มีเอกสาร</TableCell></TableRow>
              ) : items.map((doc) => {
                const signedTypes = new Set(doc.signatures.map(s => s.signerType));
                return (
                  <TableRow key={doc.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/docs/${doc.id}`)}>
                    <TableCell><Typography variant="body2" fontWeight={700} color="primary">{doc.docNumber ?? doc.id.slice(0, 8)}</Typography></TableCell>
                    <TableCell><Chip label={doc.docType.toUpperCase()} size="small" variant="outlined" /></TableCell>
                    <TableCell><Typography variant="body2">{MONTH_TH[doc.month]} {doc.year + 543}</Typography></TableCell>
                    <TableCell><Typography variant="body2">{doc.employee?.name}</Typography><Typography variant="caption" color="text.secondary">{doc.employee?.code}</Typography></TableCell>
                    <TableCell><Chip label={`V${doc.version}`} size="small" /></TableCell>
                    <TableCell><Chip label={STATUS_LABELS[doc.status] ?? doc.status} size="small" sx={{ bgcolor: STATUS_COLORS[doc.status] ?? '#E2E8F0', color: '#fff', fontWeight: 600 }} /></TableCell>
                    <TableCell>
                      <Box display="flex" gap={0.5}>
                        {['employee','supervisor','manager'].map((t) => (
                          signedTypes.has(t) ? <Chip key={t} label={t[0].toUpperCase()} size="small" color="success" sx={{ fontSize: 10, height: 18 }} /> : null
                        ))}
                        {!signedTypes.size && <Typography variant="caption" color="text.secondary">—</Typography>}
                      </Box>
                    </TableCell>
                    <TableCell><Typography variant="caption" color="text.secondary">{new Date(doc.createdAt).toLocaleDateString('th-TH')}</Typography></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Paper>
    </Box>
  );
}
