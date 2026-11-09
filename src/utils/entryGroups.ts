import type { Food, MealEntry, Nutrients } from '../types';
import { sumNutrients } from './nutrition';

// 今日の画面で、同じ食事の中の同じお店の記録を1行にまとめる
//   記録はメニューごとに別々に残す（あとから1つずつ消せる）。見せるときだけまとめる
export type EntryRow =
  | { type: 'entry'; entry: MealEntry }
  | { type: 'shop'; shop: string; entries: MealEntry[]; total: Nutrients };

// 記録がどのお店のものか
//   1. 登録食品から記録したもの：その食品の店名
//   2. Claude 連携で値をそのまま記録したもの（foodId が 'custom'）：名前が「店名 メニュー名」なら、その店名
export function entryShop(
  entry: Pick<MealEntry, 'foodId' | 'foodName'>,
  foods: Pick<Food, 'id' | 'shop'>[],
): string | null {
  const food = foods.find((f) => f.id === entry.foodId);
  if (food) return food.shop ?? null;
  // 「すき家」と「すき家 牛丼」のように店名が重なっても、長い店名を優先する
  const shops = [...new Set(foods.flatMap((f) => (f.shop ? [f.shop] : [])))].sort(
    (a, b) => b.length - a.length,
  );
  return shops.find((shop) => entry.foodName.startsWith(`${shop} `)) ?? null;
}

// 店名を除いたメニュー名（まとめた行を開いたときに出す）
export function menuName(entry: Pick<MealEntry, 'foodName'>, shop: string): string {
  return entry.foodName.startsWith(`${shop} `)
    ? entry.foodName.slice(shop.length + 1)
    : entry.foodName;
}

// 同じお店の記録が2件以上あれば1行にまとめる。並び順は、そのお店の最初の記録の位置
export function groupEntriesByShop(
  entries: MealEntry[],
  foods: Pick<Food, 'id' | 'shop'>[],
): EntryRow[] {
  const shopOf = new Map(entries.map((e) => [e.id, entryShop(e, foods)]));
  const byShop = new Map<string, MealEntry[]>();
  for (const entry of entries) {
    const shop = shopOf.get(entry.id);
    if (shop) byShop.set(shop, [...(byShop.get(shop) ?? []), entry]);
  }

  const rows: EntryRow[] = [];
  const done = new Set<string>();
  for (const entry of entries) {
    const shop = shopOf.get(entry.id);
    const group = shop ? byShop.get(shop) : undefined;
    if (!shop || !group || group.length < 2) {
      rows.push({ type: 'entry', entry });
    } else if (!done.has(shop)) {
      done.add(shop);
      rows.push({ type: 'shop', shop, entries: group, total: sumNutrients(group) });
    }
  }
  return rows;
}
