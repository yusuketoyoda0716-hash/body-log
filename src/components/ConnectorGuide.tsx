import styles from './ConnectorGuide.module.css';

// 「コネクタ」を知らない人向けの説明と、Claude につなぐ手順
// Claude 側の画面の名前は変わることがあるので、見つけ方は少し幅をもたせて書く
export function ConnectorGuide() {
  return (
    <details className={styles.details}>
      <summary>コネクタとは？つなぎ方を見る</summary>

      <div className={styles.body}>
        <p className={styles.text}>
          <strong>コネクタ</strong>
          は、Claude にほかのアプリを「道具」としてつなぐ機能です。body-log をつなぐと、Claude
          がチャットの中で食品を調べたり、このアプリに記録したりできるようになります。
        </p>

        <h4 className={styles.heading}>つなぎ方</h4>
        <ol className={styles.steps}>
          <li>このカードの「接続用URLを発行」を押し、「URLをコピー」でコピーする</li>
          <li>
            パソコンのブラウザか Claude のデスクトップアプリで Claude を開き、「コネクタ」の画面を開く
            <span className={styles.sub}>設定（カスタマイズ）の中にあります</span>
          </li>
          <li>「追加」から「カスタムコネクタを追加」を選ぶ</li>
          <li>
            名前に「body-log」、URLにコピーしたURLを貼り付けて進む
            <span className={styles.sub}>サインインの方法を聞かれたら、サインインなしで進めます</span>
          </li>
          <li>
            チャットの入力欄の「＋」から「コネクタ」を開き、body-log がオンになっているか確認する
          </li>
        </ol>

        <ul className={styles.notes}>
          <li>無料プランでも、カスタムコネクタを1つまで追加できます</li>
          <li>パソコンで追加すれば、スマホの Claude アプリからも使えます</li>
          <li>URLを再発行したときは、Claude のコネクタを一度削除して、新しいURLで追加し直してください</li>
          <li>URLには合言葉が含まれるので、人に見せたり、チャットに貼ったりしないでください</li>
        </ul>
      </div>
    </details>
  );
}
