import type { MealType } from '../types';

// 表示する順番と日本語名
export const MEAL_TYPES: { type: MealType; label: string }[] = [
  { type: 'breakfast', label: '朝食' },
  { type: 'lunch', label: '昼食' },
  { type: 'dinner', label: '夕食' },
  { type: 'snack', label: '間食' },
];
