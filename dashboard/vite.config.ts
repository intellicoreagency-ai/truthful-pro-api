import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  // allowedHosts: GitHub Codespaces serves the dev server on *.app.github.dev; Vite blocks unknown hosts otherwise.
  server: { port: 5173, host: true, allowedHosts: ['.app.github.dev', '.githubpreview.dev'], proxy: { '/staff/v1': 'http://localhost:8788', '/health': 'http://localhost:8788' } },
  build: { sourcemap: false, target: 'es2022', assetsInlineLimit: 0 },
})
