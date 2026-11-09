import type { Food, Nutrients } from '../types';

export type SortKey = 'name' | 'protein' | 'fat' | 'carbs' | 'kcal';

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'name', label: '名前順' },
  { key: 'protein', label: 'たんぱく質' },
  { key: 'fat', label: '脂質' },
  { key: 'carbs', label: '炭水化物' },
  { key: 'kcal', label: 'カロリー' },
];

type Sortable = Nutrients & { name: string; unit: Food['unit']; baseAmount: number };

// 比べるときの基準：g の食品は100gあたり、個・枚・食などは1つあたりにそろえる
//   登録した量（基準量）がばらばらでも、同じものさしで比べられるようにする
//   例：鶏むね肉「300gあたり P69.9」は「100gあたり P23.3」として比べる
export function normalizedBase(item: Pick<Sortable, 'unit'>): number {
  return item.unit === 'g' ? 100 : 1;
}

export function normalizedNutrients(item: Sortable): Nutrients {
  const ratio = normalizedBase(item) / item.baseAmount;
  const round1 = (n: number) => Math.round(n * ratio * 10) / 10;
  return {
    kcal: round1(item.kcal),
    protein: round1(item.protein),
    fat: round1(item.fat),
    carbs: round1(item.carbs),
  };
}

// 名前は名前順（かな・カナは五十音順。漢字は読みでは並ばない）、栄養素は多い順に並べる（元の配列は変えない）
export function sortFoods<T extends Sortable>(items: T[], key: SortKey): T[] {
  if (key === 'name') return [...items].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  return [...items].sort(
    (a, b) =>
      normalizedNutrients(b)[key] - normalizedNutrients(a)[key] ||
      a.name.localeCompare(b.name, 'ja'),
  );
}
