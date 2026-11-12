import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AuthScreen from '@/components/AuthScreen';
import PasswordReset from '@/components/PasswordReset';
import { Suspense } from 'react';
import { AppDataProvider } from '@/services/AppData';
import { WorkingSessionProvider } from '@/services/WorkingSession';
import { DataGate } from '@/components/AppUI';
import LeoAssistant from '@/components/LeoAssistant';
import AppStatus from '@/components/AppStatus';
import { configurationError } from '@/lib/supabase';
import AppErrorBoundary from '@/components/AppErrorBoundary';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated, profile, passwordRecovery } = useAuth();
  const location = useLocation();

  // Show branded loading screen
  if (isLoadingPublicSettings || isLoadingAuth) {
    return <AppStatus title="Загрузка приложения" loading>Самочувствие и рабочие привычки</AppStatus>;
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      return <AuthScreen />;
    }
    return <AppStatus title="Приложение временно недоступно">
      <p>{authError.message}</p>
      <button className="text-indigo-600 underline" onClick={() => window.location.reload()}>Повторить</button>
    </AppStatus>;
  }

  if (passwordRecovery && isAuthenticated) return <PasswordReset />;

  // Опрос обязателен: пока он не пройден, другие страницы недоступны
  if (profile?.role === 'admin' && !location.pathname.startsWith('/admin')) return <Navigate to="/admin" replace />;
  if (profile?.role !== 'admin' && location.pathname.startsWith('/admin')) return <Navigate to="/Dashboard" replace />;
  if (isAuthenticated && profile && profile.role !== 'admin') {
    // New/incomplete users continue onboarding. Completed users never repeat it.
    if (!profile.onboarding_completed && location.pathname !== '/Onboarding') {
      return <Navigate to="/Onboarding" replace />;
    }
    if (profile.onboarding_completed && location.pathname === '/Onboarding' && new URLSearchParams(location.search).get('edit') !== '1') {
      return <Navigate to="/Dashboard" replace />;
    }
  }

  // Render the main app
  return (
    <AppDataProvider><DataGate><WorkingSessionProvider><Suspense fallback={<AppStatus title="Загрузка экрана" loading />}><AppErrorBoundary key={location.pathname}><Routes>
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}
      <Route path="*" element={<PageNotFound />} />
    </Routes></AppErrorBoundary></Suspense><LeoAssistant/></WorkingSessionProvider></DataGate></AppDataProvider>
  );
};

function App() {
  if (configurationError) return <AppStatus title="Требуется настройка подключения"><p>{configurationError}</p></AppStatus>;

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
