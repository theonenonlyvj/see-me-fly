/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './', // relative asset paths so the built file works under file://
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/test/**/*.test.ts', 'src/test/**/*.test.tsx'],
  },
})
