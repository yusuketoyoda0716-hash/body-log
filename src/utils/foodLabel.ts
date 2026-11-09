// 外食のメニューは「店名 メニュー名」で表示する（今日の記録や、食品を選ぶ画面で）
// サーバー（api/mcp.ts）からも読み込むので、import は拡張子付きで書く
import type { Food, FoodCategory } from '../types/index.js';

type Named = Pick<Food, 'name' | 'shop'>;

// 食品画面のタブの分け方：食材・市販品・外食
export type FoodKind = FoodCategory | 'restaurant';

export function foodLabel(food: Named): string {
  return food.shop ? `${food.shop} ${food.name}` : food.name;
}

export function isRestaurantFood(food: Named): boolean {
  return Boolean(food.shop);
}

// 食材か市販品か。項目がないとき（古いデータや Claude 連携で登録したもの）は、
// 出典に「食品標準成分表」とあれば食材、それ以外（パッケージの表示・お店のサイトなど）は市販品とみなす
//   「成分表」だけで判断すると、パッケージの「栄養成分表示」まで食材になってしまう（テストで見つけた）
export function foodCategory(food: Pick<Food, 'category' | 'source'>): FoodCategory {
  if (food.category) return food.category;
  return food.source?.includes('食品標準成分表') ? 'ingredient' : 'product';
}

export const CATEGORY_LABELS: Record<FoodCategory, string> = {
  ingredient: '食材',
  product: '市販品',
};

export const KIND_LABELS: Record<FoodKind, string> = {
  ...CATEGORY_LABELS,
  restaurant: '外食',
};

// 食材・市販品・外食のどれか（店名があれば外食）
export function foodKind(food: Pick<Food, 'category' | 'source' | 'shop'>): FoodKind {
  return food.shop ? 'restaurant' : foodCategory(food);
}

// 名前・店名・メーカーのどれかに検索語が入っているか（全角・半角、大文字・小文字の違いは気にしない）
export function matchesKeyword(
  food: Pick<Food, 'name' | 'shop' | 'brand'>,
  keyword: string,
): boolean {
  const word = fold(keyword);
  if (word === '') return true;
  return [food.name, food.shop, food.brand].some((text) => fold(text).includes(word));
}

const fold = (text: string | undefined) => (text ?? '').normalize('NFKC').trim().toLowerCase();

// 同じ食品か（店名とメニュー名の両方で比べる。全角・半角や前後の空白の違いは気にしない）
const normalize = (text: string | undefined) => (text ?? '').normalize('NFKC').trim();

export function isSameFood(a: Named, b: Named): boolean {
  return normalize(a.name) === normalize(b.name) && normalize(a.shop) === normalize(b.shop);
}

// 外食のメニューを店名ごとにまとめる（店名の順、メニューは名前の順）
export function groupByShop<T extends Named>(foods: T[]): { shop: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const food of foods) {
    if (!food.shop) continue;
    const list = groups.get(food.shop) ?? [];
    list.push(food);
    groups.set(food.shop, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'ja'))
    .map(([shop, items]) => ({
      shop,
      items: [...items].sort((a, b) => a.name.localeCompare(b.name, 'ja')),
    }));
}
