import { useEffect, useMemo, useState } from 'react'
import './app/styles/tokens.css'
import './app/styles/base.css'
import Dropzone from './app/components/Dropzone'
import TopBar from './app/components/TopBar'
import SettingsPanel from './app/components/SettingsPanel'
import CardGrid from './app/components/CardGrid'
import HomePrompt from './app/components/HomePrompt'
import { OverlayProvider } from './app/components/Overlay'
import { useSettings } from './app/state/useSettings'
import { useModel } from './app/state/useModel'
import { loadCsv, saveCsv, clearCsv } from './app/state/csv-store'
import { isHomePromptDismissed, dismissHomePrompt } from './app/state/home-prompt-store'
import { loadSharedLife, shareCodeFromUrl, type SharedPayload } from './app/state/shared-life'
import { parseHomesCsv, parseLinksCsv } from './app/lib/see-me-fly-csv'
import { hasHome } from './engine/home'
import { DEFAULT_SETTINGS, type Settings } from './engine'

/** Build the read-only settings for a shared view from its decrypted homes/links CSVs. */
function buildSharedSettings(payload: SharedPayload): Settings {
  const eras = parseHomesCsv(payload.homesCsv || '').eras
  const links = parseLinksCsv(payload.linksCsv || '').links
  const home = eras.length ? eras[eras.length - 1].airports[0] : null
  return { ...DEFAULT_SETTINGS, homeHistory: eras, groundLinks: links, home }
}

function SharedBanner({ onExit }: { onExit: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap',
      padding: '9px 18px', fontSize: 13, fontWeight: 600,
      background: 'var(--grad-hero)', color: '#fff',
    }}>
      <span>✦ You&apos;re viewing <b>Vijay&apos;s</b> shared flight-life — read-only.</span>
      <button onClick={onExit} style={{ background: 'rgba(255,255,255,0.22)', color: '#fff', border: '1px solid rgba(255,255,255,0.5)', borderRadius: 8, padding: '4px 12px', fontWeight: 700, cursor: 'pointer' }}>
        Exit
      </button>
    </div>
  )
}

export default function App() {
  const [csv, setCsv] = useState<{ text: string; name: string } | null>(() => loadCsv())
  const [scope, setScope] = useState<number | undefined>(undefined)
  const [showSettings, setShowSettings] = useState(false)
  const [settings, update, reset] = useSettings()
  const [homePromptDismissed, setHomePromptDismissed] = useState(() => isHomePromptDismissed())
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])

  // ── shared "life view": encrypted, code-gated, read-only ──
  const [shared, setShared] = useState<SharedPayload | null>(null)
  // ephemeral view tweaks a visitor makes (scope/toggles) — never persisted
  const [sharedOverrides, setSharedOverrides] = useState<Partial<Settings>>({})
  const [unlocking, setUnlocking] = useState<boolean>(() => shareCodeFromUrl() != null)

  useEffect(() => {
    const code = shareCodeFromUrl()
    if (!code) return
    loadSharedLife(code).then((p) => { if (p) setShared(p); setUnlocking(false) })
  }, [])

  const sharedSettings = useMemo(
    () => (shared ? { ...buildSharedSettings(shared), ...sharedOverrides } : null),
    [shared, sharedOverrides],
  )

  const effectiveCsv = shared ? shared.flightsCsv : (csv?.text ?? null)
  const effectiveSettings = sharedSettings ?? settings
  const model = useModel(effectiveCsv, effectiveSettings, today, scope)

  const sharedMode = shared != null
  const showHomePrompt = !sharedMode && !hasHome(settings) && !homePromptDismissed

  const exitShared = () => {
    setShared(null); setSharedOverrides({}); setScope(undefined)
    try { window.history.replaceState(null, '', window.location.pathname) } catch { /* ignore */ }
  }
  const tryUnlock = async (code: string): Promise<boolean> => {
    const p = await loadSharedLife(code)
    if (p) { setShared(p); return true }
    return false
  }
  // In a shared view, edits tweak an ephemeral copy (never touch the visitor's own saved settings).
  const effectiveUpdate = sharedMode ? (patch: Partial<Settings>) => setSharedOverrides((o) => ({ ...o, ...patch })) : update

  // Decrypting a share link — brief hold so we don't flash the dropzone.
  if (unlocking && !model) {
    return <div style={{ display: 'grid', placeItems: 'center', height: '100vh', color: 'var(--text-dim)', fontFamily: 'var(--font)' }}>Unlocking shared view…</div>
  }

  if (!model) {
    return <Dropzone
      onLoaded={(text, name, remember) => { if (remember) saveCsv(name, text); else clearCsv(); setCsv({ text, name }); setScope(undefined) }}
      onUnlock={tryUnlock}
    />
  }

  return (
    <OverlayProvider>
      {sharedMode && <SharedBanner onExit={exitShared} />}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'var(--bg)' }}>
        <TopBar
          fileName={sharedMode ? "Vijay's flight-life · shared" : (csv?.name ?? 'flights')}
          years={model.years} scope={scope} onScope={setScope}
          onToggleSettings={sharedMode ? undefined : () => setShowSettings((v) => !v)} />
      </div>
      {!sharedMode && showSettings && (
        <>
          <div onClick={() => setShowSettings(false)} style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(20,16,24,0.35)' }} />
          <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(380px, 92vw)', zIndex: 45, background: 'var(--bg-elev)', borderLeft: '1px solid var(--border)', boxShadow: '-14px 0 44px -18px rgba(0,0,0,0.45)', overflow: 'auto', padding: 'var(--pad)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <strong style={{ fontSize: 15 }}>Settings</strong>
              <button onClick={() => setShowSettings(false)} aria-label="Close" style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-dim)' }}>✕</button>
            </div>
            <SettingsPanel settings={settings} update={update} reset={reset} flown={model.flown}
              onReplace={() => { clearCsv(); setCsv(null); setScope(undefined); setShowSettings(false) }} />
          </div>
        </>
      )}
      {showHomePrompt && (
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '14px 28px 0' }}>
          <HomePrompt
            update={update}
            onSkip={() => { dismissHomePrompt(); setHomePromptDismissed(true) }}
          />
        </div>
      )}
      <CardGrid model={model} settings={effectiveSettings} update={effectiveUpdate} />
    </OverlayProvider>
  )
}
