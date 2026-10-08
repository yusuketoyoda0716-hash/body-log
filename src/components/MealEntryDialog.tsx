import { useEffect, useRef, useState } from 'react';
import type { Food, MealEntry, MealType } from '../types';
import { calcNutrients } from '../utils/nutrition';
import formStyles from './FoodFormDialog.module.css';
import styles from './MealEntryDialog.module.css';

type Props = {
  date: string;
  mealType: MealType;
  mealLabel: string;
  foods: Food[];
  onSave: (entry: MealEntry) => void;
  onClose: () => void;
};

export function MealEntryDialog({ date, mealType, mealLabel, foods, onSave, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [foodId, setFoodId] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  // 選ばれている食品と、計算結果（食品と正しい量がそろったときだけ）
  const food = foods.find((f) => f.id === foodId);
  const amountNumber = Number(amount);
  const preview = food && amount !== '' && amountNumber > 0 ? calcNutrients(food, amountNumber) : null;

  // 食品を選んだら、量にその食品の基準量を入れておく
  function handleFoodChange(id: string) {
    setFoodId(id);
    const next = foods.find((f) => f.id === id);
    setAmount(next ? String(next.baseAmount) : '');
  }

  function handleSubmit(e: { preventDefault: () => void }) {
    e.preventDefault();
    if (!food) {
      setError('食品を選んでください');
      return;
    }
    if (!preview) {
      setError('量は0より大きい数値を入力してください');
      return;
    }
    onSave({
      id: crypto.randomUUID(),
      date,
      mealType,
      foodId: food.id,
      foodName: food.name,
      unit: food.unit,
      amount: amountNumber,
      ...preview,
    });
  }

  return (
    <dialog
      ref={dialogRef}
      className={formStyles.dialog}
      onClose={onClose}
      aria-labelledby="meal-entry-title"
    >
      <form className={formStyles.form} onSubmit={handleSubmit} noValidate>
        <h2 id="meal-entry-title" className={formStyles.title}>
          {mealLabel}に追加
        </h2>

        {foods.length === 0 ? (
          <p className={formStyles.hint}>登録食品がありません。先に「食品」タブで登録してください。</p>
        ) : (
          <>
            <label className={formStyles.field}>
              食品
              <select value={foodId} onChange={(e) => handleFoodChange(e.target.value)}>
                <option value="">選択してください</option>
                {foods.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}（{f.baseAmount}
                    {f.unit}あたり {f.kcal}kcal）
                  </option>
                ))}
              </select>
            </label>

            <label className={formStyles.field}>
              量{food ? `（${food.unit}）` : ''}
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>

            <div className={styles.preview} aria-live="polite">
              {preview ? (
                <>
                  <span className={styles.kcal}>{Math.round(preview.kcal)} kcal</span>
                  <span>
                    P{preview.protein} F{preview.fat} C{preview.carbs}
                  </span>
                </>
              ) : (
                <span>食品と量を入れると栄養素を計算します</span>
              )}
            </div>
          </>
        )}

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
