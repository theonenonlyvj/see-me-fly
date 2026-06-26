import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'

// Global RTL cleanup. The default env is `node` (engine tests); component tests
// opt into jsdom per-file via `// @vitest-environment jsdom`. RTL's auto-cleanup
// doesn't register under that split, so unmount rendered trees ourselves after
// every test. Guarded + dynamically imported so node-env tests never load RTL.
afterEach(async () => {
  if (typeof document !== 'undefined') {
    const { cleanup } = await import('@testing-library/react')
    cleanup()
  }
})
