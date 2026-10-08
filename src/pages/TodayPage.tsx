import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { MealEntryDialog } from '../components/MealEntryDialog'; // ★
import { MEAL_TYPES } from '../constants/meals';
import { useRepository } from '../repositories/repositoryContext';
import type { Food, MealEntry, MealType } from '../types'; // ★
import { addDays, formatDateLabel, isDateString, today } from '../utils/date';
import styles from './TodayPage.module.css';

export function TodayPage() {
  const repository = useRepository();

  const [searchParams, setSearchParams] = useSearchParams();
  const todayString = today();
  const param = searchParams.get('date');
  const date = param && isDateString(param) ? param : todayString;
  const isToday = date === todayString;

  const [loaded, setLoaded] = useState<{ date: string; entries: MealEntry[] } | null>(null);
  const [foods, setFoods] = useState<Food[]>([]); // ★ ダイアログで選ぶ食品
  const [addingMeal, setAddingMeal] = useState<MealType | null>(null); // ★ どの区分に追加中か

  useEffect(() => {
    let ignore = false;
    repository.getEntriesByDate(date).then((entries) => {
      if (!ignore) setLoaded({ date, entries });
    });
    return () => {
      ignore = true;
    };
  }, [repository, date]);

  // ★ 登録食品を読み込む
  useEffect(() => {
    repository.getFoods().then(setFoods);
  }, [repository]);

  const entries = loaded?.date === date ? loaded.entries : null;

  function changeDate(next: string) {
    setSearchParams(next === todayString ? {} : { date: next });
  }

  // ★ 追加 → その日の記録を読み直す → ダイアログを閉じる
  async function handleAddEntry(entry: MealEntry) {
    await repository.saveEntry(entry);
    const nextEntries = await repository.getEntriesByDate(entry.date);
    setLoaded({ date: entry.date, entries: nextEntries });
    setAddingMeal(null);
  }

  const addingLabel = MEAL_TYPES.find((m) => m.type === addingMeal)?.label ?? '';

  return (
    <>
      <div className={styles.dateNav}>
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
            <button type="button" className={styles.backToday} onClick={() => changeDate(todayString)}>
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
                  {/* ★ kcal の横に追加ボタン */}
                  <div className={styles.mealActions}>
                    <span className={styles.mealKcal}>{Math.round(kcal)} kcal</span>
                    <button
                      type="button"
                      className={styles.addEntryButton}
                      aria-label={`${label}に追加`}
                      onClick={() => setAddingMeal(type)}
                    >
                      ＋
                    </button>
                  </div>
                </div>

                {items.length === 0 ? (
                  <p className={styles.empty}>記録なし</p>
                ) : (
                  <ul className={styles.entryList}>
                    {items.map((entry) => (
                      <li key={entry.id} className={styles.entry}>
                        <span className={styles.entryName}>
                          {entry.foodName} {entry.amount}
                          {entry.unit}
                        </span>
                        <span className={styles.entryKcal}>{Math.round(entry.kcal)} kcal</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* ★ 追加ダイアログ */}
      {addingMeal && (
        <MealEntryDialog
          date={date}
          mealType={addingMeal}
          mealLabel={addingLabel}
          foods={foods}
          onSave={handleAddEntry}
          onClose={() => setAddingMeal(null)}
        />
      )}
    </>
  );
}