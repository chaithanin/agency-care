import { useState, useEffect } from 'react';
import {
  Box, Stack, Typography, Chip, CircularProgress,
} from '@mui/material';
import {
  Add, Refresh,
  CalendarMonth, ViewList, Dashboard as DashboardIcon,
} from '@mui/icons-material';
import { PremiumCard, KPICard } from '../components/premium/PremiumCard';
import { PremiumButton } from '../components/premium/PremiumButton';
import { api } from '../api/client';

// ─── Types ────────────────────────────────────────────────────────────────
interface Appointment {
  id: string;
  apptNo: string;
  status: string;
  apptType: string;
  meetingType: string;
  apptDate: string;
  startTime: string;
  endTime: string;
  agency: { id: string; name: string; code: string };
  sale?: { id: string; name: string };
}

const STATUS_CONFIG: Record<string, { label: string; color: 'default' | 'primary' | 'success' | 'warning' | 'error' }> = {
  pending: { label: 'Pending', color: 'warning' },
  confirmed: { label: 'Confirmed', color: 'primary' },
  checked_in: { label: 'Checked In', color: 'primary' },
  completed: { label: 'Completed', color: 'success' },
  cancelled: { label: 'Cancelled', color: 'error' },
  no_show: { label: 'No Show', color: 'default' },
};

// ─── Main Component ───────────────────────────────────────────────────────
export default function AppointmentPagePremium() {
  const [viewMode, setViewMode] = useState<'overview' | 'calendar' | 'list'>('overview');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);

  // Stats
  const stats = {
    total: appointments.length,
    today: appointments.filter(a => {
      const today = new Date().toISOString().split('T')[0];
      return a.apptDate === today;
    }).length,
    confirmed: appointments.filter(a => a.status === 'confirmed').length,
    pending: appointments.filter(a => a.status === 'pending').length,
    completed: appointments.filter(a => a.status === 'completed').length,
  };

  useEffect(() => {
    loadAppointments();
  }, []);

  const loadAppointments = async () => {
    setLoading(true);
    try {
      const response = await api.get('/appointments');
      setAppointments(response.data || []);
    } catch (e) {
      console.error('Failed to load appointments', e);
    } finally {
      setLoading(false);
    }
  };

  // ─── Render: Overview ─────────────────────────────────────────────────
  const renderOverview = () => (
    <Stack spacing={4}>
      {/* KPI Cards */}
      <Box>
        <Typography variant="h6" fontWeight={700} mb={2} color="white">
          📊 Appointment Metrics
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', lg: 'repeat(4, 1fr)' }, gap: 2 }}>
          <KPICard label="Total Appointments" value={stats.total} trend={{ direction: 'up', percentage: 5 }} icon="📅" color="primary" />
          <KPICard label="Today" value={stats.today} trend={{ direction: 'up', percentage: 0 }} icon="📆" color="success" />
          <KPICard label="Confirmed" value={stats.confirmed} trend={{ direction: 'up', percentage: 8 }} icon="✅" color="success" />
          <KPICard label="Pending" value={stats.pending} trend={{ direction: 'down', percentage: 2 }} icon="⏳" color="warning" />
        </Box>
      </Box>

      {/* Upcoming Appointments */}
      <PremiumCard className="p-6">
        <Typography variant="h6" fontWeight={700} mb={3} color="white">
          📅 Upcoming Appointments
        </Typography>
        {loading ? (
          <CircularProgress />
        ) : appointments.length === 0 ? (
          <Typography color="text.secondary">No appointments found</Typography>
        ) : (
          <Stack spacing={2}>
            {appointments.slice(0, 5).map(appt => (
              <Box
                key={appt.id}
                sx={{
                  p: 2,
                  borderRadius: '12px',
                  bgcolor: 'rgba(255, 255, 255, 0.05)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  '&:hover': {
                    bgcolor: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                  },
                  transition: 'all 300ms ease',
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box flex={1}>
                    <Typography variant="subtitle2" fontWeight={600} color="white">
                      {appt.agency.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {appt.agency.code} • {appt.sale?.name || 'Unassigned'}
                    </Typography>
                    <Stack direction="row" spacing={1} mt={1}>
                      <Typography variant="caption" color="text.secondary">
                        📅 {appt.apptDate}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        🕐 {appt.startTime?.substring(0, 5)}
                      </Typography>
                    </Stack>
                  </Box>
                  <Chip
                    size="small"
                    label={STATUS_CONFIG[appt.status]?.label || appt.status}
                    color={STATUS_CONFIG[appt.status]?.color || 'default'}
                  />
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
      </PremiumCard>

      {/* Quick Stats */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
        <PremiumCard className="p-6">
          <Typography variant="h6" fontWeight={700} mb={3} color="white">
            🔴 By Status
          </Typography>
          <Stack spacing={2}>
            {Object.entries(STATUS_CONFIG).map(([status, config]) => (
              <Box key={status} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  {config.label}
                </Typography>
                <Typography variant="body2" fontWeight={600} color="white">
                  {appointments.filter(a => a.status === status).length}
                </Typography>
              </Box>
            ))}
          </Stack>
        </PremiumCard>

        <PremiumCard className="p-6">
          <Typography variant="h6" fontWeight={700} mb={3} color="white">
            👥 By Salesperson
          </Typography>
          <Stack spacing={2}>
            {Array.from(new Set(appointments.map(a => a.sale?.id))).slice(0, 5).map(saleId => {
              const sale = appointments.find(a => a.sale?.id === saleId)?.sale;
              if (!sale) return null;
              return (
                <Box key={saleId} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    {sale.name}
                  </Typography>
                  <Typography variant="body2" fontWeight={600} color="white">
                    {appointments.filter(a => a.sale?.id === saleId).length}
                  </Typography>
                </Box>
              );
            })}
          </Stack>
        </PremiumCard>
      </Box>
    </Stack>
  );

  return (
    <Box sx={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 27, 75, 0.95) 100%)',
      p: 3,
    }}>
      {/* Header */}
      <Box mb={4}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
          <Box>
            <Typography variant="h4" fontWeight={800} sx={{
              background: 'linear-gradient(135deg, #6C63FF 0%, #FF7AC6 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
            }}>
              Activity Calendar
            </Typography>
            <Typography variant="body2" color="text.secondary" mt={1}>
              Track and manage all your appointments
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <PremiumButton variant="secondary" size="md" onClick={loadAppointments}>
              <Refresh sx={{ fontSize: 18 }} />
              Refresh
            </PremiumButton>
            <PremiumButton variant="primary" size="md">
              <Add sx={{ fontSize: 18 }} />
              New Appointment
            </PremiumButton>
          </Stack>
        </Stack>

        {/* View Mode Tabs */}
        <Stack direction="row" spacing={1}>
          {[
            { mode: 'overview', label: 'Overview', icon: <DashboardIcon sx={{ fontSize: 18 }} /> },
            { mode: 'calendar', label: 'Calendar', icon: <CalendarMonth sx={{ fontSize: 18 }} /> },
            { mode: 'list', label: 'List', icon: <ViewList sx={{ fontSize: 18 }} /> },
          ].map(tab => (
            <PremiumButton
              key={tab.mode}
              variant={viewMode === tab.mode ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode(tab.mode as any)}
            >
              {tab.icon}
              {tab.label}
            </PremiumButton>
          ))}
        </Stack>
      </Box>

      {/* Content */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        renderOverview()
      )}
    </Box>
  );
}
