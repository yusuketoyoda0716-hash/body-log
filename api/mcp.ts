// Claude から呼ばれる MCP サーバー（Vercel Functions）
//
// 接続用URL：https://<アプリのドメイン>/api/mcp?token=<合言葉>
//   1. URL の合言葉をハッシュ値にして、Firestore の mcpTokens から「誰のデータか（uid）」を探す
//   2. 見つかったら、その人のデータだけを読み書きできる MCP サーバーを用意して応答する
//
// 使える機能（ツール）
//   search_food         … 登録食品・レシピ・成分表から探す
//   add_meal_entries    … 食事をまとめて記録する（登録食品にない食品は自動で登録食品にも追加）
//   get_day_summary     … 1日の記録・合計・目標との差を見る
//   delete_meal_entries … 記録を消す（間違えたときの訂正用）
//   save_food           … 食品を登録・更新する
//   save_recipe         … レシピ（料理）を登録・更新する
//   get_recipe          … レシピの材料を見る（材料を直して登録し直すとき）

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { defaultGoals } from '../src/constants/goals.js';
import { MEXT_SOURCE } from '../src/constants/sources.js';
import type {
  Food,
  Goals,
  MealEntry,
  MealType,
  Nutrients,
  Recipe,
  RecipeIngredient,
} from '../src/types/index.js';
import { displayName, searchFoods } from '../src/utils/foodSearch.js';
import { describeRange, sumNutrients } from '../src/utils/nutrition.js';
import { buildRecipe, recipeTotal } from '../src/utils/recipe.js';

// ---- Firebase（サーバー用の鍵で接続。セキュリティルールは効かないので、uid で必ず絞り込む） ----

function getDb() {
  if (getApps().length === 0) {
    const json = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!json) throw new Error('FIREBASE_SERVICE_ACCOUNT が設定されていません');
    initializeApp({ credential: cert(JSON.parse(json)) });
  }
  return getFirestore();
}

// ---- 成分表（関数が起動したときに1回だけ読み込む） ----

type MextFood = Nutrients & { code: string; name: string };

let mextFoods: MextFood[] | null = null;

function getMextFoods(): MextFood[] {
  mextFoods ??= JSON.parse(
    readFileSync(join(process.cwd(), 'src/data/mextFoods.json'), 'utf8'),
  ) as MextFood[];
  return mextFoods;
}

// ---- 合言葉から uid を探す ----

async function findUid(token: string | null): Promise<string | null> {
  if (!token) return null;
  const hash = createHash('sha256').update(token).digest('hex');
  const snap = await getDb().collection('mcpTokens').doc(hash).get();
  return snap.exists ? (snap.get('uid') as string) : null;
}

// ---- 小さな道具 ----

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: '朝食',
  lunch: '昼食',
  dinner: '夕食',
  snack: '間食',
};

const round1 = (n: number) => Math.round(n * 10) / 10;

