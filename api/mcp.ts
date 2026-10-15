// Claude から呼ばれる MCP サーバー（Vercel Functions）
//
// 接続用URL：https://<アプリのドメイン>/api/mcp?token=<合言葉>
//   1. URL の合言葉をハッシュ値にして、Firestore の mcpTokens から「誰のデータか（uid）」を探す
//   2. 見つかったら、その人のデータだけを読み書きできる MCP サーバーを用意して応答する
//
// 使える機能（ツール）
//   search_food      … 登録食品と成分表から食品を探す
//   add_meal_entries … 食事をまとめて記録する
//   get_day_summary  … 1日の記録・合計・目標との差を見る

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { defaultGoals } from '../src/constants/goals.js';
import type { Food, Goals, MealEntry, MealType, Nutrients } from '../src/types/index.js';
import { displayName, searchFoods } from '../src/utils/foodSearch.js';
import { describeRange, sumNutrients } from '../src/utils/nutrition.js';

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

// 日本時間の今日（YYYY-MM-DD）。サーバーはUTCで動くので9時間ずらす
function todayInJapan(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
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
  .describe('日付（YYYY-MM-DD）。省略すると日本時間の今日');

const mealTypeSchema = z
  .enum(['breakfast', 'lunch', 'dinner', 'snack'])
  .describe('breakfast=朝食 / lunch=昼食 / dinner=夕食 / snack=間食');

const amountSchema = z.number().positive();

const entrySchema = z.discriminatedUnion('source', [
  // 登録食品を使う：量から計算する
  z.object({
    source: z.literal('registered'),
    date: dateSchema.optional(),
    mealType: mealTypeSchema,
    foodId: z.string().describe('search_food の registered にある id'),
    amount: amountSchema.describe('量（その食品の単位で。例：150g なら 150、2個 なら 2）'),
  }),
  // 成分表の食品を使う：100gあたりの値とグラム数から計算する
  z.object({
    source: z.literal('mext'),
    date: dateSchema.optional(),
    mealType: mealTypeSchema,
    code: z.string().describe('search_food の mext にある code'),
    amount: amountSchema.describe('グラム数'),
    name: z.string().optional().describe('アプリに表示する名前（例：鶏むね肉）。省略すると成分表の名前'),
  }),
  // 値をそのまま記録する：すでに計算済みの記録（過去のチャットなど）を取り込むとき
  z.object({
    source: z.literal('custom'),
    date: dateSchema.optional(),
    mealType: mealTypeSchema,
    name: z.string().min(1).describe('食品名。品目がなく合計だけなら「夕食（まとめ）」など'),
    amount: amountSchema.describe('量'),
    unit: z.enum(['g', '個', '杯', '食']).describe('量の単位'),
    kcal: z.number().min(0).describe('この量でのカロリー'),
    protein: z.number().min(0).describe('この量でのたんぱく質(g)'),
    fat: z.number().min(0).describe('この量での脂質(g)'),
    carbs: z.number().min(0).describe('この量での炭水化物(g)'),
  }),
]);

// ---- Claude に最初に伝える使い方 ----

const INSTRUCTIONS = `body-log は、食事のカロリー・PFC を記録するアプリです。

食べたものを記録するとき：
1. search_food で食品を探す
   - registered（ユーザーが登録した食品）に合うものがあれば、それを優先して使う
   - なければ mext（日本食品標準成分表。値は100gあたり）から、部位や調理法（生・ゆで・焼き など）まで合うものを選ぶ
   - 鶏肉は特に指定がなければ［若どり］、ごはんは「こめ ［水稲めし］ 精白米 うるち米」を選ぶ
   - 候補が複数あって決めきれないときは、ユーザーに確認する
2. add_meal_entries でまとめて記録する（日付・食事区分を付ける）
3. get_day_summary でその日の合計と目標との差を確認し、ユーザーに伝える

すでに計算済みの記録（過去のチャットなど）を取り込むときは、source を custom にして、書かれている値をそのまま記録する。
「何個」「何杯」で、成分表（グラム）しか候補がないときは、グラム数を見積もってよいが、見積もったことをユーザーに伝える。`;

// ---- MCP サーバー本体（リクエストごとに、その人用に作る） ----

function createServer(uid: string) {
  const db = getDb();
  const userDoc = db.collection('users').doc(uid);

  async function getRegisteredFoods(): Promise<Food[]> {
    const snap = await userDoc.collection('foods').get();
    return snap.docs.map((d) => d.data() as Food);
  }

  async function getEntries(date: string): Promise<MealEntry[]> {
    const snap = await userDoc.collection('entries').where('date', '==', date).get();
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

  const server = new McpServer(
    { name: 'body-log', version: '1.1.0' },
    { instructions: INSTRUCTIONS },
  );

  // ---- 食品を探す ----
  server.registerTool(
    'search_food',
    {
      title: '食品を探す',
      description:
        '食品名で検索し、ユーザーが登録した食品（registered）と、日本食品標準成分表の食品（mext、100gあたり）の候補を返します。「鶏むね肉」「ごはん」のような普段の呼び方で探せます。',
      inputSchema: {
        query: z
          .string()
          .min(1)
          .describe('食品名。スペースで区切るとすべてを含むものに絞れる（例：鶏むね 皮なし）'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ query }) => {
      const registered = await getRegisteredFoods();
      return textResult({
        registered: searchFoods(registered, query, 10).map((f) => ({
          id: f.id,
          name: f.name,
          per: `${f.baseAmount}${f.unit}あたり`,
          kcal: f.kcal,
          protein: f.protein,
          fat: f.fat,
          carbs: f.carbs,
        })),
        mext: searchFoods(getMextFoods(), query, 10).map((f) => ({
          code: f.code,
          name: displayName(f.name),
          per: '100gあたり',
          kcal: f.kcal,
          protein: f.protein,
          fat: f.fat,
          carbs: f.carbs,
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
        '食事をまとめて記録します（1回で50件まで）。登録食品（registered）・成分表（mext）は量から自動で計算します。計算済みの値をそのまま記録するときは custom を使います。',
      inputSchema: {
        entries: z.array(entrySchema).min(1).max(50),
      },
    },
    async ({ entries }) => {
      const registered = await getRegisteredFoods();
      const mext = getMextFoods();
      const today = todayInJapan();

      // まず全件を組み立てる。1件でも見つからない食品があれば、何も保存しない
      const docs: MealEntry[] = [];
      for (const [i, input] of entries.entries()) {
        const base = { id: randomUUID(), date: input.date ?? today, mealType: input.mealType };

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
        } else if (input.source === 'mext') {
          const food = mext.find((f) => f.code === input.code);
          if (!food) return errorResult(`${i + 1}件目：成分表の食品 ${input.code} が見つかりません`);
          docs.push({
            ...base,
            foodId: `mext:${food.code}`,
            foodName: input.name ?? displayName(food.name),
            unit: 'g',
            amount: input.amount,
            ...scale(food, 100, input.amount),
          });
        } else {
          docs.push({
            ...base,
            foodId: 'custom',
            foodName: input.name,
            unit: input.unit,
            amount: input.amount,
            kcal: round1(input.kcal),
            protein: round1(input.protein),
            fat: round1(input.fat),
            carbs: round1(input.carbs),
          });
        }
      }

      // まとめて1回で保存する（途中で失敗したら全部取り消される）
      const batch = db.batch();
      for (const entry of docs) batch.set(userDoc.collection('entries').doc(entry.id), entry);
      await batch.commit();

      const dates = [...new Set(docs.map((d) => d.date))].sort();
      return textResult({
        added: docs.map((d) => ({
          date: d.date,
          meal: MEAL_LABELS[d.mealType],
          name: d.foodName,
          amount: `${d.amount}${d.unit}`,
          kcal: d.kcal,
          protein: d.protein,
          fat: d.fat,
          carbs: d.carbs,
        })),
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
    async ({ date }) => textResult(await daySummary(date ?? todayInJapan())),
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
