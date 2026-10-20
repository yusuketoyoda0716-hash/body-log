import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/authContext';
import type { McpConnection } from '../lib/mcpToken';
import { copyText } from '../utils/clipboard';
import { ClaudePromptGuide } from './ClaudePromptGuide';
import { ConnectorGuide } from './ConnectorGuide';
import styles from './ClaudeConnectCard.module.css';

// Firestore を使うので、ログインしているときに初めて読み込む
const loadMcpToken = () => import('../lib/mcpToken');

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function ClaudeConnectCard() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  // undefined = 読み込み中 / null = 未連携 / McpConnection = 連携中
  const [connection, setConnection] = useState<McpConnection | null | undefined>(undefined);
  // 発行した直後だけ表示する接続用URL
  const [newUrl, setNewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // 'done' = コピーできた / 'failed' = 自動でコピーできなかった（手でコピーしてもらう）
  const [copyState, setCopyState] = useState<'idle' | 'done' | 'failed'>('idle');
  const urlInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    let ignore = false;
    loadMcpToken()
      .then((m) => m.getMcpConnection(uid))
      .then((c) => {
        if (!ignore) setConnection(c);
      })
      .catch(() => {
        if (!ignore) setError('連携の状態を読み込めませんでした');
      });
    return () => {
      ignore = true;
    };
  }, [uid]);

  async function handleIssue() {
    if (!uid) return;
    if (connection && !window.confirm('今の接続用URLは使えなくなります。新しく発行しますか？')) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const m = await loadMcpToken();
      const token = await m.issueMcpToken(uid);
      setNewUrl(`${window.location.origin}/api/mcp?token=${token}`);
      setConnection(await m.getMcpConnection(uid));
      setCopyState('idle');
    } catch {
      setError('発行できませんでした。時間をおいてもう一度お試しください');
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke() {
    if (!uid) return;
    if (!window.confirm('連携を解除しますか？Claudeから記録できなくなります')) return;
    setBusy(true);
    setError(null);
    try {
      const m = await loadMcpToken();
      await m.revokeMcpToken(uid);
      setConnection(null);
      setNewUrl(null);
    } catch {
      setError('解除できませんでした。時間をおいてもう一度お試しください');
    } finally {
      setBusy(false);
    }
  }

  // URLをコピーする（できなければ、URLを選択した状態にして手でコピーしてもらう）
  async function handleCopy() {
    if (!newUrl) return;
    const ok = await copyText(newUrl, urlInputRef.current);
    setCopyState(ok ? 'done' : 'failed');
  }

  return (
    <section className={styles.card} aria-labelledby="claude-title">
      <h2 id="claude-title" className={styles.cardTitle}>
        {/* AIで記録することを表すアイコン（きらめき） */}
        <span className={styles.titleIcon} aria-hidden="true">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
          >
            {/* 大きいきらめき */}
            <path d="M10 3.5c.6 3.6 2.4 5.4 6 6-3.6.6-5.4 2.4-6 6-.6-3.6-2.4-5.4-6-6 3.6-.6 5.4-2.4 6-6z" />
            {/* 小さいきらめき */}
            <path d="M18 14c.3 1.8 1.2 2.7 3 3-1.8.3-2.7 1.2-3 3-.3-1.8-1.2-2.7-3-3 1.8-.3 2.7-1.2 3-3z" />
          </svg>
        </span>
        Claude連携
      </h2>
      <p className={styles.text}>
        Claudeのチャットで食べたものを伝えると、成分表で計算してこのアプリに記録されます。
      </p>
      <ConnectorGuide />

      {!uid ? (
        <p className={styles.text}>Googleでログインすると使えます。</p>
      ) : connection === undefined && !error ? (
        <p className={styles.text}>確認中…</p>
      ) : (
        <>
          <p className={styles.status}>
            {connection ? (
              <>
                <span className={styles.connected}>連携中</span>
                <span className={styles.text}>発行日時：{formatDateTime(connection.createdAt)}</span>
              </>
            ) : (
              <span className={styles.text}>未連携</span>
            )}
          </p>

          {newUrl && (
            <div className={styles.urlBox}>
              <label className={styles.field}>
                接続用URL（この画面を離れると二度と表示されません）
                <input
                  ref={urlInputRef}
                  type="text"
                  readOnly
                  value={newUrl}
                  onFocus={(e) => e.target.select()}
                />
              </label>
              <button type="button" className={styles.primary} onClick={handleCopy}>
                {copyState === 'done' ? 'コピーしました' : 'URLをコピー'}
              </button>
              {copyState === 'failed' && (
                <p className={styles.error} role="alert">
                  自動でコピーできませんでした。URLを選択した状態にしたので、長押し（PCは Ctrl+C）でコピーしてください
                </p>
              )}
              <p className={styles.note}>
                Claudeの「コネクタ」で、カスタムコネクタのURLとして貼り付けてください（手順は上の「コネクタとは？つなぎ方を見る」）。
                URLに合言葉が含まれるので、他の人には見せないでください。
              </p>
            </div>
          )}

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          <div className={styles.actions}>
            <button type="button" className={styles.outline} onClick={handleIssue} disabled={busy}>
              {connection ? '接続用URLを再発行' : '接続用URLを発行'}
            </button>
            {connection && (
              <button type="button" className={styles.danger} onClick={handleRevoke} disabled={busy}>
                連携を解除
              </button>
            )}
          </div>

          <ClaudePromptGuide />
        </>
      )}
    </section>
  );
}
