import type { Nutrients } from '../types';

// 日本食品標準成分表の1食品（可食部100gあたり）
export type MextFood = Nutrients & {
  code: string; // 食品番号
  name: string; // 成分表の食品名（例：＜魚類＞ （かつお類） かつお 秋獲り 生）
};

export const MEXT_SOURCE = '文部科学省「日本食品標準成分表（八訂）増補2023年」';

// 約300kBあるので、検索画面を開いたときに初めて読み込む
let cache: Promise<MextFood[]> | null = null;

export function loadMextFoods(): Promise<MextFood[]> {
  cache ??= import('../data/mextFoods.json').then((m) => m.default as MextFood[]);
  return cache;
}

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
//   カタカナ → ひらがな、全角英数字 → 半角、大文字 → 小文字、空白や記号は消す
function normalize(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[\s［］[\]（）()＜＞<>・]/g, '');
}

// 成分表の書き方と、ふだんの呼び方が違うもの
const SYNONYMS: Record<string, string[]> = {
  ごはん: ['めし'],
  ご飯: ['めし'],
  白米: ['めし'],
  鶏: ['にわとり'],
  鶏肉: ['にわとり'],
  とり: ['にわとり'],
  豚: ['ぶた'],
  豚肉: ['ぶた'],
  牛: ['うし'],
  牛肉: ['うし'],
  卵: ['鶏卵'],
  たまご: ['鶏卵'],
  玉子: ['鶏卵'],
};

const MAX_RESULTS = 50;

// 空白で区切ったキーワードをすべて含む食品を探す（AND検索）
export function searchMextFoods(foods: MextFood[], query: string): MextFood[] {
  const words = query.split(/[\s\u3000]+/).filter((w) => w !== '');
  if (words.length === 0) return [];

  // キーワードごとに「どれか1つ含めばOK」な候補を作る
  const candidates = words.map((w) => [w, ...(SYNONYMS[w] ?? [])].map(normalize));

  const hits = foods
    .map((food) => {
      const target = normalize(displayName(food.name));
      const full = normalize(food.name);
      let score = 0;
      for (const options of candidates) {
        const pos = Math.min(...options.map((o) => target.indexOf(o)).filter((i) => i >= 0));
        if (Number.isFinite(pos)) {
          score += pos; // 名前の前のほうで一致するほど上に出す
        } else if (options.some((o) => full.includes(o))) {
          score += 100; // 分類名（＜魚類＞など）だけで一致したものは下に回す
        } else {
          return null;
        }
      }
      return { food, score: score + target.length / 100 };
    })
    .filter((hit) => hit !== null);

  hits.sort((a, b) => a.score - b.score);
  return hits.slice(0, MAX_RESULTS).map((hit) => hit.food);
}
