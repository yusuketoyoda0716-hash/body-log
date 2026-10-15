import type { Goals } from '../types/index.js'; // サーバー（api/mcp.ts）からも読み込むので拡張子付きで書く

// 1日の目標の初期値（まだ目標を保存していない人に使う）
// ブラウザとサーバー（api/mcp.ts）の両方から読み込むので、ほかのファイルに依存しない形にしている
export const defaultGoals: Goals = {
  kcal: { min: 1600, max: 1800 },
  protein: { min: 120, max: 150 },
  fat: { min: 30, max: 40 },
  carbs: { min: 180, max: 240 },
};
