import { describe, expect, it } from 'vitest';
import mextData from '../data/mextFoods.json';
import { COUNT_UNITS, quickAmounts } from '../constants/units';
import type { MextFood } from './mextFoods';
import { calcNutrients } from './nutrition';
import { PIECES, POPULAR_FOODS, searchPopularFoods } from './popularFoods';

const mextFoods = mextData as MextFood[];

describe('1個・1枚・1本で数えるもの', () => {
  it('目安の重さは、よく食べるものの一覧にある食品だけに付いている', () => {
    const labels = new Set(POPULAR_FOODS.map((item) => item.label));
    expect(Object.keys(PIECES).filter((label) => !labels.has(label))).toEqual([]);
  });

  it('目安の重さは正の数で、単位は個・枚・本のどれか', () => {
    for (const [label, piece] of Object.entries(PIECES)) {
      expect(piece.grams, label).toBeGreaterThan(0);
      expect(COUNT_UNITS, label).toContain(piece.unit);
    }
  });

  it('卵は「1個 約50g」の目安が付いて出てくる', () => {
    const egg = searchPopularFoods(mextFoods, '卵').find((f) => f.label === '卵（生）');
    expect(egg?.piece).toMatchObject({ unit: '個', grams: 50 });
  });

  it('1個分の値は、100gあたりの値 × 重さ', () => {
    const egg = searchPopularFoods(mextFoods, '卵').find((f) => f.label === '卵（生）')!;
    const perPiece = calcNutrients({ ...egg, baseAmount: 100 }, egg.piece!.grams);
    expect(perPiece.kcal).toBeCloseTo(egg.kcal / 2, 1);
  });
});

describe('よく使う量のボタン', () => {
  it('単位に合った量を出す', () => {
    expect(quickAmounts('g')).toContain(100);
    expect(quickAmounts('個')).toEqual([1, 2, 3]);
    expect(quickAmounts('食')).toContain(0.5);
  });
});
