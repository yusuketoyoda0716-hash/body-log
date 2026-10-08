import type { Food, Nutrients } from '../types';

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
