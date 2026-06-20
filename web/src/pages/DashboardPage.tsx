import { useEffect, useState } from 'react';
import {
  Paper,
  Typography,
  Box,
  LinearProgress,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
} from '@mui/material';
import { api } from '../api/client';

interface Summary {
  date: string;
  agencies: { total: number; active: number; inactive: number };
  visits: { planned: number; done: number; pending: number; completionPct: number };
  employees: number;
  perEmployee: {
    employeeId: string;
    name: string;
    code: string;
    planned: number;
    done: number;
    completionPct: number;
  }[];
}

function Kpi({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h4" fontWeight={700}>
        {value}
      </Typography>
      {sub && (
        <Typography variant="caption" color="text.secondary">
          {sub}
        </Typography>
      )}
    </Paper>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<Summary | null>(null);

  useEffect(() => {
    api.get('/dashboard/summary').then((r) => setData(r.data));
  }, []);

  if (!data) return <LinearProgress />;

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={2}>
        ภาพรวมวันนี้ — {data.date}
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          gap: 2,
          mb: 3,
        }}
      >
        <Kpi label="Agency ทั้งหมด" value={data.agencies.total} sub={`Active ${data.agencies.active}`} />
        <Kpi label="แผนเยี่ยมวันนี้" value={data.visits.planned} />
        <Kpi label="เข้าเยี่ยมแล้ว" value={data.visits.done} sub={`คงเหลือ ${data.visits.pending}`} />
        <Kpi label="Visit Completion" value={`${data.visits.completionPct}%`} />
      </Box>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" fontWeight={700} mb={1}>
          ประสิทธิภาพเซลส์ (วันนี้)
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>เซลส์</TableCell>
              <TableCell align="right">แผน</TableCell>
              <TableCell align="right">เข้าแล้ว</TableCell>
              <TableCell align="right">%</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.perEmployee.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ color: 'text.secondary' }}>
                  ยังไม่มีแผนเยี่ยมวันนี้
                </TableCell>
              </TableRow>
            )}
            {data.perEmployee.map((e) => (
              <TableRow key={e.employeeId}>
                <TableCell>
                  {e.name} <Typography component="span" variant="caption" color="text.secondary">({e.code})</Typography>
                </TableCell>
                <TableCell align="right">{e.planned}</TableCell>
                <TableCell align="right">{e.done}</TableCell>
                <TableCell align="right">
                  <Chip
                    size="small"
                    label={`${e.completionPct}%`}
                    color={e.completionPct >= 80 ? 'success' : e.completionPct >= 50 ? 'warning' : 'default'}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
