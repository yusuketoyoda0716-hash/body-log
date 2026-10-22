import { describe, expect, it } from 'vitest';
import { foodLabel, groupByShop, isRestaurantFood, isSameFood } from './foodLabel';

describe('外食のメニュー', () => {
  it('表示名は「店名 メニュー名」。店名がなければ食品名だけ', () => {
    expect(foodLabel({ name: 'ミラノ風ドリア', shop: 'サイゼリヤ' })).toBe(
      'サイゼリヤ ミラノ風ドリア',
    );
    expect(foodLabel({ name: '納豆' })).toBe('納豆');
  });

  it('店名があるものだけが外食', () => {
    expect(isRestaurantFood({ name: 'ミラノ風ドリア', shop: 'サイゼリヤ' })).toBe(true);
    expect(isRestaurantFood({ name: '納豆' })).toBe(false);
    expect(isRestaurantFood({ name: '納豆', shop: '' })).toBe(false);
  });

  it('同じ食品か：店名とメニュー名の両方で比べる（全角・半角と前後の空白は気にしない）', () => {
    expect(
      isSameFood(
        { name: 'ポテトM', shop: 'マクドナルド' },
        { name: 'ポテトＭ ', shop: 'マクドナルド' },
      ),
    ).toBe(true);
    // 同じメニュー名でも、お店が違えば別の食品
    expect(
      isSameFood({ name: '牛丼 並盛', shop: '吉野家' }, { name: '牛丼 並盛', shop: 'すき家' }),
    ).toBe(false);
    // 店名なしの食品と、外食のメニューも別
    expect(isSameFood({ name: '牛丼' }, { name: '牛丼', shop: '吉野家' })).toBe(false);
  });

  it('店名ごとにまとめ、店名とメニュー名の順に並べる', () => {
    const groups = groupByShop([
      { name: 'ポテトM', shop: 'マクドナルド' },
      { name: '納豆' },
      { name: 'ミラノ風ドリア', shop: 'サイゼリヤ' },
      { name: 'ビッグマック', shop: 'マクドナルド' },
    ]);
    expect(groups.map((g) => g.shop)).toEqual(['サイゼリヤ', 'マクドナルド']);
    expect(groups[1].items.map((f) => f.name)).toEqual(['ビッグマック', 'ポテトM']);
  });
});
