import { useMemo, useState } from 'react'
import './app/styles/tokens.css'
import './app/styles/base.css'
import Dropzone from './app/components/Dropzone'
import TopBar from './app/components/TopBar'
import SettingsPanel from './app/components/SettingsPanel'
import CardGrid from './app/components/CardGrid'
import { OverlayProvider } from './app/components/Overlay'
import { useSettings } from './app/state/useSettings'
import { useModel } from './app/state/useModel'
import { loadCsv, saveCsv, clearCsv } from './app/state/csv-store'

export default function App() {
  const [csv, setCsv] = useState<{ text: string; name: string } | null>(() => loadCsv())
  const [scope, setScope] = useState<number | undefined>(undefined)
  const [showSettings, setShowSettings] = useState(false)
  const [settings, update, reset] = useSettings()
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const model = useModel(csv?.text ?? null, settings, today, scope)

  if (!csv || !model) {
    return <Dropzone onLoaded={(text, name, remember) => {
      if (remember) saveCsv(name, text); else clearCsv()
      setCsv({ text, name }); setScope(undefined)
    }} />
  }

  return (
    <OverlayProvider>
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'var(--bg)' }}>
        <TopBar fileName={csv.name} years={model.years} scope={scope} onScope={setScope} onToggleSettings={() => setShowSettings((v) => !v)} />
      </div>
      {showSettings && (
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
      <CardGrid model={model} settings={settings} update={update} />
    </OverlayProvider>
  )
}
