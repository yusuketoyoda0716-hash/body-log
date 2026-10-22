import { useEffect, useRef, useState } from 'react';
import type { Food, MealEntry, MealType, Nutrients, Recipe } from '../types';
import { TutorialHint } from '../tutorial/TutorialHint';
import { foodLabel, isRestaurantFood } from '../utils/foodLabel';
import { calcNutrients } from '../utils/nutrition';
import formStyles from './FoodFormDialog.module.css';
import styles from './MealEntryDialog.module.css';

type Props = {
  date: string;
  mealType: MealType;
  mealLabel: string;
  foods: Food[];
  recipes: Recipe[];
  onSave: (entry: MealEntry) => void;
  onClose: () => void;
};

// 選べるもの（食品とレシピ）を同じ形にそろえる。レシピは「1食あたり」の値を持つ
type Choice = Nutrients & {
  key: string; // select の value（'food:…' / 'recipe:…'）
  foodId: string; // 記録に残す元のID。レシピは 'recipe:…'
  name: string;
  unit: Food['unit'];
  baseAmount: number;
  estimated?: boolean; // 見積もりの値の外食メニュー
};

function toChoices(foods: Food[], recipes: Recipe[]) {
  return {
    foods: foods
      .filter((f) => !isRestaurantFood(f))
      .map<Choice>((f) => ({ ...f, key: `food:${f.id}`, foodId: f.id })),
    // 外食は「店名 メニュー名」で選べるようにする
    restaurants: foods
      .filter(isRestaurantFood)
      .map<Choice>((f) => ({ ...f, key: `food:${f.id}`, foodId: f.id, name: foodLabel(f) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ja')),
    recipes: recipes.map<Choice>((r) => ({
      key: `recipe:${r.id}`,
      foodId: `recipe:${r.id}`,
      name: r.name,
      unit: '食',
      baseAmount: 1,
      kcal: r.kcal,
      protein: r.protein,
      fat: r.fat,
      carbs: r.carbs,
    })),
  };
}

export function MealEntryDialog({
  date,
  mealType,
  mealLabel,
  foods,
  recipes,
  onSave,
  onClose,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [choiceKey, setChoiceKey] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const choices = toChoices(foods, recipes);
  const allChoices = [...choices.foods, ...choices.restaurants, ...choices.recipes];

  // 選ばれている食品（またはレシピ）と、計算結果（食品と正しい量がそろったときだけ）
  const food = allChoices.find((c) => c.key === choiceKey);
  const amountNumber = Number(amount);
  const preview =
    food && amount !== '' && amountNumber > 0 ? calcNutrients(food, amountNumber) : null;

  // 食品を選んだら、量にその食品の基準量を入れておく
  function handleFoodChange(key: string) {
    setChoiceKey(key);
    const next = allChoices.find((c) => c.key === key);
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
      foodId: food.foodId,
      foodName: food.name,
      unit: food.unit,
      amount: amountNumber,
      ...preview,
      ...(food.estimated ? { estimated: true } : {}),
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
        <TutorialHint dialog="entry" />

        {allChoices.length === 0 ? (
          <p className={formStyles.hint}>
            登録食品がありません。先に「食品」タブで登録してください。
          </p>
        ) : (
          <>
            <label className={formStyles.field}>
              食品
              <select value={choiceKey} onChange={(e) => handleFoodChange(e.target.value)}>
                <option value="">選択してください</option>
                <optgroup label="食品">
                  {choices.foods.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.name}（{c.baseAmount}
                      {c.unit}あたり {c.kcal}kcal）
                    </option>
                  ))}
                </optgroup>
                {choices.restaurants.length > 0 && (
                  <optgroup label="外食">
                    {choices.restaurants.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.name}（{c.baseAmount}
                        {c.unit}あたり {c.kcal}kcal{c.estimated ? '・見積もり' : ''}）
                      </option>
                    ))}
                  </optgroup>
                )}
                {choices.recipes.length > 0 && (
                  <optgroup label="レシピ">
                    {choices.recipes.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.name}（1食あたり {c.kcal}kcal）
                      </option>
                    ))}
                  </optgroup>
                )}
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
