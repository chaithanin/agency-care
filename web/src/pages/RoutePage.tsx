import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  Chip,
  Alert,
  LinearProgress,
} from '@mui/material';
import DirectionsIcon from '@mui/icons-material/Directions';
import { api } from '../api/client';
import { useT } from '../i18n';

interface Stop {
  order: number;
  code: string;
  name: string;
  status: string;
}
interface RoutePlan {
  date: string;
  stops: Stop[];
  totalDistanceKm: number;
  skippedNoGps: number;
  mapsUrl: string | null;
}

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function RoutePage() {
  const { t, lang } = useT();
  const [date, setDate] = useState(todayStr());
  const [data, setData] = useState<RoutePlan | null>(null);
  const [loading, setLoading] = useState(false);

  const load = (d: string) => {
    setLoading(true);
    api.get('/route', { params: { date: d } }).then((r) => {
      setData(r.data);
      setLoading(false);
    });
  };
  useEffect(() => {
    load(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={700}>
          {t('rt.title')}
        </Typography>
        <TextField type="date" size="small" value={date} onChange={(e) => setDate(e.target.value)} />
      </Stack>

      {loading && <LinearProgress />}

      {data && (
        <Paper sx={{ p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1} flexWrap="wrap" useFlexGap>
            <Typography variant="body1">
              {lang === 'th'
                ? `${data.stops.length} จุด · ระยะทางรวม ~${data.totalDistanceKm} กม.`
                : `${data.stops.length} stops · total ~${data.totalDistanceKm} km`}
            </Typography>
            {data.mapsUrl && (
              <Button
                variant="contained"
                startIcon={<DirectionsIcon />}
                component="a"
                href={data.mapsUrl}
                target="_blank"
              >
                {t('rt.openMaps')}
              </Button>
            )}
          </Stack>

          {data.skippedNoGps > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {lang === 'th'
                ? `ข้าม ${data.skippedNoGps} ร้านที่ยังไม่มีพิกัด GPS (เติมพิกัดในหน้า Agency ก่อน)`
                : `Skipped ${data.skippedNoGps} agencies without GPS (set coordinates first)`}
            </Alert>
          )}

          {data.stops.length === 0 ? (
            <Typography color="text.secondary">{t('rt.noJobs')}</Typography>
          ) : (
            <List dense>
              {data.stops.map((s) => (
                <ListItem key={s.order} divider>
                  <Chip size="small" label={s.order} color="primary" sx={{ mr: 2 }} />
                  <ListItemText primary={s.name} secondary={s.code} />
                  {s.status === 'done' && <Chip size="small" color="success" label={t('c.done')} />}
                </ListItem>
              ))}
            </List>
          )}
        </Paper>
      )}
    </Box>
  );
}
