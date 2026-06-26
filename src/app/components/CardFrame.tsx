import type { ReactNode } from 'react'

export default function CardFrame({ title, children, footer }: { title: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <section style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 'var(--pad)' }}>
      <h2 style={{ margin: '0 0 12px', fontSize: 15, color: 'var(--text-dim)', fontWeight: 600, letterSpacing: 0.2 }}>{title}</h2>
      {children}
      {footer && <div style={{ marginTop: 12 }}>{footer}</div>}
    </section>
  )
}
