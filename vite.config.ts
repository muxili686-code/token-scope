import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // 相对路径：兼容 GitHub Pages 子路径(/token-scope/)与任意静态托管目录
  base: './',
  plugins: [react(), tailwindcss()],
  server: { host: '0.0.0.0', port: 5173 },
})
