import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Chip, TextField, Select, MenuItem, FormControl, InputLabel, Grid, Card, CardContent,
  CircularProgress, Alert, Button, IconButton, Tooltip,
} from '@mui/material';
import { Search, Download, Refresh, Security, ManageAccounts, Edit, Login } from '@mui/icons-material';
import { api, errMsg } from '../api/client';
import { ExportPdfButton } from '../components/ExportPdfButton';

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  create: { label: 'Create', color: '#16A34A' },
  update: { label: 'Edit', color: '#2563EB' },
  delete: { label: 'Delete', color: '#DC2626' },
  login: { label: 'Login', color: '#7C3AED' },
  logout: { label: 'Logout', color: '#6B7280' },
  approve: { label: 'Approved', color: '#16A34A' },
  reject: { label: 'Rejected', color: '#DC2626' },
  status_change: { label: 'Status Changed', color: '#D97706' },
  sign: { label: 'Signed', color: '#4F46E5' },
};

interface AuditLog {
  id: string; action: string; entity: string; entityId?: string; detail?: Record<string, unknown>;
  actorId?: string; actor?: { id: string; name: string; email: string }; ipAddress?: string;
  createdAt: string;
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterEntity, setFilterEntity] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const LIMIT = 50;

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(page * LIMIT) });
      if (search) params.set('search', search);
      if (filterAction) params.set('action', filterAction);
      if (filterEntity) params.set('entity', filterEntity);
      const res = await api.get<{ logs: AuditLog[]; total: number }>(`/audit-logs?${params}`);
      setLogs(res.data.logs ?? []);
      setTotal(res.data.total ?? 0);
    } catch (e) {
      // Try fallback endpoint
      try {
        const res2 = await api.get<AuditLog[]>(`/audit?${new URLSearchParams({ limit: '50' })}`);
        setLogs(Array.isArray(res2.data) ? res2.data : []);
      } catch {
        setError(errMsg(e));
      }
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [page, filterAction, filterEntity]);

  const exportCsv = () => {
    const headers = ['Date/Time', 'Actor', 'Action', 'Entity Type', 'ID', 'Details', 'IP'];
    const rows = logs.map(l => [
      new Date(l.createdAt).toLocaleString('en-US'),
      l.actor?.name ?? l.actorId ?? '—',
      l.action,
      l.entity,
      l.entityId ?? '—',
      JSON.stringify(l.detail ?? {}),
      l.ipAddress ?? '—',
    ]);
    const csv = '﻿' + [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'audit-log.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Audit & Security</Typography>
          <Typography variant="body2" color="text.secondary">Activity log: {total.toLocaleString()} records</Typography>
        </Box>
        <Box display="flex" gap={1}>
          <ExportPdfButton tableId="audit-table" filename="audit-log" title="Audit" size="small" />
          <Button startIcon={<Download />} variant="outlined" size="small" onClick={exportCsv}>Export CSV</Button>
          <IconButton onClick={load}><Refresh /></IconButton>
        </Box>
      </Box>

      {/* Quick stats */}
      <Grid container spacing={2} mb={2}>
        {([
          ['Total', total, <Security />, '#4F46E5'],
          ['Logins', logs.filter(l => l.action === 'login').length, <Login />, '#7C3AED'],
          ['Edits', logs.filter(l => l.action === 'update').length, <Edit />, '#2563EB'],
          ['Approvals', logs.filter(l => l.action === 'approve').length, <ManageAccounts />, '#16A34A'],
        ] as [string, number, React.ReactNode, string][]).map(([label, val, icon, color]) => (
          <Grid item xs={6} sm={3} key={String(label)}>
            <Card variant="outlined" sx={{ borderTop: `3px solid ${color}` }}>
              <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 }, display: 'flex', gap: 2, alignItems: 'center' }}>
                <Box sx={{ color }}>{icon}</Box>
                <Box>
                  <Typography variant="h5" fontWeight={700} sx={{ color }}>{val}</Typography>
                  <Typography variant="caption" color="text.secondary">{String(label)}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box display="flex" flexWrap="wrap" gap={1.5} alignItems="center">
          <TextField size="small" placeholder="Search..." value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load()}
            InputProps={{ startAdornment: <Search sx={{ mr: 0.5, fontSize: 18, color: 'text.secondary' }} /> }}
            sx={{ minWidth: 200 }} />
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Action</InputLabel>
            <Select value={filterAction} label="Action" onChange={e => setFilterAction(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              {Object.entries(ACTION_LABELS).map(([k, v]) => <MenuItem key={k} value={k}>{v.label}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Entity Type</InputLabel>
            <Select value={filterEntity} label="Entity Type" onChange={e => setFilterEntity(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              {['agency','employee','user','pr','document','leave','task','kpi','expense'].map(e => (
                <MenuItem key={e} value={e}>{e}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button size="small" variant="contained" onClick={load}><Search /></Button>
        </Box>
      </Paper>

      <Paper id="audit-table">
        {loading ? <Box p={6} textAlign="center"><CircularProgress /></Box> : (
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                {['Date/Time', 'Actor', 'Action', 'Entity Type', 'Details', 'IP'].map(h => (
                  <TableCell key={h} sx={{ fontWeight: 700 }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6, color: 'text.secondary' }}>No activity log data</TableCell>
                </TableRow>
              ) : logs.map(log => {
                const ac = ACTION_LABELS[log.action] ?? { label: log.action, color: '#6B7280' };
                return (
                  <TableRow key={log.id} hover>
                    <TableCell>
                      <Typography variant="caption">{new Date(log.createdAt).toLocaleString('en-US')}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{log.actor?.name ?? '—'}</Typography>
                      {log.actor?.email && <Typography variant="caption" color="text.secondary">{log.actor.email}</Typography>}
                    </TableCell>
                    <TableCell>
                      <Chip label={ac.label} size="small" sx={{ bgcolor: ac.color, color: '#fff', fontWeight: 600 }} />
                    </TableCell>
                    <TableCell>
                      <Chip label={log.entity} size="small" variant="outlined" />
                      {log.entityId && <Typography variant="caption" display="block" color="text.secondary">{log.entityId.slice(0,8)}…</Typography>}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 220 }}>
                      <Tooltip title={JSON.stringify(log.detail ?? {}, null, 2)}>
                        <Typography variant="caption" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: 200 }}>
                          {log.detail ? JSON.stringify(log.detail).slice(0, 60) : '—'}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell><Typography variant="caption">{log.ipAddress ?? '—'}</Typography></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        {/* Pagination */}
        <Box display="flex" justifyContent="space-between" alignItems="center" px={2} py={1}>
          <Typography variant="caption" color="text.secondary">Showing {logs.length} / {total} records</Typography>
          <Box display="flex" gap={1}>
            <Button size="small" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button size="small" disabled={(page + 1) * LIMIT >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
