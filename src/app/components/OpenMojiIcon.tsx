import type { CSSProperties } from 'react'

/**
 * Renders an emoji as its bundled OpenMoji COLOR svg (consistent across devices,
 * vector, on-theme). The svgs live UNMODIFIED under src/assets/openmoji/ (CC BY-SA
 * 4.0 — see the attribution in SettingsPanel). They're inlined at build time via the
 * glob below, so the app stays offline / single-file (no runtime fetch).
 *
 * Filename rule mirrors scripts/preprocess/fetch-openmoji.mjs: codepoints, FE0F
 * (VS-16) dropped, hex-upper-padded(4), '-' joined. If no bundled file matches we
 * fall back to rendering the raw emoji text, so an unmapped icon still shows.
 */

// Bundles ONLY our ~33 files (keyed by relative path), inlined as raw svg strings.
const SVGS = import.meta.glob('../../assets/openmoji/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/** OpenMoji name for an emoji: codepoints, FE0F stripped, hex-upper-padded(4), '-' joined. */
function openMojiName(emoji: string): string {
  return [...emoji]
    .map((c) => c.codePointAt(0)!)
    .filter((cp) => cp !== 0xfe0f)
    .map((cp) => cp.toString(16).toUpperCase().padStart(4, '0'))
    .join('-')
}

export default function OpenMojiIcon({ emoji, size = 22 }: { emoji: string; size?: number }) {
  const svg = SVGS[`../../assets/openmoji/${openMojiName(emoji)}.svg`]

  if (!svg) {
    // Fallback: render the raw emoji text (line-height keeps it centered in its box).
    return (
      <span
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, fontSize: Math.round(size * 0.9), lineHeight: 1 }}
        aria-hidden
      >
        {emoji}
      </span>
    )
  }

  const wrapStyle: CSSProperties = {
    display: 'inline-flex',
    width: size,
    height: size,
    flexShrink: 0,
  }
  // The inner svg fills the box. Scoped via a data-attr so it only targets our svg.
  return (
    <span
      className="openmoji-icon"
      style={wrapStyle}
      aria-hidden
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
