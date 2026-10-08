import { useEffect, useState } from 'react';
import { BodyGoalCard } from '../components/BodyGoalCard'; // ★
import { BodyTrendChart } from '../components/BodyTrendChart';
import { useRepository } from '../repositories/repositoryContext';
import type { BodyGoal, BodyRecord } from '../types'; // ★
import { formatDateLabel, today } from '../utils/date';
import styles from './BodyPage.module.css';

// 前回との差を「+0.3kg」「-0.5%」「±0kg」の形にする
function formatDiff(diff: number, unit: string): string {
  const rounded = Math.round(diff * 10) / 10;
  if (rounded === 0) return `±0${unit}`;
  return `${rounded > 0 ? '+' : ''}${rounded}${unit}`;
}

export function BodyPage() {
  const repository = useRepository();
  const todayString = today();

  const [records, setRecords] = useState<BodyRecord[] | null>(null);
  const [goal, setGoal] = useState<BodyGoal | null>(null); // ★
  const [date, setDate] = useState(todayString);
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    repository.getBodyRecords().then(setRecords);
  }, [repository]);

  // ★ 目標を読み込む
  useEffect(() => {
    repository.getBodyGoal().then(setGoal);
  }, [repository]);

  const existing = records?.find((r) => r.date === date);
  // ★ 最新の記録（記録は日付順に並んでいるので最後の1件）
  const latest = records && records.length > 0 ? records[records.length - 1] : undefined;

  async function handleSubmit(e: { preventDefault: () => void }) {
    e.preventDefault();
    setMessage(null);

    const w = Number(weight);
    const f = Number(bodyFat);
    if (!date) {
      setError('日付を選んでください');
      return;
    }
    if (weight === '' || !(w > 0 && w < 300)) {
      setError('体重は0〜300の数値で入力してください');
      return;
    }
    if (bodyFat === '' || !(f >= 0 && f <= 100)) {
      setError('体脂肪率は0〜100の数値で入力してください');
      return;
    }

    setError(null);
    await repository.saveBodyRecord({ date, weight: w, bodyFat: f });
    setRecords(await repository.getBodyRecords());
    setWeight('');
    setBodyFat('');
    setMessage(`${formatDateLabel(date)}の記録を保存しました`);
  }

  // ★ 目標を保存
  async function handleSaveGoal(next: BodyGoal) {
    await repository.saveBodyGoal(next);
    setGoal(next);
  }

  const history = (records ?? [])
    .map((record, i, list) => ({
      ...record,
      weightDiff: i > 0 ? record.weight - list[i - 1].weight : null,
      fatDiff: i > 0 ? record.bodyFat - list[i - 1].bodyFat : null,
    }))
    .reverse();

  return (
    <>
      <h1>体重・体脂肪率</h1>

      {/* ★ 目標カード */}
      {goal && <BodyGoalCard goal={goal} latest={latest} onSave={handleSaveGoal} />}

      <section className={styles.card} aria-labelledby="record-title">
        <h2 id="record-title" className={styles.cardTitle}>
          記録する
        </h2>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <label className={styles.field}>
            日付
            <input
              type="date"
              value={date}
              max={todayString}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>

          <div className={styles.row}>
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
          </div>

          {existing && (
            <p className={styles.hint}>
              この日はすでに記録があります（{existing.weight}kg ／ {existing.bodyFat}%）。保存すると上書きします。
            </p>
          )}
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className={styles.success} role="status">
              {message}
            </p>
          )}

          <button type="submit" className={styles.save}>
            保存
          </button>
        </form>
      </section>

      {records && <BodyTrendChart records={records} goal={goal} />}

      <section aria-labelledby="history-title">
        <h2 id="history-title" className={styles.sectionTitle}>
          履歴
        </h2>

        {records === null ? (
          <p className={styles.empty}>読み込み中…</p>
        ) : history.length === 0 ? (
          <p className={styles.empty}>まだ記録がありません</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">日付</th>
                <th scope="col">体重</th>
                <th scope="col">体脂肪率</th>
              </tr>
            </thead>
            <tbody>
              {history.map((r) => (
                <tr key={r.date}>
                  <td>{formatDateLabel(r.date)}</td>
                  <td>
                    <span className={styles.value}>{r.weight}kg</span>
                    {r.weightDiff !== null && (
                      <span className={styles.diff}>{formatDiff(r.weightDiff, 'kg')}</span>
                    )}
                  </td>
                  <td>
                    <span className={styles.value}>{r.bodyFat}%</span>
                    {r.fatDiff !== null && <span className={styles.diff}>{formatDiff(r.fatDiff, '%')}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}