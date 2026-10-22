import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { FoodFormDialog } from '../components/FoodFormDialog';
import { QuickAddDialog, type QuickAddTarget } from '../components/QuickAddDialog';
import { RecipeDetailDialog } from '../components/RecipeDetailDialog';
import { RecipeFormDialog } from '../components/RecipeFormDialog';
import { useRepository } from '../repositories/repositoryContext';
import { useTutorial } from '../tutorial/tutorialContext';
import { mealLabel } from '../constants/meals';
import type { Food, MealEntry, Recipe } from '../types';
import { formatDateLabel } from '../utils/date';
import { foodLabel, groupByShop, isRestaurantFood } from '../utils/foodLabel';
import styles from './FoodsPage.module.css';

type Tab = 'foods' | 'restaurants' | 'recipes';

const TABS: { tab: Tab; label: string; noun: string }[] = [
  { tab: 'foods', label: '食品', noun: '食品' },
  { tab: 'restaurants', label: '外食', noun: '外食のメニュー' },
  { tab: 'recipes', label: 'レシピ', noun: 'レシピ' },
];

// 食品はそのまま、レシピは「1食 = 1食分の値」として記録する形にそろえる
// 外食は「店名 メニュー名」で記録し、見積もりのメニューなら記録にも「見積もり」の印を付ける
function foodTarget(food: Food): QuickAddTarget {
  return {
    ...food,
    foodId: food.id,
    name: foodLabel(food),
    ...(food.estimated ? { estimated: true } : {}),
  };
}

function recipeTarget(recipe: Recipe): QuickAddTarget {
  return {
    foodId: `recipe:${recipe.id}`,
    name: recipe.name,
    unit: '食',
    baseAmount: 1,
    kcal: recipe.kcal,
    protein: recipe.protein,
    fat: recipe.fat,
    carbs: recipe.carbs,
  };
}

