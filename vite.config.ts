import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === 'production' ? '/estate/' : '/',
  server: {
    port: 3111,
    host: true, // コンテナ外からのアクセスを許可
  },
  build: {
    outDir: 'build',
    sourcemap: true,
  },
  assetsInclude: ['**/*.xlsx', '**/*.xls']
})
