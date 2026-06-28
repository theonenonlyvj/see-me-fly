/** Departures and arrivals overlaid on ONE shared 24-hour axis (grouped twin bars per hour). */
export default function OverlayHistogram({ dep, arr, depColor, arrColor }: { dep: number[]; arr: number[]; depColor: string; arrColor: string }) {
  const peak = Math.max(...dep, ...arr, 1)
  const ticks: Record<number, string> = { 0: '12am', 6: '6am', 12: '12pm', 18: '6pm' }
  return (
    <div style={{ fontFamily: 'var(--font)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 92 }}>
        {dep.map((_, h) => (
          <div key={h} style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 1 }}>
            <div title={`Departures ${h}:00 — ${dep[h]}`} style={{ width: '46%', height: `${Math.max((dep[h] / peak) * 100, dep[h] > 0 ? 4 : 0)}%`, background: depColor, borderRadius: '2px 2px 0 0' }} />
            <div title={`Arrivals ${h}:00 — ${arr[h]}`} style={{ width: '46%', height: `${Math.max((arr[h] / peak) * 100, arr[h] > 0 ? 4 : 0)}%`, background: arrColor, borderRadius: '2px 2px 0 0' }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', position: 'relative', height: 14, marginTop: 4 }}>
        {Object.entries(ticks).map(([h, lbl]) => (
          <div key={h} style={{ position: 'absolute', left: `${(Number(h) / 23) * 100}%`, fontSize: 10, color: 'var(--ink-2)', transform: 'translateX(-50%)' }}>{lbl}</div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: 'var(--ink-2)' }}><span style={{ width: 10, height: 10, borderRadius: 3, background: depColor }} />Departures</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: 'var(--ink-2)' }}><span style={{ width: 10, height: 10, borderRadius: 3, background: arrColor }} />Arrivals</span>
      </div>
    </div>
  )
}
