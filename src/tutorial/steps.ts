import { mealTypeNow } from '../constants/meals';

// 画面の操作で次へ進むきっかけ（各画面から notify で知らせてもらう）
export type TutorialEvent =
  | 'food-dialog-opened'
  | 'food-saved'
  | 'entry-dialog-opened'
  | 'entry-added'
  | 'entry-deleted'
  | 'dialog-closed';

// 案内を出すダイアログ（ダイアログは画面のいちばん上に重なるので、案内はダイアログの中に出す）
export type TutorialDialog = 'food' | 'entry';

export type ChapterId = 'start' | 'foods' | 'record' | 'fix' | 'body' | 'claude' | 'end';

export type TutorialStep = {
  chapter: ChapterId;
  route?: string; // この画面を開いてから案内する
  target?: string | (() => string); // 光らせる要素の data-tour。なければ画面の真ん中に案内だけ出す
  title: string;
  body: string;
  waitFor?: TutorialEvent; // この操作をしたら次へ進む（なければ「次へ」ボタンで進む）
  inDialog?: TutorialDialog; // ダイアログの中に案内を出すステップ
};

// 設定画面から、章ごとに見直せるようにする
export const CHAPTERS: { id: ChapterId; label: string }[] = [
  { id: 'foods', label: '食品を登録する' },
  { id: 'record', label: '食事を記録する' },
  { id: 'fix', label: '記録を直す' },
  { id: 'body', label: '体重と推移' },
  { id: 'claude', label: 'Claude連携' },
];

export const STEPS: TutorialStep[] = [
  {
    chapter: 'start',
    title: 'body-log へようこそ',
    body: '食べたもののカロリーとPFC、体重を記録するアプリです。実際に操作しながら、使い方を1分ほどで紹介します。',
  },

  // ---- 食品を登録する ----
  {
    chapter: 'foods',
    route: '/foods',
    target: 'foods-add',
    title: 'よく食べる食品を登録する',
    body: 'まず食品を登録します。「＋ 追加」を押してください。',
    waitFor: 'food-dialog-opened',
  },
  {
    chapter: 'foods',
    route: '/foods',
    inDialog: 'food',
    title: '成分表から探す',
    body: '「鶏むね」「ごはん」のように検索して候補をタップし、「保存」を押してください。成分表にない市販品は「自分で入力」でパッケージの値を入れられます。',
    waitFor: 'food-saved',
  },
  {
    chapter: 'foods',
    route: '/foods',
    target: 'foods-tabs',
    title: '外食とレシピも登録できる',
    body: '「外食」ではよく行くお店のメニューを店ごとにまとめられ、「レシピ」では材料と何食分かを入れると1食あたりを自動で計算します。登録したものをタップすると「今日の食事に追加」からすぐ記録できます。',
  },

  // ---- 食事を記録する ----
  {
    chapter: 'record',
    route: '/',
    target: () => `add-${mealTypeNow()}`,
    title: '食べたものを記録する',
    body: '今の時間の食事の「＋」を押してください。',
    waitFor: 'entry-dialog-opened',
  },
  {
    chapter: 'record',
    route: '/',
    inDialog: 'entry',
    title: '食品と量を選ぶ',
    body: '食品を選んで量を入れ、「追加」を押してください。カロリーとPFCは自動で計算されます。',
    waitFor: 'entry-added',
  },
  {
    chapter: 'record',
    route: '/',
    target: 'summary',
    title: '目標との差を見る',
    body: '1日の合計と、目標まであとどれくらいかがここに出ます。目標は「設定」で変えられます。',
  },

  // ---- 記録を直す ----
  {
    chapter: 'fix',
    route: '/',
    target: 'entry-delete',
    title: '間違えたら消して記録し直す',
    body: '量や食品を間違えたときは、× で消してから「＋」で記録し直します。さっき追加した記録を消してみましょう。',
    waitFor: 'entry-deleted',
  },
  {
    chapter: 'fix',
    route: '/',
    target: 'date-nav',
    title: '過去の日も直せる',
    body: '「‹」で日付を戻すと、前の日の記録も同じように直せます。記録し忘れた日も、日付を戻してから「＋」で追加できます。1日は午前3時で切り替わります。',
  },

  // ---- 体重と推移 ----
  {
    chapter: 'body',
    route: '/body',
    title: '体重を記録する',
    body: '体重と体脂肪率を1日1回記録します。目標を決めておくと、あとどれくらいかが分かります。',
  },
  {
    chapter: 'body',
    route: '/trends',
    title: '推移を見る',
    body: '1週間の平均カロリーやPFC、体重の変化をグラフで確認できます。',
  },

  // ---- Claude連携 ----
  {
    chapter: 'claude',
    route: '/settings',
    target: 'claude-card',
    title: 'Claudeとつなぐ「コネクタ」',
    body: 'コネクタは、Claude にほかのアプリを「道具」としてつなぐ機能です。ここで発行したURLを Claude のコネクタに追加すると、Claude がこのアプリに記録できるようになります。つなぎ方は「コネクタとは？つなぎ方を見る」にまとめています。',
  },
  {
    chapter: 'claude',
    route: '/settings',
    target: 'claude-card',
    title: 'Claudeのチャットで記録する',
    body: 'つないだあとは「昼に鶏むね200gとごはん150g」のように送るだけで記録できます。料理やパッケージの写真を送っても、量を見積もって確認してから記録してくれます（Googleでログインすると使えます）。',
  },
  {
    chapter: 'claude',
    route: '/settings',
    target: 'claude-card',
    title: 'チャットで直す',
    body: '間違えたときも、Claudeに「さっきのごはんを消して」「量は200gだった」と伝えれば直してくれます。',
  },

  // ---- おわり ----
  {
    chapter: 'end',
    route: '/settings',
    target: 'tutorial-card',
    title: 'いつでも見直せます',
    body: 'このチュートリアルは「設定」の「使い方」から、最初からでも章ごとでも見直せます。',
  },
];

// スキップしたときに出すお知らせ
export const SKIPPED_STEP: TutorialStep = {
  chapter: 'end',
  title: 'チュートリアルをスキップしました',
  body: '「設定」の「使い方」から、いつでも見直せます。',
};

// 章を指定したときは、その章のステップだけ。指定がなければ全部
export function stepsFor(chapter?: ChapterId): TutorialStep[] {
  return chapter ? STEPS.filter((step) => step.chapter === chapter) : STEPS;
}

export function targetOf(step: TutorialStep): string | null {
  if (!step.target) return null;
  return typeof step.target === 'function' ? step.target() : step.target;
}
