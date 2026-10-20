import { describe, expect, it } from 'vitest';
import type { MealEntry } from '../types';
import {
  averageNutrients,
  calcNutrients,
  dailyTotals,
  describeRange,
  sumNutrients,
} from './nutrition';

describe('calcNutrients：基準量あたりの値と量から計算する', () => {
  const chickenBreast = { baseAmount: 100, kcal: 105, protein: 23.3, fat: 1.9, carbs: 0.1 };

  it('100gあたりの値 × 150g', () => {
    expect(calcNutrients(chickenBreast, 150)).toEqual({
      kcal: 157.5,
      protein: 35,
      fat: 2.9,
      carbs: 0.2,
    });
  });

  it('基準量と同じ量なら、値はそのまま', () => {
    expect(calcNutrients(chickenBreast, 100)).toEqual({
      kcal: 105,
      protein: 23.3,
      fat: 1.9,
      carbs: 0.1,
    });
  });

  it('1個あたりの食品を2個', () => {
    const egg = { baseAmount: 1, kcal: 76, protein: 6.2, fat: 5.1, carbs: 0.2 };
    expect(calcNutrients(egg, 2)).toEqual({ kcal: 152, protein: 12.4, fat: 10.2, carbs: 0.4 });
  });
});

describe('sumNutrients：合計する', () => {
  it('小数の足し算の誤差が出ないよう、小数第1位にそろえる', () => {
    const total = sumNutrients([
      { kcal: 0.1, protein: 0.1, fat: 0.1, carbs: 0.1 },
      { kcal: 0.2, protein: 0.2, fat: 0.2, carbs: 0.2 },
    ]);
    // そのまま足すと 0.30000000000000004 になる
    expect(total).toEqual({ kcal: 0.3, protein: 0.3, fat: 0.3, carbs: 0.3 });
  });

  it('何もなければ0', () => {
    expect(sumNutrients([])).toEqual({ kcal: 0, protein: 0, fat: 0, carbs: 0 });
  });
});

describe('describeRange：目標の範囲と比べた文章', () => {
  const range = { min: 1600, max: 1800 };

  it('下限より少なければ、あといくつ', () => {
    expect(describeRange(1226, range, 'kcal', 0)).toBe('あと374〜574kcal');
  });

  it('範囲の中なら目標内（下限・上限ちょうども含む）', () => {
    expect(describeRange(1700, range, 'kcal', 0)).toBe('目標内');
    expect(describeRange(1600, range, 'kcal', 0)).toBe('目標内');
    expect(describeRange(1800, range, 'kcal', 0)).toBe('目標内');
  });

  it('上限を超えたら、いくつオーバー', () => {
    expect(describeRange(1850, range, 'kcal', 0)).toBe('50kcalオーバー');
  });

  it('グラムは小数第1位まで', () => {
    expect(describeRange(45, { min: 40, max: 42 }, 'g')).toBe('3gオーバー');
    expect(describeRange(66.25, { min: 120, max: 150 }, 'g')).toBe('あと53.8〜83.8g');
  });
});

describe('dailyTotals / averageNutrients：日ごとの合計と平均', () => {
  const entry = (date: string, kcal: number): MealEntry => ({
    id: `${date}-${kcal}`,
    date,
    mealType: 'lunch',
    foodId: 'f',
    foodName: 'テスト',
    unit: 'g',
    amount: 100,
    kcal,
    protein: 0,
    fat: 0,
    carbs: 0,
  });

  it('記録がない日は null（0kcal として扱わない）', () => {
    const result = dailyTotals(
      [entry('2026-10-01', 500), entry('2026-10-01', 300), entry('2026-10-03', 1000)],
      ['2026-10-01', '2026-10-02', '2026-10-03'],
    );
    expect(result.map((d) => d.totals?.kcal ?? null)).toEqual([800, null, 1000]);
  });

  it('平均は記録がある日だけで計算する', () => {
    const days = dailyTotals(
      [entry('2026-10-01', 800), entry('2026-10-03', 1000)],
      ['2026-10-01', '2026-10-02', '2026-10-03'],
    );
    const recorded = days.flatMap((d) => (d.totals ? [d.totals] : []));
    expect(averageNutrients(recorded)?.kcal).toBe(900);
  });

  it('記録が1日もなければ平均は null', () => {
    expect(averageNutrients([])).toBeNull();
  });
});
