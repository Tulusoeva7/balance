import { lazy } from 'react';
import Layout from './Layout.jsx';

// Старые URL сохранены, содержимое страниц загружается при переходе.
export const PAGES = {
  admin: lazy(() => import('./pages/Admin.jsx')),
  Dashboard: lazy(() => import('./pages/Dashboard.jsx')),
  WorkoutPlan: lazy(() => import('./pages/WorkoutPlan.jsx')),
  PainDiary: lazy(() => import('./pages/PainDiary.jsx')),
  Analytics: lazy(() => import('./pages/Analytics.jsx')),
  Articles: lazy(() => import('./pages/Articles.jsx')),
  Profile: lazy(() => import('./pages/Profile.jsx')),
  Onboarding: lazy(() => import('./pages/Onboarding.jsx')),
  ExerciseLibrary: lazy(() => import('./pages/ExerciseLibrary.jsx')),
  Progress: lazy(() => import('./pages/Progress.jsx')),
  Timer: lazy(() => import('./pages/Timer.jsx')),
  PostureMonitor: lazy(() => import('./pages/PostureMonitor.jsx')),
};
export const pagesConfig = { mainPage: 'Dashboard', Pages: PAGES, Layout };
