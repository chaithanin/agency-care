import { useCallback, useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Stack, TextField, MenuItem, LinearProgress, Chip, Tooltip,
} from '@mui/material';
import { api } from '../api/client';

interface DayVisit { agencyName: string; status: string; employeeName: string }
interface CalData {
  year: number;
  month: number;
  days: Record<string, DayVisit[]>;
  holidays: string[];
  sales: { id: string; name: string }[];
}

const thisMonth = () => new Date().toISOString().slice(0, 7);
const DOW = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

export default function CalendarPage() {
  const [month, setMonth] = useState(thisMonth());
  const [empId, setEmpId] = useState('');
  const [data, setData] = useState<CalData | null>(null);

  const load = useCallback(async () => {
    setData(null);
    const [y, m] = month.split('-').map(Number);
    const r = await api.get('/scheduling/calendar', { params: { year: y, month: m, employeeId: empId || undefined } });
    setData(r.data);
  }, [month, empId]);
  useEffect(() => { load(); }, [load]);

  if (!data) return <LinearProgress />;

  const [y, m] = month.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const daysInMonth = new Date(y, m, 0).getDate();
  const leadBlanks = first.getUTCDay(); // 0=อา
  const cells: (number | null)[] = [
    ...Array(leadBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const holidaySet = new Set(data.holidays);
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={1}>
        <Typography variant="h5" fontWeight={700}>ปฏิทินตารางงาน</Typography>
        <Stack direction="row" spacing={1}>
          <TextField select size="small" label="เซลส์" value={empId} onChange={(e) => setEmpId(e.target.value)} sx={{ minWidth: 160 }}>
            <MenuItem value="">ทุกคน (รวม)</MenuItem>
            {data.sales.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
          </TextField>
          <TextField type="month" size="small" value={month} onChange={(e) => setMonth(e.target.value)} />
        </Stack>
      </Stack>

      <Paper sx={{ p: 1.5 }}>
        {/* หัววัน */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 0.5, mb: 0.5 }}>
          {DOW.map((d) => (
            <Typography key={d} variant="caption" fontWeight={700} textAlign="center" color="text.secondary">{d}</Typography>
          ))}
        </Box>
        {/* ช่องวัน */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 0.5 }}>
          {cells.map((day, i) => {
            if (day == null) return <Box key={i} sx={{ minHeight: 92 }} />;
            const ds = `${month}-${String(day).padStart(2, '0')}`;
            const visits = data.days[ds] ?? [];
            const isHoliday = holidaySet.has(ds);
            const isToday = ds === todayStr;
            return (
              <Box key={i} sx={{
                minHeight: 92, border: 1, borderColor: isToday ? 'primary.main' : 'divider',
                borderRadius: 1, p: 0.5, bgcolor: isHoliday ? 'grey.100' : 'background.paper',
                display: 'flex', flexDirection: 'column', gap: 0.3, overflow: 'hidden',
              }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="caption" fontWeight={isToday ? 700 : 500} color={isHoliday ? 'text.disabled' : 'text.primary'}>{day}</Typography>
                  {visits.length > 0 && <Chip size="small" label={visits.length} color="primary" sx={{ height: 16, fontSize: 10 }} />}
                </Stack>
                {isHoliday && visits.length === 0 && <Typography variant="caption" color="text.disabled" sx={{ fontSize: 9 }}>หยุด</Typography>}
                {visits.slice(0, 3).map((v, j) => (
                  <Tooltip key={j} title={`${v.agencyName}${empId ? '' : ' · ' + v.employeeName} (${v.status})`}>
                    <Box sx={{
                      fontSize: 9.5, lineHeight: 1.2, px: 0.4, borderRadius: 0.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      bgcolor: v.status === 'done' ? 'success.50' : 'warning.50',
                      color: v.status === 'done' ? 'success.dark' : 'text.secondary',
                      border: '1px solid', borderColor: v.status === 'done' ? 'success.200' : 'warning.200',
                    }}>
                      {empId ? v.agencyName : `${v.employeeName}: ${v.agencyName}`}
                    </Box>
                  </Tooltip>
                ))}
                {visits.length > 3 && <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9 }}>+{visits.length - 3} อื่นๆ</Typography>}
              </Box>
            );
          })}
        </Box>
      </Paper>
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        เงื่อนไข: เซลส์เยี่ยม 15 ร้าน/สัปดาห์ · 24 วันทำงาน/เดือน · เลือกเซลส์เพื่อดูตารางรายคน
      </Typography>
    </Box>
  );
}
