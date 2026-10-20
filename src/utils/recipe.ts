// サーバー（api/mcp.ts）からも読み込むので、import は拡張子付きで書く
import type { Nutrients, Recipe, RecipeIngredient } from '../types/index.js';
import { calcNutrients, sumNutrients } from './nutrition.js';

const round1 = (n: number) => Math.round(n * 10) / 10;

// 材料1つ分の値（基準量あたりの値 × 使った量）
export function ingredientNutrients(ingredient: RecipeIngredient): Nutrients {
  return calcNutrients(ingredient, ingredient.amount);
}

// 鍋全体（材料すべての合計）の値
export function recipeTotal(ingredients: RecipeIngredient[]): Nutrients {
  return sumNutrients(ingredients.map(ingredientNutrients));
}

// 材料と何食分かから、1食あたりの値を計算してレシピを組み立てる
export function buildRecipe(base: Omit<Recipe, keyof Nutrients>): Recipe {
  const total = recipeTotal(base.ingredients);
  const servings = base.servings > 0 ? base.servings : 1;
  return {
    ...base,
    kcal: round1(total.kcal / servings),
    protein: round1(total.protein / servings),
    fat: round1(total.fat / servings),
    carbs: round1(total.carbs / servings),
  };
}
