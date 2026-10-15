import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // スマホのホーム画面に追加して、アプリのように使えるようにする（PWA）
    VitePWA({
      // 新しいバージョンを公開したら、次に開いたときに自動で入れ替える
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'body-log',
        short_name: 'body-log',
        description: '食事のカロリー・PFCと、体重・体脂肪率を記録するアプリ',
        lang: 'ja',
        start_url: '/',
        display: 'standalone', // ブラウザのアドレスバーを出さず、アプリのように表示する
        background_color: '#f3f6f4',
        theme_color: '#1f6b4f',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          // Android で丸や角丸に切り抜かれても欠けないアイコン
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // 画面のファイル（JS・CSS・画像）を保存しておき、2回目からすぐ開けるようにする
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        // Claude連携のサーバー（/api/）は、保存した画面に置きかえない
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
})
