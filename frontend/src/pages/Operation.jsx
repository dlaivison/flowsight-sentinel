import { useState, useEffect, useMemo } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useFlowStore } from '../store'
import JustifyModal from '../components/JustifyModal'
import AlarmModal from '../components/alarms/AlarmModal'

const STATUS = {
  covered:   { color:'#00D084', bg:'rgba(0,208,132,0.1)',  border:'rgba(0,208,132,0.2)',  label:'Coberto'     },
  warning:   { color:'#F0A500', bg:'rgba(240,165,0,0.1)',  border:'rgba(240,165,0,0.2)',  label:'Atenção'     },
  alarm:     { color:'#FF4444', bg:'rgba(255,68,68,0.1)',  border:'rgba(255,68,68,0.3)',  label:'Descoberto'  },
  justified: { color:'#58A6FF', bg:'rgba(88,166,255,0.1)', border:'rgba(88,166,255,0.3)', label:'Justificado' },
}

const initials = n => n?.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase()||'?'

function countdown(s) {
  if (!s && s !== 0) return '—'
  const m = Math.floor(s/60), sec = s%60
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
}

export default function Operation() {
  const { guards: posts, connected, openAlarmModal } = useFlowStore()
  const [justifyPost, setJustifyPost] = useState(null)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10000)
    return () => clearInterval(t)
  }, [])

  const kpis = useMemo(() => ({
    alarm:     posts.filter(p => p.status === 'alarm').length,
    warning:   posts.filter(p => p.status === 'warning').length,
    justified: posts.filter(p => p.status === 'justified').length,
    covered:   posts.filter(p => p.status === 'covered').length,
    total:     posts.length,
  }), [posts])

  const floors = useMemo(() => {
    const m = {}
    posts.forEach(p => {
      const f = p.floor || 'Sem andar'
      if (!m[f]) m[f] = []
      m[f].push(p)
    })
    return m
  }, [posts])

  const handleAlarmClick = (post) => openAlarmModal({
    id: post.alarm_id, post_id: post.post_id, post_name: post.post_name,
    floor: post.floor, absence_seconds: post.absence_seconds,
    absence_minutes: Math.floor((post.absence_seconds||0)/60),
    threshold_seconds: post.absence_threshold_seconds,
    threshold_minutes: Math.floor((post.absence_threshold_seconds||60)/60),
    last_guard_name: post.last_guard_name, last_detected_at: post.last_detected_at,
    triggered_at: post.alarm_triggered_at, guards: post.guards,
  })

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', background:'var(--bg-primary)' }}>
      <style>{`
        @keyframes glow-red{0%,100%{box-shadow:0 0 8px rgba(255,68,68,0.2)}50%{box-shadow:0 0 20px rgba(255,68,68,0.5)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes pulse-green{0%,100%{opacity:1}50%{opacity:0.4}}
      `}</style>

      {/* Header */}
      <div style={{ padding:'16px 24px', borderBottom:'1px solid var(--border-subtle)', background:'var(--bg-secondary)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontSize:22, fontWeight:700, letterSpacing:'-0.5px' }}>Operação</div>
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
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12 }}>
          {[
            { label:'Descoberto', value:kpis.alarm,     color:'#FF4444', glow:kpis.alarm>0 },
            { label:'Atenção',    value:kpis.warning,   color:'#F0A500', glow:false },
            { label:'Justificado',value:kpis.justified, color:'#58A6FF', glow:false },
            { label:'Coberto',    value:kpis.covered,   color:'#00D084', glow:false },
            { label:'Total',      value:kpis.total,     color:'#8B949E', glow:false },
          ].map(k => (
            <div key={k.label} style={{ background:'var(--bg-secondary)', border:`1px solid ${k.color}33`, borderRadius:'var(--radius-lg)', padding:'16px 20px', boxShadow: k.glow?`0 0 20px ${k.color}22`:'none' }}>
              <div style={{ fontSize:28, fontWeight:700, color:k.color, lineHeight:1, marginBottom:4 }}>{k.value}</div>
              <div style={{ fontSize:12, color:'var(--text-secondary)' }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Cards por andar */}
        {Object.entries(floors).map(([floor, floorPosts]) => (
          <div key={floor}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', letterSpacing:'1px', textTransform:'uppercase' }}>{floor}</div>
              <div style={{ fontSize:11, color:'var(--text-muted)' }}>{floorPosts.length} posto(s)</div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:12 }}>
              {floorPosts.map(post => {
                const sc = STATUS[post.status] || STATUS.covered
                const isAlarm = post.status === 'alarm'
                const guards = post.guards || []
                const [localSecs, setLocalSecs] = useState(post.absence_seconds)
                useEffect(() => { setLocalSecs(post.absence_seconds) }, [post.absence_seconds])
                useEffect(() => {
                  if (post.status !== 'justified') return
                  const t = setInterval(() => setLocalSecs(s => s > 0 ? s-1 : 0), 1000)
                  return () => clearInterval(t)
                }, [post.status])

                return (
                  <div key={post.post_id}
                    onClick={() => isAlarm && post.alarm_id && handleAlarmClick(post)}
                    style={{ background:'var(--bg-card)', border:`1px solid ${isAlarm?'rgba(255,68,68,0.4)':'var(--border-subtle)'}`, borderRadius:'var(--radius-md)', padding:14, cursor:isAlarm?'pointer':'default', position:'relative', overflow:'hidden', animation:isAlarm?'glow-red 2s ease-in-out infinite':'none' }}>

                    {isAlarm && <div style={{ position:'absolute', top:0, right:0, background:'var(--red)', color:'#fff', fontSize:9, fontWeight:700, padding:'3px 8px', borderRadius:'0 var(--radius-md) 0 6px', animation:'blink 1s step-end infinite' }}>DESCOBERTO</div>}
                    {post.status === 'justified' && <div style={{ position:'absolute', top:0, right:0, background:'#58A6FF', color:'#fff', fontSize:9, fontWeight:700, padding:'3px 8px', borderRadius:'0 var(--radius-md) 0 6px' }}>JUSTIFICADO</div>}

                    <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:10 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:700 }}>{post.post_name}</div>
                        <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{post.floor||'—'}</div>
                      </div>
                      <span style={{ fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:4, background:sc.bg, color:sc.color, border:`1px solid ${sc.border}` }}>{sc.label}</span>
                    </div>

                    {guards.length > 0 && (
                      <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:10 }}>
                        {guards.map(g => (
                          <div key={g.guard_id} style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 8px', background:'var(--bg-primary)', border:`1px solid ${sc.color}22`, borderRadius:'var(--radius-sm)' }}>
                            <div style={{ width:20, height:20, borderRadius:'50%', background:`${sc.color}22`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:8, fontWeight:700, color:sc.color, overflow:'hidden', flexShrink:0 }}>
                              {g.photo_url ? <img src={g.photo_url} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/> : initials(g.guard_name)}
                            </div>
                            <span style={{ fontSize:11, fontWeight:500 }}>{g.guard_name}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {(post.status === 'alarm' || post.status === 'warning' || post.status === 'covered') && (
                      <button onClick={e => { e.stopPropagation(); setJustifyPost(post) }}
                        style={{ width:'100%', padding:'6px', borderRadius:'var(--radius-sm)', border:'1px solid rgba(88,166,255,0.3)', background:'rgba(88,166,255,0.08)', color:'#58A6FF', fontSize:11, fontWeight:600, cursor:'pointer', marginBottom:8 }}>
                        ⏸ Justificar ausência
                      </button>
                    )}
                    {post.status === 'justified' && (
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:11, color:'#58A6FF', marginBottom:8, padding:'6px 8px', background:'rgba(88,166,255,0.08)', borderRadius:'var(--radius-sm)' }}>
                        <span>⏸ Ausência justificada</span>
                        <span style={{ fontFamily:'monospace', fontWeight:700, fontSize:13 }}>⏱ {countdown(localSecs)}</span>
                      </div>
                    )}

                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:11, color:'var(--text-muted)' }}>
                      <span>{post.last_detected_at ? `Última det: ${format(new Date(post.last_detected_at),'HH:mm:ss')}` : 'Sem detecções'}</span>
                      {post.status !== 'covered' && post.status !== 'justified' && (
                        <span style={{ fontWeight:700, color:sc.color }}>{Math.floor((post.absence_seconds||0)/60)}min</span>
                      )}
                    </div>

                    {post.status !== 'covered' && post.absence_seconds != null && (
                      <div style={{ marginTop:8, height:2, borderRadius:1, background:'var(--bg-hover)' }}>
                        <div style={{ height:'100%', borderRadius:1, background:sc.color, width:`${Math.min(100,(post.absence_seconds/(post.absence_threshold_seconds||60))*100)}%`, transition:'width .5s' }}/>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {posts.length === 0 && (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12, color:'var(--text-muted)', padding:'60px 0' }}>
            <div style={{ fontSize:15, fontWeight:600, color:'var(--text-secondary)' }}>Nenhum posto monitorado</div>
            <div style={{ fontSize:12 }}>Cadastre postos em Cadastros → Postos</div>
          </div>
        )}
      </div>

      <AlarmModal/>
      {justifyPost && <JustifyModal post={justifyPost} onClose={() => setJustifyPost(null)} onSave={() => setJustifyPost(null)}/>}
    </div>
  )
}
