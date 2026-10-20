import { useRef, useState } from 'react';
import { CLAUDE_PROMPT } from '../constants/claudePrompt';
import { copyText } from '../utils/clipboard';
import styles from './ClaudePromptGuide.module.css';

// Claude で記録を始めるまでの手順と、コピーして使うプロンプト
export function ClaudePromptGuide() {
  const [copyState, setCopyState] = useState<'idle' | 'done' | 'failed'>('idle');
  const promptRef = useRef<HTMLTextAreaElement>(null);

  async function handleCopy() {
    const ok = await copyText(CLAUDE_PROMPT, promptRef.current);
    setCopyState(ok ? 'done' : 'failed');
  }

  return (
    <div className={styles.guide}>
      <h3 className={styles.title}>Claudeで記録を始める</h3>
      <ol className={styles.steps}>
        <li>上の「接続用URLを発行」でURLをコピーし、Claudeの「コネクタ」でカスタムコネクタとして追加する（手順は「コネクタとは？つなぎ方を見る」）</li>
        <li>Claudeで新しい「プロジェクト」を作る（名前の例：食事記録）</li>
        <li>下の「プロンプトをコピー」を押し、プロジェクトの指示（カスタム指示）に貼り付けて保存する</li>
        <li>プロジェクトの中でチャットを1つ作り、body-log のコネクタがオンになっているか確認する</li>
        <li>
          食べたものを送るだけで記録されます
          <span className={styles.example}>例：「昼 鶏むね肉200g ごはん150g」「昨日の夜 豚汁2杯」</span>
        </li>
        <li>
          料理やパッケージの写真を送っても記録できます
          <span className={styles.example}>
            料理の写真は量を見積もって一覧を見せてくれるので、確認してから記録されます。栄養成分表示の写真なら、その値で登録・記録されます
          </span>
        </li>
      </ol>
      <p className={styles.note}>
        ふだんは同じチャットで続けて使えます。チャットが長くなったら、同じプロジェクトで新しいチャットを開けば、同じルールのまま続きから記録できます。プロジェクトを使わない場合は、チャットの最初にプロンプトを貼ってください。
      </p>

      <details className={styles.details}>
        <summary>プロンプトの内容を見る</summary>
        <textarea
          ref={promptRef}
          className={styles.prompt}
          readOnly
          value={CLAUDE_PROMPT}
          rows={12}
          aria-label="Claude用のプロンプト"
        />
      </details>

      <button type="button" className={styles.copy} onClick={handleCopy}>
        {copyState === 'done' ? 'コピーしました' : 'プロンプトをコピー'}
      </button>
      {copyState === 'failed' && (
        <p className={styles.error} role="alert">
          自動でコピーできませんでした。「プロンプトの内容を見る」を開き、文章を選択してコピーしてください
        </p>
      )}
    </div>
  );
}
