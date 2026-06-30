// Tracks whether the user dismissed the one-time "set your home airport" prompt that appears on the
// loaded dashboard when no home is set. Stored ONLY in the user's browser (localStorage). Setting a
// home makes the prompt go away on its own (hasHome becomes true); this flag covers "Skip for now".

export const HOME_PROMPT_DISMISSED_KEY = 'smf:home-prompt-dismissed'

function safeStorage(storage?: Storage): Storage | null {
  if (storage) return storage
  try { return window.localStorage } catch { return null }
}

export function isHomePromptDismissed(storage?: Storage): boolean {
  const s = safeStorage(storage)
  if (!s) return false
  return s.getItem(HOME_PROMPT_DISMISSED_KEY) === '1'
}

export function dismissHomePrompt(storage?: Storage): void {
  const s = safeStorage(storage)
  if (!s) return
  try { s.setItem(HOME_PROMPT_DISMISSED_KEY, '1') } catch { /* quota — ignore */ }
}
