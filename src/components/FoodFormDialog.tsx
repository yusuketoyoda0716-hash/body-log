import { useEffect, useRef, useState } from 'react';
import type { Food } from '../types';
import { displayName, type MextFood } from '../utils/mextFoods';
import { MextFoodSearch } from './MextFoodSearch';
import styles from './FoodFormDialog.module.css';

const UNITS: Food['unit'][] = ['g', '個', '杯', '食'];

// 入力中の値。input の中身は文字列なので、保存するときに数値へ変換する
type FormValues = {
  name: string;
  unit: Food['unit'];
  baseAmount: string;
  kcal: string;
  protein: string;
  fat: string;
  carbs: string;
};

const emptyValues: FormValues = {
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

function toFormValues(food: Food): FormValues {
  return {
    name: food.name,
    unit: food.unit,
    baseAmount: String(food.baseAmount),
    kcal: String(food.kcal),
    protein: String(food.protein),
    fat: String(food.fat),
    carbs: String(food.carbs),
  };
}

// 問題があればエラーメッセージ、なければ null を返す
function validate(v: FormValues): string | null {
  if (v.name.trim() === '') return '食品名を入力してください';

  const base = Number(v.baseAmount);
  if (v.baseAmount === '' || !(base > 0)) return '基準量は0より大きい数値を入力してください';

  const nutrients = [v.kcal, v.protein, v.fat, v.carbs];
  const invalid = nutrients.some((n) => n === '' || Number.isNaN(Number(n)) || Number(n) < 0);
  if (invalid) return 'カロリーとP・F・Cは0以上の数値を入力してください';

  return null;
}

type Props = {
  initialFood?: Food; // 編集のときだけ渡す
  onSave: (food: Food) => void;
  onClose: () => void;
  onDelete?: () => void; // 編集のときだけ渡す
};

export function FoodFormDialog({ initialFood, onSave, onClose, onDelete }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [values, setValues] = useState<FormValues>(() =>
    initialFood ? toFormValues(initialFood) : emptyValues,
  );
  const [error, setError] = useState<string | null>(null);
  // 新規追加のときだけ「成分表から探す」を選べる。最初は成分表の検索を出す
  const [mode, setMode] = useState<'search' | 'manual'>(initialFood ? 'manual' : 'search');
  // 成分表から選んだ食品（入力欄の上に「〇〇の値を入れました」と出すため）
  const [picked, setPicked] = useState<MextFood | null>(null);

  // 画面に出たらダイアログを開く
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  // 成分表の食品を選んだら、100gあたりの値を入力欄に入れて「自分で入力」に切り替える
  function handleSelect(food: MextFood) {
    setValues({
      name: displayName(food.name),
      unit: 'g',
      baseAmount: '100',
      kcal: String(food.kcal),
      protein: String(food.protein),
      fat: String(food.fat),
      carbs: String(food.carbs),
    });
    setPicked(food);
    setError(null);
    setMode('manual');
  }

  function handleSubmit(e: { preventDefault: () => void }) {
    e.preventDefault(); // ページの再読み込みを止める
    const message = validate(values);
    if (message) {
      setError(message);
      return;
    }
    onSave({
      id: initialFood?.id ?? crypto.randomUUID(),
      name: values.name.trim(),
      unit: values.unit,
      baseAmount: Number(values.baseAmount),
      kcal: Number(values.kcal),
      protein: Number(values.protein),
      fat: Number(values.fat),
      carbs: Number(values.carbs),
    });
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      onClose={onClose}
      aria-labelledby="food-form-title"
    >
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <h2 id="food-form-title" className={styles.title}>
          {initialFood ? '食品を編集' : '食品を追加'}
        </h2>

        {!initialFood && (
          <div className={styles.tabs} role="group" aria-label="追加のしかた">
            <button
              type="button"
              className={styles.tab}
              aria-pressed={mode === 'search'}
              onClick={() => setMode('search')}
            >
              成分表から探す
            </button>
            <button
              type="button"
              className={styles.tab}
              aria-pressed={mode === 'manual'}
              onClick={() => setMode('manual')}
            >
              自分で入力
            </button>
          </div>
        )}

        {mode === 'search' ? (
          <MextFoodSearch onSelect={handleSelect} />
        ) : (
          <>
            {picked && (
              <p className={styles.picked}>
                成分表「{displayName(picked.name)}」の値を入れました。食品名は呼びやすい名前に変えられます
              </p>
            )}

            <label className={styles.field}>
              食品名
              <input
                type="text"
                value={values.name}
                onChange={(e) => update('name', e.target.value)}
              />
            </label>

            <div className={styles.row}>
              <label className={styles.field}>
                基準量
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={values.baseAmount}
                  onChange={(e) => update('baseAmount', e.target.value)}
                />
              </label>
              <label className={styles.field}>
                単位
                <select
                  value={values.unit}
                  onChange={(e) => update('unit', e.target.value as Food['unit'])}
                >
                  {UNITS.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className={styles.hint}>この量あたりの栄養素を入力します（例：100g あたり、1個 あたり）</p>

            <div className={styles.grid}>
              {nutrientFields.map((field) => (
                <label key={field.key} className={styles.field}>
                  {field.label}
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    value={values[field.key]}
                    onChange={(e) => update(field.key, e.target.value)}
                  />
                </label>
              ))}
            </div>
          </>
        )}

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <div className={styles.actions}>
          {onDelete && (
            <button type="button" className={styles.delete} onClick={onDelete}>
              削除
            </button>
          )}
          <button type="button" className={styles.cancel} onClick={onClose}>
            キャンセル
          </button>
          <button type="submit" className={styles.save} disabled={mode === 'search'}>
            保存
          </button>
        </div>
      </form>
    </dialog>
  );
}