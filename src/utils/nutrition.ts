import type { Food, MealEntry, Nutrients, Range } from '../types';

// 小数第1位で四捨五入
const round1 = (n: number) => Math.round(n * 10) / 10;

// 食品と量から栄養素を計算する（例：100gあたりの値 × 150g / 100g）
export function calcNutrients(food: Food, amount: number): Nutrients {
  const ratio = amount / food.baseAmount;
  return {
    kcal: round1(food.kcal * ratio),
    protein: round1(food.protein * ratio),
    fat: round1(food.fat * ratio),
    carbs: round1(food.carbs * ratio),
  };
}

// 複数の記録の栄養素を合計する
export function sumNutrients(items: Nutrients[]): Nutrients {
  const total = items.reduce(
    (sum, item) => ({
      kcal: sum.kcal + item.kcal,
      protein: sum.protein + item.protein,
      fat: sum.fat + item.fat,
      carbs: sum.carbs + item.carbs,
    }),
    { kcal: 0, protein: 0, fat: 0, carbs: 0 },
  );
  return {
    kcal: round1(total.kcal),
    protein: round1(total.protein),
    fat: round1(total.fat),
    carbs: round1(total.carbs),
  };
}

// 目標の範囲と比べた状態を文章にする（digits = 小数の桁数）
export function describeRange(value: number, range: Range, unit: string, digits = 1): string {
  const format = (n: number) => String(Number(n.toFixed(digits)));
  if (value < range.min) {
    return `あと${format(range.min - value)}〜${format(range.max - value)}${unit}`;
  }
  if (value > range.max) {
    return `${format(value - range.max)}${unit}オーバー`;
  }
  return '目標内';
}

// 日付ごとの合計。記録がない日は totals が null
export function dailyTotals(
  entries: MealEntry[],
  dates: string[],
): { date: string; totals: Nutrients | null }[] {
  return dates.map((date) => {
    const items = entries.filter((entry) => entry.date === date);
    return { date, totals: items.length > 0 ? sumNutrients(items) : null };
  });
}

// 平均（空なら null）
export function averageNutrients(list: Nutrients[]): Nutrients | null {
  if (list.length === 0) return null;
  const total = sumNutrients(list);
  return {
    kcal: round1(total.kcal / list.length),
    protein: round1(total.protein / list.length),
    fat: round1(total.fat / list.length),
    carbs: round1(total.carbs / list.length),
  };
}
