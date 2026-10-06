import { Outlet } from 'react-router';
import { TabBar } from './TabBar';
import styles from './AppLayout.module.css';

export function AppLayout() {
  return (
    <div className={styles.app}>
      <main className={styles.main}>
        <Outlet />
      </main>
      <TabBar />
    </div>
  );
}
