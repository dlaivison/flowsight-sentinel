import { useEffect, useState, useMemo } from 'react'
import { useFlowStore } from '../store'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import AlarmModal from '../components/alarms/AlarmModal'

const STATUS = {
  covered: { color:'#00D084', bg:'rgba(0,208,132,0.1)', border:'rgba(0,208,132,0.2)', label:'Coberto',     dot:'#00D084' },
  warning: { color:'#F0A500', bg:'rgba(240,165,0,0.1)', border:'rgba(240,165,0,0.2)', label:'Atenção',     dot:'#F0A500' },
  alarm:   { color:'#FF4444', bg:'rgba(255,68,68,0.1)',  border:'rgba(255,68,68,0.3)', label:'Descoberto',  dot:'#FF4444' },
}

const initials = n => n?.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase()||'?'

function absTime(seconds) {
  if (!seconds && seconds !== 0) return '—'
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m < 60) return s > 0 ? `${m}min ${s}s` : `${m}min`
  return `${Math.floor(m/60)}h ${m%60}min`
}

function GuardChip({ guard }) {
  const sc = STATUS[guard.status] || STATUS.covered
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 8px', background:'var(--bg-primary)', border:`1px solid ${sc.color}22`, borderRadius:'var(--radius-sm)' }}>
      <div style={{ width:22, height:22, borderRadius:'50%', flexShrink:0, background:`${sc.color}22`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, color:sc.color, overflow:'hidden' }}>
        {guard.photo_url
          ? <img src={guard.photo_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
          : initials(guard.guard_name)
        }
      </div>
      <span style={{ fontSize:11, fontWeight:500, color:'var(--text-primary)' }}>{guard.guard_name}</span>
      <div style={{ width:6, height:6, borderRadius:'50%', background:sc.dot, flexShrink:0 }}/>
    </div>
  )
}

