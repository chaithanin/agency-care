import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Grid, Card, CardContent, Chip, Tabs, Tab, Table,
  TableHead, TableRow, TableCell, TableBody, Button, CircularProgress, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Tooltip, IconButton,
  Select, MenuItem, FormControl, InputLabel,
} from '@mui/material';
import { CheckCircle, Cancel, Visibility, Refresh, Close } from '@mui/icons-material';
import { api, errMsg } from '../api/client';
import { ExportPdfButton } from '../components/ExportPdfButton';

const MODULE_LABELS: Record<string, string> = {
  leave: 'Leave', pr: 'PR', document: 'Document', expense: 'Expense', agency: 'Agency',
};
const MODULE_COLOR: Record<string, 'primary'|'secondary'|'success'|'warning'|'error'> = {
  leave: 'secondary', pr: 'primary', document: 'success', expense: 'warning', agency: 'error',
};

interface QueueItem {
  id: string; _module: string; _label: string; status: string; createdAt: string;
  employee?: { name: string; code: string };
  createdBy?: { name: string };
}

interface Stats { leave: number; pr: number; document: number; expense: number; agency: number; total: number }

export default function ApprovalCenterPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionItem, setActionItem] = useState<QueueItem | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');

  // Filter state
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const modules = ['', 'leave', 'pr', 'document', 'expense', 'agency'];
  const selectedModule = modules[tab];

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [qRes, sRes] = await Promise.all([
        api.get<{ items: QueueItem[]; total: number }>(`/approvals/queue${selectedModule ? `?module=${selectedModule}` : ''}`),
        api.get<Stats>('/approvals/stats'),
      ]);
      setItems(qRes.data.items);
      setStats(sRes.data);
    } catch (e) { setError(errMsg(e)); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [tab]);

  // Filter items based on search and status
  const filteredItems = useMemo(() => {
    let result = items;

    // Apply search filter (across label, employee name, employee code, created by name)
    if (searchText.trim()) {
      const query = searchText.toLowerCase().trim();
      result = result.filter(item => {
        const label = item._label?.toLowerCase() || '';
        const employeeName = item.employee?.name?.toLowerCase() || '';
        const employeeCode = item.employee?.code?.toLowerCase() || '';
        const createdByName = item.createdBy?.name?.toLowerCase() || '';
        return label.includes(query) || employeeName.includes(query) || employeeCode.includes(query) || createdByName.includes(query);
      });
    }

    // Apply status filter (if not "all")
    if (statusFilter !== 'all') {
      result = result.filter(item => item.status === statusFilter);
    }

    return result;
  }, [items, searchText, statusFilter]);

  // Check if any filters are active
  const hasActiveFilters = searchText.trim() !== '' || statusFilter !== 'all';

  const clearFilters = () => {
    setSearchText('');
    setStatusFilter('all');
  };

  const viewItem = (item: QueueItem) => {
    if (item._module === 'pr') navigate(`/pr/${item.id}`);
    else if (item._module === 'document') navigate(`/docs/${item.id}`);
    else if (item._module === 'leave') navigate('/leave');
    else if (item._module === 'agency') navigate(`/agencies/${item.id}/form`);
  };

  const openAction = (item: QueueItem, type: 'approve' | 'reject') => {
    setActionItem(item);
    setActionType(type);
    setNote('');
  };

  const doAction = async () => {
    if (!actionItem) return;
    setSaving(true);
    try {
      await api.patch(`/approvals/${actionItem._module}/${actionItem.id}/action`, { action: actionType, note });
      setSuccess(`${actionType === 'approve' ? 'Approved' : 'Rejected'} successfully`);
      setActionItem(null);
      load();
    } catch (e) { setError(errMsg(e)); }
    setSaving(false);
    setTimeout(() => setSuccess(''), 3000);
  };

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Approval Center</Typography>
          <Typography variant="body2" color="text.secondary">All pending approval items</Typography>
        </Box>
        <IconButton onClick={load}><Refresh /></IconButton>
      </Box>

      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Stats */}
      {stats && (
        <Grid container spacing={2} mb={2}>
          {([
            ['All', stats.total, '#4F46E5'],
            ['Leave', stats.leave, '#7C3AED'],
            ['PR', stats.pr, '#2563EB'],
            ['Document', stats.document, '#16A34A'],
            ['Expense', stats.expense, '#D97706'],
            ['Agency', stats.agency, '#DC2626'],
          ] as [string, number, string][]).map(([label, val, color]) => (
            <Grid item xs={6} sm={2} key={label}>
              <Card variant="outlined" sx={{ borderTop: `3px solid ${color}`, textAlign: 'center' }}>
                <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="h5" fontWeight={700} sx={{ color }}>{val}</Typography>
                  <Typography variant="caption" color="text.secondary">{label}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Tabs */}
      <Paper>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: '1px solid #E2E8F0', px: 2 }}>
          {['All','Leave','PR','Document','Expense','Agency'].map((t, i) => (
            <Tab key={i} label={t} />
          ))}
        </Tabs>

        {/* Filters Section */}
        <Box sx={{ p: 2, borderBottom: '1px solid #E2E8F0', bgcolor: '#FAFBFC' }}>
          <Grid container spacing={2} alignItems="flex-end">
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search by item, employee name, code..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                variant="outlined"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  label="Status"
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <MenuItem value="all">All Statuses</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="approved">Approved</MenuItem>
                  <MenuItem value="rejected">Rejected</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Box display="flex" gap={1}>
                <ExportPdfButton
                  tableId="approvals-table"
                  filename="approvals"
                  title="Approvals"
                  size="small"
                  variant="outlined"
                />
                {hasActiveFilters && (
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Close />}
                    onClick={clearFilters}
                    sx={{ flex: 1 }}
                  >
                    Clear Filters
                  </Button>
                )}
              </Box>
            </Grid>
          </Grid>
          {hasActiveFilters && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Showing {filteredItems.length} of {items.length} results
            </Typography>
          )}
        </Box>

        {loading ? (
          <Box p={6} textAlign="center"><CircularProgress /></Box>
        ) : (
          <Table id="approvals-table" size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                {['Module','Item','Employee / Created By','Date','Actions'].map(h => (
                  <TableCell key={h} sx={{ fontWeight: 700 }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 8, color: 'text.secondary' }}>
                    <CheckCircle sx={{ fontSize: 48, color: '#16A34A', mb: 1, display: 'block', mx: 'auto' }} />
                    {hasActiveFilters ? 'No approvals match your filters' : 'No pending approvals'}
                  </TableCell>
                </TableRow>
              ) : filteredItems.map(item => (
                <TableRow key={`${item._module}-${item.id}`} hover>
                  <TableCell>
                    <Chip label={MODULE_LABELS[item._module]} size="small" color={MODULE_COLOR[item._module]} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{item._label}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{item.employee?.name ?? item.createdBy?.name ?? '—'}</Typography>
                    {item.employee && <Typography variant="caption" color="text.secondary">{item.employee.code}</Typography>}
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">{new Date(item.createdAt).toLocaleDateString('th-TH')}</Typography>
                  </TableCell>
                  <TableCell>
                    <Box display="flex" gap={0.5}>
                      <Tooltip title="View Details">
                        <IconButton size="small" onClick={() => viewItem(item)}><Visibility fontSize="small" /></IconButton>
                      </Tooltip>
                      <Tooltip title="Approve">
                        <IconButton size="small" color="success" onClick={() => openAction(item, 'approve')}><CheckCircle fontSize="small" /></IconButton>
                      </Tooltip>
                      <Tooltip title="Reject">
                        <IconButton size="small" color="error" onClick={() => openAction(item, 'reject')}><Cancel fontSize="small" /></IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      {/* Action Dialog */}
      <Dialog open={!!actionItem} onClose={() => setActionItem(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{actionType === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}</DialogTitle>
        <DialogContent>
          {actionItem && (
            <Box mb={2}>
              <Typography variant="body2" gutterBottom><strong>Item:</strong> {actionItem._label}</Typography>
              <Typography variant="body2"><strong>Module:</strong> {MODULE_LABELS[actionItem._module]}</Typography>
            </Box>
          )}
          <TextField
            label={actionType === 'reject' ? 'Reason for rejection (required)' : 'Notes (optional)'}
            multiline rows={3} fullWidth value={note} onChange={e => setNote(e.target.value)}
            required={actionType === 'reject'}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActionItem(null)}>Cancel</Button>
          <Button
            variant="contained"
            color={actionType === 'approve' ? 'success' : 'error'}
            onClick={doAction}
            disabled={saving || (actionType === 'reject' && !note.trim())}
          >
            {saving ? '...' : actionType === 'approve' ? 'Approve' : 'Reject'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
