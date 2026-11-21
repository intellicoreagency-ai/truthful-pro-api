import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
// Unit tests for the staff dashboard: components render in jsdom against a fake API (no server, no network).
export default defineConfig({ plugins: [react()], test: { environment: 'jsdom', include: ['test/**/*.test.{ts,tsx}'], restoreMocks: true } })
