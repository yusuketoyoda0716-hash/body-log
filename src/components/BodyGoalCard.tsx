import { useState } from 'react';
import type { BodyGoal, BodyRecord } from '../types';
import { daysBetween, formatDateLabel, today } from '../utils/date';
import styles from './BodyGoalCard.module.css';

type Props = {
  goal: BodyGoal;
  latest?: BodyRecord; // 最新の記録（まだなければ undefined）
  onSave: (goal: BodyGoal) => Promise<void>;
};

// 目標までの残りを文章にする（減らす目標を前提）
function remaining(current: number | undefined, target: number | null, unit: string): string {
  if (target === null) return '目標未設定';
  if (current === undefined) return '記録なし';
  const diff = Math.round((current - target) * 10) / 10;
  return diff > 0 ? `あと${diff}${unit}` : '達成！';
}

// 入力欄用の変換（null ⇔ 空文字）
const toInput = (n: number | null) => (n === null ? '' : String(n));
const toNumberOrNull = (s: string) => (s.trim() === '' ? null : Number(s));

export function BodyGoalCard({ goal, latest, onSave }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [bodyFat, setBodyFat] = useState('');
  const [weight, setWeight] = useState('');
  const [deadline, setDeadline] = useState('');
  const [error, setError] = useState<string | null>(null);

  // 編集を始めるときに、今の目標を入力欄に入れる
  function startEdit() {
    setBodyFat(toInput(goal.bodyFat));
    setWeight(toInput(goal.weight));
    setDeadline(goal.deadline ?? '');
    setError(null);
    setIsEditing(true);
  }

  async function handleSubmit(e: { preventDefault: () => void }) {
    e.preventDefault();
    const f = toNumberOrNull(bodyFat);
    const w = toNumberOrNull(weight);
    if (f !== null && !(f >= 0 && f <= 100)) {
      setError('体脂肪率は0〜100で入力してください（空欄なら未設定）');
      return;
    }
    if (w !== null && !(w > 0 && w < 300)) {
      setError('体重は0〜300で入力してください（空欄なら未設定）');
      return;
    }
    await onSave({ bodyFat: f, weight: w, deadline: deadline || null });
    setIsEditing(false);
  }

  // ---- 編集モード ----
  if (isEditing) {
    return (
      <section className={styles.card} aria-labelledby="goal-title">
        <h2 id="goal-title" className={styles.title}>
          目標を編集
        </h2>
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.row}>
            <label className={styles.field}>
              体脂肪率 (%)
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.1"
                value={bodyFat}
                onChange={(e) => setBodyFat(e.target.value)}
              />
            </label>
            <label className={styles.field}>
              体重 (kg)
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </label>
          </div>
          <label className={styles.field}>
            期限
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </label>
          <p className={styles.hint}>空欄の項目は「未設定」になります</p>

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          <div className={styles.actions}>
            <button type="button" className={styles.cancel} onClick={() => setIsEditing(false)}>
              キャンセル
            </button>
            <button type="submit" className={styles.save}>
              保存
            </button>
          </div>
        </form>
      </section>
    );
  }

  // ---- 表示モード ----
  let deadlineText = '期限なし';
  if (goal.deadline) {
    const daysLeft = daysBetween(today(), goal.deadline);
    const left = daysLeft >= 0 ? `残り${daysLeft}日` : `${-daysLeft}日超過`;
    deadlineText = `期限 ${formatDateLabel(goal.deadline)}・${left}`;
  }

  const tiles = [
    {
      label: '体脂肪率',
      current: latest ? `${latest.bodyFat}%` : '—',
      target: goal.bodyFat !== null ? `${goal.bodyFat}%` : '—',
      note: remaining(latest?.bodyFat, goal.bodyFat, '%'),
    },
    {
      label: '体重',
      current: latest ? `${latest.weight}kg` : '—',
      target: goal.weight !== null ? `${goal.weight}kg` : '—',
      note: remaining(latest?.weight, goal.weight, 'kg'),
    },
  ];

  return (
    <section className={styles.card} aria-labelledby="goal-title">
      <div className={styles.head}>
        <h2 id="goal-title" className={styles.title}>
          目標
        </h2>
        <button type="button" className={styles.edit} onClick={startEdit}>
          編集
        </button>
      </div>

      <div className={styles.tiles}>
        {tiles.map((tile) => (
          <div key={tile.label} className={styles.tile}>
            <span className={styles.label}>{tile.label}</span>
            <span className={styles.value}>
              {tile.current} → {tile.target}
            </span>
            <span className={styles.note}>{tile.note}</span>
          </div>
        ))}
      </div>

      <p className={styles.deadline}>{deadlineText}</p>
    </section>
  );
}
