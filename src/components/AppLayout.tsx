import { Suspense } from 'react';
import { Outlet } from 'react-router';
import { TabBar } from './TabBar';
import styles from './AppLayout.module.css';

export function AppLayout() {
  return (
    <div className={styles.app}>
      <main className={styles.main}>
        {/* 遅延読み込みの画面を待っている間はこれを表示（タブバーは出したまま） */}
        <Suspense fallback={<p className={styles.loading}>読み込み中…</p>}>
          <Outlet />
        </Suspense>
      </main>
      <TabBar />
    </div>
  );
}
