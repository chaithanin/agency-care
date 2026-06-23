import { Routes, Route, Navigate } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import { useAuth } from './auth/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import AgenciesPage from './pages/AgenciesPage';
import EmployeesPage from './pages/EmployeesPage';
import PlansPage from './pages/PlansPage';
import PosmPage from './pages/PosmPage';
import ProductsPage from './pages/ProductsPage';
import KpiPage from './pages/KpiPage';
import ModelsPage from './pages/ModelsPage';
import RoutePage from './pages/RoutePage';
import AssignmentPlannerPage from './pages/AssignmentPlannerPage';
import AnalyticsPage from './pages/AnalyticsPage';
import MyVisitsPage from './pages/MyVisitsPage';
import VisitDetailPage from './pages/VisitDetailPage';
import SchedulingPage from './pages/SchedulingPage';
import MyDayPage from './pages/MyDayPage';
import SellerPerformancePage from './pages/SellerPerformancePage';
import PipelinePage from './pages/PipelinePage';
import UsersPage from './pages/UsersPage';
import CalendarPage from './pages/CalendarPage';
import TasksPage from './pages/TasksPage';
import NotificationsPage from './pages/NotificationsPage';
import SiteVisitReportPage from './pages/SiteVisitReportPage';
import ReportsPage from './pages/ReportsPage';
import AgencyInfoFormPage from './pages/AgencyInfoFormPage';

function Splash() {
  return (
    <Box sx={{ display: 'grid', placeItems: 'center', height: '100vh' }}>
      <CircularProgress />
    </Box>
  );
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  const isManager = user.activeRole !== 'sales';

  return (
    <Layout>
      <Routes>
        {isManager ? (
          <>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/agencies" element={<AgenciesPage />} />
            <Route path="/agencies/:id/form" element={<AgencyInfoFormPage />} />
            <Route path="/employees" element={<EmployeesPage />} />
            <Route path="/plans" element={<PlansPage />} />
            <Route path="/posm" element={<PosmPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/models" element={<ModelsPage />} />
            <Route path="/kpi" element={<KpiPage />} />
            <Route path="/auto-assign" element={<AssignmentPlannerPage />} />
            <Route path="/scheduling" element={<SchedulingPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/seller-performance" element={<SellerPerformancePage />} />
            <Route path="/pipeline" element={<PipelinePage />} />
            {['super_admin', 'admin'].includes(user.role) && <Route path="/users" element={<UsersPage />} />}
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/site-visit-report" element={<SiteVisitReportPage />} />
            <Route path="/reports" element={<ReportsPage />} />
          </>
        ) : (
          <>
            <Route path="/" element={<MyVisitsPage />} />
            <Route path="/my-day" element={<MyDayPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
          </>
        )}
        <Route path="/route" element={<RoutePage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/visits/:id" element={<VisitDetailPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
