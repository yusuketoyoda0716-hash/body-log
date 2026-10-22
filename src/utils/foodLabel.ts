// 外食のメニューは「店名 メニュー名」で表示する（今日の記録や、食品を選ぶ画面で）
// サーバー（api/mcp.ts）からも読み込むので、import は拡張子付きで書く
import type { Food } from '../types/index.js';

type Named = Pick<Food, 'name' | 'shop'>;

export function foodLabel(food: Named): string {
  return food.shop ? `${food.shop} ${food.name}` : food.name;
}

export function isRestaurantFood(food: Named): boolean {
  return Boolean(food.shop);
}

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
