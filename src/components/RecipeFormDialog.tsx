import { useEffect, useRef, useState } from 'react';
import type { Food, Recipe, RecipeIngredient } from '../types';
import { buildRecipe, ingredientNutrients, recipeTotal } from '../utils/recipe';
import formStyles from './FoodFormDialog.module.css';
import { IngredientPicker } from './IngredientPicker';
import styles from './RecipeFormDialog.module.css';

type Props = {
  initialRecipe?: Recipe; // 編集のときだけ渡す
  foods: Food[]; // 材料に選べる登録食品
  recipes: Recipe[]; // 同じ名前のレシピがないか確かめるため
  onSave: (recipe: Recipe) => void;
  onClose: () => void;
};

// 入力中の材料。量は input の中身（文字列）のまま持ち、保存するときに数値へ変換する
type IngredientRow = Omit<RecipeIngredient, 'amount'> & { key: string; amount: string };

function toRow(ingredient: RecipeIngredient): IngredientRow {
  return { ...ingredient, key: crypto.randomUUID(), amount: String(ingredient.amount) };
}

// 量が正しく入っている材料だけを、計算に使える形にする
function toIngredients(rows: IngredientRow[]): RecipeIngredient[] {
  return rows
    .filter((row) => row.amount !== '' && Number(row.amount) > 0)
    .map((row) => ({
      name: row.name,
      unit: row.unit,
      baseAmount: row.baseAmount,
      amount: Number(row.amount),
      kcal: row.kcal,
      protein: row.protein,
      fat: row.fat,
      carbs: row.carbs,
      ref: row.ref,
    }));
}

const sameName = (a: string, b: string) =>
  a.trim().normalize('NFKC') === b.trim().normalize('NFKC');

// レシピを作る・直す。材料を選ぶ画面は、同じダイアログの中で切り替えて出す
export function RecipeFormDialog({ initialRecipe, foods, recipes, onSave, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(initialRecipe?.name ?? '');
  const [servings, setServings] = useState(String(initialRecipe?.servings ?? 4));
  const [rows, setRows] = useState<IngredientRow[]>(
    () => initialRecipe?.ingredients.map(toRow) ?? [],
  );
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const servingsNumber = Number(servings);
  const validServings = servings !== '' && servingsNumber > 0;
  const total = recipeTotal(toIngredients(rows));
  const perServing = validServings
    ? buildRecipe({ id: '', name: '', servings: servingsNumber, ingredients: toIngredients(rows) })
    : null;

  function updateAmount(key: string, amount: string) {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, amount } : row)));
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((row) => row.key !== key));
  }

  function handlePick(ingredient: RecipeIngredient) {
    setRows((prev) => [...prev, toRow(ingredient)]);
    setPicking(false);
    setError(null);
  }

  // 問題があればエラーメッセージ、なければ null を返す
  function validate(): string | null {
    const trimmed = name.trim();
    if (trimmed === '') return 'レシピ名を入力してください';
    const duplicate = recipes.some((r) => r.id !== initialRecipe?.id && sameName(r.name, trimmed));
    if (duplicate) return `「${trimmed}」というレシピはすでにあります。名前を変えてください`;
    if (!validServings) return '何食分かは0より大きい数値を入力してください';
    if (rows.length === 0) return '材料を1つ以上追加してください';
    if (rows.some((row) => row.amount === '' || !(Number(row.amount) > 0))) {
      return '材料の量は0より大きい数値を入力してください';
    }
    return null;
  }

  function handleSubmit(e: { preventDefault: () => void }) {
    e.preventDefault();
    const message = validate();
    if (message) {
      setError(message);
      return;
    }
    onSave(
      buildRecipe({
        id: initialRecipe?.id ?? crypto.randomUUID(),
        name: name.trim(),
        servings: servingsNumber,
        ingredients: toIngredients(rows),
      }),
    );
  }

  return (
    <dialog
      ref={dialogRef}
      className={formStyles.dialog}
      onClose={onClose}
      aria-label={initialRecipe ? 'レシピを編集' : 'レシピを追加'}
    >
      {picking ? (
        <div className={formStyles.form}>
          <IngredientPicker foods={foods} onPick={handlePick} onCancel={() => setPicking(false)} />
        </div>
      ) : (
        <form className={formStyles.form} onSubmit={handleSubmit} noValidate>
          <h2 className={formStyles.title}>{initialRecipe ? 'レシピを編集' : 'レシピを追加'}</h2>

          <div className={formStyles.row}>
            <label className={formStyles.field}>
              レシピ名
              <input
                type="text"
                placeholder="例：カレー"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className={formStyles.field}>
              何食分
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={servings}
                onChange={(e) => setServings(e.target.value)}
              />
            </label>
          </div>

          <div className={styles.ingredients}>
            <p className={styles.heading}>材料（鍋全体で使った量）</p>
            {rows.length === 0 ? (
              <p className={styles.empty}>まだ材料がありません</p>
            ) : (
              <ul className={styles.list}>
                {rows.map((row) => {
                  const amount = Number(row.amount);
                  // 量に合わせて、この材料のカロリーとPFCを計算し直す
                  const values =
                    row.amount !== '' && amount > 0
                      ? ingredientNutrients({ ...row, amount })
                      : null;
                  return (
                    <li key={row.key} className={styles.row}>
                      <span className={styles.name}>{row.name}</span>
                      <label className={styles.amount}>
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="any"
                          aria-label={`${row.name}の量`}
                          value={row.amount}
                          onChange={(e) => updateAmount(row.key, e.target.value)}
                        />
                        <span>{row.unit}</span>
                      </label>
                      <span className={styles.kcal}>
                        {values ? (
                          <>
                            {values.kcal}kcal
                            <span className={styles.pfc}>
                              P{values.protein} F{values.fat} C{values.carbs}
                            </span>
                          </>
                        ) : (
                          '-'
                        )}
                      </span>
                      <button
                        type="button"
                        className={styles.remove}
                        aria-label={`${row.name}を外す`}
                        onClick={() => removeRow(row.key)}
                      >
                        ×
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <button type="button" className={formStyles.addToday} onClick={() => setPicking(true)}>
              ＋ 材料を追加
            </button>
          </div>

          <div className={styles.totals} aria-live="polite">
            <div>
              <span className={styles.label}>鍋全体</span>
              <span className={styles.value}>{total.kcal} kcal</span>
              <span className={styles.sub}>
                P{total.protein} F{total.fat} C{total.carbs}
              </span>
            </div>
            <div>
              <span className={styles.label}>
                1食あたり{validServings ? `（${servingsNumber}食分）` : ''}
              </span>
              <span className={styles.value}>{perServing ? `${perServing.kcal} kcal` : '-'}</span>
              {perServing && (
                <span className={styles.sub}>
                  P{perServing.protein} F{perServing.fat} C{perServing.carbs}
                </span>
              )}
            </div>
          </div>

          {initialRecipe && (
            <p className={formStyles.hint}>保存しても、これまでに記録した食事の値は変わりません</p>
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
              保存
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
