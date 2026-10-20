import { useEffect, useState } from 'react';
import { FoodFormDialog } from '../components/FoodFormDialog';
import { RecipeDetailDialog } from '../components/RecipeDetailDialog';
import { useRepository } from '../repositories/repositoryContext';
import type { Food, Recipe } from '../types';
import styles from './FoodsPage.module.css';

type Tab = 'foods' | 'recipes';

export function FoodsPage() {
  const repository = useRepository();
  const [tab, setTab] = useState<Tab>('foods');
  const [foods, setFoods] = useState<Food[] | null>(null);
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [query, setQuery] = useState('');
  // null = 閉じている / 'new' = 新規追加 / Food = その食品を編集中
  const [editing, setEditing] = useState<Food | 'new' | null>(null);
  // 中身を表示しているレシピ
  const [viewingRecipe, setViewingRecipe] = useState<Recipe | null>(null);

  useEffect(() => {
    repository.getFoods().then(setFoods);
    repository.getRecipes().then(setRecipes);
  }, [repository]);

  async function handleSave(food: Food) {
    await repository.saveFood(food);
    setFoods(await repository.getFoods());
    setEditing(null);
  }

  // 削除（確認してから）
  async function handleDelete(food: Food) {
    if (!window.confirm(`「${food.name}」を削除しますか？`)) return;
    await repository.deleteFood(food.id);
    setFoods(await repository.getFoods());
    setEditing(null);
  }

  async function handleDeleteRecipe(recipe: Recipe) {
    if (!window.confirm(`レシピ「${recipe.name}」を削除しますか？`)) return;
    await repository.deleteRecipe(recipe.id);
    setRecipes(await repository.getRecipes());
    setViewingRecipe(null);
  }

  const keyword = query.trim();
  const visibleFoods = foods?.filter((food) => food.name.includes(keyword)) ?? [];
  const visibleRecipes = recipes?.filter((recipe) => recipe.name.includes(keyword)) ?? [];
  const loading = tab === 'foods' ? foods === null : recipes === null;
  const visibleCount = tab === 'foods' ? visibleFoods.length : visibleRecipes.length;

  return (
    <>
      <div className={styles.header}>
        <h1>登録食品</h1>
        {/* レシピをアプリで作る画面は次の段階で追加する。今は Claude から登録できる */}
        {tab === 'foods' && (
          <button type="button" className={styles.addButton} onClick={() => setEditing('new')}>
            ＋ 追加
          </button>
        )}
      </div>

      <div className={styles.tabs} role="group" aria-label="表示の切り替え">
        <button
          type="button"
          className={styles.tab}
          aria-pressed={tab === 'foods'}
          onClick={() => setTab('foods')}
        >
          食品
        </button>
        <button
          type="button"
          className={styles.tab}
          aria-pressed={tab === 'recipes'}
          onClick={() => setTab('recipes')}
        >
          レシピ
        </button>
      </div>

      <label className={styles.search}>
        検索
        <input
          type="search"
          placeholder={tab === 'foods' ? '食品名で検索' : 'レシピ名で検索'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      {loading ? (
        <p className={styles.message}>読み込み中…</p>
      ) : visibleCount === 0 ? (
        <p className={styles.message}>
          {keyword
            ? `「${keyword}」に一致する${tab === 'foods' ? '食品' : 'レシピ'}はありません`
            : tab === 'foods'
              ? 'まだ食品が登録されていません'
              : 'まだレシピがありません。Claude連携で「カレーを4食分作った。材料は…」と送ると登録できます'}
        </p>
      ) : tab === 'foods' ? (
        <ul className={styles.list}>
          {visibleFoods.map((food) => (
            <li key={food.id}>
              {/* 行全体をボタンにして、タップで編集 */}
              <button type="button" className={styles.item} onClick={() => setEditing(food)}>
                <span className={styles.info}>
                  <span className={styles.name}>{food.name}</span>
                  <span className={styles.sub}>
                    {food.baseAmount}
                    {food.unit} あたり
                  </span>
                  {food.source && <span className={styles.source}>出典：{food.source}</span>}
                </span>
                <span className={styles.nutrients}>
                  <span className={styles.kcal}>{food.kcal} kcal</span>
                  <span className={styles.sub}>
                    P{food.protein} F{food.fat} C{food.carbs}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <ul className={styles.list}>
          {visibleRecipes.map((recipe) => (
            <li key={recipe.id}>
              <button
                type="button"
                className={styles.item}
                onClick={() => setViewingRecipe(recipe)}
              >
                <span className={styles.info}>
                  <span className={styles.name}>{recipe.name}</span>
                  <span className={styles.sub}>
                    {recipe.servings}食分・材料{recipe.ingredients.length}品
                  </span>
                </span>
                <span className={styles.nutrients}>
                  <span className={styles.kcal}>{recipe.kcal} kcal</span>
                  <span className={styles.sub}>
                    1食あたり P{recipe.protein} F{recipe.fat} C{recipe.carbs}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* 新規と編集で同じフォームを使い回す */}
      {editing === 'new' && (
        <FoodFormDialog onSave={handleSave} onClose={() => setEditing(null)} />
      )}
      {editing !== null && editing !== 'new' && (
        <FoodFormDialog
          initialFood={editing}
          onSave={handleSave}
          onClose={() => setEditing(null)}
          onDelete={() => handleDelete(editing)}
        />
      )}
      {viewingRecipe && (
        <RecipeDetailDialog
          recipe={viewingRecipe}
          onClose={() => setViewingRecipe(null)}
          onDelete={() => handleDeleteRecipe(viewingRecipe)}
        />
      )}
    </>
  );
}
