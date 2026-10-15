const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

// Date → 'YYYY-MM-DD'（日本時間などローカルの日付で作る）
export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// 'YYYY-MM-DD' → Date
export function fromDateString(dateString: string): Date {
  const [y, m, d] = dateString.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// 1日の区切りの時刻。0〜3時は前の日として扱う（夜中に食べた分を前の日の記録にするため）
// Claude連携のサーバー（api/mcp.ts）も同じく午前3時区切りにしている
const DAY_START_HOUR = 3;

// 今日の日付（午前3時区切り）
export function today(): string {
  const now = new Date();
  now.setHours(now.getHours() - DAY_START_HOUR);
  return toDateString(now);
}

// 日付を n 日ずらす（マイナスなら過去）
export function addDays(dateString: string, days: number): string {
  const date = fromDateString(dateString);
  date.setDate(date.getDate() + days);
  return toDateString(date);
}

// 'YYYY-MM-DD' の形かどうか
export function isDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(fromDateString(value).getTime());
}

// 表示用：'2026-10-06' → '10/6（火）'
export function formatDateLabel(dateString: string): string {
  const date = fromDateString(dateString);
  return `${date.getMonth() + 1}/${date.getDate()}（${WEEKDAYS[date.getDay()]}）`;
}

// 2つの日付の差（日数）。to が from より後ならプラス
export function daysBetween(from: string, to: string): number {
  const ms = fromDateString(to).getTime() - fromDateString(from).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

// end を含む直近 n 日分の日付を、古い順に返す
export function lastNDays(end: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addDays(end, i - (n - 1)));
}