export function FoodsPage() {
  const repository = useRepository();
  const tutorial = useTutorial();
  const [tab, setTab] = useState<Tab>('foods');
  const [foods, setFoods] = useState<Food[] | null>(null);
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [query, setQuery] = useState('');
  // null = 閉じている / 'new' = 食品の新規追加 / 'new-restaurant' = 外食メニューの新規追加 / Food = 編集中
  const [editing, setEditing] = useState<Food | 'new' | 'new-restaurant' | null>(null);
  // 中身を表示しているレシピ
  const [viewingRecipe, setViewingRecipe] = useState<Recipe | null>(null);
  // null = 閉じている / 'new' = 新規作成 / Recipe = そのレシピを編集中
  const [editingRecipe, setEditingRecipe] = useState<Recipe | 'new' | null>(null);
  // 今日の食事に追加しようとしている食品・レシピ
  const [adding, setAdding] = useState<QuickAddTarget | null>(null);
  // 追加したあとに出すお知らせ
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    repository.getFoods().then(setFoods);
    repository.getRecipes().then(setRecipes);
  }, [repository]);

  async function handleSave(food: Food) {
    await repository.saveFood(food);
    setFoods(await repository.getFoods());
    setEditing(null);
    tutorial.notify('food-saved');
  }

  // 食品の追加・編集の画面を、キャンセルなどで閉じたとき
  function closeFoodForm() {
    setEditing(null);
    tutorial.notify('dialog-closed');
  }

  // 削除（確認してから）
  async function handleDelete(food: Food) {
    if (!window.confirm(`「${foodLabel(food)}」を削除しますか？`)) return;
    await repository.deleteFood(food.id);
    setFoods(await repository.getFoods());
    setEditing(null);
  }

  async function handleSaveRecipe(recipe: Recipe) {
    await repository.saveRecipe(recipe);
    setRecipes(await repository.getRecipes());
    setEditingRecipe(null);
  }

  // 詳細の画面を閉じてから、編集の画面を開く
  function openEditRecipe(recipe: Recipe) {
    setViewingRecipe(null);
    setEditingRecipe(recipe);
  }

  async function handleDeleteRecipe(recipe: Recipe) {
    if (!window.confirm(`レシピ「${recipe.name}」を削除しますか？`)) return;
    await repository.deleteRecipe(recipe.id);
    setRecipes(await repository.getRecipes());
    setViewingRecipe(null);
  }

  // 詳細の画面を閉じてから、追加の画面を開く
  function openAdd(target: QuickAddTarget) {
    setEditing(null);
    setViewingRecipe(null);
    setNotice(null);
    setAdding(target);
  }

  async function handleAddEntry(entry: MealEntry) {
    await repository.saveEntry(entry);
    setAdding(null);
    setNotice(
      `「${entry.foodName}」を${formatDateLabel(entry.date)}の${mealLabel(entry.mealType)}に記録しました`,
    );
  }

  const keyword = query.trim();
  // 食品タブには店名のないもの、外食タブには店名のあるものを出す（外食は店名でも検索できる）
  const visibleFoods =
    foods?.filter((food) => !isRestaurantFood(food) && food.name.includes(keyword)) ?? [];
  const shopGroups = groupByShop(
    foods?.filter((food) => isRestaurantFood(food) && foodLabel(food).includes(keyword)) ?? [],
  );
  const visibleRecipes = recipes?.filter((recipe) => recipe.name.includes(keyword)) ?? [];
  const loading = tab === 'recipes' ? recipes === null : foods === null;
  const visibleCount =
    tab === 'foods'
      ? visibleFoods.length
      : tab === 'restaurants'
        ? shopGroups.length
        : visibleRecipes.length;
  const noun = TABS.find((t) => t.tab === tab)?.noun ?? '';

  // 食品・外食メニューの1行（タップで編集）
  const foodRow = (food: Food) => (
    <li key={food.id}>
      <button type="button" className={styles.item} onClick={() => setEditing(food)}>
        <span className={styles.info}>
          <span className={styles.name}>
            {food.name}
            {food.estimated && <span className={styles.estimated}>見積もり</span>}
          </span>
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
  );

  return (
    <>
      <div className={styles.header}>
        <h1>登録食品</h1>
        {/* 開いているタブに合わせて、食品かレシピを追加する */}
        <button
          type="button"
          className={styles.addButton}
          data-tour="foods-add"
          onClick={() => {
            if (tab === 'recipes') {
              setEditingRecipe('new');
              return;
            }
            if (tab === 'restaurants') {
              setEditing('new-restaurant');
              return;
            }
            setEditing('new');
            tutorial.notify('food-dialog-opened');
          }}
        >
          ＋ 追加
        </button>
      </div>

      <div className={styles.tabs} role="group" aria-label="表示の切り替え" data-tour="foods-tabs">
        {TABS.map((t) => (
          <button
            key={t.tab}
            type="button"
            className={styles.tab}
            aria-pressed={tab === t.tab}
            onClick={() => setTab(t.tab)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {notice && (
        <p className={styles.notice} role="status">
          <span>{notice}</span>
          <Link to="/" className={styles.noticeLink}>
            今日を見る
          </Link>
        </p>
      )}

      <label className={styles.search}>
        検索
        <input
          type="search"
          placeholder={
            tab === 'foods'
              ? '食品名で検索'
              : tab === 'restaurants'
                ? '店名・メニュー名で検索'
                : 'レシピ名で検索'
          }
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      {loading ? (
        <p className={styles.message}>読み込み中…</p>
      ) : visibleCount === 0 ? (
        <p className={styles.message}>
          {keyword
            ? `「${keyword}」に一致する${noun}はありません`
            : tab === 'foods'
              ? 'まだ食品が登録されていません'
              : tab === 'restaurants'
                ? 'まだ外食のメニューがありません。「＋ 追加」か、Claude連携で「マクドナルドのビッグマックとポテトMを登録して」のように送ると登録できます'
                : 'まだレシピがありません。「＋ 追加」か、Claude連携で「カレーを4食分作った。材料は…」と送ると登録できます'}
        </p>
      ) : tab === 'foods' ? (
        <ul className={styles.list}>{visibleFoods.map(foodRow)}</ul>
      ) : tab === 'restaurants' ? (
        // 店名を見出しにして、お店ごとにメニューを並べる
        <div className={styles.shops}>
          {shopGroups.map((group) => (
            <section key={group.shop} aria-label={group.shop}>
              <h2 className={styles.shopName}>
                {group.shop}
                <span className={styles.shopCount}>{group.items.length}品</span>
              </h2>
              <ul className={styles.list}>{group.items.map(foodRow)}</ul>
            </section>
          ))}
        </div>
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
      {editing === 'new' && <FoodFormDialog onSave={handleSave} onClose={closeFoodForm} />}
      {editing === 'new-restaurant' && (
        <FoodFormDialog restaurant onSave={handleSave} onClose={() => setEditing(null)} />
      )}
      {editing !== null && editing !== 'new' && editing !== 'new-restaurant' && (
        <FoodFormDialog
          initialFood={editing}
          onSave={handleSave}
          onClose={() => setEditing(null)}
          onDelete={() => handleDelete(editing)}
          onAddToday={() => openAdd(foodTarget(editing))}
        />
      )}
      {viewingRecipe && (
        <RecipeDetailDialog
          recipe={viewingRecipe}
          onClose={() => setViewingRecipe(null)}
          onDelete={() => handleDeleteRecipe(viewingRecipe)}
          onAddToday={() => openAdd(recipeTarget(viewingRecipe))}
          onEdit={() => openEditRecipe(viewingRecipe)}
        />
      )}
      {editingRecipe !== null && (
        <RecipeFormDialog
          initialRecipe={editingRecipe === 'new' ? undefined : editingRecipe}
          foods={foods ?? []}
          recipes={recipes ?? []}
          onSave={handleSaveRecipe}
          onClose={() => setEditingRecipe(null)}
        />
      )}
      {adding && (
        <QuickAddDialog target={adding} onSave={handleAddEntry} onClose={() => setAdding(null)} />
      )}
    </>
  );
}
