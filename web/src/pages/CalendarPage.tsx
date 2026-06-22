import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Paper, Stack, TextField, MenuItem, LinearProgress, Chip, Tooltip,
  ToggleButton, ToggleButtonGroup, IconButton,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { api } from '../api/client';

interface DayVisit { agencyName: string; status: string; employeeName: string }
interface CalData {
  year: number; month: number;
  days: Record<string, DayVisit[]>;
  holidays: string[];
  empHolidays: string[];
  sales: { id: string; name: string }[];
}
type View = 'day' | 'week' | 'biweek' | 'month';

const thisMonth = () => new Date().toISOString().slice(0, 7);
const DOW = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
const fmt = (d: Date) => d.toISOString().slice(0, 10);

export default function CalendarPage() {
  const [month, setMonth] = useState(thisMonth());
  const [empId, setEmpId] = useState('');
  const [view, setView] = useState<View>('month');
  const [anchor, setAnchor] = useState(0); // index offset (วัน/สัปดาห์)
  const [data, setData] = useState<CalData | null>(null);

  const load = useCallback(async () => {
    setData(null);
    const [y, m] = month.split('-').map(Number);
    const r = await api.get('/scheduling/calendar', { params: { year: y, month: m, employeeId: empId || undefined } });
    setData(r.data);
  }, [month, empId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setAnchor(0); }, [view, month]);

  const toggleHoliday = async (ds: string) => {
    if (!empId) return;
    await api.post('/scheduling/holidays/toggle', { employeeId: empId, date: ds });
    load();
  };

  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const monthDates = useMemo(
    () => Array.from({ length: daysInMonth }, (_, i) => new Date(Date.UTC(y, m - 1, i + 1))),
    [y, m, daysInMonth],
  );

  if (!data) return <LinearProgress />;
  const holidaySet = new Set(data.holidays);
  const empHolSet = new Set(data.empHolidays);
  const todayStr = new Date().toISOString().slice(0, 10);
  const winSize = view === 'day' ? 1 : view === 'week' ? 7 : view === 'biweek' ? 14 : daysInMonth;

  const renderDayCard = (d: Date) => {
    const ds = fmt(d);
    const visits = data.days[ds] ?? [];
    const isHoliday = holidaySet.has(ds);
    const isEmpHol = empHolSet.has(ds);
    const isToday = ds === todayStr;
    return (
      <Box key={ds} onClick={() => toggleHoliday(ds)}
        sx={{
          minHeight: view === 'month' ? 92 : 70, border: 1,
          borderColor: isToday ? 'primary.main' : 'divider', borderRadius: 1, p: 0.6,
          bgcolor: isEmpHol ? 'error.50' : isHoliday ? 'grey.100' : 'background.paper',
          cursor: empId ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', gap: 0.3, overflow: 'hidden',
        }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="caption" fontWeight={isToday ? 700 : 500}>
            {view === 'month' ? d.getUTCDate() : `${DOW[d.getUTCDay()]} ${d.getUTCDate()}/${m}`}
          </Typography>
          {visits.length > 0 && <Chip size="small" label={visits.length} color="primary" sx={{ height: 16, fontSize: 10 }} />}
          {isEmpHol && <Chip size="small" label="หยุด" color="error" sx={{ height: 16, fontSize: 9 }} />}
        </Stack>
        {visits.slice(0, view === 'month' ? 3 : 8).map((v, j) => (
          <Tooltip key={j} title={`${v.agencyName}${empId ? '' : ' · ' + v.employeeName} (${v.status})`}>
            <Box sx={{
              fontSize: 9.5, lineHeight: 1.25, px: 0.4, borderRadius: 0.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              bgcolor: v.status === 'done' ? 'success.50' : 'warning.50',
              color: v.status === 'done' ? 'success.dark' : 'text.secondary',
              border: '1px solid', borderColor: v.status === 'done' ? 'success.200' : 'warning.200',
            }}>
              {empId ? v.agencyName : `${v.employeeName}: ${v.agencyName}`}
            </Box>
          </Tooltip>
        ))}
        {view === 'month' && visits.length > 3 && <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9 }}>+{visits.length - 3}</Typography>}
      </Box>
    );
  };

  // เดือน = grid 7 คอลัมน์, อื่นๆ = window
  let content;
  if (view === 'month') {
    const lead = monthDates[0].getUTCDay();
    const cells: (Date | null)[] = [...Array(lead).fill(null), ...monthDates];
    while (cells.length % 7 !== 0) cells.push(null);
    content = (
      <>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 0.5, mb: 0.5 }}>
          {DOW.map((d) => <Typography key={d} variant="caption" fontWeight={700} textAlign="center" color="text.secondary">{d}</Typography>)}
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 0.5 }}>
          {cells.map((d, i) => (d ? renderDayCard(d) : <Box key={i} />))}
        </Box>
      </>
    );
  } else {
    const start = Math.max(0, Math.min(anchor * winSize, daysInMonth - 1));
    const win = monthDates.slice(start, start + winSize);
    const cols = view === 'day' ? 1 : view === 'week' ? 7 : 7;
    content = (
      <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 0.5 }}>
        {win.map((d) => renderDayCard(d))}
      </Box>
    );
  }

  const maxAnchor = Math.max(0, Math.ceil(daysInMonth / winSize) - 1);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={1}>
        <Typography variant="h5" fontWeight={700}>ปฏิทินตารางงาน</Typography>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <ToggleButtonGroup size="small" exclusive value={view} onChange={(_, v) => v && setView(v)}>
            <ToggleButton value="day">วัน</ToggleButton>
            <ToggleButton value="week">สัปดาห์</ToggleButton>
            <ToggleButton value="biweek">2 สัปดาห์</ToggleButton>
            <ToggleButton value="month">เดือน</ToggleButton>
          </ToggleButtonGroup>
          <TextField select size="small" label="เซลส์" value={empId} onChange={(e) => setEmpId(e.target.value)} sx={{ minWidth: 150 }}>
            <MenuItem value="">ทุกคน (รวม)</MenuItem>
            {data.sales.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
          </TextField>
          <TextField type="month" size="small" value={month} onChange={(e) => setMonth(e.target.value)} />
        </Stack>
      </Stack>

      {view !== 'month' && (
        <Stack direction="row" alignItems="center" justifyContent="center" spacing={1} mb={1}>
          <IconButton size="small" disabled={anchor <= 0} onClick={() => setAnchor((a) => a - 1)}><ChevronLeftIcon /></IconButton>
          <Typography variant="body2">ช่วงที่ {anchor + 1}/{maxAnchor + 1}</Typography>
          <IconButton size="small" disabled={anchor >= maxAnchor} onClick={() => setAnchor((a) => a + 1)}><ChevronRightIcon /></IconButton>
        </Stack>
      )}

      <Paper sx={{ p: 1.5 }}>{content}</Paper>

      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        เซลส์เยี่ยม 15 ร้าน/สัปดาห์ · ทำงานทุกวัน (ไม่หยุดเสาร์-อาทิตย์) ·{' '}
        {empId ? 'คลิกวันเพื่อตั้ง/ยกเลิกวันหยุดของเซลส์คนนี้' : 'เลือกเซลส์เพื่อตั้งวันหยุดราย user'}
      </Typography>
    </Box>
  );
}
