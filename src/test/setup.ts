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

// jsdom doesn't implement ResizeObserver; CardGrid's masonry uses it. Install a no-op
// so component tests render without crashing (layout/height behavior isn't exercised in jsdom).
if (typeof document !== 'undefined' && typeof (globalThis as Record<string, unknown>).ResizeObserver === 'undefined') {
  ;(globalThis as Record<string, unknown>).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// Node 26 defines `globalThis.localStorage` as a getter returning `undefined`,
// which prevents vitest's jsdom environment from installing jsdom's localStorage.
// Re-install from the jsdom instance (set by vitest as `globalThis.jsdom`) so
// tests can use `localStorage` directly. Guarded so node-env files are unaffected.
if (typeof document !== 'undefined') {
  const jsdomInstance = (globalThis as Record<string, unknown>).jsdom as { window?: { localStorage?: Storage; sessionStorage?: Storage } } | undefined
  if (jsdomInstance?.window?.localStorage) {
    Object.defineProperty(globalThis, 'localStorage', {
      value: jsdomInstance.window.localStorage,
      writable: true,
      configurable: true,
    })
  }
  if (jsdomInstance?.window?.sessionStorage) {
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: jsdomInstance.window.sessionStorage,
      writable: true,
      configurable: true,
    })
  }
}