// 日本時間の今の日時。サーバーはUTCで動くので9時間ずらし、UTCとして読む
function nowInJapan(): Date {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

// 記録の「今日」（YYYY-MM-DD）。午前3時を区切りにして、0〜3時の食事は前の日にする
function recordDateToday(): string {
  return new Date(nowInJapan().getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// 食事区分が指定されなかったときに、今の時間帯から決める
//   3:00〜10:29 朝食 / 10:30〜15:59 昼食 / 16:00〜翌2:59 夕食（間食は指定されたときだけ）
function mealTypeNow(): MealType {
  const now = nowInJapan();
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  if (minutes >= 3 * 60 && minutes < 10 * 60 + 30) return 'breakfast';
  if (minutes >= 10 * 60 + 30 && minutes < 16 * 60) return 'lunch';
  return 'dinner';
}

// 「基準量あたりの値」と量から、その量の値を出す（例：100gあたり × 150g）
function scale(per: Nutrients, baseAmount: number, amount: number): Nutrients {
  const ratio = amount / baseAmount;
  return {
    kcal: round1(per.kcal * ratio),
    protein: round1(per.protein * ratio),
    fat: round1(per.fat * ratio),
    carbs: round1(per.carbs * ratio),
  };
}

function pickNutrients(n: Nutrients): Nutrients {
  return { kcal: n.kcal, protein: n.protein, fat: n.fat, carbs: n.carbs };
}

// 名前が同じかどうか（前後の空白だけ無視する）
const sameName = (a: string, b: string) => a.trim() === b.trim();

function textResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
}

function errorResult(message: string) {
  return { content: [{ type: 'text' as const, text: message }], isError: true };
}

// ---- 入力の形（zod でチェックする） ----

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe('日付（YYYY-MM-DD）。省略すると日本時間の今日（午前3時区切り。0〜3時は前の日）');

const mealTypeSchema = z
  .enum(['breakfast', 'lunch', 'dinner', 'snack'])
  .describe(
    'breakfast=朝食 / lunch=昼食 / dinner=夕食 / snack=間食。省略すると今の時間帯から決める（間食にはならない）',
  );

const unitSchema = z.enum(['g', '個', '杯', '食']);
const amountSchema = z.number().positive();
const nutrientSchema = z.number().min(0);
const sourceSchema = z
  .string()
  .describe('値の出典（調べたサイト名や URL など）。成分表の食品では不要');

const entrySchema = z.discriminatedUnion('source', [
  // 登録食品を使う：量から計算する
  z.object({
    source: z.literal('registered'),
    date: dateSchema.optional(),
    mealType: mealTypeSchema.optional(),
    foodId: z.string().describe('search_food の registered にある id'),
    amount: amountSchema.describe('量（その食品の単位で。例：150g なら 150、2個 なら 2）'),
  }),
  // レシピを使う：1食あたりの値 × 食数
  z.object({
    source: z.literal('recipe'),
    date: dateSchema.optional(),
    mealType: mealTypeSchema.optional(),
    recipeId: z.string().describe('search_food の recipes にある id'),
    amount: amountSchema.describe('食数（例：1食なら 1、半分なら 0.5）'),
  }),
  // 成分表の食品を使う：100gあたりの値とグラム数から計算する
  z.object({
    source: z.literal('mext'),
    date: dateSchema.optional(),
    mealType: mealTypeSchema.optional(),
    code: z.string().describe('search_food の mext にある code'),
    amount: amountSchema.describe('グラム数'),
    name: z
      .string()
      .optional()
      .describe('アプリに表示する名前（例：鶏むね肉）。省略すると成分表の名前'),
  }),
  // 値をそのまま記録する：ウェブで調べた市販品・外食や、計算済みの記録を取り込むとき
  z.object({
    source: z.literal('custom'),
    date: dateSchema.optional(),
    mealType: mealTypeSchema.optional(),
    name: z.string().min(1).describe('食品名。品目がなく合計だけなら「夕食（まとめ）」など'),
    amount: amountSchema.describe('量'),
    unit: unitSchema.describe('量の単位'),
    kcal: nutrientSchema.describe('この量でのカロリー'),
    protein: nutrientSchema.describe('この量でのたんぱく質(g)'),
    fat: nutrientSchema.describe('この量での脂質(g)'),
    carbs: nutrientSchema.describe('この量での炭水化物(g)'),
    valueSource: sourceSchema.optional(),
    saveAsFood: z
      .boolean()
      .optional()
      .describe('登録食品に自動で追加するか（省略時は追加）。「夕食（まとめ）」のような合計だけの記録では false'),
  }),
]);

// レシピの材料
const ingredientSchema = z.discriminatedUnion('source', [
  z.object({
    source: z.literal('registered'),
    foodId: z.string().describe('search_food の registered にある id'),
    amount: amountSchema.describe('量（その食品の単位で）'),
  }),
  z.object({
    source: z.literal('mext'),
    code: z.string().describe('search_food の mext にある code'),
    amount: amountSchema.describe('グラム数'),
    name: z.string().optional().describe('材料の表示名（例：豚バラ肉）。省略すると成分表の名前'),
  }),
  // 成分表にない材料（カレールウなど）：使った量での値を入れる
  z.object({
    source: z.literal('custom'),
    name: z.string().min(1),
    amount: amountSchema.describe('使った量'),
    unit: unitSchema,
    kcal: nutrientSchema.describe('使った量でのカロリー'),
    protein: nutrientSchema,
    fat: nutrientSchema,
    carbs: nutrientSchema,
  }),
]);

// ---- Claude に最初に伝える使い方 ----

const INSTRUCTIONS = `body-log は、食事のカロリー・PFC を記録するアプリです。登録食品・レシピ（料理）・日本食品標準成分表を使えます。

食べたものを記録するとき：
1. search_food で探す。優先順位は recipes（ユーザーのレシピ）→ registered（登録食品）→ mext（成分表。100gあたり）
   - 成分表から選ぶときは、部位や調理法（生・ゆで・焼き など）まで合うものを選ぶ
   - 鶏肉は特に指定がなければ［若どり］、ごはんは「こめ ［水稲めし］ 精白米 うるち米」を選ぶ
   - 候補が複数あって決めきれないときは、ユーザーに確認する
   - どこにもない食品（市販品・外食など）は、ウェブで栄養成分を調べて custom で記録し、valueSource に出典を入れる
2. add_meal_entries でまとめて記録する
   - 日付・食事区分をユーザーが言ったときだけ指定する。言わなかったときは省略する（サーバーが午前3時区切りの日付と、時間帯から食事区分を決める）
   - 成分表（mext）や custom で記録した食品は、登録食品に同じ名前がなければ自動で登録食品にも追加される（addedFoods）。合計だけの記録（「夕食（まとめ）」など）は saveAsFood を false にする
3. 結果の days にその日の合計と目標との差が入っているので、ユーザーに伝える。記録した日付・食事区分と、登録食品に追加した食品も伝える

記録を直すとき（「間違えた」「消して」「量が違う」など）：
1. get_day_summary でその日の記録を確認する（各記録に id がある）
2. delete_meal_entries で該当の記録を消し、必要なら add_meal_entries で正しく記録し直す

食品を登録・修正するとき（「プロテインの値はこれ」「この商品を登録して」など）：
- save_food を使う。同じ名前の食品があれば上書きされる

料理を作ったとき（「カレーを4食分作った。材料は…」など）：
1. 材料ごとに search_food で探し、save_recipe で登録する（材料の量はグラムが基本。servings は何食分か）
2. サーバーが材料の合計 ÷ 何食分で1食あたりを計算する。結果の1食あたりの値をユーザーに伝える
3. 作るたびに量が違うとき（「今日は豚肉400gで作った」など）は、get_recipe で前回の材料を読み出し、変わったところだけ直して save_recipe で登録し直す（同じ名前なら上書き。過去の記録は変わらない）
4. 食べたときは add_meal_entries の recipe で「1食」「0.5食」のように記録する

写真が送られたとき：
- 料理の写真：料理ごとに食品と量（グラム）を見積もり、記録する前に一覧（食品・量・kcal・PFC）を見せてユーザーに確認する。確認がとれてから add_meal_entries で記録する
  - 料理はできるだけ ごはん・おかず・汁物 のように分け、それぞれ search_food で探す（成分表には から揚げ・ハンバーグ・カレー などできあがりの料理もある）
  - 見積もりであることを伝える。写真から見積もった値を custom で記録するときは saveAsFood を false にする（見積もりの値を登録食品に残さない）
- パッケージや栄養成分表示の写真：書かれている値を読み取り、save_food で登録してから記録する。valueSource には「パッケージの栄養成分表示」のように書く

すでに計算済みの記録（過去のチャットなど）を取り込むときは、source を custom にして、書かれている値をそのまま記録する。
「何個」「何杯」で、成分表（グラム）しか候補がないときは、グラム数を見積もってよいが、見積もったことをユーザーに伝える。`;

// ---- MCP サーバー本体（リクエストごとに、その人用に作る） ----

function createServer(uid: string) {
  const db = getDb();
  const userDoc = db.collection('users').doc(uid);
  const foodsCol = userDoc.collection('foods');
  const recipesCol = userDoc.collection('recipes');
  const entriesCol = userDoc.collection('entries');

  async function getRegisteredFoods(): Promise<Food[]> {
    const snap = await foodsCol.get();
    return snap.docs.map((d) => d.data() as Food);
  }

  async function getRecipes(): Promise<Recipe[]> {
    const snap = await recipesCol.get();
    return snap.docs.map((d) => d.data() as Recipe);
  }

  async function getEntries(date: string): Promise<MealEntry[]> {
    const snap = await entriesCol.where('date', '==', date).get();
    return snap.docs.map((d) => d.data() as MealEntry);
  }

  async function getGoals(): Promise<Goals> {
    const snap = await userDoc.collection('settings').doc('goals').get();
    // アプリと同じく、保存されていない項目は初期値で補う
    return snap.exists ? { ...defaultGoals, ...(snap.data() as Partial<Goals>) } : defaultGoals;
  }

  async function daySummary(date: string) {
    const [entries, goals] = await Promise.all([getEntries(date), getGoals()]);
    const total = sumNutrients(entries);

    const meals = (Object.keys(MEAL_LABELS) as MealType[]).map((type) => {
      const items = entries.filter((e) => e.mealType === type);
      return {
        meal: MEAL_LABELS[type],
        total: sumNutrients(items),
        items: items.map((e) => ({
          id: e.id,
          name: e.foodName,
          amount: `${e.amount}${e.unit}`,
          kcal: e.kcal,
          protein: e.protein,
          fat: e.fat,
          carbs: e.carbs,
        })),
      };
    });

    return {
      date,
      total,
      goals: {
        kcal: `${goals.kcal.min}〜${goals.kcal.max}kcal（${describeRange(total.kcal, goals.kcal, 'kcal', 0)}）`,
        protein: `${goals.protein.min}〜${goals.protein.max}g（${describeRange(total.protein, goals.protein, 'g')}）`,
        fat: `${goals.fat.min}〜${goals.fat.max}g（${describeRange(total.fat, goals.fat, 'g')}）`,
        carbs: `${goals.carbs.min}〜${goals.carbs.max}g（${describeRange(total.carbs, goals.carbs, 'g')}）`,
      },
      meals,
    };
  }

  // レシピを Claude に返す形（材料ごとの値・鍋全体・1食あたり）
  function recipeView(recipe: Recipe) {
    return {
      id: recipe.id,
      name: recipe.name,
      servings: recipe.servings,
      perServing: pickNutrients(recipe),
      total: recipeTotal(recipe.ingredients),
      ingredients: recipe.ingredients.map((i) => ({
        name: i.name,
        amount: i.amount,
        unit: i.unit,
        ref: i.ref,
        ...scale(i, i.baseAmount, i.amount),
      })),
    };
  }

  const server = new McpServer(
    { name: 'body-log', version: '1.4.0' },
    { instructions: INSTRUCTIONS },
  );

  // ---- 探す ----
  server.registerTool(
    'search_food',
    {
      title: '食品・レシピを探す',
      description:
        '名前で検索し、ユーザーのレシピ（recipes、1食あたり）、登録食品（registered）、日本食品標準成分表（mext、100gあたり）の候補を返します。「鶏むね肉」「ごはん」のような普段の呼び方で探せます。',
      inputSchema: {
        query: z
          .string()
          .min(1)
          .describe('名前。スペースで区切るとすべてを含むものに絞れる（例：鶏むね 皮なし）'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ query }) => {
      const [registered, recipes] = await Promise.all([getRegisteredFoods(), getRecipes()]);
      return textResult({
        recipes: searchFoods(recipes, query, 10).map((r) => ({
          id: r.id,
          name: r.name,
          per: `1食あたり（${r.servings}食分のレシピ）`,
          ...pickNutrients(r),
        })),
        registered: searchFoods(registered, query, 10).map((f) => ({
          id: f.id,
          name: f.name,
          per: `${f.baseAmount}${f.unit}あたり`,
          ...pickNutrients(f),
          ...(f.source ? { source: f.source } : {}),
        })),
        mext: searchFoods(getMextFoods(), query, 10).map((f) => ({
          code: f.code,
          name: displayName(f.name),
          per: '100gあたり',
          ...pickNutrients(f),
        })),
      });
    },
  );

  // ---- 食事をまとめて記録する ----
  server.registerTool(
    'add_meal_entries',
    {
      title: '食事を記録する',
      description:
        '食事をまとめて記録します（1回で50件まで）。レシピ・登録食品・成分表は量から自動で計算します。値をそのまま記録するときは custom を使います。成分表や custom の食品は、登録食品に同じ名前がなければ自動で登録食品にも追加します。',
      inputSchema: {
        entries: z.array(entrySchema).min(1).max(50),
      },
    },
    async ({ entries }) => {
      const [registered, recipes] = await Promise.all([getRegisteredFoods(), getRecipes()]);
      const mext = getMextFoods();
      const today = recordDateToday();
      const mealTypeDefault = mealTypeNow();

      // まず全件を組み立てる。1件でも見つからないものがあれば、何も保存しない
      const docs: MealEntry[] = [];
      const newFoods: Food[] = [];

      // 登録食品に同じ名前がなければ、追加する食品として控えておく
      const addFoodIfNew = (food: Omit<Food, 'id'>) => {
        const exists = [...registered, ...newFoods].some((f) => sameName(f.name, food.name));
        if (!exists) newFoods.push({ id: randomUUID(), ...food });
      };

      for (const [i, input] of entries.entries()) {
        const base = {
          id: randomUUID(),
          date: input.date ?? today,
          mealType: input.mealType ?? mealTypeDefault,
        };

        if (input.source === 'registered') {
          const food = registered.find((f) => f.id === input.foodId);
          if (!food) return errorResult(`${i + 1}件目：登録食品 ${input.foodId} が見つかりません`);
          docs.push({
            ...base,
            foodId: food.id,
            foodName: food.name,
            unit: food.unit,
            amount: input.amount,
            ...scale(food, food.baseAmount, input.amount),
          });
        } else if (input.source === 'recipe') {
          const recipe = recipes.find((r) => r.id === input.recipeId);
          if (!recipe) return errorResult(`${i + 1}件目：レシピ ${input.recipeId} が見つかりません`);
          docs.push({
            ...base,
            foodId: `recipe:${recipe.id}`,
            foodName: recipe.name,
            unit: '食',
            amount: input.amount,
            ...scale(recipe, 1, input.amount),
          });
        } else if (input.source === 'mext') {
          const food = mext.find((f) => f.code === input.code);
          if (!food) return errorResult(`${i + 1}件目：成分表の食品 ${input.code} が見つかりません`);
          const name = input.name ?? displayName(food.name);
          docs.push({
            ...base,
            foodId: `mext:${food.code}`,
            foodName: name,
            unit: 'g',
            amount: input.amount,
            ...scale(food, 100, input.amount),
          });
          addFoodIfNew({ name, unit: 'g', baseAmount: 100, ...pickNutrients(food), source: MEXT_SOURCE });
        } else {
          const values = {
            kcal: round1(input.kcal),
            protein: round1(input.protein),
            fat: round1(input.fat),
            carbs: round1(input.carbs),
          };
          docs.push({
            ...base,
            foodId: 'custom',
            foodName: input.name,
            unit: input.unit,
            amount: input.amount,
            ...values,
          });
          if (input.saveAsFood !== false) {
            // 記録した量をそのまま基準量にする（例：1個あたり、250gあたり）
            addFoodIfNew({
              name: input.name.trim(),
              unit: input.unit,
              baseAmount: input.amount,
              ...values,
              ...(input.valueSource ? { source: input.valueSource } : {}),
            });
          }
        }
      }

      // まとめて1回で保存する（途中で失敗したら全部取り消される）
      const batch = db.batch();
      for (const entry of docs) batch.set(entriesCol.doc(entry.id), entry);
      for (const food of newFoods) batch.set(foodsCol.doc(food.id), food);
      await batch.commit();

      const dates = [...new Set(docs.map((d) => d.date))].sort();
      return textResult({
        added: docs.map((d) => ({
          id: d.id,
          date: d.date,
          meal: MEAL_LABELS[d.mealType],
          name: d.foodName,
          amount: `${d.amount}${d.unit}`,
          ...pickNutrients(d),
        })),
        // 登録食品に自動で追加した食品
        addedFoods: newFoods.map((f) => `${f.name}（${f.baseAmount}${f.unit}あたり ${f.kcal}kcal）`),
        // 記録した日の合計もあわせて返す（別のツールを呼ばなくても伝えられるように）
        days: await Promise.all(dates.map(daySummary)),
      });
    },
  );

  // ---- 1日の記録と合計を見る ----
  server.registerTool(
    'get_day_summary',
    {
      title: '1日の合計を見る',
      description: '指定した日の食事の記録、合計のカロリー・PFC、目標との差を返します。',
      inputSchema: { date: dateSchema.optional() },
      annotations: { readOnlyHint: true },
    },
    async ({ date }) => textResult(await daySummary(date ?? recordDateToday())),
  );

  // ---- 記録を消す（訂正用） ----
  server.registerTool(
    'delete_meal_entries',
    {
      title: '記録を消す',
      description:
        '食事の記録を消します。間違えて記録したときの訂正に使います。id は get_day_summary や add_meal_entries の結果にあります。',
      inputSchema: {
        ids: z.array(z.string().min(1)).min(1).max(50).describe('消す記録の id'),
      },
      annotations: { destructiveHint: true },
    },
    async ({ ids }) => {
      const refs = ids.map((id) => entriesCol.doc(id));
      const snaps = await Promise.all(refs.map((ref) => ref.get()));

      // 1件でも見つからなければ、何も消さない
      const missing = ids.filter((_, i) => !snaps[i].exists);
      if (missing.length > 0) return errorResult(`記録が見つかりません：${missing.join(', ')}`);

      const deleted = snaps.map((snap) => snap.data() as MealEntry);
      const batch = db.batch();
      for (const ref of refs) batch.delete(ref);
      await batch.commit();

      const dates = [...new Set(deleted.map((d) => d.date))].sort();
      return textResult({
        deleted: deleted.map((d) => ({
          date: d.date,
          meal: MEAL_LABELS[d.mealType],
          name: d.foodName,
          amount: `${d.amount}${d.unit}`,
          kcal: d.kcal,
        })),
        days: await Promise.all(dates.map(daySummary)),
      });
    },
  );

  // ---- 食品を登録・更新する ----
  server.registerTool(
    'save_food',
    {
      title: '食品を登録する',
      description:
        '食品を登録食品に保存します。同じ名前の食品があれば、その値を上書きします。値は baseAmount（基準量）あたりで入れます（例：1個あたり、100gあたり）。',
      inputSchema: {
        name: z.string().min(1).describe('食品名（例：プロテイン、セブンのサラダチキン）'),
        unit: unitSchema.describe('単位'),
        baseAmount: amountSchema.describe('基準量（例：100g あたりなら 100、1個あたりなら 1）'),
        kcal: nutrientSchema.describe('基準量あたりのカロリー'),
        protein: nutrientSchema.describe('基準量あたりのたんぱく質(g)'),
        fat: nutrientSchema.describe('基準量あたりの脂質(g)'),
        carbs: nutrientSchema.describe('基準量あたりの炭水化物(g)'),
        valueSource: sourceSchema.optional(),
      },
    },
    async (input) => {
      const registered = await getRegisteredFoods();
      const existing = registered.find((f) => sameName(f.name, input.name));
      const food: Food = {
        id: existing?.id ?? randomUUID(),
        name: input.name.trim(),
        unit: input.unit,
        baseAmount: input.baseAmount,
        kcal: round1(input.kcal),
        protein: round1(input.protein),
        fat: round1(input.fat),
        carbs: round1(input.carbs),
        ...(input.valueSource ? { source: input.valueSource } : {}),
      };
      await foodsCol.doc(food.id).set(food);
      return textResult({
        result: existing ? '同じ名前の食品を上書きしました' : '新しく登録しました',
        food: { ...food, per: `${food.baseAmount}${food.unit}あたり` },
      });
    },
  );

  // ---- レシピを登録・更新する ----
  server.registerTool(
    'save_recipe',
    {
      title: 'レシピを登録する',
      description:
        'レシピ（料理）を保存します。材料の合計を servings（何食分）で割って、1食あたりの値を計算します。同じ名前のレシピがあれば上書きします（過去の記録は変わりません）。',
      inputSchema: {
        name: z.string().min(1).describe('料理名（例：カレー、豚汁）'),
        servings: amountSchema.describe('何食分か'),
        ingredients: z.array(ingredientSchema).min(1).max(50).describe('材料（量はグラムが基本）'),
      },
    },
    async ({ name, servings, ingredients }) => {
      const [registered, recipes] = await Promise.all([getRegisteredFoods(), getRecipes()]);
      const mext = getMextFoods();

      // 材料を「基準量あたりの値 + 使った量」の形にそろえる
      const items: RecipeIngredient[] = [];
      for (const [i, input] of ingredients.entries()) {
        if (input.source === 'registered') {
          const food = registered.find((f) => f.id === input.foodId);
          if (!food) return errorResult(`材料${i + 1}：登録食品 ${input.foodId} が見つかりません`);
          items.push({
            name: food.name,
            unit: food.unit,
            baseAmount: food.baseAmount,
            amount: input.amount,
            ref: food.id,
            ...pickNutrients(food),
          });
        } else if (input.source === 'mext') {
          const food = mext.find((f) => f.code === input.code);
          if (!food) return errorResult(`材料${i + 1}：成分表の食品 ${input.code} が見つかりません`);
          items.push({
            name: input.name ?? displayName(food.name),
            unit: 'g',
            baseAmount: 100,
            amount: input.amount,
            ref: `mext:${food.code}`,
            ...pickNutrients(food),
          });
        } else {
          // 使った量での値なので、使った量そのものを基準量にする
          items.push({
            name: input.name,
            unit: input.unit,
            baseAmount: input.amount,
            amount: input.amount,
            ref: null,
            kcal: round1(input.kcal),
            protein: round1(input.protein),
            fat: round1(input.fat),
            carbs: round1(input.carbs),
          });
        }
      }

      const existing = recipes.find((r) => sameName(r.name, name));
      const recipe = buildRecipe({
        id: existing?.id ?? randomUUID(),
        name: name.trim(),
        servings,
        ingredients: items,
      });
      await recipesCol.doc(recipe.id).set(recipe);

      return textResult({
        result: existing ? '同じ名前のレシピを上書きしました' : '新しく登録しました',
        recipe: recipeView(recipe),
      });
    },
  );

  // ---- レシピの材料を見る ----
  server.registerTool(
    'get_recipe',
    {
      title: 'レシピを見る',
      description:
        'レシピの材料・鍋全体・1食あたりの値を返します。材料の量を変えて登録し直すときに、前回の材料を読み出すのに使います。',
      inputSchema: {
        name: z.string().min(1).describe('レシピ名（完全に一致しなければ、近い名前のものを探す）'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ name }) => {
      const recipes = await getRecipes();
      const recipe =
        recipes.find((r) => sameName(r.name, name)) ?? searchFoods(recipes, name, 1)[0];
      if (!recipe) return errorResult(`レシピ「${name}」が見つかりません`);
      return textResult(recipeView(recipe));
    },
  );

  return server;
}

// ---- Vercel から呼ばれる入口 ----

export default {
  async fetch(request: Request): Promise<Response> {
    const token = new URL(request.url).searchParams.get('token');

    let uid: string | null;
    try {
      uid = await findUid(token);
    } catch (e) {
      console.error(e);
      return Response.json({ error: 'server_error' }, { status: 500 });
    }
    if (!uid) {
      return Response.json({ error: 'invalid_token' }, { status: 401 });
    }

    // 1回のリクエストごとに完結させる（セッションを持たない）形にする
    const server = createServer(uid);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await server.connect(transport);
    return transport.handleRequest(request);
  },
};
