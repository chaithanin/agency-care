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
import AutoAssignPage from './pages/AutoAssignPage';
import SettingsPage from './pages/SettingsPage';
import LeavePage from './pages/LeavePage';
import NotificationCenterPage from './pages/NotificationCenterPage';
import PrPage from './pages/PrPage';
import PrFormPage from './pages/PrFormPage';
import PrDetailPage from './pages/PrDetailPage';
import DocsPage from './pages/DocsPage';
import DocCreatePage from './pages/DocCreatePage';
import DocDetailPage from './pages/DocDetailPage';
import DocPrintPage from './pages/DocPrintPage';
import EmployeeFilePage from './pages/EmployeeFilePage';
import ApprovalCenterPage from './pages/ApprovalCenterPage';
import AuditPage from './pages/AuditPage';
import MasterDataPage from './pages/MasterDataPage';
import AiCenterPage from './pages/AiCenterPage';
import ExpensePage from './pages/ExpensePage';
import TrainingPage from './pages/TrainingPage';
import AgencyScorePage from './pages/AgencyScorePage';
import EvaluationPage from './pages/EvaluationPage';
import ProfilePage from './pages/ProfilePage';
import LineLinkPage from './pages/LineLinkPage';
import BroadcastPage from './pages/BroadcastPage';
import AppointmentPage from './pages/AppointmentPage';
import AiRiskPage from './pages/AiRiskPage';
import AiForecastPage from './pages/AiForecastPage';
import AiHealthPage from './pages/AiHealthPage';

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

  // /line-link เป็น public page สำหรับ LIFF — ไม่ต้อง auth
  if (window.location.pathname === '/line-link') {
    return <Routes><Route path="/line-link" element={<LineLinkPage />} /></Routes>;
  }

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
            <Route path="/quick-assign" element={<AutoAssignPage />} />
            <Route path="/scheduling" element={<SchedulingPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/seller-performance" element={<SellerPerformancePage />} />
            <Route path="/pipeline" element={<PipelinePage />} />
            {['manager', 'super_admin', 'admin'].includes(user.role) && <Route path="/users" element={<UsersPage />} />}
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/site-visit-report" element={<SiteVisitReportPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/leave" element={<LeavePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/notification-center" element={<NotificationCenterPage />} />
            <Route path="/approvals" element={<ApprovalCenterPage />} />
            <Route path="/ai-center" element={<AiCenterPage />} />
            <Route path="/audit" element={<AuditPage />} />
            <Route path="/master-data" element={<MasterDataPage />} />
            <Route path="/employees/:id/file" element={<EmployeeFilePage />} />
            <Route path="/expenses" element={<ExpensePage />} />
            <Route path="/training" element={<TrainingPage />} />
            <Route path="/agency-scores" element={<AgencyScorePage />} />
            <Route path="/evaluations" element={<EvaluationPage />} />
            <Route path="/appointments" element={<AppointmentPage />} />
            <Route path="/ai-risk" element={<AiRiskPage />} />
            <Route path="/ai-forecast" element={<AiForecastPage />} />
            <Route path="/ai-health" element={<AiHealthPage />} />
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
        <Route path="/leave" element={<LeavePage />} />
        <Route path="/pr" element={<PrPage />} />
        <Route path="/pr/create" element={<PrFormPage />} />
        <Route path="/pr/:id" element={<PrDetailPage />} />
        <Route path="/pr/:id/edit" element={<PrFormPage />} />
        <Route path="/docs" element={<DocsPage />} />
        <Route path="/docs/new" element={<DocCreatePage />} />
        <Route path="/docs/:id" element={<DocDetailPage />} />
        <Route path="/docs/:id/edit" element={<DocCreatePage />} />
        <Route path="/docs/:id/print" element={<DocPrintPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/visits/:id" element={<VisitDetailPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/broadcast" element={<BroadcastPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
