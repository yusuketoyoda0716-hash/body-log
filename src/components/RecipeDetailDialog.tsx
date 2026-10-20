import { useEffect, useRef } from 'react';
import type { Recipe } from '../types';
import { ingredientNutrients, recipeTotal } from '../utils/recipe';
import formStyles from './FoodFormDialog.module.css';
import styles from './RecipeDetailDialog.module.css';

type Props = {
  recipe: Recipe;
  onClose: () => void;
  onDelete: () => void;
  onAddToday: () => void;
};

// レシピの中身（材料・鍋全体・1食あたり）を表示する
// アプリでの編集は次の段階で追加する
export function RecipeDetailDialog({ recipe, onClose, onDelete, onAddToday }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const total = recipeTotal(recipe.ingredients);

  return (
    <dialog
      ref={dialogRef}
      className={formStyles.dialog}
      onClose={onClose}
      aria-labelledby="recipe-title"
    >
      <div className={formStyles.form}>
        <h2 id="recipe-title" className={formStyles.title}>
          {recipe.name}
        </h2>

        <div className={styles.perServing}>
          <span className={styles.label}>1食あたり（{recipe.servings}食分）</span>
          <span className={styles.kcal}>{recipe.kcal} kcal</span>
          <span className={styles.sub}>
            P{recipe.protein} F{recipe.fat} C{recipe.carbs}
          </span>
        </div>

        <table className={styles.table}>
          <caption className={styles.caption}>材料</caption>
          <thead>
            <tr>
              <th scope="col">材料</th>
              <th scope="col">量</th>
              <th scope="col">kcal</th>
            </tr>
          </thead>
          <tbody>
            {recipe.ingredients.map((ingredient, i) => (
              <tr key={`${ingredient.name}-${i}`}>
                <th scope="row">{ingredient.name}</th>
                <td>
                  {ingredient.amount}
                  {ingredient.unit}
                </td>
                <td>{ingredientNutrients(ingredient).kcal}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">鍋全体</th>
              <td />
              <td>{total.kcal}</td>
            </tr>
          </tfoot>
        </table>

        <p className={formStyles.hint}>
          材料の量や何食分かを変えたいときは、Claude連携で「今日の{recipe.name}は〇〇を△△gで作った」のように伝えてください。
        </p>

        <button type="button" className={formStyles.addToday} onClick={onAddToday}>
          ＋ 今日の食事に追加（1食分）
        </button>

        <div className={formStyles.actions}>
          <button type="button" className={formStyles.delete} onClick={onDelete}>
            削除
          </button>
          <button type="button" className={formStyles.cancel} onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>
    </dialog>
  );
}
