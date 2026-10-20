import { describe, expect, it } from 'vitest';
import type { RecipeIngredient } from '../types';
import { buildRecipe, ingredientNutrients, recipeTotal } from './recipe';

// 豚バラ 300g・じゃがいも 300g・カレールウ 100g のカレー
const porkBelly: RecipeIngredient = {
  name: '豚バラ肉',
  unit: 'g',
  baseAmount: 100,
  amount: 300,
  kcal: 366,
  protein: 14.4,
  fat: 35.4,
  carbs: 0.1,
  ref: 'mext:11129',
};
const potato: RecipeIngredient = {
  name: 'じゃがいも',
  unit: 'g',
  baseAmount: 100,
  amount: 300,
  kcal: 59,
  protein: 1.8,
  fat: 0.1,
  carbs: 17.3,
  ref: 'mext:02017',
};
const roux: RecipeIngredient = {
  name: 'カレールウ',
  unit: 'g',
  baseAmount: 100,
  amount: 100,
  kcal: 474,
  protein: 6.5,
  fat: 34.1,
  carbs: 44.7,
  ref: null,
};
const ingredients = [porkBelly, potato, roux];

describe('レシピの計算', () => {
  it('材料1つ分：基準量あたりの値 × 使った量', () => {
    expect(ingredientNutrients(porkBelly).kcal).toBe(1098);
  });

  it('鍋全体：材料すべての合計', () => {
    expect(recipeTotal(ingredients)).toEqual({
      kcal: 1749, // 1098 + 177 + 474
      protein: 55.1,
      fat: 140.6,
      carbs: 96.9,
    });
  });

  it('1食あたり：鍋全体 ÷ 何食分', () => {
    const recipe = buildRecipe({ id: 'r1', name: 'カレー', servings: 4, ingredients });
    expect(recipe).toMatchObject({ kcal: 437.3, protein: 13.8, fat: 35.2, carbs: 24.2 });
    // 材料と何食分は、そのまま残す（あとで量を変えて作り直せるように）
    expect(recipe.ingredients).toEqual(ingredients);
    expect(recipe.servings).toBe(4);
  });

  it('肉を400gにして作り直すと、1食あたりが変わる', () => {
    const more = buildRecipe({
      id: 'r1',
      name: 'カレー',
      servings: 4,
      ingredients: [{ ...porkBelly, amount: 400 }, potato, roux],
    });
    expect(more.kcal).toBe(528.8); // (1464 + 177 + 474) ÷ 4
  });

  it('何食分が0のときは、0で割らずに1食分として扱う', () => {
    const recipe = buildRecipe({ id: 'r1', name: 'カレー', servings: 0, ingredients });
    expect(recipe.kcal).toBe(1749);
  });
});
