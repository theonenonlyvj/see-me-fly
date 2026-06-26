import { useMemo, useState } from 'react'
import './app/styles/tokens.css'
import './app/styles/base.css'
import Dropzone from './app/components/Dropzone'
import TopBar from './app/components/TopBar'
import SettingsPanel from './app/components/SettingsPanel'
import CardGrid from './app/components/CardGrid'
import { useSettings } from './app/state/useSettings'
import { useModel } from './app/state/useModel'

export default function App() {
  const [csv, setCsv] = useState<{ text: string; name: string } | null>(null)
  const [scope, setScope] = useState<number | undefined>(undefined)
  const [showSettings, setShowSettings] = useState(false)
  const [settings, update, reset] = useSettings()
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const model = useModel(csv?.text ?? null, settings, today, scope)

  if (!csv || !model) {
    return <Dropzone onLoaded={(text, name) => { setCsv({ text, name }); setScope(undefined) }} />
  }

  return (
    <div>
      <TopBar fileName={csv.name} years={model.years} scope={scope} onScope={setScope} onToggleSettings={() => setShowSettings((v) => !v)} />
      {showSettings && (
        <div style={{ padding: 'var(--pad)' }}>
          <SettingsPanel settings={settings} update={update} reset={reset} flown={model.flown}
            onReplace={() => { setCsv(null); setScope(undefined); setShowSettings(false) }} />
        </div>
      )}
      <CardGrid model={model} settings={settings} />
    </div>
  )
}