function PostCard({ post, onAlarmClick }) {
  const sc = STATUS[post.status] || STATUS.covered
  const isAlarm = post.status === 'alarm'
  const guards  = post.guards || []

  return (
    <div
      onClick={() => isAlarm && post.alarm_id && onAlarmClick(post)}
      style={{
        background:'var(--bg-card)',
        border:`1px solid ${isAlarm ? 'rgba(255,68,68,0.4)' : 'var(--border-subtle)'}`,
        borderRadius:'var(--radius-md)', padding:'14px',
        cursor: isAlarm ? 'pointer' : 'default',
        transition:'all .2s', position:'relative', overflow:'hidden',
        animation: isAlarm ? 'glow-red 2s ease-in-out infinite' : 'none',
        boxShadow: isAlarm ? '0 0 16px rgba(255,68,68,0.15)' : 'none',
      }}
    >
      {isAlarm && (
        <div style={{
          position:'absolute', top:0, right:0,
          background:'var(--red)', color:'#fff',
          fontSize:9, fontWeight:700, padding:'3px 8px',
          borderRadius:'0 var(--radius-md) 0 6px',
          letterSpacing:'0.5px',
          animation:'blink 1s step-end infinite',
        }}>DESCOBERTO</div>
      )}

      {/* Header do posto */}
      <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:10 }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)' }}>{post.post_name}</div>
          <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{post.floor || '—'}</div>
        </div>
        <span style={{
          fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:4,
          background:sc.bg, color:sc.color, border:`1px solid ${sc.border}`,
          flexShrink:0,
        }}>{sc.label}</span>
      </div>

      {/* Vigilantes do posto */}
      {guards.length > 0 ? (
        <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:10 }}>
          {guards.map(g => <GuardChip key={g.guard_id} guard={g}/>)}
        </div>
      ) : (
        <div style={{ fontSize:11, color:'var(--text-muted)', fontStyle:'italic', marginBottom:10 }}>
          Nenhum vigilante atribuído
        </div>
      )}

      {/* Footer com tempo de ausência */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ fontSize:11, color:'var(--text-muted)', display:'flex', alignItems:'center', gap:5 }}>
          {post.last_detected_at && (
            <>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Última detecção: {format(new Date(post.last_detected_at), 'HH:mm:ss')}
              {post.last_guard_name && ` · ${post.last_guard_name}`}
            </>
          )}
          {!post.last_detected_at && 'Sem detecções recentes'}
        </div>
        {post.status !== 'covered' && (
          <span style={{ fontSize:12, fontWeight:700, color:sc.color }}>
            {absTime(post.absence_seconds)}
          </span>
        )}
      </div>

      {/* Barra de progresso */}
      {post.status !== 'covered' && post.absence_seconds != null && (
        <div style={{ marginTop:8, height:2, borderRadius:1, background:'var(--bg-hover)', overflow:'hidden' }}>
          <div style={{
            height:'100%', borderRadius:1, background:sc.color,
            width:`${Math.min(100, (post.absence_seconds / (post.absence_threshold_seconds || 60)) * 100)}%`,
            transition:'width .5s', boxShadow:`0 0 6px ${sc.color}`,
          }}/>
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const { guards: rawSnapshot, summary, connected, openAlarmModal } = useFlowStore()
  const [filterFloor, setFilterFloor] = useState('all')
  const [now, setNow] = useState(new Date())

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 10000); return () => clearInterval(t) }, [])

  // O store ainda usa guards[] — mas agora o backend retorna postos
  // Tratamos o snapshot como array de postos
  const posts = rawSnapshot

  const floors = useMemo(() => {
    const m = {}
    posts.forEach(p => {
      const f = p.floor || 'Sem andar'
      if (!m[f]) m[f] = []
      m[f].push(p)
    })
    return m
  }, [posts])

  const toShow = filterFloor === 'all' ? Object.keys(floors) : [filterFloor]

  // KPIs baseados em postos
  const kpis = useMemo(() => ({
    alarm:   posts.filter(p => p.status === 'alarm').length,
    warning: posts.filter(p => p.status === 'warning').length,
    covered: posts.filter(p => p.status === 'covered').length,
    total:   posts.length,
  }), [posts])

  const handleAlarmClick = (post) => openAlarmModal({
    id:              post.alarm_id,
    post_id:         post.post_id,
    post_name:       post.post_name,
    floor:           post.floor,
    absence_minutes: post.absence_seconds ? Math.floor(post.absence_seconds / 60) : 0,
    absence_seconds: post.absence_seconds,
    threshold_minutes: Math.floor((post.absence_threshold_seconds || 60) / 60),
    threshold_seconds: post.absence_threshold_seconds,
    last_guard_name:   post.last_guard_name,
    last_detected_at:  post.last_detected_at,
    triggered_at:      post.alarm_triggered_at,
    guards:            post.guards,
  })

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', background:'var(--bg-primary)' }}>
      <style>{`
        @keyframes glow-red{0%,100%{border-color:rgba(255,68,68,0.3)}50%{border-color:rgba(255,68,68,0.7)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
      `}</style>

      {/* Header */}
      <div style={{ padding:'16px 24px', borderBottom:'1px solid var(--border-subtle)', background:'var(--bg-secondary)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontSize:22, fontWeight:700, letterSpacing:'-0.5px' }}>Dashboard</div>
          <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>Monitoramento em tempo real dos postos</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, background:'var(--green-dim)', border:'1px solid rgba(0,208,132,0.3)', borderRadius:20, padding:'5px 12px', fontSize:12, fontWeight:600, color:'var(--green)' }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background:'var(--green)', animation:'pulse-green 1.5s infinite' }}/>
            Ao vivo
          </div>
          <div style={{ fontSize:12, color:'var(--text-muted)' }}>
            {format(now, "dd/MM/yyyy · HH:mm", { locale: ptBR })}
          </div>

        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'20px 24px', display:'flex', flexDirection:'column', gap:20 }}>
        {/* KPIs */}
        <div style={{ display:'flex', gap:12 }}>
          {[
            { label:'Posto Descoberto', value:kpis.alarm,   color:'#FF4444', glow:kpis.alarm>0 },
            { label:'Atenção',          value:kpis.warning, color:'#F0A500', glow:false },
            { label:'Coberto',          value:kpis.covered, color:'#00D084', glow:false },
            { label:'Total Postos',     value:kpis.total,   color:'#58A6FF', glow:false },
          ].map(k => (
            <div key={k.label} style={{
              flex:1, background:'var(--bg-secondary)',
              border:`1px solid ${k.color}33`,
              borderRadius:'var(--radius-lg)', padding:'20px',
              position:'relative', overflow:'hidden',
              boxShadow: k.glow ? `0 0 20px ${k.color}22` : 'none',
            }}>
              <div style={{ fontSize:32, fontWeight:700, color:k.color, lineHeight:1, marginBottom:4 }}>{k.value}</div>
              <div style={{ fontSize:12, color:'var(--text-secondary)', fontWeight:500 }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Filtros de andar */}
        {Object.keys(floors).length > 1 && (
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600, letterSpacing:'0.5px', textTransform:'uppercase', marginRight:4 }}>Andar:</div>
            {['all', ...Object.keys(floors)].map(f => (
              <button key={f} onClick={() => setFilterFloor(f)} style={{
                padding:'5px 14px', borderRadius:20, fontSize:12, fontWeight:600,
                border:'1px solid', cursor:'pointer', transition:'all .15s',
                borderColor: filterFloor===f ? 'var(--green)' : 'var(--border)',
                background:  filterFloor===f ? 'var(--green)' : 'transparent',
                color:       filterFloor===f ? '#000' : 'var(--text-secondary)',
              }}>
                {f === 'all' ? 'Todos' : f.toUpperCase()}
              </button>
            ))}
          </div>
        )}

        {/* Cards por andar */}
        {toShow.map(floor => (
          <div key={floor}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', letterSpacing:'1px', textTransform:'uppercase' }}>{floor}</div>
              <div style={{ fontSize:11, color:'var(--text-muted)' }}>{floors[floor]?.length || 0} posto(s)</div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:12 }}>
              {(floors[floor] || []).map(p => (
                <PostCard key={p.post_id} post={p} onAlarmClick={handleAlarmClick}/>
              ))}
            </div>
          </div>
        ))}

        {posts.length === 0 && (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12, color:'var(--text-muted)', padding:'60px 0' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" opacity=".4"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            <div style={{ fontSize:15, fontWeight:600, color:'var(--text-secondary)' }}>Nenhum posto monitorado</div>
            <div style={{ fontSize:12 }}>Cadastre postos e vigilantes para começar</div>
          </div>
        )}
      </div>

      <AlarmModal/>
    </div>
  )
}
