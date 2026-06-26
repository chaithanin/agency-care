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
  daily_brief: '📋 Daily Brief 08:00',
  midday: '⏰ Midday 12:00',
  afternoon: '🔔 Afternoon 16:00',
  evening: '🚨 Evening 18:00',
};

const NOTIF_DESCRIPTIONS: Record<string, string> = {
  daily_brief: 'สรุปงานประจำวัน + AI แนะนำลำดับงาน ส่งถึงพนักงาน หัวหน้า และผู้บริหาร',
  midday: 'แจ้งงานที่ยังไม่เสร็จ (เฉพาะคนที่มีงานค้าง)',
  afternoon: 'Escalation ระดับ Sale + Closer หากงานยังไม่เสร็จ',
  evening: 'Escalation สูงสุด — Sale + Closer + Executive หากงานเกินกำหนด',
};

const ESCALATION_TABLE = [
  { time: '08:00', to: 'Sale', condition: 'แจ้งงานประจำวัน', color: '#4F46E5' },
  { time: '12:00', to: 'Sale', condition: 'มีงานค้าง', color: '#0369A1' },
  { time: '16:00', to: 'Sale + Closer', condition: 'ยังไม่ดำเนินการ', color: '#D97706' },
  { time: '18:00', to: 'Sale + Closer + Executive', condition: 'งานยังไม่เสร็จ', color: '#DC2626' },
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

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (tab === 1) fetchLogs();
  }, [tab, logTypeFilter, logStatusFilter, logFrom, logTo]);

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
      showAlert('บันทึกเรียบร้อย', 'success');
    } catch {
      showAlert('เกิดข้อผิดพลาด', 'error');
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
      showAlert(`ส่งสำเร็จ — ${counts}`, 'success');
      if (tab === 1) fetchLogs();
    } catch {
      showAlert('ส่งไม่สำเร็จ', 'error');
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
      skipped: { label: 'ข้าม', color: 'default' },
    };
    const m = map[s] ?? { label: s, color: 'default' };
    return <Chip label={m.label} color={m.color} size="small" />;
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
            <Typography variant="subtitle1" fontWeight={700} mb={2}>ระบบ Escalation — การแจ้งเตือนตามลำดับ</Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>เวลา</TableCell>
                  <TableCell>แจ้งเตือนถึง</TableCell>
                  <TableCell>เงื่อนไข</TableCell>
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
            <Alert severity="info">ยังไม่มีการตั้งค่า (migration อาจยังไม่รัน)</Alert>
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
                          {saving === s.notifType ? <CircularProgress size={16} /> : 'บันทึก'}
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
              ตั้งค่า environment variable <code>LINE_CHANNEL_ACCESS_TOKEN</code> ใน Cloud Run เพื่อเปิดใช้งาน LINE OA
            </Typography>
            <Typography variant="body2" color="text.secondary">
              ผู้ใช้แต่ละคนต้องผูก LINE User ID กับบัญชีพนักงาน ผ่าน LINE LIFF app หรือ admin กำหนดให้
            </Typography>
          </Paper>
        </Box>
      )}

      {/* ========== TAB 1: LOGS ========== */}
      {tab === 1 && (
        <Box>
          {/* Filters */}
          <Paper sx={{ p: 2, mb: 2 }}>
            <Box display="flex" flexWrap="wrap" gap={2} alignItems="center">
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>{t('ntf.logType')}</InputLabel>
                <Select value={logTypeFilter} label={t('ntf.logType')} onChange={(e) => setLogTypeFilter(e.target.value)}>
                  <MenuItem value="">ทั้งหมด</MenuItem>
                  {Object.entries(NOTIF_TYPE_LABELS).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>{t('ntf.logStatus')}</InputLabel>
                <Select value={logStatusFilter} label={t('ntf.logStatus')} onChange={(e) => setLogStatusFilter(e.target.value)}>
                  <MenuItem value="">ทั้งหมด</MenuItem>
                  <MenuItem value="sent">{t('ntf.statusSent')}</MenuItem>
                  <MenuItem value="failed">{t('ntf.statusFailed')}</MenuItem>
                  <MenuItem value="read">{t('ntf.statusRead')}</MenuItem>
                </Select>
              </FormControl>
              <TextField label="จาก" type="date" size="small" value={logFrom} onChange={(e) => setLogFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
              <TextField label="ถึง" type="date" size="small" value={logTo} onChange={(e) => setLogTo(e.target.value)} InputLabelProps={{ shrink: true }} />
              <Button variant="contained" size="small" onClick={fetchLogs}>ค้นหา</Button>
            </Box>
          </Paper>

          {/* Log stats summary */}
          {!loadingLogs && logs.length > 0 && (
            <Box display="flex" gap={2} mb={2} flexWrap="wrap">
              {(['sent', 'failed', 'read'] as const).map((s) => {
                const count = logs.filter((l) => l.status === s).length;
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
                  <Typography variant="h6" fontWeight={700} lineHeight={1}>{logs.length}</Typography>
                  <Typography variant="caption" color="text.secondary">ทั้งหมด</Typography>
                </Box>
              </Paper>
            </Box>
          )}

          {/* Log table */}
          <Paper>
            {loadingLogs ? (
              <Box p={4} textAlign="center"><CircularProgress /></Box>
            ) : (
              <Table size="small">
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
                  {logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>ไม่มีข้อมูล</TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log) => (
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
