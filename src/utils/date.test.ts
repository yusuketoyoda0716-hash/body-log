import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  addDays,
  daysBetween,
  formatDateLabel,
  isDateString,
  lastNDays,
  today,
  toDateString,
} from './date';

afterEach(() => {
  vi.useRealTimers();
});

// その時刻に「今」を合わせる（日本時間などローカルの時刻で指定する）
function setNow(y: number, m: number, d: number, h: number, min = 0) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(y, m - 1, d, h, min));
}

describe('today：1日の区切りは午前3時', () => {
  it('2:59 はまだ前の日', () => {
    setNow(2026, 10, 20, 2, 59);
    expect(today()).toBe('2026-10-19');
  });

  it('3:00 から今日', () => {
    setNow(2026, 10, 20, 3, 0);
    expect(today()).toBe('2026-10-20');
  });

  it('夜の23時は今日', () => {
    setNow(2026, 10, 20, 23, 30);
    expect(today()).toBe('2026-10-20');
  });

  it('月初めの深夜は、前の月の最終日', () => {
    setNow(2026, 11, 1, 1, 0);
    expect(today()).toBe('2026-10-31');
  });

  it('元日の深夜は、前の年の大みそか', () => {
    setNow(2027, 1, 1, 0, 30);
    expect(today()).toBe('2026-12-31');
  });
});

describe('日付の計算', () => {
  it('toDateString：ローカルの日付で YYYY-MM-DD を作る（UTC にずれない）', () => {
    expect(toDateString(new Date(2026, 0, 5, 1, 0))).toBe('2026-01-05');
  });

  it('addDays：月や年をまたいでずらせる', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29'); // うるう年
  });

  it('daysBetween：2つの日付の差', () => {
    expect(daysBetween('2026-10-01', '2026-10-20')).toBe(19);
    expect(daysBetween('2026-10-20', '2026-10-01')).toBe(-19);
  });

  it('lastNDays：end を含む直近 n 日を古い順に', () => {
    expect(lastNDays('2026-10-02', 3)).toEqual(['2026-09-30', '2026-10-01', '2026-10-02']);
  });

  it('isDateString：URL の ?date= に入っていても安全な形か', () => {
    expect(isDateString('2026-10-20')).toBe(true);
    expect(isDateString('2026-1-5')).toBe(false);
    expect(isDateString('abc')).toBe(false);
  });

  it('formatDateLabel：曜日つきの表示', () => {
    expect(formatDateLabel('2026-10-20')).toBe('10/20（火）');
  });
});
