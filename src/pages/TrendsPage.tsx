import { useEffect, useState } from 'react';
import { CalorieBarChart } from '../components/CalorieBarChart'; // ★
import { SummaryCard } from '../components/SummaryCard';
import { useRepository } from '../repositories/repositoryContext';
import type { Goals, MealEntry } from '../types';
import { lastNDays, today } from '../utils/date';
import { averageNutrients, dailyTotals } from '../utils/nutrition';
import styles from './TrendsPage.module.css';

const PERIODS = [
  { days: 7, label: '7日' },
  { days: 30, label: '30日' },
] as const;

type PeriodDays = (typeof PERIODS)[number]['days'];

export function TrendsPage() {
  const repository = useRepository();
  const [periodDays, setPeriodDays] = useState<PeriodDays>(7);
  const [goals, setGoals] = useState<Goals | null>(null);

  const dates = lastNDays(today(), periodDays);
  const from = dates[0];
  const to = dates[dates.length - 1];

  const [loaded, setLoaded] = useState<{ from: string; entries: MealEntry[] } | null>(null);

  useEffect(() => {
    let ignore = false;
    repository.getEntriesInRange(from, to).then((entries) => {
      if (!ignore) setLoaded({ from, entries });
    });
    return () => {
      ignore = true;
    };
  }, [repository, from, to]);

  useEffect(() => {
    repository.getGoals().then(setGoals);
  }, [repository]);

  const entries = loaded?.from === from ? loaded.entries : null;

  const days = entries ? dailyTotals(entries, dates) : [];
  const recordedDays = days.flatMap((day) => (day.totals ? [day.totals] : []));
  const average = averageNutrients(recordedDays);

  return (
    <>
      <div className={styles.header}>
        <h1>推移</h1>
        <div className={styles.toggle} role="group" aria-label="期間">
          {PERIODS.map((p) => (
            <button
              key={p.days}
              type="button"
              aria-pressed={periodDays === p.days}
              className={periodDays === p.days ? `${styles.toggleButton} ${styles.active}` : styles.toggleButton}
              onClick={() => setPeriodDays(p.days)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {entries === null || goals === null ? (
        <p className={styles.empty}>読み込み中…</p>
      ) : average === null ? (
        <p className={styles.empty}>この期間の食事記録がありません</p>
      ) : (
        <>
          <SummaryCard
            totals={average}
            goals={goals}
            title={`1日平均（直近${periodDays}日のうち記録${recordedDays.length}日分）`}
          />
          {/* ★ 日別カロリー */}
          <CalorieBarChart days={days} goals={goals} />
        </>
      )}
    </>
  );
}
