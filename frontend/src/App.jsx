import './theme.css'
import { useEffect, useState, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom'
import { useFlowStore } from './store'
import { login as apiLogin } from './api'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Guards     = lazy(() => import('./pages/Guards'))
const Posts      = lazy(() => import('./pages/Posts'))
const History    = lazy(() => import('./pages/History'))
const Settings   = lazy(() => import('./pages/Settings'))
const Registers  = lazy(() => import('./pages/Registers'))
const Operation      = lazy(() => import('./pages/Operation'))
const Reports        = lazy(() => import('./pages/Reports'))
const DailyOperation = lazy(() => import('./pages/DailyOperation'))
const Shifts     = lazy(() => import('./pages/Shifts'))

// ── Ícones ────────────────────────────────────────────────────
const I = {
  dashboard: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  guards:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  posts:     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  history:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  settings:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>,
  whatsapp:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  shifts:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/><line x1="12" y1="2" x2="12" y2="4"/></svg>,
  lock:      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  logout:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  shield:    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
}

const NAV = [
  { to:'/dashboard', label:'Dashboard',  icon: I.dashboard },
  { to:'/operation',       label:'Monitoramento', icon: I.dashboard },
  { to:'/daily-operation', label:'Alocação',     icon: I.shifts    },
  { to:'/history',   label:'Histórico',  icon: I.history   },
  { to:'/reports',   label:'Relatórios', icon: I.history   },
  { to:'/registers', label:'Cadastros',  icon: I.posts     },

]

function Sidebar() {
  const { user, logout, summary } = useFlowStore()
  const navigate = useNavigate()

  return (
    <nav style={{
      width: 220, flexShrink: 0,
      background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border-subtle)',
      display: 'flex', flexDirection: 'column',
      height: '100vh',
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 48, height: 48, flexShrink: 0 }}>
            <img src="/logo.png" alt="FlowSight Sentinel" style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>FlowSight</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '1px', textTransform: 'uppercase' }}>Sentinel</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div style={{ padding: '12px 8px', flex: 1, overflowY: 'auto' }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', padding: '0 8px 8px' }}>Principal</div>
        {NAV.map(n => (
          <NavLink key={n.to} to={n.to} style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 10px', borderRadius: 'var(--radius-sm)',
            marginBottom: 2, textDecoration: 'none',
            color: isActive ? 'var(--green)' : 'var(--text-secondary)',
            background: isActive ? 'var(--green-dim)' : 'transparent',
            fontWeight: isActive ? 600 : 400,
            fontSize: 13, transition: 'all .15s',
            border: isActive ? '1px solid rgba(0,208,132,0.2)' : '1px solid transparent',
          })}>
            {n.icon}
            <span style={{ flex: 1 }}>{n.label}</span>
            {n.to === '/dashboard' && summary.alarm > 0 && (
              <span style={{
                background: 'var(--red)', color: '#fff',
                borderRadius: 20, fontSize: 10, fontWeight: 700,
                padding: '1px 7px', animation: 'pulse-red 1.5s infinite',
              }}>{summary.alarm}</span>
            )}
          </NavLink>
        ))}

        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', padding: '12px 8px 8px' }}>Configuração</div>

        {/* WhatsApp locked */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '9px 10px', borderRadius: 'var(--radius-sm)',
          color: 'var(--text-muted)', opacity: 0.5, cursor: 'not-allowed',
          fontSize: 13,
        }}>
          {I.whatsapp}
          <span style={{ flex: 1 }}>WhatsApp</span>
          <span style={{
            background: 'var(--amber-dim)', color: 'var(--amber)',
            border: '1px solid rgba(240,165,0,0.3)',
            borderRadius: 4, fontSize: 9, fontWeight: 700,
            padding: '2px 5px', letterSpacing: '0.5px',
          }}>PRO</span>
        </div>
      </div>

      {/* Upgrade card */}
      <div style={{ padding: '8px' }}>
        <div style={{
          background: 'linear-gradient(135deg, var(--green-dark), #0A3D2A)',
          border: '1px solid rgba(0,208,132,0.2)',
          borderRadius: 'var(--radius-md)', padding: '12px',
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--green)', marginBottom: 4 }}>Upgrade para Pro</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>Ative notificações WhatsApp e relatórios avançados.</div>
        </div>
      </div>

      {/* User */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--blue), #2D7DD2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0,
        }}>
          {(user?.name || user?.username || 'A')[0].toUpperCase()}
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name || user?.username}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{user?.role === 'admin' ? 'Administrador' : 'Gerente'}</div>
        </div>
        <button onClick={() => { logout(); navigate('/login') }} title="Sair"
          style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', padding: 4, borderRadius: 4, display: 'flex' }}>
          {I.logout}
        </button>
      </div>
    </nav>
  )
}

