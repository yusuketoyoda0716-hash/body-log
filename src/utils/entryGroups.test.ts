import { describe, expect, it } from 'vitest';
import type { MealEntry } from '../types';
import { entryShop, groupEntriesByShop, menuName } from './entryGroups';

const foods = [
  { id: 'maguro', shop: 'はま寿司' },
  { id: 'salmon', shop: 'はま寿司' },
  { id: 'kake', shop: '丸亀製麺' },
  { id: 'natto' },
];

function entry(id: string, foodId: string, foodName: string, kcal: number): MealEntry {
  return {
    id,
    date: '2026-11-09',
    mealType: 'dinner',
    foodId,
    foodName,
    unit: '皿',
    amount: 1,
    kcal,
    protein: 1,
    fat: 1,
    carbs: 1,
  };
}

describe('記録をお店ごとにまとめる', () => {
  it('登録食品の店名、または「店名 メニュー名」の名前からお店を決める', () => {
    expect(entryShop({ foodId: 'maguro', foodName: 'はま寿司 まぐろ' }, foods)).toBe('はま寿司');
    // Claude 連携で値をそのまま記録したもの
    expect(entryShop({ foodId: 'custom', foodName: 'はま寿司 えび天' }, foods)).toBe('はま寿司');
    expect(entryShop({ foodId: 'natto', foodName: '納豆' }, foods)).toBeNull();
    expect(entryShop({ foodId: 'custom', foodName: 'はま寿司風サラダ' }, foods)).toBeNull();
  });

  it('同じお店が2件以上なら1行にまとめ、合計を出す。1件だけならそのまま', () => {
    const rows = groupEntriesByShop(
      [
        entry('1', 'natto', '納豆', 80),
        entry('2', 'maguro', 'はま寿司 まぐろ', 64),
        entry('3', 'kake', '丸亀製麺 かけうどん', 300),
        entry('4', 'custom', 'はま寿司 えび天', 98),
        entry('5', 'salmon', 'はま寿司 サーモン', 70),
      ],
      foods,
    );
    expect(rows.map((r) => (r.type === 'shop' ? r.shop : r.entry.foodName))).toEqual([
      '納豆',
      'はま寿司',
      '丸亀製麺 かけうどん',
    ]);
    const sushi = rows[1];
    expect(sushi.type === 'shop' && sushi.entries.map((e) => e.id)).toEqual(['2', '4', '5']);
    expect(sushi.type === 'shop' && sushi.total.kcal).toBe(232);
  });

  it('まとめた中は店名を除いたメニュー名で見せる', () => {
    expect(menuName({ foodName: 'はま寿司 まぐろ' }, 'はま寿司')).toBe('まぐろ');
    expect(menuName({ foodName: 'まぐろ' }, 'はま寿司')).toBe('まぐろ');
  });
});
