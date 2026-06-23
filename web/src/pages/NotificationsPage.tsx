import { useEffect, useState } from 'react';
import {
  Box, Button, Typography, Paper, Stack, Chip, Alert, Divider, CircularProgress,
} from '@mui/material';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import { api, errMsg } from '../api/client';
import { useT } from '../i18n';
import { useNavigate } from 'react-router-dom';

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  link?: string;
  createdAt: string;
}

const typeColor = (type: string) => {
  if (type === 'overdue_checkin') return 'error';
  if (type === 'visit_reminder')  return 'info';
  if (type === 'task_due')        return 'warning';
  if (type === 'org_summary')     return 'success';
  if (type === 'team_summary')    return 'warning';
  return 'default';
};

function isToday(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function timeAgo(dateStr: string, t: (key: string) => string, lang: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.round((now.getTime() - d.getTime()) / 60000);
  if (diff < 1)  return t('ntf.justNow');
  if (diff < 60) return `${diff} ${t('ntf.minsAgo')}`;
  if (diff < 1440) return `${Math.round(diff / 60)} ${t('ntf.hrsAgo')}`;
  return d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'th-TH', { day: 'numeric', month: 'short' });
}

export default function NotificationsPage() {
  const { t, lang } = useT();
  const navigate = useNavigate();
  const [items, setItems]   = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/notifications/my?limit=100');
      setItems(data);
    } catch (e) { setError(errMsg(e)); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const markRead = async (id: string) => {
    await api.patch(`/notifications/my/${id}/read`).catch(() => {});
    setItems(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = async () => {
    await api.patch('/notifications/my/read-all').catch(() => {});
    setItems(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleClick = (item: Notification) => {
    markRead(item.id);
    if (item.link) navigate(item.link);
  };

  const today   = items.filter(n => isToday(n.createdAt));
  const earlier = items.filter(n => !isToday(n.createdAt));
  const unread  = items.filter(n => !n.read).length;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="h5" fontWeight={700}>{t('ntf.title')}</Typography>
          {unread > 0 && <Chip label={unread} color="error" size="small" />}
        </Stack>
        {unread > 0 && (
          <Button size="small" onClick={markAllRead}>{t('ntf.markAll')}</Button>
        )}
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}><CircularProgress /></Box>
      ) : items.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <NotificationsNoneIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography color="text.secondary">{t('ntf.empty')}</Typography>
        </Paper>
      ) : (
        <Paper>
          {today.length > 0 && (
            <>
              <Typography variant="overline" sx={{ px: 2, pt: 2, display: 'block' }}>{t('ntf.today')}</Typography>
              {today.map((n, i) => (
                <Box key={n.id}>
                  <Stack
                    direction="row"
                    spacing={1.5}
                    sx={{
                      px: 2, py: 1.5, cursor: n.link ? 'pointer' : 'default',
                      bgcolor: n.read ? 'transparent' : 'action.hover',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                    onClick={() => handleClick(n)}
                  >
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: n.read ? 'transparent' : 'primary.main', mt: 1, flexShrink: 0 }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                        <Typography fontWeight={n.read ? 400 : 700} noWrap>{n.title}</Typography>
                        <Chip size="small" label={n.type.replace('_', ' ')} color={typeColor(n.type) as any} variant="outlined" />
                      </Stack>
                      <Typography variant="body2" color="text.secondary" noWrap>{n.body}</Typography>
                      <Typography variant="caption" color="text.disabled">{timeAgo(n.createdAt, t, lang)}</Typography>
                    </Box>
                  </Stack>
                  {i < today.length - 1 && <Divider />}
                </Box>
              ))}
            </>
          )}

          {earlier.length > 0 && (
            <>
              <Divider />
              <Typography variant="overline" sx={{ px: 2, pt: 2, display: 'block' }}>{t('ntf.earlier')}</Typography>
              {earlier.map((n, i) => (
                <Box key={n.id}>
                  <Stack
                    direction="row"
                    spacing={1.5}
                    sx={{
                      px: 2, py: 1.5, cursor: n.link ? 'pointer' : 'default',
                      bgcolor: n.read ? 'transparent' : 'action.hover',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                    onClick={() => handleClick(n)}
                  >
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: n.read ? 'transparent' : 'primary.main', mt: 1, flexShrink: 0 }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                        <Typography fontWeight={n.read ? 400 : 600} noWrap>{n.title}</Typography>
                        <Chip size="small" label={n.type.replace('_', ' ')} color={typeColor(n.type) as any} variant="outlined" />
                      </Stack>
                      <Typography variant="body2" color="text.secondary" noWrap>{n.body}</Typography>
                      <Typography variant="caption" color="text.disabled">{timeAgo(n.createdAt, t, lang)}</Typography>
                    </Box>
                  </Stack>
                  {i < earlier.length - 1 && <Divider />}
                </Box>
              ))}
            </>
          )}
        </Paper>
      )}
    </Box>
  );
}
