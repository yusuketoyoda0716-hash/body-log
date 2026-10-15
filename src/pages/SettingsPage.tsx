import { FirebaseError } from 'firebase/app'; // ★
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/authContext'; // ★
import { ClaudeConnectCard } from '../components/ClaudeConnectCard';
import { useRepository } from '../repositories/repositoryContext';
import type { Goals } from '../types';
import styles from './SettingsPage.module.css';

const FIELDS: { key: keyof Goals; label: string; unit: string }[] = [
  { key: 'kcal', label: 'カロリー', unit: 'kcal' },
  { key: 'protein', label: 'P', unit: 'g' },
  { key: 'fat', label: 'F', unit: 'g' },
  { key: 'carbs', label: 'C', unit: 'g' },
];

type FormValues = Record<keyof Goals, { min: string; max: string }>;

function toFormValues(goals: Goals): FormValues {
  return {
    kcal: { min: String(goals.kcal.min), max: String(goals.kcal.max) },
    protein: { min: String(goals.protein.min), max: String(goals.protein.max) },
    fat: { min: String(goals.fat.min), max: String(goals.fat.max) },
    carbs: { min: String(goals.carbs.min), max: String(goals.carbs.max) },
  };
}

function validate(values: FormValues): string | null {
  for (const field of FIELDS) {
    const { min, max } = values[field.key];
    const minNum = Number(min);
    const maxNum = Number(max);
    if (min === '' || max === '' || Number.isNaN(minNum) || Number.isNaN(maxNum)) {
      return `${field.label}の下限と上限を入力してください`;
    }
    if (minNum < 0 || maxNum < 0) return `${field.label}は0以上で入力してください`;
    if (minNum > maxNum) return `${field.label}の下限が上限より大きくなっています`;
  }
  return null;
}

// ★ ポップアップを自分で閉じたなど、エラー表示が不要なケース
const IGNORED_AUTH_ERRORS = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request'];

export function SettingsPage() {
  const repository = useRepository();
  const { user, loading: authLoading, signIn, signOut } = useAuth(); // ★
  const [values, setValues] = useState<FormValues | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null); // ★

  useEffect(() => {
    repository.getGoals().then((goals) => setValues(toFormValues(goals)));
  }, [repository]);

  function update(key: keyof Goals, side: 'min' | 'max', value: string) {
    setValues((prev) => (prev ? { ...prev, [key]: { ...prev[key], [side]: value } } : prev));
    setMessage(null);
  }

  async function handleSubmit(e: { preventDefault: () => void }) {
    e.preventDefault();
    if (!values) return;
    const problem = validate(values);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    const goals: Goals = {
      kcal: { min: Number(values.kcal.min), max: Number(values.kcal.max) },
      protein: { min: Number(values.protein.min), max: Number(values.protein.max) },
      fat: { min: Number(values.fat.min), max: Number(values.fat.max) },
      carbs: { min: Number(values.carbs.min), max: Number(values.carbs.max) },
    };
    await repository.saveGoals(goals);
    setMessage('目標を保存しました');
  }

  async function handleReset() {
    if (!repository.reset) return;
    const ok = window.confirm(
      '記録・食品・目標をすべて消して、サンプルデータの状態に戻します。よろしいですか？',
    );
    if (!ok) return;
    await repository.reset();
    const goals = await repository.getGoals();
    setValues(toFormValues(goals));
    setError(null);
    setMessage(null);
    setResetMessage('サンプルデータに戻しました');
  }

  // ★ ログイン
  async function handleSignIn() {
    setAuthError(null);
    try {
      await signIn();
    } catch (e) {
      if (e instanceof FirebaseError && IGNORED_AUTH_ERRORS.includes(e.code)) return;
      setAuthError('ログインに失敗しました。時間をおいてもう一度お試しください');
    }
  }

  // ★ ログアウト
  async function handleSignOut() {
    if (!window.confirm('ログアウトしますか？')) return;
    await signOut();
  }

  return (
    <>
      <h1>設定</h1>

      {/* ★ アカウント欄：ログイン状態で表示を切り替え */}
      <section className={styles.card} aria-labelledby="account-title">
        <h2 id="account-title" className={styles.cardTitle}>
          アカウント
        </h2>

        {authLoading ? (
          <p className={styles.text}>確認中…</p>
        ) : user ? (
          <>
            <div className={styles.userRow}>
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt=""
                  width={48}
                  height={48}
                  className={styles.avatar}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className={styles.avatarFallback} aria-hidden="true">
                  {(user.displayName ?? '?').charAt(0)}
                </span>
              )}
              <div className={styles.user}>
                <span className={styles.userName}>{user.displayName ?? 'ログイン中'}</span>
                <span className={styles.text}>{user.email}</span>
              </div>
            </div>
            <p className={styles.text}>データはアカウントに保存され、他の端末と同期されます</p>
            <button type="button" className={styles.outline} onClick={handleSignOut}>
              ログアウト
            </button>
          </>
        ) : (
          <>
            <p className={styles.text}>ゲストモードで利用中（データはこのブラウザ内に保存されます）</p>
            {authError && (
              <p className={styles.error} role="alert">
                {authError}
              </p>
            )}
            <button type="button" className={styles.outline} onClick={handleSignIn}>
              Googleでログイン
            </button>
          </>
        )}
      </section>

      <ClaudeConnectCard />

      <section className={styles.card} aria-labelledby="goals-title">
        <h2 id="goals-title" className={styles.cardTitle}>
          1日の目標
        </h2>

        {values === null ? (
          <p className={styles.text}>読み込み中…</p>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <div className={`${styles.grid} ${styles.gridHead}`} aria-hidden="true">
              <span>項目</span>
              <span>下限</span>
              <span />
              <span>上限</span>
              <span />
            </div>

            {FIELDS.map((field) => (
              <div key={field.key} className={styles.grid}>
                <span className={styles.fieldLabel}>{field.label}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  aria-label={`${field.label} 下限（${field.unit}）`}
                  value={values[field.key].min}
                  onChange={(e) => update(field.key, 'min', e.target.value)}
                />
                <span className={styles.tilde}>〜</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  aria-label={`${field.label} 上限（${field.unit}）`}
                  value={values[field.key].max}
                  onChange={(e) => update(field.key, 'max', e.target.value)}
                />
                <span className={styles.unit}>{field.unit}</span>
              </div>
            ))}

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
              目標を保存
            </button>
          </form>
        )}
      </section>

      {repository.reset && (
        <section className={styles.card} aria-labelledby="data-title">
          <h2 id="data-title" className={styles.cardTitle}>
            データ
          </h2>
          <p className={styles.text}>
            このブラウザに保存した記録・食品・目標をすべて消して、最初の状態に戻します。
          </p>
          {resetMessage && (
            <p className={styles.success} role="status">
              {resetMessage}
            </p>
          )}
          <button type="button" className={styles.danger} onClick={handleReset}>
            サンプルデータに戻す
          </button>
        </section>
      )}
    </>
  );
}
