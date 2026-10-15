import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import './index.css';
import App from './App.tsx';
import { AuthProvider } from './auth/AuthProvider';
import { AuthAwareRepositoryProvider } from './repositories/AuthAwareRepositoryProvider';

// 新しいバージョンを公開した直後に、開いていた古い画面が古いファイルを読めなかったときは、
// ページを読み込み直して最新の画面にする。
// 読み込み直しても直らない場合に何度も繰り返さないよう、30秒以内の2回目はやめる
window.addEventListener('vite:preloadError', () => {
  const KEY = 'body-log:reloadedAt';
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < 30_000) return;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // 保存できない環境でも、読み込み直しは行う
  }
  window.location.reload();
});

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
