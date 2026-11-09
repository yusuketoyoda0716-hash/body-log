import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { MealEntryDialog } from '../components/MealEntryDialog';
import { SummaryCard } from '../components/SummaryCard';
import { MEAL_TYPES } from '../constants/meals';
import { useRepository } from '../repositories/repositoryContext';
import { useTutorial } from '../tutorial/tutorialContext';
import type { Food, Goals, MealEntry, MealType, Recipe } from '../types';
import { addDays, formatDateLabel, isDateString, today } from '../utils/date';
import { groupEntriesByShop, menuName } from '../utils/entryGroups';
import { sumNutrients } from '../utils/nutrition';
import styles from './TodayPage.module.css';

export function TodayPage() {
  const repository = useRepository();
  const tutorial = useTutorial();

  // 表示中の日付は URL（?date=2026-10-07）で持つ。なければ今日
  const [searchParams, setSearchParams] = useSearchParams();
  const todayString = today();
  const param = searchParams.get('date');
  const date = param && isDateString(param) ? param : todayString;
  const isToday = date === todayString;

  // 読み込んだ記録を「どの日付の分か」とセットで持つ
  const [loaded, setLoaded] = useState<{ date: string; entries: MealEntry[] } | null>(null);
  const [foods, setFoods] = useState<Food[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [addingMeal, setAddingMeal] = useState<MealType | null>(null);
  const [goals, setGoals] = useState<Goals | null>(null);
  // 開いている「お店ごとのまとまり」（'dinner:はま寿司' のように食事区分と店名で持つ）
  const [openShops, setOpenShops] = useState<Set<string>>(new Set());
  // 最近記録したもの（記録の画面の「最近使ったもの」に出す。新しい順の食品・レシピのID）
  const [recentIds, setRecentIds] = useState<string[]>([]);

  // その日の記録を読み込む
  useEffect(() => {
    let ignore = false;
    repository.getEntriesByDate(date).then((entries) => {
      if (!ignore) setLoaded({ date, entries });
    });
    return () => {
      ignore = true;
    };
  }, [repository, date]);

  // 登録食品とレシピを読み込む
  useEffect(() => {
    repository.getFoods().then(setFoods);
    repository.getRecipes().then(setRecipes);
  }, [repository]);

  // 直近30日の記録から、最近使った食品・レシピを新しい順に並べる（同じものは1回だけ）
  useEffect(() => {
    let ignore = false;
    const end = today();
    repository.getEntriesInRange(addDays(end, -30), end).then((recentEntries) => {
      if (ignore) return;
      const ids = [...recentEntries]
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((entry) => entry.foodId)
        .filter((id) => id !== 'custom');
      setRecentIds([...new Set(ids)]);
    });
    return () => {
      ignore = true;
    };
  }, [repository, loaded]);

  // 目標を読み込む
  useEffect(() => {
    repository.getGoals().then(setGoals);
  }, [repository]);

  // 表示中の日付の分が読み込めていなければ「読み込み中」
  const entries = loaded?.date === date ? loaded.entries : null;
  // 量や値を見積もった記録（外食・写真から見積もったものなど）
  const estimatedEntries = entries?.filter((entry) => entry.estimated) ?? [];
  // チュートリアルの「記録を直す」で光らせる記録（チュートリアルで追加したもの。なければ最初の記録）
  const tourEntryId =
    entries?.find((entry) => entry.id === tutorial.lastEntryId)?.id ?? entries?.[0]?.id ?? null;

  function changeDate(next: string) {
    setSearchParams(next === todayString ? {} : { date: next });
  }

  function toggleShop(key: string) {
    setOpenShops((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // お店でまとめて注文したもの → まとめて保存して、そのまとまりを開いた状態にする
  async function handleAddEntries(list: MealEntry[], shop: string) {
    if (list.length === 0) return;
    await repository.saveEntries(list);
    const { date: entryDate, mealType } = list[0];
    setLoaded({ date: entryDate, entries: await repository.getEntriesByDate(entryDate) });
    setOpenShops((prev) => new Set(prev).add(`${mealType}:${shop}`));
    setAddingMeal(null);
  }

  // 追加 → その日の記録を読み直す → ダイアログを閉じる
  async function handleAddEntry(entry: MealEntry) {
    await repository.saveEntry(entry);
    const nextEntries = await repository.getEntriesByDate(entry.date);
    setLoaded({ date: entry.date, entries: nextEntries });
    setAddingMeal(null);
    tutorial.notify('entry-added', entry.id);
  }

  // 記録の画面で成分表から選んだ食品を、登録食品にも追加する
  async function handleRegisterFood(food: Food) {
    await repository.saveFood(food);
    setFoods(await repository.getFoods());
  }

  function openAddDialog(type: MealType) {
    setAddingMeal(type);
    tutorial.notify('entry-dialog-opened');
  }

  // キャンセルなどで閉じたとき
  function closeAddDialog() {
    setAddingMeal(null);
    tutorial.notify('dialog-closed');
  }

  // 削除（確認してから）→ その日の記録を読み直す
  async function handleDeleteEntry(entry: MealEntry) {
    const label = `${entry.foodName} ${entry.amount}${entry.unit}`;
    if (!window.confirm(`「${label}」を削除しますか？`)) return;
    await repository.deleteEntry(entry.id);
    const nextEntries = await repository.getEntriesByDate(entry.date);
    setLoaded({ date: entry.date, entries: nextEntries });
    tutorial.notify('entry-deleted');
  }

  // 記録の1行（名前・量・カロリーと削除ボタン）
  const entryItem = (entry: MealEntry, name: string) => (
    <li key={entry.id} className={styles.entry}>
      <span className={styles.entryName}>
        {name} {entry.amount}
        {entry.unit}
        {entry.estimated && <span className={styles.estimated}>見積もり</span>}
      </span>
      <span className={styles.entryRight}>
        <span className={styles.entryKcal}>{Math.round(entry.kcal)} kcal</span>
        <button
          type="button"
          className={styles.deleteButton}
          aria-label={`${entry.foodName}を削除`}
          data-tour={entry.id === tourEntryId ? 'entry-delete' : undefined}
          onClick={() => handleDeleteEntry(entry)}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </span>
    </li>
  );

  const addingLabel = MEAL_TYPES.find((m) => m.type === addingMeal)?.label ?? '';

  return (
    <>
      <div className={styles.dateNav} data-tour="date-nav">
        <button
          type="button"
          className={styles.navButton}
          aria-label="前の日"
          onClick={() => changeDate(addDays(date, -1))}
        >
          ‹
        </button>

        <div className={styles.dateCenter}>
          <h1 className={styles.dateLabel}>{formatDateLabel(date)}</h1>
          {isToday ? (
            <span className={styles.todayBadge}>今日</span>
          ) : (
            <button
              type="button"
              className={styles.backToday}
              onClick={() => changeDate(todayString)}
            >
              今日に戻る
            </button>
          )}
        </div>

        <button
          type="button"
          className={styles.navButton}
          aria-label="次の日"
          onClick={() => changeDate(addDays(date, 1))}
          disabled={isToday}
        >
          ›
        </button>
      </div>

      {entries && goals && (
        <div data-tour="summary">
          <SummaryCard totals={sumNutrients(entries)} goals={goals} />
          {estimatedEntries.length > 0 && (
            <p className={styles.estimatedNote}>
              うち見積もり {Math.round(sumNutrients(estimatedEntries).kcal)} kcal（
              {estimatedEntries.length}
              件）。外食や写真から見積もった値は、実際と差が出ることがあります
            </p>
          )}
        </div>
      )}

      {entries === null ? (
        <p className={styles.empty}>読み込み中…</p>
      ) : (
        <div className={styles.meals}>
          {MEAL_TYPES.map(({ type, label }) => {
            const items = entries.filter((entry) => entry.mealType === type);
            const kcal = items.reduce((sum, entry) => sum + entry.kcal, 0);

            return (
              <section key={type} className={styles.meal}>
                <div className={styles.mealHeader}>
                  <h2 className={styles.mealTitle}>{label}</h2>
                  <div className={styles.mealActions}>
                    <span className={styles.mealKcal}>{Math.round(kcal)} kcal</span>
                    <button
                      type="button"
                      className={styles.addEntryButton}
                      aria-label={`${label}に追加`}
                      data-tour={`add-${type}`}
                      onClick={() => openAddDialog(type)}
                    >
                      ＋
                    </button>
                  </div>
                </div>

                {items.length === 0 ? (
                  <p className={styles.empty}>記録なし</p>
                ) : (
                  <ul className={styles.entryList}>
                    {groupEntriesByShop(items, foods).map((row) => {
                      if (row.type === 'entry') return entryItem(row.entry, row.entry.foodName);
                      const key = `${type}:${row.shop}`;
                      // チュートリアルで光らせる記録が中にあれば、開いておく
                      const open =
                        openShops.has(key) || row.entries.some((e) => e.id === tourEntryId);
                      const estimated = row.entries.some((e) => e.estimated);
                      return (
                        <li key={key} className={styles.shopGroup}>
                          <button
                            type="button"
                            className={styles.shopHeader}
                            aria-expanded={open}
                            onClick={() => toggleShop(key)}
                          >
                            <span className={styles.entryName}>
                              {row.shop}
                              <span className={styles.shopCount}>{row.entries.length}品</span>
                              {estimated && <span className={styles.estimated}>見積もり</span>}
                            </span>
                            <span className={styles.entryRight}>
                              <span className={styles.entryKcal}>
                                {Math.round(row.total.kcal)} kcal
                              </span>
                              <span className={styles.chevron} aria-hidden="true">
                                ›
                              </span>
                            </span>
                          </button>
                          {open && (
                            <ul className={styles.shopItems}>
                              {row.entries.map((e) => entryItem(e, menuName(e, row.shop)))}
                            </ul>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      {addingMeal && (
        <MealEntryDialog
          date={date}
          mealType={addingMeal}
          mealLabel={addingLabel}
          foods={foods}
          recipes={recipes}
          recentIds={recentIds}
          onSave={handleAddEntry}
          onSaveMany={handleAddEntries}
          onRegisterFood={handleRegisterFood}
          onClose={closeAddDialog}
        />
      )}
    </>
  );
}
