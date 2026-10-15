import type { Nutrients } from '../types';
import { searchFoods } from './foodSearch';

// 日本食品標準成分表の1食品（可食部100gあたり）
export type MextFood = Nutrients & {
  code: string; // 食品番号
  name: string; // 成分表の食品名（例：＜魚類＞ （かつお類） かつお 秋獲り 生）
};

export const MEXT_SOURCE = '文部科学省「日本食品標準成分表（八訂）増補2023年」';

// 約300kBあるので、検索画面を開いたときに初めて読み込む
let cache: Promise<MextFood[]> | null = null;

export function loadMextFoods(): Promise<MextFood[]> {
  cache ??= import('../data/mextFoods.json').then((m) => m.default as MextFood[]);
  return cache;
}

// 名前の整え方と検索の中身は foodSearch.ts（サーバーと共通）
export { displayName } from './foodSearch';

// 成分表から探す（最大50件）
export function searchMextFoods(foods: MextFood[], query: string): MextFood[] {
  return searchFoods(foods, query, 50);
}
