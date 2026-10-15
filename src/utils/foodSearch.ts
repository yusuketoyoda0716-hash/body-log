// 食品名の検索（成分表の食品にも、自分で登録した食品にも使う）
// ブラウザとサーバー（api/mcp.ts）の両方から読み込むので、ほかのファイルに依存しない形にしている

// 表示用の名前：分類の ＜魚類＞ や （かつお類） を外す
//   ＜魚類＞ （かつお類） かつお 秋獲り 生 → かつお 秋獲り 生
export function displayName(name: string): string {
  return name
    .replace(/＜[^＞]*＞/g, '')
    .replace(/（[^）]*）/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// 比べやすい形にそろえる
//   カタカナ → ひらがな、全角英数字 → 半角、大文字 → 小文字、カッコは空白にする
//   空白は残す（「そらまめ しょうゆ豆」が「めし」に一致しないように、言葉の区切りを保つ）
function normalize(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[［］[\]（）()＜＞<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ふだんの呼び方を、成分表の書き方に置きかえる（例：鶏むね肉 → にわとりむね）
// 置きかえる前の言葉でも検索するので、「牛乳」の「牛」が置きかわっても普通牛乳は見つかる
const REPLACEMENTS: Record<string, string> = {
  ごはん: 'めし',
  ご飯: 'めし',
  白米: 'めし精白米',
  鶏: 'にわとり',
  豚: 'ぶた',
  牛: 'うし',
  胸: 'むね',
  腿: 'もも',
  肉: '', // 「鶏むね肉」の「肉」は成分表の名前にないので外す
  卵: '鶏卵',
  玉子: '鶏卵',
  たまご: '鶏卵',
  サーモン: 'さけ',
  鮭: 'さけ',
  ささ身: 'ささみ',
};

// 長い言葉から先に置きかえる（「玉子」を「玉」+「子」より先に見る）
const REPLACE_PATTERN = new RegExp(
  Object.keys(REPLACEMENTS)
    .sort((a, b) => b.length - a.length)
    .join('|'),
  'g',
);

// 1つのキーワードから、検索に使う言い方の候補を作る
function variants(word: string): string[] {
  const replaced = word.replace(REPLACE_PATTERN, (m) => REPLACEMENTS[m]);
  const list = [word, replaced].map((w) => normalize(w).replace(/ /g, ''));
  return [...new Set(list)].filter((w) => w !== '');
}

// 2文字ずつに区切る（例：とりむね → とり・りむ・むね）
function bigrams(text: string): string[] {
  const result: string[] = [];
  for (let i = 0; i < text.length - 1; i++) result.push(text.slice(i, i + 2));
  return result;
}

// キーワード1つが食品名にどれだけ合うか。小さいほどよく合う。合わなければ null
function wordScore(word: string, target: string): number | null {
  // そのまま含まれていれば一番よい。名前の前のほうで一致するほど上に出す
  const pos = target.indexOf(word);
  if (pos >= 0) return pos / 1000;

  // 逆に、短い名前がキーワードに含まれていてもよい
  //   例：登録食品「鶏むね」は、キーワード「鶏むね肉」で見つかる
  const compact = target.replace(/ /g, '');
  if (compact.length >= 2 && word.includes(compact)) return 0.5;

  // 3文字以上のときは、離れていても合うかを見る
  //   例：「とりむね」は「にわとり 若どり・主品目 むね」に、とり・むね が含まれる
  if (word.length < 3) return null;
  if ([...word].some((c) => !target.includes(c))) return null; // 使われている文字はすべて必要

  const pairs = bigrams(word);
  const rate = pairs.filter((p) => target.includes(p)).length / pairs.length;
  if (rate <= 0.5) return null; // 半分以下しか合わないものは外す
  return 1 + (1 - rate); // そのまま含まれるものより下に出す
}

function bestScore(options: string[], target: string): number | null {
  let best: number | null = null;
  for (const option of options) {
    const s = wordScore(option, target);
    if (s !== null && (best === null || s < best)) best = s;
  }
  return best;
}

// 空白で区切ったキーワードをすべて含む食品を探す（AND検索）
// \s は全角スペースにも一致するので、全角・半角どちらで区切ってもよい
export function searchFoods<T extends { name: string }>(
  foods: T[],
  query: string,
  limit = 50,
): T[] {
  const words = query.split(/\s+/).filter((w) => w !== '');
  if (words.length === 0) return [];

  const candidates = words.map(variants);

  const hits: { food: T; score: number }[] = [];
  for (const food of foods) {
    const target = normalize(displayName(food.name));
    const full = normalize(food.name);
    let total = 0;
    let matched = true;

    for (const options of candidates) {
      let score = bestScore(options, target);
      // 分類名（＜牛乳及び乳製品＞など）だけで一致したものは下に回す
      if (score === null) {
        const inFull = bestScore(options, full);
        score = inFull === null ? null : inFull + 3;
      }
      if (score === null) {
        matched = false;
        break;
      }
      total += score;
    }

    // 成分表の［副品目］は皮・内臓など。「鶏むね」で鶏皮が先頭に来ないよう、少しだけ下げる
    if (food.name.includes('副品目')) total += 0.05;

    // 同じくらい合うなら、名前が短い（シンプルな）ものを上に出す
    if (matched) hits.push({ food, score: total + target.length / 1000 });
  }

  hits.sort((a, b) => a.score - b.score);
  return hits.slice(0, limit).map((hit) => hit.food);
}
