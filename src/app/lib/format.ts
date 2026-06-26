export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString('en-US')
}
export function fmtMiles(n: number): string {
  return `${fmtInt(n)} mi`
}
export function fmtDuration(min: number | null): string {
  if (min === null || !Number.isFinite(min)) return '—'
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
export function fmtDurationDays(min: number | null): string {
  if (min === null || !Number.isFinite(min)) return '—'
  const totalH = Math.floor(min / 60)
  const d = Math.floor(totalH / 24)
  const h = totalH % 24
  if (d > 0) return `${d}d ${h}h`
  return `${h}h`
}
export function fmtCount(n: number, noun: string): string {
  return `${fmtInt(n)} ${noun}${n === 1 ? '' : 's'}`
}

/**
 * Convert a 2-letter ISO 3166-1 alpha-2 country code to a flag emoji.
 * Returns '' for unknown codes.
 */
export function flagEmoji(country: string): string {
  if (!country || country.length !== 2) return ''
  const code = country.toUpperCase()
  // A = 0x41, Regional Indicator A = 0x1F1E6
  const offset = 0x1F1E6 - 0x41
  const chars = [...code].map((c) => String.fromCodePoint(c.codePointAt(0)! + offset))
  return chars.join('')
}

/** Vivid palette for monograms (deterministic by hash). */
const MONO_COLORS = [
  'linear-gradient(135deg,#ff3d57,#ff7a14)',
  'linear-gradient(135deg,#12c08a,#3ad6c0)',
  'linear-gradient(135deg,#1aa9ff,#5ad0ff)',
  'linear-gradient(135deg,#6a3cff,#9a6bff)',
  'linear-gradient(135deg,#ff2fa8,#6a3cff)',
  'linear-gradient(135deg,#ff7a14,#ffb347)',
]

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function monogram(name: string): { initials: string; color: string } {
  const words = name.trim().split(/\s+/).filter(Boolean)
  let initials: string
  if (words.length === 0) {
    initials = '?'
  } else if (words.length === 1) {
    initials = words[0].slice(0, 2).toUpperCase()
  } else {
    initials = (words[0][0] + words[words.length - 1][0]).toUpperCase()
  }
  const color = MONO_COLORS[hashString(name) % MONO_COLORS.length]
  return { initials, color }
}
