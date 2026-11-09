import { useState } from 'react';
import { UNITS } from '../constants/units';
import type { Food } from '../types';
import formStyles from './FoodFormDialog.module.css';
import styles from './MealEntryDialog.module.css';

// お店のメニューを選んで、個数（皿数）を入れる一覧
//   回転寿司や丸亀製麺のように、1品ずつ選んで食べるお店をまとめて記録するときに使う
type Props = {
  shop: string;
  menus: Food[];
  counts: Record<string, number>; // 食品の id → 個数（基準量の何倍か）
  onCount: (foodId: string, count: number) => void;
  // 一覧にないメニューを登録する（登録したら 1 つ選んだ状態にする）
  onAddMenu: (food: Food) => Promise<void>;
};

type NewMenu = {
  name: string;
  unit: Food['unit'];
  kcal: string;
  protein: string;
  fat: string;
  carbs: string;
};

const emptyMenu: NewMenu = { name: '', unit: '皿', kcal: '', protein: '', fat: '', carbs: '' };

const nutrientFields = [
  { key: 'kcal', label: 'カロリー (kcal)' },
  { key: 'protein', label: 'P (g)' },
  { key: 'fat', label: 'F (g)' },
  { key: 'carbs', label: 'C (g)' },
] as const;

export function ShopOrder({ shop, menus, counts, onCount, onAddMenu }: Props) {
  const [adding, setAdding] = useState(false);
  const [menu, setMenu] = useState<NewMenu>(emptyMenu);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function addMenu() {
    const values = [menu.kcal, menu.protein, menu.fat, menu.carbs];
    if (menu.name.trim() === '') {
      setError('メニュー名を入力してください');
      return;
    }
    if (values.some((v) => v === '' || Number.isNaN(Number(v)) || Number(v) < 0)) {
      setError('カロリーとP・F・Cは0以上の数値を入力してください');
      return;
    }
    if (menus.some((m) => m.name === menu.name.trim())) {
      setError('同じ名前のメニューがすでにあります');
      return;
    }
    setSaving(true);
    try {
      await onAddMenu({
        id: crypto.randomUUID(),
        name: menu.name.trim(),
        shop,
        unit: menu.unit,
        baseAmount: 1,
        kcal: Number(menu.kcal),
        protein: Number(menu.protein),
        fat: Number(menu.fat),
        carbs: Number(menu.carbs),
      });
      setMenu(emptyMenu);
      setAdding(false);
      setError(null);
    } catch {
      setError('登録できませんでした。時間をおいてもう一度お試しください');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {menus.length === 0 ? (
        <p className={styles.empty}>まだメニューがありません。下の「メニューを追加」から登録できます</p>
      ) : (
        <ul className={`${styles.list} ${styles.tabList}`} aria-label={`${shop}のメニュー`}>
          {menus.map((food) => {
            const count = counts[food.id] ?? 0;
            return (
              <li key={food.id} className={styles.orderItem} data-selected={count > 0}>
                <span className={styles.info}>
                  <span className={styles.name}>
                    {food.name}
                    {food.estimated && <span className={styles.badge}>見積もり</span>}
                  </span>
                  <span className={styles.sub}>
                    {food.baseAmount}
                    {food.unit} {food.kcal}kcal
                  </span>
                </span>
                <span className={styles.counter}>
                  <button
                    type="button"
                    className={styles.counterButton}
                    aria-label={`${food.name}を1つ減らす`}
                    disabled={count === 0}
                    onClick={() => onCount(food.id, count - 1)}
                  >
                    −
                  </button>
                  <span className={styles.count} aria-live="polite">
                    {count}
                  </span>
                  <button
                    type="button"
                    className={styles.counterButton}
                    aria-label={`${food.name}を1つ増やす`}
                    onClick={() => onCount(food.id, count + 1)}
                  >
                    ＋
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {adding ? (
        <div className={styles.addMenu}>
          <p className={styles.heading}>{shop}にメニューを追加（1皿・1個などあたりの値）</p>
          <div className={formStyles.row}>
            <label className={formStyles.field}>
              メニュー名
              <input
                type="text"
                placeholder="例：まぐろ"
                value={menu.name}
                onChange={(e) => setMenu({ ...menu, name: e.target.value })}
              />
            </label>
            <label className={formStyles.field}>
              単位
              <select
                value={menu.unit}
                onChange={(e) => setMenu({ ...menu, unit: e.target.value as Food['unit'] })}
              >
                {UNITS.filter((u) => u !== 'g').map((unit) => (
                  <option key={unit} value={unit}>
                    1{unit}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className={formStyles.grid}>
            {nutrientFields.map((field) => (
              <label key={field.key} className={formStyles.field}>
                {field.label}
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={menu[field.key]}
                  onChange={(e) => setMenu({ ...menu, [field.key]: e.target.value })}
                />
              </label>
            ))}
          </div>
          <p className={formStyles.hint}>
            公式の値が分からないときは、Claude に「{shop}の〇〇を登録して」と頼むと調べて登録してくれます
          </p>
          {error && (
            <p className={formStyles.error} role="alert">
              {error}
            </p>
          )}
          <div className={styles.addMenuActions}>
            <button
              type="button"
              className={styles.change}
              onClick={() => {
                setAdding(false);
                setError(null);
              }}
            >
              やめる
            </button>
            <button type="button" className={styles.addMenuSave} disabled={saving} onClick={addMenu}>
              登録して1つ選ぶ
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className={styles.addMenuButton} onClick={() => setAdding(true)}>
          ＋ ここにないメニューを追加
        </button>
      )}
    </>
  );
}
