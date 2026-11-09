import { useEffect, useRef, useState } from 'react';
import { quickAmounts } from '../constants/units';
import type { Food, MealEntry, MealType, Nutrients, Recipe } from '../types';
import { TutorialHint } from '../tutorial/TutorialHint';
import { foodLabel, isRestaurantFood } from '../utils/foodLabel';
import { searchFoods } from '../utils/foodSearch';
import {
  MEXT_SOURCE,
  loadMextFoods,
  pickedName,
  searchMextFoods,
  type MextFood,
} from '../utils/mextFoods';
import { calcNutrients } from '../utils/nutrition';
import type { searchPopularFoods } from '../utils/popularFoods';
import formStyles from './FoodFormDialog.module.css';
import styles from './MealEntryDialog.module.css';

type Props = {
  date: string;
  mealType: MealType;
  mealLabel: string;
  foods: Food[];
  recipes: Recipe[];
  // 最近記録したものの ID（新しい順。食品は food.id、レシピは 'recipe:…'）
  recentIds: string[];
  onSave: (entry: MealEntry) => void;
  // 成分表から選んだ、まだ登録していない食品を登録食品に追加する
  onRegisterFood: (food: Food) => Promise<void>;
  onClose: () => void;
};

// 選べるもの（食品・外食・レシピ・成分表）を同じ形にそろえる。レシピは「1食あたり」の値を持つ
type Choice = Nutrients & {
  key: string;
  foodId: string; // 記録に残す元のID。レシピは 'recipe:…'
  name: string;
  unit: Food['unit'];
  baseAmount: number;
  kind: 'food' | 'restaurant' | 'recipe' | 'mext';
  estimated?: boolean; // 見積もりの値の外食メニュー
  mext?: MextFood; // 成分表・よく食べるものから選んだとき（まだ登録していない）
};

type Tab = 'recent' | 'food' | 'restaurant' | 'recipe';
const TABS: { tab: Tab; label: string }[] = [
  { tab: 'recent', label: '最近' },
  { tab: 'food', label: '食品' },
  { tab: 'restaurant', label: '外食' },
  { tab: 'recipe', label: 'レシピ' },
];

function foodChoice(f: Food): Choice {
  return {
    ...f,
    key: `food:${f.id}`,
    foodId: f.id,
    name: foodLabel(f),
    kind: isRestaurantFood(f) ? 'restaurant' : 'food',
  };
}

function recipeChoice(r: Recipe): Choice {
  return {
    key: `recipe:${r.id}`,
    foodId: `recipe:${r.id}`,
    name: r.name,
    unit: '食',
    baseAmount: 1,
    kind: 'recipe',
    kcal: r.kcal,
    protein: r.protein,
    fat: r.fat,
    carbs: r.carbs,
  };
}

// 成分表の食品を選ぶ形にする。1個で数えることが多いもの（卵など）は、最初から1個あたりにする
function mextChoice(m: MextFood, byPiece: boolean): Choice {
  const base = {
    key: `mext:${m.code}`,
    foodId: '',
    name: pickedName(m),
    kind: 'mext' as const,
    mext: m,
  };
  if (byPiece && m.piece) {
    return {
      ...base,
      unit: m.piece.unit,
      baseAmount: 1,
      ...calcNutrients({ ...m, baseAmount: 100 }, m.piece.grams),
    };
  }
  return {
    ...base,
    unit: 'g',
    baseAmount: 100,
    kcal: m.kcal,
    protein: m.protein,
    fat: m.fat,
    carbs: m.carbs,
  };
}

function perText(c: Choice): string {
  return c.kind === 'recipe' ? '1食あたり' : `${c.baseAmount}${c.unit}あたり`;
}

type MextData = { foods: MextFood[]; searchPopular: typeof searchPopularFoods };

