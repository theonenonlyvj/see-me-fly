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
export function fmtCount(n: number, noun: string): string {
  return `${fmtInt(n)} ${noun}${n === 1 ? '' : 's'}`
}
