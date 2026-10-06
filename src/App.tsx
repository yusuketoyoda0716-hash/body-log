import { Navigate, Route, Routes } from 'react-router';
import { AppLayout } from './components/AppLayout';
import { BodyPage } from './pages/BodyPage';
import { FoodsPage } from './pages/FoodsPage';
import { SettingsPage } from './pages/SettingsPage';
import { TodayPage } from './pages/TodayPage';
import { TrendsPage } from './pages/TrendsPage';

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<TodayPage />} />
        <Route path="/foods" element={<FoodsPage />} />
        <Route path="/body" element={<BodyPage />} />
        <Route path="/trends" element={<TrendsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
