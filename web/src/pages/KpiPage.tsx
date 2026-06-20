import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Stack,
  TextField,
  Chip,
  LinearProgress,
} from '@mui/material';
import { api } from '../api/client';

interface Row {
  employeeId: string;
  name: string;
  code: string;
  planned: number;
  done: number;
  completionPct: number;
  reports: number;
  reportPct: number;
  accuracyPct: number;
  posmGiven: number;
  salesAmount: number;
}
interface Kpi {
  from: string;
  to: string;
  targets: { completionPct: number; reportPct: number; accuracyPct: number };
  rows: Row[];
}

const thisMonth = () => new Date().toISOString().slice(0, 7); // YYYY-MM

function pctChip(value: number, target: number) {
  const color = value >= target ? 'success' : value >= target * 0.7 ? 'warning' : 'error';
  return <Chip size="small" label={`${value}%`} color={color} />;
}

export default function KpiPage() {
  const [data, setData] = useState<Kpi | null>(null);
  const [month, setMonth] = useState(thisMonth());

  useEffect(() => {
    setData(null);
    const from = `${month}-01`;
    const [y, m] = month.split('-').map(Number);
    const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    api.get('/kpi', { params: { from, to } }).then((r) => setData(r.data));
  }, [month]);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={700}>
          KPI ประสิทธิภาพเซลส์
        </Typography>
        <TextField
          type="month"
          size="small"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
      </Stack>

      {!data ? (
        <LinearProgress />
      ) : (
        <Paper>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>เซลส์</TableCell>
                <TableCell align="right">แผน</TableCell>
                <TableCell align="right">เข้าเยี่ยม</TableCell>
                <TableCell align="center">Completion</TableCell>
                <TableCell align="center">ส่งรายงาน</TableCell>
                <TableCell align="center">GPS ตรง</TableCell>
                <TableCell align="right">POSM</TableCell>
                <TableCell align="right">ยอดขาย (บาท)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.rows.map((r) => (
                <TableRow key={r.employeeId}>
                  <TableCell>
                    {r.name}{' '}
                    <Typography component="span" variant="caption" color="text.secondary">
                      ({r.code})
                    </Typography>
                  </TableCell>
                  <TableCell align="right">{r.planned}</TableCell>
                  <TableCell align="right">{r.done}</TableCell>
                  <TableCell align="center">{pctChip(r.completionPct, data.targets.completionPct)}</TableCell>
                  <TableCell align="center">{pctChip(r.reportPct, data.targets.reportPct)}</TableCell>
                  <TableCell align="center">{pctChip(r.accuracyPct, data.targets.accuracyPct)}</TableCell>
                  <TableCell align="right">{r.posmGiven}</TableCell>
                  <TableCell align="right">{r.salesAmount.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
      {data && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          เป้าหมาย: Completion {data.targets.completionPct}% · ส่งรายงาน {data.targets.reportPct}% · GPS ตรง {data.targets.accuracyPct}%
        </Typography>
      )}
    </Box>
  );
}
