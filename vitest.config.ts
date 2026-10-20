import { defineConfig } from 'vitest/config';

// 単体テストの設定。画面ではなく計算・日付・検索のような中身の処理をテストするので、node で動かす
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
