import type { BodyGoal, BodyRecord, Food, Goals, MealEntry } from '../types';

// localStorage にまとめて保存するデータ全体の形
export type Store = {
  foods: Food[];
  entries: MealEntry[];
  goals: Goals;
  bodyRecords: BodyRecord[];
  bodyGoal: BodyGoal;
};

export const sampleData: Store = {
  foods: [
    { id: 'rice', name: 'ごはん', unit: 'g', baseAmount: 100, kcal: 156, protein: 2.5, fat: 0.3, carbs: 37.1 },
    { id: 'egg', name: '卵', unit: '個', baseAmount: 1, kcal: 76, protein: 6.2, fat: 5.1, carbs: 0.2 },
  ],
  entries: [],
  goals: {
    kcal: { min: 1600, max: 1800 },
    protein: { min: 120, max: 150 },
    fat: { min: 30, max: 40 },
  },
  bodyRecords: [],
  bodyGoal: { weight: null, bodyFat: 12, deadline: '2026-12-31' },
};
