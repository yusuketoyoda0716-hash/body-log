import { describe, expect, it } from 'vitest';
import { normalizedNutrients, sortFoods } from './sortFoods';

const item = (
  name: string,
  unit: 'g' | '個',
  baseAmount: number,
  protein: number,
  fat = 0,
  carbs = 0,
  kcal = 0,
) => ({ name, unit, baseAmount, protein, fat, carbs, kcal });

describe('並べ替え', () => {
  const chicken300 = item('鶏むね肉', 'g', 300, 69.9); // 100gあたり 23.3
  const salmon = item('鮭', 'g', 100, 22.3);
  const egg = item('卵', '個', 1, 6.2);
  const tofu = item('豆腐', 'g', 100, 5.3, 3.5, 2);

  it('g の食品は100gあたりにそろえて比べる（登録した量がばらばらでも）', () => {
    expect(normalizedNutrients(chicken300).protein).toBe(23.3);
  });

  it('タンパク質が多い順', () => {
    expect(sortFoods([tofu, egg, salmon, chicken300], 'protein').map((f) => f.name)).toEqual([
      '鶏むね肉',
      '鮭',
      '卵',
      '豆腐',
    ]);
  });

  it('同じ値なら名前順。元の配列は変えない', () => {
    const list = [item('b', 'g', 100, 1), item('a', 'g', 100, 1)];
    expect(sortFoods(list, 'protein').map((f) => f.name)).toEqual(['a', 'b']);
    expect(list.map((f) => f.name)).toEqual(['b', 'a']);
  });

  it('名前順', () => {
    expect(sortFoods([tofu, egg, salmon], 'name').map((f) => f.name)).toEqual(['鮭', '豆腐', '卵']);
  });
});