// 食事を記録する画面
//   1. 選ぶ：検索・最近使ったもの・食品／外食／レシピのタブ。登録していなければ成分表からも選べる
//   2. 量を入れる：よく使う量のボタンと、カロリー・PFCの計算
export function MealEntryDialog({
  date,
  mealType,
  mealLabel,
  foods,
  recipes,
  recentIds,
  onSave,
  onRegisterFood,
  onClose,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState('');
  // 最近記録したものがあれば「最近」から。毎日同じものを食べることが多いので、たいていここで選べる
  const [tab, setTab] = useState<Tab>(recentIds.length > 0 ? 'recent' : 'food');
  const [selected, setSelected] = useState<Choice | null>(null);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // 成分表（約300kB）とよく食べるものの一覧は、検索したときに初めて読み込む
  const [mextData, setMextData] = useState<MextData | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const keyword = query.trim();
  useEffect(() => {
    if (keyword === '' || mextData) return;
    let ignore = false;
    Promise.all([loadMextFoods(), import('../utils/popularFoods')]).then(([mextFoods, m]) => {
      if (!ignore) setMextData({ foods: mextFoods, searchPopular: m.searchPopularFoods });
    });
    return () => {
      ignore = true;
    };
  }, [keyword, mextData]);

  const registered = [...foods.map(foodChoice), ...recipes.map(recipeChoice)];
  const byKey = new Map(registered.map((c) => [c.foodId, c]));
  const recent = recentIds.flatMap((id) => byKey.get(id) ?? []).slice(0, 10);

  // 検索：登録したもの（食品・外食・レシピ）→ よく食べるもの → 成分表 の順に出す
  const registeredHits = keyword ? searchFoods(registered, keyword, 30) : [];
  const mextHits: Choice[] = (() => {
    if (!keyword || !mextData) return [];
    const popular = mextData.searchPopular(mextData.foods, keyword);
    const codes = new Set(popular.map((m) => m.code));
    const plain = searchMextFoods(mextData.foods, keyword).filter((m) => !codes.has(m.code));
    return [...popular, ...plain].slice(0, 30).map((m) => mextChoice(m, true));
  })();

  function select(choice: Choice) {
    setSelected(choice);
    setAmount(String(choice.baseAmount));
    setError(null);
  }

  // 成分表の食品を「g で入れる」「1個で入れる」に切り替える
  function switchMextUnit(byPiece: boolean) {
    if (!selected?.mext) return;
    select(mextChoice(selected.mext, byPiece));
  }

  const amountNumber = Number(amount);
  const preview =
    selected && amount !== '' && amountNumber > 0 ? calcNutrients(selected, amountNumber) : null;

  async function handleSubmit(e: { preventDefault: () => void }) {
    e.preventDefault();
    if (!selected) return;
    if (!preview) {
      setError('量は0より大きい数値を入力してください');
      return;
    }
    setSaving(true);
    let foodId = selected.foodId;
    // 成分表から選んだものは、登録食品にも追加する（次から「最近使ったもの」に出る）
    if (selected.mext) {
      const m = selected.mext;
      const piece = selected.unit !== 'g' ? m.piece : undefined;
      const basis = [m.basis, piece ? `${piece.note}として計算` : null].filter(Boolean).join('、');
      const food: Food = {
        id: crypto.randomUUID(),
        name: selected.name,
        unit: selected.unit,
        baseAmount: selected.baseAmount,
        kcal: selected.kcal,
        protein: selected.protein,
        fat: selected.fat,
        carbs: selected.carbs,
        source: basis ? `${MEXT_SOURCE}をもとに計算（${basis}）` : MEXT_SOURCE,
      };
      try {
        await onRegisterFood(food);
      } catch {
        setSaving(false);
        setError('登録できませんでした。時間をおいてもう一度お試しください');
        return;
      }
      foodId = food.id;
    }
    onSave({
      id: crypto.randomUUID(),
      date,
      mealType,
      foodId,
      foodName: selected.name,
      unit: selected.unit,
      amount: amountNumber,
      ...preview,
      ...(selected.estimated ? { estimated: true } : {}),
    });
  }

  const row = (c: Choice) => (
    <li key={c.key}>
      <button type="button" className={styles.item} onClick={() => select(c)}>
        <span className={styles.info}>
          <span className={styles.name}>
            {c.name}
            {c.estimated && <span className={styles.badge}>見積もり</span>}
          </span>
          <span className={styles.sub}>
            {perText(c)}
            {c.mext?.piece && c.unit !== 'g' ? `・${c.mext.piece.note}` : ''}
          </span>
        </span>
        <span className={styles.kcal}>{c.kcal} kcal</span>
      </button>
    </li>
  );

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

        {!selected ? (
          // ---- 1. 選ぶ ----
          <>
            <label className={formStyles.field}>
              探す
              <input
                type="search"
                placeholder="例：とりむね、ごはん、店名"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>

            {keyword ? (
              <div className={styles.results}>
                {registeredHits.length > 0 && (
                  <section>
                    <h3 className={styles.heading}>登録したもの</h3>
                    <ul className={styles.list}>{registeredHits.map(row)}</ul>
                  </section>
                )}
                <section>
                  <h3 className={styles.heading}>成分表から（選ぶと登録食品にも追加）</h3>
                  {!mextData ? (
                    <p className={styles.empty}>成分表を読み込み中…</p>
                  ) : mextHits.length === 0 ? (
                    <p className={styles.empty}>
                      「{keyword}
                      」は見つかりませんでした。商品の値は「食品」画面の「自分で入力」で登録できます
                    </p>
                  ) : (
                    <ul className={styles.list}>{mextHits.map(row)}</ul>
                  )}
                </section>
              </div>
            ) : (
              <div className={styles.results}>
                <div
                  className={`${formStyles.tabs} ${styles.tabs4}`}
                  role="group"
                  aria-label="一覧の切り替え"
                >
                  {TABS.map((t) => (
                    <button
                      key={t.tab}
                      type="button"
                      className={formStyles.tab}
                      aria-pressed={tab === t.tab}
                      onClick={() => setTab(t.tab)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                {(() => {
                  const list =
                    tab === 'recent'
                      ? recent
                      : registered
                          .filter((c) => c.kind === tab)
                          .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
                  return list.length === 0 ? (
                    <p className={styles.empty}>
                      {tab === 'recent'
                        ? 'まだ記録がありません。上の検索欄で探すか、「食品」から選んでください'
                        : 'まだ登録されていません。上の検索欄で成分表から探して記録できます'}
                    </p>
                  ) : (
                    <ul className={`${styles.list} ${styles.tabList}`}>{list.map(row)}</ul>
                  );
                })()}
              </div>
            )}
          </>
        ) : (
          // ---- 2. 量を入れる ----
          <>
            <div className={styles.selected}>
              <span className={styles.info}>
                <span className={styles.name}>
                  {selected.name}
                  {selected.estimated && <span className={styles.badge}>見積もり</span>}
                </span>
                <span className={styles.sub}>
                  {perText(selected)} {selected.kcal}kcal
                </span>
              </span>
              <button
                type="button"
                className={styles.change}
                onClick={() => {
                  setSelected(null);
                  setError(null);
                }}
              >
                選び直す
              </button>
            </div>

            {/* 卵やパンなど、成分表（100gあたり）から選んだものは「g」と「1個」を切り替えられる */}
            {selected.mext?.piece && (
              <div className={formStyles.tabs} role="group" aria-label="量の入れ方">
                <button
                  type="button"
                  className={formStyles.tab}
                  aria-pressed={selected.unit !== 'g'}
                  onClick={() => switchMextUnit(true)}
                >
                  {selected.mext.piece.unit}で入れる
                </button>
                <button
                  type="button"
                  className={formStyles.tab}
                  aria-pressed={selected.unit === 'g'}
                  onClick={() => switchMextUnit(false)}
                >
                  gで入れる
                </button>
              </div>
            )}
            {selected.mext?.piece && selected.unit !== 'g' && (
              <p className={formStyles.hint}>
                {selected.mext.piece.note}
                として計算します。重さを変えたいときは「食品」画面で登録してください
              </p>
            )}

            <label className={formStyles.field}>
              量（{selected.unit}）
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <div className={styles.quick} role="group" aria-label="よく使う量">
              {quickAmounts(selected.unit).map((n) => (
                <button
                  key={n}
                  type="button"
                  className={styles.quickButton}
                  aria-pressed={amountNumber === n}
                  onClick={() => setAmount(String(n))}
                >
                  {n}
                  {selected.unit}
                </button>
              ))}
            </div>

            <div className={styles.preview} aria-live="polite">
              {preview ? (
                <>
                  <span className={styles.previewKcal}>{Math.round(preview.kcal)} kcal</span>
                  <span>
                    P{preview.protein} F{preview.fat} C{preview.carbs}
                  </span>
                </>
              ) : (
                <span>量を入れると栄養素を計算します</span>
              )}
            </div>
            {selected.mext && <p className={formStyles.hint}>この食品は登録食品にも追加されます</p>}
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
          {selected && (
            <button type="submit" className={formStyles.save} disabled={saving}>
              追加
            </button>
          )}
        </div>
      </form>
    </dialog>
  );
}
