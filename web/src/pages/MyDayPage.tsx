import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  TextField,
  Chip,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Grid,
} from '@mui/material';
import { api } from '../api/client';

interface Item {
  id: string;
  startTime: string | null;
  endTime: string | null;
  type: string;
  title: string;
  done: boolean;
  agency: { name: string; zone: string | null } | null;
}
interface MyDay {
  employee: { name: string; code: string; position: string };
  date: string;
  today: { inOffice: boolean; items: Item[] } | null;
  month: {
    assigned: number;
    visitTarget: number;
    visitDone: number;
    newAgencyTarget: number;
    workDayTarget: number;
  };
  error?: string;
}

const typeLabel: Record<string, string> = {
  meeting: '👥 ประชุม',
  visit: '🏢 เยี่ยม',
  followup: '📞 ติดตาม',
  newAgency: '➕ หาลูกค้าใหม่',
  report: '📝 รายงาน',
  office: '🏛️ ออฟฟิศ',
  other: '•',
};
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
  const [date, setDate] = useState(today());
  const [data, setData] = useState<MyDay | null>(null);

  useEffect(() => {
    setData(null);
    api.get('/scheduling/my-day', { params: { date } }).then((r) => setData(r.data));
  }, [date]);

  if (!data) return <LinearProgress />;
  if (data.error) return <Typography color="error">{data.error}</Typography>;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={1}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            ตารางของฉัน
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {data.employee.name} · {data.employee.position === 'closer' ? 'Closer' : 'Sales'}
          </Typography>
        </Box>
        <TextField type="date" size="small" value={date} onChange={(e) => setDate(e.target.value)} />
      </Stack>

      {/* เป้าเดือน */}
      <Grid container spacing={1.5} mb={2}>
        <Grid item xs={4}>
          <Stat label="เยี่ยมเดือนนี้" value={data.month.visitDone} target={data.month.visitTarget} />
        </Grid>
        <Grid item xs={4}>
          <Stat label="Agency ดูแล" value={data.month.assigned} />
        </Grid>
        <Grid item xs={4}>
          <Stat label="เป้า Agency ใหม่" value={data.month.newAgencyTarget} />
        </Grid>
      </Grid>

      {/* ตารางวันนี้ */}
      <Paper>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 2, pb: 1 }}>
          <Typography variant="subtitle1" fontWeight={700}>
            แผนวัน {data.date}
          </Typography>
          {data.today?.inOffice && <Chip size="small" label="อยู่ประจำออฟฟิศ" color="info" />}
        </Stack>
        {!data.today || data.today.items.length === 0 ? (
          <Typography sx={{ p: 2, color: 'text.secondary' }}>
            ยังไม่มีแผนวันนี้ (ให้ผู้ดูแลกด "สร้างแผนเดือน")
          </Typography>
        ) : (
          <List dense>
            {data.today.items.map((it) => (
              <ListItem key={it.id} divider>
                <ListItemText
                  primary={
                    <span>
                      <b>{it.startTime ?? ''}{it.endTime ? `-${it.endTime}` : ''}</b>{' '}
                      {typeLabel[it.type] ?? it.type} — {it.agency?.name ?? it.title}
                    </span>
                  }
                  secondary={it.agency?.zone ?? undefined}
                />
                {it.done && <Chip size="small" label="เสร็จ" color="success" />}
              </ListItem>
            ))}
          </List>
        )}
      </Paper>
    </Box>
  );
}
