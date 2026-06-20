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
import AutoAssignPage from './pages/AutoAssignPage';
import AnalyticsPage from './pages/AnalyticsPage';
import MyVisitsPage from './pages/MyVisitsPage';
import VisitDetailPage from './pages/VisitDetailPage';

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

  const isManager = user.role === 'admin' || user.role === 'manager';

  return (
    <Layout>
      <Routes>
        {isManager ? (
          <>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/agencies" element={<AgenciesPage />} />
            <Route path="/employees" element={<EmployeesPage />} />
            <Route path="/plans" element={<PlansPage />} />
            <Route path="/posm" element={<PosmPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/models" element={<ModelsPage />} />
            <Route path="/kpi" element={<KpiPage />} />
            <Route path="/auto-assign" element={<AutoAssignPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
          </>
        ) : (
          <Route path="/" element={<MyVisitsPage />} />
        )}
        <Route path="/route" element={<RoutePage />} />
        <Route path="/visits/:id" element={<VisitDetailPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
