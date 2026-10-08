import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import './index.css';
import App from './App.tsx';
import { AuthProvider } from './auth/AuthProvider';
import { AuthAwareRepositoryProvider } from './repositories/AuthAwareRepositoryProvider';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AuthAwareRepositoryProvider>
          <App />
        </AuthAwareRepositoryProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
