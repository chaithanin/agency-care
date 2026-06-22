import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Stack,
  MenuItem,
  TextField,
  Chip,
  Alert,
} from '@mui/material';
import { Link } from 'react-router-dom';
import { api, errMsg } from '../api/client';
import { useT } from '../i18n';

interface Opt {
  id: string;
  code: string;
  name: string;
}
interface Plan {
  id: string;
  planDate: string;
  status: string;
  agency: { code: string; name: string };
  employee: { name: string };
  checkin?: { withinRadius: boolean; distanceMeters: number } | null;
  report?: { id: string } | null;
}

const todayStr = () => new Date().toISOString().slice(0, 10);

const statusColor: Record<string, 'default' | 'success' | 'warning' | 'error'> = {
  pending: 'warning',
  done: 'success',
  postponed: 'default',
  cancelled: 'error',
};

export default function PlansPage() {
  const { t } = useT();
  const [agencies, setAgencies] = useState<Opt[]>([]);
  const [employees, setEmployees] = useState<Opt[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [date, setDate] = useState(todayStr());
  const [form, setForm] = useState({ agencyId: '', employeeId: '', note: '' });
  const [error, setError] = useState('');

  const loadPlans = (d: string) =>
    api.get('/visits/plans', { params: { date: d } }).then((r) => setPlans(r.data));

  useEffect(() => {
    api.get('/agencies').then((r) => setAgencies(r.data));
    api.get('/employees').then((r) => setEmployees(r.data));
  }, []);
  useEffect(() => {
    loadPlans(date);
  }, [date]);

  const create = async () => {
    setError('');
    if (!form.agencyId || !form.employeeId) {
      setError('เลือก Agency และเซลส์');
      return;
    }
    try {
      await api.post('/visits/plans', {
        agencyId: form.agencyId,
        employeeId: form.employeeId,
        planDate: date,
        note: form.note || undefined,
      });
      setForm({ agencyId: '', employeeId: '', note: '' });
      loadPlans(date);
    } catch (e) {
      setError(errMsg(e));
    }
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={2}>
        {t('pl2.title')}
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
          <TextField
            type="date"
            label={t('pl2.date')}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            select
            label="Agency"
            value={form.agencyId}
            onChange={(e) => setForm({ ...form, agencyId: e.target.value })}
            sx={{ minWidth: 200 }}
          >
            {agencies.map((a) => (
              <MenuItem key={a.id} value={a.id}>
                {a.code} — {a.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label={t('c.seller')}
            value={form.employeeId}
            onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
            sx={{ minWidth: 180 }}
          >
            {employees.map((e) => (
              <MenuItem key={e.id} value={e.id}>
                {e.name} ({e.code})
              </MenuItem>
            ))}
          </TextField>
          <Button variant="contained" onClick={create}>
            {t('pl2.add')}
          </Button>
        </Stack>
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </Paper>

      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Agency</TableCell>
              <TableCell>{t('c.seller')}</TableCell>
              <TableCell>{t('c.status')}</TableCell>
              <TableCell>Check-in</TableCell>
              <TableCell>{t('pl2.report')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {plans.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ color: 'text.secondary' }}>
                  ยังไม่มีแผนในวันนี้
                </TableCell>
              </TableRow>
            )}
            {plans.map((p) => (
              <TableRow key={p.id} hover component={Link} to={`/visits/${p.id}`} sx={{ textDecoration: 'none' }}>
                <TableCell>
                  {p.agency.code} — {p.agency.name}
                </TableCell>
                <TableCell>{p.employee.name}</TableCell>
                <TableCell>
                  <Chip size="small" label={p.status} color={statusColor[p.status]} />
                </TableCell>
                <TableCell>
                  {p.checkin ? `${p.checkin.distanceMeters} ม.` : '-'}
                </TableCell>
                <TableCell>{p.report ? '✓' : '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
