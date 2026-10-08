import type { Goals, Nutrients } from '../types';
import { describeRange } from '../utils/nutrition';
import styles from './SummaryCard.module.css';

type Props = {
  totals: Nutrients;
  goals: Goals;
};

export function SummaryCard({ totals, goals }: Props) {
  // バーは目標の上限を100%として、それ以上は伸ばさない
  const kcalRatio = Math.min(totals.kcal / goals.kcal.max, 1);
  const isOver = totals.kcal > goals.kcal.max;

  const tiles = [
    { label: 'P', value: totals.protein, note: describeRange(totals.protein, goals.protein, 'g') },
    { label: 'F', value: totals.fat, note: describeRange(totals.fat, goals.fat, 'g') },
    { label: 'C', value: totals.carbs, note: '目標なし' },
  ];

  return (
    <section className={styles.card} aria-labelledby="summary-title">
      <div className={styles.head}>
        <h2 id="summary-title" className={styles.title}>
          合計
        </h2>
        <span className={styles.goal}>
          目標 {goals.kcal.min.toLocaleString()}〜{goals.kcal.max.toLocaleString()} kcal
        </span>
      </div>

      <p className={styles.kcal}>
        {Math.round(totals.kcal).toLocaleString()} <span className={styles.unit}>kcal</span>
      </p>
      <p className={styles.note}>{describeRange(totals.kcal, goals.kcal, 'kcal', 0)}</p>

      <div className={styles.bar} aria-hidden="true">
        <div
          className={isOver ? `${styles.fill} ${styles.over}` : styles.fill}
          style={{ width: `${kcalRatio * 100}%` }}
        />
      </div>

      <div className={styles.tiles}>
        {tiles.map((tile) => (
          <div key={tile.label} className={styles.tile}>
            <span className={styles.tileLabel}>{tile.label}</span>
            <span className={styles.tileValue}>{tile.value}g</span>
            <span className={styles.tileNote}>{tile.note}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
