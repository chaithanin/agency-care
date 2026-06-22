import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Chip,
  LinearProgress,
  List,
  ListItemButton,
  ListItemText,
  Grid,
  Alert,
} from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useT } from '../i18n';

interface Visit {
  visitPlanId: string;
  time: string;
  agencyName: string;
  zone?: string | null;
  phone?: string | null;
  status: string;
  checkedIn: boolean;
  checkedOut: boolean;
}
interface MyDay {
  employee: { name: string; position: string };
  date: string;
  inOffice: boolean;
  visits: Visit[];
  month: { assigned: number; visitTarget: number; visitDone: number; newAgencyTarget: number };
  error?: string;
}

const today = () => new Date().toISOString().slice(0, 10);

function Stat({ label, value, target }: { label: string; value: number; target?: number }) {
  return (
    <Paper sx={{ p: 1.5, textAlign: 'center' }}>
      <Typography variant="h5" fontWeight={700}>
        {value}
        {target != null && <Typography component="span" variant="body2" color="text.secondary">/{target}</Typography>}
      </Typography>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
    </Paper>
  );
}

export default function MyDayPage() {
  const { t } = useT();
  const [date, setDate] = useState(today());
  const [data, setData] = useState<MyDay | null>(null);
  const nav = useNavigate();

  useEffect(() => {
    setData(null);
    api.get('/scheduling/my-day', { params: { date } }).then((r) => setData(r.data));
  }, [date]);

  if (!data) return <LinearProgress />;
  if (data.error) return <Typography color="error">{data.error}</Typography>;

  const visitStatus = (v: Visit) =>
    v.checkedOut ? { c: 'success' as const, l: t('my.checkedOut') } : v.checkedIn ? { c: 'info' as const, l: t('my.atSite') } : v.status === 'done' ? { c: 'success' as const, l: t('my.visitedSt') } : { c: 'default' as const, l: t('my.waiting') };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={1}>
        <Box>
          <Typography variant="h5" fontWeight={700}>{t('page.myDay')}</Typography>
          <Typography variant="caption" color="text.secondary">
            {data.employee.name} · {data.employee.position === 'closer' ? 'Closer' : 'Sales'}
          </Typography>
        </Box>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ padding: 8, borderRadius: 6 }} />
      </Stack>

      <Grid container spacing={1.5} mb={2}>
        <Grid item xs={4}><Stat label={t('my.visitMonth')} value={data.month.visitDone} target={data.month.visitTarget} /></Grid>
        <Grid item xs={4}><Stat label={t('my.agencyDuty')} value={data.month.assigned} /></Grid>
        <Grid item xs={4}><Stat label={t('my.newTarget')} value={data.month.newAgencyTarget} /></Grid>
      </Grid>

      {data.inOffice && (
        <Alert severity="info" sx={{ mb: 2 }}>{t('my.office')}</Alert>
      )}

      <Paper>
        <Typography variant="subtitle1" fontWeight={700} sx={{ p: 2, pb: 1 }}>
          {t('my.todayAppt')} ({data.visits.length}) — {t('my.tapCheckin')}
        </Typography>
        {data.visits.length === 0 ? (
          <Typography sx={{ p: 2, color: 'text.secondary' }}>
            {t('my.noAppt')}
          </Typography>
        ) : (
          <List>
            {data.visits.map((v) => {
              const st = visitStatus(v);
              return (
                <ListItemButton key={v.visitPlanId} divider onClick={() => nav(`/visits/${v.visitPlanId}`)}>
                  <ListItemText
                    primary={<span><b>{v.time}</b> &nbsp; {v.agencyName}</span>}
                    secondary={[v.zone, v.phone].filter(Boolean).join(' · ') || undefined}
                  />
                  <Chip size="small" color={st.c} label={st.l} sx={{ mr: 1 }} />
                  <ChevronRightIcon color="action" />
                </ListItemButton>
              );
            })}
          </List>
        )}
      </Paper>
    </Box>
  );
}
