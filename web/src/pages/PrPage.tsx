import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Button, Chip, Table, TableHead, TableRow, TableCell,
  TableBody, TextField, Select, MenuItem, FormControl, InputLabel, IconButton,
  Tooltip, Grid, Card, CardContent, CircularProgress, Alert,
} from '@mui/material';
import {
  Add, Search, Download, Refresh, Assignment, CheckCircle,
  Warning, AccessTime, TrendingDown,
} from '@mui/icons-material';
import { useT } from '../i18n';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { ExportPdfButton } from '../components/ExportPdfButton';

interface PrSummary {
  id: string;
  prNumber: string;
  title: string;
  department: string;
  prType: string;
  priority: string;
  status: string;
  budgetTotal: number | null;
  dueDate: string | null;
  createdAt: string;
  createdBy: { id: string; name: string };
  responsible: { id: string; name: string; code: string } | null;
  approver: { id: string; name: string } | null;
  _count: { items: number; comments: number; attachments: number };
}

interface Dashboard {
  total: number;
  open: number;
  overdue: number;
  completedToday: number;
  avgClosingDays: number;
  byStatus: { status: string; count: number }[];
  byPriority: { priority: string; count: number }[];
  byDepartment: { department: string; count: number }[];
  byResponsible: { name: string; count: number }[];
}

const STATUS_COLORS: Record<string, string> = {
  draft: '#94A3B8', submitted: '#60A5FA', waiting_approval: '#FBBF24',
  approved: '#34D399', purchasing: '#818CF8', ordered: '#F472B6',
  received: '#2DD4BF', completed: '#22C55E', cancelled: '#EF4444',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: '#94A3B8', medium: '#60A5FA', high: '#FBBF24', urgent: '#EF4444',
};

function StatusChip({ status, t }: { status: string; t: (k: string) => string }) {
  const keyMap: Record<string, string> = {
    draft: 'prt.statusDraft', submitted: 'prt.statusSubmitted', waiting_approval: 'prt.statusWaiting',
    approved: 'prt.statusApproved', purchasing: 'prt.statusPurchasing', ordered: 'prt.statusOrdered',
    received: 'prt.statusReceived', completed: 'prt.statusCompleted', cancelled: 'prt.statusCancelled',
  };
  return <Chip label={t(keyMap[status] ?? status)} size="small" sx={{ bgcolor: STATUS_COLORS[status] ?? '#E2E8F0', color: '#fff', fontWeight: 600 }} />;
}

function PriorityChip({ priority, t }: { priority: string; t: (k: string) => string }) {
  const keyMap: Record<string, string> = { low: 'prt.priorityLow', medium: 'prt.priorityMedium', high: 'prt.priorityHigh', urgent: 'prt.priorityUrgent' };
  return <Chip label={t(keyMap[priority] ?? priority)} size="small" sx={{ bgcolor: PRIORITY_COLORS[priority] ?? '#E2E8F0', color: '#fff', fontWeight: 600 }} />;
}

function daysAgo(d: string) {
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}

function fmtBaht(n: number | null) {
  if (!n) return '—';
  return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0 }).format(n);
}

