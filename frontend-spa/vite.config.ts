import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  server: {
    // En desarrollo, /graphql se reenvía al Gateway (en Docker lo hace Nginx).
    proxy: {
      '/graphql': { target: 'http://localhost:4000', ws: true },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
