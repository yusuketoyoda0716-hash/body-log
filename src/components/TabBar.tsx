import type { ReactNode } from 'react';
import { NavLink } from 'react-router';
import styles from './TabBar.module.css';

type Tab = { to: string; label: string; icon: ReactNode };

// アイコンの共通設定（線で描くタイプ）
const svgProps = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

const tabs: Tab[] = [
  {
    to: '/',
    label: '今日',
    icon: (
      <svg {...svgProps}>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </svg>
    ),
  },
  {
    to: '/foods',
    label: '食品',
    icon: (
      <svg {...svgProps}>
        <path d="M3 11h18a9 9 0 0 1-18 0z" />
        <path d="M9 8c0-1.5 1-2 1-3.5M14 8c0-1.5 1-2 1-3.5" />
      </svg>
    ),
  },
  {
    to: '/body',
    label: '体重',
    icon: (
      <svg {...svgProps}>
        <rect x="3" y="3" width="18" height="18" rx="4" />
        <path d="M7.5 10a5 5 0 0 1 9 0" />
        <path d="M12 10l2-2.5" />
      </svg>
    ),
  },
  {
    to: '/trends',
    label: '推移',
    icon: (
      <svg {...svgProps}>
        <path d="M3 3v18h18" />
        <path d="M7 15l4-4 3 3 6-7" />
      </svg>
    ),
  },
  {
    to: '/settings',
    label: '設定',
    icon: (
      <svg {...svgProps}>
        <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" />
        <circle cx="16" cy="6" r="2" />
        <circle cx="10" cy="12" r="2" />
        <circle cx="18" cy="18" r="2" />
      </svg>
    ),
  },
];

export function TabBar() {
  return (
    <nav className={styles.bar}>
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to === '/'}
          className={({ isActive }) => (isActive ? `${styles.tab} ${styles.active}` : styles.tab)}
        >
          <span className={styles.icon}>{tab.icon}</span>
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
