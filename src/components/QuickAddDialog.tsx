import { useEffect, useRef, useState } from 'react';
import { MEAL_TYPES, mealTypeNow } from '../constants/meals';
import type { Food, MealEntry, MealType, Nutrients } from '../types';
import { formatDateLabel, today } from '../utils/date';
import { calcNutrients } from '../utils/nutrition';
import formStyles from './FoodFormDialog.module.css';
import entryStyles from './MealEntryDialog.module.css';
import styles from './QuickAddDialog.module.css';

// 記録するもの（食品 または レシピ）。レシピは「1食あたり」の値を baseAmount 1 として渡す
export type QuickAddTarget = Nutrients & {
  foodId: string; // 記録に残す元のID。レシピは 'recipe:…'
  name: string;
  unit: Food['unit'];
  baseAmount: number;
};

type Props = {
  target: QuickAddTarget;
  onSave: (entry: MealEntry) => void;
  onClose: () => void;
};

// 登録食品・レシピの画面から、そのまま今日の食事に記録する
export function QuickAddDialog({ target, onSave, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // 開いた時点の日付（午前3時区切り）と、時間帯から決めた食事区分
  const [date] = useState(today);
  const [mealType, setMealType] = useState<MealType>(mealTypeNow);
  // 食品は基準量（100g・1個など）、レシピは1食を最初から入れておく
  const [amount, setAmount] = useState(String(target.baseAmount));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const amountNumber = Number(amount);
  const preview = amount !== '' && amountNumber > 0 ? calcNutrients(target, amountNumber) : null;

  function handleSubmit(e: { preventDefault: () => void }) {
    e.preventDefault();
    if (!preview) {
      setError('量は0より大きい数値を入力してください');
      return;
    }
    onSave({
      id: crypto.randomUUID(),
      date,
      mealType,
      foodId: target.foodId,
      foodName: target.name,
      unit: target.unit,
      amount: amountNumber,
      ...preview,
    });
  }

  return (
    <dialog
      ref={dialogRef}
      className={formStyles.dialog}
      onClose={onClose}
      aria-labelledby="quick-add-title"
    >
      <form className={formStyles.form} onSubmit={handleSubmit} noValidate>
        <h2 id="quick-add-title" className={formStyles.title}>
          今日の食事に追加
        </h2>
        <p className={styles.target}>
          <span className={styles.name}>{target.name}</span>
          <span className={styles.date}>{formatDateLabel(date)}</span>
        </p>

        <div className={styles.meals} role="group" aria-label="食事の区分">
          {MEAL_TYPES.map((m) => (
            <button
              key={m.type}
              type="button"
              className={formStyles.tab}
              aria-pressed={mealType === m.type}
              onClick={() => setMealType(m.type)}
            >
              {m.label}
            </button>
          ))}
        </div>

        <label className={formStyles.field}>
          量（{target.unit}）
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        {target.unit === '食' && (
          <p className={formStyles.hint}>1食分で計算しています。半分なら 0.5 のように入れてください</p>
        )}

        <div className={entryStyles.preview} aria-live="polite">
          {preview ? (
            <>
              <span className={entryStyles.kcal}>{Math.round(preview.kcal)} kcal</span>
              <span>
                P{preview.protein} F{preview.fat} C{preview.carbs}
              </span>
            </>
          ) : (
            <span>量を入れると栄養素を計算します</span>
          )}
        </div>

        {error && (
          <p className={formStyles.error} role="alert">
            {error}
          </p>
        )}

        <div className={formStyles.actions}>
          <button type="button" className={formStyles.cancel} onClick={onClose}>
            キャンセル
          </button>
          <button type="submit" className={formStyles.save}>
            追加
          </button>
        </div>
      </form>
    </dialog>
  );
}
