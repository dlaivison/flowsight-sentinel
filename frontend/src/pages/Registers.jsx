import { useState, lazy, Suspense } from 'react'

const Guards   = lazy(() => import('./Guards'))
const Posts    = lazy(() => import('./Posts'))
const Shifts   = lazy(() => import('./Shifts'))
const Settings = lazy(() => import('./Settings'))

const TABS = [
  { key:'guards',   label:'👤 Vigilantes' },
  { key:'posts',    label:'📍 Postos'     },
  { key:'shifts',   label:'🕐 Turnos'     },
  { key:'settings', label:'⚙ Parâmetros' },
]

export default function Registers() {
  const [tab, setTab] = useState('guards')
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {/* Header */}
      <div style={{ padding:'16px 24px', borderBottom:'1px solid var(--border-subtle)', background:'var(--bg-secondary)' }}>
        <div style={{ fontSize:22, fontWeight:700, letterSpacing:'-0.5px' }}>Cadastros</div>
        <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>Vigilantes, postos, turnos e parâmetros do sistema</div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'1px solid var(--border-subtle)', background:'var(--bg-secondary)', padding:'0 24px' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding:'10px 20px', border:'none', background:'transparent',
            color: tab===t.key ? 'var(--green)' : 'var(--text-muted)',
            fontSize:13, fontWeight: tab===t.key ? 700 : 400, cursor:'pointer',
            borderBottom: tab===t.key ? '2px solid var(--green)' : '2px solid transparent',
            marginBottom:-1,
          }}>{t.label}</button>
        ))}
      </div>

      {/* Conteúdo — renderiza a página filha sem o header dela */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <Suspense fallback={<div style={{ padding:40, color:'var(--text-muted)', fontSize:13 }}>Carregando...</div>}>
          {tab === 'guards'   && <Guards embedded/>}
          {tab === 'posts'    && <Posts  embedded/>}
          {tab === 'shifts'   && <Shifts embedded/>}
          {tab === 'settings' && <Settings embedded/>}
        </Suspense>
      </div>
    </div>
  )
}
