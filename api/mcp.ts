// Claude から呼ばれる MCP サーバー（Vercel Functions）
//
// 接続用URL：https://<アプリのドメイン>/api/mcp?token=<合言葉>
//   1. URL の合言葉をハッシュ値にして、Firestore の mcpTokens から「誰のデータか（uid）」を探す
//   2. 見つかったら、その人のデータだけを読み書きできる MCP サーバーを用意して応答する

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { displayName, searchFoods } from '../src/utils/foodSearch.js';

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

type MextFood = {
  code: string;
  name: string;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
};

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

// ---- MCP サーバー本体（リクエストごとに、その人用に作る） ----

type RegisteredFood = {
  id: string;
  name: string;
  unit: string;
  baseAmount: number;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
};

const INSTRUCTIONS = `body-log は、食事のカロリー・PFC を記録するアプリです。
食べたものを記録するときは、まず search_food で食品を探してください。
- registered（ユーザーが登録した食品）に合うものがあれば、それを優先して使います
- なければ mext（日本食品標準成分表。値は100gあたり）から、調理法（生・ゆで・焼き など）まで合うものを選びます
- 候補が複数あって決めきれないときは、ユーザーに確認してください`;

function textResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function createServer(uid: string) {
  const db = getDb();
  const userDoc = db.collection('users').doc(uid);

  const server = new McpServer({ name: 'body-log', version: '1.0.0' }, { instructions: INSTRUCTIONS });

  server.registerTool(
    'search_food',
    {
      title: '食品を探す',
      description:
        '食品名で検索し、ユーザーが登録した食品（registered）と、日本食品標準成分表の食品（mext、100gあたり）の候補を返します。「鶏むね肉」「ごはん」のような普段の呼び方で探せます。',
      inputSchema: {
        query: z.string().min(1).describe('食品名。スペースで区切るとすべてを含むものに絞れる（例：鶏むね 皮なし）'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ query }) => {
      const snap = await userDoc.collection('foods').get();
      const registered = snap.docs.map((d) => d.data() as RegisteredFood);

      return textResult({
        registered: searchFoods(registered, query, 10).map((f) => ({
          id: f.id,
          name: f.name,
          per: `${f.baseAmount}${f.unit}あたり`,
          unit: f.unit,
          baseAmount: f.baseAmount,
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
