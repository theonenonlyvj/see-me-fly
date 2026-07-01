// Runtime side of the encrypted "shared life view". A visitor with the code decrypts `life.enc`
// (AES-GCM, PBKDF2 key) IN THEIR BROWSER via Web Crypto — the plaintext never touches a server, and
// a wrong code just fails the GCM auth (returns null). See scripts/preprocess/build-shared-life.mjs.

export interface SharedPayload {
  flightsCsv: string
  homesCsv: string
  linksCsv: string
}

interface EncBlob { v: number; iter: number; salt: string; iv: string; ct: string }

// Fresh ArrayBuffer-backed Uint8Array (satisfies Web Crypto's BufferSource typing on TS 5.7+).
function b64ToBytes(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
function strBytes(s: string): Uint8Array<ArrayBuffer> {
  const src = new TextEncoder().encode(s)
  const out = new Uint8Array(src.length)
  out.set(src)
  return out
}

/** The share code from the URL (`?k=` or `#k=`), or null. */
export function shareCodeFromUrl(): string | null {
  try {
    const q = new URLSearchParams(window.location.search).get('k')
    if (q) return q
    const h = window.location.hash.replace(/^#/, '')
    const hp = new URLSearchParams(h).get('k')
    return hp || null
  } catch { return null }
}

/**
 * Fetch + decrypt the shared blob with `code`. Returns the sanitized payload, or null when there is
 * no blob, the code is wrong, or crypto is unavailable — callers fall back to the normal dropzone.
 */
export async function loadSharedLife(code: string): Promise<SharedPayload | null> {
  try {
    if (!code || !globalThis.crypto?.subtle) return null
    const res = await fetch(new URL('life.enc', document.baseURI), { cache: 'no-store' })
    if (!res.ok) return null
    const blob = (await res.json()) as EncBlob
    const baseKey = await crypto.subtle.importKey('raw', strBytes(code), 'PBKDF2', false, ['deriveKey'])
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: b64ToBytes(blob.salt), iterations: blob.iter, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt'],
    )
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBytes(blob.iv) }, key, b64ToBytes(blob.ct))
    const parsed = JSON.parse(new TextDecoder().decode(pt))
    if (typeof parsed?.flightsCsv !== 'string') return null
    return { flightsCsv: parsed.flightsCsv, homesCsv: parsed.homesCsv ?? '', linksCsv: parsed.linksCsv ?? '' }
  } catch {
    return null // wrong code (GCM auth fail), no blob, or malformed → fall back gracefully
  }
}