function Layout() {
  const { token, connectWS } = useFlowStore()
  useEffect(() => { if (token) connectWS() }, [token])
  useEffect(() => {
    // Solicita permissão de notificação e desbloqueia áudio
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
    // Desbloqueia AudioContext no primeiro clique
    const unlock = () => {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)()
        ctx.resume()
        // Toca silêncio para desbloquear
        const buf = ctx.createBuffer(1,1,22050)
        const src = ctx.createBufferSource()
        src.buffer = buf
        src.connect(ctx.destination)
        src.start(0)
      } catch(_) {}
      document.removeEventListener('click', unlock)
      document.removeEventListener('keydown', unlock)
    }
    document.addEventListener('click', unlock)
    document.addEventListener('keydown', unlock)
    return () => {
      document.removeEventListener('click', unlock)
      document.removeEventListener('keydown', unlock)
    }
  }, [token])
  if (!token) return <Navigate to="/login" replace/>
  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-primary)' }}>
      <Sidebar/>
      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Suspense fallback={
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 32, height: 32, border: '2px solid var(--green)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }}/>
              Carregando...
            </div>
          </div>
        }>
          <Routes>
            <Route path="/dashboard"  element={<Dashboard/>}/>
            <Route path="/operation"      element={<Operation/>}/>
            <Route path="/daily-operation" element={<DailyOperation/>}/>
            <Route path="/history"    element={<History/>}/>
            <Route path="/reports"    element={<Reports/>}/>
            <Route path="/registers"  element={<Registers/>}/>
            <Route path="/settings"   element={<Settings/>}/>
            <Route path="/guards"     element={<Guards/>}/>
            <Route path="/posts"      element={<Posts/>}/>
            <Route path="/shifts"     element={<Shifts/>}/>
            <Route path="*"           element={<Navigate to="/operation" replace/>}/>
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}

function Login() {
  const { login } = useFlowStore()
  const navigate  = useNavigate()
  const [form, setForm]     = useState({ username: '', password: '' })
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const handle = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await apiLogin(form.username, form.password)
      login(res.token, res.user)
      navigate('/dashboard')
    } catch { setError('Usuário ou senha incorretos') }
    finally { setLoading(false) }
  }

  return (
    <div style={{
      height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-primary)',
      backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(0,208,132,0.08) 0%, transparent 60%)',
    }}>
      <div style={{ width: 380, animation: 'fadeIn .3s ease' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 110, height: 110, margin: '0 auto 12px' }}>
            <img src="/logo.png" alt="FlowSight Sentinel" style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>FlowSight</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', letterSpacing: '2px', textTransform: 'uppercase', marginTop: 2 }}>Sentinel</div>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: '28px 28px',
        }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Entrar no sistema</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 24 }}>Monitoramento de postos de vigilância</div>

          <form onSubmit={handle} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[['Usuário', 'text', 'username', 'admin'], ['Senha', 'password', 'password', '••••••••']].map(([label, type, key, ph]) => (
              <div key={key}>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 6, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{label}</label>
                <input type={type} value={form[key]} onChange={e => setForm(f => ({...f, [key]: e.target.value}))}
                  placeholder={ph}
                  style={{
                    width: '100%', padding: '10px 12px',
                    background: 'var(--bg-primary)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
                    fontSize: 13, outline: 'none', transition: 'border-color .15s',
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--green)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                />
              </div>
            ))}

            {error && (
              <div style={{ background: 'var(--red-dim)', border: '1px solid rgba(255,68,68,0.3)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: 12, color: 'var(--red)' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              padding: '11px', borderRadius: 'var(--radius-sm)', border: 'none',
              background: loading ? 'var(--bg-hover)' : 'linear-gradient(135deg, #00D084, #00A86B)',
              color: loading ? 'var(--text-muted)' : '#fff',
              fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all .2s', marginTop: 4,
              boxShadow: loading ? 'none' : '0 4px 16px rgba(0,208,132,0.3)',
            }}>
              {loading ? 'Autenticando...' : 'Entrar'}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: 'var(--text-muted)' }}>
          FlowSight Sentinel v1.0 · Corsight/Fortify Integration
        </div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AudioUnlocker/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <Routes>
        <Route path="/login" element={<Login/>}/>
        <Route path="/*"     element={<Layout/>}/>
      </Routes>
    </BrowserRouter>
  )
}

// Componente invisível que desbloqueia o AudioContext no primeiro clique
function AudioUnlocker() {
  useEffect(() => {
    const unlock = () => {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)()
        const buf = ctx.createBuffer(1, 1, 22050)
        const src = ctx.createBufferSource()
        src.buffer = buf
        src.connect(ctx.destination)
        src.start(0)
        ctx.resume()
      } catch(_) {}
      document.removeEventListener('click', unlock)
    }
    document.addEventListener('click', unlock)
    return () => document.removeEventListener('click', unlock)
  }, [])
  return null
}
