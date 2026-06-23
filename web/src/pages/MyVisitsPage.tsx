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
} from '@mui/material';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useT } from '../i18n';

interface Plan {
  id: string;
  status: string;
  agency: { code: string; name: string; zone?: string };
  checkin?: { id: string } | null;
}

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function MyVisitsPage() {
  const { t } = useT();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [date, setDate] = useState(todayStr());
  const nav = useNavigate();

  useEffect(() => {
    setPlans(null);
    api.get('/visits/plans', { params: { date } }).then((r) => setPlans(r.data));
  }, [date]);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={700}>
          {t('mv.title')}
        </Typography>
        <TextField
          type="date"
          size="small"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </Stack>

      {plans === null && <LinearProgress />}
      {plans?.length === 0 && (
        <Typography color="text.secondary" textAlign="center" mt={4}>
          {t('mv.noJobs')}
        </Typography>
      )}

      <Stack spacing={1.5}>
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
