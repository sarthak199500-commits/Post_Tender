import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
    // Vitest owns unit tests under src/; Playwright owns ./tests (see playwright.config.ts
    // testDir). Without this, vitest's default glob also picks up the Playwright specs and
    // fails on their fixture API ({ page, isMobile }), which vitest cannot provide.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules/**', 'dist/**', 'tests/**'],
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
