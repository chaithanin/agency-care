import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Switch, FormControlLabel, Button, Chip,
  Table, TableHead, TableRow, TableCell, TableBody, Alert, Tabs, Tab,
  TextField, Select, MenuItem, FormControl, InputLabel, CircularProgress,
  Divider, Grid, Card, CardContent, CardHeader, IconButton, Tooltip,
} from '@mui/material';
import { Send, Settings, History, NotificationsActive, CheckCircle, Error, PlayArrow } from '@mui/icons-material';
import { useT } from '../i18n';
import { api } from '../api/client';
import { ExportPdfButton } from '../components/ExportPdfButton';

interface NotifSetting {
  id: string;
  notifType: string;
  label: string;
  isEnabled: boolean;
  cronTime: string;
  channelLine: boolean;
  channelEmail: boolean;
}

interface NotifLog {
  id: string;
  notifType: string;
  channel: string;
  recipient: { name: string; code: string };
  role: string;
  taskCount: number;
  overdueCount: number;
  status: string;
  sentAt: string | null;
  createdAt: string;
}

const NOTIF_TYPE_LABELS: Record<string, string> = {
  daily_brief: '📋 Morning Summary 08:00',
  midday: '⏰ Midday 12:00',
  afternoon: '🔔 Afternoon 16:00',
  evening: '🚨 Evening 18:00',
};

const NOTIF_DESCRIPTIONS: Record<string, string> = {
  daily_brief: 'Daily task summary + AI-recommended task order — sent to staff, supervisors, and executives',
  midday: 'Notify incomplete tasks (only for users with pending work)',
  afternoon: 'Escalation to Sales + Closer if tasks are still unfinished',
  evening: 'Highest escalation — Sales + Closer + Executive if tasks are overdue',
};

const ESCALATION_TABLE = [
  { time: '08:00', to: 'Sale', condition: 'Daily task notification', color: '#4F46E5' },
  { time: '12:00', to: 'Sale', condition: 'Pending tasks exist', color: '#0369A1' },
  { time: '16:00', to: 'Sale + Closer', condition: 'No action taken', color: '#D97706' },
  { time: '18:00', to: 'Sale + Closer + Executive', condition: 'Tasks still incomplete', color: '#DC2626' },
];

