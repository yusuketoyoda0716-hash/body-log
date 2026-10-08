import type { Goals, Nutrients } from '../types';
import { describeRange } from '../utils/nutrition';
import styles from './SummaryCard.module.css';

// P・F・C の表示設定（1gあたりのカロリーと色）
const MACROS = [
  { key: 'protein', label: 'P', name: 'たんぱく質', kcalPerGram: 4, color: 'var(--color-protein)' },
  { key: 'fat', label: 'F', name: '脂質', kcalPerGram: 9, color: 'var(--color-fat)' },
  { key: 'carbs', label: 'C', name: '炭水化物', kcalPerGram: 4, color: 'var(--color-carbs)' },
] as const;

type Props = {
  totals: Nutrients;
  goals: Goals;
  title?: string; // 省略時は「合計」
};

export function SummaryCard({ totals, goals, title = '合計' }: Props) {
  // バー全体の長さ：目標の上限を100%として、それ以上は伸ばさない
  const fillRatio = Math.min(totals.kcal / goals.kcal.max, 1);
  const isOver = totals.kcal > goals.kcal.max;
  // 目標の下限の位置（縦線）
  const minPosition = (goals.kcal.min / goals.kcal.max) * 100;

  // P・F・C それぞれから来たカロリー
  const macroKcal = MACROS.map((m) => Math.round(totals[m.key] * m.kcalPerGram));
  const barLabel = MACROS.map((m, i) => `${m.name} ${macroKcal[i]}kcal`).join('、');

  return (
    <section className={styles.card} aria-labelledby="summary-title">
      <div className={styles.head}>
        <h2 id="summary-title" className={styles.title}>
          {title}
        </h2>
        <span className={styles.goal}>
          目標 {goals.kcal.min.toLocaleString()}〜{goals.kcal.max.toLocaleString()} kcal
        </span>
      </div>

      <p className={styles.kcal}>
        {Math.round(totals.kcal).toLocaleString()} <span className={styles.unit}>kcal</span>
      </p>
      <p className={isOver ? `${styles.note} ${styles.noteOver}` : styles.note}>
        {describeRange(totals.kcal, goals.kcal, 'kcal', 0)}
      </p>

      <div
        className={isOver ? `${styles.bar} ${styles.barOver}` : styles.bar}
        role="img"
        aria-label={`カロリーの内訳：${barLabel}`}
      >
        <div className={styles.fill} style={{ width: `${fillRatio * 100}%` }}>
          {MACROS.map((m, i) =>
            macroKcal[i] > 0 ? (
              <span
                key={m.key}
                className={styles.segment}
                style={{ flexGrow: macroKcal[i], background: m.color }}
              />
            ) : null,
          )}
        </div>
        <span className={styles.minMarker} style={{ left: `${minPosition}%` }} aria-hidden="true" />
      </div>
      <p className={styles.caption}>色はP・F・Cのカロリーの内訳、縦線は目標の下限</p>

      <div className={styles.tiles}>
        {MACROS.map((m) => (
          <div key={m.key} className={styles.tile}>
            <span className={styles.tileLabel}>
              <span className={styles.swatch} style={{ background: m.color }} aria-hidden="true" />
              {m.label}
            </span>
            <span className={styles.tileValue}>{totals[m.key]}g</span>
            <span className={styles.tileNote}>{describeRange(totals[m.key], goals[m.key], 'g')}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
