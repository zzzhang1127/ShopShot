import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const repoRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..')

// https://vite.dev/config/
export default defineConfig({
  // 与后端共用项目根目录 .env（仅需维护一份）
  envDir: repoRoot,
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/files': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: true,
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/files': { target: 'http://127.0.0.1:8000', changeOrigin: true },
    },
  },
})
