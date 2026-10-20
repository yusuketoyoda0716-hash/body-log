import { useState } from 'react';
import type { Food, RecipeIngredient } from '../types';
import { searchFoods } from '../utils/foodSearch';
import { pickedName, type MextFood } from '../utils/mextFoods';
import formStyles from './FoodFormDialog.module.css';
import { MextFoodSearch } from './MextFoodSearch';
import styles from './IngredientPicker.module.css';
import listStyles from './MextFoodSearch.module.css';

const UNITS: Food['unit'][] = ['g', '個', '杯', '食'];

type Mode = 'registered' | 'mext' | 'manual';

type Props = {
  foods: Food[];
  onPick: (ingredient: RecipeIngredient) => void;
  onCancel: () => void;
};

// 手入力の欄（input の中身は文字列なので、追加するときに数値へ変換する）
type ManualValues = {
  name: string;
  unit: Food['unit'];
  baseAmount: string;
  kcal: string;
  protein: string;
  fat: string;
  carbs: string;
};

const emptyManual: ManualValues = {
  name: '',
  unit: 'g',
  baseAmount: '100',
  kcal: '',
  protein: '',
  fat: '',
  carbs: '',
};

const nutrientFields = [
  { key: 'kcal', label: 'カロリー (kcal)' },
  { key: 'protein', label: 'P (g)' },
  { key: 'fat', label: 'F (g)' },
  { key: 'carbs', label: 'C (g)' },
] as const;

function validateManual(v: ManualValues): string | null {
  if (v.name.trim() === '') return '材料名を入力してください';
  if (v.baseAmount === '' || !(Number(v.baseAmount) > 0)) {
    return '基準量は0より大きい数値を入力してください';
  }
  const nutrients = [v.kcal, v.protein, v.fat, v.carbs];
  if (nutrients.some((n) => n === '' || Number.isNaN(Number(n)) || Number(n) < 0)) {
    return 'カロリーとP・F・Cは0以上の数値を入力してください';
  }
  return null;
}

// レシピに入れる材料を選ぶ（登録食品・成分表・手入力）
// 選んだ材料の量は、最初は基準量（100g・1個など）にしておき、レシピの画面で直してもらう
export function IngredientPicker({ foods, onPick, onCancel }: Props) {
  const [mode, setMode] = useState<Mode>(foods.length > 0 ? 'registered' : 'mext');
  const [query, setQuery] = useState('');
  const [manual, setManual] = useState<ManualValues>(emptyManual);
  const [error, setError] = useState<string | null>(null);

  const keyword = query.trim();
  const registeredResults = keyword ? searchFoods(foods, keyword) : foods;

  function pickFood(food: Food) {
    onPick({
      name: food.name,
      unit: food.unit,
      baseAmount: food.baseAmount,
      amount: food.baseAmount,
      kcal: food.kcal,
      protein: food.protein,
      fat: food.fat,
      carbs: food.carbs,
      ref: food.id,
    });
  }

  function pickMext(food: MextFood) {
    onPick({
      name: pickedName(food),
      unit: 'g',
      baseAmount: 100,
      amount: 100,
      kcal: food.kcal,
      protein: food.protein,
      fat: food.fat,
      carbs: food.carbs,
      ref: `mext:${food.code}`,
    });
  }

  function pickManual() {
    const message = validateManual(manual);
    if (message) {
      setError(message);
      return;
    }
    const baseAmount = Number(manual.baseAmount);
    onPick({
      name: manual.name.trim(),
      unit: manual.unit,
      baseAmount,
      amount: baseAmount,
      kcal: Number(manual.kcal),
      protein: Number(manual.protein),
      fat: Number(manual.fat),
      carbs: Number(manual.carbs),
      ref: null,
    });
  }

  function updateManual<K extends keyof ManualValues>(key: K, value: ManualValues[K]) {
    setManual((prev) => ({ ...prev, [key]: value }));
  }

  const tabs: { mode: Mode; label: string }[] = [
    { mode: 'registered', label: '登録食品' },
    { mode: 'mext', label: '成分表' },
    { mode: 'manual', label: '手入力' },
  ];

  return (
    <>
      <h2 className={formStyles.title}>材料を追加</h2>

      <div
        className={`${formStyles.tabs} ${styles.tabs}`}
        role="group"
        aria-label="材料の選び方"
      >
        {tabs.map((tab) => (
          <button
            key={tab.mode}
            type="button"
            className={formStyles.tab}
            aria-pressed={mode === tab.mode}
            onClick={() => {
              setMode(tab.mode);
              setError(null);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {mode === 'registered' && (
        <div className={listStyles.wrap}>
          <label className={listStyles.field}>
            登録食品から探す
            <input
              type="search"
              placeholder="食品名"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          {registeredResults.length === 0 ? (
            <p className={listStyles.message}>
              {foods.length === 0 ? 'まだ食品が登録されていません' : `「${keyword}」に一致する食品はありません`}
            </p>
          ) : (
            <ul className={listStyles.list}>
              {registeredResults.map((food) => (
                <li key={food.id}>
                  <button type="button" className={listStyles.item} onClick={() => pickFood(food)}>
                    <span className={listStyles.info}>
                      <span className={listStyles.name}>{food.name}</span>
                      <span className={listStyles.sub}>
                        {food.baseAmount}
                        {food.unit}あたり P{food.protein} F{food.fat} C{food.carbs}
                      </span>
                    </span>
                    <span className={listStyles.kcal}>{food.kcal} kcal</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {mode === 'mext' && <MextFoodSearch onSelect={pickMext} />}

      {mode === 'manual' && (
        <>
          <label className={formStyles.field}>
            材料名
            <input
              type="text"
              placeholder="例：カレールウ"
              value={manual.name}
              onChange={(e) => updateManual('name', e.target.value)}
            />
          </label>
          <div className={formStyles.row}>
            <label className={formStyles.field}>
              基準量
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={manual.baseAmount}
                onChange={(e) => updateManual('baseAmount', e.target.value)}
              />
            </label>
            <label className={formStyles.field}>
              単位
              <select
                value={manual.unit}
                onChange={(e) => updateManual('unit', e.target.value as Food['unit'])}
              >
                {UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className={formStyles.hint}>パッケージの表示などから、この量あたりの値を入れます</p>
          <div className={formStyles.grid}>
            {nutrientFields.map((field) => (
              <label key={field.key} className={formStyles.field}>
                {field.label}
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={manual[field.key]}
                  onChange={(e) => updateManual(field.key, e.target.value)}
                />
              </label>
            ))}
          </div>
        </>
      )}

      {error && (
        <p className={formStyles.error} role="alert">
          {error}
        </p>
      )}

      <div className={formStyles.actions}>
        <button type="button" className={formStyles.cancel} onClick={onCancel}>
          戻る
        </button>
        {mode === 'manual' && (
          <button type="button" className={formStyles.save} onClick={pickManual}>
            材料に追加
          </button>
        )}
      </div>
    </>
  );
}
