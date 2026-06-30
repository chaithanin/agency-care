import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardActionArea,
  CardContent,
  Stack,
  Chip,
  TextField,
  LinearProgress,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { useT } from '../i18n';
import { ExportPdfButton } from '../components/ExportPdfButton';

interface Plan {
  id: string;
  status: string;
  agency: { code: string; name: string; zone?: string };
  checkin?: { id: string } | null;
}

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function MyVisitsPage() {
  const { t } = useT();
  const [searchParams, setSearchParams] = useSearchParams();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [date, setDate] = useState(todayStr());
  const [period, setPeriod] = useState<'day' | 'month'>(() => {
    const param = searchParams.get('period');
    return (param === 'month' ? 'month' : 'day') as 'day' | 'month';
  });
  const nav = useNavigate();

  useEffect(() => {
    setPlans(null);
    if (period === 'day') {
      api.get('/visits/plans', { params: { date } }).then((r) => setPlans(r.data));
    } else {
      // Get first and last day of current month
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
      api.get('/visits/plans', { params: { from: firstDay, to: lastDay } }).then((r) => setPlans(r.data));
    }
  }, [date, period]);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={700}>
          {t('mv.title')}
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <ToggleButtonGroup
            size="small"
            value={period}
            onChange={(_, v) => {
              if (v) {
                setPeriod(v);
                setSearchParams({ period: v });
              }
            }}
          >
            <ToggleButton value="day">Day</ToggleButton>
            <ToggleButton value="month">Month</ToggleButton>
          </ToggleButtonGroup>
          {period === 'day' && (
            <TextField
              type="date"
              size="small"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          )}
          <ExportPdfButton
            tableId="my-visits-table"
            filename="my-visits"
            title="My Visits"
            size="small"
            variant="outlined"
          />
        </Stack>
      </Stack>

      {plans === null && <LinearProgress />}
      {plans?.length === 0 && (
        <Typography color="text.secondary" textAlign="center" mt={4}>
          {t('mv.noJobs')}
        </Typography>
      )}

      <Stack id="my-visits-table" spacing={1.5}>
        {plans?.map((p) => (
          <Card key={p.id} variant="outlined">
            <CardActionArea onClick={() => nav(`/visits/${p.id}`)}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="h6" fontWeight={700}>
                      {p.agency.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {p.agency.code} {p.agency.zone ? `· ${p.agency.zone}` : ''}
                    </Typography>
                  </Box>
                  {p.status === 'done' ? (
                    <Chip icon={<CheckCircleIcon />} color="success" label={t('c.done')} />
                  ) : (
                    <Chip icon={<LocationOnIcon />} color="warning" label={t('mv.pending')} />
                  )}
                </Stack>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Stack>
    </Box>
  );
}
