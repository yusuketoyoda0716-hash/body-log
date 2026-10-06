import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import './index.css';
import App from './App.tsx';
import { LocalStorageRepository } from './repositories/localStorageRepository';
import { RepositoryProvider } from './repositories/RepositoryProvider';

// 今はゲスト用の localStorage 版。ログイン対応のときにここを切り替える
const repository = new LocalStorageRepository();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <RepositoryProvider repository={repository}>
        <App />
      </RepositoryProvider>
    </BrowserRouter>
  </StrictMode>,
);
