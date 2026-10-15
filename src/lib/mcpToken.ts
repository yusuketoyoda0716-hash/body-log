import { doc, getDoc, getFirestore, writeBatch } from 'firebase/firestore';
import { app } from './firebase';

// Claude連携のトークン（接続用URLに入れる合言葉）を扱う
//
// Firestore には「トークンそのもの」ではなく「ハッシュ値」だけを保存する。
// データベースの中身を見られても、そこから接続用URLは作れない。
//
//   mcpTokens/{ハッシュ値}         … サーバーがトークンから uid を探すための表
//   users/{uid}/settings/mcp       … 自分が連携中かどうかを画面に出すための情報

const db = getFirestore(app);

export type McpConnection = {
  tokenHash: string;
  createdAt: string; // ISO形式の日時
};

function settingsDoc(uid: string) {
  return doc(db, 'users', uid, 'settings', 'mcp');
}

function tokenDoc(tokenHash: string) {
  return doc(db, 'mcpTokens', tokenHash);
}

// 推測できないランダムな文字列を作る（32バイト = 256ビット）
function createToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  // URLにそのまま入れられる形（base64url）にする
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// SHA-256 のハッシュ値（16進数の文字列）にする
async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function getMcpConnection(uid: string): Promise<McpConnection | null> {
  const snap = await getDoc(settingsDoc(uid));
  return snap.exists() ? (snap.data() as McpConnection) : null;
}

// トークンを発行する（すでにあれば古いものを無効にして作り直す）
// 戻り値のトークンは、このときしか分からない（保存するのはハッシュ値だけ）
export async function issueMcpToken(uid: string): Promise<string> {
  const current = await getMcpConnection(uid);
  const token = createToken();
  const tokenHash = await sha256(token);
  const createdAt = new Date().toISOString();

  // 古いトークンの削除と新しいトークンの登録を、まとめて1回で行う
  const batch = writeBatch(db);
  if (current) batch.delete(tokenDoc(current.tokenHash));
  batch.set(tokenDoc(tokenHash), { uid, createdAt });
  batch.set(settingsDoc(uid), { tokenHash, createdAt });
  await batch.commit();

  return token;
}

// 連携を解除する（トークンを無効にする）
export async function revokeMcpToken(uid: string): Promise<void> {
  const current = await getMcpConnection(uid);
  if (!current) return;
  const batch = writeBatch(db);
  batch.delete(tokenDoc(current.tokenHash));
  batch.delete(settingsDoc(uid));
  await batch.commit();
}
