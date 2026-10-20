import type { MealType } from '../types';

// 表示する順番と日本語名
export const MEAL_TYPES: { type: MealType; label: string }[] = [
  { type: 'breakfast', label: '朝食' },
  { type: 'lunch', label: '昼食' },
  { type: 'dinner', label: '夕食' },
  { type: 'snack', label: '間食' },
];

// 今の時刻から、どの食事かを決める（Claude連携のサーバー api/mcp.ts と同じ区切り）
//   3:00〜10:29 朝食 / 10:30〜15:59 昼食 / それ以外 夕食
export function mealTypeNow(now = new Date()): MealType {
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes >= 3 * 60 && minutes < 10 * 60 + 30) return 'breakfast';
  if (minutes >= 10 * 60 + 30 && minutes < 16 * 60) return 'lunch';
  return 'dinner';
}

export function mealLabel(type: MealType): string {
  return MEAL_TYPES.find((m) => m.type === type)?.label ?? '';
}
