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
import {
  SORT_OPTIONS,
  normalizedBase,
  normalizedNutrients,
  sortFoods,
  type SortKey,
} from '../utils/sortFoods';
import {
  KIND_LABELS,
  foodCategory,
  foodKind,
  foodLabel,
  groupByShop,
  isRestaurantFood,
  matchesKeyword,
  type FoodKind,
} from '../utils/foodLabel';
import styles from './FoodsPage.module.css';

type Tab = 'ingredients' | 'products' | 'restaurants' | 'recipes';

// 食品の種類と、それが出るタブ
const KIND_TABS: Record<FoodKind, Tab> = {
  ingredient: 'ingredients',
  product: 'products',
  restaurant: 'restaurants',
};

const TABS: { tab: Tab; label: string; noun: string }[] = [
  { tab: 'ingredients', label: '食材', noun: '食材' },
  { tab: 'products', label: '市販品', noun: '市販品' },
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
  const [tab, setTab] = useState<Tab>('ingredients');
  const [foods, setFoods] = useState<Food[] | null>(null);
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [query, setQuery] = useState('');
  // 並べ替え（名前順、または P・F・C・カロリーが多い順）
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const bySort = sortKey !== 'name';
  // null = 閉じている / 'new' = 食材・市販品の新規追加 / 'new-restaurant' = 外食メニューの新規追加 / Food = 編集中
  const [editing, setEditing] = useState<Food | 'new' | 'new-restaurant' | null>(null);
  // 中身を表示しているレシピ
  const [viewingRecipe, setViewingRecipe] = useState<Recipe | null>(null);
  // null = 閉じている / 'new' = 新規作成 / Recipe = そのレシピを編集中
  const [editingRecipe, setEditingRecipe] = useState<Recipe | 'new' | null>(null);
  // 今日の食事に追加しようとしている食品・レシピ
  const [adding, setAdding] = useState<QuickAddTarget | null>(null);
  // 追加したあとに出すお知らせ
  const [notice, setNotice] = useState<string | null>(null);
  // 種類を変えて別のタブへ移したときのお知らせ（移った先のタブを開けるようにする）
  const [moved, setMoved] = useState<{ text: string; tab: Tab } | null>(null);

  useEffect(() => {
    repository.getFoods().then(setFoods);
    repository.getRecipes().then(setRecipes);
  }, [repository]);

  async function handleSave(food: Food) {
    await repository.saveFood(food);
    setFoods(await repository.getFoods());
    // 編集で種類を変えたら、どこへ移ったかを知らせる
    const before = editing && typeof editing === 'object' ? foodKind(editing) : null;
    const after = foodKind(food);
    setMoved(
      before && before !== after
        ? {
            text: `「${foodLabel(food)}」を${KIND_LABELS[after]}に移動しました`,
            tab: KIND_TABS[after],
          }
        : null,
    );
    // お知らせは画面の上に出るので、上まで戻す（スクロールするのはページ全体ではなく main の中）
    if (before && before !== after) {
      document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
    }
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
  // 食材・市販品タブには店名のないものを種類ごとに、外食タブには店名のあるものを出す（外食は店名でも検索できる）
  const visibleFoods = sortFoods(
    foods?.filter(
      (food) =>
        !isRestaurantFood(food) &&
        foodCategory(food) === (tab === 'products' ? 'product' : 'ingredient') &&
        matchesKeyword(food, keyword),
    ) ?? [],
    sortKey,
  );
  const shopGroups = groupByShop(
    foods?.filter((food) => isRestaurantFood(food) && matchesKeyword(food, keyword)) ?? [],
  );
  // 栄養素で並べ替えるときは、外食も店ごとにまとめず「店名 メニュー名」で1つの一覧にする
  //   （並べ替え用に名前を「店名 メニュー名」にした形で並べ、もとの食品に戻す）
  const visibleRestaurants = sortFoods(
    (foods ?? [])
      .filter((food) => isRestaurantFood(food) && matchesKeyword(food, keyword))
      .map((food) => ({ ...food, name: foodLabel(food), original: food })),
    sortKey,
  ).map((item) => item.original);
  // レシピは1食あたりの値で比べる
  const visibleRecipes = sortFoods(
    (recipes ?? [])
      .filter((recipe) => recipe.name.includes(keyword))
      .map((recipe) => ({
        ...recipe,
        unit: '食' as const,
        baseAmount: 1,
        original: recipe,
      })),
    sortKey,
  ).map((item) => item.original);
  const loading = tab === 'recipes' ? recipes === null : foods === null;
  const visibleCount =
    tab === 'ingredients' || tab === 'products'
      ? visibleFoods.length
      : tab === 'restaurants'
        ? shopGroups.length
        : visibleRecipes.length;
  const noun = TABS.find((t) => t.tab === tab)?.noun ?? '';

  // 食品・外食メニューの1行（タップで編集）
  // 並べ替えに使っている栄養素を太字にする
  const pfc = (values: { protein: number; fat: number; carbs: number }) => (
    <>
      <span className={sortKey === 'protein' ? styles.sorted : undefined}>P{values.protein}</span>{' '}
      <span className={sortKey === 'fat' ? styles.sorted : undefined}>F{values.fat}</span>{' '}
      <span className={sortKey === 'carbs' ? styles.sorted : undefined}>C{values.carbs}</span>
    </>
  );

  const foodRow = (food: Food, withShop = false) => {
    // 並べ替え中は、比べやすいように100gあたり（個などは1つあたり）の値で見せる
    const shown = bySort ? normalizedNutrients(food) : food;
    const base = bySort ? normalizedBase(food) : food.baseAmount;
    return (
      <li key={food.id}>
        <button type="button" className={styles.item} onClick={() => setEditing(food)}>
          <span className={styles.info}>
            <span className={styles.name}>
              {withShop ? foodLabel(food) : food.name}
              {food.estimated && <span className={styles.estimated}>見積もり</span>}
            </span>
            <span className={styles.sub}>
              {food.brand && `${food.brand}・`}
              {base}
              {food.unit} あたり
            </span>
            {food.source && <span className={styles.source}>出典：{food.source}</span>}
          </span>
          <span className={styles.nutrients}>
            <span className={`${styles.kcal} ${sortKey === 'kcal' ? styles.sorted : ''}`}>
              {shown.kcal} kcal
            </span>
            <span className={styles.sub}>{pfc(shown)}</span>
          </span>
        </button>
      </li>
    );
  };

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

      {moved && (
        <p className={styles.notice} role="status">
          <span>{moved.text}</span>
          <button
            type="button"
            className={styles.noticeLink}
            onClick={() => {
              setTab(moved.tab);
              setMoved(null);
            }}
          >
            {TABS.find((t) => t.tab === moved.tab)?.label}を見る
          </button>
        </p>
      )}

      <label className={styles.search}>
        検索
        <input
          type="search"
          placeholder={
            tab === 'ingredients' || tab === 'products'
              ? '食品名・メーカーで検索'
              : tab === 'restaurants'
                ? '店名・メニュー名で検索'
                : 'レシピ名で検索'
          }
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      {/* 並べ替え：名前順のほか、P・F・C・カロリーが多い順にできる */}
      <div className={styles.sortRow} role="group" aria-label="並べ替え">
        <span className={styles.sortLabel}>並べ替え</span>
        {SORT_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            className={styles.sortChip}
            aria-pressed={sortKey === option.key}
            onClick={() => setSortKey(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {bySort && tab !== 'recipes' && (
        <p className={styles.sortNote}>
          多い順に並べています。gの食品は100gあたり、個・枚などは1つあたりの値で比べます
        </p>
      )}

      {loading ? (
        <p className={styles.message}>読み込み中…</p>
      ) : visibleCount === 0 ? (
        <p className={styles.message}>
          {keyword
            ? `「${keyword}」に一致する${noun}はありません`
            : tab === 'ingredients'
              ? 'まだ食材が登録されていません。「＋ 追加」で成分表から探して登録できます'
              : tab === 'products'
                ? 'まだ市販品が登録されていません。「＋ 追加」でパッケージの値を入れるか、Claude連携で商品の写真を送ると登録できます'
                : tab === 'restaurants'
                  ? 'まだ外食のメニューがありません。「＋ 追加」か、Claude連携で「マクドナルドのビッグマックとポテトMを登録して」のように送ると登録できます'
                  : 'まだレシピがありません。「＋ 追加」か、Claude連携で「カレーを4食分作った。材料は…」と送ると登録できます'}
        </p>
      ) : tab === 'ingredients' || tab === 'products' ? (
        <ul className={styles.list}>{visibleFoods.map((food) => foodRow(food))}</ul>
      ) : tab === 'restaurants' && bySort ? (
        <ul className={styles.list}>{visibleRestaurants.map((food) => foodRow(food, true))}</ul>
      ) : tab === 'restaurants' ? (
        // 店名を見出しにして、お店ごとにメニューを並べる
        <div className={styles.shops}>
          {shopGroups.map((group) => (
            <section key={group.shop} aria-label={group.shop}>
              <h2 className={styles.shopName}>
                {group.shop}
                <span className={styles.shopCount}>{group.items.length}品</span>
              </h2>
              <ul className={styles.list}>{group.items.map((food) => foodRow(food))}</ul>
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
                  <span className={`${styles.kcal} ${sortKey === 'kcal' ? styles.sorted : ''}`}>
                    {recipe.kcal} kcal
                  </span>
                  <span className={styles.sub}>1食あたり {pfc(recipe)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* 新規と編集で同じフォームを使い回す */}
      {editing === 'new' && (
        <FoodFormDialog
          defaultCategory={tab === 'products' ? 'product' : 'ingredient'}
          onSave={handleSave}
          onClose={closeFoodForm}
        />
      )}
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
