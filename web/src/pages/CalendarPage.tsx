import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Typography, Paper, Stack, TextField, MenuItem, LinearProgress, Chip, Tooltip,
  ToggleButton, ToggleButtonGroup, IconButton, Button, FormControl, InputLabel, Select,
  OutlinedInput, Checkbox, ListItemText,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DownloadIcon from '@mui/icons-material/Download';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { api } from '../api/client';
import { exportElementToPdf } from '../utils/pdf';
import { useAuth } from '../auth/AuthContext';
import { useT } from '../i18n';
import { ExportPdfButton } from '../components/ExportPdfButton';

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

const todayStr2 = () => new Date().toISOString().slice(0, 10);

export default function CalendarPage() {
  const [month, setMonth] = useState(thisMonth());
  const [empId, setEmpId] = useState('');
  const [view, setView] = useState<View>('month');
  const [anchor, setAnchor] = useState(0); // index offset (วัน/สัปดาห์)
  const [data, setData] = useState<CalData | null>(null);
  const [exporting, setExporting] = useState(false);
  const [rangeMode, setRangeMode] = useState(false);
  const [rangeFrom, setRangeFrom] = useState(todayStr2());
  const [rangeTo, setRangeTo] = useState(todayStr2());

  // Filter state
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterType, setFilterType] = useState<string[]>([]);
  const [filterKeyActivity, setFilterKeyActivity] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterOwner, setFilterOwner] = useState<string[]>([]);

  const activityTypes = ['Activity', 'Conversation', 'Task', 'Birthday'];
  const statuses = ['Active', 'Pending', 'Completed', 'Cancelled'];
  const keyActivities = [
    'AG Bring Customer',
    'Agency Sign VIP',
    'Call Agency',
    'Call for NEW PROJECT',
    'Come Open house',
    'Come to Party',
    'Customer Registration by Agency Record',
    'Follow-up Deposit',
    'Follow-up Holding Unit',
    'Follow-up Reservation',
    'Found New Agency',
    'Impress Villa',
    'Internal Training',
    'Invitation to opening house',
    'Invitation to Party',
    'Make Photo&VDO',
    'Managment Internal Meeting',
    'Meet Management',
    'Meeting for new Projects',
    'Old Customer',
    'Online Customer',
    'Orientation',
    'Orientation New Agency Only',
    'Pick up-Drop Customer',
    'Repeat Customer',
    'Sale Support - Admin',
    'Sales Team Morning Meetings Points',
    'Show units',
    'Sign Agency Agreement',
    'VDO Call / Meeting',
    'Visit Agency Office',
    'Visit Booth',
    'Walk In Agency',
    'Walk In Customer',
  ];
  const owners = data?.sales ?? [];
  const [agencySearch, setAgencySearch] = useState('');

  const exportCsv = () => {
    if (!data) return;
    const lines = [['Date', 'Agency', 'Employee', 'Status'].join(',')];
    for (const [date, visits] of Object.entries(data.days).sort()) {
      for (const v of visits) {
        lines.push([date, `"${v.agencyName}"`, `"${v.employeeName}"`, v.status].join(','));
      }
    }
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `calendar-${rangeMode ? `${rangeFrom}-${rangeTo}` : month}${empId ? `-${data.sales.find((s) => s.id === empId)?.name}` : ''}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };
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
    if (rangeMode && !isSales) {
      const r = await api.get('/scheduling/calendar-range', { params: { from: rangeFrom, to: rangeTo, employeeId: empId || undefined } });
      setData({ ...r.data, year: new Date(rangeFrom).getUTCFullYear(), month: new Date(rangeFrom).getUTCMonth() + 1 });
    } else {
      const [y, m] = month.split('-').map(Number);
      const url = isSales ? '/scheduling/my-calendar' : '/scheduling/calendar';
      const r = await api.get(url, { params: { year: y, month: m, employeeId: isSales ? undefined : empId || undefined } });
      setData(r.data);
    }
  }, [month, empId, isSales, rangeMode, rangeFrom, rangeTo]);
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

  // Check if any filters are active
  const hasFilters = filterDateFrom || filterDateTo;

  // Filter data based on all filters
  const filteredData = useMemo(() => {
    if (!data) return null;
    if (!hasFilters) return data;

    const filtered: CalData = {
      ...data,
      days: {},
    };

    for (const [date, visits] of Object.entries(data.days)) {
      const filteredVisits = visits.filter((v) => {
        // Date range filters
        if (filterDateFrom && date < filterDateFrom) return false;
        if (filterDateTo && date > filterDateTo) return false;

        // Type filter (not implemented in API, needs data structure)
        if (filterType.length > 0) {
          // TODO: Need activityType field in visit data
        }

        // Key activity filter (not implemented in API)
        if (filterKeyActivity) {
          // TODO: Need keyActivity field in visit data
        }

        // Status filter (not implemented in API)
        if (filterStatus) {
          // TODO: Use v.status when available
        }

        // Customer filter
        if (filterCustomer && !v.agencyName.toLowerCase().includes(filterCustomer.toLowerCase())) {
          return false;
        }

        // Owner/Employee filter
        if (filterOwner.length > 0 && !filterOwner.includes(v.employeeName)) {
          return false;
        }

        // Agency search filter
        if (agencySearch && !v.agencyName.toLowerCase().includes(agencySearch.toLowerCase())) {
          return false;
        }

        return true;
      });

      if (filteredVisits.length > 0) {
        filtered.days[date] = filteredVisits;
      }
    }

    return filtered;
  }, [data, filterDateFrom, filterDateTo, filterType, filterKeyActivity, filterStatus, filterCustomer, filterOwner, agencySearch, hasFilters]);

  // Calculate result count
  const resultCount = useMemo(() => {
    if (!filteredData) return 0;
    return Object.values(filteredData.days).reduce((sum, visits) => sum + visits.length, 0);
  }, [filteredData]);

  if (!data || !filteredData) return <LinearProgress />;
  const holidaySet = new Set(data.holidays);
  const empHolSet = new Set(data.empHolidays);
  const todayStr = new Date().toISOString().slice(0, 10);
  const winSize = view === 'day' ? 1 : view === 'week' ? 7 : view === 'biweek' ? 14 : daysInMonth;

  const renderDayCard = (d: Date) => {
    const ds = fmt(d);
    const visits = filteredData.days[ds] ?? [];
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

  const resetFilters = () => {
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterType([]);
    setFilterKeyActivity('');
    setFilterStatus('');
    setFilterCustomer('');
    setFilterOwner([]);
    setAgencySearch('');
  };

  const hasAnyFilters = filterDateFrom || filterDateTo || filterType.length > 0 || filterKeyActivity || filterStatus || filterCustomer || filterOwner.length > 0 || agencySearch;

  return (
    <Box>
      {/* Filter Section */}
      <Paper sx={{ p: 2, mb: 2, bgcolor: 'background.default' }}>
        <Stack spacing={2}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="subtitle2" fontWeight={600}>
              {t('c.filters') || 'Filters'}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              {(filterType.length > 0 || filterKeyActivity || filterStatus || filterCustomer || filterOwner.length > 0) && (
                filterType.map(type => <Chip key={type} label={type} onDelete={() => setFilterType(filterType.filter(t => t !== type))} size="small" />)
              )}
              {filterKeyActivity && <Chip label={`Key: ${filterKeyActivity}`} onDelete={() => setFilterKeyActivity('')} size="small" />}
              {filterStatus && <Chip label={`Status: ${filterStatus}`} onDelete={() => setFilterStatus('')} size="small" />}
              {filterCustomer && <Chip label={`Customer: ${filterCustomer}`} onDelete={() => setFilterCustomer('')} size="small" />}
              {filterOwner.length > 0 && <Chip label={`Owner: ${filterOwner.length}`} onDelete={() => setFilterOwner([])} size="small" />}
            {agencySearch && <Chip label={`Agency: ${agencySearch}`} onDelete={() => setAgencySearch('')} size="small" />}
            </Stack>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-end" flexWrap="wrap" useFlexGap>
            {/* Type Filter */}
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Type</InputLabel>
              <Select
                multiple
                value={filterType}
                onChange={(e) => setFilterType(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
                input={<OutlinedInput label="Type" />}
                renderValue={(selected) => selected.length === 0 ? 'Select' : `${selected.length} selected`}
              >
                {activityTypes.map(type => (
                  <MenuItem key={type} value={type}>
                    <Checkbox checked={filterType.includes(type)} />
                    <ListItemText primary={type} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Key Activity Filter */}
            <TextField
              select
              size="small"
              label="Key Activity"
              value={filterKeyActivity}
              onChange={(e) => setFilterKeyActivity(e.target.value)}
              sx={{ minWidth: 140 }}
            >
              <MenuItem value="">All</MenuItem>
              {keyActivities.map(ka => <MenuItem key={ka} value={ka}>{ka}</MenuItem>)}
            </TextField>

            {/* Status Filter */}
            <TextField
              select
              size="small"
              label="Status"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              sx={{ minWidth: 140 }}
            >
              <MenuItem value="">All</MenuItem>
              {statuses.map(status => <MenuItem key={status} value={status}>{status}</MenuItem>)}
            </TextField>

            {/* Customer Filter */}
            <TextField
              size="small"
              label="Customer"
              placeholder="Search..."
              value={filterCustomer}
              onChange={(e) => setFilterCustomer(e.target.value)}
              sx={{ minWidth: 140 }}
            />

            {/* Agency Search Filter */}
            <TextField
              size="small"
              label="Agency"
              placeholder="Search agency..."
              value={agencySearch}
              onChange={(e) => setAgencySearch(e.target.value)}
              sx={{ minWidth: 160 }}
            />

            {/* Owner Filter */}
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Owner</InputLabel>
              <Select
                multiple
                value={filterOwner}
                onChange={(e) => setFilterOwner(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
                input={<OutlinedInput label="Owner" />}
                renderValue={(selected) => selected.length === 0 ? 'Select' : `${selected.length} selected`}
              >
                {owners.map(owner => (
                  <MenuItem key={owner.id} value={owner.id}>
                    <Checkbox checked={filterOwner.includes(owner.id)} />
                    <ListItemText primary={owner.name} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {hasAnyFilters && (
              <Button size="small" variant="outlined" onClick={resetFilters}>
                {t('c.reset') || 'Clear All'}
              </Button>
            )}
            <Box sx={{ flexGrow: 1 }} />
            <Typography variant="caption" color="text.secondary" fontWeight={500}>
              {resultCount} {resultCount === 1 ? 'visit' : 'visits'}
            </Typography>
          </Stack>
        </Stack>
      </Paper>

      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={1}>
        <Typography variant="h5" fontWeight={700}>{t('cal.title')}</Typography>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <ToggleButtonGroup size="small" exclusive value={view} onChange={(_, v) => v && setView(v)}>
            <ToggleButton value="day">{t('cal.day')}</ToggleButton>
            <ToggleButton value="week">{t('cal.week')}</ToggleButton>
            <ToggleButton value="biweek">{t('cal.biweek')}</ToggleButton>
            <ToggleButton value="month">{t('cal.month')}</ToggleButton>
          </ToggleButtonGroup>
          <TextField select size="small" label={t('c.seller')} value={empId} onChange={(e) => setEmpId(e.target.value)} sx={{ minWidth: 150 }}>
            <MenuItem value="">{t('cal.allCompanyHol')}</MenuItem>
            {data.sales.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
          </TextField>
          {!isSales && (
            <Chip size="small" label={rangeMode ? 'Date Range' : 'Monthly'}
              color={rangeMode ? 'primary' : 'default'} clickable onClick={() => setRangeMode((v) => !v)} />
          )}
          {rangeMode && !isSales ? (
            <>
              <TextField size="small" type="date" label="From" value={rangeFrom}
                onChange={(e) => setRangeFrom(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 155 }} />
              <TextField size="small" type="date" label="To" value={rangeTo}
                onChange={(e) => setRangeTo(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 155 }} />
            </>
          ) : (
            <TextField type="month" size="small" value={month} onChange={(e) => setMonth(e.target.value)} />
          )}
          <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={exportCsv}>
            CSV
          </Button>
          <Button size="small" variant="outlined" startIcon={<PictureAsPdfIcon />} disabled={exporting} onClick={exportCurrent}>
            PDF
          </Button>
          {!isSales && (
            <Button size="small" variant="outlined" color="secondary" startIcon={<PictureAsPdfIcon />} disabled={exporting} onClick={exportPerPerson}>
              {t('cal.pdfAll')}
            </Button>
          )}
          <ExportPdfButton tableId="calendar-table" filename="calendar" title="Calendar" size="small" />
        </Stack>
      </Stack>

      {view !== 'month' && (
        <Stack direction="row" alignItems="center" justifyContent="center" spacing={1} mb={1}>
          <IconButton size="small" disabled={anchor <= 0} onClick={() => setAnchor((a) => a - 1)}><ChevronLeftIcon /></IconButton>
          <Typography variant="body2">{t('cal.range')} {anchor + 1}/{maxAnchor + 1}</Typography>
          <IconButton size="small" disabled={anchor >= maxAnchor} onClick={() => setAnchor((a) => a + 1)}><ChevronRightIcon /></IconButton>
        </Stack>
      )}

      <Paper id="calendar-table" sx={{ p: 1.5 }} ref={pdfRef}>{content}</Paper>

      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        {t('cal.hintMain')}
        {isSales ? t('cal.hintSalesClick') : empId ? t('cal.hintMgrSellerClick') : t('cal.hintMgrAllClick')}
      </Typography>
    </Box>
  );
}