function fmtDate(d: string) {
  return new Date(d).toLocaleString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function NotificationCenterPage() {
  const { t } = useT();
  const [tab, setTab] = useState(0);
  const [settings, setSettings] = useState<NotifSetting[]>([]);
  const [logs, setLogs] = useState<NotifLog[]>([]);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [alert, setAlert] = useState<{ msg: string; sev: 'success' | 'error' } | null>(null);

  // Log filters
  const [logTypeFilter, setLogTypeFilter] = useState('');
  const [logStatusFilter, setLogStatusFilter] = useState('');
  const [logFrom, setLogFrom] = useState('');
  const [logTo, setLogTo] = useState('');
  const [logSellerSearch, setLogSellerSearch] = useState('');
  const [logAgencySearch, setLogAgencySearch] = useState('');
  const [logTaskTitleSearch, setLogTaskTitleSearch] = useState('');
  const [filteredLogs, setFilteredLogs] = useState<NotifLog[]>([]);

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (tab === 1) fetchLogs();
  }, [tab, logTypeFilter, logStatusFilter, logFrom, logTo]);

  // Apply client-side filters to logs
  useEffect(() => {
    const filtered = logs.filter((log) => {
      const sellerMatch =
        logSellerSearch === '' ||
        log.recipient?.name?.toLowerCase().includes(logSellerSearch.toLowerCase()) ||
        log.recipient?.code?.toLowerCase().includes(logSellerSearch.toLowerCase());

      const agencyMatch =
        logAgencySearch === '' ||
        log.recipient?.name?.toLowerCase().includes(logAgencySearch.toLowerCase());

      const taskMatch =
        logTaskTitleSearch === '' ||
        log.notifType?.toLowerCase().includes(logTaskTitleSearch.toLowerCase()) ||
        log.taskCount.toString().includes(logTaskTitleSearch);

      return sellerMatch && agencyMatch && taskMatch;
    });
    setFilteredLogs(filtered);
  }, [logs, logSellerSearch, logAgencySearch, logTaskTitleSearch]);

  const fetchSettings = async () => {
    setLoadingSettings(true);
    try {
      const res = await api.get<NotifSetting[]>('/notifications/smart/settings');
      setSettings(res.data);
    } catch {
      // might not exist yet in DB
    } finally {
      setLoadingSettings(false);
    }
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const params = new URLSearchParams();
      if (logTypeFilter) params.set('notifType', logTypeFilter);
      if (logStatusFilter) params.set('status', logStatusFilter);
      if (logFrom) params.set('from', logFrom);
      if (logTo) params.set('to', logTo);
      const res = await api.get<NotifLog[]>(`/notifications/smart/logs?${params}`);
      setLogs(res.data);
    } catch {
      setLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  };

  const patchSetting = async (notifType: string, data: Partial<NotifSetting>) => {
    setSaving(notifType);
    try {
      await api.patch(`/notifications/smart/settings/${notifType}`, data);
      setSettings((prev) => prev.map((s) => (s.notifType === notifType ? { ...s, ...data } : s)));
      showAlert('Saved successfully', 'success');
    } catch {
      showAlert('An error occurred', 'error');
    } finally {
      setSaving(null);
    }
  };

  const sendNow = async (notifType: string) => {
    setSending(notifType);
    try {
      const res = await api.post(`/notifications/smart/send/${notifType}`, {});
      const r = res.data as Record<string, number>;
      const counts = Object.entries(r).map(([k, v]) => `${k}: ${v}`).join(', ');
      showAlert(`Sent successfully — ${counts}`, 'success');
      if (tab === 1) fetchLogs();
    } catch {
      showAlert('Failed to send', 'error');
    } finally {
      setSending(null);
    }
  };

  const showAlert = (msg: string, sev: 'success' | 'error') => {
    setAlert({ msg, sev });
    setTimeout(() => setAlert(null), 4000);
  };

  const statusChip = (s: string) => {
    const map: Record<string, { label: string; color: 'success' | 'error' | 'default' }> = {
      sent: { label: t('ntf.statusSent'), color: 'success' },
      failed: { label: t('ntf.statusFailed'), color: 'error' },
      read: { label: t('ntf.statusRead'), color: 'default' },
      skipped: { label: 'Skipped', color: 'default' },
    };
    const m = map[s] ?? { label: s, color: 'default' };
    return <Chip label={m.label} color={m.color} size="small" />;
  };

  const hasActiveFilters =
    logSellerSearch !== '' ||
    logAgencySearch !== '' ||
    logTaskTitleSearch !== '';

  const resetFilters = () => {
    setLogSellerSearch('');
    setLogAgencySearch('');
    setLogTaskTitleSearch('');
  };

  return (
    <Box p={3}>
      <Box display="flex" alignItems="center" gap={1} mb={2}>
        <NotificationsActive color="primary" sx={{ fontSize: 28 }} />
        <Typography variant="h5" fontWeight={700}>{t('ntf.smart')}</Typography>
      </Box>

      {alert && <Alert severity={alert.sev} sx={{ mb: 2 }}>{alert.msg}</Alert>}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab icon={<Settings />} iconPosition="start" label={t('ntf.settings')} />
        <Tab icon={<History />} iconPosition="start" label={t('ntf.logs')} />
      </Tabs>

      {/* ========== TAB 0: SETTINGS ========== */}
      {tab === 0 && (
        <Box>
          {/* Escalation overview */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <Typography variant="subtitle1" fontWeight={700} mb={2}>Escalation Notification Schedule</Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Time</TableCell>
                  <TableCell>Notify To</TableCell>
                  <TableCell>Condition</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {ESCALATION_TABLE.map((row) => (
                  <TableRow key={row.time}>
                    <TableCell><Chip label={row.time} size="small" sx={{ bgcolor: row.color, color: '#fff', fontWeight: 700 }} /></TableCell>
                    <TableCell>{row.to}</TableCell>
                    <TableCell>{row.condition}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>

          {/* Settings cards */}
          {loadingSettings ? (
            <CircularProgress />
          ) : settings.length === 0 ? (
            <Alert severity="info">No settings found (migration may not have run yet)</Alert>
          ) : (
            <Grid container spacing={2}>
              {settings.map((s) => (
                <Grid item xs={12} sm={6} key={s.notifType}>
                  <Card variant="outlined" sx={{ borderLeft: `4px solid ${s.isEnabled ? '#4F46E5' : '#CBD5E1'}` }}>
                    <CardHeader
                      title={NOTIF_TYPE_LABELS[s.notifType] ?? s.label}
                      subheader={NOTIF_DESCRIPTIONS[s.notifType]}
                      titleTypographyProps={{ variant: 'subtitle1', fontWeight: 700 }}
                      subheaderTypographyProps={{ variant: 'caption' }}
                      action={
                        <Tooltip title={t('ntf.sendNow')}>
                          <span>
                            <IconButton
                              size="small"
                              color="primary"
                              disabled={sending === s.notifType}
                              onClick={() => sendNow(s.notifType)}
                            >
                              {sending === s.notifType ? <CircularProgress size={18} /> : <PlayArrow />}
                            </IconButton>
                          </span>
                        </Tooltip>
                      }
                    />
                    <CardContent sx={{ pt: 0 }}>
                      <Box display="flex" flexWrap="wrap" gap={1} alignItems="center">
                        <FormControlLabel
                          control={
                            <Switch
                              checked={s.isEnabled}
                              onChange={(e) => patchSetting(s.notifType, { isEnabled: e.target.checked })}
                              disabled={saving === s.notifType}
                            />
                          }
                          label={t('ntf.enable')}
                        />
                        <FormControlLabel
                          control={
                            <Switch
                              checked={s.channelLine}
                              onChange={(e) => patchSetting(s.notifType, { channelLine: e.target.checked })}
                              disabled={saving === s.notifType}
                            />
                          }
                          label={t('ntf.channelLine')}
                        />
                        <FormControlLabel
                          control={
                            <Switch
                              checked={s.channelEmail}
                              onChange={(e) => patchSetting(s.notifType, { channelEmail: e.target.checked })}
                              disabled={saving === s.notifType}
                            />
                          }
                          label={t('ntf.channelEmail')}
                        />
                      </Box>
                      <Box mt={1} display="flex" gap={1} alignItems="center">
                        <TextField
                          label={t('ntf.cronTime')}
                          value={s.cronTime}
                          size="small"
                          sx={{ width: 180 }}
                          onChange={(e) => setSettings((prev) => prev.map((x) => x.notifType === s.notifType ? { ...x, cronTime: e.target.value } : x))}
                        />
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={saving === s.notifType}
                          onClick={() => patchSetting(s.notifType, { cronTime: s.cronTime })}
                        >
                          {saving === s.notifType ? <CircularProgress size={16} /> : 'Save'}
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}

          {/* LINE OA info */}
          <Paper sx={{ p: 2, mt: 3 }}>
            <Typography variant="subtitle1" fontWeight={700} mb={1}>{t('ntf.lineSettings')}</Typography>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="body2" color="text.secondary" mb={1}>
              Set the environment variable <code>LINE_CHANNEL_ACCESS_TOKEN</code> in Cloud Run to enable LINE OA
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Each user must link their LINE User ID to their staff account via the LINE LIFF app or have it assigned by an admin
            </Typography>
          </Paper>
        </Box>
      )}

      {/* ========== TAB 1: LOGS ========== */}
      {tab === 1 && (
        <Box>
          {/* Primary Filters - Server-side */}
          <Paper sx={{ p: 2, mb: 2, bgcolor: '#F8FAFC' }}>
            <Typography variant="subtitle2" fontWeight={700} mb={1.5}>Notification Filters</Typography>
            <Box display="flex" flexWrap="wrap" gap={2} alignItems="center">
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>{t('ntf.logType')}</InputLabel>
                <Select value={logTypeFilter} label={t('ntf.logType')} onChange={(e) => setLogTypeFilter(e.target.value)}>
                  <MenuItem value="">All</MenuItem>
                  {Object.entries(NOTIF_TYPE_LABELS).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>{t('ntf.logStatus')}</InputLabel>
                <Select value={logStatusFilter} label={t('ntf.logStatus')} onChange={(e) => setLogStatusFilter(e.target.value)}>
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="sent">{t('ntf.statusSent')}</MenuItem>
                  <MenuItem value="failed">{t('ntf.statusFailed')}</MenuItem>
                  <MenuItem value="read">{t('ntf.statusRead')}</MenuItem>
                </Select>
              </FormControl>
              <TextField label="From" type="date" size="small" value={logFrom} onChange={(e) => setLogFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
              <TextField label="To" type="date" size="small" value={logTo} onChange={(e) => setLogTo(e.target.value)} InputLabelProps={{ shrink: true }} />
              <Button variant="contained" size="small" onClick={fetchLogs}>Search</Button>
              <ExportPdfButton tableId="notifications-table" filename="notifications" title="Notifications" variant="outlined" size="small" />
            </Box>
          </Paper>

          {/* Secondary Filters - Client-side Search */}
          <Paper sx={{ p: 2, mb: 2, border: '1px solid #E2E8F0' }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
              <Typography variant="subtitle2" fontWeight={700}>Search & Filter Results</Typography>
              {hasActiveFilters && (
                <Button size="small" variant="outlined" onClick={resetFilters}>
                  Clear All
                </Button>
              )}
            </Box>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="Seller Name / Code"
                  placeholder="Search by seller name or code"
                  value={logSellerSearch}
                  onChange={(e) => setLogSellerSearch(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="Agency"
                  placeholder="Search by agency name"
                  value={logAgencySearch}
                  onChange={(e) => setLogAgencySearch(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="Task Title / Keyword"
                  placeholder="Search by task type or count"
                  value={logTaskTitleSearch}
                  onChange={(e) => setLogTaskTitleSearch(e.target.value)}
                />
              </Grid>
            </Grid>
          </Paper>

          {/* Log stats summary */}
          {!loadingLogs && filteredLogs.length > 0 && (
            <Box display="flex" gap={2} mb={2} flexWrap="wrap">
              {(['sent', 'failed', 'read'] as const).map((s) => {
                const count = filteredLogs.filter((l) => l.status === s).length;
                const icon = s === 'sent' ? <CheckCircle color="success" /> : s === 'failed' ? <Error color="error" /> : <Send />;
                return (
                  <Paper key={s} sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1, minWidth: 120 }}>
                    {icon}
                    <Box>
                      <Typography variant="h6" fontWeight={700} lineHeight={1}>{count}</Typography>
                      <Typography variant="caption" color="text.secondary">{t(`ntf.status${s.charAt(0).toUpperCase() + s.slice(1)}` as Parameters<typeof t>[0])}</Typography>
                    </Box>
                  </Paper>
                );
              })}
              <Paper sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1, minWidth: 120 }}>
                <NotificationsActive color="primary" />
                <Box>
                  <Typography variant="h6" fontWeight={700} lineHeight={1}>{filteredLogs.length}</Typography>
                  <Typography variant="caption" color="text.secondary">{hasActiveFilters ? `Results` : `Total`}</Typography>
                </Box>
              </Paper>
            </Box>
          )}

          {/* Log table */}
          <Paper>
            {loadingLogs ? (
              <Box p={4} textAlign="center"><CircularProgress /></Box>
            ) : (
              <Table id="notifications-table" size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                    <TableCell>{t('ntf.logDate')}</TableCell>
                    <TableCell>{t('ntf.logType')}</TableCell>
                    <TableCell>{t('ntf.logChannel')}</TableCell>
                    <TableCell>{t('ntf.logRecipient')}</TableCell>
                    <TableCell>{t('ntf.logRole')}</TableCell>
                    <TableCell align="center">{t('ntf.logTasks')}</TableCell>
                    <TableCell align="center">{t('ntf.logOverdue')}</TableCell>
                    <TableCell>{t('ntf.logStatus')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                        {logs.length === 0 ? 'No data' : hasActiveFilters ? 'No results found. Try adjusting your filters.' : 'No data'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLogs.map((log) => (
                      <TableRow key={log.id} hover>
                        <TableCell><Typography variant="caption">{fmtDate(log.createdAt)}</Typography></TableCell>
                        <TableCell>
                          <Chip label={NOTIF_TYPE_LABELS[log.notifType]?.replace(/^\S+\s/, '') ?? log.notifType} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell>
                          <Chip label={log.channel.toUpperCase()} size="small" color={log.channel === 'line' ? 'success' : 'info'} />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{log.recipient?.name ?? '—'}</Typography>
                          <Typography variant="caption" color="text.secondary">{log.recipient?.code}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={log.role === 'sales' ? t('ntf.levelSales') : log.role === 'closer' ? t('ntf.levelCloser') : t('ntf.levelExec')}
                            size="small"
                            sx={{ bgcolor: log.role === 'sales' ? '#EEF2FF' : log.role === 'closer' ? '#E0F2FE' : '#F0FDF4' }}
                          />
                        </TableCell>
                        <TableCell align="center">{log.taskCount}</TableCell>
                        <TableCell align="center">
                          {log.overdueCount > 0 ? <Typography variant="body2" color="error" fontWeight={700}>{log.overdueCount}</Typography> : '—'}
                        </TableCell>
                        <TableCell>{statusChip(log.status)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </Paper>
        </Box>
      )}
    </Box>
  );
}
