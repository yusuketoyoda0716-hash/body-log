import { describe, expect, it } from 'vitest';
import {
  foodCategory,
  foodKind,
  foodLabel,
  groupByShop,
  isRestaurantFood,
  isSameFood,
  matchesKeyword,
} from './foodLabel';

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

describe('食材と市販品', () => {
  it('種類が保存されていれば、それを使う', () => {
    expect(
      foodCategory({
        category: 'product',
        source: '日本食品標準成分表（八訂）',
      }),
    ).toBe('product');
  });

  it('種類がない古いデータは、出典に「食品標準成分表」とあれば食材、それ以外は市販品', () => {
    expect(
      foodCategory({
        source: '文部科学省「日本食品標準成分表（八訂）増補2023年」',
      }),
    ).toBe('ingredient');
    expect(foodCategory({ source: 'パッケージの栄養成分表示' })).toBe('product');
    expect(foodCategory({})).toBe('product');
  });
});

describe('食品画面のタブと検索', () => {
  it('店名があれば外食。なければ食材か市販品', () => {
    expect(foodKind({ shop: 'サイゼリヤ', category: 'product' })).toBe('restaurant');
    expect(foodKind({ category: 'product' })).toBe('product');
    expect(foodKind({ source: '日本食品標準成分表（八訂）' })).toBe('ingredient');
  });

  it('名前・店名・メーカーのどれでも検索できる（全角・半角、大文字・小文字は区別しない）', () => {
    const chicken = { name: 'サラダチキン', brand: 'セブン-イレブン' };
    expect(matchesKeyword(chicken, 'チキン')).toBe(true);
    expect(matchesKeyword(chicken, 'セブン')).toBe(true);
    expect(matchesKeyword({ name: 'ビッグマック', shop: 'マクドナルド' }, 'マクド')).toBe(true);
    expect(matchesKeyword({ name: 'オイコス', brand: 'Danone' }, 'ｄａｎｏｎｅ')).toBe(true);
    expect(matchesKeyword(chicken, 'ローソン')).toBe(false);
    expect(matchesKeyword(chicken, '')).toBe(true);
  });
});
