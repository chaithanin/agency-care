import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Typography, Paper, Stack, TextField, MenuItem, LinearProgress, Chip, Tooltip,
  ToggleButton, ToggleButtonGroup, IconButton, Button,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { api } from '../api/client';
import { exportElementToPdf } from '../utils/pdf';
import { useAuth } from '../auth/AuthContext';
import { useT } from '../i18n';

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
const fmt = (d: Date) => d.toISOString().slice(0, 10);

// สร้าง HTML ปฏิทินเดือน (สำหรับ PDF รายคน)
function buildMonthHTML(d: CalData, title: string, month: string, dow: string[], holLabel: string): string {
  const [y, m] = month.split('-').map(Number);
  const dim = new Date(y, m, 0).getDate();
  const lead = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const empHol = new Set(d.empHolidays ?? []);
  let cells = '<tr>';
  let col = 0;
  for (let i = 0; i < lead; i++) { cells += '<td style="border:1px solid #ddd"></td>'; col++; }
  for (let day = 1; day <= dim; day++) {
    const ds = `${month}-${String(day).padStart(2, '0')}`;
    const visits = d.days[ds] ?? [];
    const hol = empHol.has(ds);
    const list = visits.slice(0, 8).map((v) => `<div style="font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${v.agencyName}</div>`).join('');
    cells += `<td style="border:1px solid #ddd;vertical-align:top;height:78px;width:14%;padding:2px;background:${hol ? '#fdecea' : '#fff'}"><b>${day}</b> ${visits.length ? `<span style="color:#1565c0">(${visits.length})</span>` : ''} ${hol ? `<span style="color:#c00;font-size:8px">${holLabel}</span>` : ''}${list}</td>`;
    col++;
    if (col % 7 === 0) cells += '</tr><tr>';
  }
  cells += '</tr>';
  const head = dow.map((x) => `<th style="border:1px solid #ddd;background:#f2f2f2;font-size:11px">${x}</th>`).join('');
  return `<div style="font-family:sans-serif"><h3 style="margin:0 0 6px">${title} — ${month}</h3><table style="width:100%;border-collapse:collapse;table-layout:fixed"><tr>${head}</tr>${cells}</table></div>`;
}

