import type { Nutrients } from '../types';
import { displayName, searchFoods } from './foodSearch';

// 日本食品標準成分表の1食品（可食部100gあたり）
export type MextFood = Nutrients & {
  code: string; // 食品番号
  name: string; // 成分表の食品名（例：＜魚類＞ （かつお類） かつお 秋獲り 生）
  label?: string; // 「よく食べるもの」から選んだときの分かりやすい名前（例：白米ごはん）
  basis?: string; // 2つを混ぜて計算した値のときの説明（例：白米ごはん7：押麦ごはん3の重さで計算）
};

// 登録するときの名前：「よく食べるもの」なら分かりやすい名前、それ以外は成分表の名前を整えたもの
export function pickedName(food: MextFood): string {
  return food.label ?? displayName(food.name);
}

// 出典の書き方はサーバーと共通にしている
export { MEXT_SOURCE } from '../constants/sources';

// 約300kBあるので、検索画面を開いたときに初めて読み込む
let cache: Promise<MextFood[]> | null = null;

export function loadMextFoods(): Promise<MextFood[]> {
  cache ??= import('../data/mextFoods.json').then((m) => m.default as MextFood[]);
  return cache;
}

// 名前の整え方と検索の中身は foodSearch.ts（サーバーと共通）
export { displayName };

// 成分表から探す（最大50件）
export function searchMextFoods(foods: MextFood[], query: string): MextFood[] {
  return searchFoods(foods, query, 50);
}