export default function PrPage() {
  const { t } = useT();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isManager = ['manager', 'super_admin', 'admin', 'closer'].includes(user?.activeRole ?? user?.role ?? '');

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [items, setItems] = useState<PrSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => { fetchDashboard(); fetchList(); }, []);

  const fetchDashboard = async () => {
    try {
      const res = await api.get<Dashboard>('/pr/dashboard');
      setDashboard(res.data);
    } catch { /* ignore */ }
  };

  const fetchList = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filterStatus) params.set('status', filterStatus);
      if (filterPriority) params.set('priority', filterPriority);
      if (filterDept) params.set('department', filterDept);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const res = await api.get<{ total: number; items: PrSummary[] }>(`/pr?${params}`);
      setItems(res.data.items);
      setTotal(res.data.total);
    } catch (e) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = async () => {
    try {
      const res = await api.get<PrSummary[]>('/pr/export');
      const rows = res.data;
      const header = ['PR Number', 'Title', 'Department', 'Type', 'Priority', 'Status', 'Budget', 'Due Date', 'Responsible', 'Created By', 'Created Date'];
      const csv = '﻿' + [header, ...rows.map((r) => [
        r.prNumber, r.title, r.department, r.prType, r.priority, r.status,
        r.budgetTotal ?? '', r.dueDate ?? '', r.responsible?.name ?? '', r.createdBy.name,
        new Date(r.createdAt).toLocaleDateString('th-TH'),
      ].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
      const a = document.createElement('a'); a.href = url; a.download = `pr-export-${Date.now()}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  };

  const departments = useMemo(() => [...new Set(items.map((i) => i.department))].filter(Boolean), [items]);

  const kpiCards = dashboard ? [
    { label: 'Total', value: dashboard.total, icon: <Assignment />, color: '#4F46E5' },
    { label: t('prt.open'), value: dashboard.open, icon: <AccessTime />, color: '#0369A1' },
    { label: t('prt.overdue'), value: dashboard.overdue, icon: <Warning />, color: '#DC2626' },
    { label: 'Closed Today', value: dashboard.completedToday, icon: <CheckCircle />, color: '#16A34A' },
    { label: `${t('prt.avgDays')} (days)`, value: dashboard.avgClosingDays || '—', icon: <TrendingDown />, color: '#7C3AED' },
  ] : [];

  return (
    <Box p={3}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>{t('prt.module')}</Typography>
          <Typography variant="body2" color="text.secondary">Track PRs until closed — {total} items</Typography>
        </Box>
        <Box display="flex" gap={1}>
          <ExportPdfButton tableId="pr-table" filename="purchase-requests" title="Purchase Requests" size="small" />
          {isManager && <Button variant="outlined" startIcon={<Download />} onClick={exportCsv}>{t('prt.export')}</Button>}
          <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/pr/create')}>{t('prt.create')}</Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* KPI Cards */}
      {dashboard && (
        <Grid container spacing={2} mb={3}>
          {kpiCards.map((k) => (
            <Grid item xs={6} sm={4} md={2.4} key={k.label}>
              <Card variant="outlined" sx={{ borderTop: `3px solid ${k.color}` }}>
                <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                  <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                    <Box sx={{ color: k.color }}>{k.icon}</Box>
                    <Typography variant="caption" color="text.secondary">{k.label}</Typography>
                  </Box>
                  <Typography variant="h5" fontWeight={700} sx={{ color: k.color }}>{k.value}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box display="flex" flexWrap="wrap" gap={1.5} alignItems="center">
          <TextField
            size="small" placeholder="Search PR..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchList()}
            InputProps={{ startAdornment: <Search sx={{ mr: 0.5, color: 'text.secondary', fontSize: 18 }} /> }}
            sx={{ minWidth: 200 }}
          />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>{t('prt.status')}</InputLabel>
            <Select value={filterStatus} label={t('prt.status')} onChange={(e) => setFilterStatus(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              {['draft','submitted','waiting_approval','approved','purchasing','ordered','received','completed','cancelled'].map((s) => (
                <MenuItem key={s} value={s}><StatusChip status={s} t={t} /></MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>{t('prt.priority')}</InputLabel>
            <Select value={filterPriority} label={t('prt.priority')} onChange={(e) => setFilterPriority(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              {['low','medium','high','urgent'].map((p) => (
                <MenuItem key={p} value={p}><PriorityChip priority={p} t={t} /></MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>{t('prt.department')}</InputLabel>
            <Select value={filterDept} label={t('prt.department')} onChange={(e) => setFilterDept(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              {departments.map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField label="From" type="date" size="small" value={from} onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField label="To" type="date" size="small" value={to} onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
          <Button variant="contained" size="small" onClick={fetchList}><Search /></Button>
          <Tooltip title="Refresh"><IconButton size="small" onClick={() => { fetchList(); fetchDashboard(); }}><Refresh /></IconButton></Tooltip>
        </Box>
      </Paper>

      {/* Table */}
      <Paper>
        {loading ? (
          <Box p={6} textAlign="center"><CircularProgress /></Box>
        ) : (
          <Table id="pr-table" size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                <TableCell sx={{ fontWeight: 700 }}>{t('prt.number')}</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>{t('prt.title')}</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>{t('prt.department')}</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>{t('prt.priority')}</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>{t('prt.status')}</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>{t('prt.responsible')}</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>{t('prt.budget')}</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>{t('prt.dueDate')}</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>{t('prt.age')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 6, color: 'text.secondary' }}>No PRs found</TableCell>
                </TableRow>
              ) : (
                items.map((pr) => {
                  const age = daysAgo(pr.createdAt);
                  const isOverdue = pr.dueDate && new Date(pr.dueDate) < new Date() && !['completed','cancelled'].includes(pr.status);
                  return (
                    <TableRow
                      key={pr.id} hover sx={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/pr/${pr.id}`)}
                    >
                      <TableCell>
                        <Typography variant="body2" fontWeight={700} color="primary">{pr.prNumber}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pr.title}</Typography>
                        <Typography variant="caption" color="text.secondary">{pr.prType}</Typography>
                      </TableCell>
                      <TableCell><Typography variant="body2">{pr.department}</Typography></TableCell>
                      <TableCell><PriorityChip priority={pr.priority} t={t} /></TableCell>
                      <TableCell><StatusChip status={pr.status} t={t} /></TableCell>
                      <TableCell>
                        <Typography variant="body2">{pr.responsible?.name ?? '—'}</Typography>
                      </TableCell>
                      <TableCell><Typography variant="body2">{fmtBaht(pr.budgetTotal)}</Typography></TableCell>
                      <TableCell>
                        {pr.dueDate ? (
                          <Typography variant="body2" color={isOverdue ? 'error' : 'text.primary'} fontWeight={isOverdue ? 700 : 400}>
                            {new Date(pr.dueDate).toLocaleDateString('th-TH')}
                          </Typography>
                        ) : '—'}
                      </TableCell>
                      <TableCell>
                        <Chip label={`${age}d`} size="small" color={age > 14 ? 'error' : age > 7 ? 'warning' : 'default'} />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        )}
      </Paper>
    </Box>
  );
}
