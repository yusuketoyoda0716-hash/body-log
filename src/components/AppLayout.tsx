import { Suspense } from 'react';
import { Outlet } from 'react-router';
import { TutorialProvider } from '../tutorial/TutorialProvider';
import { TabBar } from './TabBar';
import styles from './AppLayout.module.css';

export function AppLayout() {
  return (
    // チュートリアルは画面をまたいで進むので、すべての画面をまとめて包む
    <TutorialProvider>
      <div className={styles.app}>
        <main className={styles.main}>
          {/* 遅延読み込みの画面を待っている間はこれを表示（タブバーは出したまま） */}
          <Suspense fallback={<p className={styles.loading}>読み込み中…</p>}>
            <Outlet />
          </Suspense>
        </main>
        <TabBar />
      </div>
    </TutorialProvider>
  );
}
