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

// 今日の日付
export function today(): string {
  return toDateString(new Date());
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