export default function CalendarPage() {
  const [month, setMonth] = useState(thisMonth());
  const [empId, setEmpId] = useState('');
  const [view, setView] = useState<View>('month');
  const [anchor, setAnchor] = useState(0); // index offset (วัน/สัปดาห์)
  const [data, setData] = useState<CalData | null>(null);
  const [exporting, setExporting] = useState(false);
  const pdfRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { t } = useT();
  const isSales = user?.role === 'sales';
  const DOW = [t('cal.dowSun'), t('cal.dowMon'), t('cal.dowTue'), t('cal.dowWed'), t('cal.dowThu'), t('cal.dowFri'), t('cal.dowSat')];

  // PDF: มุมมองปัจจุบัน (ทั้งหมด หรือเซลส์ที่เลือก)
  const exportCurrent = async () => {
    if (!pdfRef.current) return;
    setExporting(true);
    try {
      const who = empId ? data?.sales.find((s) => s.id === empId)?.name ?? 'seller' : t('cal.everyone');
      await exportElementToPdf(pdfRef.current, `${t('cal.pdfFilename')}-${who}-${month}.pdf`);
    } finally { setExporting(false); }
  };

  // PDF: แยกทุกคน (หน้าละคน)
  const exportPerPerson = async () => {
    if (!data) return;
    setExporting(true);
    const holder = document.createElement('div');
    holder.style.cssText = 'position:fixed;left:-9999px;top:0;width:1000px;background:#fff;padding:16px';
    document.body.appendChild(holder);
    try {
      const [yy, mm] = month.split('-').map(Number);
      const pdf = new jsPDF('l', 'mm', 'a4');
      const pw = pdf.internal.pageSize.getWidth();
      let first = true;
      for (const s of data.sales) {
        const r = await api.get('/scheduling/calendar', { params: { year: yy, month: mm, employeeId: s.id } });
        holder.innerHTML = buildMonthHTML(r.data, s.name, month, DOW, t('cal.holiday'));
        const canvas = await html2canvas(holder, { scale: 2, backgroundColor: '#ffffff' });
        const img = canvas.toDataURL('image/jpeg', 0.9);
        const h = (canvas.height * pw) / canvas.width;
        if (!first) pdf.addPage();
        first = false;
        pdf.addImage(img, 'JPEG', 0, 0, pw, h);
      }
      pdf.save(`${t('cal.pdfPerPerson')}-${month}.pdf`);
    } finally {
      document.body.removeChild(holder);
      setExporting(false);
    }
  };

  const load = useCallback(async () => {
    setData(null);
    const [y, m] = month.split('-').map(Number);
    const url = isSales ? '/scheduling/my-calendar' : '/scheduling/calendar';
    const r = await api.get(url, { params: { year: y, month: m, employeeId: isSales ? undefined : empId || undefined } });
    setData(r.data);
  }, [month, empId, isSales]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setAnchor(0); }, [view, month]);

  // คลิกวัน: sales=วันหยุดตัวเอง · manager+เลือกเซลส์=วันหยุด sale คนนั้น · manager+ทุกคน=วันหยุดบริษัท
  const onDayClick = async (ds: string) => {
    if (isSales) {
      await api.post('/scheduling/my-holidays/toggle', { date: ds });
    } else if (empId) {
      await api.post('/scheduling/holidays/toggle', { employeeId: empId, date: ds });
    } else {
      const msg = t('cal.confirmCompanyHol').replace('{{date}}', ds);
      if (!window.confirm(msg)) return;
      await api.post('/scheduling/company-holidays/toggle', { date: ds });
    }
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
      <Box key={ds} onClick={() => onDayClick(ds)}
        sx={{
          minHeight: view === 'month' ? 92 : 70, border: 1,
          borderColor: isToday ? 'primary.main' : 'divider', borderRadius: 1, p: 0.6,
          bgcolor: isEmpHol ? 'error.50' : isHoliday ? 'grey.300' : 'background.paper',
          cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 0.3, overflow: 'hidden',
        }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="caption" fontWeight={isToday ? 700 : 500}>
            {view === 'month' ? d.getUTCDate() : `${DOW[d.getUTCDay()]} ${d.getUTCDate()}/${m}`}
          </Typography>
          {visits.length > 0 && <Chip size="small" label={visits.length} color="primary" sx={{ height: 16, fontSize: 10 }} />}
          {isEmpHol && <Chip size="small" label={t('cal.holiday')} color="error" sx={{ height: 16, fontSize: 9 }} />}
          {isHoliday && !isEmpHol && <Chip size="small" label={t('cal.companyHol')} sx={{ height: 16, fontSize: 9, bgcolor: 'grey.500', color: '#fff' }} />}
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
        <Typography variant="h5" fontWeight={700}>{t('cal.title')}</Typography>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <ToggleButtonGroup size="small" exclusive value={view} onChange={(_, v) => v && setView(v)}>
            <ToggleButton value="day">{t('cal.day')}</ToggleButton>
            <ToggleButton value="week">{t('cal.week')}</ToggleButton>
            <ToggleButton value="biweek">{t('cal.biweek')}</ToggleButton>
            <ToggleButton value="month">{t('cal.month')}</ToggleButton>
          </ToggleButtonGroup>
          {!isSales && (
            <TextField select size="small" label={t('c.seller')} value={empId} onChange={(e) => setEmpId(e.target.value)} sx={{ minWidth: 150 }}>
              <MenuItem value="">{t('cal.allCompanyHol')}</MenuItem>
              {data.sales.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
            </TextField>
          )}
          <TextField type="month" size="small" value={month} onChange={(e) => setMonth(e.target.value)} />
          <Button size="small" variant="outlined" startIcon={<PictureAsPdfIcon />} disabled={exporting} onClick={exportCurrent}>
            PDF
          </Button>
          {!isSales && (
            <Button size="small" variant="outlined" color="secondary" startIcon={<PictureAsPdfIcon />} disabled={exporting} onClick={exportPerPerson}>
              {t('cal.pdfAll')}
            </Button>
          )}
        </Stack>
      </Stack>

      {view !== 'month' && (
        <Stack direction="row" alignItems="center" justifyContent="center" spacing={1} mb={1}>
          <IconButton size="small" disabled={anchor <= 0} onClick={() => setAnchor((a) => a - 1)}><ChevronLeftIcon /></IconButton>
          <Typography variant="body2">{t('cal.range')} {anchor + 1}/{maxAnchor + 1}</Typography>
          <IconButton size="small" disabled={anchor >= maxAnchor} onClick={() => setAnchor((a) => a + 1)}><ChevronRightIcon /></IconButton>
        </Stack>
      )}

      <Paper sx={{ p: 1.5 }} ref={pdfRef}>{content}</Paper>

      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        {t('cal.hintMain')}
        {isSales ? t('cal.hintSalesClick') : empId ? t('cal.hintMgrSellerClick') : t('cal.hintMgrAllClick')}
      </Typography>
    </Box>
  );
}
