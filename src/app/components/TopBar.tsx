import ScopeDropdown from './ScopeDropdown'

export default function TopBar({ fileName, years, scope, onScope, onToggleSettings }: {
  fileName: string; years: number[]; scope: number | undefined; onScope: (y: number | undefined) => void; onToggleSettings: () => void
}) {
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 50,
      backdropFilter: 'saturate(1.7) blur(13px)',
      WebkitBackdropFilter: 'saturate(1.7) blur(13px)',
      background: 'rgba(247,243,236,0.72)',
      borderBottom: '1px solid var(--hair)',
    }}>
      <div style={{
        maxWidth: 1280, margin: '0 auto',
        padding: '14px 28px',
        display: 'flex', alignItems: 'center', gap: 18,
      }}>
        {/* brand */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, minWidth: 0 }}>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 24,
            letterSpacing: '-0.012em',
            lineHeight: 1,
            whiteSpace: 'nowrap',
            background: 'linear-gradient(95deg, #ff3d57 0%, #ff7a14 22%, #12c08a 46%, #1aa9ff 64%, #6a3cff 82%, #ff2fa8 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            color: 'transparent',
          }}>
            <span style={{ WebkitTextFillColor: 'var(--coral)', color: 'var(--coral)', marginRight: 5, filter: 'drop-shadow(0 2px 7px rgba(255,61,87,0.45))' }}>✈</span>
            See-Me-Fly
          </span>
          {fileName && (
            <span style={{
              fontSize: 12, color: 'var(--ink-2)', fontWeight: 600,
              padding: '4px 10px',
              border: '1px solid var(--hair)',
              borderRadius: 999,
              background: '#fff',
              whiteSpace: 'nowrap',
            }}>{fileName}</span>
          )}
        </div>

        <span style={{ flex: 1 }} />

        {/* scope dropdown styled as a control pill */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          fontSize: 13.5, fontWeight: 700,
          background: '#fff',
          border: '1px solid color-mix(in srgb, var(--indigo) 26%, var(--hair))',
          borderRadius: 12, padding: '8px 13px',
          color: 'var(--indigo)',
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'linear-gradient(135deg, var(--magenta), var(--indigo))', boxShadow: '0 0 0 3px var(--indigo-soft)', display: 'inline-block' }} />
          <ScopeDropdown years={years} value={scope} onChange={onScope} />
        </div>

        <button onClick={onToggleSettings} style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          fontSize: 13.5, fontWeight: 700,
          color: 'var(--ink)',
          background: '#fff',
          border: '1px solid var(--hair)',
          borderRadius: 12,
          padding: '8px 13px',
        }}>⚙ Settings</button>
      </div>
    </header>
  )
}
