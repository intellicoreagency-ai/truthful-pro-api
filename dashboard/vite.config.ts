import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/staff/v1': 'http://localhost:8788', '/health': 'http://localhost:8788' } },
  build: { sourcemap: false, target: 'es2022', assetsInlineLimit: 0 },
})
