import type { ReactNode, CSSProperties } from 'react'
import OpenMojiIcon from './OpenMojiIcon'
import { useOverlay } from './Overlay'

const cardStyle: CSSProperties = {
  position: 'relative',
  background: 'var(--card)',
  border: '1px solid var(--hair)',
  borderRadius: 'var(--radius)',
  padding: '28px 26px 30px',
  marginBottom: '24px',
  boxShadow: 'var(--shadow)',
  overflow: 'hidden',
  breakInside: 'avoid',
  pageBreakInside: 'avoid',
}

export function QuickToggle({ label, checked, onChange, accent }: { label: string; checked: boolean; onChange: (v: boolean) => void; accent?: string }) {
  return (
    <label onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ accentColor: accent ?? 'var(--coral)' }} />
      {label}
    </label>
  )
}

export default function CardFrame({
  title, children, footer, accent, accentGrad, accentSoft, icon, eyebrow, fullWidth, onTitleClick, controls, poppable, popBody,
}: {
  title: string
  children: ReactNode
  footer?: ReactNode
  accent?: string
  accentGrad?: string
  accentSoft?: string
  icon?: string
  eyebrow?: string
  fullWidth?: boolean
  /** makes the header clickable → opens a subset view (with a ↗ affordance) */
  onTitleClick?: () => void
  /** small inline controls (quick toggles) rendered on the right of the header */
  controls?: ReactNode
  /** show a "⤢ pop out" affordance that enlarges this card's chart in a wide modal */
  poppable?: boolean
  /** optional richer body to show in the pop-out (e.g. an interactive explorer) instead of the inline chart */
  popBody?: ReactNode
}) {
  const grad = accentGrad ?? `linear-gradient(90deg, ${accent ?? 'var(--coral)'}, ${accent ?? 'var(--coral)'})`
  const soft = accentSoft ?? 'var(--hair-2)'
  const acc  = accent ?? 'var(--coral)'

  const overlay = useOverlay()
  // Pop-out is available only when no other title action is wired (maps use onTitleClick).
  const canPop = poppable && !onTitleClick
  const popOut = () => overlay.openWide(title, popBody ?? <>{children}{footer}</>, eyebrow)
  const headerClick = onTitleClick ?? (canPop ? popOut : undefined)

  const sectionStyle: CSSProperties = fullWidth
    ? { ...cardStyle, columnSpan: 'all', breakInside: 'auto' }
    : cardStyle

  return (
    <section style={sectionStyle}>
      {/* top accent strip */}
      <div style={{
        position: 'absolute', left: 0, right: 0, top: 0, height: 6,
        background: grad,
      }} />
      {/* corner bloom */}
      <div style={{
        position: 'absolute', top: -78, right: -56,
        width: 240, height: 240, borderRadius: '50%',
        background: acc, filter: 'blur(58px)',
        opacity: 0.22, pointerEvents: 'none',
      }} />
      {/* bottom-left secondary bloom */}
      <div style={{
        position: 'absolute', bottom: -70, left: -50,
        width: 170, height: 170, borderRadius: '50%',
        background: acc, filter: 'blur(56px)',
        opacity: 0.12, pointerEvents: 'none',
      }} />

      {/* card header */}
      <div
        onClick={headerClick}
        role={headerClick ? 'button' : undefined}
        title={canPop && !onTitleClick ? 'Click to pop out' : undefined}
        style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 22, position: 'relative', cursor: headerClick ? 'pointer' : undefined }}>
        {icon && (
          <div style={{
            width: 42, height: 42, flexShrink: 0,
            display: 'grid', placeItems: 'center',
            fontSize: 20, borderRadius: 14,
            background: soft,
            border: `1px solid color-mix(in srgb, ${acc} 30%, transparent)`,
            boxShadow: `0 8px 18px -8px color-mix(in srgb, ${acc} 70%, transparent)`,
          }}><OpenMojiIcon emoji={icon} size={34} /></div>
        )}
        <div>
          {eyebrow && (
            <span style={{
              display: 'block',
              fontFamily: 'var(--font)',
              fontSize: 11, fontWeight: 800,
              letterSpacing: '0.15em', textTransform: 'uppercase',
              marginBottom: 3,
              background: grad,
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              color: 'transparent',
            }}>{eyebrow}</span>
          )}
          <h2 style={{
            margin: 0,
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: 22,
            letterSpacing: '-0.016em',
            lineHeight: 1.1,
            color: 'var(--ink)',
          }}>{title}</h2>
        </div>
        {(controls || onTitleClick || canPop) && (
          <div onClick={(e) => e.stopPropagation()} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            {controls}
            {onTitleClick && <span onClick={onTitleClick} style={{ fontSize: 12, color: acc, fontWeight: 800, whiteSpace: 'nowrap', cursor: 'pointer' }}>↗ map</span>}
            {canPop && <span onClick={popOut} title="Pop out to a larger view" style={{ fontSize: 11.5, color: acc, fontWeight: 800, whiteSpace: 'nowrap', cursor: 'pointer', opacity: 0.85 }}>⤢ pop out</span>}
          </div>
        )}
      </div>

      {children}
      {footer && <div style={{ marginTop: 16 }}>{footer}</div>}
    </section>
  )
}
