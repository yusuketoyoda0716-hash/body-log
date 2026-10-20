import { describe, expect, it } from 'vitest';
import mextData from '../data/mextFoods.json';
import { displayName, searchFoods } from './foodSearch';
import type { MextFood } from './mextFoods';
import { POPULAR_FOODS, searchPopularFoods } from './popularFoods';

const mextFoods = mextData as MextFood[];
const top = (query: string) => searchFoods(mextFoods, query)[0]?.name;

describe('displayName：成分表の名前から分類を外す', () => {
  it('＜＞ と （） の分類を外す', () => {
    expect(displayName('＜魚類＞ （かつお類） かつお 秋獲り 生')).toBe('かつお 秋獲り 生');
  });
});

describe('成分表の検索：ふだんの呼び方で見つかる', () => {
  it('「鶏むね肉」で若どりのむね肉が先頭', () => {
    expect(top('鶏むね肉')).toContain('［若どり・主品目］ むね');
  });

  it('「とりむね」のように言葉が離れていても見つかる', () => {
    expect(top('とりむね')).toContain('むね');
  });

  it('「ごはん」でふつうの白いごはんが先頭', () => {
    expect(top('ごはん')).toBe('こめ ［水稲めし］ 精白米 うるち米');
  });

  it('カタカナとひらがな、全角と半角の違いを気にしない', () => {
    expect(top('ﾊﾞﾅﾅ')).toBe(top('ばなな'));
  });

  it('スペースで区切るとすべてを含むものにしぼる（全角スペースでもよい）', () => {
    const results = searchFoods(mextFoods, 'むね　皮なし');
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((f) => f.name.includes('むね') && f.name.includes('皮なし'))).toBe(true);
  });

  it('何も入れなければ何も返さない', () => {
    expect(searchFoods(mextFoods, '  ')).toEqual([]);
  });
});

describe('よく食べるもの', () => {
  const codes = new Set(mextFoods.map((f) => f.code));

  it('すべて成分表の食品番号とつながっている', () => {
    const missing = POPULAR_FOODS.flatMap((item) => item.parts)
      .map((part) => part.code)
      .filter((code) => !codes.has(code));
    expect(missing).toEqual([]);
  });

  it('名前が重なっていない', () => {
    const labels = POPULAR_FOODS.map((item) => item.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('混ぜて計算するものは、割合の合計が1', () => {
    for (const item of POPULAR_FOODS) {
      const total = item.parts.reduce((sum, part) => sum + part.ratio, 0);
      expect(total, item.label).toBeCloseTo(1);
    }
  });

  it('「ごはん」で白米ごはんが先頭、分かりやすい名前で出る', () => {
    const results = searchPopularFoods(mextFoods, 'ごはん');
    expect(results[0].label).toBe('白米ごはん');
    expect(results.map((f) => f.label)).toContain('麦ごはん（白米7：押麦3）');
  });

  it('麦ごはん（白米7：押麦3）は、白米ごはんと押麦ごはんを重さの割合で混ぜた値', () => {
    const rice = mextFoods.find((f) => f.code === '01088')!;
    const barley = mextFoods.find((f) => f.code === '01170')!;
    const mixed = searchPopularFoods(mextFoods, '麦ごはん').find(
      (f) => f.label === '麦ごはん（白米7：押麦3）',
    )!;
    expect(mixed.kcal).toBeCloseTo(rice.kcal * 0.7 + barley.kcal * 0.3, 1);
    expect(mixed.basis).toContain('7：押麦ごはん3');
  });

  it('別の呼び方でも見つかる（すなぎも → 砂肝、バゲット → フランスパン）', () => {
    expect(searchPopularFoods(mextFoods, 'すなぎも').map((f) => f.label)).toContain('砂肝');
    expect(searchPopularFoods(mextFoods, 'バゲット')[0].label).toBe('フランスパン（バゲット）');
  });
});
