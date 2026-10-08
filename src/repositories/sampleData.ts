import type { BodyGoal, BodyRecord, Food, Goals, MealEntry, MealType } from '../types';
import { addDays, today } from '../utils/date';
import { calcNutrients } from '../utils/nutrition';

// localStorage にまとめて保存するデータ全体の形
export type Store = {
  foods: Food[];
  entries: MealEntry[];
  goals: Goals;
  bodyRecords: BodyRecord[];
  bodyGoal: BodyGoal;
};

// 目標の初期値（ログインしたばかりの人にも使う）
export const defaultGoals: Goals = {
  kcal: { min: 1600, max: 1800 },
  protein: { min: 120, max: 150 },
  fat: { min: 30, max: 40 },
  carbs: { min: 180, max: 240 },
};

export const defaultBodyGoal: BodyGoal = { weight: null, bodyFat: null, deadline: null };

// 見本の食品（日本食品標準成分表などをもとにした目安の値）
const sampleFoods: Food[] = [
  { id: 'rice', name: 'ごはん', unit: 'g', baseAmount: 100, kcal: 156, protein: 2.5, fat: 0.3, carbs: 37.1 },
  { id: 'egg', name: '卵', unit: '個', baseAmount: 1, kcal: 76, protein: 6.2, fat: 5.1, carbs: 0.2 },
  { id: 'natto', name: '納豆', unit: '個', baseAmount: 1, kcal: 86, protein: 7.4, fat: 4.5, carbs: 5.4 },
  { id: 'salad-chicken', name: 'サラダチキン', unit: '個', baseAmount: 1, kcal: 115, protein: 25, fat: 1.3, carbs: 0.3 },
  { id: 'chicken-breast', name: '鶏むね肉（皮なし）', unit: 'g', baseAmount: 100, kcal: 105, protein: 23.3, fat: 1.9, carbs: 0.1 },
  { id: 'protein', name: 'プロテイン', unit: '杯', baseAmount: 1, kcal: 117, protein: 22, fat: 1.5, carbs: 3.5 },
  { id: 'banana', name: 'バナナ', unit: '個', baseAmount: 1, kcal: 93, protein: 1.1, fat: 0.2, carbs: 22.5 },
  { id: 'oatmeal', name: 'オートミール', unit: 'g', baseAmount: 100, kcal: 350, protein: 13.7, fat: 5.7, carbs: 69.1 },
  { id: 'yogurt', name: 'ヨーグルト（無糖）', unit: 'g', baseAmount: 100, kcal: 56, protein: 3.6, fat: 3, carbs: 4.9 },
  { id: 'milk', name: '牛乳', unit: 'g', baseAmount: 100, kcal: 61, protein: 3.3, fat: 3.8, carbs: 4.8 },
  { id: 'salmon', name: '鮭', unit: 'g', baseAmount: 100, kcal: 124, protein: 22.3, fat: 4.1, carbs: 0.1 },
  { id: 'tofu', name: '豆腐（絹）', unit: 'g', baseAmount: 100, kcal: 56, protein: 5.3, fat: 3.5, carbs: 2 },
  { id: 'broccoli', name: 'ブロッコリー', unit: 'g', baseAmount: 100, kcal: 37, protein: 5.4, fat: 0.6, carbs: 6.6 },
  { id: 'miso-soup', name: '味噌汁', unit: '杯', baseAmount: 1, kcal: 40, protein: 2.5, fat: 1.2, carbs: 4.5 },
  { id: 'tonjiru', name: '豚汁', unit: '杯', baseAmount: 1, kcal: 120, protein: 6.5, fat: 6.5, carbs: 8 },
];

// 1日分の献立：[食事区分, 食品ID, 量]
type DayPlan = [MealType, string, number][];

const PLANS: DayPlan[] = [
  [
    ['breakfast', 'oatmeal', 40],
    ['breakfast', 'yogurt', 100],
    ['breakfast', 'banana', 1],
    ['breakfast', 'protein', 1],
    ['lunch', 'rice', 200],
    ['lunch', 'salad-chicken', 1],
    ['lunch', 'broccoli', 100],
    ['dinner', 'rice', 200],
    ['dinner', 'salmon', 100],
    ['dinner', 'tofu', 150],
    ['dinner', 'miso-soup', 1],
    ['snack', 'protein', 1],
  ],
  [
    ['breakfast', 'rice', 150],
    ['breakfast', 'egg', 2],
    ['breakfast', 'natto', 1],
    ['breakfast', 'miso-soup', 1],
    ['lunch', 'rice', 200],
    ['lunch', 'chicken-breast', 150],
    ['lunch', 'broccoli', 100],
    ['dinner', 'rice', 200],
    ['dinner', 'salmon', 120],
    ['dinner', 'tonjiru', 1],
    ['snack', 'protein', 1],
    ['snack', 'banana', 1],
  ],
  [
    ['breakfast', 'yogurt', 150],
    ['breakfast', 'banana', 1],
    ['breakfast', 'protein', 1],
    ['breakfast', 'egg', 1],
    ['lunch', 'rice', 250],
    ['lunch', 'salad-chicken', 1],
    ['lunch', 'miso-soup', 1],
    ['dinner', 'rice', 200],
    ['dinner', 'chicken-breast', 150],
    ['dinner', 'tofu', 150],
    ['dinner', 'broccoli', 100],
    ['snack', 'milk', 200],
  ],
];

const DAYS = 14; // 今日を含めた日数
const round1 = (n: number) => Math.round(n * 10) / 10;

// 今日を基準に、見本データを作る
export function createSampleData(): Store {
  const end = today();

  // ---- 食事記録：献立を日替わりで。今日は朝食だけ ----
  const entries: MealEntry[] = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const date = addDays(end, -i);
    const plan = PLANS[i % PLANS.length];
    const items = i === 0 ? plan.filter(([meal]) => meal === 'breakfast') : plan;

    items.forEach(([mealType, foodId, amount], n) => {
      const food = sampleFoods.find((f) => f.id === foodId);
      if (!food) return;
      entries.push({
        id: `sample-${date}-${n}`,
        date,
        mealType,
        foodId,
        foodName: food.name,
        unit: food.unit,
        amount,
        ...calcNutrients(food, amount),
      });
    });
  }

  // ---- 体重・体脂肪率：ゆるやかに減少。ときどき測り忘れの日がある ----
  const WOBBLE = [0, 0.2, -0.1, 0.1, -0.2, 0.1, 0]; // 日々の小さな増減
  const bodyRecords: BodyRecord[] = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    if (i % 5 === 3) continue;
    const progress = (DAYS - 1 - i) / (DAYS - 1); // 0 → 1
    const wobble = WOBBLE[i % WOBBLE.length];
    bodyRecords.push({
      date: addDays(end, -i),
      weight: round1(58.2 - 0.9 * progress + wobble),
      bodyFat: round1(14.6 - 0.7 * progress + wobble / 2),
    });
  }

  return {
    foods: structuredClone(sampleFoods),
    entries,
    goals: structuredClone(defaultGoals),
    bodyRecords,
    bodyGoal: { weight: 56, bodyFat: 12, deadline: addDays(end, 84) },
  };
}
